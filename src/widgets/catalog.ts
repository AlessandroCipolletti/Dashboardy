export const widgetTypeIds = [
  "compact",
  "wide",
  "free",
  "horizontal",
  "vertical",
  "square",
] as const

export type WidgetTypeId = (typeof widgetTypeIds)[number]

type Size = { w: number; h: number }

type WidgetType = {
  id: WidgetTypeId
  name: string
  gray: string
  sizes: Size[]
  sizeHint: string
}

function range(
  minW: number,
  maxW: number,
  minH: number,
  maxH: number,
  accept?: (w: number, h: number) => boolean,
): Size[] {
  const sizes: Size[] = []
  for (let w = minW; w <= maxW; w += 1) {
    for (let h = minH; h <= maxH; h += 1) {
      if (!accept || accept(w, h)) sizes.push({ w, h })
    }
  }
  return sizes
}

export const catalog: WidgetType[] = [
  {
    id: "compact",
    name: "Compatto",
    gray: "#f4f4f4",
    sizes: [
      { w: 1, h: 1 },
      { w: 2, h: 1 },
      { w: 1, h: 2 },
      { w: 2, h: 2 },
    ],
    sizeHint: "1×1 · 2×1 · 1×2 · 2×2",
  },
  {
    id: "wide",
    name: "Ampio",
    gray: "#c8c8c8",
    sizes: [
      { w: 4, h: 2 },
      { w: 4, h: 3 },
      { w: 6, h: 2 },
      { w: 6, h: 3 },
      { w: 6, h: 4 },
    ],
    sizeHint: "4×2 · 4×3 · 6×2 · 6×3 · 6×4",
  },
  {
    id: "free",
    name: "Libero",
    gray: "#dedede",
    sizes: range(1, 6, 1, 4),
    sizeHint: "da 1×1 a 6×4",
  },
  {
    id: "horizontal",
    name: "Orizzontale",
    gray: "#bdbdbd",
    sizes: range(2, 6, 1, 3, (w, h) => w > h),
    sizeHint: "solo in orizzontale",
  },
  {
    id: "vertical",
    name: "Verticale",
    gray: "#b0b0b0",
    sizes: range(1, 3, 2, 4, (w, h) => h > w),
    sizeHint: "solo in verticale",
  },
  {
    id: "square",
    name: "Quadrato",
    gray: "#d2d2d2",
    sizes: [
      { w: 1, h: 1 },
      { w: 2, h: 2 },
      { w: 3, h: 3 },
      { w: 4, h: 4 },
    ],
    sizeHint: "1×1 · 2×2 · 3×3 · 4×4",
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

function closest(sizes: Size[], w: number, h: number): Size {
  return sizes.reduce((best, size) => {
    const bestDistance = (best.w - w) ** 2 + (best.h - h) ** 2
    const distance = (size.w - w) ** 2 + (size.h - h) ** 2
    if (distance < bestDistance) return size
    if (distance === bestDistance && size.w * size.h < best.w * best.h) return size
    return best
  })
}

function nearestAllowed(type: WidgetTypeId, w: number, h: number, columns: number): Size {
  const sizes = widgetType(type).sizes
  const fitting = sizes.filter((size) => size.w <= columns)
  if (fitting.length === 0) {
    const smallest = closest(sizes, 1, 1)
    return { w: Math.min(smallest.w, Math.max(1, columns)), h: smallest.h }
  }
  return closest(fitting, w, h)
}

export function defaultSize(type: WidgetTypeId, columns: number): Size {
  const sizes = widgetType(type).sizes
  const fitting = sizes.filter((size) => size.w <= columns)
  const pool = fitting.length > 0 ? fitting : sizes
  return pool.reduce((best, size) => {
    const area = size.w * size.h
    const bestArea = best.w * best.h
    if (area < bestArea || (area === bestArea && size.w < best.w)) return size
    return best
  })
}

export function canResize(type: WidgetTypeId, columns: number): boolean {
  return widgetType(type).sizes.filter((size) => size.w <= columns).length > 1
}

export function isAllowedSize(type: WidgetTypeId, w: number, h: number): boolean {
  return widgetType(type).sizes.some((size) => size.w === w && size.h === h)
}

export function displaySize(
  type: WidgetTypeId,
  w: number,
  h: number,
  columns: number,
): Size {
  if (isAllowedSize(type, w, h) && w <= columns) return { w, h }
  return nearestAllowed(type, w, h, columns)
}
