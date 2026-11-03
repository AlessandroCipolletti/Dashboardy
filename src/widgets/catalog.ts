import type { GridMetrics } from "../grid/metrics"
import { rowsOnScreen } from "../grid/metrics"

export const widgetTypeIds = [
  "compact",
  "wide",
  "free",
  "horizontal",
  "vertical",
  "square",
  "band",
  "block",
  "tower",
  "poster",
  "panorama",
  "banner",
] as const

export type WidgetTypeId = (typeof widgetTypeIds)[number]

type Size = { w: number; h: number }

/** A fixed cell count, or every cell up to the current screen. */
type SpanEnd = number | "screen"

type Span = { min: number; max: SpanEnd }

/**
 * A widget type either lists exact sizes, or allows every pair inside two
 * spans. "screen" on width means the columns of the current row. "screen" on
 * height means the rows that fit in the current viewport.
 */
type SizeRule =
  { sizes: Size[] } | { w: Span; h: Span; accept?: (w: number, h: number) => boolean }

export type Screen = { columns: number; rows: number }

type WidgetType = {
  id: WidgetTypeId
  name: string
  gray: string
  size: SizeRule
  sizeHint: string
}

function span(min: number, max: SpanEnd): Span {
  return { min, max }
}

export const catalog: WidgetType[] = [
  {
    id: "compact",
    name: "Compatto",
    gray: "#f4f4f4",
    size: {
      sizes: [
        { w: 1, h: 1 },
        { w: 2, h: 1 },
        { w: 1, h: 2 },
        { w: 2, h: 2 },
      ],
    },
    sizeHint: "1×1 · 2×1 · 1×2 · 2×2",
  },
  {
    id: "wide",
    name: "Ampio",
    gray: "#c8c8c8",
    size: { w: span(3, "screen"), h: span(2, 5) },
    sizeHint: "larghezza da 3 a tutta la riga · altezza 2–5",
  },
  {
    id: "free",
    name: "Libero",
    gray: "#dedede",
    size: { w: span(1, "screen"), h: span(1, "screen") },
    sizeHint: "da 1×1 a tutto lo schermo",
  },
  {
    id: "horizontal",
    name: "Orizzontale",
    gray: "#bdbdbd",
    size: { w: span(2, "screen"), h: span(1, 3), accept: (w, h) => w > h },
    sizeHint: "più largo che alto, fino alla riga",
  },
  {
    id: "vertical",
    name: "Verticale",
    gray: "#b0b0b0",
    size: { w: span(1, 3), h: span(2, "screen"), accept: (w, h) => h > w },
    sizeHint: "più alto che largo, fino allo schermo",
  },
  {
    id: "square",
    name: "Quadrato",
    gray: "#d2d2d2",
    size: { w: span(1, "screen"), h: span(1, "screen"), accept: (w, h) => w === h },
    sizeHint: "quadrati da 1 fino allo schermo",
  },
  {
    id: "band",
    name: "Fascia",
    gray: "#e4e4e4",
    size: { w: span(2, "screen"), h: span(1, 1) },
    sizeHint: "alta 1 · larga da 2 a tutta la riga",
  },
  {
    id: "block",
    name: "Blocco",
    gray: "#b7b7b7",
    size: {
      sizes: [
        { w: 3, h: 2 },
        { w: 3, h: 3 },
        { w: 4, h: 2 },
      ],
    },
    sizeHint: "3×2 · 3×3 · 4×2",
  },
  {
    id: "tower",
    name: "Torre",
    gray: "#9e9e9e",
    size: { w: span(1, 2), h: span(4, "screen"), accept: (w, h) => h > w },
    sizeHint: "larga 1–2 · alta da 4 allo schermo",
  },
  {
    id: "poster",
    name: "Manifesto",
    gray: "#8a8a8a",
    size: {
      sizes: [
        { w: 6, h: 3 },
        { w: 6, h: 4 },
      ],
    },
    sizeHint: "solo 6×3 · 6×4",
  },
  {
    id: "panorama",
    name: "Panorama",
    gray: "#7a7a7a",
    size: { w: span(8, "screen"), h: span(2, 4) },
    sizeHint: "larga da 8 a tutta la riga · alta 2–4",
  },
  {
    id: "banner",
    name: "Striscione",
    gray: "#6a6a6a",
    size: { w: span(10, "screen"), h: span(2, 3) },
    sizeHint: "larga da 10 a tutta la riga · alta 2–3",
  },
]

const byId = new Map(catalog.map((type) => [type.id, type]))

export function isWidgetTypeId(value: string): value is WidgetTypeId {
  return byId.has(value as WidgetTypeId)
}

