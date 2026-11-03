import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { RefObject } from "react"
import { covers } from "../grid/pack"
import type { Placement } from "../grid/pack"
import { pixelToCell } from "../grid/metrics"
import type { GridMetrics } from "../grid/metrics"
import type { DashboardDocument, Widget } from "../model/document"
import { canResize, defaultSize } from "../widgets/catalog"
import type { WidgetTypeId } from "../widgets/catalog"
import {
  createdRows,
  placeDragged,
  placeNew,
  placeResized,
  settleSlot,
  snapPreview,
} from "./layout"

const HOLD_MS = 350
const HANDLE_STILL_MS = 500
const PLUS_STILL_MS = 2000
const MOVE_CANCEL_PX = 10
const STILL_PX = 3

type DragMode = {
  type: "drag"
  id: string
  pointerId: number
  clientX: number
  clientY: number
  originClientX: number
  originClientY: number
  offsetX: number
  offsetY: number
  width: number
  height: number
  slot: { x: number; y: number }
}

type ResizeMode = {
  type: "resize"
  id: string
  pointerId: number
  corner: "bl" | "br"
  anchor: { x: number; y: number; w: number; h: number }
  snapped: { x: number; y: number; w: number; h: number; legal: boolean }
  clientX: number
  clientY: number
}

type Mode = { type: "idle" } | DragMode | ResizeMode

type MenuState = {
  cell: { x: number; y: number }
  left: number
  top: number
}

type Pending =
  | {
      kind: "widget"
      pointerId: number
      id: string
      zone: "bl" | "br" | "top" | "belly"
      startX: number
      startY: number
      offsetX: number
      offsetY: number
      width: number
      height: number
    }
  | {
      kind: "empty"
      pointerId: number
      startX: number
      startY: number
      cell: { x: number; y: number }
    }

function closest(target: EventTarget | null, selector: string): HTMLElement | null {
  if (!(target instanceof Element)) return null
  const found = target.closest(selector)
  return found instanceof HTMLElement ? found : null
}

