export const INSPECTION_STATUS_META = {
  requested: { label: 'Requested', className: 'status-pending' },
  accepted: { label: 'Accepted', className: 'status-available' },
  rescheduled: { label: 'Rescheduled', className: 'status-rented' },
  rejected: { label: 'Rejected', className: 'status-unavailable' },
  cancelled: { label: 'Cancelled', className: 'status-unavailable' },
  completed: { label: 'Completed', className: 'status-draft' },
  no_show: { label: 'No-show', className: 'status-unavailable' },
}

export function formatInspectionDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
