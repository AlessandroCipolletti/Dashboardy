export type GridItem = {
  id: string
  w: number
  h: number
}

export type Placement = {
  x: number
  y: number
  w: number
  h: number
}

export function pack(
  items: GridItem[],
  columns: number,
  reserved?: Placement & { id: string },
): Map<string, Placement> {
  const occupied = new Set<string>()
  const placements = new Map<string, Placement>()
  const key = (x: number, y: number) => `${x},${y}`

  const mark = (x: number, y: number, w: number, h: number) => {
    for (let row = 0; row < h; row += 1) {
      for (let column = 0; column < w; column += 1) occupied.add(key(x + column, y + row))
    }
  }

  const fits = (x: number, y: number, w: number, h: number) => {
    if (x < 0 || y < 0 || x + w > columns) return false
    for (let row = 0; row < h; row += 1) {
      for (let column = 0; column < w; column += 1) {
        if (occupied.has(key(x + column, y + row))) return false
      }
    }
    return true
  }

  const place = (id: string, x: number, y: number, w: number, h: number) => {
    placements.set(id, { x, y, w, h })
    mark(x, y, w, h)
  }

  if (reserved) {
    const w = Math.max(1, Math.min(reserved.w, columns))
    const h = Math.max(1, reserved.h)
    const x = Math.max(0, Math.min(reserved.x, Math.max(0, columns - w)))
    const y = Math.max(0, reserved.y)
    place(reserved.id, x, y, w, h)
  }

  for (const item of items) {
    if (reserved && item.id === reserved.id) continue
    const w = Math.max(1, Math.min(item.w, columns))
    const h = Math.max(1, item.h)
    let placed = false
    for (let y = 0; y < 400 && !placed; y += 1) {
      for (let x = 0; x <= columns - w; x += 1) {
        if (!fits(x, y, w, h)) continue
        place(item.id, x, y, w, h)
        placed = true
        break
      }
    }
    if (!placed) place(item.id, 0, 400, w, h)
  }

  return placements
}

export function covers(placement: Placement, x: number, y: number): boolean {
  return (
    x >= placement.x &&
    x < placement.x + placement.w &&
    y >= placement.y &&
    y < placement.y + placement.h
  )
}
