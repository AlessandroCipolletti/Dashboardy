export type GridMetrics = {
  padding: number
  gap: number
  columns: number
  cell: number
  radius: number
  width: number
}

// Target cell size is the tuning knob for how many even columns fit.
// Narrow screens stay near 168px so a phone is 2 columns and landscape is 4.
// Desktop stays near 100px so a 1920px window is about 16 columns.
export function computeGrid(viewportWidth: number): GridMetrics {
  const width = Math.max(280, Math.floor(viewportWidth))
  const padding = width < 768 ? 12 : 24
  const gap = 12
  const target = width < 900 ? 168 : width < 1200 ? 140 : 100
  const available = width - padding * 2
  let columns = Math.floor((available + gap) / (target + gap))
  if (columns < 2) columns = 2
  if (columns % 2 === 1) columns -= 1
  const cell = (available - gap * (columns - 1)) / columns
  const radius = Math.max(10, Math.round(cell * 0.14))
  return { padding, gap, columns, cell, radius, width }
}

function spanPixels(metrics: GridMetrics, span: number): number {
  if (span <= 0) return 0
  return span * metrics.cell + (span - 1) * metrics.gap
}

export function cellOrigin(
  metrics: GridMetrics,
  x: number,
  y: number,
): { left: number; top: number } {
  const stride = metrics.cell + metrics.gap
  return {
    left: metrics.padding + x * stride,
    top: metrics.padding + y * stride,
  }
}

export function cellRect(
  metrics: GridMetrics,
  x: number,
  y: number,
  w: number,
  h: number,
): { left: number; top: number; width: number; height: number } {
  const origin = cellOrigin(metrics, x, y)
  return {
    left: origin.left,
    top: origin.top,
    width: spanPixels(metrics, w),
    height: spanPixels(metrics, h),
  }
}

export function rowsInViewport(metrics: GridMetrics, viewportHeight: number): number {
  const stride = metrics.cell + metrics.gap
  return Math.max(1, Math.ceil(Math.max(0, viewportHeight) / stride))
}

const SHADOW_CLEARANCE = 24

export function canvasHeight(metrics: GridMetrics, rows: number): number {
  return metrics.padding * 2 + spanPixels(metrics, Math.max(rows, 1)) + SHADOW_CLEARANCE
}

export function pixelToCell(
  metrics: GridMetrics,
  localX: number,
  localY: number,
): { x: number; y: number; inside: boolean } {
  const stride = metrics.cell + metrics.gap
  const x = localX - metrics.padding
  const y = localY - metrics.padding
  if (x < 0 || y < 0) return { x: 0, y: 0, inside: false }
  const column = Math.floor(x / stride)
  const row = Math.floor(y / stride)
  const localColumn = x - column * stride
  const localRow = y - row * stride
  const inside =
    column >= 0 &&
    column < metrics.columns &&
    localColumn <= metrics.cell &&
    localRow <= metrics.cell
  return {
    x: Math.max(0, Math.min(column, metrics.columns - 1)),
    y: Math.max(0, row),
    inside,
  }
}
