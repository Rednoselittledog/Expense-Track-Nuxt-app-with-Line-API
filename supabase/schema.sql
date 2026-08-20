create extension if not exists "pgcrypto";

create table profiles (
  id uuid primary key default gen_random_uuid(),
  line_user_id text unique,
  locale text not null default 'th' check (locale in ('th', 'en')),
  cycle_start_day int not null default 1 check (cycle_start_day between 1 and 28),
  description_vocabulary text not null default '',
  description_vocabulary_updated_at timestamptz,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  parent_id uuid references categories(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index categories_major_uniq
  on categories (profile_id, name) where parent_id is null;
create unique index categories_sub_uniq
  on categories (profile_id, parent_id, name) where parent_id is not null;

create table transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  type text not null default 'expense' check (type in ('expense', 'income')),
  is_transfer boolean not null default false,
  amount numeric(12,2) not null check (amount > 0),
  description text not null,
  raw_text text,
  occurred_on date not null default current_date,
  source text not null default 'web' check (source in ('web','line')),
  created_at timestamptz not null default now()
);
create index transactions_profile_occurred_idx on transactions (profile_id, occurred_on);

create table transaction_allocations (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  fund text not null default 'daily' check (fund in ('daily','fixed','savings')),
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create table budget_rates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  fund text not null default 'daily' check (fund in ('daily','fixed')),
  monthly_amount numeric(12,2) not null check (monthly_amount >= 0),
  effective_from date not null default current_date,
  created_at timestamptz not null default now()
);
create index budget_rates_profile_effective_idx on budget_rates (profile_id, effective_from desc);