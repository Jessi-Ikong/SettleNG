import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { API_BASE_URL } from '../lib/api'

const IDENTITY_STATUS_META = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
}

export default function Profile() {
  const navigate = useNavigate()
  const { profile, loading: authLoading, signOut } = useAuth()

  const [phoneVerified, setPhoneVerified] = useState(false)
  const [otpRequested, setOtpRequested] = useState(false)
  const [devCode, setDevCode] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [phoneSubmitting, setPhoneSubmitting] = useState(false)

  const [identityStatus, setIdentityStatus] = useState(null)
  const [identityLoading, setIdentityLoading] = useState(true)
  const [identityFile, setIdentityFile] = useState(null)
  const [identityError, setIdentityError] = useState('')
  const [identitySubmitting, setIdentitySubmitting] = useState(false)

  useEffect(() => {
    if (profile) setPhoneVerified(Boolean(profile.phone_verified))
  }, [profile])

  const loadIdentityStatus = () => {
    setIdentityLoading(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch(`${API_BASE_URL}/api/verification/identity/status`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((res) => res.json())
        .then((data) => setIdentityStatus(data))
        .finally(() => setIdentityLoading(false))
    })
  }

  useEffect(() => {
    loadIdentityStatus()
  }, [])

  const handleSendCode = async () => {
    setPhoneError('')
    setPhoneSubmitting(true)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(`${API_BASE_URL}/api/verification/phone/request`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })

    const body = await res.json()
    setPhoneSubmitting(false)

    if (!res.ok) {
      setPhoneError(body.error || 'Failed to send code')
      return
    }

    setDevCode(body.dev_code)
    setOtpRequested(true)
    setCodeInput('')
  }

  const handleConfirmCode = async (event) => {
    event.preventDefault()
    setPhoneError('')
    setPhoneSubmitting(true)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(`${API_BASE_URL}/api/verification/phone/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ code: codeInput.trim() }),
    })

    const body = await res.json()
    setPhoneSubmitting(false)

    if (!res.ok) {
      setPhoneError(body.error || 'Failed to confirm code')
      return
    }

    setPhoneVerified(true)
    setOtpRequested(false)
    setDevCode('')
  }

  const handleIdentitySubmit = async (event) => {
    event.preventDefault()
    setIdentityError('')

    if (!identityFile) {
      setIdentityError('Please choose a file to upload.')
      return
    }

    setIdentitySubmitting(true)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const formData = new FormData()
    formData.append('document', identityFile)

    const res = await fetch(`${API_BASE_URL}/api/verification/identity`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: formData,
    })

    const body = await res.json()
    setIdentitySubmitting(false)

    if (!res.ok) {
      setIdentityError(body.error || 'Failed to submit document')
      return
    }

    setIdentityFile(null)
    setIdentityStatus(body)
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  if (authLoading) {
    return <div className="page-loading">Loading...</div>
  }

  const canSubmitIdentity =
    !identityLoading &&
    (!identityStatus || identityStatus.status === 'rejected')

  return (
    <div className="auth-page">
      <div className="auth-card profile-card">
        <h1>Your profile</h1>
        <p className="profile-name">
          {profile?.full_name} — <span>{profile?.role}</span>
        </p>
        <button type="button" className="btn-secondary" onClick={handleLogout}>
          Log out
        </button>

        {profile?.role !== 'admin' && (
          <>
            <section className="profile-section">
              <h2>Phone verification</h2>

              {phoneVerified ? (
                <p className="verified-status">🟢 Verified</p>
              ) : (
                <>
                  <p className="not-verified-status">Not verified</p>

                  {phoneError && <div className="form-error">{phoneError}</div>}

                  {!otpRequested ? (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleSendCode}
                      disabled={phoneSubmitting}
                    >
                      {phoneSubmitting ? 'Sending...' : 'Send code'}
                    </button>
                  ) : (
                    <>
                      <div className="dev-code-box">
                        <p className="dev-code-note">
                          SMS isn't connected yet — this code would normally be
                          texted to you.
                        </p>
                        <p className="dev-code-value">{devCode}</p>
                      </div>

                      <form className="otp-confirm-form" onSubmit={handleConfirmCode}>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="6-digit code"
                          value={codeInput}
                          onChange={(e) => setCodeInput(e.target.value)}
                        />
                        <button
                          type="submit"
                          className="btn-primary"
                          disabled={phoneSubmitting || codeInput.length !== 6}
                        >
                          {phoneSubmitting ? 'Confirming...' : 'Confirm'}
                        </button>
                      </form>

                      <button
                        type="button"
                        className="btn-link"
                        onClick={handleSendCode}
                        disabled={phoneSubmitting}
                      >
                        Send a new code
                      </button>
                    </>
                  )}
                </>
              )}
            </section>

            <section className="profile-section">
              <h2>Identity verification</h2>

              {identityLoading ? (
                <p className="inspection-empty">Loading...</p>
              ) : !identityStatus ? (
                <p className="not-verified-status">Not submitted</p>
              ) : (
                <>
                  <p
                    className={
                      identityStatus.status === 'approved'
                        ? 'verified-status'
                        : 'not-verified-status'
                    }
                  >
                    {identityStatus.status === 'approved' && '🟢 '}
                    {IDENTITY_STATUS_META[identityStatus.status] ||
                      identityStatus.status}
                  </p>
                  {identityStatus.status === 'rejected' &&
                    identityStatus.admin_notes && (
                      <p className="inspection-note">
                        Reason: "{identityStatus.admin_notes}"
                      </p>
                    )}
                </>
              )}

              {canSubmitIdentity && (
                <form className="identity-upload-form" onSubmit={handleIdentitySubmit}>
                  {identityError && (
                    <div className="form-error">{identityError}</div>
                  )}
                  <div className="form-field">
                    <label htmlFor="identity-document">
                      {identityStatus?.status === 'rejected'
                        ? 'Resubmit a document'
                        : 'Upload a government-issued ID'}
                    </label>
                    <input
                      id="identity-document"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setIdentityFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={identitySubmitting}
                  >
                    {identitySubmitting ? 'Uploading...' : 'Submit for review'}
                  </button>
                </form>
              )}
            </section>

            {profile?.role === 'tenant' && (
              <section className="profile-section">
                <h2>Rental history</h2>
                <Link to="/tenancy-history" className="btn-link">
                  View your rental history
                </Link>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
