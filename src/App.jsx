import { useState, useEffect, useCallback, useMemo } from "react";
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

// Campos que ele pode corrigir. Serve para saber se mexeu em alguma coisa.
const EDITAVEIS = [...CAMPOS.map((c) => c.chave), "oficial"];

export default function App() {
  const [camisas, setCamisas] = useState([]);
  const [idx, setIdx] = useState(0);
  const [form, setForm] = useState(null);
  const [acrescimo, setAcrescimo] = useState("");
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
    });
    setAcrescimo("");
    setErro("");
  }, [idx, camisas]);

  const atual = camisas[idx];
  const totalConfirmadas = camisas.filter((c) => c.revisado).length;

  // Ele mexeu em alguma coisa? É isso que muda o texto do botão.
  const mexeu = useMemo(() => {
    if (!atual || !form) return false;
    const algumCampoMudou = EDITAVEIS.some(
      (k) => (form[k] || "") !== (atual[k] || "")
    );
    return algumCampoMudou || acrescimo.trim().length > 0;
  }, [atual, form, acrescimo]);

  const confirmar = useCallback(async () => {
    if (!atual || !form) return;
    setSalvando(true);
    setErro("");

    const atualizacao = { ...form, revisado: true, revisado_em: new Date().toISOString() };

    // O que ele escrever é ACRESCENTADO ao que já estava, nunca por cima.
    const extra = acrescimo.trim();
    if (extra) {
      const jaTinha = (atual.observacoes || "").trim();
      atualizacao.observacoes = jaTinha
        ? `${jaTinha}\n\n— ${extra}`
        : extra;
    }

    const { error } = await supabase.from("camisas").update(atualizacao).eq("id", atual.id);
    setSalvando(false);
    if (error) {
      setErro("Não consegui salvar. Veja se a internet está funcionando e toque no botão de novo.");
      return;
    }

    setCamisas((prev) => prev.map((c, i) => (i === idx ? { ...c, ...atualizacao } : c)));

    if (idx < camisas.length - 1) setIdx(idx + 1);
    window.scrollTo(0, 0);
  }, [atual, form, acrescimo, idx, camisas.length]);

  function voltar() {
    if (idx === 0) return;
    setIdx(idx - 1);
    window.scrollTo(0, 0);
  }

  if (estado === "carregando") return <Tela><p className="aviso">Carregando…</p></Tela>;
  if (estado === "erro") return <Tela><p className="aviso">Não consegui abrir. Tente recarregar a página.</p></Tela>;
  if (estado === "vazio") return <Tela><p className="aviso">Nenhuma camisa cadastrada ainda.</p></Tela>;
  if (!form || !atual) return null;

  const ultima = idx === camisas.length - 1;
  const tudoPronto = totalConfirmadas === camisas.length;

  return (
    <Tela>
      <header className="topo">
        <div className="contador">Camisa {idx + 1} de {camisas.length}</div>
        <div className="progresso">{totalConfirmadas} já conferidas</div>
      </header>

      <p className="instrucao">
        Olhe as fotos e confira os dados abaixo. Se estiver tudo certo, é só tocar no
        botão verde. Se algo estiver errado, corrija antes de tocar nele.
      </p>

      <div className="fotos">
        {atual.foto_frente && (
          <figure><img src={atual.foto_frente} alt="Frente da camisa" /><figcaption>Frente</figcaption></figure>
        )}
        {atual.foto_verso && (
          <figure><img src={atual.foto_verso} alt="Verso da camisa" /><figcaption>Verso</figcaption></figure>
        )}
      </div>

      {atual.revisado && <div className="selo">✓ Você já conferiu esta — pode mudar se quiser</div>}

      <div className="campos">
        {CAMPOS.map(({ chave, rotulo }) => (
          <label key={chave} className="campo">
            <span>{rotulo}</span>
            <input
              value={form[chave]}
              onChange={(e) => setForm({ ...form, [chave]: e.target.value })}
            />
          </label>
        ))}

        <div className="campo">
          <span>É oficial do clube?</span>
          <div className="sim-nao">
            <button type="button" className={form.oficial === "Sim" ? "sel" : ""} onClick={() => setForm({ ...form, oficial: "Sim" })}>Sim</button>
            <button type="button" className={form.oficial === "Não" ? "sel" : ""} onClick={() => setForm({ ...form, oficial: "Não" })}>Não</button>
          </div>
        </div>
      </div>

      <label className="campo acrescentar">
        <span>Quer acrescentar alguma coisa sobre esta camisa?</span>
        <small>Se souber alguma história dela, escreva aqui. Só acrescenta — não apaga nada.</small>
        <textarea
          rows={3}
          placeholder="Pode deixar em branco"
          value={acrescimo}
          onChange={(e) => setAcrescimo(e.target.value)}
        />
      </label>

      {erro && <p className="erro">{erro}</p>}

      <button className="confirmar" onClick={confirmar} disabled={salvando}>
        {salvando
          ? "Salvando…"
          : mexeu
            ? (ultima ? "Salvar minhas correções e terminar" : "Salvar minhas correções e ir para a próxima")
            : (ultima ? "Está tudo certo — terminar" : "Está tudo certo — ir para a próxima")}
      </button>

      <p className="dica">
        {mexeu
          ? "Você mudou alguma coisa. O botão verde salva a sua correção."
          : "Só toque no botão verde depois de olhar as fotos e conferir os dados."}
      </p>

      <nav className="navegacao">
        <button onClick={voltar} disabled={idx === 0 || salvando}>
          ← Voltar para a anterior
        </button>
      </nav>

      {tudoPronto && (
        <p className="fim">Você já conferiu todas as {camisas.length}. Obrigado!</p>
      )}
    </Tela>
  );
}

function Tela({ children }) {
  return <main className="tela">{children}</main>;
}
