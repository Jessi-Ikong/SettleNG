import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { fetchFavoritedIds } from '../lib/favoritesApi'
import FilterPillBar from '../components/FilterPillBar'
import PropertyCard from '../components/PropertyCard'
import useDocumentMeta from '../hooks/useDocumentMeta'

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
]

const FILTER_KEYS = [
  'state_id',
  'lga_id',
  'ward_id',
  'neighborhood_id',
  'property_type',
  'min_price',
  'max_price',
  'bedrooms',
  'furnished',
  'amenities',
]

function paramsToFilters(searchParams) {
  const filters = {}
  for (const key of FILTER_KEYS) {
    const value = searchParams.get(key)
    if (!value) continue
    filters[key] = key === 'amenities' ? value.split(',').filter(Boolean) : value
  }
  return filters
}

export default function PropertyList() {
  useDocumentMeta(
    'Browse rentals — SettleNG',
    'Filter verified Nigerian rentals by location, price, bedrooms, and amenities to find your next home.',
  )

  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [result, setResult] = useState({ items: [], total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [favoritedIds, setFavoritedIds] = useState(new Set())
  const [showSaveSearch, setShowSaveSearch] = useState(false)
  const [saveSearchName, setSaveSearchName] = useState('')
  const [savingSearch, setSavingSearch] = useState(false)
  const [saveSearchMessage, setSaveSearchMessage] = useState('')

  const filters = paramsToFilters(searchParams)
  const sort = searchParams.get('sort') || 'newest'
  const page = parseInt(searchParams.get('page'), 10) || 1

  useEffect(() => {
    setLoading(true)
    setLoadError(false)
    const query = new URLSearchParams()
    for (const key of FILTER_KEYS) {
      const value = searchParams.get(key)
      if (value) query.set(key, value)
    }
    query.set('sort', sort)
    query.set('page', String(page))

    fetch(`${API_BASE_URL}/api/properties?${query.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          setLoadError(true)
          return
        }
        setResult(await res.json())
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }, [searchParams])

  useEffect(() => {
    if (!user) {
      setFavoritedIds(new Set())
      return
    }
    fetchFavoritedIds().then(setFavoritedIds)
  }, [user])

  const updateParams = (partial, { resetPage = true } = {}) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(partial)) {
      const isEmpty =
        value === null ||
        value === undefined ||
        value === '' ||
        (Array.isArray(value) && value.length === 0)
      if (isEmpty) {
        next.delete(key)
      } else if (Array.isArray(value)) {
        next.set(key, value.join(','))
      } else {
        next.set(key, String(value))
      }
    }
    if (resetPage) next.delete('page')
    setSearchParams(next)
  }

  const handleClearFilters = () => {
    const next = new URLSearchParams()
    if (sort !== 'newest') next.set('sort', sort)
    setSearchParams(next)
  }

  const handleSaveSearch = async () => {
    if (!saveSearchName.trim()) return
    setSavingSearch(true)
    setSaveSearchMessage('')

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const filtersToSave = Object.fromEntries(searchParams.entries())

    const res = await fetch(`${API_BASE_URL}/api/saved-searches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ name: saveSearchName.trim(), filters: filtersToSave }),
    })

    setSavingSearch(false)

    if (!res.ok) {
      setSaveSearchMessage('Failed to save search')
      return
    }

    setSaveSearchName('')
    setShowSaveSearch(false)
    setSaveSearchMessage('Search saved')
    setTimeout(() => setSaveSearchMessage(''), 3000)
  }

  const hasActiveFilters = FILTER_KEYS.some((key) => searchParams.get(key))

  return (
    <>
      <FilterPillBar
        filters={filters}
        sort={sort}
        sortOptions={SORT_OPTIONS}
        onChange={updateParams}
        onSortChange={(value) => updateParams({ sort: value }, { resetPage: true })}
      />

      <div className="property-list-page">
        <div className="property-list-header">
          <h1>Browse properties</h1>
        </div>

        <div className="property-list-main">
          <div className="property-list-toolbar">
            <span className="result-count">
              {loading
                ? 'Loading...'
                : `${result.total} propert${result.total === 1 ? 'y' : 'ies'} found`}
            </span>

            {user && (
              <div className="save-search">
                {showSaveSearch ? (
                  <>
                    <input
                      type="text"
                      placeholder="Search name"
                      value={saveSearchName}
                      onChange={(e) => setSaveSearchName(e.target.value)}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleSaveSearch}
                      disabled={savingSearch}
                    >
                      {savingSearch ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowSaveSearch(false)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowSaveSearch(true)}
                  >
                    Save this search
                  </button>
                )}
                {saveSearchMessage && (
                  <span className="save-search-message">{saveSearchMessage}</span>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div className="page-loading">Loading...</div>
          ) : loadError ? (
            <div className="form-error">
              Something went wrong loading this page — try again.
            </div>
          ) : result.items.length === 0 ? (
            <div className="empty-state">
              <p>No properties match your filters.</p>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleClearFilters}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="property-card-grid">
              {result.items.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  favorited={favoritedIds.has(property.id)}
                />
              ))}
            </div>
          )}

          {result.items.length > 0 && (
            <div className="pagination">
              <button
                type="button"
                className="btn-secondary"
                disabled={page <= 1}
                onClick={() => updateParams({ page: page - 1 }, { resetPage: false })}
              >
                Previous
              </button>
              <span>
                Page {page} of {result.totalPages || 1}
              </span>
              <button
                type="button"
                className="btn-secondary"
                disabled={page >= result.totalPages}
                onClick={() => updateParams({ page: page + 1 }, { resetPage: false })}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
