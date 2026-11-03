export const VIDEO_URL_MAX = 2048

export type VideoSettings = {
  url: string
}

export function defaultVideoSettings(): VideoSettings {
  return { url: "" }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function isVideoSettings(value: unknown): value is VideoSettings {
  return (
    isRecord(value) &&
    typeof value.url === "string" &&
    value.url.length <= VIDEO_URL_MAX &&
    value.url.trim() === value.url
  )
}

export function videoSettings(value: unknown): VideoSettings {
  if (!isRecord(value) || typeof value.url !== "string") return defaultVideoSettings()
  const url = value.url.trim()
  if (url.length > VIDEO_URL_MAX) return defaultVideoSettings()
  return { url }
}
