begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(5);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000001', 'folio-a@example.invalid'),
  ('00000000-0000-4000-8000-000000000002', 'folio-b@example.invalid');

insert into public.tickers (symbol, name, currency)
values ('RLS', 'RLS test ticker', 'USD');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';

insert into public.holdings (user_id, ticker, shares, avg_cost)
values ('00000000-0000-4000-8000-000000000001', 'RLS', 2, 10);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';

insert into public.holdings (user_id, ticker, shares, avg_cost)
values ('00000000-0000-4000-8000-000000000002', 'RLS', 3, 20);

select extensions.is(
  (select count(*) from public.holdings),
  1::bigint,
  'User B sees only their own holding'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';

select extensions.is(
  (with changed as (
    update public.holdings
    set shares = 99
    where user_id = '00000000-0000-4000-8000-000000000002'
    returning 1
  ) select count(*) from changed),
  0::bigint,
  'User A cannot update User B holdings'
);

select extensions.is(
  (with removed as (
    delete from public.holdings
    where user_id = '00000000-0000-4000-8000-000000000002'
    returning 1
  ) select count(*) from removed),
  0::bigint,
  'User A cannot delete User B holdings'
);

reset role;

select extensions.is(
  (select shares from public.holdings where user_id = '00000000-0000-4000-8000-000000000002'),
  3::numeric,
  'User B holding remains unchanged after User A update and delete attempts'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';

select extensions.is(
  (select count(*) from public.holdings),
  1::bigint,
  'User A sees their own holding'
);

reset role;
select * from extensions.finish();
rollback;
