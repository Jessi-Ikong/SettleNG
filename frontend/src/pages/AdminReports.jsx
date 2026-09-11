import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import {
  REPORT_REASON_LABELS,
  REPORT_STATUS_META,
  formatReportDate,
} from '../lib/reports'
import PropertyListingDetail from '../components/PropertyListingDetail'

const STATUS_FILTERS = ['all', 'pending', 'reviewed', 'actioned', 'dismissed']

const PROPERTY_STATUS_META = {
  draft: { label: 'Draft', className: 'status-draft' },
  available: { label: 'Available', className: 'status-available' },
  pending: { label: 'Pending', className: 'status-pending' },
  rented: { label: 'Rented', className: 'status-rented' },
  unavailable: { label: 'Unavailable', className: 'status-unavailable' },
  suspended: { label: 'Suspended', className: 'status-suspended' },
}

export default function AdminReports() {
  const { profile, loading: authLoading } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [draftStatus, setDraftStatus] = useState('')
  const [draftNotes, setDraftNotes] = useState('')
  const [rowErrors, setRowErrors] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [propertyBusyId, setPropertyBusyId] = useState(null)
  const [propertyPreviews, setPropertyPreviews] = useState({})

  const load = () => {
    setLoading(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      const query = filter === 'all' ? '' : `?status=${filter}`
      fetch(`${API_BASE_URL}/api/reports${query}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((res) => res.json())
        .then((data) => setItems(data.items || []))
        .finally(() => setLoading(false))
    })
  }

  useEffect(() => {
    if (authLoading) return
    if (!profile || profile.role !== 'admin') {
      setLoading(false)
      return
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, authLoading, filter])

  const loadPropertyPreview = async (propertyId) => {
    setPropertyPreviews((prev) => ({
      ...prev,
      [propertyId]: { loading: true, data: null, error: '' },
    }))

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(`${API_BASE_URL}/api/properties/${propertyId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const body = await res.json()

    setPropertyPreviews((prev) => ({
      ...prev,
      [propertyId]: res.ok
        ? { loading: false, data: body, error: '' }
        : { loading: false, data: null, error: body.error || 'Failed to load listing' },
    }))
  }

  const toggleExpand = (report) => {
    if (expandedId === report.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(report.id)
    setDraftStatus(report.status)
    setDraftNotes(report.admin_notes || '')

    if (report.target_type === 'property' && !propertyPreviews[report.target_id]) {
      loadPropertyPreview(report.target_id)
    }
  }

  const handleSave = async (id) => {
    setRowErrors((prev) => ({ ...prev, [id]: '' }))
    setBusyId(id)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(`${API_BASE_URL}/api/reports/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ status: draftStatus, admin_notes: draftNotes }),
    })

    const body = await res.json()
    setBusyId(null)

    if (!res.ok) {
      setRowErrors((prev) => ({ ...prev, [id]: body.error || 'Failed to update' }))
      return
    }

    setItems((prev) => prev.map((r) => (r.id === id ? body : r)))
    setExpandedId(null)
  }

  const handlePropertyStatusChange = async (report, nextStatus) => {
    const propertyId = report.target_id
    setRowErrors((prev) => ({ ...prev, [report.id]: '' }))
    setPropertyBusyId(report.id)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(`${API_BASE_URL}/api/properties/${propertyId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ status: nextStatus }),
    })

    const body = await res.json()
    setPropertyBusyId(null)

    if (!res.ok) {
      setRowErrors((prev) => ({
        ...prev,
        [report.id]: body.error || 'Failed to update property status',
      }))
      return
    }

    setItems((prev) =>
      prev.map((r) =>
        r.target_type === 'property' && r.target_id === propertyId
          ? { ...r, target_property_status: nextStatus }
          : r,
      ),
    )

    setPropertyPreviews((prev) =>
      prev[propertyId]?.data
        ? {
            ...prev,
            [propertyId]: {
              ...prev[propertyId],
              data: { ...prev[propertyId].data, status: nextStatus },
            },
          }
        : prev,
    )
  }

  if (authLoading || loading) {
    return <div className="page-loading">Loading...</div>
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Not available</h1>
          <p>Only admins can view reports.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="property-list-page">
      <h1>Reports</h1>

      <div className="admin-reports-filters">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            className={
              'btn-secondary' + (filter === s ? ' btn-secondary-active' : '')
            }
            onClick={() => setFilter(s)}
          >
            {s === 'all' ? 'All' : REPORT_STATUS_META[s].label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="inspection-empty">No reports here.</p>
      ) : (
        <div className="admin-reports-list">
          {items.map((report) => {
            const meta = REPORT_STATUS_META[report.status]
            const expanded = expandedId === report.id

            return (
              <div key={report.id} className="admin-report-row">
                <div
                  className="admin-report-summary"
                  onClick={() => toggleExpand(report)}
                >
                  <div className="admin-report-main">
                    <span className="admin-report-target">
                      {report.target_type === 'property' ? (
                        report.target_label ? (
                          <Link
                            to={`/properties/${report.target_id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {report.target_label}
                          </Link>
                        ) : (
                          'Property no longer available'
                        )
                      ) : (
                        report.target_label || 'Unknown user'
                      )}
                    </span>

                    {report.target_type === 'property' &&
                      report.target_property_status && (
                        <div
                          className="admin-report-property-controls"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span
                            className={`status-badge ${
                              PROPERTY_STATUS_META[report.target_property_status]
                                ?.className || ''
                            }`}
                          >
                            {PROPERTY_STATUS_META[report.target_property_status]
                              ?.label || report.target_property_status}
                          </span>
                          {report.target_property_status !== 'suspended' && (
                            <button
                              type="button"
                              className="btn-secondary"
                              disabled={propertyBusyId === report.id}
                              onClick={() =>
                                handlePropertyStatusChange(report, 'suspended')
                              }
                            >
                              Suspend listing
                            </button>
                          )}
                          {report.target_property_status === 'suspended' && (
                            <button
                              type="button"
                              className="btn-secondary"
                              disabled={propertyBusyId === report.id}
                              onClick={() =>
                                handlePropertyStatusChange(report, 'available')
                              }
                            >
                              Reinstate
                            </button>
                          )}
                        </div>
                      )}
                    {!expanded && rowErrors[report.id] && (
                      <div className="form-error">{rowErrors[report.id]}</div>
                    )}

                    <span className="admin-report-reason">
                      {REPORT_REASON_LABELS[report.reason] || report.reason}
                    </span>
                    <span className="admin-report-reporter">
                      Reported by {report.reporter_name || 'Unknown'}
                    </span>
                    <span className="admin-report-date">
                      {formatReportDate(report.created_at)}
                    </span>
                  </div>
                  <span className={`status-badge ${meta.className}`}>
                    {meta.label}
                  </span>
                </div>

                {expanded && (
                  <div className="admin-report-detail">
                    {report.details && (
                      <p className="admin-report-details-text">
                        "{report.details}"
                      </p>
                    )}

                    {rowErrors[report.id] && (
                      <div className="form-error">{rowErrors[report.id]}</div>
                    )}

                    {report.target_type === 'property' && (
                      <div className="admin-report-listing-preview">
                        {propertyPreviews[report.target_id]?.loading && (
                          <p className="inspection-empty">Loading listing...</p>
                        )}
                        {propertyPreviews[report.target_id]?.error && (
                          <p className="inspection-empty">
                            {propertyPreviews[report.target_id].error}
                          </p>
                        )}
                        {propertyPreviews[report.target_id]?.data && (
                          <PropertyListingDetail
                            property={propertyPreviews[report.target_id].data}
                            ownerName={propertyPreviews[report.target_id].data.owner_name}
                          />
                        )}
                      </div>
                    )}

                    <div className="form-field">
                      <label>Status</label>
                      <select
                        value={draftStatus}
                        onChange={(e) => setDraftStatus(e.target.value)}
                      >
                        {Object.entries(REPORT_STATUS_META).map(([value, m]) => (
                          <option key={value} value={value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Admin notes</label>
                      <textarea
                        value={draftNotes}
                        onChange={(e) => setDraftNotes(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div className="inspection-request-actions">
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={busyId === report.id}
                        onClick={() => handleSave(report.id)}
                      >
                        {busyId === report.id ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setExpandedId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
