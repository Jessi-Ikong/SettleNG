export const STATUS_META = {
  draft: { label: 'Draft', className: 'status-draft' },
  available: { label: 'Available', className: 'status-available' },
  pending: { label: 'Pending', className: 'status-pending' },
  rented: { label: 'Rented', className: 'status-rented' },
  unavailable: { label: 'Unavailable', className: 'status-unavailable' },
  suspended: { label: 'Suspended', className: 'status-suspended' },
}

export function formatNaira(amount) {
  return `₦${Number(amount).toLocaleString('en-NG')}`
}
