import { isWidgetTypeId, type WidgetTypeId } from "../widgets/catalog"
import {
  isGallerySettings,
  type GallerySettings,
} from "../widgets/image-gallery/settings"
import { isVideoSettings, type VideoSettings } from "../widgets/video/settings"

export type Widget = {
  id: string
  type: WidgetTypeId
  w: number
  h: number
  x: number
  y: number
  settings?: GallerySettings | VideoSettings
}

export type DashboardDocument = {
  version: 1
  updatedAt: number
  widgets: Widget[]
}

export const demoRevision = 2

function demoWidget(
  id: string,
  type: WidgetTypeId,
  w: number,
  h: number,
  x: number,
  y: number,
): Widget {
  return { id, type, w, h, x, y }
}

// Authored on a 12-column grid. Narrower screens reflow a copy; this document
// stays put, so a wide screen shows these coordinates again.
export function seedDocument(): DashboardDocument {
  const widgets: Widget[] = [
    demoWidget("demo-compact-a", "compact", 2, 2, 0, 0),
    demoWidget("demo-compact-b", "compact", 1, 1, 2, 0),
    demoWidget("demo-compact-c", "compact", 1, 1, 3, 0),
    demoWidget("demo-horizontal-a", "horizontal", 2, 1, 4, 0),
    demoWidget("demo-square-a", "square", 2, 2, 6, 0),
    demoWidget("demo-horizontal-b", "horizontal", 4, 1, 8, 0),
    demoWidget("demo-compact-d", "compact", 2, 1, 2, 1),
    demoWidget("demo-free-a", "free", 1, 1, 4, 1),
    demoWidget("demo-band-a", "band", 4, 1, 8, 1),
    demoWidget("demo-wide-a", "wide", 4, 2, 0, 2),
    demoWidget("demo-vertical-a", "vertical", 1, 4, 4, 2),
    demoWidget("demo-square-b", "square", 3, 3, 5, 2),
    demoWidget("demo-free-b", "free", 3, 2, 8, 2),
    demoWidget("demo-compact-e", "compact", 1, 1, 11, 2),
    demoWidget("demo-compact-f", "compact", 1, 2, 11, 3),
    demoWidget("demo-block-a", "block", 3, 2, 0, 5),
    demoWidget("demo-horizontal-c", "horizontal", 3, 2, 5, 5),
    demoWidget("demo-compact-g", "compact", 2, 2, 8, 5),
    demoWidget("demo-vertical-b", "vertical", 1, 3, 10, 5),
    demoWidget("demo-square-c", "square", 1, 1, 11, 5),
    demoWidget("demo-compact-h", "compact", 1, 1, 3, 6),
    demoWidget("demo-free-c", "free", 1, 1, 4, 6),
    demoWidget("demo-panorama", "panorama", 8, 2, 0, 8),
    demoWidget("demo-tower-a", "tower", 2, 4, 8, 8),
    demoWidget("demo-band-b", "band", 2, 1, 10, 8),
    demoWidget("demo-banner", "banner", 10, 2, 0, 12),
    demoWidget("demo-compact-i", "compact", 2, 2, 10, 12),
    demoWidget("demo-poster", "poster", 6, 3, 0, 14),
    demoWidget("demo-wide-b", "wide", 4, 2, 6, 14),
    demoWidget("demo-free-d", "free", 2, 2, 10, 14),
    demoWidget("demo-square-d", "square", 2, 2, 6, 16),
    demoWidget("demo-horizontal-d", "horizontal", 4, 1, 8, 16),
    demoWidget("demo-tower-b", "tower", 1, 5, 0, 17),
    demoWidget("demo-block-b", "block", 3, 3, 1, 17),
    demoWidget("demo-compact-j", "compact", 2, 1, 4, 17),
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
      widget.w <= 80 &&
      widget.h <= 80 &&
      widget.x >= -1 &&
      widget.y >= -1 &&
      widget.x <= 400 &&
      widget.y <= 400 &&
      (widget.settings === undefined ||
        (widget.type === "image-gallery" && isGallerySettings(widget.settings)) ||
        (widget.type === "video" && isVideoSettings(widget.settings)))
    )
  })
}
