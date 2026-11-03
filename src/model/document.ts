import { isWidgetTypeId, type WidgetTypeId } from "../widgets/catalog"

export type Widget = {
  id: string
  type: WidgetTypeId
  w: number
  h: number
  x: number
  y: number
}

export type DashboardDocument = {
  version: 1
  updatedAt: number
  widgets: Widget[]
}

export function seedDocument(): DashboardDocument {
  const widgets: Widget[] = [
    { id: crypto.randomUUID(), type: "compact", w: 2, h: 2, x: -1, y: -1 },
    { id: crypto.randomUUID(), type: "horizontal", w: 4, h: 1, x: -1, y: -1 },
    { id: crypto.randomUUID(), type: "square", w: 2, h: 2, x: -1, y: -1 },
    { id: crypto.randomUUID(), type: "vertical", w: 1, h: 3, x: -1, y: -1 },
    { id: crypto.randomUUID(), type: "wide", w: 4, h: 2, x: -1, y: -1 },
    { id: crypto.randomUUID(), type: "free", w: 3, h: 2, x: -1, y: -1 },
  ]
  return { version: 1, updatedAt: Date.now(), widgets }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function isDocument(value: unknown): value is DashboardDocument {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.widgets))
    return false
  if (typeof value.updatedAt !== "number") return false
  return value.widgets.every((widget: unknown) => {
    if (!isRecord(widget)) return false
    return (
      typeof widget.id === "string" &&
      widget.id.length > 0 &&
      widget.id.length <= 64 &&
      typeof widget.type === "string" &&
      isWidgetTypeId(widget.type) &&
      typeof widget.w === "number" &&
      typeof widget.h === "number" &&
      typeof widget.x === "number" &&
      typeof widget.y === "number" &&
      Number.isInteger(widget.w) &&
      Number.isInteger(widget.h) &&
      Number.isInteger(widget.x) &&
      Number.isInteger(widget.y) &&
      widget.w >= 1 &&
      widget.h >= 1 &&
      widget.w <= 12 &&
      widget.h <= 12 &&
      widget.x >= -1 &&
      widget.y >= -1 &&
      widget.x <= 400 &&
      widget.y <= 400
    )
  })
}
