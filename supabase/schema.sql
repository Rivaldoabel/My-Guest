-- MY GUEST: esquema inicial para Supabase/PostgreSQL
-- Execute este ficheiro no SQL Editor do seu projecto Supabase.

create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  event_date date,
  event_time time,
  venue text,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 180),
  phone text,
  token uuid not null unique default gen_random_uuid(),
  checked_in_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists guests_event_id_idx on public.guests(event_id);
create index if not exists guests_token_idx on public.guests(token);

alter table public.events enable row level security;
alter table public.guests enable row level security;

create policy "Owners can manage their events"
on public.events for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Owners can manage guests in their events"
on public.guests for all
to authenticated
using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()))
with check (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()));

-- Validação atómica: duas leituras concorrentes não conseguem consumir o mesmo convite.
create or replace function public.validate_guest_entry(p_event_id uuid, p_token text)
returns table(status text, message text, guest_name text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_guest public.guests%rowtype;
begin
  if auth.uid() is null then
    return query select 'error', 'Sessão não autenticada.', null::text;
    return;
  end if;

  select g.* into v_guest
  from public.guests g
  join public.events e on e.id = g.event_id
  where g.event_id = p_event_id
    and g.token::text = p_token
    and e.owner_id = auth.uid()
  for update of g;

  if not found then
    return query select 'error', 'Convite inválido ou não pertence a este evento.', null::text;
    return;
  end if;

  if v_guest.checked_in_at is not null then
    return query select 'used', 'Este convite já foi utilizado.', v_guest.full_name;
    return;
  end if;

  update public.guests
  set checked_in_at = now()
  where id = v_guest.id and checked_in_at is null;

  return query select 'valid', 'Entrada autorizada.', v_guest.full_name;
end;
$$;

grant execute on function public.validate_guest_entry(uuid, text) to authenticated;

-- Contagem de convidados para o painel (opcional, não expõe dados de outros utilizadores).
create or replace view public.event_guest_counts
with (security_invoker = true) as
select e.id as event_id, count(g.id)::integer as guest_count
from public.events e
left join public.guests g on g.event_id = e.id
group by e.id;
