import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../lib/api'
import LocationPicker from './LocationPicker'
import { AMENITIES, PROPERTY_TYPES, FURNISHED_STATUSES } from '../lib/amenities'

const BEDROOM_OPTIONS = [
  { value: '', label: 'Any' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4+' },
]

export default function SearchFilters({ filters, onChange, onClear }) {
  const [neighborhoods, setNeighborhoods] = useState([])

  useEffect(() => {
    if (!filters.ward_id) {
      setNeighborhoods([])
      return
    }
    fetch(`${API_BASE_URL}/api/locations/wards/${filters.ward_id}/neighborhoods`)
      .then((res) => res.json())
      .then((data) => setNeighborhoods(data))
      .catch(() => setNeighborhoods([]))
  }, [filters.ward_id])

  const handleLocationChange = (selection) => {
    onChange({
      state_id: selection.stateId,
      lga_id: selection.lgaId,
      ward_id: selection.wardId,
      neighborhood_id: null,
    })
  }

  const toggleAmenity = (amenity) => {
    const current = filters.amenities || []
    const next = current.includes(amenity)
      ? current.filter((a) => a !== amenity)
      : [...current, amenity]
    onChange({ amenities: next })
  }

  return (
    <div className="search-filters">
      <div className="filter-group">
        <span className="filter-label">Location</span>
        <LocationPicker
          onChange={handleLocationChange}
          initialValue={{
            stateId: filters.state_id,
            lgaId: filters.lga_id,
            wardId: filters.ward_id,
          }}
        />
      </div>

      <div className="filter-group">
        <label htmlFor="filter-neighborhood" className="filter-label">
          Neighborhood
        </label>
        <select
          id="filter-neighborhood"
          value={filters.neighborhood_id || ''}
          onChange={(e) => onChange({ neighborhood_id: e.target.value || null })}
          disabled={!filters.ward_id}
        >
          <option value="">Any</option>
          {neighborhoods.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="filter-type" className="filter-label">
          Property type
        </label>
        <select
          id="filter-type"
          value={filters.property_type || ''}
          onChange={(e) =>
            onChange({ property_type: e.target.value || null })
          }
        >
          <option value="">Any</option>
          {PROPERTY_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <span className="filter-label">Rent (₦)</span>
        <div className="filter-price-row">
          <input
            type="number"
            min="0"
            placeholder="Min rent"
            value={filters.min_price || ''}
            onChange={(e) => onChange({ min_price: e.target.value || null })}
          />
          <input
            type="number"
            min="0"
            placeholder="Max rent"
            value={filters.max_price || ''}
            onChange={(e) => onChange({ max_price: e.target.value || null })}
          />
        </div>
      </div>

      <div className="filter-group">
        <span className="filter-label">Bedrooms</span>
        <div className="filter-pill-row">
          {BEDROOM_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={
                'filter-pill' +
                ((filters.bedrooms || '') === option.value
                  ? ' filter-pill-active'
                  : '')
              }
              onClick={() => onChange({ bedrooms: option.value || null })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <label htmlFor="filter-furnished" className="filter-label">
          Furnished
        </label>
        <select
          id="filter-furnished"
          value={filters.furnished || ''}
          onChange={(e) => onChange({ furnished: e.target.value || null })}
        >
          <option value="">Any</option>
          {FURNISHED_STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <span className="filter-label">Amenities</span>
        <div className="filter-amenities-grid">
          {AMENITIES.map((amenity) => (
            <label key={amenity} className="amenity-checkbox">
              <input
                type="checkbox"
                checked={(filters.amenities || []).includes(amenity)}
                onChange={() => toggleAmenity(amenity)}
              />
              {amenity}
            </label>
          ))}
        </div>
      </div>

      <button type="button" className="btn-secondary" onClick={onClear}>
        Clear filters
      </button>
    </div>
  )
}
