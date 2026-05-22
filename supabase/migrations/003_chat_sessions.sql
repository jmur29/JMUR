create table if not exists chat_sessions (
  id          text primary key,
  messages    jsonb not null default '[]',
  updated_at  timestamptz default now()
);
