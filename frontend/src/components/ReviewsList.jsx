import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../lib/api'
import StarRating from './StarRating'

const CATEGORIES = [
  { key: 'communication_rating', label: 'Communication' },
  { key: 'professionalism_rating', label: 'Professionalism' },
  { key: 'honesty_rating', label: 'Honesty' },
  { key: 'inspection_experience_rating', label: 'Inspection experience' },
]

function formatReviewDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function ReviewsList({ userId }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    fetch(`${API_BASE_URL}/api/reviews/user/${userId}`)
      .then((res) => res.json())
      .then((data) => setItems(data.items || []))
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) return null

  if (items.length === 0) {
    return <p className="inspection-empty">No reviews yet.</p>
  }

  return (
    <div className="reviews-list">
      {items.map((review) => (
        <div key={review.id} className="review-card">
          <div className="review-card-header">
            <span className="review-card-reviewer">{review.reviewer_name}</span>
            <span className="review-card-date">
              {formatReviewDate(review.created_at)}
            </span>
          </div>
          <p className="review-card-property">{review.property_title}</p>

          <div className="review-card-categories">
            {CATEGORIES.map((c) => (
              <div className="review-card-category-row" key={c.key}>
                <span>{c.label}</span>
                <StarRating value={review[c.key]} label={c.label} />
              </div>
            ))}
          </div>

          {review.comment && (
            <p className="review-card-comment">"{review.comment}"</p>
          )}
        </div>
      ))}
    </div>
  )
}
