import { cellRect, rowsInViewport, rowsOnScreen } from "../grid/metrics"
import type { GridMetrics } from "../grid/metrics"
import { pack } from "../grid/pack"
import type { GridItem } from "../grid/pack"
import type { Widget } from "../model/document"
import {
  displaySize,
  fitsOnScreen,
  fittingSizes,
  isAllowedSize,
} from "../widgets/catalog"
import type { Screen, WidgetTypeId } from "../widgets/catalog"

function toItems(widgets: Widget[], screen: Screen): GridItem[] {
  return widgets.map((widget) => {
    const size = displaySize(widget.type, widget.w, widget.h, screen)
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
  const screen = { columns: metrics.columns, rows: rowsOnScreen(metrics, viewportHeight) }
  let bottom = 0
  for (const widget of widgets) {
    const size = displaySize(widget.type, widget.w, widget.h, screen)
    bottom = Math.max(bottom, Math.max(0, widget.y) + size.h)
  }
  return Math.max(bottom, 1) + rowsInViewport(metrics, viewportHeight)
}

export function ensurePositions(widgets: Widget[], screen: Screen): Widget[] {
  if (widgets.every((widget) => widget.x >= 0 && widget.y >= 0)) return widgets
  const placed = pack(toItems(widgets, screen), screen.columns)
  return widgets.map((widget) => {
    if (widget.x >= 0 && widget.y >= 0) return widget
    const place = placed.get(widget.id)
    return { ...widget, x: place?.x ?? 0, y: place?.y ?? 0 }
  })
}

function readingIndex(x: number, y: number, columns: number): number {
  return y * columns + x
}

function coversCells(
  occupied: Set<string>,
  x: number,
  y: number,
  w: number,
  h: number,
  columns: number,
): boolean {
  if (x < 0 || y < 0 || x + w > columns) return true
  for (let row = 0; row < h; row += 1) {
    for (let column = 0; column < w; column += 1) {
      if (occupied.has(`${x + column},${y + row}`)) return true
    }
  }
  return false
}

function wrapAfter(
  occupied: Set<string>,
  w: number,
  h: number,
  columns: number,
  previous: { x: number; y: number; w: number; h: number } | null,
): { x: number; y: number } {
  if (previous) {
    const beside = previous.x + previous.w
    if (!coversCells(occupied, beside, previous.y, w, h, columns)) {
      return { x: beside, y: previous.y }
    }
  }
  let bottom = 0
  for (const cell of occupied) {
    bottom = Math.max(bottom, Number(cell.split(",")[1]) + 1)
  }
  for (let x = 0; x <= columns - w; x += 1) {
    if (!coversCells(occupied, x, bottom, w, h, columns)) return { x, y: bottom }
  }
  return { x: 0, y: bottom + h }
}

function firstOpenCell(
  occupied: Set<string>,
  w: number,
  h: number,
  columns: number,
  earliest: number,
): { x: number; y: number } {
  for (let y = 0; y < 400; y += 1) {
    for (let x = 0; x <= columns - w; x += 1) {
      if (readingIndex(x, y, columns) < earliest) continue
      if (!coversCells(occupied, x, y, w, h, columns)) return { x, y }
    }
  }
  return { x: 0, y: 400 }
}

// Visual layout for the current screen. Saved coordinates stay when every
// widget still fits. A widget with no legal size on this screen is omitted,
// and every widget after it flows into the freed space. Nothing here is saved.
export function adaptLayout(widgets: Widget[], screen: Screen): Widget[] {
  const columns = screen.columns
  const ordered = [...widgets].sort(
    (a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id),
  )
  const occupied = new Set<string>()
  const placed = new Map<string, { x: number; y: number }>()
  let earliest = 0
  let packing = false
  let previous: { x: number; y: number; w: number; h: number } | null = null
  for (const widget of ordered) {
    if (!fitsOnScreen(widget.type, screen)) {
      packing = true
      continue
    }
    const size = displaySize(widget.type, widget.w, widget.h, screen)
    const savedFits =
      !packing &&
      readingIndex(widget.x, widget.y, columns) >= earliest &&
      !coversCells(occupied, widget.x, widget.y, size.w, size.h, columns)
    const wrapped = wrapAfter(occupied, size.w, size.h, columns, previous)
    const spot = savedFits
      ? { x: widget.x, y: widget.y }
      : readingIndex(wrapped.x, wrapped.y, columns) >= earliest
        ? wrapped
        : firstOpenCell(occupied, size.w, size.h, columns, earliest)
    if (!savedFits) packing = true
    for (let row = 0; row < size.h; row += 1) {
      for (let column = 0; column < size.w; column += 1) {
        occupied.add(`${spot.x + column},${spot.y + row}`)
      }
    }
    placed.set(widget.id, spot)
    previous = { x: spot.x, y: spot.y, w: size.w, h: size.h }
    earliest = readingIndex(spot.x, spot.y, columns) + 1
  }
  if (
    placed.size === widgets.length &&
    [...placed].every(([id, spot]) => {
      const widget = widgets.find((item) => item.id === id)
      return widget && widget.x === spot.x && widget.y === spot.y
    })
  ) {
    return widgets
  }
  const visible = widgets.filter((widget) => placed.has(widget.id))
  return visible.map((widget) => {
    const spot = placed.get(widget.id)
    if (!spot || (spot.x === widget.x && spot.y === widget.y)) return widget
    return { ...widget, x: spot.x, y: spot.y }
  })
}

// Keeps the stored position of every widget the gesture did not actually move,
// so a screen reflow is not written back to the document.
export function reconcileEdit(
  saved: Widget[],
  adapted: Widget[],
  edited: Widget[],
): Widget[] {
  const adaptedById = new Map(adapted.map((widget) => [widget.id, widget]))
  const editedById = new Map(edited.map((widget) => [widget.id, widget]))
  const savedIds = new Set(saved.map((widget) => widget.id))
  const merged = saved.map((original) => {
    const prior = adaptedById.get(original.id)
    const widget = editedById.get(original.id)
    if (!prior || !widget) return original
    if (
      prior.x === widget.x &&
      prior.y === widget.y &&
      prior.w === widget.w &&
      prior.h === widget.h
    ) {
      return original
    }
    return { ...original, x: widget.x, y: widget.y, w: widget.w, h: widget.h }
  })
  return [...merged, ...edited.filter((widget) => !savedIds.has(widget.id))]
}

function occupants(widgets: Widget[], screen: Screen): Occupant[] {
  return widgets.map((widget) => {
    const size = displaySize(widget.type, widget.w, widget.h, screen)
    const maxX = Math.max(0, screen.columns - size.w)
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
  screen: Screen,
  maxBottom: number,
): Widget[] {
  const laid = occupants(widgets, screen)
  const target = laid.find((item) => item.id === id)
  if (!target) return widgets
  const home = { ...target }
  target.x = clamp(x, 0, screen.columns - target.w)
  target.y = clamp(y, 0, Math.max(0, maxBottom - target.h))
  settleCollisions(laid, target, home, screen.columns, maxBottom)
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
  separateOverlaps(items, mover.id, columns)
}

// One pass, after every victim has a spot. If two footprints still meet,
// the later widget moves to the next free cell before the layout is shown.
function separateOverlaps(items: Occupant[], moverId: string, columns: number): void {
  const mover = items.find((item) => item.id === moverId)
  if (!mover) return
  const rest = items
    .filter((item) => item.id !== moverId)
    .sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))
  const accepted: Occupant[] = [mover]
  for (const item of rest) {
    if (accepted.some((other) => overlaps(item, other))) {
      const lowest = accepted.reduce(
        (bottom, other) => Math.max(bottom, other.y + other.h),
        0,
      )
      const spot = nearestSpot(
        item,
        accepted,
        [],
        columns,
        lowest + item.h + 8,
        null,
        mover,
      )
      item.x = spot.x
      item.y = spot.y
      let guard = 0
      while (accepted.some((other) => overlaps(item, other)) && guard < 40) {
        item.y += 1
        guard += 1
      }
    }
    accepted.push(item)
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
      lastRow + 24,
    ) ?? { x: 0, y: lastRow + 1 }
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
  screen: Screen,
): Widget[] {
  const laid = occupants(widgets, screen)
  const target = laid.find((item) => item.id === id)
  if (!target) return widgets
  target.x = clamp(preview.x, 0, screen.columns - preview.w)
  target.y = Math.max(0, preview.y)
  target.w = preview.w
  target.h = preview.h
  settleCollisions(laid, target, null, screen.columns, roomBelow(laid))
  return applyPlacement(widgets, laid, { id, w: preview.w, h: preview.h })
}

export function placeNew(widgets: Widget[], widget: Widget, screen: Screen): Widget[] {
  const laid = occupants([...widgets, widget], screen)
  const target = laid.find((item) => item.id === widget.id)
  if (!target) return [...widgets, widget]
  const maxX = Math.max(0, screen.columns - target.w)
  target.x = Math.min(Math.max(0, widget.x), maxX)
  target.y = Math.max(0, widget.y)
  settleCollisions(laid, target, null, screen.columns, roomBelow(laid))
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
  previousPx: number,
  allowed: number[],
  cell: number,
  gap: number,
): number {
  const edge = edgePixels(current, cell, gap)
  const larger = allowed.filter((value) => value > current).sort((a, b) => a - b)[0]
  const smaller = allowed.filter((value) => value < current).sort((a, b) => b - a)[0]
  const outward = pointerPx > previousPx + 1
  const inward = pointerPx < previousPx - 1
  // The next cell counts as soon as the pointer covers 20% of it.
  if (larger !== undefined && outward && pointerPx >= edge + gap + cell * 0.2)
    return larger
  // A cell already in the widget drops once the pointer covers half of it or less.
  if (smaller !== undefined && inward) {
    const covered = (pointerPx - (edge - cell)) / cell
    if (covered <= 0.5) return smaller
  }
  return current
}

function resolvePair(
  allowed: { w: number; h: number }[],
  w: number,
  h: number,
  current: { w: number; h: number },
): { w: number; h: number } {
  if (allowed.length === 0) return current
  if (allowed.some((size) => size.w === w && size.h === h)) return { w, h }
  const widthMoved = w !== current.w
  const heightMoved = h !== current.h
  const sharing = allowed.filter((size) => {
    if (widthMoved && !heightMoved) return size.w === w
    if (heightMoved && !widthMoved) return size.h === h
    return size.w === w || size.h === h
  })
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
  rows: number,
  previousLocal: { x: number; y: number } | null,
): Preview {
  const anchorRect = cellRect(metrics, anchor.x, anchor.y, anchor.w, anchor.h)
  const screen = { columns: metrics.columns, rows }
  const project = (
    size: { w: number; h: number },
    maxW: number,
    pixelW: number,
    pixelH: number,
    previousW: number,
    previousH: number,
  ) => {
    const allowed = fittingSizes(type, screen, maxW)
    return resolvePair(
      allowed,
      stepAxis(
        size.w,
        pixelW,
        previousW,
        allowed.map((item) => item.w),
        metrics.cell,
        metrics.gap,
      ),
      stepAxis(
        size.h,
        pixelH,
        previousH,
        allowed.map((item) => item.h),
        metrics.cell,
        metrics.gap,
      ),
      size,
    )
  }

  // A coupled size, such as a square, can jump on one axis and then shrink
  // on the other, flipping every sample while the pointer stays still.
  // Keep the larger size while the pointer is still past the line that grew it.
  const stabilize = (
    size: { w: number; h: number },
    maxW: number,
    pixelW: number,
    pixelH: number,
    previousW: number,
    previousH: number,
  ) => {
    const forward = project(size, maxW, pixelW, pixelH, previousW, previousH)
    const back = project(forward, maxW, pixelW, pixelH, previousW, previousH)
    const cycling =
      back.w === size.w &&
      back.h === size.h &&
      (forward.w !== size.w || forward.h !== size.h)
    if (!cycling) return forward
    const larger = forward.w * forward.h >= size.w * size.h ? forward : size
    const smaller = larger === forward ? size : forward
    const widthHeld =
      larger.w > smaller.w &&
      pixelW >=
        edgePixels(smaller.w, metrics.cell, metrics.gap) +
          metrics.gap +
          metrics.cell * 0.2
    const heightHeld =
      larger.h > smaller.h &&
      pixelH >=
        edgePixels(smaller.h, metrics.cell, metrics.gap) +
          metrics.gap +
          metrics.cell * 0.2
    return widthHeld || heightHeld ? larger : smaller
  }

  const finish = (
    size: { w: number; h: number },
    maxW: number,
    originX: number,
  ): Preview => {
    const w = Math.min(size.w, maxW)
    return {
      x: originX,
      y: anchor.y,
      w,
      h: size.h,
      legal: isAllowedSize(type, w, size.h) && w <= maxW && size.h <= rows,
    }
  }

  const relax = (
    maxW: number,
    pixelW: number,
    pixelH: number,
    previousW: number,
    previousH: number,
  ) => {
    let size = { w: current.w, h: current.h }
    for (let step = 0; step < 24; step += 1) {
      const next = stabilize(size, maxW, pixelW, pixelH, previousW, previousH)
      if (next.w === size.w && next.h === size.h) return next
      size = next
    }
    return size
  }

  const pointer = (point: { x: number; y: number }) =>
    corner === "br"
      ? { w: point.x - anchorRect.left, h: point.y - anchorRect.top }
      : {
          w: anchorRect.left + anchorRect.width - point.x,
          h: point.y - anchorRect.top,
        }
  const pixel = pointer(local)
  const previous = pointer(previousLocal ?? local)
  if (corner === "br") {
    const maxW = Math.max(1, metrics.columns - anchor.x)
    return finish(relax(maxW, pixel.w, pixel.h, previous.w, previous.h), maxW, anchor.x)
  }

  const right = anchor.x + anchor.w
  const maxW = Math.max(1, right)
  const size = relax(maxW, pixel.w, pixel.h, previous.w, previous.h)
  return finish(size, maxW, right - Math.min(size.w, maxW))
}
