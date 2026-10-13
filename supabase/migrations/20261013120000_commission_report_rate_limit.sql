-- Rate-limit ledger for the send-commission-report edge function.
-- Service role only: RLS is enabled with NO policies, and anon/authenticated
-- have every privilege revoked. One row = one claimed send (claimed BEFORE the
-- email provider is called).

create table if not exists public.commission_report_sends (
  id         bigserial primary key,
  ip         text        not null,
  recipient  text        not null,
  created_at timestamptz not null default now()
);

alter table public.commission_report_sends enable row level security;

revoke all on table public.commission_report_sends from anon, authenticated;
revoke all on sequence public.commission_report_sends_id_seq from anon, authenticated;

grant select, insert on table public.commission_report_sends to service_role;
grant usage, select on sequence public.commission_report_sends_id_seq to service_role;

create index if not exists commission_report_sends_ip_created_at_idx
  on public.commission_report_sends (ip, created_at);

create index if not exists commission_report_sends_created_at_idx
  on public.commission_report_sends (created_at);

create index if not exists commission_report_sends_recipient_created_at_idx
  on public.commission_report_sends (recipient, created_at);

-- Atomic check-and-claim. A transaction-scoped advisory lock serializes
-- concurrent callers, so a burst of parallel requests cannot all read the same
-- count and all pass. Returns 'ok' (row inserted), or 'global_limit',
-- 'ip_limit' or 'recipient_limit' (nothing inserted). The recipient is
-- stored and compared lower-cased.
create or replace function public.claim_commission_report_send(
  p_ip              text,
  p_recipient       text,
  p_ip_limit        integer,
  p_recipient_limit integer,
  p_global_limit    integer
)
returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_since     timestamptz := now() - interval '1 hour';
  v_recipient text := lower(btrim(p_recipient));
  v_ip_count  integer;
  v_rcpt      integer;
  v_global    integer;
begin
  perform pg_advisory_xact_lock(hashtext('public.commission_report_sends'));

  select count(*) into v_global
    from public.commission_report_sends
   where created_at > v_since;
  if v_global >= p_global_limit then
    return 'global_limit';
  end if;

  select count(*) into v_ip_count
    from public.commission_report_sends
   where ip = p_ip
     and created_at > v_since;
  if v_ip_count >= p_ip_limit then
    return 'ip_limit';
  end if;

  select count(*) into v_rcpt
    from public.commission_report_sends
   where recipient = v_recipient
     and created_at > v_since;
  if v_rcpt >= p_recipient_limit then
    return 'recipient_limit';
  end if;

  insert into public.commission_report_sends (ip, recipient)
  values (p_ip, v_recipient);

  return 'ok';
end;
$$;

revoke all on function public.claim_commission_report_send(text, text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_commission_report_send(text, text, integer, integer, integer)
  to service_role;
