// A real styled confirmation modal, not window.confirm() — used
// wherever an action needs a deliberate, unambiguous "yes" before
// something hard to undo happens. Deliberately has no backdrop-click
// or Escape dismissal: those would act as a silent "cancel" a user
// could trigger by accident, which is exactly the ambiguity this
// component exists to avoid. The only two ways out are the two
// buttons below.
export default function ConfirmDialog({
  message,
  confirmLabel = 'Continue',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) {
  return (
    <div className="confirm-dialog-overlay">
      <div
        className="confirm-dialog-card"
        role="alertdialog"
        aria-modal="true"
        aria-describedby="confirm-dialog-message"
      >
        <p id="confirm-dialog-message" className="confirm-dialog-message">
          {message}
        </p>
        <div className="confirm-dialog-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
