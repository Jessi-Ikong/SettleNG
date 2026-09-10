import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <main className="placeholder-screen">
      <h1 className="wordmark">
        <span className="wordmark-settle">Settle</span>
        <span className="wordmark-ng">NG</span>
      </h1>
      <p className="tagline">Find a place, verified before you move.</p>
      <div className="auth-switch">
        <Link to="/properties">Browse listings</Link> ·{' '}
        <Link to="/login">Log in</Link> · <Link to="/register">Register</Link>
      </div>
    </main>
  )
}
