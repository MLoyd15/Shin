-- Development/demo data only. Production ticker data is managed separately.
-- The application only reads from public.tickers; it never writes to this table.
insert into public.tickers (symbol, name, sector, industry, currency, exchange)
values
  ('AAPL', 'Apple Inc.', 'Information Technology', 'Technology Hardware', 'USD', 'NASDAQ'),
  ('MSFT', 'Microsoft Corporation', 'Information Technology', 'Software', 'USD', 'NASDAQ'),
  ('NVDA', 'NVIDIA Corporation', 'Information Technology', 'Semiconductors', 'USD', 'NASDAQ'),
  ('KO', 'The Coca-Cola Company', 'Consumer Staples', 'Beverages', 'USD', 'NYSE'),
  ('XOM', 'Exxon Mobil Corporation', 'Energy', 'Oil, Gas & Consumable Fuels', 'USD', 'NYSE')
on conflict (symbol) do nothing;

-- Synthetic development/demo prices only; these are not live market quotes.
insert into public.price_cache (ticker, date, close, adj_close, volume)
values
  ('AAPL', '2026-11-19', 269.35, 269.35, 48200100),
  ('AAPL', '2026-11-20', 271.10, 271.10, 45100200),
  ('MSFT', '2026-11-19', 512.40, 512.40, 22100500),
  ('MSFT', '2026-11-20', 515.75, 515.75, 20400300),
  ('NVDA', '2026-11-19', 198.20, 198.20, 126500000),
  ('NVDA', '2026-11-20', 201.65, 201.65, 118400000),
  ('KO', '2026-11-19', 72.15, 72.15, 13000200),
  ('KO', '2026-11-20', 72.48, 72.48, 12500100),
  ('XOM', '2026-11-19', 124.70, 124.70, 14300300),
  ('XOM', '2026-11-20', 125.25, 125.25, 13700400)
on conflict (ticker, date) do update
set close = excluded.close,
    adj_close = excluded.adj_close,
    volume = excluded.volume,
    fetched_at = now();
