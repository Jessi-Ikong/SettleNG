import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="site-footer">
      <nav className="site-footer-links">
        <Link to="/about">About</Link>
        <Link to="/contact">Contact</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/privacy">Privacy</Link>
      </nav>
      <Link to="/" className="site-footer-wordmark">
        <span className="wordmark-settle">Settle</span>
        <span className="wordmark-ng">NG</span>
      </Link>
    </footer>
  )
}
