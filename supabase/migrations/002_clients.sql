create table if not exists clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text,
  phone       text,
  notes       text,
  income      numeric,
  property_value    numeric,
  existing_mortgage numeric,
  renewal_date      date,
  credit_score      integer,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists clients_name_idx on clients (lower(name));