export function useGestures(input: {
  canvasRef: RefObject<HTMLDivElement | null>
  metricsRef: RefObject<GridMetrics>
  widgetsRef: RefObject<Widget[]>
  placementsRef: RefObject<Map<string, Placement>>
  commit: (recipe: (document: DashboardDocument) => DashboardDocument) => void
}) {
  const { canvasRef, metricsRef, widgetsRef, placementsRef, commit } = input
  const [mode, setMode] = useState<Mode>({ type: "idle" })
  const [handlesFor, setHandlesFor] = useState<string | null>(null)
  const [plusCell, setPlusCell] = useState<{ x: number; y: number } | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)

  const modeRef = useRef(mode)
  const handlesRef = useRef(handlesFor)
  const plusRef = useRef(plusCell)
  const menuRef = useRef(menu)
  const commitRef = useRef(commit)

  useLayoutEffect(() => {
    modeRef.current = mode
    handlesRef.current = handlesFor
    plusRef.current = plusCell
    menuRef.current = menu
    commitRef.current = commit
  }, [commit, handlesFor, menu, mode, plusCell])

  const pendingRef = useRef<Pending | null>(null)
  const holdTimer = useRef<number | null>(null)
  const handleTimer = useRef<number | null>(null)
  const plusTimer = useRef<number | null>(null)
  const hoverPoint = useRef({ clientX: -1000, clientY: -1000 })

  const updateMode = (next: Mode) => {
    modeRef.current = next
    setMode(next)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const clearHold = () => {
      if (holdTimer.current !== null) window.clearTimeout(holdTimer.current)
      holdTimer.current = null
      pendingRef.current = null
    }

    const clearHandleTimer = () => {
      if (handleTimer.current !== null) window.clearTimeout(handleTimer.current)
      handleTimer.current = null
    }

    const clearPlusTimer = () => {
      if (plusTimer.current !== null) window.clearTimeout(plusTimer.current)
      plusTimer.current = null
    }

    const hidePlus = () => {
      clearPlusTimer()
      if (plusRef.current) setPlusCell(null)
    }

    const localPoint = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      return { x: clientX - rect.left, y: clientY - rect.top }
    }

    const emptyCellAt = (clientX: number, clientY: number) => {
      const point = localPoint(clientX, clientY)
      const cell = pixelToCell(metricsRef.current, point.x, point.y)
      if (!cell.inside) return null
      for (const placement of placementsRef.current.values()) {
        if (covers(placement, cell.x, cell.y)) return null
      }
      return { x: cell.x, y: cell.y }
    }

    const openMenu = (
      cell: { x: number; y: number },
      clientX: number,
      clientY: number,
    ) => {
      setMenu({
        cell,
        left: clientX,
        top: clientY + 10,
      })
      plusRef.current = null
      setPlusCell(null)
      setHandlesFor(null)
    }

    const startDrag = (
      pointerId: number,
      id: string,
      clientX: number,
      clientY: number,
      offsetX: number,
      offsetY: number,
      width: number,
      height: number,
    ) => {
      clearHold()
      hidePlus()
      clearHandleTimer()
      setHandlesFor(null)
      setMenu(null)
      const placement = placementsRef.current.get(id)
      updateMode({
        type: "drag",
        id,
        pointerId,
        clientX,
        clientY,
        originClientX: clientX,
        originClientY: clientY,
        offsetX,
        offsetY,
        width,
        height,
        slot: { x: placement?.x ?? 0, y: placement?.y ?? 0 },
      })
    }

    const startResize = (
      pointerId: number,
      id: string,
      corner: "bl" | "br",
      clientX: number,
      clientY: number,
    ) => {
      const placement = placementsRef.current.get(id)
      if (!placement) return
      clearHold()
      hidePlus()
      setMenu(null)
      setHandlesFor(id)
      const anchor = { x: placement.x, y: placement.y, w: placement.w, h: placement.h }
      updateMode({
        type: "resize",
        id,
        pointerId,
        corner,
        anchor,
        snapped: { ...anchor, legal: true },
        clientX,
        clientY,
      })
    }

    const revealChrome = (id: string) => {
      clearHold()
      hidePlus()
      setHandlesFor(id)
    }

    const beginHold = (pending: Pending, action: () => void) => {
      pendingRef.current = pending
      holdTimer.current = window.setTimeout(() => {
        if (pendingRef.current?.pointerId !== pending.pointerId) return
        action()
      }, HOLD_MS)
    }

    const armHandle = (id: string) => {
      clearHandleTimer()
      handleTimer.current = window.setTimeout(() => {
        if (modeRef.current.type !== "idle" || borderHover !== id) return
        handlesRef.current = id
        setHandlesFor(id)
      }, HANDLE_STILL_MS)
    }

    const armPlus = () => {
      clearPlusTimer()
      if (plusRef.current) setPlusCell(null)
      plusTimer.current = window.setTimeout(() => {
        if (modeRef.current.type !== "idle" || menuRef.current) return
        const point = hoverPoint.current
        const cell = emptyCellAt(point.clientX, point.clientY)
        if (cell) setPlusCell(cell)
      }, PLUS_STILL_MS)
    }

    let borderHover: string | null = null

    const borderWidgetAt = (event: PointerEvent): string | null => {
      const widget = closest(event.target, "[data-widget-id]")
      if (!widget?.dataset.widgetId) return null
      if (closest(event.target, "[data-corner], [data-delete]"))
        return widget.dataset.widgetId
      const rect = widget.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const band = Math.max(22, metricsRef.current.radius)
      const onOuterBorder =
        x <= band || y <= band || x >= rect.width - band || y >= rect.height - band
      return onOuterBorder ? widget.dataset.widgetId : null
    }

    const trackMouse = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || modeRef.current.type !== "idle") return
      const previous = hoverPoint.current
      const distance = Math.hypot(
        event.clientX - previous.clientX,
        event.clientY - previous.clientY,
      )
      hoverPoint.current = { clientX: event.clientX, clientY: event.clientY }
      if (menuRef.current) return

      const widgetId = borderWidgetAt(event)
      if (widgetId) {
        hidePlus()
        if (handlesRef.current === widgetId) return
        if (borderHover !== widgetId) {
          borderHover = widgetId
          if (handlesRef.current) {
            handlesRef.current = null
            setHandlesFor(null)
          }
          armHandle(widgetId)
        }
        return
      }

      borderHover = null
      clearHandleTimer()
      if (handlesRef.current) {
        handlesRef.current = null
        setHandlesFor(null)
      }
      if (distance < STILL_PX) return
      const cell = emptyCellAt(event.clientX, event.clientY)
      const plus = plusRef.current
      if (plus && cell && cell.x === plus.x && cell.y === plus.y) return
      if (plus) {
        plusRef.current = null
        setPlusCell(null)
        clearPlusTimer()
      }
      if (!cell) {
        clearPlusTimer()
        return
      }
      armPlus()
    }

    const onPointerDown = (event: PointerEvent) => {
      if (closest(event.target, ".add-menu")) return
      if (menuRef.current) {
        menuRef.current = null
        setMenu(null)
        return
      }
      if (modeRef.current.type !== "idle") return

      const plus = closest(event.target, "[data-plus]")
      if (plus?.dataset.plus) {
        event.preventDefault()
        const [rawX, rawY] = plus.dataset.plus.split(",")
        const x = Number(rawX)
        const y = Number(rawY)
        if (Number.isInteger(x) && Number.isInteger(y))
          openMenu({ x, y }, event.clientX, event.clientY)
        return
      }

      const remove = closest(event.target, "[data-delete]")
      if (remove?.dataset.delete) {
        event.preventDefault()
        const id = remove.dataset.delete
        commitRef.current((current) => ({
          ...current,
          widgets: current.widgets.filter((widget) => widget.id !== id),
        }))
        setHandlesFor(null)
        return
      }

      const cornerEl = closest(event.target, "[data-corner]")
      const widgetEl = closest(event.target, "[data-widget-id]")
      if (cornerEl && widgetEl?.dataset.widgetId && event.pointerType === "mouse") {
        event.preventDefault()
        if (cornerEl.dataset.locked === "true") return
        const corner = cornerEl.dataset.corner === "bl" ? "bl" : "br"
        startResize(
          event.pointerId,
          widgetEl.dataset.widgetId,
          corner,
          event.clientX,
          event.clientY,
        )
        return
      }

      if (widgetEl?.dataset.widgetId) {
        const id = widgetEl.dataset.widgetId
        const rect = widgetEl.getBoundingClientRect()
        const offsetX = event.clientX - rect.left
        const offsetY = event.clientY - rect.top
        if (event.pointerType === "mouse") {
          if (event.button !== 0 || !closest(event.target, ".belly")) return
          event.preventDefault()
          startDrag(
            event.pointerId,
            id,
            event.clientX,
            event.clientY,
            offsetX,
            offsetY,
            rect.width,
            rect.height,
          )
          return
        }

        const metrics = metricsRef.current
        const band = Math.max(metrics.gap + 18, metrics.radius, 36)
        const zone: "bl" | "br" | "top" | "belly" =
          offsetY >= rect.height - band
            ? offsetX < rect.width / 2
              ? "bl"
              : "br"
            : offsetY <= band
              ? "top"
              : "belly"
        beginHold(
          {
            kind: "widget",
            pointerId: event.pointerId,
            id,
            zone,
            startX: event.clientX,
            startY: event.clientY,
            offsetX,
            offsetY,
            width: rect.width,
            height: rect.height,
          },
          () => {
            const pending = pendingRef.current
            if (!pending || pending.kind !== "widget") return
            if (pending.zone === "top") {
              revealChrome(pending.id)
              return
            }
            if (pending.zone === "belly") {
              startDrag(
                pending.pointerId,
                pending.id,
                pending.startX,
                pending.startY,
                pending.offsetX,
                pending.offsetY,
                pending.width,
                pending.height,
              )
              return
            }
            const widget = widgetsRef.current.find((item) => item.id === pending.id)
            if (!widget || !canResize(widget.type, metricsRef.current.columns)) {
              revealChrome(pending.id)
              return
            }
            startResize(
              pending.pointerId,
              pending.id,
              pending.zone,
              pending.startX,
              pending.startY,
            )
          },
        )
        return
      }

      if (event.pointerType === "mouse") return
      const cell = emptyCellAt(event.clientX, event.clientY)
      if (!cell) return
      beginHold(
        {
          kind: "empty",
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          cell,
        },
        () => {
          const pending = pendingRef.current
          if (!pending || pending.kind !== "empty") return
          clearHold()
          openMenu(pending.cell, pending.startX, pending.startY)
        },
      )
    }

    const onPointerMove = (event: PointerEvent) => {
      const pending = pendingRef.current
      if (pending && pending.pointerId === event.pointerId) {
        if (pending.kind === "empty") {
          const cell = emptyCellAt(event.clientX, event.clientY)
          const same = cell && cell.x === pending.cell.x && cell.y === pending.cell.y
          if (same) event.preventDefault()
          else clearHold()
        } else {
          const distance = Math.hypot(
            event.clientX - pending.startX,
            event.clientY - pending.startY,
          )
          if (distance > MOVE_CANCEL_PX) clearHold()
        }
      }

      const active = modeRef.current
      if (active.type === "resize" && active.pointerId === event.pointerId) {
        event.preventDefault()
        const widget = widgetsRef.current.find((item) => item.id === active.id)
        const local = localPoint(event.clientX, event.clientY)
        const snapped = widget
          ? snapPreview(
              active.corner,
              active.anchor,
              local,
              metricsRef.current,
              widget.type,
              active.snapped,
            )
          : active.snapped
        updateMode({
          ...active,
          clientX: event.clientX,
          clientY: event.clientY,
          snapped,
        })
        return
      }
      if (active.type === "drag" && active.pointerId === event.pointerId) {
        event.preventDefault()
        const metrics = metricsRef.current
        const point = localPoint(event.clientX, event.clientY)
        const maxLeft = Math.max(0, metrics.width - active.width)
        const left = Math.min(Math.max(0, point.x - active.offsetX), maxLeft)
        const top = Math.max(0, point.y - active.offsetY)
        const placement = placementsRef.current.get(active.id)
        const rows = createdRows(widgetsRef.current, metrics, window.innerHeight)
        const slot = settleSlot(
          active.slot,
          left,
          top,
          metrics,
          Math.max(0, metrics.columns - (placement?.w ?? 1)),
          Math.max(0, rows - (placement?.h ?? 1)),
        )
        updateMode({ ...active, clientX: event.clientX, clientY: event.clientY, slot })
        return
      }
      trackMouse(event)
    }

    const finish = (event: PointerEvent, commitGesture: boolean) => {
      const pending = pendingRef.current
      if (pending && pending.pointerId === event.pointerId) clearHold()
      const active = modeRef.current
      if (active.type === "idle" || active.pointerId !== event.pointerId) return

      if (commitGesture && active.type === "drag") {
        const distance = Math.hypot(
          event.clientX - active.originClientX,
          event.clientY - active.originClientY,
        )
        const moving = widgetsRef.current.find((widget) => widget.id === active.id)
        if (moving && distance > MOVE_CANCEL_PX) {
          const metrics = metricsRef.current
          const next = placeDragged(
            widgetsRef.current,
            active.id,
            active.slot.x,
            active.slot.y,
            metrics.columns,
            createdRows(widgetsRef.current, metrics, window.innerHeight),
          )
          if (next.some((widget, index) => widget !== widgetsRef.current[index])) {
            commitRef.current((current) => ({ ...current, widgets: next }))
          }
        }
      }

      if (commitGesture && active.type === "resize") {
        const widget = widgetsRef.current.find((item) => item.id === active.id)
        if (widget) {
          if (active.snapped.legal) {
            const next = placeResized(
              widgetsRef.current,
              active.id,
              active.snapped,
              metricsRef.current.columns,
            )
            commitRef.current((current) => ({ ...current, widgets: next }))
          }
        }
      }

      updateMode({ type: "idle" })
      if (active.type === "drag") setHandlesFor(null)
    }

    const onPointerUp = (event: PointerEvent) => finish(event, true)
    const onPointerCancel = (event: PointerEvent) => finish(event, false)
    const onContextMenu = (event: Event) => event.preventDefault()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !menuRef.current) return
      menuRef.current = null
      setMenu(null)
    }
    const onWheel = (event: WheelEvent) => {
      if (modeRef.current.type !== "idle") event.preventDefault()
    }
    canvas.addEventListener("pointerdown", onPointerDown)
    canvas.addEventListener("contextmenu", onContextMenu)
    window.addEventListener("pointermove", onPointerMove, { passive: false })
    window.addEventListener("pointerup", onPointerUp)
    window.addEventListener("pointercancel", onPointerCancel)
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("wheel", onWheel, { passive: false })

    return () => {
      clearHold()
      clearHandleTimer()
      clearPlusTimer()
      canvas.removeEventListener("pointerdown", onPointerDown)
      canvas.removeEventListener("contextmenu", onContextMenu)
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
      window.removeEventListener("pointercancel", onPointerCancel)
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("wheel", onWheel)
    }
  }, [canvasRef, metricsRef, placementsRef, widgetsRef])

  const closeMenu = () => setMenu(null)

  const chooseType = (type: WidgetTypeId) => {
    const cell = menuRef.current?.cell
    if (!cell) return
    setMenu(null)
    commitRef.current((current) => {
      const columns = metricsRef.current.columns
      const size = defaultSize(type, columns)
      const widget = {
        id: crypto.randomUUID(),
        type,
        w: size.w,
        h: size.h,
        x: cell.x,
        y: cell.y,
      }
      return { ...current, widgets: placeNew(current.widgets, widget, columns) }
    })
  }

  return { mode, handlesFor, plusCell, menu, closeMenu, chooseType }
}
