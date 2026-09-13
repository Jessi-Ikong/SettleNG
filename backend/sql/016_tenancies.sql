create table tenancies (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) not null,
  tenant_id uuid references profiles(id) not null,
  landlord_id uuid references profiles(id) not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz default now()
);

create index idx_tenancies_property on tenancies(property_id);
create index idx_tenancies_tenant on tenancies(tenant_id);
create index idx_tenancies_landlord on tenancies(landlord_id);

alter table tenancies enable row level security;

create policy "Tenant or landlord can view their own tenancies" on tenancies
  for select using (tenant_id = auth.uid() or landlord_id = auth.uid());

-- No insert/update policy for regular users — tenancies are only ever
-- created/ended via the backend's service-role client, as part of the
-- existing property-status-change flow, never inserted directly by a
-- client request.
