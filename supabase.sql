-- =====================================================================
-- Betinho Barber Style — banco de dados (Supabase)
-- Cole tudo no Supabase > SQL Editor > New query e clique em "Run".
-- Antes de rodar, troque o e-mail na última linha pelo e-mail do barbeiro.
-- =====================================================================

-- Selos necessários para 1 corte grátis
create or replace function public.fidelidade_meta() returns int
language sql immutable as $$ select 10 $$;

-- Quem pode usar o painel do barbeiro
create table if not exists public.admins (
  email text primary key
);

create table if not exists public.agendamentos (
  id           uuid primary key default gen_random_uuid(),
  servico      text not null,
  preco        numeric(10,2) not null,
  duracao_min  int  not null check (duracao_min between 5 and 240),
  barbeiro     text not null,
  inicio       timestamptz not null,
  fim          timestamptz not null,
  nome         text not null check (char_length(nome) between 2 and 80),
  telefone     text not null check (telefone ~ '^[0-9]{10,11}$'),
  status       text not null default 'pendente'
               check (status in ('pendente','confirmado','concluido','faltou','cancelado')),
  selo_dado    boolean not null default false,
  criado_em    timestamptz not null default now()
);
create index if not exists agendamentos_inicio_idx on public.agendamentos (inicio);

create table if not exists public.cartoes (
  telefone    text primary key check (telefone ~ '^[0-9]{10,11}$'),
  nome        text not null default '',
  selos       int  not null default 0 check (selos >= 0),
  resgates    int  not null default 0 check (resgates >= 0),
  atualizado  timestamptz not null default now()
);

-- ---------- segurança: ninguém acessa as tabelas direto, só pelas funções ----------
alter table public.admins       enable row level security;
alter table public.agendamentos enable row level security;
alter table public.cartoes      enable row level security;

create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email','')))
$$;

drop policy if exists admin_agendamentos on public.agendamentos;
create policy admin_agendamentos on public.agendamentos
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists admin_cartoes on public.cartoes;
create policy admin_cartoes on public.cartoes
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists admin_ve_admins on public.admins;
create policy admin_ve_admins on public.admins
  for select to authenticated using (public.eh_admin());

-- ---------- funções públicas (site do cliente) ----------

-- Horários ocupados de um dia (sem nome nem telefone)
create or replace function public.horarios_ocupados(p_dia date)
returns table (inicio timestamptz, fim timestamptz, barbeiro text)
language sql stable security definer set search_path = public as $$
  select a.inicio, a.fim, a.barbeiro
  from public.agendamentos a
  where a.status in ('pendente','confirmado','concluido')
    and (a.inicio at time zone 'America/Sao_Paulo')::date = p_dia
$$;

