import { useEffect } from 'react'

// Sets the browser tab title and meta description for the current
// page. Only affects the live DOM after React runs — fine for a real
// visitor's browser tab, but NOT what a non-JS link-preview crawler
// sees (see backend/src/routes/share.js for that case, which needs
// real server-rendered HTML instead).
export default function useDocumentMeta(title, description) {
  useEffect(() => {
    const previousTitle = document.title
    document.title = title

    let meta = document.querySelector('meta[name="description"]')
    const previousDescription = meta?.getAttribute('content') ?? null

    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', description)

    return () => {
      document.title = previousTitle
      if (previousDescription === null) {
        meta.remove()
      } else {
        meta.setAttribute('content', previousDescription)
      }
    }
  }, [title, description])
}
