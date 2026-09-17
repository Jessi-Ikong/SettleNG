import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { API_BASE_URL } from '../lib/api'
import { formatNaira } from '../lib/propertyStatus'

function formatDate(isoString) {
  if (!isoString) return null
  return new Date(isoString).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function PaymentCallback() {
  const [searchParams] = useSearchParams()
  const reference = searchParams.get('reference')
  const [payment, setPayment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!reference) {
      setError('No payment reference was provided.')
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch(`${API_BASE_URL}/api/payments/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(async (res) => {
          const body = await res.json()
          if (!res.ok) {
            setError(body.error || 'Failed to verify payment')
            return
          }
          setPayment(body)
        })
        .catch(() => setError('Failed to verify payment'))
        .finally(() => setLoading(false))
    })
  }, [reference])

  if (loading) {
    return <div className="page-loading">Loading...</div>
  }

  if (error || !payment) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Payment verification failed</h1>
          <p>{error || 'We could not find this payment.'}</p>
          <Link to="/properties" className="btn-secondary">
            Back to listings
          </Link>
        </div>
      </div>
    )
  }

  if (payment.status !== 'success') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Payment {payment.status}</h1>
          <p>
            Your payment for "{payment.property.title}" did not complete
            successfully.
          </p>
          <Link to={`/properties/${payment.property.id}`} className="btn-secondary">
            Back to property
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Payment successful</h1>
        <p>Your payment has been confirmed. Here's your receipt:</p>
        <table className="cost-breakdown-table">
          <tbody>
            <tr>
              <td>Property</td>
              <td>
                <Link to={`/properties/${payment.property.id}`}>
                  {payment.property.title}
                </Link>
              </td>
            </tr>
            <tr>
              <td>Amount</td>
              <td>{formatNaira(payment.amount)}</td>
            </tr>
            <tr>
              <td>Reference</td>
              <td>{payment.reference}</td>
            </tr>
            <tr>
              <td>Date</td>
              <td>{formatDate(payment.paid_at) || formatDate(payment.created_at)}</td>
            </tr>
          </tbody>
        </table>
        <Link to="/payments" className="btn-secondary">
          View payment history
        </Link>
      </div>
    </div>
  )
}
