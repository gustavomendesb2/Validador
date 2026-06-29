import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";

const CAMPOS = [
  { chave: "time", rotulo: "Time" },
  { chave: "pais", rotulo: "País" },
  { chave: "ano", rotulo: "Ano" },
  { chave: "modelo", rotulo: "Modelo (tipo de camisa)" },
  { chave: "fornecedor", rotulo: "Marca" },
  { chave: "numero_nome", rotulo: "Número / Nome" },
];

export default function App() {
  const [camisas, setCamisas] = useState([]);
  const [idx, setIdx] = useState(0);
  const [form, setForm] = useState(null);
  const [estado, setEstado] = useState("carregando"); // carregando | ok | erro | vazio
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // Carrega todas as camisas e começa na primeira ainda não confirmada
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("camisas")
        .select("*")
        .order("ordem", { ascending: true });
      if (error) { setEstado("erro"); setErro(error.message); return; }
      if (!data || data.length === 0) { setEstado("vazio"); return; }
      setCamisas(data);
      const pendente = data.findIndex((c) => !c.revisado);
      setIdx(pendente === -1 ? 0 : pendente);
      setEstado("ok");
    })();
  }, []);

  // Quando muda de camisa, preenche o formulário com os dados dela
  useEffect(() => {
    if (camisas.length === 0) return;
    const c = camisas[idx];
    setForm({
      time: c.time || "",
      pais: c.pais || "",
      ano: c.ano || "",
      modelo: c.modelo || "",
      fornecedor: c.fornecedor || "",
      numero_nome: c.numero_nome || "",
      oficial: c.oficial || "",
      observacoes: c.observacoes || "",
    });
  }, [idx, camisas]);

  const atual = camisas[idx];
  const totalRevisadas = camisas.filter((c) => c.revisado).length;

  const salvar = useCallback(async (marcarRevisado) => {
    if (!atual || !form) return true;
    setSalvando(true);
    setErro("");
    const atualizacao = { ...form };
    if (marcarRevisado) {
      atualizacao.revisado = true;
      atualizacao.revisado_em = new Date().toISOString();
    }
    const { error } = await supabase.from("camisas").update(atualizacao).eq("id", atual.id);
    setSalvando(false);
    if (error) {
      setErro("Não consegui salvar. Veja a internet e tente de novo.");
      return false;
    }
    setCamisas((prev) => prev.map((c, i) => (i === idx ? { ...c, ...atualizacao } : c)));
    return true;
  }, [atual, form, idx]);

  async function irPara(novoIdx) {
    const ok = await salvar(false); // guarda as edições, sem marcar como confirmada
    if (!ok) return;
    setIdx(Math.max(0, Math.min(camisas.length - 1, novoIdx)));
    window.scrollTo(0, 0);
  }

  async function confirmar() {
    const ok = await salvar(true);
    if (!ok) return;
    const proxima = camisas.findIndex((c, i) => i > idx && !c.revisado);
    if (proxima !== -1) setIdx(proxima);
    else if (idx < camisas.length - 1) setIdx(idx + 1);
    window.scrollTo(0, 0);
  }

  if (estado === "carregando") return <Tela><p className="aviso">Carregando…</p></Tela>;
  if (estado === "erro") return <Tela><p className="aviso">Não consegui abrir. Tente recarregar a página.</p></Tela>;
  if (estado === "vazio") return <Tela><p className="aviso">Nenhuma camisa cadastrada ainda.</p></Tela>;
  if (!form || !atual) return null;

  return (
    <Tela>
      <header className="topo">
        <div className="contador">Camisa {idx + 1} de {camisas.length}</div>
        <div className="progresso">{totalRevisadas} já confirmadas</div>
      </header>

      <div className="fotos">
        {atual.foto_frente && (
          <figure><img src={atual.foto_frente} alt="Frente da camisa" /><figcaption>Frente</figcaption></figure>
        )}
        {atual.foto_verso && (
          <figure><img src={atual.foto_verso} alt="Verso da camisa" /><figcaption>Verso</figcaption></figure>
        )}
      </div>

      {atual.revisado && <div className="selo">✓ Já confirmada — pode mudar se quiser</div>}

      <div className="campos">
        {CAMPOS.map(({ chave, rotulo }) => (
          <label key={chave} className="campo">
            <span>{rotulo}</span>
            <input value={form[chave]} onChange={(e) => setForm({ ...form, [chave]: e.target.value })} />
          </label>
        ))}

        <div className="campo">
          <span>É oficial do clube?</span>
          <div className="sim-nao">
            <button type="button" className={form.oficial === "Sim" ? "sel" : ""} onClick={() => setForm({ ...form, oficial: "Sim" })}>Sim</button>
            <button type="button" className={form.oficial === "Não" ? "sel" : ""} onClick={() => setForm({ ...form, oficial: "Não" })}>Não</button>
          </div>
        </div>

        <label className="campo">
          <span>Observações (algo a acrescentar?)</span>
          <textarea rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
        </label>
      </div>

      {erro && <p className="erro">{erro}</p>}

      <button className="confirmar" onClick={confirmar} disabled={salvando}>
        {salvando ? "Salvando…" : "✓ Está tudo certo"}
      </button>

      <nav className="navegacao">
        <button onClick={() => irPara(idx - 1)} disabled={idx === 0 || salvando}>← Anterior</button>
        <button onClick={() => irPara(idx + 1)} disabled={idx === camisas.length - 1 || salvando}>Próxima →</button>
      </nav>
    </Tela>
  );
}

function Tela({ children }) {
  return <main className="tela">{children}</main>;
}
