begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(32);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000001', 'folio-a@example.invalid'),
  ('00000000-0000-4000-8000-000000000002', 'folio-b@example.invalid');

insert into public.tickers (symbol, name, currency)
values
  ('RLS', 'RLS test ticker', 'USD'),
  ('RLS2', 'RLS test ticker 2', 'USD');

insert into public.price_cache (ticker, date, close)
values ('RLS', current_date, 10);

insert into public.profiles (user_id, notify_channel, alert_thresholds)
values ('00000000-0000-4000-8000-000000000001', 'email', '{"owner":"A"}');

insert into public.holdings (user_id, ticker, shares, avg_cost)
values
  ('00000000-0000-4000-8000-000000000001', 'RLS', 2, 10),
  ('00000000-0000-4000-8000-000000000002', 'RLS', 3, 20);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';

select extensions.is(
  (select count(*) from public.profiles where user_id = '00000000-0000-4000-8000-000000000001'),
  1::bigint,
  'User A can read their own profile'
);

select extensions.throws_ok(
  $$insert into public.profiles (user_id, notify_channel)
    values ('00000000-0000-4000-8000-000000000002', 'email')$$,
  '42501',
  null,
  'User A cannot insert a profile owned by User B'
);

reset role;
insert into public.profiles (user_id, notify_channel, alert_thresholds)
values ('00000000-0000-4000-8000-000000000002', 'email', '{"owner":"B"}');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';

select extensions.is(
  (select count(*) from public.profiles where user_id = '00000000-0000-4000-8000-000000000002'),
  0::bigint,
  'User A cannot read User B profile'
);

select extensions.is(
  (select count(*) from public.holdings where user_id = '00000000-0000-4000-8000-000000000001'),
  1::bigint,
  'User A can read their own holding'
);

select extensions.is(
  (select count(*) from public.holdings where user_id = '00000000-0000-4000-8000-000000000002'),
  0::bigint,
  'User A cannot read User B holdings'
);

select extensions.is(
  (with changed as (
    update public.profiles
    set alert_thresholds = '{"owner":"changed"}'
    where user_id = '00000000-0000-4000-8000-000000000002'
    returning 1
  ) select count(*) from changed),
  0::bigint,
  'User A cannot update User B profile'
);

select extensions.is(
  (with changed as (
    update public.holdings
    set shares = 99
    where user_id = '00000000-0000-4000-8000-000000000002'
    returning 1
  ) select count(*) from changed),
  0::bigint,
  'User A cannot update User B holding'
);

select extensions.is(
  (with removed as (
    delete from public.profiles
    where user_id = '00000000-0000-4000-8000-000000000002'
    returning 1
  ) select count(*) from removed),
  0::bigint,
  'User A cannot delete User B profile'
);

select extensions.is(
  (with removed as (
    delete from public.holdings
    where user_id = '00000000-0000-4000-8000-000000000002'
    returning 1
  ) select count(*) from removed),
  0::bigint,
  'User A cannot delete User B holding'
);

select extensions.throws_ok(
  $$insert into public.holdings (user_id, ticker, shares, avg_cost)
    values ('00000000-0000-4000-8000-000000000002', 'RLS2', 1, 10)$$,
  '42501',
  null,
  'User A cannot insert a holding owned by User B'
);

select extensions.throws_ok(
  $$update public.profiles
    set user_id = '00000000-0000-4000-8000-000000000002'
    where user_id = '00000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'User A cannot change their profile owner to User B'
);

select extensions.throws_ok(
  $$update public.holdings
    set user_id = '00000000-0000-4000-8000-000000000002'
    where user_id = '00000000-0000-4000-8000-000000000001' and ticker = 'RLS'$$,
  '42501',
  null,
  'User A cannot change their holding owner to User B'
);

reset role;

select extensions.is(
  (select alert_thresholds ->> 'owner' from public.profiles where user_id = '00000000-0000-4000-8000-000000000001'),
  'A',
  'User A profile remains unchanged after ownership attempts'
);

select extensions.is(
  (select shares from public.holdings where user_id = '00000000-0000-4000-8000-000000000001' and ticker = 'RLS'),
  2::numeric,
  'User A holding remains unchanged after ownership attempts'
);

select extensions.is(
  (select alert_thresholds ->> 'owner' from public.profiles where user_id = '00000000-0000-4000-8000-000000000002'),
  'B',
  'User B profile remains unchanged after User A attempts'
);

select extensions.is(
  (select shares from public.holdings where user_id = '00000000-0000-4000-8000-000000000002' and ticker = 'RLS'),
  3::numeric,
  'User B holding remains unchanged after User A attempts'
);

set local role anon;
set local request.jwt.claim.sub = '';
set local request.jwt.claims = '{"role":"anon"}';

select extensions.throws_ok(
  $$select * from public.profiles where user_id = '00000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'Anonymous users cannot read profiles'
);
select extensions.throws_ok(
  $$insert into public.profiles (user_id, notify_channel)
    values ('00000000-0000-4000-8000-000000000001', 'email')$$,
  '42501', null, 'Anonymous users cannot insert profiles'
);
select extensions.throws_ok(
  $$update public.profiles set alert_thresholds = '{}'$$,
  '42501', null, 'Anonymous users cannot update profiles'
);
select extensions.throws_ok(
  $$delete from public.profiles$$,
  '42501', null, 'Anonymous users cannot delete profiles'
);
select extensions.throws_ok(
  $$select * from public.holdings where user_id = '00000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'Anonymous users cannot read holdings'
);
select extensions.throws_ok(
  $$insert into public.holdings (user_id, ticker, shares, avg_cost)
    values ('00000000-0000-4000-8000-000000000001', 'RLS2', 1, 10)$$,
  '42501', null, 'Anonymous users cannot insert holdings'
);
select extensions.throws_ok(
  $$update public.holdings set shares = 99$$,
  '42501', null, 'Anonymous users cannot update holdings'
);
select extensions.throws_ok(
  $$delete from public.holdings$$,
  '42501', null, 'Anonymous users cannot delete holdings'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';

select extensions.is(
  (select count(*) from public.tickers where symbol = 'RLS'),
  1::bigint,
  'Authenticated users can read shared tickers'
);
select extensions.throws_ok(
  $$insert into public.tickers (symbol, name) values ('WRITE', 'Write attempt')$$,
  '42501', null, 'Authenticated users cannot insert shared tickers'
);
select extensions.throws_ok(
  $$update public.tickers set name = 'Write attempt' where symbol = 'RLS'$$,
  '42501', null, 'Authenticated users cannot update shared tickers'
);
select extensions.throws_ok(
  $$delete from public.tickers where symbol = 'RLS'$$,
  '42501', null, 'Authenticated users cannot delete shared tickers'
);

select extensions.is(
  (select count(*) from public.price_cache where ticker = 'RLS' and date = current_date),
  1::bigint,
  'Authenticated users can read shared price cache'
);
select extensions.throws_ok(
  $$insert into public.price_cache (ticker, date, close)
    values ('RLS', current_date + 1, 11)$$,
  '42501', null, 'Authenticated users cannot insert shared prices'
);
select extensions.throws_ok(
  $$update public.price_cache set close = 11 where ticker = 'RLS' and date = current_date$$,
  '42501', null, 'Authenticated users cannot update shared prices'
);
select extensions.throws_ok(
  $$delete from public.price_cache where ticker = 'RLS' and date = current_date$$,
  '42501', null, 'Authenticated users cannot delete shared prices'
);

reset role;
select * from extensions.finish();
rollback;
