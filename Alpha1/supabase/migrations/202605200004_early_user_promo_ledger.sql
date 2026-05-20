-- Promo grant audit event (must commit before use in ledger inserts)

do $$ begin
  alter type public.usage_event_type add value if not exists 'promo_grant';
exception
  when duplicate_object then null;
end $$;
