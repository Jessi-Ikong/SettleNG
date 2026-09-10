create table favorites (
  id serial primary key,
  user_id uuid references profiles(id) not null,
  property_id uuid references properties(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, property_id)
);

create table saved_searches ( 
  id serial primary key,
  user_id uuid references profiles(id) not null,
  name text not null,
  filters jsonb not null,
  created_at timestamptz default now()
);

create index idx_favorites_user on favorites(user_id);
create index idx_saved_searches_user on saved_searches(user_id);

alter table favorites enable row level security;
alter table saved_searches enable row level security;

create policy "Users manage their own favorites" on favorites
  for all using (user_id = auth.uid());

create policy "Users manage their own saved searches" on saved_searches
  for all using (user_id = auth.uid());
