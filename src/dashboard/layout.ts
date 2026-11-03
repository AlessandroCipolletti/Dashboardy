import { cellRect, rowsInViewport } from "../grid/metrics"
import type { GridMetrics } from "../grid/metrics"
import { pack } from "../grid/pack"
import type { GridItem } from "../grid/pack"
import type { Widget } from "../model/document"
import { displaySize, isAllowedSize, widgetType } from "../widgets/catalog"
import type { WidgetTypeId } from "../widgets/catalog"

function toItems(widgets: Widget[], columns: number): GridItem[] {
  return widgets.map((widget) => {
    const size = displaySize(widget.type, widget.w, widget.h, columns)
    return { id: widget.id, w: size.w, h: size.h }
  })
}

type Occupant = { id: string; x: number; y: number; w: number; h: number }

function overlaps(a: Occupant, b: Occupant): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

export function createdRows(
  widgets: Widget[],
  metrics: GridMetrics,
  viewportHeight: number,
): number {
  const columns = metrics.columns
  let bottom = 0
  for (const widget of widgets) {
    const size = displaySize(widget.type, widget.w, widget.h, columns)
    bottom = Math.max(bottom, Math.max(0, widget.y) + size.h)
  }
  return Math.max(bottom, 1) + rowsInViewport(metrics, viewportHeight)
}

export function ensurePositions(widgets: Widget[], columns: number): Widget[] {
  if (widgets.every((widget) => widget.x >= 0 && widget.y >= 0)) return widgets
  const placed = pack(toItems(widgets, columns), columns)
  return widgets.map((widget) => {
    if (widget.x >= 0 && widget.y >= 0) return widget
    const place = placed.get(widget.id)
    return { ...widget, x: place?.x ?? 0, y: place?.y ?? 0 }
  })
}

function occupants(widgets: Widget[], columns: number): Occupant[] {
  return widgets.map((widget) => {
    const size = displaySize(widget.type, widget.w, widget.h, columns)
    const maxX = Math.max(0, columns - size.w)
    return {
      id: widget.id,
      x: Math.min(Math.max(0, widget.x), maxX),
      y: Math.max(0, widget.y),
      w: size.w,
      h: size.h,
    }
  })
}

const MAGNET = 0.62

export function settleSlot(
  current: { x: number; y: number },
  left: number,
  top: number,
  metrics: GridMetrics,
  maxX: number,
  maxY: number,
): { x: number; y: number } {
  const stride = metrics.cell + metrics.gap
  const rawX = (left - metrics.padding) / stride
  const rawY = (top - metrics.padding) / stride
  return {
    x: clamp(settleAxis(current.x, rawX), 0, maxX),
    y: clamp(settleAxis(current.y, rawY), 0, maxY),
  }
}

