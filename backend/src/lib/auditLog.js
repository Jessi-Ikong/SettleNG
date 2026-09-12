export async function logAdminAction(
  supabaseServiceClient,
  { adminId, action, targetType, targetId, details },
) {
  const { error } = await supabaseServiceClient.from('admin_audit_log').insert({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId ? String(targetId) : null,
    details: details ?? null,
  })

  if (error) {
    // Auditing a successful action shouldn't fail the action itself —
    // log to the server console instead of throwing.
    console.error('Failed to write admin audit log entry:', error.message)
  }
}
