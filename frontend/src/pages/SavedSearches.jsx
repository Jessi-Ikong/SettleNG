import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabaseClient'

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function filtersToSearch(filters) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters || {})) {
    if (value !== null && value !== undefined && value !== '') {
      params.set(key, value)
    }
  }
  return params.toString()
}

export default function SavedSearches() {
  const [searches, setSearches] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const load = () => {
    setLoading(true)
    setLoadError(false)
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch(`${API_BASE_URL}/api/saved-searches`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(async (res) => {
          if (!res.ok) {
            setLoadError(true)
            return
          }
          setSearches(await res.json())
        })
        .catch(() => setLoadError(true))
        .finally(() => setLoading(false))
    })
  }

  useEffect(() => {
    load()
  }, [])

  const handleDelete = async (id) => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    await fetch(`${API_BASE_URL}/api/saved-searches/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })

    setSearches((prev) => prev.filter((s) => s.id !== id))
  }

  if (loading) {
    return <div className="page-loading">Loading...</div>
  }

  return (
    <div className="property-list-page">
      <h1>Saved searches</h1>

      {loadError ? (
        <div className="form-error">
          Something went wrong loading this page — try again.
        </div>
      ) : searches.length === 0 ? (
        <div className="empty-state">
          <p>You haven't saved any searches yet.</p>
          <Link to="/properties" className="btn-secondary">
            Browse properties
          </Link>
        </div>
      ) : (
        <ul className="saved-search-list">
          {searches.map((search) => (
            <li key={search.id} className="saved-search-item">
              <Link
                to={`/properties?${filtersToSearch(search.filters)}`}
                className="saved-search-link"
              >
                <span className="saved-search-name">{search.name}</span>
                <span className="saved-search-date">
                  Saved {formatDate(search.created_at)}
                </span>
              </Link>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleDelete(search.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
