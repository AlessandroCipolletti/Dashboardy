import { useEffect, useRef, useState } from "react"
import type { GalleryDuration } from "./settings"

type Direction = -1 | 0 | 1

type Pane = {
  offset: number
  animate: boolean
  dir: Direction
  settle: "commit" | "back" | null
}

const idlePane: Pane = { offset: 0, animate: false, dir: 0, settle: null }
const DOT_WINDOW = 7

function wrap(index: number, count: number): number {
  if (count <= 0) return 0
  return ((index % count) + count) % count
}

function dotIndexes(count: number, index: number): number[] {
  if (count <= DOT_WINDOW) return Array.from({ length: count }, (_, item) => item)
  const half = Math.floor(DOT_WINDOW / 2)
  let start = index - half
  if (start < 0) start = 0
  if (start > count - DOT_WINDOW) start = count - DOT_WINDOW
  return Array.from({ length: DOT_WINDOW }, (_, item) => start + item)
}

function useGalleryImages(urls: string[], index: number) {
  const [ready, setReady] = useState(() => new Set<string>())
  const [failed, setFailed] = useState(() => new Set<string>())
  const readyRef = useRef(ready)
  const failedRef = useRef(failed)
  const urlKey = JSON.stringify(urls)
  const current = urls[index]
  const settled = !current || ready.has(current) || failed.has(current)

  useEffect(() => {
    readyRef.current = ready
    failedRef.current = failed
  })

  const remember = (url: string, ok: boolean) => {
    const update = ok ? setReady : setFailed
    update((items) => {
      if (items.has(url)) return items
      const next = new Set(items)
      next.add(url)
      return next
    })
  }

  useEffect(() => {
    if (!settled) return
    const list = JSON.parse(urlKey) as string[]
    if (list.length < 2) return
    let cancelled = false
    const order: number[] = []
    const seen = new Set<number>()
    const push = (item: number) => {
      const next = wrap(item, list.length)
      if (seen.has(next) || next === index) return
      seen.add(next)
      order.push(next)
    }
    for (let step = 1; step < list.length; step += 1) {
      push(index + step)
      push(index - step)
    }
    const loadAt = (position: number) => {
      if (cancelled || position >= order.length) return
      const url = list[order[position]]
      if (!url || readyRef.current.has(url) || failedRef.current.has(url)) {
        loadAt(position + 1)
        return
      }
      let done = false
      const finish = (ok: boolean) => {
        if (done || cancelled) return
        done = true
        remember(url, ok)
        loadAt(position + 1)
      }
      const image = new Image()
      image.decoding = "async"
      image.onload = () => finish(image.naturalWidth > 0)
      image.onerror = () => finish(false)
      if ("fetchPriority" in image) image.fetchPriority = "low"
      image.src = url
      if (image.complete) finish(image.naturalWidth > 0)
    }
    loadAt(0)
    return () => {
      cancelled = true
    }
  }, [urlKey, index, settled])

  return { ready, failed, remember }
}

