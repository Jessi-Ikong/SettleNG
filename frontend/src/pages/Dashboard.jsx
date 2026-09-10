import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Welcome, {profile?.full_name || '...'}</h1>
        <p>
          Role: <strong>{profile?.role || '...'}</strong>
        </p>
        <button type="button" className="btn-primary" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </div>
  )
}
