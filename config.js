// =====================================================
// CONFIGURAÇÃO DO SITE — edite só este arquivo
// =====================================================

// Supabase > Project Settings > API
(typeof window !== "undefined" ? window : globalThis).CONFIG = {
  SUPABASE_URL: "https://iwdqemgpedpumkvxudqw.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_bRlEwxx9BoL8mXqQci8evg_iEQd2VIq",

  // WhatsApp da barbearia: 55 + DDD + número, só dígitos
  WHATSAPP: "5524999999999",

  ENDERECO: "Rua Exemplo, 123 · Centro",
  CIDADE: "Vassouras · RJ",
  INSTAGRAM: "https://instagram.com/",

  // Selos para 1 corte grátis (se mudar, mude também fidelidade_meta() no supabase.sql)
  META: 10,

  SERVICES: [
    { id: "corte",   name: "Corte",         desc: "Máquina e tesoura, com lavagem", min: 40, price: 40 },
    { id: "barba",   name: "Barba",         desc: "Toalha quente e navalha",        min: 30, price: 30 },
    { id: "combo",   name: "Corte + Barba", desc: "O combo completo",               min: 70, price: 60 },
    { id: "pezinho", name: "Pezinho",       desc: "Acabamento entre cortes",        min: 15, price: 15 },
    { id: "sobr",    name: "Sobrancelha",   desc: "Na navalha",                     min: 10, price: 15 },
    { id: "pig",     name: "Pigmentação",   desc: "Barba ou cabelo",                min: 30, price: 35 },
  ],

  BARBERS: [
    { id: "Betinho",             note: "Dono da casa" },
    { id: "Primeiro disponível", note: "Mais opções de horário" },
  ],

  // 0 = domingo ... 6 = sábado → [abre, fecha] em horas, ou null se fechado
  HOURS: { 0: null, 1: [9, 19], 2: [9, 19], 3: [9, 19], 4: [9, 19], 5: [9, 19], 6: [8, 17] },
};

if (typeof module !== "undefined") module.exports = globalThis.CONFIG;