export function ImageGallery({
  id,
  urls,
  index,
  slideshow,
  duration,
  paused,
  onIndex,
}: {
  id: string
  urls: string[]
  index: number
  slideshow: boolean
  duration: GalleryDuration
  paused: boolean
  onIndex: (index: number) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [pane, setPane] = useState<Pane>(idlePane)
  const paneRef = useRef(pane)
  const indexRef = useRef(index)
  const urlsRef = useRef(urls)
  const onIndexRef = useRef(onIndex)
  const moving = useRef(false)
  const [following, setFollowing] = useState(false)
  const followTimer = useRef<number | null>(null)
  const settleTimer = useRef<number | null>(null)
  const finishRef = useRef<() => void>(() => {})
  const { ready, failed, remember } = useGalleryImages(urls, index)

  useEffect(() => {
    paneRef.current = pane
    indexRef.current = index
    urlsRef.current = urls
    onIndexRef.current = onIndex
  })

  const shift = (dir: Exclude<Direction, 0>) => {
    if (urlsRef.current.length < 2 || moving.current) return
    moving.current = true
    setPane({ offset: 0, animate: false, dir, settle: "commit" })
    requestAnimationFrame(() => {
      setPane({ offset: 0, animate: true, dir, settle: "commit" })
      requestAnimationFrame(() => {
        setPane({ offset: -dir, animate: true, dir, settle: "commit" })
      })
    })
    expectSettle()
  }
  const shiftRef = useRef(shift)
  const expectSettle = () => {
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(() => {
      settleTimer.current = null
      finishRef.current()
    }, 640)
  }
  useEffect(() => {
    shiftRef.current = shift
  })

  useEffect(() => {
    if (!slideshow || paused || urls.length < 2) return
    let timer = 0
    const tick = () => {
      if (moving.current) {
        timer = window.setTimeout(tick, 300)
        return
      }
      shiftRef.current(1)
    }
    timer = window.setTimeout(tick, duration * 1000)
    return () => window.clearTimeout(timer)
  }, [slideshow, paused, urls.length, index, duration])

  useEffect(() => {
    const node = rootRef.current
    if (!node) return
    const poke = () => {
      setFollowing(true)
      if (followTimer.current !== null) window.clearTimeout(followTimer.current)
      followTimer.current = window.setTimeout(() => {
        followTimer.current = null
        setFollowing(false)
      }, 1000)
    }
    const onSwipe = (event: Event) => {
      if (urlsRef.current.length < 2) return
      const detail = (event as CustomEvent<{ phase: "move" | "end"; dx: number }>).detail
      if (!detail) return
      const width = node.clientWidth || 1
      const ratio = Math.max(-1, Math.min(1, detail.dx / width))
      if (detail.phase === "move") {
        moving.current = true
        const dir: Direction = ratio < 0 ? 1 : ratio > 0 ? -1 : 0
        setPane({ offset: ratio, animate: false, dir, settle: null })
        poke()
        return
      }
      poke()
      if (Math.abs(ratio) <= 0.01) {
        moving.current = false
        setPane(idlePane)
        return
      }
      if (Math.abs(ratio) > 0.2) {
        const dir: Exclude<Direction, 0> = ratio < 0 ? 1 : -1
        setPane({ offset: ratio, animate: true, dir, settle: "commit" })
        requestAnimationFrame(() => {
          setPane({ offset: -dir, animate: true, dir, settle: "commit" })
        })
        expectSettle()
        return
      }
      setPane((current) => ({ ...current, animate: true, settle: "back" }))
      requestAnimationFrame(() => {
        setPane((current) => ({ ...current, offset: 0, animate: true, settle: "back" }))
      })
      expectSettle()
    }
    node.addEventListener("gallery-swipe", onSwipe)
    return () => {
      node.removeEventListener("gallery-swipe", onSwipe)
      if (followTimer.current !== null) window.clearTimeout(followTimer.current)
    }
  }, [])

  const finish = () => {
    if (settleTimer.current !== null) {
      window.clearTimeout(settleTimer.current)
      settleTimer.current = null
    }
    const current = paneRef.current
    if (!current.settle) return
    paneRef.current = idlePane
    const commit = current.settle === "commit" && current.dir !== 0
    const next = wrap(indexRef.current + current.dir, urlsRef.current.length)
    moving.current = false
    setPane(idlePane)
    if (commit) onIndexRef.current(next)
  }
  useEffect(() => {
    finishRef.current = finish
  })

  const count = urls.length
  const currentUrl = urls[index]
  const neighbor = pane.dir === 0 ? undefined : urls[wrap(index + pane.dir, count)]
  const dotsOn = following || pane.dir !== 0

  return (
    <div ref={rootRef} className="gallery" data-gallery={id} data-slides={count}>
      <div
        className={pane.animate ? "gallery-stage" : "gallery-stage is-instant"}
        style={{ transform: `translateX(${pane.offset * 100}%)` }}
        onTransitionEnd={(event) => {
          if (event.propertyName !== "transform" || event.target !== event.currentTarget)
            return
          finish()
        }}
      >
        {currentUrl && !failed.has(currentUrl) ? (
          <img
            className={ready.has(currentUrl) ? "gallery-image is-ready" : "gallery-image"}
            src={currentUrl}
            alt=""
            draggable={false}
            onLoad={() => remember(currentUrl, true)}
            onError={() => remember(currentUrl, false)}
          />
        ) : null}
        {neighbor && !failed.has(neighbor) ? (
          <img
            className={ready.has(neighbor) ? "gallery-image is-ready" : "gallery-image"}
            src={neighbor}
            alt=""
            draggable={false}
            style={{ transform: `translateX(${pane.dir * 100}%)` }}
            onLoad={() => remember(neighbor, true)}
            onError={() => remember(neighbor, false)}
          />
        ) : null}
      </div>
      {count > 1 ? (
        <>
          <button
            type="button"
            className="gallery-arrow is-prev"
            data-gallery-nav="prev"
            aria-label="Previous image"
            onClick={() => shift(-1)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10 3.5 L5.5 8 L10 12.5" />
            </svg>
          </button>
          <button
            type="button"
            className="gallery-arrow is-next"
            data-gallery-nav="next"
            aria-label="Next image"
            onClick={() => shift(1)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 3.5 L10.5 8 L6 12.5" />
            </svg>
          </button>
          <div className={dotsOn ? "gallery-dots is-on" : "gallery-dots"}>
            {dotIndexes(count, index).map((item) => (
              <span key={item} className={item === index ? "is-current" : ""} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
