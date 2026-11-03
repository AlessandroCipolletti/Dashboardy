const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

type YouTubePlayer = {
  playVideo: () => void
  pauseVideo: () => void
  destroy: () => void
  getPlayerState: () => number
}

type YouTubePlayerOptions = {
  videoId: string
  host?: string
  width?: string
  height?: string
  playerVars?: Record<string, number | string>
  events?: {
    onReady?: (event: { target: YouTubePlayer }) => void
    onStateChange?: (event: { data: number }) => void
    onError?: () => void
  }
}

type YouTubeNamespace = {
  Player: new (element: HTMLElement, options: YouTubePlayerOptions) => YouTubePlayer
}

type YouTubeWindow = Window & {
  YT?: YouTubeNamespace
  onYouTubeIframeAPIReady?: () => void
}

let loading: Promise<void> | null = null

export function youtubeVideoId(value: string): string | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^(www|m)\./, "")
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? ""
    return VIDEO_ID.test(id) ? id : null
  }
  if (
    host !== "youtube.com" &&
    host !== "youtube-nocookie.com" &&
    host !== "music.youtube.com"
  ) {
    return null
  }
  if (url.pathname === "/watch") {
    const id = url.searchParams.get("v") ?? ""
    return VIDEO_ID.test(id) ? id : null
  }
  const [kind, id = ""] = url.pathname.split("/").filter(Boolean)
  if (kind === "embed" || kind === "shorts" || kind === "live" || kind === "v") {
    return VIDEO_ID.test(id) ? id : null
  }
  return null
}

export function loadYouTube(): Promise<void> {
  const current = window as YouTubeWindow
  if (current.YT?.Player) return Promise.resolve()
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const previous = current.onYouTubeIframeAPIReady
    current.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve()
    }
    const script = document.createElement("script")
    script.src = "https://www.youtube.com/iframe_api"
    script.onerror = () => {
      loading = null
      reject(new Error("YouTube API failed"))
    }
    document.head.appendChild(script)
  })
  return loading
}

export function createYouTubePlayer(
  element: HTMLElement,
  videoId: string,
  onState: (playing: boolean) => void,
  onError: () => void,
  onReady: (player: YouTubePlayer) => void,
): YouTubePlayer {
  const youtube = (window as YouTubeWindow).YT
  if (!youtube) throw new Error("YouTube API missing")
  return new youtube.Player(element, {
    videoId,
    host: "https://www.youtube-nocookie.com",
    width: "100%",
    height: "100%",
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      modestbranding: 1,
      playsinline: 1,
      rel: 0,
      origin: window.location.origin,
    },
    events: {
      onReady: (event) => onReady(event.target),
      onStateChange: (event) => onState(event.data === 1),
      onError,
    },
  })
}
