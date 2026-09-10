import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'
import SearchFilters from '../components/SearchFilters'

function formatNaira(amount) {
  return `₦${Number(amount).toLocaleString('en-NG')}`
}

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
  const [searchParams, setSearchParams] = useSearchParams()
  const [result, setResult] = useState({ items: [], total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const filters = paramsToFilters(searchParams)
  const sort = searchParams.get('sort') || 'newest'
  const page = parseInt(searchParams.get('page'), 10) || 1

  useEffect(() => {
    setLoading(true)
    const query = new URLSearchParams()
    for (const key of FILTER_KEYS) {
      const value = searchParams.get(key)
      if (value) query.set(key, value)
    }
    query.set('sort', sort)
    query.set('page', String(page))

    fetch(`${API_BASE_URL}/api/properties?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => setResult(data))
      .finally(() => setLoading(false))
  }, [searchParams])

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

  const hasActiveFilters = FILTER_KEYS.some((key) => searchParams.get(key))

  return (
    <div className="property-list-page">
      <div className="property-list-header">
        <h1>Browse properties</h1>
        <button
          type="button"
          className="btn-secondary filters-toggle"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          {filtersOpen ? 'Hide filters' : 'Show filters'}
        </button>
      </div>

      <div className="property-list-layout">
        <aside className={filtersOpen ? 'filters-sidebar filters-open' : 'filters-sidebar'}>
          <SearchFilters
            filters={filters}
            onChange={updateParams}
            onClear={handleClearFilters}
          />
        </aside>

        <div className="property-list-main">
          <div className="property-list-toolbar">
            <span className="result-count">
              {loading
                ? 'Loading...'
                : `${result.total} propert${result.total === 1 ? 'y' : 'ies'} found`}
            </span>
            <label className="sort-select">
              Sort by{' '}
              <select
                value={sort}
                onChange={(e) =>
                  updateParams({ sort: e.target.value }, { resetPage: true })
                }
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <div className="page-loading">Loading...</div>
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
                <Link
                  key={property.id}
                  to={`/properties/${property.id}`}
                  className="property-card"
                >
                  {property.first_image ? (
                    <img
                      src={property.first_image}
                      alt={property.title}
                      className="property-card-image"
                    />
                  ) : (
                    <div className="property-card-image property-card-image-empty">
                      No photo
                    </div>
                  )}
                  <div className="property-card-body">
                    <span className="badge-available">{property.status}</span>
                    <h3>{property.title}</h3>
                    <p className="property-card-location">
                      {property.neighborhood.name}, {property.ward.lga.name},{' '}
                      {property.ward.lga.state.name}
                    </p>
                    <p className="property-card-cost">
                      {property.move_in_cost.total != null
                        ? formatNaira(property.move_in_cost.total)
                        : 'Move-in cost not provided'}
                    </p>
                  </div>
                </Link>
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
    </div>
  )
}