export function widgetType(id: WidgetTypeId): WidgetType {
  const type = byId.get(id)
  if (!type) throw new Error(`Unknown widget type: ${id}`)
  return type
}

export function screenLimits(metrics: GridMetrics, viewportHeight: number): Screen {
  return { columns: metrics.columns, rows: rowsOnScreen(metrics, viewportHeight) }
}

function spanLimit(end: SpanEnd, screenMax: number): number {
  return end === "screen" ? screenMax : Math.min(end, screenMax)
}

function closest(sizes: Size[], w: number, h: number): Size {
  return sizes.reduce((best, size) => {
    const bestDistance = (best.w - w) ** 2 + (best.h - h) ** 2
    const distance = (size.w - w) ** 2 + (size.h - h) ** 2
    if (distance < bestDistance) return size
    if (distance === bestDistance && size.w * size.h < best.w * best.h) return size
    return best
  })
}

export function isAllowedSize(type: WidgetTypeId, w: number, h: number): boolean {
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1) return false
  const rule = widgetType(type).size
  if ("sizes" in rule) return rule.sizes.some((size) => size.w === w && size.h === h)
  if (w < rule.w.min || h < rule.h.min) return false
  if (rule.w.max !== "screen" && w > rule.w.max) return false
  if (rule.h.max !== "screen" && h > rule.h.max) return false
  return rule.accept?.(w, h) ?? true
}

function legalSizes(type: WidgetTypeId, screen: Screen, maxW = screen.columns): Size[] {
  const widthCap = Math.max(1, Math.min(maxW, screen.columns))
  const heightCap = Math.max(1, screen.rows)
  const rule = widgetType(type).size
  const sizes: Size[] = []
  if ("sizes" in rule) {
    for (const size of rule.sizes) {
      if (size.w >= 1 && size.h >= 1 && size.w <= widthCap && size.h <= heightCap)
        sizes.push(size)
    }
    return sizes
  }
  const maxWidth = spanLimit(rule.w.max, widthCap)
  const maxHeight = spanLimit(rule.h.max, heightCap)
  for (let w = rule.w.min; w <= maxWidth; w += 1) {
    for (let h = rule.h.min; h <= maxHeight; h += 1) {
      if (rule.accept?.(w, h) ?? true) sizes.push({ w, h })
    }
  }
  return sizes
}

/** False when even the smallest legal size is wider or taller than this screen. */
export function fitsOnScreen(type: WidgetTypeId, screen: Screen): boolean {
  return legalSizes(type, screen).length > 0
}

/** Sizes this type can take on this screen. maxW stops a resize at the row edge. */
export function fittingSizes(
  type: WidgetTypeId,
  screen: Screen,
  maxW = screen.columns,
): Size[] {
  return legalSizes(type, screen, maxW)
}

function smallest(sizes: Size[]): Size {
  return sizes.reduce((best, size) => {
    const area = size.w * size.h
    const bestArea = best.w * best.h
    if (area < bestArea || (area === bestArea && size.w < best.w)) return size
    return best
  })
}

export function defaultSize(type: WidgetTypeId, screen: Screen): Size {
  const fitting = fittingSizes(type, screen)
  if (fitting.length > 0) return smallest(fitting)
  return smallest(fittingSizes(type, { columns: 80, rows: 80 }))
}

export function canResize(type: WidgetTypeId, screen: Screen): boolean {
  return fittingSizes(type, screen).length > 1
}

export function resizeAxes(
  type: WidgetTypeId,
  screen: Screen,
  maxW: number,
): { width: boolean; height: boolean } {
  const sizes = fittingSizes(type, screen, maxW)
  const widths = new Set(sizes.map((size) => size.w))
  const heights = new Set(sizes.map((size) => size.h))
  return { width: widths.size > 1, height: heights.size > 1 }
}

export function resizeExtent(
  type: WidgetTypeId,
  screen: Screen,
  maxW: number,
): { maxW: number; maxH: number } | null {
  const sizes = fittingSizes(type, screen, maxW)
  if (sizes.length === 0) return null
  return {
    maxW: Math.max(...sizes.map((size) => size.w)),
    maxH: Math.max(...sizes.map((size) => size.h)),
  }
}

export function displaySize(
  type: WidgetTypeId,
  w: number,
  h: number,
  screen: Screen,
): Size {
  if (isAllowedSize(type, w, h) && w <= screen.columns && h <= screen.rows)
    return { w, h }
  const fitting = fittingSizes(type, screen)
  if (fitting.length > 0) return closest(fitting, w, h)
  return { w: Math.min(w, screen.columns), h: Math.min(h, screen.rows) }
}
