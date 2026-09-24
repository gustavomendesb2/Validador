import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
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

// Caixa de texto que cresce com o conteúdo.
//
// Por que não é um campo comum de uma linha: no celular, "Segunda camisa do
// centenário (edição especial)" não cabe na largura da tela, e o que não cabe
// some para o lado sem aviso. Ele não pode validar o que não está vendo.
// Aqui a caixa ganha linha conforme precisa, e nada fica escondido.
function Caixa({ valor, aoMudar, linhas = 1, ...resto }) {
  const ref = useRef(null);

  const ajustar = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    // A altura medida não conta a borda, mas a altura que se aplica conta
    // (box-sizing: border-box). Sem somar a borda de volta, sobra sempre um
    // fio de texto escondido — medido em 16/09/2026: 4 px, e a última linha
    // ficava cortada ao meio.
    const borda = el.offsetHeight - el.clientHeight;
    el.style.height = el.scrollHeight + borda + "px";
  }, []);

  // Antes de pintar, para ele nunca ver a caixa pulando de tamanho.
  useLayoutEffect(ajustar, [valor, ajustar]);

  // Girar o celular muda a largura, e o que cabia em duas linhas passa a caber
  // em três — ou o contrário.
  useEffect(() => {
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, [ajustar]);

  return (
    <textarea
      ref={ref}
      className="cresce"
      rows={linhas}
      value={valor}
      onChange={(e) => {
        // Num campo de uma linha, Enter não tem sentido: vira espaço.
        aoMudar(linhas === 1 ? e.target.value.replace(/[\r\n]+/g, " ") : e.target.value);
      }}
      onKeyDown={(e) => {
        if (linhas === 1 && e.key === "Enter") e.preventDefault();
      }}
      {...resto}
    />
  );
}

export default function Validador() {
  const [camisas, setCamisas] = useState([]);
  const [idx, setIdx] = useState(0);
  const [form, setForm] = useState(null);
  const [acrescimo, setAcrescimo] = useState("");
  const [estado, setEstado] = useState("carregando"); // carregando | ok | erro | vazio
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  // Respostas às anotações dele, com a prova (texto e imagens). Quando a
  // anotação não procede, a camisa volta para a fila dele com a explicação,
  // em vez de a correção ser ignorada em silêncio (23/09/2026).
  const [provas, setProvas] = useState({});

  useEffect(() => {
    fetch("/provas.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then(setProvas)
      .catch(() => {});
  }, []);

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

    const novas = camisas.map((c, i) => (i === idx ? { ...c, ...atualizacao } : c));
    setCamisas(novas);

    // Segue para a próxima que ele ainda não conferiu, e não simplesmente para
    // a seguinte da fila: quando uma camisa antiga volta para ele conferir de
    // novo, as já conferidas depois dela não podem ficar no caminho.
    const depois = novas.findIndex((c, i) => i > idx && !c.revisado);
    const antes = novas.findIndex((c) => !c.revisado);
    const proxima = depois !== -1 ? depois : antes !== -1 ? antes : idx + 1;
    if (proxima < novas.length) setIdx(proxima);
    window.scrollTo(0, 0);
  }, [atual, form, acrescimo, idx, camisas]);

  function voltar() {
    if (idx === 0) return;
    setIdx(idx - 1);
    window.scrollTo(0, 0);
  }

  if (estado === "carregando") return <Tela><p className="aviso">Carregando…</p></Tela>;
  if (estado === "erro") return <Tela><p className="aviso">Não consegui abrir. Tente recarregar a página.</p></Tela>;
  if (estado === "vazio") return <Tela><p className="aviso">Nenhuma camisa cadastrada ainda.</p></Tela>;
  if (!form || !atual) return null;

  // O que ele mesmo já escreveu nesta camisa. Cada acréscimo é gravado no fim
  // da observação depois de uma linha em branco e um travessão; o primeiro
  // pedaço é a observação do catálogo, que não é dele. Sem mostrar isto, ele
  // voltava na camisa, via a caixa vazia e achava que não tinha salvado —
  // e escrevia de novo (camisa_027 ficou com três versões, 22/09/2026).
  const pedacos = (atual.observacoes || "").split(/\n\n— /);
  // A observação do catálogo às vezes traz, no fim do primeiro pedaço, uma
  // nota interna de catalogação ("Nota: …", "Pareamento: …") — anotação para
  // conferência nossa, não curiosidade para ele ler (23/09/2026).
  const curiosidade = pedacos[0].split(/\n\n(?:Nota|Pareamento):/)[0].trim();
  const notas = pedacos.slice(1).map((t) => t.trim()).filter(Boolean);

  const prova = provas[atual.id];
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

      {curiosidade && (
        <section className="curiosidade">
          <h2>Curiosidade sobre esta camisa</h2>
          <p>{curiosidade}</p>
        </section>
      )}

      {prova && (
        <section className="prova">
          <h2>{prova.titulo}</h2>
          <p>{prova.texto}</p>
          {(prova.imagens || []).map((im, k) => (
            <figure key={k}>
              <img src={im.src} alt={im.legenda} loading="lazy" />
              <figcaption>{im.legenda}</figcaption>
            </figure>
          ))}
          {prova.fonte && <small>{prova.fonte}</small>}
        </section>
      )}

      <div className="campos">
        {CAMPOS.map(({ chave, rotulo }) => (
          <label key={chave} className="campo">
            <span>{rotulo}</span>
            <Caixa
              valor={form[chave]}
              aoMudar={(v) => setForm({ ...form, [chave]: v })}
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

      {notas.length > 0 && (
        <div className="ja-escreveu">
          <span>✓ O que você já escreveu sobre esta camisa (está salvo):</span>
          {notas.map((t, k) => <p key={k}>{t}</p>)}
        </div>
      )}

      <label className="campo acrescentar">
        <span>{notas.length > 0 ? "Quer acrescentar mais alguma coisa?" : "Quer acrescentar alguma coisa sobre esta camisa?"}</span>
        <small>Se souber alguma história dela, escreva aqui. Só acrescenta — não apaga nada.</small>
        <Caixa
          linhas={3}
          placeholder="Pode deixar em branco"
          valor={acrescimo}
          aoMudar={setAcrescimo}
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
