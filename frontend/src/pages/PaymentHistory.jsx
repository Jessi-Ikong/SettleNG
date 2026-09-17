import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { API_BASE_URL } from '../lib/api'
import { formatNaira } from '../lib/propertyStatus'

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatAddress(payment) {
  return [
    payment.property_neighborhood?.name,
    payment.property_ward?.name,
    payment.property_ward?.lga?.name,
    payment.property_ward?.lga?.state?.name,
    payment.property_street,
  ]
    .filter(Boolean)
    .join(', ')
}

const STATUS_LABELS = {
  initialized: 'Pending',
  success: 'Paid',
  failed: 'Failed',
  abandoned: 'Abandoned',
}

const STATUS_BADGE_CLASS = {
  initialized: 'status-pending',
  success: 'status-available',
  failed: 'status-suspended',
  abandoned: 'status-suspended',
}

export default function PaymentHistory() {
  const { profile, loading: authLoading } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (authLoading) return

    if (!profile || profile.role !== 'tenant') {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch(`${API_BASE_URL}/api/payments/mine`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(async (res) => {
          if (!res.ok) {
            setLoadError(true)
            return
          }
          const data = await res.json()
          setItems(data.items || [])
        })
        .catch(() => setLoadError(true))
        .finally(() => setLoading(false))
    })
  }, [authLoading, profile])

  if (authLoading || loading) {
    return <div className="page-loading">Loading...</div>
  }

  if (!profile || profile.role !== 'tenant') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Not available</h1>
          <p>Only tenants have a payment history to view.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="property-list-page">
      <h1>Payments</h1>

      {loadError ? (
        <div className="form-error">
          Something went wrong loading this page — try again.
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p>You haven't made any payments yet.</p>
        </div>
      ) : (
        <div className="tenancy-history-list">
          {items.map((payment) => (
            <div key={payment.id} className="tenancy-history-item payment-item">
              {payment.property_first_image ? (
                <img
                  src={payment.property_first_image}
                  alt={payment.property_title}
                  className="tenancy-history-thumb"
                />
              ) : (
                <div className="tenancy-history-thumb tenancy-history-thumb-empty">
                  No photo
                </div>
              )}
              <div className="tenancy-history-info">
                <Link
                  to={`/properties/${payment.property_id}`}
                  className="tenancy-history-title"
                >
                  {payment.property_title || 'Property no longer available'}
                  {payment.property_unit_label
                    ? ` — ${payment.property_unit_label}`
                    : ''}
                </Link>

                {payment.property_building_id && (
                  <Link
                    to={`/buildings/${payment.property_building_id}`}
                    className="payment-building-link"
                  >
                    Part of {payment.property_building_name || 'this building'}
                  </Link>
                )}

                <span className="tenancy-history-meta">
                  {formatAddress(payment) || 'Address not provided'}
                </span>

                <span className="tenancy-history-meta">
                  Landlord: {payment.landlord_name || 'Unknown'}
                </span>

                <span className="tenancy-history-meta payment-amount-row">
                  {formatNaira(payment.amount)}
                  <span
                    className={`status-badge ${STATUS_BADGE_CLASS[payment.status] || ''}`}
                  >
                    {STATUS_LABELS[payment.status] || payment.status}
                  </span>
                </span>

                <span className="tenancy-history-meta payment-reference">
                  Reference: <code>{payment.paystack_reference}</code>
                </span>

                <span className="tenancy-history-meta">
                  Initiated {formatDate(payment.created_at)}
                </span>
                <span className="tenancy-history-meta">
                  Paid {payment.paid_at ? formatDate(payment.paid_at) : 'not yet'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
