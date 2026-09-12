create table phone_otps (
  id serial primary key,
  user_id uuid references profiles(id) not null,
  code text not null,
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz default now()
);

create type identity_verification_status as enum ('pending','approved','rejected');

create table identity_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  document_url text not null,
  status identity_verification_status not null default 'pending',
  admin_notes text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

create index idx_phone_otps_user on phone_otps(user_id);
create index idx_identity_verifications_user on identity_verifications(user_id);
create index idx_identity_verifications_status on identity_verifications(status);

alter table profiles add column identity_verified boolean not null default false;

alter table phone_otps enable row level security;
alter table identity_verifications enable row level security;

create policy "Users manage their own OTPs" on phone_otps
  for all using (user_id = auth.uid());

create policy "Users can view/create their own identity verification" on identity_verifications
  for select using (user_id = auth.uid());
create policy "Users can submit their own identity verification" on identity_verifications
  for insert with check (user_id = auth.uid());
create policy "Admins can view all identity verifications" on identity_verifications
  for select using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );
create policy "Admins can update identity verifications" on identity_verifications
  for update using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );
