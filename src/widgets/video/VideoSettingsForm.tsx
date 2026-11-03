import { useState } from "react"
import { VIDEO_URL_MAX } from "./settings"

export function VideoSettingsForm({
  initial,
  onChange,
}: {
  initial: string
  onChange: (url: string) => void
}) {
  const [url, setUrl] = useState(initial)

  return (
    <section className="settings-section">
      <header>
        <h3>Video</h3>
        <p>
          One address, including YouTube. It fills the widget and plays only when you
          click it.
        </p>
      </header>
      <div className="url-row">
        <input
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="Paste a video or YouTube address"
          aria-label="Video URL"
          value={url}
          onChange={(event) => {
            const next = event.target.value.slice(0, VIDEO_URL_MAX)
            setUrl(next)
            onChange(next.trim())
          }}
        />
      </div>
    </section>
  )
}
