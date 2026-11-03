import type { CSSProperties } from "react"

type Corner = "bl" | "br"

type WidgetCardProps = {
  id: string
  name: string
  gray: string
  label: string
  lifting: boolean
  resizing: boolean
  showHandles: boolean
  resizeLocked: boolean
  style: CSSProperties
}

function HandleIcon({ corner }: { corner: Corner }) {
  const path =
    corner === "br"
      ? "M46 22 V36 A12 12 0 0 1 34 48 H20"
      : "M6 22 V36 A12 12 0 0 0 18 48 H32"
  return (
    <svg viewBox="0 0 52 52" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

export function WidgetCard({
  id,
  name,
  gray,
  label,
  lifting,
  resizing,
  showHandles,
  resizeLocked,
  style,
}: WidgetCardProps) {
  const className = [
    "widget",
    lifting ? "is-dragging" : "",
    resizing ? "is-resizing" : "",
    showHandles ? "is-chrome" : "",
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <article className={className} data-widget-id={id} data-type={name} style={style}>
      <div className="belly" style={{ background: gray }}>
        <span className="name">{name}</span>
        <span className="meta">{label}</span>
      </div>
      <button
        type="button"
        className="delete"
        data-delete={id}
        aria-label={`Elimina ${name}`}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 4 L12 12 M12 4 L4 12" />
        </svg>
      </button>
      <button
        type="button"
        className={resizeLocked ? "handle handle-bl is-locked" : "handle handle-bl"}
        data-corner="bl"
        data-locked={resizeLocked ? "true" : undefined}
        aria-label={
          resizeLocked
            ? `${name} ha una sola dimensione`
            : `Ridimensiona ${name} dall'angolo in basso a sinistra`
        }
      >
        <HandleIcon corner="bl" />
      </button>
      <button
        type="button"
        className={resizeLocked ? "handle handle-br is-locked" : "handle handle-br"}
        data-corner="br"
        data-locked={resizeLocked ? "true" : undefined}
        aria-label={
          resizeLocked
            ? `${name} ha una sola dimensione`
            : `Ridimensiona ${name} dall'angolo in basso a destra`
        }
      >
        <HandleIcon corner="br" />
      </button>
    </article>
  )
}
