import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { API_BASE_URL } from '../lib/api'

export default function FavoriteButton({
  propertyId,
  initialFavorited = false,
  onToggle,
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [favorited, setFavorited] = useState(initialFavorited)
  const [busy, setBusy] = useState(false)

  const handleClick = async (event) => {
    event.preventDefault()
    event.stopPropagation()

    if (!user) {
      navigate('/login')
      return
    }

    const next = !favorited
    setFavorited(next)
    setBusy(true)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/favorites${next ? '' : `/${propertyId}`}`,
        {
          method: next ? 'POST' : 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: next ? JSON.stringify({ property_id: propertyId }) : undefined,
        },
      )

      if (!res.ok) throw new Error('Request failed')
      onToggle?.(next)
    } catch {
      setFavorited(!next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={
        'favorite-button' + (favorited ? ' favorite-button-active' : '')
      }
      onClick={handleClick}
      disabled={busy}
      aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={favorited}
    >
      <svg viewBox="0 0 24 24" className="favorite-heart" aria-hidden="true">
        <path d="M12 21s-6.72-4.35-9.33-8.14C.9 10.2 1.42 6.6 4.3 5.1c2.2-1.14 4.6-.4 5.9 1.4L12 8.4l1.8-1.9c1.3-1.8 3.7-2.54 5.9-1.4 2.88 1.5 3.4 5.1 1.6 7.76C18.72 16.65 12 21 12 21z" />
      </svg>
    </button>
  )
}
