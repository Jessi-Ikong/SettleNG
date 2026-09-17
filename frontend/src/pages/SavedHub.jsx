import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { API_BASE_URL } from '../lib/api'

export default function SavedHub() {
  const { loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [favoritesCount, setFavoritesCount] = useState(0)
  const [savedSearchesCount, setSavedSearchesCount] = useState(0)

  useEffect(() => {
    if (authLoading) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      Promise.all([
        fetch(`${API_BASE_URL}/api/favorites`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).then((res) => (res.ok ? res.json() : Promise.reject())),
        fetch(`${API_BASE_URL}/api/saved-searches`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).then((res) => (res.ok ? res.json() : Promise.reject())),
      ])
        .then(([favoritesData, savedSearchesData]) => {
          setFavoritesCount((favoritesData.items || []).length)
          setSavedSearchesCount(
            Array.isArray(savedSearchesData) ? savedSearchesData.length : 0,
          )
        })
        .catch(() => setLoadError(true))
        .finally(() => setLoading(false))
    })
  }, [authLoading])

  if (authLoading || loading) {
    return <div className="page-loading">Loading...</div>
  }

  return (
    <div className="property-list-page">
      <h1>Saved</h1>

      {loadError && (
        <div className="form-error">
          Something went wrong loading this page — try again.
        </div>
      )}

      <div className="hub-cards-grid">
        <Link to="/saved-properties" className="hub-card">
          <span className="hub-card-title">Saved Properties</span>
          <span className="hub-card-context">
            {favoritesCount} {favoritesCount === 1 ? 'property' : 'properties'}
          </span>
        </Link>
        <Link to="/saved-searches" className="hub-card">
          <span className="hub-card-title">Saved Searches</span>
          <span className="hub-card-context">
            {savedSearchesCount}{' '}
            {savedSearchesCount === 1 ? 'search' : 'searches'}
          </span>
        </Link>
      </div>
    </div>
  )
}
