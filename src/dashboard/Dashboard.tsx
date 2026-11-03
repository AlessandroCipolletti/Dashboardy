import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { canvasHeight, cellRect, computeGrid } from "../grid/metrics"
import type { Placement } from "../grid/pack"
import { useDashboardDocument } from "../persistence/useDashboardDocument"
import { canResize, displaySize, widgetType } from "../widgets/catalog"
import { AddMenu } from "./AddMenu"
import { GridGuides } from "./GridGuides"
import { createdRows, ensurePositions, placeDragged, placeResized } from "./layout"
import { useGestures } from "./useGestures"
import { WidgetCard } from "./WidgetCard"

function useViewport(): { width: number; height: number } {
  const [size, setSize] = useState(() => ({
    width: document.documentElement.clientWidth,
    height: window.innerHeight,
  }))
  useEffect(() => {
    const update = () =>
      setSize({ width: document.documentElement.clientWidth, height: window.innerHeight })
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])
  return size
}

function useScrollY(): number {
  const [scrollY, setScrollY] = useState(() => window.scrollY)
  useEffect(() => {
    const update = () => setScrollY(window.scrollY)
    update()
    window.addEventListener("scroll", update, { passive: true })
    return () => window.removeEventListener("scroll", update)
  }, [])
  return scrollY
}

function useCanvasOrigin(canvasRef: { current: HTMLDivElement | null }): {
  left: number
  top: number
} {
  const [origin, setOrigin] = useState({ left: 0, top: 0 })
  useLayoutEffect(() => {
    const update = () => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      setOrigin((current) =>
        current.left === rect.left && current.top === rect.top
          ? current
          : { left: rect.left, top: rect.top },
      )
    }
    update()
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [canvasRef])
  return origin
}

