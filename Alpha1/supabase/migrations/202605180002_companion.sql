create table if not exists public.user_companions (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  pokemon_id integer not null,
  pokemon_name text not null,
  pokemon_slug text not null,
  pokemon_tier text not null default 'starter',
  pokemon_era text not null default '',
  hatched_at timestamptz not null default now(),
  level integer not null default 1,
  xp integer not null default 0,
  hunger integer not null default 80,
  energy integer not null default 85,
  mood integer not null default 75,
  last_tick_at timestamptz not null default now(),
  action_cooldowns jsonb not null default '{}'::jsonb,
  task_progress jsonb not null default '{}'::jsonb,
  task_claimed jsonb not null default '{}'::jsonb,
  lifetime_stats jsonb not null default '{}'::jsonb,
  usage_scans_this_week integer not null default 0,
  usage_week_key date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_companions_level_positive check (level >= 1),
  constraint user_companions_stats_range check (
    hunger between 0 and 100 and energy between 0 and 100 and mood between 0 and 100
  )
);

create index if not exists user_companions_hatched_idx on public.user_companions(hatched_at desc);

drop trigger if exists user_companions_touch_updated_at on public.user_companions;
create trigger user_companions_touch_updated_at
before update on public.user_companions
for each row execute function public.touch_updated_at();

alter table public.user_companions enable row level security;
