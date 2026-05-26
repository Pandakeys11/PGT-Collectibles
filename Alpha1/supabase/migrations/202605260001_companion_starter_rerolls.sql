alter table public.user_companions
  add column if not exists starter_rerolls_used integer not null default 0;

alter table public.user_companions
  drop constraint if exists user_companions_starter_rerolls_cap;

alter table public.user_companions
  add constraint user_companions_starter_rerolls_cap check (
    starter_rerolls_used >= 0 and starter_rerolls_used <= 3
  );
