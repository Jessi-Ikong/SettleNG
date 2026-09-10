create table states (
  id serial primary key,
  name text not null unique,
  active boolean not null default false
);

create table lgas (
  id serial primary key,
  state_id integer references states(id) on delete cascade not null,
  name text not null
);

create table wards (
  id serial primary key,
  lga_id integer references lgas(id) on delete cascade not null,
  name text not null,
  latitude numeric,
  longitude numeric
);

create index idx_lgas_state_id on lgas(state_id);
create index idx_wards_lga_id on wards(lga_id);

alter table states enable row level security;
alter table lgas enable row level security;
alter table wards enable row level security;

-- These are public reference data, readable by anyone (including
-- logged-out users browsing the search page)
create policy "Anyone can read states" on states for select using (true);
create policy "Anyone can read lgas" on lgas for select using (true);
create policy "Anyone can read wards" on wards for select using (true);

-- Set Lagos active once seeded:
-- update states set active = true where name = 'Lagos';
