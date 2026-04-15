-- Multi-warehouse foundation for StockWise
-- Assumption: existing single-warehouse data should be backfilled to the latest non-null profiles.site_id.

create table if not exists public.sites (
  id text primary key,
  code text not null unique,
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_site_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id text not null references public.sites(id) on delete cascade,
  role text null,
  status text not null default 'active',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, site_id)
);

alter table public.sites enable row level security;
alter table public.user_site_access enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sites'
      and policyname = 'sites_public_read'
  ) then
    create policy sites_public_read
      on public.sites
      for select
      using (status = 'active');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_site_access'
      and policyname = 'user_site_access_self_read'
  ) then
    create policy user_site_access_self_read
      on public.user_site_access
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

alter table public.products add column if not exists site_id text;
alter table public.locations add column if not exists site_id text;
alter table public.stock add column if not exists site_id text;
alter table public.prices add column if not exists site_id text;
alter table public.import_logs add column if not exists site_id text;
alter table public.correction_log add column if not exists site_id text;

with default_site as (
  select coalesce(
    (
      select site_id
      from public.profiles
      where site_id is not null
      order by updated_at desc nulls last, created_at desc nulls last
      limit 1
    ),
    'SITE_1'
  ) as site_id
)
insert into public.sites (id, code, name)
select distinct p.site_id, p.site_id, p.site_id
from public.profiles p
where p.site_id is not null
on conflict (id) do update
set
  code = excluded.code,
  name = excluded.name,
  updated_at = now();

with default_site as (
  select coalesce(
    (
      select site_id
      from public.profiles
      where site_id is not null
      order by updated_at desc nulls last, created_at desc nulls last
      limit 1
    ),
    'SITE_1'
  ) as site_id
)
insert into public.sites (id, code, name)
select site_id, site_id, site_id
from default_site
on conflict (id) do nothing;

insert into public.user_site_access (user_id, site_id, role, status, is_default)
select
  p.user_id,
  p.site_id,
  p.role,
  'active',
  true
from public.profiles p
where p.user_id is not null
  and p.site_id is not null
on conflict (user_id, site_id) do update
set
  role = excluded.role,
  status = excluded.status,
  is_default = excluded.is_default,
  updated_at = now();

with default_site as (
  select coalesce(
    (
      select site_id
      from public.profiles
      where site_id is not null
      order by updated_at desc nulls last, created_at desc nulls last
      limit 1
    ),
    'SITE_1'
  ) as site_id
)
update public.products p
set site_id = ds.site_id
from default_site ds
where p.site_id is null;

with default_site as (
  select coalesce(
    (
      select site_id
      from public.profiles
      where site_id is not null
      order by updated_at desc nulls last, created_at desc nulls last
      limit 1
    ),
    'SITE_1'
  ) as site_id
)
update public.locations l
set site_id = ds.site_id
from default_site ds
where l.site_id is null;

update public.stock s
set site_id = coalesce(
  s.site_id,
  l.site_id,
  p.site_id
)
from public.locations l
left join public.products p on p.id = s.product_id
where s.location_id = l.id
  and s.site_id is null;

update public.prices pr
set site_id = coalesce(pr.site_id, p.site_id)
from public.products p
where pr.product_id = p.id
  and pr.site_id is null;

with default_site as (
  select coalesce(
    (
      select site_id
      from public.profiles
      where site_id is not null
      order by updated_at desc nulls last, created_at desc nulls last
      limit 1
    ),
    'SITE_1'
  ) as site_id
)
update public.import_logs il
set site_id = coalesce(
  il.site_id,
  p.site_id,
  ds.site_id
)
from default_site ds
left join public.profiles p on p.user_id = il.user_id
where il.site_id is null;

with entry_sites as (
  select id, site_id
  from public.entries
  where site_id is not null
)
update public.correction_log cl
set site_id = es.site_id
from entry_sites es
where cl.entry_id = es.id
  and cl.site_id is null;

create index if not exists products_site_id_idx on public.products (site_id);
create index if not exists locations_site_id_idx on public.locations (site_id);
create index if not exists stock_site_id_idx on public.stock (site_id);
create index if not exists prices_site_id_idx on public.prices (site_id);
create index if not exists import_logs_site_id_idx on public.import_logs (site_id);
create index if not exists correction_log_site_id_idx on public.correction_log (site_id);
create index if not exists user_site_access_user_idx on public.user_site_access (user_id);
create index if not exists user_site_access_site_idx on public.user_site_access (site_id);

create unique index if not exists products_site_sku_unique on public.products (site_id, sku);
create unique index if not exists locations_site_code_unique on public.locations (site_id, code);

-- If your database still has old global unique constraints for products.sku or locations.code,
-- remove them manually after verifying the new composite unique indexes above are present.
