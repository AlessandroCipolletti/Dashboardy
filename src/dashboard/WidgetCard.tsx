import type { CSSProperties, ReactNode } from "react"

type Corner = "bl" | "br"

type WidgetCardProps = {
  id: string
  name: string
  gray: string
  label: string
  lifting: boolean
  resizing: boolean
  showHandles: boolean
  selected: boolean
  resizeLocked: boolean
  axes: { bl: ResizeAxes; br: ResizeAxes }
  edgeLimit?: { left: boolean; right: boolean; bottom: boolean }
  leaving?: boolean
  hasSettings?: boolean
  children?: ReactNode
  style: CSSProperties
}

type ResizeAxes = { width: boolean; height: boolean }

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

function edgeShadow(
  edge: { left: boolean; right: boolean; bottom: boolean } | undefined,
) {
  if (!edge || (!edge.left && !edge.right && !edge.bottom)) return undefined
  const layers = [
    "0 1px 2px rgb(0 0 0 / 18%)",
    "0 8px 16px rgb(0 0 0 / 12%)",
    "0 18px 28px rgb(0 0 0 / 10%)",
  ]
  if (edge.right) {
    layers.unshift(
      "5px 0 0 rgb(0 0 0 / 14%)",
      "12px 0 16px rgb(0 0 0 / 10%)",
      "22px 0 28px rgb(0 0 0 / 6%)",
    )
  }
  if (edge.left) {
    layers.unshift(
      "-5px 0 0 rgb(0 0 0 / 14%)",
      "-12px 0 16px rgb(0 0 0 / 10%)",
      "-22px 0 28px rgb(0 0 0 / 6%)",
    )
  }
  if (edge.bottom) {
    layers.unshift(
      "0 5px 0 rgb(0 0 0 / 14%)",
      "0 12px 16px rgb(0 0 0 / 10%)",
      "0 22px 28px rgb(0 0 0 / 6%)",
    )
  }
  return layers.join(", ")
}

function ResizeHandle({
  name,
  corner,
  locked,
  width,
  height,
}: {
  name: string
  corner: Corner
  locked: boolean
  width: boolean
  height: boolean
}) {
  if (locked || !width || !height) return null
  const side = corner === "bl" ? "left" : "right"
  return (
    <button
      type="button"
      className={["handle", `handle-${corner}`].join(" ")}
      data-corner={corner}
      aria-label={`Resize ${name} from the bottom-${side} corner`}
    >
      <HandleIcon corner={corner} />
    </button>
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
  selected,
  resizeLocked,
  axes,
  edgeLimit,
  leaving,
  hasSettings,
  children,
  style,
}: WidgetCardProps) {
  const className = [
    "widget",
    lifting ? "is-dragging" : "",
    resizing ? "is-resizing" : "",
    showHandles ? "is-chrome" : "",
    selected ? "is-selected" : "",
    leaving ? "is-leaving" : "",
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <article
      className={className}
      data-widget-id={id}
      data-type={name}
      inert={leaving || undefined}
      aria-hidden={leaving || undefined}
      style={{ ...style, boxShadow: edgeShadow(edgeLimit) }}
    >
      <div
        className={children ? "belly is-custom" : "belly"}
        style={{ background: gray }}
      >
        {children ?? (
          <>
            <span className="name">{name}</span>
            <span className="meta">{label}</span>
          </>
        )}
      </div>
      {hasSettings ? (
        <button
          type="button"
          className="settings"
          data-settings={id}
          aria-label={`Settings for ${name}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.49.49 0 0 0 .12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.01-1.58z" />
            <circle cx="12" cy="12" r="3.1" />
          </svg>
        </button>
      ) : null}
      <button
        type="button"
        className="delete"
        data-delete={id}
        aria-label={`Delete ${name}`}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 4 L12 12 M12 4 L4 12" />
        </svg>
      </button>
      <ResizeHandle
        name={name}
        corner="bl"
        locked={resizeLocked || (!axes.bl.width && !axes.bl.height)}
        width={axes.bl.width}
        height={axes.bl.height}
      />
      <ResizeHandle
        name={name}
        corner="br"
        locked={resizeLocked || (!axes.br.width && !axes.br.height)}
        width={axes.br.width}
        height={axes.br.height}
      />
    </article>
  )
}
