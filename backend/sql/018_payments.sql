create type payment_status as enum ('initialized', 'success', 'failed', 'abandoned');

create table payments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) not null,
  tenant_id uuid references profiles(id) not null,
  landlord_id uuid references profiles(id) not null,
  amount numeric not null,
  paystack_reference text not null unique,
  status payment_status not null default 'initialized',
  paid_at timestamptz,
  created_at timestamptz default now()
);

create table payment_events (
  id uuid primary key default gen_random_uuid(),
  paystack_reference text not null,
  event_type text not null,
  raw_payload jsonb not null,
  processed boolean not null default false,
  received_at timestamptz default now()
);

create index idx_payments_tenant on payments(tenant_id);
create index idx_payments_landlord on payments(landlord_id);
create index idx_payments_property on payments(property_id);
create index idx_payment_events_reference on payment_events(paystack_reference);

alter table payments enable row level security;
alter table payment_events enable row level security;

create policy "Tenant or landlord can view their own payments" on payments
  for select using (tenant_id = auth.uid() or landlord_id = auth.uid());

-- payment_events has no client-facing policy at all — it's written
-- and read exclusively by the backend's service-role client as part
-- of webhook processing, never queried directly by any user.
