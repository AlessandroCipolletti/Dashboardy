import { useEffect, useRef, useState } from "react"
import { createYouTubePlayer, loadYouTube, youtubeVideoId } from "./youtube"

const MOVE_CANCEL_PX = 10

function useClickToggle(toggle: () => void) {
  const origin = useRef<{ x: number; y: number } | null>(null)
  return {
    onPointerDown: (event: React.PointerEvent) => {
      origin.current = { x: event.clientX, y: event.clientY }
    },
    onClick: (event: React.MouseEvent) => {
      const start = origin.current
      if (!start) return
      const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y)
      if (distance > MOVE_CANCEL_PX) return
      toggle()
    },
  }
}

function PlayMark() {
  return (
    <span className="video-play" aria-hidden="true">
      <svg viewBox="0 0 16 16">
        <path d="M6 4.2 L12 8 L6 11.8 Z" />
      </svg>
    </span>
  )
}

function FileVideo({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playingUrl, setPlayingUrl] = useState<string | null>(null)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const playing = playingUrl === url
  const failed = failedUrl === url
  const toggle = () => {
    const video = videoRef.current
    if (!video || failed) return
    if (video.paused) void video.play().catch(() => undefined)
    else video.pause()
  }
  const pointer = useClickToggle(toggle)

  return (
    <div className="video-widget">
      {failed ? null : (
        <video
          key={url}
          ref={videoRef}
          src={url}
          playsInline
          preload="metadata"
          autoPlay={false}
          loop={false}
          controls={false}
          onPlay={() => setPlayingUrl(url)}
          onPause={() => setPlayingUrl(null)}
          onEnded={() => setPlayingUrl(null)}
          onError={() => setFailedUrl(url)}
        />
      )}
      {failed ? null : (
        <button
          type="button"
          className="video-hit"
          aria-label={playing ? "Pause" : "Play"}
          {...pointer}
        >
          {playing ? null : <PlayMark />}
        </button>
      )}
    </div>
  )
}

function YouTubeVideo({ videoId }: { videoId: string }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<ReturnType<typeof createYouTubePlayer> | null>(null)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  const toggle = () => {
    const player = playerRef.current
    if (!player || failed) return
    if (playing) player.pauseVideo()
    else player.playVideo()
  }
  const pointer = useClickToggle(toggle)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let cancelled = false
    let player: ReturnType<typeof createYouTubePlayer> | null = null
    const destroy = () => {
      playerRef.current = null
      player?.destroy()
      player = null
    }
    void loadYouTube()
      .then(() => {
        if (cancelled || !mountRef.current) return
        player = createYouTubePlayer(
          mountRef.current,
          videoId,
          setPlaying,
          () => setFailed(true),
          (ready) => {
            if (cancelled) {
              ready.destroy()
              return
            }
            playerRef.current = ready
          },
        )
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      destroy()
    }
  }, [videoId])

  return (
    <div className="video-widget">
      {failed ? null : (
        <div className="video-frame">
          <div ref={mountRef} />
        </div>
      )}
      {failed ? null : (
        <button
          type="button"
          className="video-hit"
          aria-label={playing ? "Pause" : "Play"}
          {...pointer}
        >
          {playing ? null : <PlayMark />}
        </button>
      )}
    </div>
  )
}

export function VideoWidget({ url }: { url: string }) {
  const videoId = youtubeVideoId(url)
  if (!url) return <div className="video-widget" />
  if (videoId) return <YouTubeVideo videoId={videoId} />
  return <FileVideo url={url} />
}
