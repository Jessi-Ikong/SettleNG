import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { API_BASE_URL } from '../lib/api'
import LocationPicker from '../components/LocationPicker'
import {
  AMENITIES,
  PROPERTY_TYPES,
  FURNISHED_STATUSES,
  PRICING_FIELDS,
} from '../lib/amenities'

export default function CreateProperty() {
  const navigate = useNavigate()
  const { profile, loading } = useAuth()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [propertyType, setPropertyType] = useState('')
  const [bedrooms, setBedrooms] = useState('')
  const [bathrooms, setBathrooms] = useState('')
  const [toilets, setToilets] = useState('')
  const [furnished, setFurnished] = useState('')
  const [amenities, setAmenities] = useState([])
  const [location, setLocation] = useState({
    stateId: null,
    lgaId: null,
    wardId: null,
  })
  const [neighborhoods, setNeighborhoods] = useState([])
  const [neighborhoodName, setNeighborhoodName] = useState('')
  const [street, setStreet] = useState('')
  const [prices, setPrices] = useState({
    rent_amount: '',
    agency_fee: '',
    agreement_fee: '',
    caution_fee: '',
    service_charge: '',
    other_fee: '',
  })
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!location.wardId) {
      setNeighborhoods([])
      return
    }
    fetch(`${API_BASE_URL}/api/locations/wards/${location.wardId}/neighborhoods`)
      .then((res) => res.json())
      .then((data) => setNeighborhoods(data))
      .catch(() => setNeighborhoods([]))
  }, [location.wardId])

  if (loading) {
    return <div className="page-loading">Loading...</div>
  }

  if (!profile || !['landlord', 'agent'].includes(profile.role)) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Not available</h1>
          <p>Only landlords and agents can list a property.</p>
        </div>
      </div>
    )
  }

  const toggleAmenity = (amenity) => {
    setAmenities((prev) =>
      prev.includes(amenity)
        ? prev.filter((a) => a !== amenity)
        : [...prev, amenity],
    )
  }

  const handleFileChange = (event) => {
    const selected = Array.from(event.target.files || [])
    setFiles(selected)
    setPreviews(selected.map((file) => URL.createObjectURL(file)))
  }

  const handlePriceChange = (key, value) => {
    setPrices((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!location.wardId) {
      setError('Please select a state, LGA, and ward.')
      return
    }
    if (!neighborhoodName.trim()) {
      setError('Please enter or select a neighborhood.')
      return
    }

    setSubmitting(true)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const payload = {
      title,
      description,
      property_type: propertyType,
      bedrooms: bedrooms || null,
      bathrooms: bathrooms || null,
      toilets: toilets || null,
      furnished: furnished || null,
      amenities,
      ward_id: location.wardId,
      neighborhood_name: neighborhoodName,
      street,
      ...Object.fromEntries(
        PRICING_FIELDS.map(({ key }) => [key, prices[key] || null]),
      ),
    }

    const createRes = await fetch(`${API_BASE_URL}/api/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    })

    const created = await createRes.json()

    if (!createRes.ok) {
      setSubmitting(false)
      setError(created.error || 'Failed to create property')
      return
    }

    if (files.length > 0) {
      const formData = new FormData()
      for (const file of files) {
        formData.append('images', file)
      }

      const imagesRes = await fetch(
        `${API_BASE_URL}/api/properties/${created.id}/images`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        },
      )

      if (!imagesRes.ok) {
        const imagesError = await imagesRes.json()
        setSubmitting(false)
        setError(
          `Property created, but image upload failed: ${imagesError.error}`,
        )
        return
      }
    }

    navigate(`/properties/${created.id}`)
  }

  return (
    <div className="create-property-page">
      <div className="create-property-card">
        <h1>List a property</h1>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="title">Title</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div className="form-field">
            <label htmlFor="propertyType">Property type</label>
            <select
              id="propertyType"
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              required
            >
              <option value="">Select a type</option>
              {PROPERTY_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="bedrooms">Bedrooms</label>
              <input
                id="bedrooms"
                type="number"
                min="0"
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="bathrooms">Bathrooms</label>
              <input
                id="bathrooms"
                type="number"
                min="0"
                value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="toilets">Toilets</label>
              <input
                id="toilets"
                type="number"
                min="0"
                value={toilets}
                onChange={(e) => setToilets(e.target.value)}
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="furnished">Furnished</label>
            <select
              id="furnished"
              value={furnished}
              onChange={(e) => setFurnished(e.target.value)}
            >
              <option value="">Not specified</option>
              {FURNISHED_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <span>Amenities</span>
            <div className="amenities-grid">
              {AMENITIES.map((amenity) => (
                <label key={amenity} className="amenity-checkbox">
                  <input
                    type="checkbox"
                    checked={amenities.includes(amenity)}
                    onChange={() => toggleAmenity(amenity)}
                  />
                  {amenity}
                </label>
              ))}
            </div>
          </div>

          <div className="form-field">
            <span>Location</span>
            <LocationPicker onChange={setLocation} />
          </div>

          <div className="form-field">
            <label htmlFor="neighborhood">Neighborhood</label>
            <input
              id="neighborhood"
              type="text"
              list="neighborhood-options"
              value={neighborhoodName}
              onChange={(e) => setNeighborhoodName(e.target.value)}
              placeholder={
                location.wardId
                  ? 'Type to search or add a new neighborhood'
                  : 'Select a ward first'
              }
              disabled={!location.wardId}
            />
            <datalist id="neighborhood-options">
              {neighborhoods.map((n) => (
                <option key={n.id} value={n.name} />
              ))}
            </datalist>
          </div>

          <div className="form-field">
            <label htmlFor="street">Street</label>
            <input
              id="street"
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
            />
          </div>

          <div className="form-field">
            <span>Pricing (leave blank if unsure — never guess)</span>
            <div className="pricing-grid">
              {PRICING_FIELDS.map(({ key, label }) => (
                <div key={key} className="form-field">
                  <label htmlFor={key}>{label}</label>
                  <input
                    id={key}
                    type="number"
                    min="0"
                    placeholder="Leave blank"
                    value={prices[key]}
                    onChange={(e) => handlePriceChange(key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="images">Photos</label>
            <input
              id="images"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
            />
            {previews.length > 0 && (
              <div className="image-preview-grid">
                {previews.map((src, i) => (
                  <img key={i} src={src} alt="" className="image-preview" />
                ))}
              </div>
            )}
          </div>

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create listing'}
          </button>
        </form>
      </div>
    </div>
  )
}
