export type GridMetrics = {
  padding: number
  gap: number
  columns: number
  cell: number
  radius: number
  width: number
}

// Even column counts for the CSS widths of current phones and iPads.
// iPhone Pro Max is 440×956: 4 portrait, 8 landscape.
// iPad mini is 744×1133: 6 portrait, 8 landscape.
// A 9.7" iPad is 768 wide in portrait, so it steps up to 8.
// Wider tablets and desktops keep that proportion, about 16 columns at 1920.
function columnsForWidth(width: number): number {
  if (width < 360) return 2
  if (width < 600) return 4
  if (width < 768) return 6
  if (width < 1280) return 8
  if (width < 1500) return 10
  if (width < 1700) return 12
  if (width < 1900) return 14
  if (width < 2200) return 16
  if (width < 2500) return 18
  return 22
}

export function computeGrid(viewportWidth: number): GridMetrics {
  const width = Math.max(280, Math.floor(viewportWidth))
  const padding = width < 768 ? 12 : 24
  const gap = 12
  const columns = columnsForWidth(width)
  const available = width - padding * 2
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

// Largest row span whose boxes fit in the viewport. One gap is not counted
// after the last row, so this is the tallest a widget is allowed to be.
export function rowsOnScreen(metrics: GridMetrics, viewportHeight: number): number {
  const stride = metrics.cell + metrics.gap
  const height = Math.max(0, viewportHeight)
  if (height < metrics.cell) return 1
  return Math.max(1, Math.floor((height + metrics.gap) / stride))
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
