import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
  const { id: editPropertyId } = useParams()
  const [searchParams] = useSearchParams()
  const isEditing = Boolean(editPropertyId)
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

  const [partOfBuilding, setPartOfBuilding] = useState(false)
  const [buildings, setBuildings] = useState([])
  const [selectedBuildingId, setSelectedBuildingId] = useState('')
  const [unitLabel, setUnitLabel] = useState('')
  const [newBuildingName, setNewBuildingName] = useState('')
  const [newBuildingLocation, setNewBuildingLocation] = useState({
    stateId: null,
    lgaId: null,
    wardId: null,
  })
  const [newBuildingNeighborhoods, setNewBuildingNeighborhoods] = useState([])
  const [newBuildingNeighborhoodName, setNewBuildingNeighborhoodName] =
    useState('')
  const [newBuildingStreet, setNewBuildingStreet] = useState('')
  const [newBuildingTotalUnits, setNewBuildingTotalUnits] = useState('')

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingExisting, setLoadingExisting] = useState(isEditing)
  const [notOwner, setNotOwner] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!isEditing || !profile) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch(`${API_BASE_URL}/api/properties/${editPropertyId}`, {
        headers: session
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      })
        .then(async (res) => {
          if (!res.ok) {
            setNotOwner(true)
            return
          }
          const property = await res.json()

          if (property.owner_id !== profile.id) {
            setNotOwner(true)
            return
          }

          setTitle(property.title || '')
          setDescription(property.description || '')
          setPropertyType(property.property_type || '')
          setBedrooms(property.bedrooms ?? '')
          setBathrooms(property.bathrooms ?? '')
          setToilets(property.toilets ?? '')
          setFurnished(property.furnished || '')
          setAmenities(property.amenities || [])
          setLocation({
            stateId: String(property.ward.lga.state.id),
            lgaId: String(property.ward.lga.id),
            wardId: String(property.ward.id),
          })
          setNeighborhoodName(property.neighborhood.name || '')
          setStreet(property.street || '')
          setPrices({
            rent_amount: property.rent_amount ?? '',
            agency_fee: property.agency_fee ?? '',
            agreement_fee: property.agreement_fee ?? '',
            caution_fee: property.caution_fee ?? '',
            service_charge: property.service_charge ?? '',
            other_fee: property.other_fee ?? '',
          })
        })
        .catch(() => setNotOwner(true))
        .finally(() => setLoadingExisting(false))
    })
  }, [isEditing, editPropertyId, profile])

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

  // Fetch the landlord/agent's own buildings up front (not lazily on
  // toggle) so a "?building_id=..." deep link from My Buildings'
  // "Add a unit" link can preselect the right one as soon as the list
  // arrives, without a race between the fetch and the query param.
  useEffect(() => {
    if (isEditing || loading) return
    if (!profile || !['landlord', 'agent'].includes(profile.role)) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch(`${API_BASE_URL}/api/buildings?mine=true`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((res) => res.json())
        .then((data) => setBuildings(data.items || []))
        .catch(() => setBuildings([]))
    })

    const buildingIdParam = searchParams.get('building_id')
    if (buildingIdParam) {
      setPartOfBuilding(true)
      setSelectedBuildingId(buildingIdParam)
    }
  }, [isEditing, loading, profile])

  useEffect(() => {
    if (!newBuildingLocation.wardId) {
      setNewBuildingNeighborhoods([])
      return
    }
    fetch(
      `${API_BASE_URL}/api/locations/wards/${newBuildingLocation.wardId}/neighborhoods`,
    )
      .then((res) => res.json())
      .then((data) => setNewBuildingNeighborhoods(data))
      .catch(() => setNewBuildingNeighborhoods([]))
  }, [newBuildingLocation.wardId])

  if (loading || loadingExisting) {
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

  if (notOwner) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Not available</h1>
          <p>You can only edit your own properties.</p>
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

    if (partOfBuilding && !unitLabel.trim()) {
      setError('Please enter a unit label.')
      return
    }
    if (partOfBuilding && !selectedBuildingId) {
      setError('Please select a building, or choose "Create new building".')
      return
    }
    if (partOfBuilding && selectedBuildingId === '__new__') {
      if (!newBuildingName.trim()) {
        setError('Please enter a name for the new building.')
        return
      }
      if (!newBuildingLocation.wardId) {
        setError('Please select a state, LGA, and ward for the new building.')
        return
      }
      if (!newBuildingNeighborhoodName.trim()) {
        setError('Please enter or select a neighborhood for the new building.')
        return
      }
    }

    setSubmitting(true)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    let buildingId = null
    if (partOfBuilding) {
      if (selectedBuildingId === '__new__') {
        const buildingRes = await fetch(`${API_BASE_URL}/api/buildings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            name: newBuildingName,
            ward_id: newBuildingLocation.wardId,
            neighborhood_name: newBuildingNeighborhoodName,
            street: newBuildingStreet,
            total_units: newBuildingTotalUnits || null,
          }),
        })
        const savedBuilding = await buildingRes.json()

        if (!buildingRes.ok) {
          setSubmitting(false)
          setError(savedBuilding.error || 'Failed to create building')
          return
        }
        buildingId = savedBuilding.id
      } else {
        buildingId = selectedBuildingId
      }
    }

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
      ...(buildingId
        ? { building_id: buildingId, unit_label: unitLabel.trim() }
        : {}),
    }

    const saveRes = await fetch(
      `${API_BASE_URL}/api/properties${isEditing ? `/${editPropertyId}` : ''}`,
      {
        method: isEditing ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      },
    )

    const saved = await saveRes.json()

    if (!saveRes.ok) {
      setSubmitting(false)
      setError(saved.error || `Failed to ${isEditing ? 'save' : 'create'} property`)
      return
    }

    if (!isEditing && files.length > 0) {
      const formData = new FormData()
      for (const file of files) {
        formData.append('images', file)
      }

      const imagesRes = await fetch(
        `${API_BASE_URL}/api/properties/${saved.id}/images`,
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

    navigate(`/properties/${saved.id}`)
  }

  return (
    <div className="create-property-page">
      <div className="create-property-card">
        <h1>{isEditing ? 'Edit property' : 'List a property'}</h1>

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
            <LocationPicker onChange={setLocation} initialValue={location} />
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

          {!isEditing && (
            <div className="form-field building-toggle-field">
              <label className="building-toggle-label">
                <input
                  type="checkbox"
                  checked={partOfBuilding}
                  onChange={(e) => {
                    setPartOfBuilding(e.target.checked)
                    if (!e.target.checked) {
                      setSelectedBuildingId('')
                      setUnitLabel('')
                    }
                  }}
                />
                Part of a building?
              </label>

              {partOfBuilding && (
                <div className="building-picker">
                  <div className="form-field">
                    <label htmlFor="building">Building</label>
                    <select
                      id="building"
                      value={selectedBuildingId}
                      onChange={(e) => setSelectedBuildingId(e.target.value)}
                    >
                      <option value="">Select a building</option>
                      {buildings.map((building) => (
                        <option key={building.id} value={building.id}>
                          {building.name}
                        </option>
                      ))}
                      <option value="__new__">+ Create new building</option>
                    </select>
                  </div>

                  {selectedBuildingId === '__new__' && (
                    <div className="new-building-form">
                      <div className="form-field">
                        <label htmlFor="newBuildingName">Building name</label>
                        <input
                          id="newBuildingName"
                          type="text"
                          value={newBuildingName}
                          onChange={(e) => setNewBuildingName(e.target.value)}
                        />
                      </div>

                      <div className="form-field">
                        <span>Building location</span>
                        <LocationPicker
                          onChange={setNewBuildingLocation}
                          initialValue={newBuildingLocation}
                        />
                      </div>

                      <div className="form-field">
                        <label htmlFor="newBuildingNeighborhood">
                          Neighborhood
                        </label>
                        <input
                          id="newBuildingNeighborhood"
                          type="text"
                          list="new-building-neighborhood-options"
                          value={newBuildingNeighborhoodName}
                          onChange={(e) =>
                            setNewBuildingNeighborhoodName(e.target.value)
                          }
                          placeholder={
                            newBuildingLocation.wardId
                              ? 'Type to search or add a new neighborhood'
                              : 'Select a ward first'
                          }
                          disabled={!newBuildingLocation.wardId}
                        />
                        <datalist id="new-building-neighborhood-options">
                          {newBuildingNeighborhoods.map((n) => (
                            <option key={n.id} value={n.name} />
                          ))}
                        </datalist>
                      </div>

                      <div className="form-field">
                        <label htmlFor="newBuildingStreet">Street</label>
                        <input
                          id="newBuildingStreet"
                          type="text"
                          value={newBuildingStreet}
                          onChange={(e) => setNewBuildingStreet(e.target.value)}
                        />
                      </div>

                      <div className="form-field">
                        <label htmlFor="newBuildingTotalUnits">
                          Total units
                        </label>
                        <input
                          id="newBuildingTotalUnits"
                          type="number"
                          min="0"
                          value={newBuildingTotalUnits}
                          onChange={(e) =>
                            setNewBuildingTotalUnits(e.target.value)
                          }
                        />
                      </div>
                    </div>
                  )}

                  {selectedBuildingId && (
                    <div className="form-field">
                      <label htmlFor="unitLabel">Unit label</label>
                      <input
                        id="unitLabel"
                        type="text"
                        placeholder="e.g. Flat 2B"
                        value={unitLabel}
                        onChange={(e) => setUnitLabel(e.target.value)}
                        required
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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

          {!isEditing && (
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
          )}
          {isEditing && (
            <p className="owner-actions-hint">
              Photos aren't editable here yet — existing photos are kept as-is.
            </p>
          )}

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting
              ? isEditing
                ? 'Saving...'
                : 'Creating...'
              : isEditing
                ? 'Save changes'
                : 'Create listing'}
          </button>
        </form>
      </div>
    </div>
  )
}
