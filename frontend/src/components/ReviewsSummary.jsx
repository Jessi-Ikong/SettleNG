import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../lib/api'

export default function ReviewsSummary({ userId }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    fetch(`${API_BASE_URL}/api/reviews/user/${userId}`)
      .then((res) => res.json())
      .then((data) => setSummary(data.summary))
      .finally(() => setLoading(false))
  }, [userId])

  if (loading || !summary) return null

  if (summary.count === 0) {
    return <p className="reviews-summary reviews-summary-empty">No reviews yet</p>
  }

  return (
    <p className="reviews-summary">
      {summary.overall_average.toFixed(1)} ⭐ ({summary.count} review
      {summary.count === 1 ? '' : 's'})
    </p>
  )
}
