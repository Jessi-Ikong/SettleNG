create type report_target_type as enum ('property', 'user');

create type report_reason as enum (
  'fake_property','wrong_information','property_unavailable',
  'suspicious_payment_request','fake_agent','misleading_images',
  'duplicate_listing','harassment','other'
);

create type report_status as enum ('pending','reviewed','actioned','dismissed');

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id) not null,
  target_type report_target_type not null,
  target_id uuid not null,
  reason report_reason not null,
  details text,
  status report_status not null default 'pending',
  admin_notes text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

create index idx_reports_status on reports(status);
create index idx_reports_target on reports(target_type, target_id);

alter table reports enable row level security;

create policy "Reporters can view their own reports" on reports
  for select using (reporter_id = auth.uid());
create policy "Anyone authenticated can file a report" on reports
  for insert with check (reporter_id = auth.uid());
create policy "Admins can view all reports" on reports
  for select using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );
create policy "Admins can update reports" on reports
  for update using (  
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );
