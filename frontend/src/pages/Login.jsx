import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { suspendedMessage, clearSuspendedMessage } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    clearSuspendedMessage()
    setSubmitting(true)

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password })

    setSubmitting(false)

    if (signInError) {
      setError(signInError.message)
      return
    }

    // Read the role straight from the database rather than the
    // AuthContext's profile state, which may not have finished
    // loading yet at this exact moment — this mirrors AuthContext's
    // own profile fetch, just narrowed to the one field we need.
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', signInData.user.id)
      .single()

    navigate(profileRow?.role === 'admin' ? '/admin' : '/home')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Log in</h1>

        {suspendedMessage && <div className="form-error">{suspendedMessage}</div>}
        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <div className="auth-switch">
          Don't have an account? <Link to="/register">Create one</Link>
        </div>
      </div>
    </div>
  )
}
