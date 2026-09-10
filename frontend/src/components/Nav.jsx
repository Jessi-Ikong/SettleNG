import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Nav() {
  const { user, profile } = useAuth()
  const canList = profile && ['landlord', 'agent'].includes(profile.role)

  return (
    <nav className="site-nav">
      <Link to="/" className="site-nav-brand">
        <span className="wordmark-settle">Settle</span>
        <span className="wordmark-ng">NG</span>
      </Link>
      <div className="site-nav-links">
        <Link to="/properties">Browse</Link>
        {canList && <Link to="/create-property">List a property</Link>}
        {user ? (
          <Link to="/dashboard">Dashboard</Link>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  )
}
