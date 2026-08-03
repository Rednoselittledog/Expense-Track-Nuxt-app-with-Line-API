-- TEMPORARY: no auth system exists yet (single-user, phase 1).
-- These policies allow full access to anyone holding the publishable key.
-- MUST be replaced with real per-user policies once auth is wired up —
-- do not deploy this app publicly with these policies still in place.

-- table-level grants (separate from RLS — dropping/recreating the public schema
-- wipes Supabase's default anon/authenticated grants, which RLS alone can't fix)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  profiles, categories, transactions, transaction_allocations, budget_rates
  to anon, authenticated;

alter table profiles enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table transaction_allocations enable row level security;
alter table budget_rates enable row level security;

drop policy if exists "temporary allow all" on profiles;
drop policy if exists "temporary allow all" on categories;
drop policy if exists "temporary allow all" on transactions;
drop policy if exists "temporary allow all" on transaction_allocations;
drop policy if exists "temporary allow all" on budget_rates;

create policy "temporary allow all" on profiles for all using (true) with check (true);
create policy "temporary allow all" on categories for all using (true) with check (true);
create policy "temporary allow all" on transactions for all using (true) with check (true);
create policy "temporary allow all" on transaction_allocations for all using (true) with check (true);
create policy "temporary allow all" on budget_rates for all using (true) with check (true);
