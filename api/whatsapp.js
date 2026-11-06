// Envia a confirmação do agendamento pelo WhatsApp (API oficial da Meta, WhatsApp Cloud API).
// Configure na Vercel > Settings > Environment Variables:
//   WHATSAPP_TOKEN      token permanente do usuário do sistema (Meta Business)
//   WHATSAPP_PHONE_ID   "Phone number ID" do número que envia
//   WHATSAPP_TEMPLATE   nome do modelo aprovado (padrão: confirmacao_agendamento)
//   WHATSAPP_LANG       idioma do modelo (padrão: pt_BR)
// O modelo precisa ter 4 variáveis no corpo: {{1}} nome, {{2}} serviço, {{3}} dia, {{4}} hora.
const C = require("../config.js");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  const id = req.body && req.body.id;
  if (typeof id !== "string" || !UUID.test(id)) return res.status(400).json({ ok: false });

  const { WHATSAPP_TOKEN, WHATSAPP_PHONE_ID } = process.env;
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) return res.status(200).json({ ok: false, motivo: "nao_configurado" });

  // O banco só devolve os dados uma vez, e só para agendamentos feitos nos últimos 10 minutos.
  const r = await fetch(`${C.SUPABASE_URL}/rest/v1/rpc/whatsapp_pendente`, {
    method: "POST",
    headers: { apikey: C.SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_id: id }),
  });
  const rows = r.ok ? await r.json() : [];
  const a = rows[0];
  if (!a) return res.status(200).json({ ok: false, motivo: "nada_a_enviar" });

  const ini = new Date(a.inicio);
  const tz = { timeZone: "America/Sao_Paulo" };
  const dia = ini.toLocaleDateString("pt-BR", { ...tz, weekday: "long", day: "2-digit", month: "2-digit" });
  const hora = ini.toLocaleTimeString("pt-BR", { ...tz, hour: "2-digit", minute: "2-digit" });
  const nome = String(a.nome).split(" ")[0];

  const versao = process.env.WHATSAPP_API_VERSION || "v23.0";
  const w = await fetch(`https://graph.facebook.com/${versao}/${WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: "55" + a.telefone,
      type: "template",
      template: {
        name: process.env.WHATSAPP_TEMPLATE || "confirmacao_agendamento",
        language: { code: process.env.WHATSAPP_LANG || "pt_BR" },
        components: [{
          type: "body",
          parameters: [nome, a.servico, dia, hora].map(text => ({ type: "text", text })),
        }],
      },
    }),
  });
  const out = await w.json().catch(() => ({}));
  if (!w.ok) console.error("whatsapp", w.status, JSON.stringify(out.error || out).slice(0, 300));
  return res.status(200).json({ ok: w.ok });
};
