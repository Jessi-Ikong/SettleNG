create type property_type as enum (
  'self_contained','room_and_parlour','1_bedroom','2_bedroom',
  '3_bedroom','4plus_bedroom','duplex','bungalow','detached_house',
  'semi_detached_house','shared_accommodation','studio',
  'serviced_apartment','other'
);

create type furnished_status as enum ('furnished','unfurnished','partly_furnished');

create type property_status as enum (
  'draft','available','pending','rented','unavailable','suspended'
);

create table neighborhoods (
  id serial primary key,
  ward_id integer references wards(id) not null,
  name text not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique(ward_id, name)
);

create table properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) not null,
  title text not null,
  description text,
  property_type property_type not null,
  bedrooms integer,
  bathrooms integer,
  toilets integer,
  furnished furnished_status,
  amenities text[] default '{}',
  ward_id integer references wards(id) not null,
  neighborhood_id integer references neighborhoods(id) not null,
  street text,
  rent_amount numeric,
  agency_fee numeric,
  agreement_fee numeric,
  caution_fee numeric,
  service_charge numeric,
  other_fee numeric,
  status property_status not null default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table property_images (
  id serial primary key,
  property_id uuid references properties(id) on delete cascade not null,
  url text not null,
  sort_order integer default 0
);

create index idx_properties_owner on properties(owner_id);
create index idx_properties_ward on properties(ward_id);
create index idx_properties_status on properties(status);

alter table neighborhoods enable row level security;
alter table properties enable row level security;
alter table property_images enable row level security;

create policy "Anyone can read neighborhoods" on neighborhoods for select using (true);
create policy "Landlords/agents can add neighborhoods" on neighborhoods
  for insert with check (auth.uid() is not null);

create policy "Anyone can read available properties" on properties
  for select using (status = 'available' or owner_id = auth.uid());
create policy "Owners can insert their own properties" on properties
  for insert with check (owner_id = auth.uid());
create policy "Owners can update their own properties" on properties
  for update using (owner_id = auth.uid());

create policy "Anyone can read images of visible properties" on property_images
  for select using (true);
create policy "Owners can manage images of their own properties" on property_images
  for all using (
    exists (select 1 from properties where properties.id = property_id and properties.owner_id = auth.uid())
  );
