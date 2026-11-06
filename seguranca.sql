-- =====================================================================
-- Betinho Barber Style — reforço de segurança (rodar DEPOIS do supabase.sql)
-- O servidor passa a decidir preço, duração, barbeiro e horário de
-- funcionamento. O site só manda o nome do serviço; valores alterados
-- no navegador são ignorados.
-- Se mudar preços/horários no config.js, mude também aqui e rode de novo.
-- =====================================================================

-- Catálogo oficial (igual ao config.js)
create or replace function public.catalogo_servico(p_nome text, out preco numeric, out duracao int)
language sql immutable as $$
  select v.preco, v.duracao from (values
    ('Corte',         40::numeric, 40),
    ('Barba',         30::numeric, 30),
    ('Corte + Barba', 60::numeric, 70),
    ('Pezinho',       15::numeric, 15),
    ('Sobrancelha',   15::numeric, 10),
    ('Pigmentação',   35::numeric, 30)
  ) as v(nome, preco, duracao) where v.nome = p_nome
$$;

-- Horário de funcionamento (0 = domingo ... 6 = sábado), em horas
create or replace function public.horario_funcionamento(p_dow int, out abre int, out fecha int)
language sql immutable as $$
  select v.abre, v.fecha from (values
    (1, 9, 19), (2, 9, 19), (3, 9, 19), (4, 9, 19), (5, 9, 19), (6, 8, 17)
  ) as v(dow, abre, fecha) where v.dow = p_dow
$$;

create or replace function public.criar_agendamento(
  p_servico text, p_preco numeric, p_duracao int, p_barbeiro text,
  p_inicio timestamptz, p_nome text, p_telefone text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_preco numeric;
  v_dur int;
  v_fim timestamptz;
  v_local timestamp := p_inicio at time zone 'America/Sao_Paulo';
  v_nome text := left(trim(regexp_replace(coalesce(p_nome,''), '[[:cntrl:]<>]', '', 'g')), 80);
  v_tel text := regexp_replace(coalesce(p_telefone,''), '\D', '', 'g');
begin
  -- serviço e barbeiro só da lista oficial; preço e duração vêm do servidor
  select c.preco, c.duracao into v_preco, v_dur from public.catalogo_servico(p_servico) c;
  if v_preco is null then raise exception 'servico_invalido'; end if;
  if p_barbeiro not in ('Betinho', 'Primeiro disponível') then raise exception 'barbeiro_invalido'; end if;
  v_fim := p_inicio + make_interval(mins => v_dur);

  if v_tel ~ '^55[0-9]{10,11}$' then v_tel := substr(v_tel, 3); end if;
  if v_tel !~ '^[0-9]{10,11}$' then raise exception 'telefone_invalido'; end if;
  if char_length(v_nome) < 2 then raise exception 'nome_invalido'; end if;

  if p_inicio < now() then raise exception 'horario_passado'; end if;
  if p_inicio > now() + interval '60 days' then raise exception 'horario_distante'; end if;

  -- agenda aberta todos os dias das 06:00 às 23:00 (inclusive fora do expediente), em horários cheios ou meia hora
  if extract(minute from v_local)::int not in (0, 30)
     or extract(second from v_local) <> 0
     or v_local::time < time '06:00'
     or (v_local + make_interval(mins => v_dur)) > (v_local::date + time '23:00') then
    raise exception 'fora_do_expediente';
  end if;

  perform pg_advisory_xact_lock(hashtext('agenda' || v_local::date::text));

  if exists (
    select 1 from public.agendamentos a
    where a.status in ('pendente','confirmado','concluido')
      and (a.barbeiro = p_barbeiro or p_barbeiro = 'Primeiro disponível' or a.barbeiro = 'Primeiro disponível')
      and a.inicio < v_fim and a.fim > p_inicio
  ) then
    raise exception 'horario_ocupado';
  end if;

  -- anti-spam: 3 horários em aberto por WhatsApp e no máximo 20 pedidos por 10 minutos no site todo
  if (select count(*) from public.agendamentos
      where telefone = v_tel and status in ('pendente','confirmado') and inicio > now()) >= 3 then
    raise exception 'muitos_agendamentos';
  end if;
  if (select count(*) from public.agendamentos where criado_em > now() - interval '10 minutes') >= 20 then
    raise exception 'muitos_pedidos';
  end if;

  insert into public.agendamentos (servico, preco, duracao_min, barbeiro, inicio, fim, nome, telefone)
  values (p_servico, v_preco, v_dur, p_barbeiro, p_inicio, v_fim, v_nome, v_tel)
  returning id into v_id;
  return v_id;
end $$;

-- Funções internas não ficam expostas na API
revoke all on function public.catalogo_servico(text)      from public, anon, authenticated;
revoke all on function public.horario_funcionamento(int)  from public, anon, authenticated;
revoke all on function public.fidelidade_meta()           from public, anon;
revoke all on function public.eh_admin()                  from public, anon;
grant execute on function public.eh_admin()               to authenticated;
grant execute on function public.criar_agendamento(text, numeric, int, text, timestamptz, text, text) to anon, authenticated;

-- Tabelas: ninguém de fora lê nem escreve direto
revoke all on public.agendamentos, public.cartoes, public.admins from anon;

-- ---------- confirmação automática pelo WhatsApp ----------
alter table public.agendamentos add column if not exists whatsapp_enviado boolean not null default false;

-- Entrega os dados do agendamento UMA vez, e só nos 10 minutos depois de marcado.
-- Quem chama é a função /api/whatsapp da Vercel, que manda a mensagem.
create or replace function public.whatsapp_pendente(p_id uuid)
returns table (nome text, telefone text, servico text, inicio timestamptz)
language sql volatile security definer set search_path = public as $$
  update public.agendamentos a
     set whatsapp_enviado = true
   where a.id = p_id
     and not a.whatsapp_enviado
     and a.criado_em > now() - interval '10 minutes'
  returning a.nome, a.telefone, a.servico, a.inicio
$$;
revoke all on function public.whatsapp_pendente(uuid) from public;
grant execute on function public.whatsapp_pendente(uuid) to anon, authenticated;
