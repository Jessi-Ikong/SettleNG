import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchTotalUnreadCount } from '../lib/messagesApi'

export default function Nav() {
  const { user, profile } = useAuth()
  const location = useLocation()
  const canList = profile && ['landlord', 'agent'].includes(profile.role)
  const isAdmin = profile?.role === 'admin'
  const showHome = profile && ['tenant', 'landlord', 'agent'].includes(profile.role)
  const [unreadCount, setUnreadCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const navRef = useRef(null)

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

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return

    const handleOutsideClick = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  return (
    <nav className="site-nav" ref={navRef}>
      <Link to="/" className="site-nav-brand" onClick={closeMenu}>
        <span className="wordmark-settle">Settle</span>
        <span className="wordmark-ng">NG</span>
      </Link>

      <button
        type="button"
        className="site-nav-toggle"
        aria-expanded={menuOpen}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span className="site-nav-toggle-icon" aria-hidden="true" />
        {user && unreadCount > 0 && (
          <span className="nav-unread-badge site-nav-toggle-badge">
            {unreadCount}
          </span>
        )}
      </button>

      <div
        className={
          'site-nav-links' + (menuOpen ? ' site-nav-links-open' : '')
        }
      >
        <Link to="/properties" onClick={closeMenu}>
          Browse
        </Link>
        {showHome && (
          <Link to="/home" onClick={closeMenu}>
            Home
          </Link>
        )}
        {canList && (
          <Link to="/properties-hub" onClick={closeMenu}>
            Properties
          </Link>
        )}
        {user && (
          <Link to="/saved" onClick={closeMenu}>
            Saved
          </Link>
        )}
        {user && (
          <Link
            to={canList ? '/inspections/owner' : '/inspections/tenant'}
            onClick={closeMenu}
          >
            Inspections
          </Link>
        )}
        {user && (
          <Link to="/messages" className="nav-messages-link" onClick={closeMenu}>
            Messages
            {unreadCount > 0 && (
              <span className="nav-unread-badge">{unreadCount}</span>
            )}
          </Link>
        )}
        {isAdmin && (
          <Link to="/admin" onClick={closeMenu}>
            Admin
          </Link>
        )}
        {user && (
          <Link to="/profile" onClick={closeMenu}>
            Profile
          </Link>
        )}
        {!user && (
          <>
            <Link to="/login" onClick={closeMenu}>
              Log in
            </Link>
            <Link to="/register" onClick={closeMenu}>
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