-- Cria um agendamento, recusando horário já ocupado
create or replace function public.criar_agendamento(
  p_servico text, p_preco numeric, p_duracao int, p_barbeiro text,
  p_inicio timestamptz, p_nome text, p_telefone text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_fim timestamptz := p_inicio + make_interval(mins => p_duracao);
  v_tel text := regexp_replace(coalesce(p_telefone,''), '\D', '', 'g');
begin
  if v_tel ~ '^55[0-9]{10,11}$' then v_tel := substr(v_tel, 3); end if;
  if p_inicio < now() then raise exception 'horario_passado'; end if;
  if p_inicio > now() + interval '60 days' then raise exception 'horario_distante'; end if;

  -- trava por dia para dois clientes não pegarem o mesmo horário ao mesmo tempo
  perform pg_advisory_xact_lock(hashtext('agenda' || (p_inicio at time zone 'America/Sao_Paulo')::date::text));

  if exists (
    select 1 from public.agendamentos a
    where a.status in ('pendente','confirmado','concluido')
      and (a.barbeiro = p_barbeiro or p_barbeiro = 'Primeiro disponível' or a.barbeiro = 'Primeiro disponível')
      and a.inicio < v_fim and a.fim > p_inicio
  ) then
    raise exception 'horario_ocupado';
  end if;

  -- limite simples contra spam: 3 pedidos futuros em aberto por telefone
  if (select count(*) from public.agendamentos
      where telefone = v_tel and status in ('pendente','confirmado') and inicio > now()) >= 3 then
    raise exception 'muitos_agendamentos';
  end if;

  insert into public.agendamentos (servico, preco, duracao_min, barbeiro, inicio, fim, nome, telefone)
  values (p_servico, p_preco, p_duracao, p_barbeiro, p_inicio, v_fim, trim(p_nome), v_tel)
  returning id into v_id;
  return v_id;
end $$;

-- Cliente consulta o próprio cartão pelo WhatsApp
create or replace function public.consultar_cartao(p_telefone text)
returns table (nome text, selos int, resgates int, meta int)
language plpgsql stable security definer set search_path = public as $$
declare v_tel text := regexp_replace(coalesce(p_telefone,''), '\D', '', 'g');
begin
  if v_tel ~ '^55[0-9]{10,11}$' then v_tel := substr(v_tel, 3); end if;
  return query
    select split_part(c.nome, ' ', 1), c.selos, c.resgates, public.fidelidade_meta()
    from public.cartoes c where c.telefone = v_tel;
end $$;

-- ---------- funções do painel (só admin) ----------

-- Muda o status do atendimento. "concluido" dá 1 selo automaticamente (uma vez só);
-- tirar de "concluido" devolve o selo.
create or replace function public.mudar_status(p_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
declare a public.agendamentos;
begin
  if not public.eh_admin() then raise exception 'sem_permissao'; end if;
  select * into a from public.agendamentos where id = p_id for update;
  if not found then raise exception 'nao_encontrado'; end if;

  if p_status = 'concluido' and not a.selo_dado then
    insert into public.cartoes (telefone, nome, selos)
    values (a.telefone, a.nome, 1)
    on conflict (telefone) do update
      set selos = public.cartoes.selos + 1,
          nome = case when public.cartoes.nome = '' then excluded.nome else public.cartoes.nome end,
          atualizado = now();
    update public.agendamentos set status = p_status, selo_dado = true where id = p_id;
  elsif p_status <> 'concluido' and a.selo_dado then
    update public.cartoes set selos = greatest(selos - 1, 0), atualizado = now() where telefone = a.telefone;
    update public.agendamentos set status = p_status, selo_dado = false where id = p_id;
  else
    update public.agendamentos set status = p_status where id = p_id;
  end if;
end $$;

-- Ajuste manual de selos (correções)
create or replace function public.ajustar_selos(p_telefone text, p_delta int)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'sem_permissao'; end if;
  update public.cartoes set selos = greatest(selos + p_delta, 0), atualizado = now()
  where telefone = p_telefone;
end $$;

-- Usa o corte grátis de um cartão completo
create or replace function public.usar_corte_gratis(p_telefone text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'sem_permissao'; end if;
  update public.cartoes
     set selos = selos - public.fidelidade_meta(), resgates = resgates + 1, atualizado = now()
   where telefone = p_telefone and selos >= public.fidelidade_meta();
  if not found then raise exception 'cartao_incompleto'; end if;
end $$;

-- Permissões das tabelas (o RLS acima decide quem vê o quê: só admin)
revoke all on public.agendamentos, public.cartoes, public.admins from anon;
grant select, insert, update, delete on public.agendamentos, public.cartoes to authenticated;
grant select on public.admins to authenticated;

-- Permissões das funções
revoke all on function public.mudar_status(uuid, text)        from public, anon;
revoke all on function public.ajustar_selos(text, int)        from public, anon;
revoke all on function public.usar_corte_gratis(text)         from public, anon;
grant execute on function public.horarios_ocupados(date)      to anon, authenticated;
grant execute on function public.criar_agendamento(text, numeric, int, text, timestamptz, text, text) to anon, authenticated;
grant execute on function public.consultar_cartao(text)       to anon, authenticated;
grant execute on function public.mudar_status(uuid, text)     to authenticated;
grant execute on function public.ajustar_selos(text, int)     to authenticated;
grant execute on function public.usar_corte_gratis(text)      to authenticated;
grant execute on function public.eh_admin()                   to authenticated;

-- >>> TROQUE pelo e-mail que o barbeiro vai usar para entrar no painel <<<
insert into public.admins (email) values ('barbeiro@exemplo.com') on conflict do nothing;
