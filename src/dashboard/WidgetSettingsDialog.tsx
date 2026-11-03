import { useEffect, useRef, type ReactNode } from "react"

export function WidgetSettingsDialog({
  title,
  children,
  onSave,
  onClose,
}: {
  title: string
  children: ReactNode
  onSave: () => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    dialogRef.current?.focus()
  }, [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="settings-layer"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="widget-settings-title"
        tabIndex={-1}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="settings-header">
          <p>Widget</p>
          <h2 id="widget-settings-title">{title}</h2>
        </header>
        <div className="settings-body">{children}</div>
        <footer className="settings-footer">
          <button type="button" className="settings-save" onClick={onSave}>
            Save
          </button>
        </footer>
      </div>
    </div>
  )
}
