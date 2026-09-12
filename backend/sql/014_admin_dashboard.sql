alter table profiles add column suspended boolean not null default false;
alter table profiles add column suspended_reason text;
alter table profiles add column suspended_at timestamptz;

-- No RLS changes needed — admin already has full access via existing
-- policies, and profiles are only ever read/written through the
-- backend's service-role client for admin actions.
