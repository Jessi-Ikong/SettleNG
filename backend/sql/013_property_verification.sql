create type property_verification_status as enum ('pending','approved','rejected');

create table property_verifications (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) not null,
  submitted_by uuid references profiles(id) not null,
  document_url text not null,
  status property_verification_status not null default 'pending',
  admin_notes text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

create index idx_property_verifications_property on property_verifications(property_id);
create index idx_property_verifications_status on property_verifications(status);

alter table properties add column ownership_verified boolean not null default false;

alter table property_verifications enable row level security;

create policy "Owner can view their own property's verifications" on property_verifications
  for select using (submitted_by = auth.uid());
create policy "Owner can submit verification for their own property" on property_verifications
  for insert with check (
    submitted_by = auth.uid() and
    exists (select 1 from properties where properties.id = property_id and properties.owner_id = auth.uid())
  );
create policy "Admins can view all property verifications" on property_verifications
  for select using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );
create policy "Admins can update property verifications" on property_verifications
  for update using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );
