import type { GridMetrics } from "../grid/metrics"
import { rowsOnScreen } from "../grid/metrics"

export const widgetTypeIds = [
  "image-gallery",
  "video",
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
  preferred?: Size
}

function span(min: number, max: SpanEnd): Span {
  return { min, max }
}

export const catalog: WidgetType[] = [
  {
    id: "image-gallery",
    name: "Image gallery",
    gray: "#d0d0d0",
    size: { w: span(2, "screen"), h: span(2, "screen") },
    sizeHint: "From 2×2 up to the screen",
    preferred: { w: 4, h: 3 },
  },
  {
    id: "video",
    name: "Video",
    gray: "#c4c4c4",
    size: { w: span(2, "screen"), h: span(2, "screen") },
    sizeHint: "From 2×2 up to the screen",
    preferred: { w: 4, h: 3 },
  },
  {
    id: "compact",
    name: "Compact",
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
    name: "Wide",
    gray: "#c8c8c8",
    size: { w: span(3, "screen"), h: span(2, 5) },
    sizeHint: "Width from 3 to the full row · height 2–5",
  },
  {
    id: "free",
    name: "Free",
    gray: "#dedede",
    size: { w: span(1, "screen"), h: span(1, "screen") },
    sizeHint: "From 1×1 up to the screen",
  },
  {
    id: "horizontal",
    name: "Horizontal",
    gray: "#bdbdbd",
    size: { w: span(2, "screen"), h: span(1, 3), accept: (w, h) => w > h },
    sizeHint: "Wider than tall, up to the full row",
  },
  {
    id: "vertical",
    name: "Vertical",
    gray: "#b0b0b0",
    size: { w: span(1, 3), h: span(2, "screen"), accept: (w, h) => h > w },
    sizeHint: "Taller than wide, up to the screen",
  },
  {
    id: "square",
    name: "Square",
    gray: "#d2d2d2",
    size: { w: span(1, "screen"), h: span(1, "screen"), accept: (w, h) => w === h },
    sizeHint: "Squares from 1 up to the screen",
  },
  {
    id: "band",
    name: "Band",
    gray: "#e4e4e4",
    size: { w: span(2, "screen"), h: span(1, 1) },
    sizeHint: "1 row tall · width from 2 to the full row",
  },
  {
    id: "block",
    name: "Block",
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
    name: "Tower",
    gray: "#9e9e9e",
    size: { w: span(1, 2), h: span(4, "screen"), accept: (w, h) => h > w },
    sizeHint: "Width 1–2 · height from 4 to the screen",
  },
  {
    id: "poster",
    name: "Poster",
    gray: "#8a8a8a",
    size: {
      sizes: [
        { w: 6, h: 3 },
        { w: 6, h: 4 },
      ],
    },
    sizeHint: "Only 6×3 · 6×4",
  },
  {
    id: "panorama",
    name: "Panorama",
    gray: "#7a7a7a",
    size: { w: span(8, "screen"), h: span(2, 4) },
    sizeHint: "Width from 8 to the full row · height 2–4",
  },
  {
    id: "banner",
    name: "Banner",
    gray: "#6a6a6a",
    size: { w: span(10, "screen"), h: span(2, 3) },
    sizeHint: "Width from 10 to the full row · height 2–3",
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

function preferredSize(type: WidgetTypeId, sizes: Size[]): Size | null {
  const preferred = widgetType(type).preferred
  if (!preferred || sizes.length === 0) return null
  if (sizes.some((size) => size.w === preferred.w && size.h === preferred.h))
    return preferred
  return closest(sizes, preferred.w, preferred.h)
}

export function defaultSize(type: WidgetTypeId, screen: Screen): Size {
  const fitting = fittingSizes(type, screen)
  return (
    preferredSize(type, fitting) ??
    (fitting.length > 0 ? smallest(fitting) : null) ??
    preferredSize(type, fittingSizes(type, { columns: 80, rows: 80 })) ??
    smallest(fittingSizes(type, { columns: 80, rows: 80 }))
  )
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
