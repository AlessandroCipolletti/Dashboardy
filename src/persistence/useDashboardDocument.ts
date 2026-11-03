import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { isDocument, seedDocument, type DashboardDocument } from "../model/document"

const CLIENT_KEY = "dashboardy.clientId"
const DOC_KEY = "dashboardy.document"

function clientId(): string {
  const existing = localStorage.getItem(CLIENT_KEY)
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing
  const id = crypto.randomUUID()
  localStorage.setItem(CLIENT_KEY, id)
  return id
}

function loadLocal(): DashboardDocument {
  try {
    const raw = localStorage.getItem(DOC_KEY)
    if (!raw) return seedDocument()
    const parsed: unknown = JSON.parse(raw)
    if (isDocument(parsed)) return parsed
  } catch {
    // The saved copy is unreadable. Start from the seed.
  }
  return seedDocument()
}

function saveLocal(document: DashboardDocument): void {
  localStorage.setItem(DOC_KEY, JSON.stringify(document))
}

function apiUrl(): string {
  return `${import.meta.env.BASE_URL}api/layout.php`
}

async function fetchRemote(id: string): Promise<DashboardDocument | null> {
  const response = await fetch(apiUrl(), { headers: { "X-Client-Id": id } })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Lettura layout non riuscita (${response.status})`)
  const body: unknown = await response.json()
  if (typeof body !== "object" || body === null || !("document" in body)) return null
  const document = (body as { document: unknown }).document
  return isDocument(document) ? document : null
}

async function putRemote(id: string, document: DashboardDocument): Promise<void> {
  const response = await fetch(apiUrl(), {
    method: "PUT",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
      "X-Client-Id": id,
    },
    body: JSON.stringify({ document }),
  })
  if (!response.ok)
    throw new Error(`Salvataggio layout non riuscito (${response.status})`)
}

export function useDashboardDocument() {
  const [document, setDocument] = useState<DashboardDocument>(loadLocal)
  const latest = useRef(document)
  const id = useRef(clientId())
  useLayoutEffect(() => {
    latest.current = document
  }, [document])
  const timer = useRef<number | null>(null)

  const schedulePut = useCallback((next: DashboardDocument) => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      void putRemote(id.current, next).catch((error: unknown) => {
        console.warn("Layout API non disponibile, tengo la copia locale.", error)
      })
    }, 300)
  }, [])

  const commit = useCallback(
    (recipe: (current: DashboardDocument) => DashboardDocument) => {
      setDocument((current) => {
        const next: DashboardDocument = {
          ...recipe(current),
          version: 1,
          updatedAt: Date.now(),
        }
        latest.current = next
        saveLocal(next)
        schedulePut(next)
        return next
      })
    },
    [schedulePut],
  )

  useEffect(() => {
    let cancelled = false
    saveLocal(latest.current)
    void (async () => {
      try {
        const remote = await fetchRemote(id.current)
        if (cancelled) return
        const local = latest.current
        if (!remote || local.updatedAt >= remote.updatedAt) {
          await putRemote(id.current, local)
          return
        }
        latest.current = remote
        saveLocal(remote)
        setDocument(remote)
      } catch (error: unknown) {
        console.warn("Layout API non disponibile, tengo la copia locale.", error)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const flush = () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current)
        timer.current = null
      }
      void putRemote(id.current, latest.current).catch(() => undefined)
    }
    window.addEventListener("pagehide", flush)
    return () => window.removeEventListener("pagehide", flush)
  }, [])

  return { document, commit }
}
