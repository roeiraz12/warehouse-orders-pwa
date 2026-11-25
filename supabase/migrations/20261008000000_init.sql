-- Order Management — initial schema.
-- Only the Edge Function (service role) reads/writes these tables.
-- RLS is enabled with NO policies, so the public anon key can read nothing.

create table public.orders (
  id                        text primary key,
  external_id               text unique,               -- Rivhit document number
  source                    text not null check (source in ('rivahit', 'manual')),
  client_name               text not null,
  supplier_name             text,
  created_at                timestamptz not null,
  delivery_deadline         timestamptz not null,
  business_days_to_deliver  int not null default 3,
  status                    text not null check (status in ('new', 'in_progress', 'ready_to_ship', 'shipped', 'cancelled')),
  notes                     text,
  completed_at              timestamptz,
  completed_by              text check (completed_by in ('manager', 'employee')),
  updated_at                timestamptz not null default now()
);
create index orders_status_idx on public.orders (status);
create index orders_completed_at_idx on public.orders (completed_at);

create table public.order_items (
  id                text primary key,
  order_id          text not null references public.orders (id) on delete cascade,
  position          int not null default 0,
  sku               text,
  name              text not null,
  quantity_ordered  numeric not null,
  unit              text,
  state             text not null default 'pending' check (state in ('pending', 'packed', 'missing')),
  quantity_missing  numeric,
  updated_at        timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id, position);

create table public.alerts (
  id            text primary key,
  order_id      text not null references public.orders (id) on delete cascade,
  item_id       text references public.order_items (id) on delete cascade,
  type          text not null check (type in ('missing_item', 'issue_report', 'deadline_near', 'overdue')),
  message       text not null,
  created_at    timestamptz not null default now(),
  created_by    text not null check (created_by in ('manager', 'employee')),
  acknowledged  boolean not null default false
);
create index alerts_open_idx on public.alerts (acknowledged) where not acknowledged;

create table public.activity_log (
  id        text primary key,
  order_id  text not null references public.orders (id) on delete cascade,
  action    text not null,
  role      text not null,
  details   text,
  at        timestamptz not null default now()
);
create index activity_log_order_idx on public.activity_log (order_id, at);

-- Single row: change counter (phones poll it) + health of the Rivhit import.
create table public.app_state (
  id                    int primary key default 1 check (id = 1),
  version               bigint not null default 0,
  last_sync_success_at  timestamptz,
  last_sync_error       text,
  last_sync_error_at    timestamptz
);
insert into public.app_state default values;

create function public.bump_version() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.app_state set version = version + 1 where id = 1;
  return null;
end $$;

create trigger orders_bump after insert or update or delete on public.orders
  for each statement execute function public.bump_version();
create trigger order_items_bump after insert or update or delete on public.order_items
  for each statement execute function public.bump_version();
create trigger alerts_bump after insert or update or delete on public.alerts
  for each statement execute function public.bump_version();

alter table public.orders       enable row level security;
alter table public.order_items  enable row level security;
alter table public.alerts       enable row level security;
alter table public.activity_log enable row level security;
alter table public.app_state    enable row level security;
