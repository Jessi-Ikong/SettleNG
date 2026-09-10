import { Link } from 'react-router-dom'
import LocationPicker from '../components/LocationPicker'

export default function Landing() {
  return (
    <main className="placeholder-screen">
      <h1 className="wordmark">
        <span className="wordmark-settle">Settle</span>
        <span className="wordmark-ng">NG</span>
      </h1>
      <p className="tagline">Find a place, verified before you move.</p>
      <div className="auth-switch">
        <Link to="/login">Log in</Link> · <Link to="/register">Register</Link>
      </div>

      {/* Temporary: LocationPicker isn't wired into search/property
          creation yet, so it's previewed here until Phase 3. */}
      <LocationPicker
        onChange={(selection) => console.log('LocationPicker:', selection)}
      />
    </main>
  )
}
