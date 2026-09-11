import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import { INSPECTION_STATUS_META, formatInspectionDate } from '../lib/inspections'
import ReportButton from '../components/ReportButton'

const HISTORY_STATUSES = ['completed', 'cancelled', 'rejected', 'no_show']

export default function OwnerInspections() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [rowErrors, setRowErrors] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [actionState, setActionState] = useState({})

  const load = () => {
    setLoading(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch(`${API_BASE_URL}/api/inspections?role=owner`, {
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

  const setMode = (id, mode) => {
    setActionState((prev) => ({
      ...prev,
      [id]: { mode, reason: '', newDate: '', newTime: '' },
    }))
  }

  const updateField = (id, field, value) => {
    setActionState((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
  }

  const submitPatch = async (id, payload) => {
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
      body: JSON.stringify(payload),
    })

    const body = await res.json()
    setBusyId(null)

    if (!res.ok) {
      setRowErrors((prev) => ({ ...prev, [id]: body.error || 'Failed' }))
      return
    }

    setItems((prev) => prev.map((i) => (i.id === id ? body : i)))
    setMode(id, null)
  }

  const handleAccept = (id) => submitPatch(id, { status: 'accepted' })
  const handleComplete = (id) => submitPatch(id, { status: 'completed' })
  const handleNoShow = (id) => submitPatch(id, { status: 'no_show' })

  const handleReject = (id) => {
    const state = actionState[id] || {}
    if (!state.reason?.trim()) {
      setRowErrors((prev) => ({ ...prev, [id]: 'A reason is required' }))
      return
    }
    submitPatch(id, {
      status: 'rejected',
      owner_response_note: state.reason.trim(),
    })
  }

  const handleReschedule = (id) => {
    const state = actionState[id] || {}
    if (!state.newDate || !state.newTime || !state.reason?.trim()) {
      setRowErrors((prev) => ({
        ...prev,
        [id]: 'New date, time, and a reason are all required',
      }))
      return
    }
    submitPatch(id, {
      status: 'rescheduled',
      requested_date: state.newDate,
      requested_time: state.newTime,
      owner_response_note: state.reason.trim(),
    })
  }

  if (loading) {
    return <div className="page-loading">Loading...</div>
  }

  const pending = items.filter((i) => i.status === 'requested')
  const upcoming = items.filter(
    (i) => i.status === 'accepted' || i.status === 'rescheduled',
  )
  const history = items.filter((i) => HISTORY_STATUSES.includes(i.status))

  const renderRowShell = (inspection, actions) => {
    const meta = INSPECTION_STATUS_META[inspection.status]
    const mode = actionState[inspection.id]?.mode
    const state = actionState[inspection.id] || {}

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
          </p>
          {inspection.note && (
            <p className="inspection-note">Tenant: "{inspection.note}"</p>
          )}
          <div className="inspection-other-party-row">
            <p className="inspection-other-party">
              Tenant: {inspection.other_party_name}
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

          {mode === 'reject' && (
            <div className="inspection-action-form">
              <textarea
                placeholder="Reason for rejecting (required)"
                value={state.reason}
                onChange={(e) =>
                  updateField(inspection.id, 'reason', e.target.value)
                }
                rows={2}
              />
              <div className="inspection-request-actions">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busyId === inspection.id}
                  onClick={() => handleReject(inspection.id)}
                >
                  Confirm reject
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setMode(inspection.id, null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {mode === 'reschedule' && (
            <div className="inspection-action-form">
              <div className="form-row">
                <div className="form-field">
                  <label>New date</label>
                  <input
                    type="date"
                    value={state.newDate}
                    onChange={(e) =>
                      updateField(inspection.id, 'newDate', e.target.value)
                    }
                  />
                </div>
                <div className="form-field">
                  <label>New time</label>
                  <input
                    type="time"
                    value={state.newTime}
                    onChange={(e) =>
                      updateField(inspection.id, 'newTime', e.target.value)
                    }
                  />
                </div>
              </div>
              <textarea
                placeholder="Reason for the new time (required)"
                value={state.reason}
                onChange={(e) =>
                  updateField(inspection.id, 'reason', e.target.value)
                }
                rows={2}
              />
              <div className="inspection-request-actions">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busyId === inspection.id}
                  onClick={() => handleReschedule(inspection.id)}
                >
                  Send new time
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setMode(inspection.id, null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="my-property-controls">
          <span className={`status-badge ${meta.className}`}>
            {meta.label}
          </span>
          {!mode && (
            <div className="my-property-actions">{actions}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="property-list-page">
      <h1>Inspection requests</h1>

      <h2 className="inspection-section-heading">Pending requests</h2>
      {pending.length === 0 ? (
        <p className="inspection-empty">No pending requests.</p>
      ) : (
        <div className="my-properties-list">
          {pending.map((inspection) =>
            renderRowShell(
              inspection,
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busyId === inspection.id}
                  onClick={() => handleAccept(inspection.id)}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setMode(inspection.id, 'reject')}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setMode(inspection.id, 'reschedule')}
                >
                  Propose new time
                </button>
              </>,
            ),
          )}
        </div>
      )}

      <h2 className="inspection-section-heading">Upcoming</h2>
      {upcoming.length === 0 ? (
        <p className="inspection-empty">No upcoming inspections.</p>
      ) : (
        <div className="my-properties-list">
          {upcoming.map((inspection) =>
            renderRowShell(
              inspection,
              inspection.status === 'accepted' ? (
                <>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busyId === inspection.id}
                    onClick={() => handleComplete(inspection.id)}
                  >
                    Mark completed
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busyId === inspection.id}
                    onClick={() => handleNoShow(inspection.id)}
                  >
                    Mark no-show
                  </button>
                </>
              ) : null,
            ),
          )}
        </div>
      )}

      <h2 className="inspection-section-heading">
        Completed / Cancelled / No-show history
      </h2>
      {history.length === 0 ? (
        <p className="inspection-empty">Nothing here yet.</p>
      ) : (
        <div className="my-properties-list">
          {history.map((inspection) => renderRowShell(inspection, null))}
        </div>
      )}
    </div>
  )
}
