create type inspection_status as enum (
  'requested','accepted','rejected','rescheduled','cancelled',
  'completed','no_show'
);

create table inspections (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) not null,
  tenant_id uuid references profiles(id) not null,
  owner_id uuid references profiles(id) not null,
  status inspection_status not null default 'requested',
  requested_date date not null,
  requested_time text not null,
  note text,
  owner_response_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_inspections_property on inspections(property_id);
create index idx_inspections_tenant on inspections(tenant_id);
create index idx_inspections_owner on inspections(owner_id);

alter table inspections enable row level security;

create policy "Tenant or owner can view their own inspections" on inspections
  for select using (tenant_id = auth.uid() or owner_id = auth.uid());
create policy "Tenants can request inspections" on inspections
  for insert with check (tenant_id = auth.uid());
create policy "Tenant or owner can update their own inspections" on inspections
  for update using (tenant_id = auth.uid() or owner_id = auth.uid());