export function Dashboard() {
  const viewport = useViewport()
  const scrollY = useScrollY()
  const metrics = useMemo(() => computeGrid(viewport.width), [viewport.width])
  const { document, commit } = useDashboardDocument()
  const canvasRef = useRef<HTMLDivElement>(null)
  const origin = useCanvasOrigin(canvasRef)
  const metricsRef = useRef(metrics)
  const widgetsRef = useRef(document.widgets)
  const placementsRef = useRef(new Map<string, Placement>())

  const gestures = useGestures({
    canvasRef,
    metricsRef,
    widgetsRef,
    placementsRef,
    commit,
  })

  const columns = metrics.columns
  const positioned = ensurePositions(document.widgets, columns)

  useEffect(() => {
    if (positioned === document.widgets) return
    commit((current) => ({
      ...current,
      widgets: ensurePositions(current.widgets, columns),
    }))
  }, [columns, commit, document.widgets, positioned])
  const localPoint = (clientX: number, clientY: number) => ({
    x: clientX - origin.left,
    y: clientY - origin.top,
  })

  let preview = positioned
  let dragFrame: { left: number; top: number; width: number; height: number } | null =
    null

  if (gestures.mode.type === "drag") {
    const mode = gestures.mode
    const point = localPoint(mode.clientX, mode.clientY)
    const maxLeft = Math.max(0, metrics.width - mode.width)
    dragFrame = {
      left: Math.min(Math.max(0, point.x - mode.offsetX), maxLeft),
      top: Math.max(0, point.y - mode.offsetY),
      width: mode.width,
      height: mode.height,
    }
    preview = placeDragged(
      positioned,
      mode.id,
      mode.slot.x,
      mode.slot.y,
      columns,
      createdRows(positioned, metrics, viewport.height),
    )
  }

  if (gestures.mode.type === "resize") {
    const mode = gestures.mode
    const widget = positioned.find((item) => item.id === mode.id)
    if (widget) {
      preview = placeResized(positioned, mode.id, mode.snapped, columns)
    }
  }

  const placements = new Map(
    preview.map((widget) => {
      const size = displaySize(widget.type, widget.w, widget.h, columns)
      return [widget.id, { x: widget.x, y: widget.y, w: size.w, h: size.h }] as const
    }),
  )
  const occupiedRows = preview.reduce((max, widget) => {
    const size = displaySize(widget.type, widget.w, widget.h, columns)
    return Math.max(max, widget.y + size.h)
  }, 0)
  const rows = Math.max(createdRows(positioned, metrics, viewport.height), occupiedRows)
  const canvasPixels = canvasHeight(metrics, rows)
  const interacting = gestures.mode.type !== "idle"
  const drag = gestures.mode.type === "drag" ? gestures.mode : null
  const resize = gestures.mode.type === "resize" ? gestures.mode : null
  const previousBoxes = useRef(
    new Map<string, { left: number; top: number; width: number; height: number }>(),
  )
  const liveGhost = (() => {
    const id = drag?.id ?? resize?.id
    if (!id) return null
    const placement = placements.get(id)
    if (!placement) return null
    return cellRect(metrics, placement.x, placement.y, placement.w, placement.h)
  })()
  const [heldGhost, setHeldGhost] = useState<typeof liveGhost>(null)
  const [ghostFading, setGhostFading] = useState(false)
  const ghostMatches =
    !!liveGhost &&
    !!heldGhost &&
    heldGhost.left === liveGhost.left &&
    heldGhost.top === liveGhost.top &&
    heldGhost.width === liveGhost.width &&
    heldGhost.height === liveGhost.height

  if (liveGhost && (!ghostMatches || ghostFading)) {
    setHeldGhost(liveGhost)
    if (ghostFading) setGhostFading(false)
  } else if (!liveGhost && heldGhost && !ghostFading) {
    setGhostFading(true)
  }

  useEffect(() => {
    if (!ghostFading) return
    const timer = window.setTimeout(() => {
      setHeldGhost(null)
      setGhostFading(false)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [ghostFading])

  useLayoutEffect(() => {
    metricsRef.current = metrics
    widgetsRef.current = document.widgets
    placementsRef.current = placements
    const canvas = canvasRef.current
    if (!canvas) return
    const seen = new Set<string>()
    canvas.querySelectorAll<HTMLElement>("[data-widget-id]").forEach((node) => {
      const id = node.dataset.widgetId
      if (!id) return
      seen.add(id)
      const next = {
        left: node.offsetLeft,
        top: node.offsetTop,
        width: node.offsetWidth,
        height: node.offsetHeight,
      }
      const previous = previousBoxes.current.get(id)
      const followPointer = drag?.id === id
      if (previous && !followPointer) {
        const dx = previous.left - next.left
        const dy = previous.top - next.top
        const dw = previous.width - next.width
        const dh = previous.height - next.height
        if (
          Math.abs(dx) > 0.5 ||
          Math.abs(dy) > 0.5 ||
          Math.abs(dw) > 0.5 ||
          Math.abs(dh) > 0.5
        ) {
          node.animate(
            [
              {
                transform: `translate(${dx}px, ${dy}px)`,
                width: `${previous.width}px`,
                height: `${previous.height}px`,
              },
              {
                transform: "translate(0, 0)",
                width: `${next.width}px`,
                height: `${next.height}px`,
              },
            ],
            {
              duration: resize?.id === id ? 180 : 250,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            },
          )
        }
      }
      previousBoxes.current.set(id, next)
    })
    for (const id of previousBoxes.current.keys()) {
      if (!seen.has(id)) previousBoxes.current.delete(id)
    }
  })

  const widgets = [...document.widgets].sort((a, b) => a.id.localeCompare(b.id))

  return (
    <main
      ref={canvasRef}
      className={
        gestures.mode.type === "drag"
          ? "canvas is-interacting is-dragging"
          : gestures.mode.type === "resize"
            ? "canvas is-interacting is-resizing"
            : "canvas"
      }
      data-columns={columns}
      style={{
        height: canvasPixels,
        ["--pad" as string]: `${metrics.gap}px`,
        ["--radius" as string]: `${metrics.radius}px`,
      }}
    >
      <GridGuides
        metrics={metrics}
        rows={rows}
        scrollY={scrollY}
        viewportHeight={viewport.height}
        active={interacting}
        plusCell={gestures.plusCell}
      />
      {heldGhost ? (
        <div
          className={ghostFading ? "slot-ghost is-fading" : "slot-ghost"}
          style={{ ...heldGhost, borderRadius: metrics.radius }}
        />
      ) : null}
      {widgets.map((widget) => {
        const type = widgetType(widget.type)
        const placement = placements.get(widget.id)
        if (!placement) return null
        const dragging = drag?.id === widget.id
        const resizing = resize?.id === widget.id
        const rect =
          dragging && dragFrame
            ? dragFrame
            : cellRect(metrics, placement.x, placement.y, placement.w, placement.h)
        const shown = displaySize(widget.type, placement.w, placement.h, columns)
        return (
          <WidgetCard
            key={widget.id}
            id={widget.id}
            name={type.name}
            gray={type.gray}
            label={`${shown.w}×${shown.h}`}
            lifting={dragging}
            resizing={resizing}
            showHandles={gestures.handlesFor === widget.id || resizing}
            resizeLocked={!canResize(widget.type, columns)}
            style={{
              ...rect,
              borderRadius: metrics.radius,
              zIndex: gestures.handlesFor === widget.id && !dragging ? 3 : undefined,
            }}
          />
        )
      })}
      {gestures.menu ? (
        <AddMenu
          left={gestures.menu.left}
          top={gestures.menu.top}
          onSelect={gestures.chooseType}
        />
      ) : null}
    </main>
  )
}
