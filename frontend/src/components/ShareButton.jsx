import { useState } from 'react'
import { API_BASE_URL } from '../lib/api'

// Points at the backend's server-rendered /share/properties/:id shell
// (real Open Graph tags baked into a plain HTML response), not the
// frontend's own React route — a link shared on WhatsApp/Twitter/etc.
// needs a URL a non-JS crawler can read tags from directly. A real
// visitor who opens the link still lands on this same page briefly and
// is then forwarded into the actual SPA property page automatically.
export default function ShareButton({ propertyId }) {
  const [copied, setCopied] = useState(false)

  const shareUrl = `${API_BASE_URL}/share/properties/${propertyId}`

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link to share:', shareUrl)
    }
  }

  return (
    <button
      type="button"
      className="share-button"
      onClick={handleClick}
      aria-label="Copy shareable link to this property"
    >
      {copied ? 'Link copied!' : 'Share'}
    </button>
  )
}
