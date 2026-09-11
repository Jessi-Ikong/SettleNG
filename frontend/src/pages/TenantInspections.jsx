import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import { INSPECTION_STATUS_META, formatInspectionDate } from '../lib/inspections'
import ReportButton from '../components/ReportButton'

const UPCOMING_STATUSES = ['requested', 'accepted', 'rescheduled']
const HISTORY_STATUSES = ['rejected', 'cancelled', 'no_show']

export default function TenantInspections() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [rowErrors, setRowErrors] = useState({})
  const [busyId, setBusyId] = useState(null)

  const load = () => {
    setLoading(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch(`${API_BASE_URL}/api/inspections?role=tenant`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((res) => res.json())
        .then((data) => setItems(data.items))
        .finally(() => setLoading(false))
    })
  }

  useEffect(() => {
    load()
  }, [])

  const handleAction = async (id, status) => {
    const previous = items
    setRowErrors((prev) => ({ ...prev, [id]: '' }))
    setBusyId(id)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(`${API_BASE_URL}/api/inspections/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ status }),
    })

    const body = await res.json()
    setBusyId(null)

    if (!res.ok) {
      setRowErrors((prev) => ({ ...prev, [id]: body.error || 'Failed' }))
      setItems(previous)
      return
    }

    setItems((prev) => prev.map((i) => (i.id === id ? body : i)))
  }

  if (loading) {
    return <div className="page-loading">Loading...</div>
  }

  const upcoming = items.filter((i) => UPCOMING_STATUSES.includes(i.status))
  const completed = items.filter((i) => i.status === 'completed')
  const history = items.filter((i) => HISTORY_STATUSES.includes(i.status))

  const renderRow = (inspection) => {
    const meta = INSPECTION_STATUS_META[inspection.status]
    return (
      <div key={inspection.id} className="inspection-row">
        {inspection.property.first_image ? (
          <img
            src={inspection.property.first_image}
            alt={inspection.property.title}
            className="my-property-thumb"
          />
        ) : (
          <div className="my-property-thumb my-property-thumb-empty">
            No photo
          </div>
        )}

        <div className="inspection-info">
          <Link
            to={`/properties/${inspection.property_id}`}
            className="my-property-title"
          >
            {inspection.property.title}
          </Link>
          <p className="property-card-location">
            {inspection.property.ward.name}, {inspection.property.ward.lga.name},{' '}
            {inspection.property.ward.lga.state.name}
          </p>
          <p className="inspection-datetime">
            {formatInspectionDate(inspection.requested_date)} at{' '}
            {inspection.requested_time}
            {inspection.status === 'rescheduled' && ' (proposed by owner)'}
          </p>
          {inspection.status === 'rescheduled' && inspection.owner_response_note && (
            <p className="inspection-note">
              Owner: "{inspection.owner_response_note}"
            </p>
          )}
          <div className="inspection-other-party-row">
            <p className="inspection-other-party">
              Owner: {inspection.other_party_name}
            </p>
            {inspection.other_party_id && (
              <ReportButton
                targetType="user"
                targetId={inspection.other_party_id}
              />
            )}
          </div>
          {rowErrors[inspection.id] && (
            <div className="form-error">{rowErrors[inspection.id]}</div>
          )}
        </div>

        <div className="my-property-controls">
          <span className={`status-badge ${meta.className}`}>
            {meta.label}
          </span>
          <div className="my-property-actions">
            {(inspection.status === 'requested' ||
              inspection.status === 'accepted') && (
              <button
                type="button"
                className="btn-secondary"
                disabled={busyId === inspection.id}
                onClick={() => handleAction(inspection.id, 'cancelled')}
              >
                Cancel
              </button>
            )}
            {inspection.status === 'rescheduled' && (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busyId === inspection.id}
                  onClick={() => handleAction(inspection.id, 'accepted')}
                >
                  Accept reschedule
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busyId === inspection.id}
                  onClick={() => handleAction(inspection.id, 'cancelled')}
                >
                  Reject reschedule
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="property-list-page">
      <h1>My inspections</h1>

      <h2 className="inspection-section-heading">Upcoming</h2>
      {upcoming.length === 0 ? (
        <p className="inspection-empty">No upcoming inspections.</p>
      ) : (
        <div className="my-properties-list">{upcoming.map(renderRow)}</div>
      )}

      <h2 className="inspection-section-heading">Completed</h2>
      {completed.length === 0 ? (
        <p className="inspection-empty">No completed inspections yet.</p>
      ) : (
        <div className="my-properties-list">{completed.map(renderRow)}</div>
      )}

      <h2 className="inspection-section-heading">
        Cancelled / Rejected / No-show
      </h2>
      {history.length === 0 ? (
        <p className="inspection-empty">Nothing here yet.</p>
      ) : (
        <div className="my-properties-list">{history.map(renderRow)}</div>
      )}
    </div>
  )
}
