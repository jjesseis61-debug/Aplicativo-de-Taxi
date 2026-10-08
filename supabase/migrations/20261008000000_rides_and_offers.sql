-- Viagens e propostas de motoristas (modelo de preço negociado).
--
-- Regras garantidas pela base de dados, não pelo app:
--   * Uma viagem tem no máximo uma proposta aceite.
--   * O motorista e o preço atribuídos são SEMPRE os da proposta aceite.
--   * Aceitação manual e automática passam pela mesma função, com a linha da
--     viagem bloqueada (FOR UPDATE), por isso nunca há duas atribuições.
--   * Clientes só escrevem através das funções RPC abaixo (RLS sem políticas
--     de escrita).

create type public.ride_status as enum ('searching', 'driver_assigned', 'cancelled', 'expired');
create type public.offer_status as enum ('pending', 'accepted', 'rejected', 'expired');

-- drivers.id = auth.users.id do motorista.
create table public.drivers (
  id uuid primary key,
  name text not null,
  car text not null,
  plate text not null,
  verified boolean not null default false
);

create table public.rides (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null default auth.uid(),
  origin jsonb not null,
  destination jsonb not null,
  category text not null check (category in ('baza', 'cool', 'boss')),
  -- TODO: calcular o preço mínimo no servidor e validá-lo aqui.
  proposed_price integer not null check (proposed_price > 0),
  auto_accept boolean not null default false,
  status public.ride_status not null default 'searching',
  assigned_offer_id uuid,
  assigned_driver_id uuid references public.drivers (id),
  assigned_price integer,
  assigned_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 minutes',
  constraint assignment_complete check (
    (assigned_offer_id is null and assigned_driver_id is null and assigned_price is null and assigned_at is null)
    or (assigned_offer_id is not null and assigned_driver_id is not null and assigned_price is not null and assigned_at is not null)
  ),
  constraint assigned_when_driver_assigned check (status <> 'driver_assigned' or assigned_offer_id is not null)
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides (id) on delete cascade,
  driver_id uuid not null references public.drivers (id),
  price integer not null check (price > 0),
  eta_minutes integer not null check (eta_minutes >= 0),
  status public.offer_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index offers_ride_id_idx on public.offers (ride_id);
create unique index offers_one_accepted_per_ride on public.offers (ride_id) where status = 'accepted';

alter table public.rides
  add constraint rides_assigned_offer_fk foreign key (assigned_offer_id) references public.offers (id);

-- RLS: leitura do que é seu; escrita só via RPC (security definer).
alter table public.drivers enable row level security;
alter table public.rides enable row level security;
alter table public.offers enable row level security;

create policy "drivers visíveis para utilizadores autenticados" on public.drivers
  for select to authenticated using (true);

create policy "passageiro vê as suas viagens" on public.rides
  for select to authenticated using (passenger_id = auth.uid());

create policy "motorista vê viagens à procura ou atribuídas a si" on public.rides
  for select to authenticated using (status = 'searching' or assigned_driver_id = auth.uid());

create policy "passageiro vê propostas das suas viagens" on public.offers
  for select to authenticated
  using (exists (select 1 from public.rides r where r.id = ride_id and r.passenger_id = auth.uid()));

create policy "motorista vê as suas propostas" on public.offers
  for select to authenticated using (driver_id = auth.uid());

-- Marca a viagem como expirada se a janela de procura acabou. Chamar com a linha bloqueada.
create function public._expire_if_due(p_ride public.rides)
returns public.ride_status
language plpgsql
set search_path = ''
as $$
begin
  if p_ride.status = 'searching' and p_ride.expires_at <= now() then
    update public.rides set status = 'expired' where id = p_ride.id;
    update public.offers set status = 'expired' where ride_id = p_ride.id and status = 'pending';
    return 'expired';
  end if;
  return p_ride.status;
end;
$$;

-- Núcleo da aceitação. Pressupõe a linha da viagem já bloqueada pelo chamador.
create function public._assign_offer(p_ride_id uuid, p_offer_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_offer public.offers;
begin
  select * into v_offer from public.offers where id = p_offer_id and ride_id = p_ride_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'offer_not_found');
  end if;
  if v_offer.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'offer_not_pending');
  end if;

  update public.offers set status = 'accepted' where id = v_offer.id;
  update public.offers set status = 'expired' where ride_id = p_ride_id and status = 'pending';
  update public.rides
     set status = 'driver_assigned',
         assigned_offer_id = v_offer.id,
         assigned_driver_id = v_offer.driver_id,
         assigned_price = v_offer.price,
         assigned_at = now()
   where id = p_ride_id;

  return jsonb_build_object('ok', true, 'ride_id', p_ride_id, 'offer_id', v_offer.id);
end;
$$;

