export const REPORT_REASONS = [
  { value: 'fake_property', label: 'Fake property' },
  { value: 'wrong_information', label: 'Wrong information' },
  { value: 'property_unavailable', label: 'Property unavailable' },
  { value: 'suspicious_payment_request', label: 'Suspicious payment request' },
  { value: 'fake_agent', label: 'Fake agent' },
  { value: 'misleading_images', label: 'Misleading images' },
  { value: 'duplicate_listing', label: 'Duplicate listing' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'other', label: 'Other' },
]

export const REPORT_REASON_LABELS = Object.fromEntries(
  REPORT_REASONS.map((r) => [r.value, r.label]),
)

export const REPORT_STATUS_META = {
  pending: { label: 'Pending', className: 'status-pending' },
  reviewed: { label: 'Reviewed', className: 'status-rented' },
  actioned: { label: 'Actioned', className: 'status-available' },
  dismissed: { label: 'Dismissed', className: 'status-unavailable' },
}

export function formatReportDate(dateString) {
  return new Date(dateString).toLocaleString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
