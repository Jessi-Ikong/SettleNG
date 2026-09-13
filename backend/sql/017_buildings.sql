create table buildings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) not null,
  name text not null,
  description text,
  ward_id integer references wards(id) not null,
  neighborhood_id integer references neighborhoods(id) not null,
  street text,
  total_units integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table properties add column building_id uuid references buildings(id);
alter table properties add column unit_label text;

create index idx_buildings_owner on buildings(owner_id);
create index idx_properties_building on properties(building_id);

alter table buildings enable row level security;

create policy "Anyone can read buildings with at least one available unit"
  on buildings for select using (
    exists (select 1 from properties where properties.building_id = buildings.id
            and properties.status = 'available')
    or owner_id = auth.uid()
  );
create policy "Owners can insert their own buildings" on buildings
  for insert with check (owner_id = auth.uid());
create policy "Owners can update their own buildings" on buildings
  for update using (owner_id = auth.uid());

-- Add a database-level constraint: unit_label is required whenever
-- building_id is set, enforced so this can never be bypassed by a
-- future route that forgets to check it in application code:
alter table properties add constraint unit_label_required_with_building
  check (building_id is null or unit_label is not null);
