import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import { canvasHeight, cellRect, computeGrid } from "../grid/metrics"
import type { Placement } from "../grid/pack"
import { useDashboardDocument } from "../persistence/useDashboardDocument"
import {
  canResize,
  displaySize,
  resizeAxes,
  resizeExtent,
  screenLimits,
  widgetType,
} from "../widgets/catalog"
import { AddMenu } from "./AddMenu"
import { GridGuides } from "./GridGuides"
import {
  adaptLayout,
  createdRows,
  ensurePositions,
  placeDragged,
  placeResized,
} from "./layout"
import { useGestures } from "./useGestures"
import { WidgetCard } from "./WidgetCard"
import { WidgetSettingsDialog } from "./WidgetSettingsDialog"
import { ImageGallery } from "../widgets/image-gallery/ImageGallery"
import { GallerySettingsForm } from "../widgets/image-gallery/GallerySettingsForm"
import { gallerySettings, type GallerySettings } from "../widgets/image-gallery/settings"
import { VideoWidget } from "../widgets/video/VideoWidget"
import { VideoSettingsForm } from "../widgets/video/VideoSettingsForm"
import { videoSettings, type VideoSettings } from "../widgets/video/settings"

const EXIT_FADE_MS = 300

type ExitSnapshot = {
  id: string
  name: string
  gray: string
  label: string
  lifting: boolean
  resizing: boolean
  showHandles: boolean
  selected: boolean
  resizeLocked: boolean
  axes: {
    bl: { width: boolean; height: boolean }
    br: { width: boolean; height: boolean }
  }
  edgeLimit?: { left: boolean; right: boolean; bottom: boolean }
  view:
    | { type: "image-gallery"; settings: GallerySettings }
    | { type: "video"; settings: VideoSettings }
    | null
  style: CSSProperties
}

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
  const authoredRef = useRef(document.widgets)
  const placementsRef = useRef(new Map<string, Placement>())
  const openSettingsRef = useRef<(id: string) => void>(() => {})

  const gestures = useGestures({
    canvasRef,
    metricsRef,
    widgetsRef,
    authoredRef,
    placementsRef,
    commit,
    openSettingsRef,
  })
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [settingsDraft, setSettingsDraft] = useState<
    GallerySettings | VideoSettings | null
  >(null)
  useLayoutEffect(() => {
    openSettingsRef.current = (id: string) => {
      const widget = document.widgets.find((item) => item.id === id)
      if (!widget) return
      if (widget.type === "image-gallery") {
        setSettingsId(id)
        setSettingsDraft(gallerySettings(widget.settings))
        return
      }
      if (widget.type === "video") {
        setSettingsId(id)
        setSettingsDraft(videoSettings(widget.settings))
      }
    }
  }, [document.widgets])
  const settingsWidget = document.widgets.find(
    (item) =>
      item.id === settingsId && (item.type === "image-gallery" || item.type === "video"),
  )

  const columns = metrics.columns
  const screen = useMemo(
    () => screenLimits(metrics, viewport.height),
    [metrics, viewport.height],
  )
  const authored = ensurePositions(document.widgets, screen)
  const adapted = adaptLayout(authored, screen)

  useEffect(() => {
    if (authored === document.widgets) return
    commit((current) => ({
      ...current,
      widgets: ensurePositions(current.widgets, screen),
    }))
  }, [authored, commit, document.widgets, screen])
  const localPoint = (clientX: number, clientY: number) => ({
    x: clientX - origin.left,
    y: clientY - origin.top,
  })

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
  }

  const dragSlot = gestures.mode.type === "drag" ? gestures.mode.slot : null
  const dragId = gestures.mode.type === "drag" ? gestures.mode.id : null
  const resizeSnap = gestures.mode.type === "resize" ? gestures.mode.snapped : null
  const resizeId = gestures.mode.type === "resize" ? gestures.mode.id : null
  const preview = useMemo(() => {
    if (dragSlot && dragId) {
      return placeDragged(
        adapted,
        dragId,
        dragSlot.x,
        dragSlot.y,
        screen,
        createdRows(adapted, metrics, viewport.height),
      )
    }
    if (resizeSnap && resizeId) {
      const widget = adapted.find((item) => item.id === resizeId)
      if (widget) return placeResized(adapted, resizeId, resizeSnap, screen)
    }
    return adapted
  }, [adapted, dragId, dragSlot, metrics, resizeId, resizeSnap, screen, viewport.height])

  const placements = new Map(
    preview.map((widget) => {
      const size = displaySize(widget.type, widget.w, widget.h, screen)
      return [widget.id, { x: widget.x, y: widget.y, w: size.w, h: size.h }] as const
    }),
  )
  const occupiedRows = preview.reduce((max, widget) => {
    const size = displaySize(widget.type, widget.w, widget.h, screen)
    return Math.max(max, widget.y + size.h)
  }, 0)
  const rows = Math.max(createdRows(adapted, metrics, viewport.height), occupiedRows)
  const canvasPixels = canvasHeight(metrics, rows)
  const interacting = gestures.mode.type !== "idle"
  const drag = gestures.mode.type === "drag" ? gestures.mode : null
  const resize = gestures.mode.type === "resize" ? gestures.mode : null
  const previousBoxes = useRef(
    new Map<string, { left: number; top: number; width: number; height: number }>(),
  )
  const previousCells = useRef(
    new Map<string, { x: number; y: number; w: number; h: number }>(),
  )
  const previousMetrics = useRef(metrics)
  const painted = useRef(new Map<string, ExitSnapshot>())
  const exitTimers = useRef(new Map<string, number>())
  const liveGhost = (() => {
    const id = drag?.id ?? resize?.id
    if (!id) return null
    const placement = placements.get(id)
    if (!placement) return null
    return cellRect(metrics, placement.x, placement.y, placement.w, placement.h)
  })()
  const [heldGhost, setHeldGhost] = useState<typeof liveGhost>(null)
  const [ghostFading, setGhostFading] = useState(false)
  const [leaving, setLeaving] = useState<ExitSnapshot[]>([])
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

  useEffect(() => {
    for (const card of leaving) {
      if (exitTimers.current.has(card.id)) continue
      const timer = window.setTimeout(() => {
        exitTimers.current.delete(card.id)
        setLeaving((current) => current.filter((item) => item.id !== card.id))
      }, EXIT_FADE_MS)
      exitTimers.current.set(card.id, timer)
    }
  }, [leaving])

  useEffect(() => {
    const timers = exitTimers.current
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer)
    }
  }, [])

  const widgetKey = document.widgets.map((widget) => widget.id).join("\0")

  useLayoutEffect(() => {
    const ids = new Set(widgetKey.length === 0 ? [] : widgetKey.split("\0"))
    const removed = [...painted.current.values()].filter((card) => !ids.has(card.id))
    if (removed.length === 0) return
    setLeaving((current) => {
      const known = new Set(current.map((item) => item.id))
      const extra = removed.filter((card) => !known.has(card.id))
      return extra.length === 0 ? current : [...current, ...extra]
    })
  }, [widgetKey])

  useLayoutEffect(() => {
    metricsRef.current = metrics
    widgetsRef.current = adapted
    authoredRef.current = document.widgets
    placementsRef.current = placements
    const canvas = canvasRef.current
    if (!canvas) return
    const metricsChanged =
      previousMetrics.current.columns !== metrics.columns ||
      previousMetrics.current.cell !== metrics.cell ||
      previousMetrics.current.width !== metrics.width
    previousMetrics.current = metrics
    const seen = new Set<string>()
    canvas.querySelectorAll<HTMLElement>("[data-widget-id]").forEach((node) => {
      const id = node.dataset.widgetId
      if (!id) return
      seen.add(id)
      if (node.classList.contains("is-leaving")) {
        if (node.dataset.leaving !== "1") {
          node.dataset.leaving = "1"
          node.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: EXIT_FADE_MS,
            easing: "ease",
            fill: "forwards",
          })
        }
        return
      }
      const cell = placements.get(id)
      const previousCell = previousCells.current.get(id)
      const cellChanged =
        !!cell &&
        !!previousCell &&
        (previousCell.x !== cell.x ||
          previousCell.y !== cell.y ||
          previousCell.w !== cell.w ||
          previousCell.h !== cell.h)
      const followPointer = drag?.id === id
      if (followPointer || cellChanged) {
        node.getAnimations().forEach((animation) => animation.cancel())
      }
      const previous = previousBoxes.current.get(id)
      const next = {
        left: node.offsetLeft,
        top: node.offsetTop,
        width: node.offsetWidth,
        height: node.offsetHeight,
      }
      const pixelsChanged =
        !!previous &&
        (Math.abs(previous.left - next.left) > 0.5 ||
          Math.abs(previous.top - next.top) > 0.5 ||
          Math.abs(previous.width - next.width) > 0.5 ||
          Math.abs(previous.height - next.height) > 0.5)
      const screenScaleOnly = metricsChanged && !cellChanged
      if (followPointer) {
        node.style.zIndex = ""
      } else if (previous && cellChanged && pixelsChanged && !screenScaleOnly) {
        const dx = previous.left - next.left
        const dy = previous.top - next.top
        node.style.zIndex = "3"
        const animation = node.animate(
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
          { duration: 480, easing: "cubic-bezier(0.4, 0, 0.15, 1)" },
        )
        const clearLayer = () => {
          if (node.getAnimations().length === 0) node.style.zIndex = ""
        }
        void animation.finished.then(clearLayer, clearLayer)
      } else if (
        !cellChanged &&
        node.style.zIndex === "3" &&
        node.getAnimations().length === 0
      ) {
        node.style.zIndex = ""
      }
      previousBoxes.current.set(id, next)
      if (cell) previousCells.current.set(id, cell)
    })
    for (const id of previousBoxes.current.keys()) {
      if (seen.has(id)) continue
      previousBoxes.current.delete(id)
      previousCells.current.delete(id)
    }
  })

  const widgets = [...document.widgets].sort((a, b) => a.id.localeCompare(b.id))
  const documentIds = new Set(widgets.map((widget) => widget.id))
  const liveCards: ExitSnapshot[] = []
  for (const widget of widgets) {
    const type = widgetType(widget.type)
    const placement = placements.get(widget.id)
    if (!placement) continue
    const dragging = drag?.id === widget.id
    const resizing = resize?.id === widget.id
    const rect =
      dragging && dragFrame
        ? dragFrame
        : cellRect(metrics, placement.x, placement.y, placement.w, placement.h)
    const shown = displaySize(widget.type, placement.w, placement.h, screen)
    const leftMax = Math.max(1, placement.x + placement.w)
    const rightMax = Math.max(1, columns - placement.x)
    const extent =
      resizing && resize
        ? resizeExtent(
            widget.type,
            screen,
            resize.corner === "br"
              ? Math.max(1, columns - resize.anchor.x)
              : Math.max(1, resize.anchor.x + resize.anchor.w),
          )
        : null
    const atWidth = !!extent && placement.w >= extent.maxW
    const atHeight = !!extent && placement.h >= extent.maxH
    liveCards.push({
      id: widget.id,
      name: type.name,
      gray: type.gray,
      label: `${shown.w}×${shown.h}`,
      lifting: dragging,
      resizing,
      showHandles: gestures.handlesFor === widget.id || resizing,
      selected: gestures.selectedId === widget.id,
      resizeLocked: !canResize(widget.type, screen),
      axes: {
        bl: resizeAxes(widget.type, screen, leftMax),
        br: resizeAxes(widget.type, screen, rightMax),
      },
      edgeLimit: extent
        ? {
            left: resize?.corner === "bl" && atWidth,
            right: resize?.corner === "br" && atWidth,
            bottom: atHeight,
          }
        : undefined,
      view:
        widget.type === "image-gallery"
          ? { type: "image-gallery", settings: gallerySettings(widget.settings) }
          : widget.type === "video"
            ? { type: "video", settings: videoSettings(widget.settings) }
            : null,
      style: {
        ...rect,
        borderRadius: metrics.radius,
        zIndex: gestures.handlesFor === widget.id && !dragging ? 3 : undefined,
      },
    })
  }

  const exiting = leaving.filter((card) => !documentIds.has(card.id))

  useLayoutEffect(() => {
    painted.current = new Map(liveCards.map((card) => [card.id, card]))
  })

  const cards = [
    ...liveCards.map((card) => ({ card, leaving: false })),
    ...exiting.map((card) => ({ card, leaving: true })),
  ]

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
      {cards.map(({ card, leaving: fading }) => (
        <WidgetCard
          key={card.id}
          id={card.id}
          name={card.name}
          gray={card.gray}
          label={card.label}
          lifting={fading ? false : card.lifting}
          resizing={fading ? false : card.resizing}
          showHandles={card.showHandles}
          selected={card.selected}
          resizeLocked={card.resizeLocked}
          axes={card.axes}
          edgeLimit={fading ? undefined : card.edgeLimit}
          leaving={fading}
          hasSettings={!!card.view}
          style={card.style}
        >
          {card.view?.type === "image-gallery" ? (
            <ImageGallery
              id={card.id}
              urls={card.view.settings.urls}
              index={card.view.settings.index}
              slideshow={card.view.settings.slideshow}
              duration={card.view.settings.duration}
              paused={fading || settingsId === card.id || card.lifting || card.resizing}
              onIndex={(index) => {
                if (fading) return
                commit((current) => ({
                  ...current,
                  widgets: current.widgets.map((widget) => {
                    if (widget.id !== card.id || widget.type !== "image-gallery")
                      return widget
                    const settings = gallerySettings(widget.settings)
                    if (settings.index === index) return widget
                    return { ...widget, settings: { ...settings, index } }
                  }),
                }))
              }}
            />
          ) : null}
          {card.view?.type === "video" ? (
            <VideoWidget url={card.view.settings.url} />
          ) : null}
        </WidgetCard>
      ))}
      {gestures.menu ? (
        <AddMenu
          left={gestures.menu.left}
          top={gestures.menu.top}
          onSelect={gestures.chooseType}
        />
      ) : null}
      {settingsWidget && settingsDraft ? (
        <WidgetSettingsDialog
          title={widgetType(settingsWidget.type).name}
          onClose={() => {
            setSettingsId(null)
            setSettingsDraft(null)
          }}
          onSave={() => {
            const id = settingsId
            const saved =
              settingsWidget.type === "image-gallery"
                ? gallerySettings(settingsDraft)
                : videoSettings(settingsDraft)
            setSettingsId(null)
            setSettingsDraft(null)
            commit((current) => ({
              ...current,
              widgets: current.widgets.map((widget) =>
                widget.id === id && widget.type === settingsWidget.type
                  ? { ...widget, settings: saved }
                  : widget,
              ),
            }))
          }}
        >
          {settingsWidget.type === "image-gallery" && "urls" in settingsDraft ? (
            <GallerySettingsForm
              key={settingsId}
              initial={settingsDraft}
              onChange={setSettingsDraft}
            />
          ) : null}
          {settingsWidget.type === "video" && "url" in settingsDraft ? (
            <VideoSettingsForm
              key={settingsId}
              initial={settingsDraft.url}
              onChange={(url) => setSettingsDraft({ url })}
            />
          ) : null}
        </WidgetSettingsDialog>
      ) : null}
    </main>
  )
}
