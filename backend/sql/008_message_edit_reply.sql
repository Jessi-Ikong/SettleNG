alter table messages
  add column reply_to_id uuid references messages(id),
  add column edited_at timestamptz,
  add column original_body text,
  add column deleted_at timestamptz,
  add column deleted_body text;
  
-- original_body is only ever set once, on the FIRST edit, preserving
-- the message as it was originally sent. deleted_body preserves the
-- final content at time of deletion. Neither is ever exposed through
-- the normal API response to end users — they exist purely for
-- potential future admin/dispute access, per README's accountability
-- rules. Do not select or return these two columns from any
-- tenant/owner-facing route.
