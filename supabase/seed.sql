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
