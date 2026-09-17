import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { API_BASE_URL } from '../lib/api'
import { formatNaira } from '../lib/propertyStatus'

export default function PayButton({ property }) {
  const { user, profile } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (
    !user ||
    profile?.role !== 'tenant' ||
    profile?.id === property.owner_id ||
    !property.viewer_can_pay ||
    property.move_in_cost?.total == null
  ) {
    return null
  }

  const handlePay = async () => {
    setSubmitting(true)
    setError('')

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(`${API_BASE_URL}/api/payments/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ property_id: property.id }),
    })

    const body = await res.json()

    if (!res.ok) {
      setSubmitting(false)
      setError(body.error || 'Failed to start payment')
      return
    }

    // A real browser redirect to Paystack's own hosted checkout page,
    // not a fetch — the tenant needs to actually land on it.
    window.location.href = body.authorization_url
  }

  return (
    <>
      {error && <div className="form-error">{error}</div>}
      <button
        type="button"
        className="btn-primary"
        onClick={handlePay}
        disabled={submitting}
      >
        {submitting
          ? 'Redirecting to Paystack...'
          : `Pay & secure this unit — ${formatNaira(property.move_in_cost.total)}`}
      </button>
    </>
  )
}