function settleAxis(current: number, raw: number): number {
  let value = current
  for (let step = 0; step < 48; step += 1) {
    if (raw >= value + MAGNET) {
      value += 1
      continue
    }
    if (raw <= value - MAGNET) {
      value -= 1
      continue
    }
    break
  }
  return value
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

export function placeDragged(
  widgets: Widget[],
  id: string,
  x: number,
  y: number,
  columns: number,
  maxBottom: number,
): Widget[] {
  const laid = occupants(widgets, columns)
  const target = laid.find((item) => item.id === id)
  if (!target) return widgets
  const home = { ...target }
  target.x = clamp(x, 0, columns - target.w)
  target.y = clamp(y, 0, Math.max(0, maxBottom - target.h))
  settleCollisions(laid, target, home, columns, maxBottom)
  return changed(widgets, laid) ? applyPlacement(widgets, laid) : widgets
}

// The grabbed widget keeps one grid slot. Empty cells stay empty. Only widgets
// covered by that slot move: one widget trades places when it is mostly covered
// and both footprints fit, otherwise each covered widget steps to the nearest
// free gap. Everyone else stays where it is.
function settleCollisions(
  items: Occupant[],
  mover: Occupant,
  home: Occupant | null,
  columns: number,
  maxBottom: number,
): void {
  const others = items.filter((item) => item.id !== mover.id)
  const victims = others
    .filter((item) => overlaps(item, mover))
    .sort((a, b) => a.y - b.y || a.x - b.x)
  if (victims.length === 0) return
  if (home && victims.length === 1 && trySwap(items, mover, victims[0], home, columns))
    return

  const victimIds = new Set(victims.map((victim) => victim.id))
  const blocked: Occupant[] = [
    mover,
    ...others.filter((item) => !victimIds.has(item.id)),
    ...victims.map((victim) => ({ ...victim })),
  ]
  const placed: Occupant[] = []
  for (const victim of victims) {
    const spot = nearestSpot(
      victim,
      blocked.filter((item) => item.id !== victim.id),
      placed,
      columns,
      maxBottom,
      home,
      mover,
    )
    victim.x = spot.x
    victim.y = spot.y
    blocked.push(victim)
    placed.push(victim)
  }
}

function trySwap(
  items: Occupant[],
  mover: Occupant,
  victim: Occupant,
  home: Occupant,
  columns: number,
): boolean {
  const overlap = overlapCells(mover, victim)
  if (overlap * 2 <= victim.w * victim.h) return false
  const parked: Occupant = { ...victim, x: home.x, y: home.y }
  if (parked.x < 0 || parked.y < 0 || parked.x + parked.w > columns) return false
  if (overlaps(parked, mover)) return false
  for (const other of items) {
    if (other.id === mover.id || other.id === victim.id) continue
    if (overlaps(other, parked)) return false
  }
  victim.x = home.x
  victim.y = home.y
  return true
}

function overlapCells(a: Occupant, b: Occupant): number {
  const width = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const height = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return width > 0 && height > 0 ? width * height : 0
}

function nearestSpot(
  victim: Occupant,
  blocked: Occupant[],
  earlier: Occupant[],
  columns: number,
  maxBottom: number,
  home: Occupant | null,
  mover: Occupant,
): { x: number; y: number } {
  const dragX = home ? Math.sign(mover.x - home.x) : 0
  const dragY = home ? Math.sign(mover.y - home.y) : 0
  const lastRow = Math.max(0, maxBottom - victim.h)
  return (
    searchRows(victim, blocked, earlier, columns, dragX, dragY, 0, lastRow) ??
    searchRows(
      victim,
      blocked,
      earlier,
      columns,
      dragX,
      dragY,
      lastRow + 1,
      lastRow + 4,
    ) ?? {
      x: 0,
      y: lastRow + 1,
    }
  )
}

function searchRows(
  victim: Occupant,
  blocked: Occupant[],
  earlier: Occupant[],
  columns: number,
  dragX: number,
  dragY: number,
  from: number,
  to: number,
): { x: number; y: number } | null {
  if (victim.w > columns) return { x: 0, y: Math.max(0, from) }
  let best: { x: number; y: number; cost: number } | null = null
  for (let y = from; y <= to; y += 1) {
    if (y < 0) continue
    for (let x = 0; x <= columns - victim.w; x += 1) {
      const rect = { ...victim, x, y }
      if (blocked.some((item) => overlaps(rect, item))) continue
      const row = Math.abs(y - victim.y)
      const col = Math.abs(x - victim.x)
      const againstX =
        dragX !== 0 && x !== victim.x && Math.sign(x - victim.x) !== dragX ? 1 : 0
      const againstY =
        dragY !== 0 && y !== victim.y && Math.sign(y - victim.y) !== dragY ? 1 : 0
      const order = earlier.some((item) => y * columns + x < item.y * columns + item.x)
        ? 1
        : 0
      const cost = (row + col) * 2 + againstX + againstY + order
      if (!best || cost < best.cost) best = { x, y, cost }
    }
  }
  return best
}

function roomBelow(items: Occupant[]): number {
  let bottom = 0
  for (const item of items) bottom = Math.max(bottom, item.y + item.h)
  return bottom + 6
}

function changed(widgets: Widget[], laid: Occupant[]): boolean {
  return widgets.some((widget) => {
    const place = laid.find((item) => item.id === widget.id)
    return !place || place.x !== widget.x || place.y !== widget.y
  })
}

function applyPlacement(
  widgets: Widget[],
  laid: Occupant[],
  change?: { id: string; w?: number; h?: number },
): Widget[] {
  return widgets.map((widget) => {
    const place = laid.find((item) => item.id === widget.id)
    if (!place) return widget
    const resized = change?.id === widget.id
    return {
      ...widget,
      x: place.x,
      y: place.y,
      w: resized && change?.w ? change.w : widget.w,
      h: resized && change?.h ? change.h : widget.h,
    }
  })
}

export function placeResized(
  widgets: Widget[],
  id: string,
  preview: { x: number; y: number; w: number; h: number },
  columns: number,
): Widget[] {
  const laid = occupants(widgets, columns)
  const target = laid.find((item) => item.id === id)
  if (!target) return widgets
  target.x = clamp(preview.x, 0, columns - preview.w)
  target.y = Math.max(0, preview.y)
  target.w = preview.w
  target.h = preview.h
  settleCollisions(laid, target, null, columns, roomBelow(laid))
  return applyPlacement(widgets, laid, { id, w: preview.w, h: preview.h })
}

export function placeNew(widgets: Widget[], widget: Widget, columns: number): Widget[] {
  const laid = occupants([...widgets, widget], columns)
  const target = laid.find((item) => item.id === widget.id)
  if (!target) return [...widgets, widget]
  const maxX = Math.max(0, columns - target.w)
  target.x = Math.min(Math.max(0, widget.x), maxX)
  target.y = Math.max(0, widget.y)
  settleCollisions(laid, target, null, columns, roomBelow(laid))
  return applyPlacement([...widgets, widget], laid)
}

type Preview = {
  x: number
  y: number
  w: number
  h: number
  legal: boolean
}

function edgePixels(span: number, cell: number, gap: number): number {
  if (span <= 0) return 0
  return span * cell + (span - 1) * gap
}

function stepAxis(
  current: number,
  pointerPx: number,
  allowed: number[],
  cell: number,
  gap: number,
): number {
  const stride = cell + gap
  const edge = edgePixels(current, cell, gap)
  const larger = allowed.filter((value) => value > current).sort((a, b) => a - b)[0]
  const smaller = allowed.filter((value) => value < current).sort((a, b) => b - a)[0]
  if (larger !== undefined && pointerPx >= edge + stride * 0.62) return larger
  if (smaller !== undefined && pointerPx <= edge - stride * 0.62) return smaller
  return current
}

function resolvePair(
  type: WidgetTypeId,
  w: number,
  h: number,
  current: { w: number; h: number },
  maxW: number,
): { w: number; h: number } {
  const allowed = widgetType(type).sizes.filter((size) => size.w <= maxW)
  if (allowed.length === 0) return current
  if (allowed.some((size) => size.w === w && size.h === h)) return { w, h }
  const sharing = allowed.filter((size) => size.w === w || size.h === h)
  const pool = sharing.length > 0 ? sharing : allowed
  return closestSize(pool, w, h)
}

function closestSize(sizes: { w: number; h: number }[], w: number, h: number) {
  return sizes.reduce((best, size) => {
    const bestDistance = (best.w - w) ** 2 + (best.h - h) ** 2
    const distance = (size.w - w) ** 2 + (size.h - h) ** 2
    if (distance < bestDistance) return size
    if (distance === bestDistance && size.w * size.h < best.w * best.h) return size
    return best
  })
}

export function snapPreview(
  corner: "bl" | "br",
  anchor: { x: number; y: number; w: number; h: number },
  local: { x: number; y: number },
  metrics: GridMetrics,
  type: WidgetTypeId,
  current: { w: number; h: number },
): Preview {
  const anchorRect = cellRect(metrics, anchor.x, anchor.y, anchor.w, anchor.h)
  const allowed = widgetType(type).sizes.filter((size) => size.w <= metrics.columns)
  const widths = allowed.map((size) => size.w)
  const heights = allowed.map((size) => size.h)

  if (corner === "br") {
    const pixelW = Math.max(metrics.cell * 0.55, local.x - anchorRect.left)
    const pixelH = Math.max(metrics.cell * 0.55, local.y - anchorRect.top)
    const maxW = Math.max(1, metrics.columns - anchor.x)
    const stepped = resolvePair(
      type,
      stepAxis(current.w, pixelW, widths, metrics.cell, metrics.gap),
      stepAxis(current.h, pixelH, heights, metrics.cell, metrics.gap),
      current,
      maxW,
    )
    const w = Math.min(stepped.w, maxW)
    return {
      x: anchor.x,
      y: anchor.y,
      w,
      h: stepped.h,
      legal: isAllowedSize(type, w, stepped.h),
    }
  }

  const right = anchor.x + anchor.w
  const pixelW = Math.max(
    metrics.cell * 0.55,
    anchorRect.left + anchorRect.width - local.x,
  )
  const pixelH = Math.max(metrics.cell * 0.55, local.y - anchorRect.top)
  const maxW = Math.max(1, right)
  const stepped = resolvePair(
    type,
    stepAxis(current.w, pixelW, widths, metrics.cell, metrics.gap),
    stepAxis(current.h, pixelH, heights, metrics.cell, metrics.gap),
    current,
    maxW,
  )
  const w = Math.min(stepped.w, maxW)
  return {
    x: right - w,
    y: anchor.y,
    w,
    h: stepped.h,
    legal: isAllowedSize(type, w, stepped.h),
  }
}
