create table conversations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) not null,
  tenant_id uuid references profiles(id) not null,
  owner_id uuid references profiles(id) not null,
  created_at timestamptz default now(),
  unique(property_id, tenant_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  sender_id uuid references profiles(id) not null,
  body text not null,
  created_at timestamptz default now(),
  read_at timestamptz
);  

create index idx_conversations_tenant on conversations(tenant_id);
create index idx_conversations_owner on conversations(owner_id);
create index idx_messages_conversation on messages(conversation_id);

alter table conversations enable row level security;
alter table messages enable row level security;

create policy "Members can view their own conversations" on conversations
  for select using (tenant_id = auth.uid() or owner_id = auth.uid());
create policy "Tenants can create conversations" on conversations
  for insert with check (tenant_id = auth.uid());

create policy "Members can view messages in their conversations" on messages
  for select using (
    exists (select 1 from conversations
            where conversations.id = conversation_id
            and (conversations.tenant_id = auth.uid() or conversations.owner_id = auth.uid()))
  );
create policy "Members can send messages in their conversations" on messages
  for insert with check (
    sender_id = auth.uid() and
    exists (select 1 from conversations
            where conversations.id = conversation_id
            and (conversations.tenant_id = auth.uid() or conversations.owner_id = auth.uid()))
  );

-- Enable realtime on messages
alter publication supabase_realtime add table messages;
