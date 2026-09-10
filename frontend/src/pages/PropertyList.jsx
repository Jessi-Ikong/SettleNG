import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'

function formatNaira(amount) {
  return `₦${Number(amount).toLocaleString('en-NG')}`
}

export default function PropertyList() {
  const [page, setPage] = useState(1)
  const [result, setResult] = useState({ items: [], totalPages: 1 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE_URL}/api/properties?page=${page}`)
      .then((res) => res.json())
      .then((data) => setResult(data))
      .finally(() => setLoading(false))
  }, [page])

  return (
    <div className="property-list-page">
      <h1>Browse properties</h1>

      {loading ? (
        <div className="page-loading">Loading...</div>
      ) : result.items.length === 0 ? (
        <p>No properties available yet.</p>
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

      <div className="pagination">
        <button
          type="button"
          className="btn-secondary"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
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
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}
