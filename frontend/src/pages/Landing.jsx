import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/api'
import { fetchFavoritedIds } from '../lib/favoritesApi'
import PropertyCard from '../components/PropertyCard'

const TENANT_STEPS = [
  'Search by location',
  'Message and inspect',
  'Move in verified',
]

const LANDLORD_STEPS = [
  'List your property',
  'Get verified',
  'Connect with tenants',
]

export default function Landing() {
  const { user } = useAuth()
  const [listings, setListings] = useState([])
  const [listingsLoaded, setListingsLoaded] = useState(false)
  const [favoritedIds, setFavoritedIds] = useState(new Set())

  const listPropertyHref = user ? '/create-property' : '/register'

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/properties?limit=6&sort=newest`)
      .then((res) => res.json())
      .then((data) => setListings(data.items || []))
      .catch(() => setListings([]))
      .finally(() => setListingsLoaded(true))
  }, [])

  useEffect(() => {
    if (!user) {
      setFavoritedIds(new Set())
      return
    }
    fetchFavoritedIds().then(setFavoritedIds)
  }, [user])

  return (
    <main className="landing-page">
      <section className="landing-hero">
        <h1 className="wordmark">
          <span className="wordmark-settle">Settle</span>
          <span className="wordmark-ng">NG</span>
        </h1>
        <p className="tagline">Find a place, verified before you move.</p>

        <div className="landing-hero-ctas">
          <Link to="/properties" className="landing-cta landing-cta-primary">
            Find a place
          </Link>
          <Link to={listPropertyHref} className="landing-cta landing-cta-secondary">
            List a property
          </Link>
        </div>
      </section>

      {listingsLoaded && listings.length > 0 && (
        <section className="landing-section">
          <h2>Recently listed</h2>
          <div className="property-card-grid">
            {listings.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                favorited={favoritedIds.has(property.id)}
              />
            ))}
          </div>
          <div className="landing-browse-all">
            <Link to="/properties">Browse all properties</Link>
          </div>
        </section>
      )}

      <section className="landing-section how-it-works-columns">
        <div className="how-it-works-column">
          <h3>For tenants</h3>
          <ol className="how-it-works-steps">
            {TENANT_STEPS.map((step, i) => (
              <li className="how-it-works-step" key={step}>
                <span className="how-it-works-step-number">{i + 1}</span>
                <span className="how-it-works-step-label">{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="how-it-works-column">
          <h3>For landlords &amp; agents</h3>
          <ol className="how-it-works-steps">
            {LANDLORD_STEPS.map((step, i) => (
              <li className="how-it-works-step" key={step}>
                <span className="how-it-works-step-number">{i + 1}</span>
                <span className="how-it-works-step-label">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <p className="landing-trust-line">
        Verified landlords and agents. Real cost breakdowns. No hidden fees.
      </p>
    </main>
  )
}
