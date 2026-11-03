import { useLayoutEffect, useRef, useState } from "react"
import { catalog } from "../widgets/catalog"
import type { WidgetTypeId } from "../widgets/catalog"

type AddMenuProps = {
  left: number
  top: number
  onSelect: (type: WidgetTypeId) => void
}

export function AddMenu({ left, top, onSelect }: AddMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const openedAt = useRef(0)
  const [position, setPosition] = useState({ left, top })

  useLayoutEffect(() => {
    openedAt.current = performance.now()
    const menu = ref.current
    if (!menu) return
    const rect = menu.getBoundingClientRect()
    let nextLeft = left
    let nextTop = top
    if (rect.right > window.innerWidth - 8) {
      nextLeft = Math.max(8, window.innerWidth - rect.width - 8)
    }
    if (rect.bottom > window.innerHeight - 8) {
      nextTop = Math.max(8, top - rect.height - 12)
    }
    setPosition({ left: nextLeft, top: nextTop })
  }, [left, top])

  return (
    <div
      ref={ref}
      className="add-menu"
      role="menu"
      aria-label="Add widget"
      style={{ left: position.left, top: position.top }}
    >
      {catalog.map((type) => (
        <button
          key={type.id}
          type="button"
          role="menuitem"
          onClick={() => {
            if (performance.now() - openedAt.current < 280) return
            onSelect(type.id)
          }}
        >
          <span className="swatch" style={{ background: type.gray }} />
          <span>
            <strong>{type.name}</strong>
            <small>{type.sizeHint}</small>
          </span>
        </button>
      ))}
    </div>
  )
}
