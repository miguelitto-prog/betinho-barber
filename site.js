(function () {
  const C = window.CONFIG;
  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  const $ = id => document.getElementById(id);

  const DOW = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const brl = v => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
  const pad = n => String(n).padStart(2, "0");
  const fmtH = h => pad(Math.floor(h)) + ":" + pad(Math.round((h % 1) * 60));
  const digits = s => s.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  const pretty = d => d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------- conteúdo fixo ----------
  $("board").innerHTML = C.SERVICES.map(s => `
    <div class="item"><h3>${esc(s.name)}</h3><span class="lead-dots"></span><span class="price">${brl(s.price)}</span>
    <div class="desc"><span>${esc(s.desc)}</span><span>${s.min} min</span></div></div>`).join("");

  const now = new Date();
  $("hours").innerHTML = [1, 2, 3, 4, 5, 6, 0].map(d => {
    const h = C.HOURS[d];
    return `<tr class="${d === now.getDay() ? "now" : ""}"><td>${DOW[d]}</td><td>${h ? fmtH(h[0]) + "–" + fmtH(h[1]) : "Fechado"}</td></tr>`;
  }).join("");
  (function () {
    const h = C.HOURS[now.getDay()], t = now.getHours() + now.getMinutes() / 60;
    const open = h && t >= h[0] && t < h[1];
    $("openNow").innerHTML = `<span class="dot ${open ? "" : "closed"}"></span>${open ? "Aberto agora" : "Fechado agora"}`;
    $("todayHours").textContent = h ? `Hoje: ${fmtH(h[0])}–${fmtH(h[1])}` : "Hoje: fechado";
  })();

  $("endereco").textContent = C.ENDERECO;
  $("cidade").textContent = C.CIDADE;
  $("mapsLink").href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("Betinho Barber Style " + C.ENDERECO + " " + C.CIDADE);
  $("instaLink").href = C.INSTAGRAM;
  const zapPretty = pretty(C.WHATSAPP.slice(2));
  $("zapText").textContent = zapPretty;
  $("zapLink").href = `https://wa.me/${C.WHATSAPP}`;
  $("copyZap").addEventListener("click", e => {
    const b = e.currentTarget;
    navigator.clipboard.writeText(zapPretty).then(() => { b.textContent = "copiado"; }, () => { b.textContent = "selecione o número"; });
    setTimeout(() => b.textContent = "copiar", 1800);
  });

  // ---------- cartão fidelidade ----------
  const META = C.META;
  $("ruleText").innerHTML = `${META} selos, <em>1 corte grátis</em>`;
  const SCISSORS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/></svg>`;
  const cardSlot = $("cardSlot");

  function drawCard(nome, selos, resgates, meta) {
    const filled = Math.min(selos, meta), falta = meta - filled;
    const cells = Array.from({ length: meta }, (_, i) =>
      i < filled ? `<div class="stamp on">${SCISSORS}</div>`
        : i === meta - 1 ? `<div class="stamp gift">Corte<br>grátis</div>`
          : `<div class="stamp">${i + 1}</div>`).join("");
    cardSlot.innerHTML = `<div class="card">
      <div class="card-top"><span class="mark">BETINHO<i>Barber Style</i></span><small>${filled}/${meta}</small></div>
      <div class="stamps">${cells}</div><p class="card-msg"></p></div>`;
    const m = cardSlot.querySelector(".card-msg");
    m.innerHTML = selos >= meta
      ? `Cartão completo! Seu próximo corte é grátis.<small>É só avisar na hora do atendimento.</small>`
      : `Faltam ${falta} ${falta === 1 ? "selo" : "selos"} para o corte grátis.` +
        (resgates ? `<small>Você já ganhou ${resgates} ${resgates === 1 ? "corte" : "cortes"} por aqui.</small>` : "");
    if (nome) { const s = document.createElement("small"); s.textContent = "Cartão de " + nome; s.style.margin = "0 0 6px"; m.prepend(s); }
  }
  function drawEmpty(text) {
    cardSlot.innerHTML = `<div class="card empty"><div class="stamps">${Array.from({ length: META }, (_, i) => `<div class="stamp">${i === META - 1 ? "" : i + 1}</div>`).join("")}</div><p class="card-msg" style="font-weight:400"></p></div>`;
    cardSlot.querySelector(".card-msg").textContent = text;
  }
  drawEmpty("Digite seu WhatsApp para ver quantos selos você já tem.");

  $("lookupForm").addEventListener("submit", async e => {
    e.preventDefault();
    const d = digits($("lk-phone").value);
    if (d.length < 10) { $("lkStatus").textContent = "Coloque o número com DDD, por exemplo (24) 99999-9999."; return; }
    $("lkStatus").textContent = "Buscando…";
    const { data, error } = await sb.rpc("consultar_cartao", { p_telefone: d });
    if (error) { $("lkStatus").textContent = "Não deu para buscar agora. Tente de novo em instantes."; return; }
    $("lkStatus").textContent = "";
    if (!data || !data.length) { drawEmpty("Ainda não tem cartão com esse número. Ele é criado no seu primeiro atendimento."); return; }
    const c = data[0];
    drawCard(c.nome, c.selos, c.resgates, c.meta);
  });

  // ---------- agendamento ----------
  const st = { step: 0, service: null, barber: null, day: null, time: null, name: "", phone: "", busy: null, doneId: null, sending: false, error: "" };
  const panel = $("panel");
  const stepsEl = [...document.querySelectorAll("#steps li")];
  const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const svcOf = () => C.SERVICES.find(s => s.id === st.service);

  function nextDays() {
    const out = [], d = new Date(); d.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) { const x = new Date(d); x.setDate(d.getDate() + i); out.push(x); }
    return out;
  }
  function startAt(day, h) { const x = new Date(day); x.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0); return x; }

  async function loadBusy() {
    st.busy = null; render();
    const key = dayKey(st.day);
    const { data, error } = await sb.rpc("horarios_ocupados", { p_dia: key });
    if (dayKey(st.day) !== key) return; // trocou de dia no meio
    st.busy = error ? [] : data.map(r => [new Date(r.inicio).getTime(), new Date(r.fim).getTime()]);
    if (error) st.error = "Não deu para carregar os horários. Atualize a página.";
    render();
  }
  function slotsFor(day) {
    const h = C.HOURS[day.getDay()]; if (!h) return [];
    const dur = svcOf().min / 60, out = [], nowMs = Date.now() + 30 * 60000;
    for (let x = h[0]; x + dur <= h[1] + 1e-9; x += 0.5) {
      const s = startAt(day, x).getTime(), e = s + svcOf().min * 60000;
      const taken = (st.busy || []).some(([bs, be]) => bs < e && be > s);
      out.push({ h: x, off: taken || s <= nowMs });
    }
    return out;
  }

  function render() {
    stepsEl.forEach((li, i) => { li.className = st.doneId ? "done" : i === st.step ? "on" : i < st.step ? "done" : ""; });
    const svc = svcOf();
    let html = "";
    if (st.doneId) {
      const d = st.day;
      const msg = `Olá! Acabei de marcar pelo site: ${svc.name}, ${DOW[d.getDay()]} ${d.toLocaleDateString("pt-BR")} às ${fmtH(st.time)}. Nome: ${st.name}.`;
      html = `<div class="done-box"><h3>Pedido enviado</h3>
        <p class="hint">${esc(svc.name)} · ${DOW[d.getDay()]}, ${d.toLocaleDateString("pt-BR")} às ${fmtH(st.time)}.<br>
        O horário já está reservado. O Betinho confirma pelo WhatsApp ${esc(pretty(digits(st.phone)))}.</p>
        <p class="small">Quando o atendimento for concluído, o selo entra sozinho no seu cartão fidelidade.</p>
        <div class="nav-row"><a class="btn ghost" href="https://wa.me/${C.WHATSAPP}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Avisar no WhatsApp</a>
        <button class="btn" type="button" id="restart">Marcar outro</button></div></div>`;
      panel.innerHTML = html; return;
    }
    if (st.step === 0) {
      html = `<h3>Qual serviço?</h3><p class="hint">Escolha um. Dá pra combinar outro na hora.</p>
      <div class="opts">${C.SERVICES.map(s => `<button class="opt" type="button" data-svc="${s.id}" aria-pressed="${st.service === s.id}">
        <strong>${esc(s.name)}</strong><small>${brl(s.price)} · ${s.min} min</small></button>`).join("")}</div>`;
    } else if (st.step === 1) {
      html = `<h3>Com quem?</h3><p class="hint">${esc(svc.name)} · ${brl(svc.price)}</p>
      <div class="opts">${C.BARBERS.map(b => `<button class="opt" type="button" data-bar="${esc(b.id)}" aria-pressed="${st.barber === b.id}">
        <strong>${esc(b.id)}</strong><small>${esc(b.note)}</small></button>`).join("")}</div>`;
    } else if (st.step === 2) {
      const days = nextDays();
      const slots = st.busy === null ? null : slotsFor(st.day);
      html = `<h3>Dia e hora</h3><p class="hint">Horários riscados já estão ocupados.</p>
      <div class="days">${days.map(d => {
        const closed = !C.HOURS[d.getDay()];
        return `<button class="day" type="button" data-day="${dayKey(d)}" aria-pressed="${dayKey(d) === dayKey(st.day)}" ${closed ? "disabled" : ""}>
        <span>${DOW[d.getDay()].slice(0, 3)}</span><strong>${d.getDate()}</strong><span>${d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span></button>`;
      }).join("")}</div>
      <div class="slots">${slots === null ? `<p class="slot-loading">Carregando horários…</p>`
        : slots.length && slots.some(s => !s.off) ? slots.map(s => `<button class="slot" type="button" data-time="${s.h}" aria-pressed="${st.time === s.h}" ${s.off ? "disabled" : ""}>${fmtH(s.h)}</button>`).join("")
          : `<p class="slot-loading">Sem horários livres neste dia. Tente outro.</p>`}</div>`;
    } else if (st.step === 3) {
      html = `<h3>Seus dados</h3><p class="hint">Seu WhatsApp também é o número do seu cartão fidelidade.</p>
      <form class="fields" id="dados" novalidate>
        <label class="full">Nome<input id="f-name" autocomplete="name" value="${esc(st.name)}" placeholder="Como te chamamos"></label>
        <label class="full">WhatsApp<input id="f-phone" type="tel" inputmode="tel" autocomplete="tel" value="${esc(st.phone)}" placeholder="(24) 9 9999-9999"></label>
      </form>`;
    } else {
      const d = st.day;
      html = `<h3>Confere aí</h3><p class="hint">Ao confirmar, o horário fica reservado para você.</p>
      <dl class="summary">
        <div><dt>Serviço</dt><dd>${esc(svc.name)}</dd></div>
        <div><dt>Barbeiro</dt><dd>${esc(st.barber)}</dd></div>
        <div><dt>Quando</dt><dd>${DOW[d.getDay()]}, ${d.toLocaleDateString("pt-BR")} às ${fmtH(st.time)}</dd></div>
        <div><dt>Nome</dt><dd>${esc(st.name)}</dd></div>
        <div><dt>WhatsApp</dt><dd>${esc(pretty(digits(st.phone)))}</dd></div>
        <div class="total"><dt>Valor</dt><dd>${brl(svc.price)}</dd></div>
      </dl>
      <p class="small">Esse atendimento vale 1 selo no cartão fidelidade.</p>`;
    }
    const canNext = [!!st.service, !!st.barber, st.time !== null, true, true][st.step];
    html += `<p class="err" id="err">${esc(st.error)}</p><div class="nav-row">
      ${st.step > 0 ? `<button class="btn ghost" type="button" id="back">Voltar</button>` : ""}
      ${st.step < 4 ? `<button class="btn" type="button" id="next" ${canNext ? "" : "disabled"}>Continuar</button>`
        : `<button class="btn" type="button" id="confirm" ${st.sending ? "disabled" : ""}>${st.sending ? "Reservando…" : "Confirmar agendamento"}</button>`}
    </div>`;
    panel.innerHTML = html;
  }

  function saveFields() {
    const n = $("f-name"), p = $("f-phone");
    if (n) { st.name = n.value.trim(); st.phone = p.value.trim(); }
  }
  const ERRORS = {
    horario_ocupado: "Esse horário acabou de ser reservado por outra pessoa. Escolha outro.",
    horario_passado: "Esse horário já passou. Escolha outro.",
    muitos_agendamentos: "Esse WhatsApp já tem 3 horários marcados. Fale com a barbearia para marcar mais.",
  };

  async function confirm() {
    st.sending = true; st.error = ""; render();
    const svc = svcOf();
    const { data, error } = await sb.rpc("criar_agendamento", {
      p_servico: svc.name, p_preco: svc.price, p_duracao: svc.min, p_barbeiro: st.barber,
      p_inicio: startAt(st.day, st.time).toISOString(), p_nome: st.name, p_telefone: digits(st.phone),
    });
    st.sending = false;
    if (error) {
      const key = Object.keys(ERRORS).find(k => (error.message || "").includes(k));
      st.error = key ? ERRORS[key] : "Não deu para reservar agora. Tente de novo ou chame no WhatsApp.";
      if (key === "horario_ocupado" || key === "horario_passado") { st.step = 2; st.time = null; loadBusy(); return; }
      render(); return;
    }
    st.doneId = data; render();
  }

  panel.addEventListener("click", e => {
    const t = e.target.closest("button,a"); if (!t) return;
    if (t.dataset.svc) { st.service = t.dataset.svc; st.time = null; render(); return; }
    if (t.dataset.bar) { st.barber = t.dataset.bar; render(); return; }
    if (t.dataset.day) { st.day = new Date(t.dataset.day + "T00:00:00"); st.time = null; st.error = ""; loadBusy(); return; }
    if (t.dataset.time) { st.time = parseFloat(t.dataset.time); render(); return; }
    if (t.id === "back") { saveFields(); st.step--; st.error = ""; render(); return; }
    if (t.id === "confirm") { confirm(); return; }
    if (t.id === "restart") { Object.assign(st, { step: 0, service: null, barber: null, day: null, time: null, busy: null, doneId: null, error: "" }); render(); return; }
    if (t.id === "next") {
      st.error = "";
      if (st.step === 3) {
        saveFields();
        if (st.name.length < 2) { st.error = "Escreva seu nome para continuar."; render(); $("f-name").focus(); return; }
        if (digits(st.phone).length < 10) { st.error = "Coloque o WhatsApp com DDD, por exemplo (24) 99999-9999."; render(); $("f-phone").focus(); return; }
      }
      st.step++;
      if (st.step === 2) {
        if (!st.day) st.day = nextDays().find(d => {
          const h = C.HOURS[d.getDay()]; if (!h) return false;
          return d.toDateString() !== new Date().toDateString() || new Date().getHours() + new Date().getMinutes() / 60 < h[1] - 1;
        }) || nextDays()[1];
        loadBusy();
      } else render();
      if (innerWidth < 860) $("agendar").scrollIntoView({ block: "start" });
    }
  });
  panel.addEventListener("submit", e => { e.preventDefault(); $("next") && $("next").click(); });
  render();
})();
