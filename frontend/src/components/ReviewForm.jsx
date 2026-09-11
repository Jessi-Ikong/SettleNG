import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { API_BASE_URL } from '../lib/api'
import StarRating from './StarRating'

const CATEGORIES = [
  { key: 'communication_rating', label: 'Communication' },
  { key: 'professionalism_rating', label: 'Professionalism' },
  { key: 'honesty_rating', label: 'Honesty' },
  { key: 'inspection_experience_rating', label: 'Inspection experience' },
]

export default function ReviewForm({ inspectionId, onSubmitted }) {
  const [ratings, setRatings] = useState({
    communication_rating: 0,
    professionalism_rating: 0,
    honesty_rating: 0,
    inspection_experience_rating: 0,
  })
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const setRating = (key, value) => {
    setRatings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const missing = CATEGORIES.find((c) => !ratings[c.key])
    if (missing) {
      setError(`Please rate ${missing.label.toLowerCase()}.`)
      return
    }

    setSubmitting(true)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(`${API_BASE_URL}/api/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        inspection_id: inspectionId,
        ...ratings,
        comment: comment.trim() || null,
      }),
    })

    const body = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setError(body.error || 'Failed to submit review')
      return
    }

    setSubmitted(true)
    onSubmitted?.(body)
  }

  if (submitted) {
    return (
      <div className="review-confirmation">
        Thank you for your review!
      </div>
    )
  }

  return (
    <form className="review-form" onSubmit={handleSubmit}>
      {error && <div className="form-error">{error}</div>}

      {CATEGORIES.map((c) => (
        <div className="form-field review-form-rating-row" key={c.key}>
          <label>{c.label}</label>
          <StarRating
            value={ratings[c.key]}
            onChange={(n) => setRating(c.key, n)}
            label={c.label}
          />
        </div>
      ))}

      <div className="form-field">
        <label htmlFor="review-comment">Comment (optional)</label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
        />
      </div>

      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? 'Submitting...' : 'Submit review'}
      </button>
    </form>
  )
}
