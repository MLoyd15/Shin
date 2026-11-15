create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  notify_channel text check (notify_channel is null or notify_channel in ('email', 'discord')),
  alert_thresholds jsonb check (
    alert_thresholds is null or jsonb_typeof(alert_thresholds) = 'object'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tickers (
  symbol text primary key check (symbol ~ '^[A-Z][A-Z0-9.-]{0,14}$'),
  name text not null check (length(trim(name)) > 0),
  sector text,
  industry text,
  currency char(3) not null default 'USD' check (currency = 'USD'),
  exchange text,
  last_validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.holdings (
  user_id uuid not null references auth.users (id) on delete cascade,
  ticker text not null references public.tickers (symbol) on update cascade on delete restrict,
  shares numeric(28, 12) not null check (shares > 0),
  avg_cost numeric(20, 8) not null check (avg_cost >= 0),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, ticker)
);

create index holdings_user_id_idx on public.holdings (user_id);
create index holdings_ticker_idx on public.holdings (ticker);

create table public.price_cache (
  ticker text not null references public.tickers (symbol) on update cascade on delete cascade,
  date date not null,
  close numeric(20, 8) not null check (close >= 0),
  adj_close numeric(20, 8) check (adj_close is null or adj_close >= 0),
  volume bigint check (volume is null or volume >= 0),
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (ticker, date)
);

create index price_cache_ticker_date_desc_idx
  on public.price_cache (ticker, date desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $body$
begin
  new.updated_at := now();
  return new;
end;
$body$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger tickers_set_updated_at
  before update on public.tickers
  for each row execute function public.set_updated_at();

create trigger holdings_set_updated_at
  before update on public.holdings
  for each row execute function public.set_updated_at();

create trigger price_cache_set_updated_at
  before update on public.price_cache
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.tickers enable row level security;
alter table public.holdings enable row level security;
alter table public.price_cache enable row level security;

revoke all on table public.profiles, public.tickers, public.holdings, public.price_cache
  from public, anon, authenticated;

grant select, insert, update, delete on table public.profiles, public.holdings to authenticated;
grant select on table public.tickers, public.price_cache to authenticated;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own profile"
  on public.profiles for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Authenticated users can read tickers"
  on public.tickers for select to authenticated
  using (true);

create policy "Users can read their own holdings"
  on public.holdings for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own holdings"
  on public.holdings for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own holdings"
  on public.holdings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own holdings"
  on public.holdings for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Authenticated users can read price cache"
  on public.price_cache for select to authenticated
  using (true);
