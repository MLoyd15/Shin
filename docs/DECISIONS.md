# Decisions

- Use Supabase's local pgTAP suite for the two-user RLS integration test so policies run against PostgreSQL itself.
- Require Node 22.13 or newer because pnpm 11 and the current Supabase JavaScript client need that runtime.
- Dark mode uses the six specified chart colors; light mode darkens those hues so chart marks remain legible on white cards.
