import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { STATUS_META, formatNaira } from '../lib/propertyStatus'
import ConfirmDialog from '../components/ConfirmDialog'

const STATUS_ACTIONS = {
  draft: [{ label: 'Publish', next: 'available' }],
  available: [
    { label: 'Mark as rented', next: 'rented' },
    { label: 'Mark unavailable', next: 'unavailable' },
  ],
  rented: [
    { label: 'Mark as available', next: 'available' },
    { label: 'Mark unavailable', next: 'unavailable' },
  ],
  unavailable: [{ label: 'Mark as available', next: 'available' }],
  pending: [],
  suspended: [],
}

export default function MyProperties() {
  const { profile, loading: authLoading } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [rowErrors, setRowErrors] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [verificationStatus, setVerificationStatus] = useState({})
  const [uploadingId, setUploadingId] = useState(null)
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadSubmitting, setUploadSubmitting] = useState(false)
  const [pickerPropertyId, setPickerPropertyId] = useState(null)
  const [pickerTenants, setPickerTenants] = useState(null)
  const [selectedTenantId, setSelectedTenantId] = useState('')
  const [tenancyWarning, setTenancyWarning] = useState(null)

  useEffect(() => {
    if (authLoading) return

    if (!profile || !['landlord', 'agent'].includes(profile.role)) {
      setLoading(false)
      return
    }

    setLoadError(false)
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch(`${API_BASE_URL}/api/properties?mine=true`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(async (res) => {
          if (!res.ok) {
            setLoadError(true)
            return
          }
          const data = await res.json()
          const list = data.items || []
          setItems(list)

          const unverified = list.filter((p) => !p.ownership_verified)
          if (unverified.length === 0) return

          supabase.auth.getSession().then(({ data: { session: s } }) => {
            Promise.all(
              unverified.map((p) =>
                fetch(`${API_BASE_URL}/api/verification/property/${p.id}/status`, {
                  headers: { Authorization: `Bearer ${s.access_token}` },
                })
                  .then((res) => (res.ok ? res.json() : null))
                  .then((status) => [p.id, status]),
              ),
            ).then((pairs) => {
              setVerificationStatus(
                Object.fromEntries(pairs.filter(([, status]) => status !== null)),
              )
            })
          })
        })
        .catch(() => setLoadError(true))
        .finally(() => setLoading(false))
    })
  }, [profile, authLoading])

  const openUpload = (propertyId) => {
    setUploadingId(propertyId)
    setUploadFile(null)
    setRowErrors((prev) => ({ ...prev, [propertyId]: '' }))
  }

  const handleUploadSubmit = async (propertyId) => {
    if (!uploadFile) {
      setRowErrors((prev) => ({ ...prev, [propertyId]: 'Please choose a file.' }))
      return
    }

    setUploadSubmitting(true)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const formData = new FormData()
    formData.append('document', uploadFile)

    const res = await fetch(
      `${API_BASE_URL}/api/verification/property/${propertyId}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      },
    )

    const body = await res.json()
    setUploadSubmitting(false)

    if (!res.ok) {
      setRowErrors((prev) => ({
        ...prev,
        [propertyId]: body.error || 'Failed to submit document',
      }))
      return
    }

    setVerificationStatus((prev) => ({ ...prev, [propertyId]: body }))
    setUploadingId(null)
    setUploadFile(null)
  }

  const handleStatusChange = async (propertyId, nextStatus, tenantId) => {
    const previous = items
    setRowErrors((prev) => ({ ...prev, [propertyId]: '' }))
    setItems((prev) =>
      prev.map((p) =>
        p.id === propertyId ? { ...p, status: nextStatus } : p,
      ),
    )
    setBusyId(propertyId)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(`${API_BASE_URL}/api/properties/${propertyId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(
        tenantId ? { status: nextStatus, tenant_id: tenantId } : { status: nextStatus },
      ),
    })

    setBusyId(null)

    if (!res.ok) {
      const body = await res.json()
      setItems(previous)
      setRowErrors((prev) => ({
        ...prev,
        [propertyId]: body.error || 'Failed to update status',
      }))
    }
  }

  const openRentedPicker = async (propertyId) => {
    setPickerPropertyId(propertyId)
    setPickerTenants(null)
    setSelectedTenantId('')
    setRowErrors((prev) => ({ ...prev, [propertyId]: '' }))

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(`${API_BASE_URL}/api/properties/${propertyId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })

    if (!res.ok) {
      setRowErrors((prev) => ({
        ...prev,
        [propertyId]: 'Something went wrong loading eligible tenants — try again.',
      }))
      setPickerPropertyId(null)
      return
    }

    const data = await res.json()
    setPickerTenants(data.eligible_tenants || [])
  }

  const confirmRented = (propertyId, tenantId) => {
    setPickerPropertyId(null)
    handleStatusChange(propertyId, 'rented', tenantId || undefined)
  }

  if (authLoading || loading) {
    return <div className="page-loading">Loading...</div>
  }

  if (!profile || !['landlord', 'agent'].includes(profile.role)) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Not available</h1>
          <p>Only landlords and agents have properties to manage.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="property-list-page">
      <h1>My properties</h1>

      {loadError ? (
        <div className="form-error">
          Something went wrong loading this page — try again.
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p>You haven't listed any properties yet.</p>
          <Link to="/create-property" className="btn-secondary">
            List a property
          </Link>
        </div>
      ) : (
        <div className="my-properties-list">
          {items.map((property) => {
            const meta = STATUS_META[property.status] || {
              label: property.status,
              className: '',
            }
            const actions = STATUS_ACTIONS[property.status] || []

            return (
              <div key={property.id} className="my-property-row">
                {property.first_image ? (
                  <img
                    src={property.first_image}
                    alt={property.title}
                    className="my-property-thumb"
                  />
                ) : (
                  <div className="my-property-thumb my-property-thumb-empty">
                    No photo
                  </div>
                )}

                <div className="my-property-info">
                  <Link
                    to={`/properties/${property.id}`}
                    className="my-property-title"
                  >
                    {property.title}
                  </Link>
                  <p className="property-card-location">
                    {property.neighborhood.name}, {property.ward.lga.name},{' '}
                    {property.ward.lga.state.name}
                  </p>
                  <p className="property-card-cost">
                    {property.move_in_cost.total != null
                      ? formatNaira(property.move_in_cost.total)
                      : 'Move-in cost not provided'}
                  </p>

                  <div className="property-verification-row">
                    {property.ownership_verified ? (
                      <span className="verified-status">🟢 Verified</span>
                    ) : (
                      (() => {
                        const vs = verificationStatus[property.id]
                        if (vs === undefined) return null
                        if (!vs) {
                          return (
                            <>
                              <span className="not-verified-status">
                                Not submitted
                              </span>
                              <button
                                type="button"
                                className="btn-link"
                                onClick={() => openUpload(property.id)}
                              >
                                Submit for verification
                              </button>
                            </>
                          )
                        }
                        if (vs.status === 'pending') {
                          return (
                            <span className="not-verified-status">
                              Pending review
                            </span>
                          )
                        }
                        if (vs.status === 'rejected') {
                          return (
                            <>
                              <span className="not-verified-status">
                                Rejected{vs.admin_notes ? `: "${vs.admin_notes}"` : ''}
                              </span>
                              <button
                                type="button"
                                className="btn-link"
                                onClick={() => openUpload(property.id)}
                              >
                                Resubmit
                              </button>
                            </>
                          )
                        }
                        return null
                      })()
                    )}
                  </div>

                  {uploadingId === property.id && (
                    <div className="identity-upload-form">
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) =>
                          setUploadFile(e.target.files?.[0] || null)
                        }
                      />
                      <div className="inspection-request-actions">
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={uploadSubmitting}
                          onClick={() => handleUploadSubmit(property.id)}
                        >
                          {uploadSubmitting ? 'Uploading...' : 'Submit'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setUploadingId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {pickerPropertyId === property.id && (
                    <div className="tenant-picker">
                      <p className="tenant-picker-prompt">
                        Who is renting this?
                      </p>
                      {pickerTenants === null ? (
                        <p className="inspection-empty">
                          Loading eligible tenants...
                        </p>
                      ) : pickerTenants.length === 0 ? (
                        <p className="inspection-empty">
                          No tenant has a completed or accepted inspection on
                          this property yet.
                        </p>
                      ) : (
                        <select
                          value={selectedTenantId}
                          onChange={(e) => setSelectedTenantId(e.target.value)}
                        >
                          <option value="">Select a tenant</option>
                          {pickerTenants.map((tenant) => (
                            <option key={tenant.id} value={tenant.id}>
                              {tenant.full_name || 'Unnamed tenant'}
                              {tenant.has_successful_payment
                                ? ' — payment received'
                                : ''}
                            </option>
                          ))}
                        </select>
                      )}
                      <div className="inspection-request-actions">
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={!selectedTenantId || busyId === property.id}
                          onClick={() =>
                            confirmRented(property.id, selectedTenantId)
                          }
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={busyId === property.id}
                          onClick={() => confirmRented(property.id, null)}
                        >
                          Skip / I'll track this outside the app
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setPickerPropertyId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {rowErrors[property.id] && (
                    <div className="form-error">{rowErrors[property.id]}</div>
                  )}
                </div>

                <div className="my-property-controls">
                  <span className={`status-badge ${meta.className}`}>
                    {meta.label}
                  </span>
                  <div className="my-property-actions">
                    {actions.map((action) => (
                      <button
                        key={action.next}
                        type="button"
                        className="btn-secondary"
                        disabled={busyId === property.id}
                        onClick={() => {
                          if (action.next === 'rented') {
                            openRentedPicker(property.id)
                            return
                          }
                          if (property.status === 'rented' && property.active_tenant_name) {
                            setTenancyWarning({
                              propertyId: property.id,
                              nextStatus: action.next,
                              tenantName: property.active_tenant_name,
                            })
                            return
                          }
                          handleStatusChange(property.id, action.next)
                        }}
                      >
                        {action.label}
                      </button>
                    ))}
                    <Link
                      to={`/edit-property/${property.id}`}
                      className="btn-secondary"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tenancyWarning && (
        <ConfirmDialog
          message={`This will end ${tenancyWarning.tenantName}'s current tenancy on this property. Continue?`}
          confirmLabel="End tenancy and continue"
          onCancel={() => setTenancyWarning(null)}
          onConfirm={() => {
            const { propertyId, nextStatus } = tenancyWarning
            setTenancyWarning(null)
            handleStatusChange(propertyId, nextStatus)
          }}
        />
      )}
    </div>
  )
}
