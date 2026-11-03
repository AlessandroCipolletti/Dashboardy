import { useRef, useState } from "react"
import {
  gallerySettings,
  type GalleryDuration,
  type GallerySettings,
  GALLERY_DURATIONS,
  GALLERY_URL_MAX,
} from "./settings"

function reorder(rows: string[], from: number, to: number): string[] {
  const next = rows.slice()
  const [row] = next.splice(from, 1)
  next.splice(to, 0, row ?? "")
  return next
}

export function GallerySettingsForm({
  initial,
  onChange,
}: {
  initial: GallerySettings
  onChange: (next: GallerySettings) => void
}) {
  const [rows, setRows] = useState(() => [...initial.urls, ""])
  const [slideshow, setSlideshow] = useState(initial.slideshow)
  const [duration, setDuration] = useState<GalleryDuration>(initial.duration)
  const rowsRef = useRef(rows)
  const optionsRef = useRef({
    slideshow: initial.slideshow,
    duration: initial.duration,
    index: initial.index,
  })
  const listRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; index: number; lastY: number } | null>(null)
  const [lifted, setLifted] = useState<number | null>(null)

  const publish = (
    nextRows: string[],
    nextSlideshow = optionsRef.current.slideshow,
    nextDuration = optionsRef.current.duration,
  ) => {
    rowsRef.current = nextRows
    setRows(nextRows)
    onChange(
      gallerySettings({
        urls: nextRows,
        index: optionsRef.current.index,
        slideshow: nextSlideshow,
        duration: nextDuration,
      }),
    )
  }

  const onGripMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    const list = listRef.current
    if (!drag || drag.pointerId !== event.pointerId || !list) return
    const filled = rowsRef.current.length - 1
    const dy = event.clientY - drag.lastY
    drag.lastY = event.clientY
    const neighbor =
      dy > 4 && drag.index < filled - 1
        ? drag.index + 1
        : dy < -4 && drag.index > 0
          ? drag.index - 1
          : null
    if (neighbor === null) return
    const item = list.querySelector<HTMLElement>(`[data-url-index="${neighbor}"]`)
    if (!item) return
    const rect = item.getBoundingClientRect()
    const midpoint = rect.top + rect.height / 2
    if (neighbor > drag.index ? event.clientY < midpoint : event.clientY > midpoint)
      return
    const next = reorder(rowsRef.current, drag.index, neighbor)
    drag.index = neighbor
    setLifted(neighbor)
    publish(next)
  }

  const endDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    setLifted(null)
  }

  return (
    <div className="gallery-settings">
      <section className="settings-section">
        <header>
          <h3>Images</h3>
          <p>Each address is one card. Drag a handle to change the order.</p>
        </header>
        <div className="url-list" ref={listRef}>
          {rows.map((row, index) => {
            const filled = index < rows.length - 1 && row.trim().length > 0
            return (
              <div
                className={lifted === index ? "url-row is-lifted" : "url-row"}
                data-url-index={index}
                key={index}
              >
                {filled ? (
                  <button
                    type="button"
                    className="url-grip"
                    aria-label={`Reorder image ${index + 1}`}
                    onPointerDown={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      event.currentTarget.setPointerCapture(event.pointerId)
                      dragRef.current = {
                        pointerId: event.pointerId,
                        index,
                        lastY: event.clientY,
                      }
                      setLifted(index)
                    }}
                    onPointerMove={onGripMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                  >
                    <svg viewBox="0 0 12 16" aria-hidden="true">
                      <circle cx="3.5" cy="3" r="1.15" />
                      <circle cx="8.5" cy="3" r="1.15" />
                      <circle cx="3.5" cy="8" r="1.15" />
                      <circle cx="8.5" cy="8" r="1.15" />
                      <circle cx="3.5" cy="13" r="1.15" />
                      <circle cx="8.5" cy="13" r="1.15" />
                    </svg>
                  </button>
                ) : (
                  <span className="url-grip is-spacer" aria-hidden="true" />
                )}
                <input
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  placeholder="Paste an image address"
                  aria-label={`Image URL ${index + 1}`}
                  value={row}
                  onChange={(event) => {
                    const text = event.target.value.slice(0, GALLERY_URL_MAX)
                    const next = rowsRef.current.slice()
                    next[index] = text
                    if (index === next.length - 1 && text.trim() !== "") next.push("")
                    publish(next)
                  }}
                  onBlur={() => {
                    const current = rowsRef.current
                    if (index >= current.length - 1 || current[index]?.trim()) return
                    publish(current.filter((_, item) => item !== index))
                  }}
                />
              </div>
            )
          })}
        </div>
      </section>
      <section className="settings-section">
        <header>
          <h3>Playback</h3>
          <p>Leave this off to keep one image until you change it.</p>
        </header>
        <div className="settings-card">
          <div className="settings-toggle">
            <span id="slideshow-label">Automatic slideshow</span>
            <button
              type="button"
              className={slideshow ? "switch is-on" : "switch"}
              role="switch"
              aria-checked={slideshow}
              aria-labelledby="slideshow-label"
              onClick={() => {
                const next = !slideshow
                setSlideshow(next)
                optionsRef.current = { ...optionsRef.current, slideshow: next }
                publish(rowsRef.current, next, duration)
              }}
            >
              <span />
            </button>
          </div>
          {slideshow ? (
            <div className="duration-block">
              <p>Each image stays</p>
              <div className="duration-options" role="radiogroup" aria-label="Duration">
                {GALLERY_DURATIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={duration === option}
                    className={duration === option ? "is-selected" : ""}
                    onClick={() => {
                      setDuration(option)
                      optionsRef.current = { ...optionsRef.current, duration: option }
                      publish(rowsRef.current, slideshow, option)
                    }}
                  >
                    {option} seconds
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