-- Passageiro aceita uma proposta.
create function public.accept_offer(p_ride_id uuid, p_offer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ride public.rides;
begin
  select * into v_ride from public.rides where id = p_ride_id and passenger_id = auth.uid() for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'ride_not_found');
  end if;
  if public._expire_if_due(v_ride) <> 'searching' then
    return jsonb_build_object('ok', false, 'reason', 'ride_not_searching');
  end if;
  return public._assign_offer(p_ride_id, p_offer_id);
end;
$$;

-- Motorista envia uma proposta. Com aceitação automática e preço dentro do
-- proposto, é aceite logo, pelo mesmo caminho e sob o mesmo bloqueio.
create function public.submit_offer(p_ride_id uuid, p_price integer, p_eta_minutes integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ride public.rides;
  v_offer_id uuid;
begin
  if not exists (select 1 from public.drivers where id = auth.uid()) then
    return jsonb_build_object('ok', false, 'reason', 'not_a_driver');
  end if;
  select * into v_ride from public.rides where id = p_ride_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'ride_not_found');
  end if;
  if public._expire_if_due(v_ride) <> 'searching' then
    return jsonb_build_object('ok', false, 'reason', 'ride_not_searching');
  end if;

  -- Uma proposta pendente por motorista: a nova substitui a anterior.
  update public.offers set status = 'expired'
   where ride_id = p_ride_id and driver_id = auth.uid() and status = 'pending';
  insert into public.offers (ride_id, driver_id, price, eta_minutes)
  values (p_ride_id, auth.uid(), p_price, p_eta_minutes)
  returning id into v_offer_id;

  if v_ride.auto_accept and p_price <= v_ride.proposed_price then
    return public._assign_offer(p_ride_id, v_offer_id) || jsonb_build_object('auto_accepted', true);
  end if;
  return jsonb_build_object('ok', true, 'offer_id', v_offer_id, 'auto_accepted', false);
end;
$$;

create function public.request_ride(
  p_origin jsonb,
  p_destination jsonb,
  p_category text,
  p_proposed_price integer,
  p_auto_accept boolean
)
returns public.rides
language sql
security definer
set search_path = ''
as $$
  insert into public.rides (passenger_id, origin, destination, category, proposed_price, auto_accept)
  values (auth.uid(), p_origin, p_destination, p_category, p_proposed_price, p_auto_accept)
  returning *;
$$;

create function public.update_ride_price(p_ride_id uuid, p_price integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ride public.rides;
begin
  select * into v_ride from public.rides where id = p_ride_id and passenger_id = auth.uid() for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'ride_not_found');
  end if;
  if public._expire_if_due(v_ride) <> 'searching' then
    return jsonb_build_object('ok', false, 'reason', 'ride_not_searching');
  end if;
  update public.rides set proposed_price = p_price where id = p_ride_id;
  return jsonb_build_object('ok', true);
end;
$$;

create function public.reject_offer(p_ride_id uuid, p_offer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.offers o set status = 'rejected'
    from public.rides r
   where o.id = p_offer_id and o.ride_id = p_ride_id and o.status = 'pending'
     and r.id = o.ride_id and r.passenger_id = auth.uid();
  return jsonb_build_object('ok', found);
end;
$$;

create function public.cancel_ride(p_ride_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ride public.rides;
begin
  select * into v_ride from public.rides where id = p_ride_id and passenger_id = auth.uid() for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'ride_not_found');
  end if;
  if v_ride.status not in ('searching', 'driver_assigned') then
    return jsonb_build_object('ok', false, 'reason', 'ride_not_active');
  end if;
  update public.rides set status = 'cancelled', cancel_reason = p_reason where id = p_ride_id;
  update public.offers set status = 'expired' where ride_id = p_ride_id and status = 'pending';
  return jsonb_build_object('ok', true);
end;
$$;

-- Funções internas não são chamáveis pelos clientes; as RPC só por utilizadores autenticados.
revoke execute on function public._expire_if_due(public.rides) from public, anon, authenticated;
revoke execute on function public._assign_offer(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.accept_offer(uuid, uuid) from public, anon;
revoke execute on function public.submit_offer(uuid, integer, integer) from public, anon;
revoke execute on function public.request_ride(jsonb, jsonb, text, integer, boolean) from public, anon;
revoke execute on function public.update_ride_price(uuid, integer) from public, anon;
revoke execute on function public.reject_offer(uuid, uuid) from public, anon;
revoke execute on function public.cancel_ride(uuid, text) from public, anon;
grant execute on function public.accept_offer(uuid, uuid) to authenticated;
grant execute on function public.submit_offer(uuid, integer, integer) to authenticated;
grant execute on function public.request_ride(jsonb, jsonb, text, integer, boolean) to authenticated;
grant execute on function public.update_ride_price(uuid, integer) to authenticated;
grant execute on function public.reject_offer(uuid, uuid) to authenticated;
grant execute on function public.cancel_ride(uuid, text) to authenticated;

-- Realtime: o app subscreve alterações das suas viagens e propostas.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.rides, public.offers;
  end if;
end;
$$;
