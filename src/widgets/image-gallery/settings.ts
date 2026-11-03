export const GALLERY_DURATIONS = [5, 10, 20, 30, 45, 60] as const

export type GalleryDuration = (typeof GALLERY_DURATIONS)[number]

export type GallerySettings = {
  urls: string[]
  index: number
  slideshow: boolean
  duration: GalleryDuration
}

export const GALLERY_URL_MAX = 2048

export function defaultGallerySettings(): GallerySettings {
  return { urls: [], index: 0, slideshow: false, duration: 5 }
}

function isGalleryDuration(value: unknown): value is GalleryDuration {
  return (
    typeof value === "number" && (GALLERY_DURATIONS as readonly number[]).includes(value)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function isGallerySettings(value: unknown): value is GallerySettings {
  if (!isRecord(value) || !Array.isArray(value.urls)) return false
  const urls = value.urls
  if (
    !urls.every(
      (url) =>
        typeof url === "string" &&
        url.length > 0 &&
        url.length <= GALLERY_URL_MAX &&
        url.trim() === url,
    )
  ) {
    return false
  }
  if (
    typeof value.index !== "number" ||
    !Number.isInteger(value.index) ||
    value.index < 0
  )
    return false
  if (urls.length === 0 ? value.index !== 0 : value.index >= urls.length) return false
  if (typeof value.slideshow !== "boolean" || !isGalleryDuration(value.duration))
    return false
  return true
}

export function gallerySettings(value: unknown): GallerySettings {
  if (!isRecord(value)) return defaultGallerySettings()
  const urls: string[] = []
  if (Array.isArray(value.urls)) {
    for (const url of value.urls) {
      if (typeof url !== "string") continue
      const trimmed = url.trim()
      if (!trimmed || trimmed.length > GALLERY_URL_MAX) continue
      urls.push(trimmed)
    }
  }
  let index =
    typeof value.index === "number" && Number.isInteger(value.index) ? value.index : 0
  if (urls.length === 0) index = 0
  else index = Math.min(Math.max(0, index), urls.length - 1)
  return {
    urls,
    index,
    slideshow: value.slideshow === true,
    duration: isGalleryDuration(value.duration) ? value.duration : 5,
  }
}
