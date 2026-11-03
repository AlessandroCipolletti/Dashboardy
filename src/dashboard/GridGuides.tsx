import { cellOrigin } from "../grid/metrics"
import type { GridMetrics } from "../grid/metrics"

type GridGuidesProps = {
  metrics: GridMetrics
  rows: number
  scrollY: number
  viewportHeight: number
  active: boolean
  plusCell: { x: number; y: number } | null
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5 V19 M5 12 H19" />
    </svg>
  )
}

export function GridGuides({
  metrics,
  rows,
  scrollY,
  viewportHeight,
  active,
  plusCell,
}: GridGuidesProps) {
  const stride = metrics.cell + metrics.gap
  let first = Math.max(0, Math.floor((scrollY - metrics.padding) / stride) - 1)
  let last = Math.min(
    rows - 1,
    Math.ceil((scrollY + viewportHeight - metrics.padding) / stride) + 1,
  )
  if (plusCell) {
    first = Math.min(first, plusCell.y)
    last = Math.max(last, Math.min(rows - 1, plusCell.y))
  }
  const cells = []

  for (let y = first; y <= last; y += 1) {
    for (let x = 0; x < metrics.columns; x += 1) {
      const plus = plusCell?.x === x && plusCell?.y === y
      const origin = cellOrigin(metrics, x, y)
      const style = {
        left: origin.left,
        top: origin.top,
        width: metrics.cell,
        height: metrics.cell,
        borderRadius: metrics.radius,
      }
      cells.push(
        plus ? (
          <button
            key={`${x}:${y}`}
            type="button"
            className="guide is-plus"
            data-plus={`${x},${y}`}
            aria-label="Add widget"
            style={style}
          >
            <PlusIcon />
          </button>
        ) : (
          <div key={`${x}:${y}`} className="guide" aria-hidden="true" style={style} />
        ),
      )
    }
  }

  return <div className={active ? "guides guides-on" : "guides"}>{cells}</div>
}
