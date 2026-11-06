(function () {
  const C = window.CONFIG;
  // link de convite ou de troca de senha chega com type=invite/recovery no endereço
  const linkTipo = (location.hash.match(/type=(invite|recovery)/) || [])[1];
  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  const $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(2, "0");
  const DOW = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const pretty = d => d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d;
  const brl = v => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
  const LABEL = { pendente: "Pendente", confirmado: "Confirmado", concluido: "Concluído", faltou: "Faltou", cancelado: "Cancelado" };

  let day = new Date(); day.setHours(0, 0, 0, 0);
  let clients = [];

  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 2200);
  }

  // ---------- login ----------
  async function boot() {
    const { data: { session } } = await sb.auth.getSession();
    if (session && linkTipo) {
      $("loginForm").hidden = true; $("app").hidden = true; $("pwForm").hidden = false;
      history.replaceState(null, "", location.pathname);
      return;
    }
    if (!session) { $("loginForm").hidden = false; $("app").hidden = true; $("logout").hidden = true; return; }
    const { data: ok } = await sb.rpc("eh_admin");
    if (!ok) {
      await sb.auth.signOut();
      $("loginForm").hidden = false; $("app").hidden = true; $("loginErr").textContent = "Esse e-mail não tem acesso ao painel.";
      return;
    }
    $("loginForm").hidden = true; $("app").hidden = false; $("logout").hidden = false;
    loadDay(); loadClients(); loadNext();
    clearInterval(boot._t); boot._t = setInterval(() => { loadNext(); loadDay(); }, 60000);
  }
  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault(); $("loginErr").textContent = "Entrando…";
    const { error } = await sb.auth.signInWithPassword({ email: $("email").value.trim(), password: $("senha").value });
    if (error) { $("loginErr").textContent = "E-mail ou senha incorretos."; return; }
    $("loginErr").textContent = ""; boot();
  });
  $("forgot").addEventListener("click", async () => {
    const email = $("email").value.trim();
    if (!email) { $("loginErr").textContent = "Escreva seu e-mail acima e toque de novo."; return; }
    await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    $("loginErr").textContent = "Se esse e-mail tiver acesso, chega um link para criar a senha.";
  });
  $("pwForm").addEventListener("submit", async e => {
    e.preventDefault();
    const a = $("novaSenha").value, b = $("novaSenha2").value;
    if (a.length < 10) { $("pwErr").textContent = "Use pelo menos 10 caracteres."; return; }
    if (a !== b) { $("pwErr").textContent = "As senhas não são iguais."; return; }
    $("pwErr").textContent = "Salvando…";
    const { error } = await sb.auth.updateUser({ password: a });
    if (error) { $("pwErr").textContent = "Não salvou. Abra o link do e-mail de novo."; return; }
    $("pwForm").hidden = true; $("pwErr").textContent = ""; boot();
  });
  sb.auth.onAuthStateChange(ev => { if (ev === "PASSWORD_RECOVERY") { $("loginForm").hidden = true; $("pwForm").hidden = false; } });
  $("logout").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });

  // ---------- abas ----------
  document.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll("[data-tab]").forEach(x => x.setAttribute("aria-selected", x === b));
    $("tab-agenda").hidden = b.dataset.tab !== "agenda";
    $("tab-clientes").hidden = b.dataset.tab !== "clientes";
    if (b.dataset.tab === "clientes") loadClients();
  }));

  // ---------- agenda ----------
  function setDay(d) { day = d; loadDay(); }
  $("prevDay").onclick = () => { const d = new Date(day); d.setDate(d.getDate() - 1); setDay(d); };
  $("nextDay").onclick = () => { const d = new Date(day); d.setDate(d.getDate() + 1); setDay(d); };
  $("todayBtn").onclick = () => { const d = new Date(); d.setHours(0, 0, 0, 0); setDay(d); };
  $("reload").onclick = () => { loadDay(); loadNext(); };

  async function loadDay() {
    const isToday = day.toDateString() === new Date().toDateString();
    $("dayLabel").textContent = (isToday ? "Hoje · " : DOW[day.getDay()].slice(0, 3) + " · ") + day.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
    const from = new Date(day), to = new Date(day); to.setDate(to.getDate() + 1);
    const { data, error } = await sb.from("agendamentos").select("*")
      .gte("inicio", from.toISOString()).lt("inicio", to.toISOString()).order("inicio");
    const box = $("bookings");
    if (error) { box.innerHTML = `<p class="empty">Não deu para carregar a agenda. Toque em Atualizar.</p>`; return; }
    if (!data.length) { box.innerHTML = `<p class="empty">Nenhum horário marcado neste dia.</p>`; return; }
    box.innerHTML = "";
    data.forEach(b => {
      const t = new Date(b.inicio);
      const el = document.createElement("div");
      el.className = "bk" + (["faltou", "cancelado"].includes(b.status) ? " dim" : "");
      el.innerHTML = `<div class="t">${pad(t.getHours())}:${pad(t.getMinutes())}</div>
        <div class="who"><strong></strong><small></small></div><div class="acts"></div>`;
      el.querySelector("strong").textContent = b.nome;
      el.querySelector("strong").insertAdjacentHTML("beforeend", `<span class="pill ${b.status}">${LABEL[b.status]}</span>`);
      el.querySelector("small").textContent = `${b.servico} · ${brl(b.preco)} · ${b.barbeiro} · ${pretty(b.telefone)}`;
      const acts = el.querySelector(".acts");
      const add = (label, status, cls) => {
        const btn = document.createElement("button");
        btn.type = "button"; btn.className = "mini" + (cls ? " " + cls : ""); btn.textContent = label;
        btn.onclick = () => setStatus(b, status, btn);
        acts.appendChild(btn);
      };
      if (b.status === "pendente") add("Confirmar", "confirmado");
      if (["pendente", "confirmado"].includes(b.status)) { add("Concluído", "concluido", "go"); add("Faltou", "faltou"); add("Cancelar", "cancelado"); }
      if (b.status === "concluido") add("Desfazer", "confirmado");
      if (["faltou", "cancelado"].includes(b.status)) add("Reabrir", "confirmado");
      const zap = document.createElement("a");
      zap.className = "mini"; zap.textContent = "WhatsApp"; zap.target = "_blank"; zap.rel = "noopener"; zap.style.textDecoration = "none";
      zap.href = `https://wa.me/55${b.telefone}?text=${encodeURIComponent(`Olá ${b.nome.split(" ")[0]}! Seu horário de ${b.servico} está confirmado para ${t.toLocaleDateString("pt-BR")} às ${pad(t.getHours())}:${pad(t.getMinutes())}. Te espero!`)}`;
      acts.appendChild(zap);
      box.appendChild(el);
    });
  }

  // ---------- próximos agendamentos (de agora em diante) ----------
  async function loadNext() {
    const { data, error } = await sb.from("agendamentos").select("id,inicio,nome,servico,status")
      .gte("inicio", new Date(Date.now() - 60 * 60000).toISOString())
      .in("status", ["pendente", "confirmado"]).order("inicio").limit(50);
    const box = $("proximos"), cnt = $("proxCount");
    if (error) { box.innerHTML = `<p class="empty">Não deu para carregar. Toque em Atualizar.</p>`; return; }
    const pend = data.filter(b => b.status === "pendente").length;
    cnt.hidden = !pend; cnt.textContent = pend + (pend === 1 ? " novo" : " novos");
    if (!data.length) { box.innerHTML = `<p class="empty">Nenhum horário marcado daqui pra frente.</p>`; return; }
    box.innerHTML = "";
    data.forEach(b => {
      const t = new Date(b.inicio);
      const el = document.createElement("button");
      el.type = "button"; el.className = "px";
      el.innerHTML = `<span class="q"></span><span class="w"><strong></strong> <small></small></span><span class="pill ${b.status}">${LABEL[b.status]}</span>`;
      el.querySelector(".q").textContent = `${DOW[t.getDay()].slice(0, 3)} ${pad(t.getDate())}/${pad(t.getMonth() + 1)} · ${pad(t.getHours())}:${pad(t.getMinutes())}`;
      el.querySelector("strong").textContent = b.nome;
      el.querySelector("small").textContent = "· " + b.servico;
      el.onclick = () => { const d = new Date(t); d.setHours(0, 0, 0, 0); setDay(d); $("dayLabel").scrollIntoView({ behavior: "smooth", block: "start" }); };
      box.appendChild(el);
    });
  }

  async function setStatus(b, status, btn) {
    btn.disabled = true;
    const { error } = await sb.rpc("mudar_status", { p_id: b.id, p_status: status });
    if (error) { btn.disabled = false; toast("Não salvou. Tente de novo."); return; }
    if (status === "concluido") toast(`Selo lançado no cartão de ${b.nome.split(" ")[0]}`);
    else if (b.status === "concluido") toast("Selo devolvido");
    loadDay(); loadNext();
  }

  // ---------- clientes ----------
  async function loadClients() {
    const { data, error } = await sb.from("cartoes").select("*").order("atualizado", { ascending: false }).limit(1000);
    if (error) { $("clientes").innerHTML = `<tr><td colspan="5" class="empty">Não deu para carregar os clientes.</td></tr>`; return; }
    clients = data; drawClients();
  }
  function drawClients() {
    const q = $("busca").value.trim().toLowerCase(), qd = q.replace(/\D/g, "");
    const rows = clients.filter(c => !q || c.nome.toLowerCase().includes(q) || (qd && c.telefone.includes(qd)));
    const tb = $("clientes");
    if (!rows.length) { tb.innerHTML = `<tr><td colspan="5" class="empty">${clients.length ? "Ninguém encontrado." : "Os cartões aparecem aqui depois do primeiro atendimento concluído."}</td></tr>`; return; }
    tb.innerHTML = "";
    rows.forEach(c => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td></td><td class="n">${pretty(c.telefone)}</td><td class="n">${c.selos}/${C.META}</td><td class="n">${c.resgates}</td><td></td>`;
      tr.cells[0].textContent = c.nome || "Sem nome";
      const acts = tr.cells[4];
      const mk = (label, fn, cls, dis) => { const b = document.createElement("button"); b.type = "button"; b.className = "mini" + (cls ? " " + cls : ""); b.textContent = label; b.disabled = !!dis; b.onclick = () => fn(b); acts.appendChild(b); acts.append(" "); };
      mk("−1", b => adjust(c, -1, b), "", c.selos <= 0);
      mk("+1", b => adjust(c, 1, b));
      if (c.selos >= C.META) mk("Usar corte grátis", b => redeem(c, b), "go");
      tb.appendChild(tr);
    });
  }
  $("busca").addEventListener("input", drawClients);
  async function adjust(c, delta, btn) {
    btn.disabled = true;
    const { error } = await sb.rpc("ajustar_selos", { p_telefone: c.telefone, p_delta: delta });
    if (error) toast("Não salvou. Tente de novo.");
    loadClients();
  }
  async function redeem(c, btn) {
    btn.disabled = true;
    const { error } = await sb.rpc("usar_corte_gratis", { p_telefone: c.telefone });
    toast(error ? "Não salvou. Tente de novo." : `Corte grátis usado por ${c.nome.split(" ")[0] || "cliente"}`);
    loadClients();
  }

  boot();
})();
