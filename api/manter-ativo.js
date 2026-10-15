// Acesso diário ao banco, disparado pelo cron da Vercel (vercel.json).
// O plano grátis do Supabase pausa o projeto depois de uns sete dias sem uso,
// e aí o sogro abre o app e não vê nenhuma camisa. Uma leitura por dia evita isso.
// Usa só a chave anon, a mesma do app: lê uma linha, não grava nada.
export default async function handler(req, res) {
  const url = process.env.VITE_SUPABASE_URL;
  const chave = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !chave) {
    res.status(500).json({ ok: false, erro: "variáveis do Supabase ausentes" });
    return;
  }
  try {
    const r = await fetch(`${url}/rest/v1/camisas?select=id&limit=1`, {
      headers: { apikey: chave, Authorization: `Bearer ${chave}` },
    });
    res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status, quando: new Date().toISOString() });
  } catch (e) {
    res.status(502).json({ ok: false, erro: String(e) });
  }
}
