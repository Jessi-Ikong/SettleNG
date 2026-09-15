import { useState } from 'react'
import useDocumentMeta from '../hooks/useDocumentMeta'

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'technical', label: 'Technical issue' },
  { value: 'report', label: 'Report a concern' },
  { value: 'business', label: 'Business inquiry' },
]

export default function Contact() {
  useDocumentMeta(
    'Contact us — SettleNG',
    'Get in touch with the SettleNG team — general questions, technical issues, concerns, or business inquiries.',
  )

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState('')
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (event) => {
    event.preventDefault()

    // PLACEHOLDER UI ONLY — there is no backend endpoint for this form
    // yet, and nothing here is sent anywhere. This just flips to a
    // client-side confirmation message. A real submission handler
    // (email delivery, or a stored inquiries table) is a follow-up
    // phase, not part of this one.
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="static-page">
        <div className="static-page-card">
          <h1>Thanks — we'll get back to you</h1>
          <p>
            We've received your message. In the meantime, you can also
            reach us directly at{' '}
            <a href="mailto:support@settleng.com">support@settleng.com</a>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="static-page">
      <div className="static-page-card">
        <h1>Contact us</h1>
        <p>
          Have a question, found a problem, or want to report a concern?
          Send us a message below, or email us directly at{' '}
          <a href="mailto:support@settleng.com">support@settleng.com</a>.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="contact-name">Name</label>
            <input
              id="contact-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="contact-email">Email</label>
            <input
              id="contact-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="contact-category">Category</label>
            <select
              id="contact-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">Select a category (optional)</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="contact-message">Message</label>
            <textarea
              id="contact-message"
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary">
            Send message
          </button>
        </form>
      </div>
    </div>
  )
}
