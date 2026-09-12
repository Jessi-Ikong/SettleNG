import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchTotalUnreadCount } from '../lib/messagesApi'

export default function Nav() {
  const { user, profile } = useAuth()
  const canList = profile && ['landlord', 'agent'].includes(profile.role)
  const isAdmin = profile?.role === 'admin'
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) {
      setUnreadCount(0)
      return
    }

    const refresh = () => fetchTotalUnreadCount().then(setUnreadCount)
    refresh()

    window.addEventListener('unread-count-changed', refresh)
    return () => window.removeEventListener('unread-count-changed', refresh)
  }, [user])

  return (
    <nav className="site-nav">
      <Link to="/" className="site-nav-brand">
        <span className="wordmark-settle">Settle</span>
        <span className="wordmark-ng">NG</span>
      </Link>
      <div className="site-nav-links">
        <Link to="/properties">Browse</Link>
        {canList && <Link to="/create-property">List a property</Link>}
        {canList && <Link to="/my-properties">My Properties</Link>}
        {user && <Link to="/saved-properties">Saved Properties</Link>}
        {user && <Link to="/saved-searches">Saved Searches</Link>}
        {user && (
          <Link to={canList ? '/inspections/owner' : '/inspections/tenant'}>
            Inspections
          </Link>
        )}
        {user && (
          <Link to="/messages" className="nav-messages-link">
            Messages
            {unreadCount > 0 && (
              <span className="nav-unread-badge">{unreadCount}</span>
            )}
          </Link>
        )}
        {isAdmin && <Link to="/admin">Admin</Link>}
        {user && <Link to="/profile">Profile</Link>}
        {!user && (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  )
}
