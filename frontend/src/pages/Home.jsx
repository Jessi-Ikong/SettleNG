import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { API_BASE_URL } from '../lib/api'
import { fetchTotalUnreadCount } from '../lib/messagesApi'
import { formatInspectionDate } from '../lib/inspections'

function formatSinceDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const TENANT_UPCOMING_STATUSES = ['requested', 'accepted', 'rescheduled']

const PROPERTY_STATUS_ROWS = [
  { key: 'draft', label: 'Draft' },
  { key: 'available', label: 'Available' },
  { key: 'rented', label: 'Rented' },
  { key: 'unavailable', label: 'Unavailable' },
]

async function authedFetch(path) {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  if (!res.ok) return null
  return res.json()
}

export default function Home() {
  const { profile, loading: authLoading } = useAuth()
  const isLandlordAgent = Boolean(
    profile && ['landlord', 'agent'].includes(profile.role),
  )

  const [loading, setLoading] = useState(true)
  const [inspections, setInspections] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [recentConversation, setRecentConversation] = useState(null)
  const [hasConversations, setHasConversations] = useState(false)
  const [favoritesCount, setFavoritesCount] = useState(0)
  const [savedSearchesCount, setSavedSearchesCount] = useState(0)
  const [properties, setProperties] = useState([])
  const [currentTenancy, setCurrentTenancy] = useState(null)
  const [verificationDismissed, setVerificationDismissed] = useState(false)
  const [propertyVerificationDismissed, setPropertyVerificationDismissed] =
    useState(false)

  useEffect(() => {
    if (authLoading) return

    if (!profile || profile.role === 'admin') {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    const inspectionsRole = isLandlordAgent ? 'owner' : 'tenant'

    Promise.all([
      authedFetch(`/api/inspections?role=${inspectionsRole}`),
      fetchTotalUnreadCount(),
      authedFetch('/api/conversations'),
      isLandlordAgent ? null : authedFetch('/api/favorites'),
      isLandlordAgent ? null : authedFetch('/api/saved-searches'),
      isLandlordAgent ? authedFetch('/api/properties?mine=true&limit=100') : null,
      isLandlordAgent ? null : authedFetch('/api/tenancies/mine'),
    ]).then(
      ([
        inspectionsData,
        unread,
        conversationsData,
        favoritesData,
        savedSearchesData,
        propertiesData,
        tenanciesData,
      ]) => {
        if (cancelled) return

        setInspections(inspectionsData?.items || [])
        setUnreadCount(unread || 0)
        setHasConversations((conversationsData?.items?.length || 0) > 0)
        setRecentConversation(conversationsData?.items?.[0] || null)

        if (isLandlordAgent) {
          setProperties(propertiesData?.items || [])
        } else {
          setFavoritesCount(favoritesData?.items?.length || 0)
          setSavedSearchesCount(
            Array.isArray(savedSearchesData) ? savedSearchesData.length : 0,
          )
          setCurrentTenancy(
            (tenanciesData?.items || []).find((t) => !t.ended_at) || null,
          )
        }
      },
    ).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [authLoading, profile, isLandlordAgent])

  if (authLoading || loading) {
    return <div className="page-loading">Loading...</div>
  }

  if (!profile || profile.role === 'admin') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Not available</h1>
          <p>
            {profile?.role === 'admin'
              ? 'Admins use the admin dashboard instead.'
              : 'Please log in to view your home page.'}
          </p>
        </div>
      </div>
    )
  }

  const needsVerification = !profile.phone_verified || !profile.identity_verified
  const unverifiedProperties = properties.filter((p) => !p.ownership_verified)

  const upcomingInspections = inspections
    .filter((i) => TENANT_UPCOMING_STATUSES.includes(i.status))
    .slice(0, 3)
  const pendingInspectionRequests = inspections
    .filter((i) => i.status === 'requested')
    .slice(0, 3)

  return (
    <div className="home-page">
      <h1>Welcome back, {profile.full_name}</h1>

      {needsVerification && !verificationDismissed && (
        <div className="home-nudge">
          <p>
            Verify your phone and identity to build trust with{' '}
            {isLandlordAgent ? 'tenants' : 'landlords and agents'}.{' '}
            <Link to="/profile">Get verified</Link>
          </p>
          <button
            type="button"
            className="home-nudge-dismiss"
            aria-label="Dismiss"
            onClick={() => setVerificationDismissed(true)}
          >
            ×
          </button>
        </div>
      )}

      {isLandlordAgent &&
        unverifiedProperties.length > 0 &&
        !propertyVerificationDismissed && (
          <div className="home-nudge">
            <p>
              You have {unverifiedProperties.length}{' '}
              {unverifiedProperties.length === 1 ? 'property' : 'properties'}{' '}
              awaiting ownership verification.{' '}
              <Link to="/my-properties">Submit for verification</Link>
            </p>
            <button
              type="button"
              className="home-nudge-dismiss"
              aria-label="Dismiss"
              onClick={() => setPropertyVerificationDismissed(true)}
            >
              ×
            </button>
          </div>
        )}

      {!isLandlordAgent && currentTenancy && currentTenancy.property && (
        <Link
          to={`/properties/${currentTenancy.property.id}`}
          className="home-current-home-card"
        >
          {currentTenancy.property.first_image ? (
            <img
              src={currentTenancy.property.first_image}
              alt={currentTenancy.property.title}
              className="home-current-home-thumb"
            />
          ) : (
            <div className="home-current-home-thumb home-current-home-thumb-empty">
              No photo
            </div>
          )}
          <div className="home-current-home-info">
            <span className="home-current-home-label">Your current home</span>
            <span className="home-current-home-title">
              {currentTenancy.property.title}
            </span>
            <span className="home-current-home-meta">
              {currentTenancy.property.neighborhood?.name},{' '}
              {currentTenancy.property.ward?.lga?.name}
            </span>
            <span className="home-current-home-meta">
              Landlord: {currentTenancy.landlord_name || 'Unknown'}
            </span>
            <span className="home-current-home-meta">
              Since {formatSinceDate(currentTenancy.started_at)}
            </span>
          </div>
        </Link>
      )}

      <div className="home-cards-grid">
        {isLandlordAgent ? (
          properties.length === 0 ? (
            <div className="home-card">
              <h2>List your first property</h2>
              <p className="home-card-empty">
                You haven't listed any properties yet — get started to reach
                real tenants.
              </p>
              <Link to="/create-property" className="btn-link">
                List a property
              </Link>
            </div>
          ) : (
            <div className="home-card">
              <h2>Your properties</h2>
              <div className="home-stat-rows">
                {PROPERTY_STATUS_ROWS.map(({ key, label }) => (
                  <div className="home-stat-row" key={key}>
                    <span>{label}</span>
                    <span>
                      {properties.filter((p) => p.status === key).length}
                    </span>
                  </div>
                ))}
              </div>
              <Link to="/my-properties" className="btn-link">
                Manage properties
              </Link>
            </div>
          )
        ) : (
          <div className="home-card">
            <h2>Upcoming inspections</h2>
            {upcomingInspections.length === 0 ? (
              <>
                <p className="home-card-empty">No upcoming inspections</p>
                <Link to="/properties" className="btn-link">
                  Browse properties
                </Link>
              </>
            ) : (
              <>
                <div className="home-card-list">
                  {upcomingInspections.map((i) => (
                    <div className="home-card-list-item" key={i.id}>
                      <span>{i.property.title}</span>
                      <span className="home-card-list-meta">
                        {formatInspectionDate(i.requested_date)}
                      </span>
                    </div>
                  ))}
                </div>
                <Link to="/inspections/tenant" className="btn-link">
                  View all
                </Link>
              </>
            )}
          </div>
        )}

        {isLandlordAgent && (
          <div className="home-card">
            <h2>Pending inspection requests</h2>
            {pendingInspectionRequests.length === 0 ? (
              <p className="home-card-empty">No pending inspection requests</p>
            ) : (
              <>
                <div className="home-card-list">
                  {pendingInspectionRequests.map((i) => (
                    <div className="home-card-list-item" key={i.id}>
                      <span>{i.property.title}</span>
                      <span className="home-card-list-meta">
                        {formatInspectionDate(i.requested_date)}
                      </span>
                    </div>
                  ))}
                </div>
                <Link to="/inspections/owner" className="btn-link">
                  View all
                </Link>
              </>
            )}
          </div>
        )}

        <div className="home-card">
          <h2>Messages</h2>
          <p className="home-card-empty">
            {unreadCount > 0
              ? `${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`
              : 'No unread messages'}
          </p>
          {hasConversations && recentConversation && (
            <div className="home-card-list-item">
              <span>{recentConversation.property?.title}</span>
              <span className="home-card-list-meta">
                {recentConversation.last_message?.body || ''}
              </span>
            </div>
          )}
          {!hasConversations && (
            <p className="home-card-empty">No conversations yet.</p>
          )}
          <Link to="/messages" className="btn-link">
            View all
          </Link>
        </div>

        {!isLandlordAgent && (
          <div className="home-card">
            <h2>Saved</h2>
            <div className="home-stat-rows">
              <div className="home-stat-row">
                <span>Favorited properties</span>
                <span>{favoritesCount}</span>
              </div>
              <div className="home-stat-row">
                <span>Saved searches</span>
                <span>{savedSearchesCount}</span>
              </div>
            </div>
            <div className="home-card-links">
              <Link to="/saved-properties" className="btn-link">
                Saved properties
              </Link>
              <Link to="/saved-searches" className="btn-link">
                Saved searches
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
