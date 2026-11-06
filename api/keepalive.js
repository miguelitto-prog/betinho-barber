// Chamado todo dia pela Vercel (vercel.json > crons) para o Supabase grátis não pausar por inatividade.
const C = require("../config.js");

module.exports = async (req, res) => {
  const hoje = new Date().toISOString().slice(0, 10);
  try {
    const r = await fetch(`${C.SUPABASE_URL}/rest/v1/rpc/horarios_ocupados`, {
      method: "POST",
      headers: { apikey: C.SUPABASE_ANON_KEY, Authorization: `Bearer ${C.SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_dia: hoje }),
    });
    res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status, em: new Date().toISOString() });
  } catch (e) {
    res.status(502).json({ ok: false, erro: String(e) });
  }
};
