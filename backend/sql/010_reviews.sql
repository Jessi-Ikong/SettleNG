create table reviews (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid references inspections(id) not null unique,
  reviewer_id uuid references profiles(id) not null,
  reviewee_id uuid references profiles(id) not null,
  property_id uuid references properties(id) not null,
  communication_rating smallint not null check (communication_rating between 1 and 5),
  professionalism_rating smallint not null check (professionalism_rating between 1 and 5),
  honesty_rating smallint not null check (honesty_rating between 1 and 5),
  inspection_experience_rating smallint not null check (inspection_experience_rating between 1 and 5),
  comment text,
  created_at timestamptz default now()
);

create index idx_reviews_reviewee on reviews(reviewee_id);

alter table reviews enable row level security;

create policy "Anyone can read reviews" on reviews
  for select using (true);
create policy "Reviewer can create their own review" on reviews
  for insert with check (reviewer_id = auth.uid());

-- unique(inspection_id) above already guarantees one review per
-- inspection at the database level, not just in application code
