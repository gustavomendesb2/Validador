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

// Sem acento e sem maiúscula, para "sao paulo" achar "São Paulo".
const sem = (v) =>
  (v == null ? "" : String(v)).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Apelidos que ele vai digitar e que não estão no nome cadastrado: as camisas
// do Galo estão como "Atlético-MG" ou "Clube Atlético Mineiro" (24/09/2026).
const APELIDOS = [
  [/atletico[- ]?mg|atletico mineiro/, "galo"],
  [/flamengo/, "mengao mengo"],
  [/corinthians/, "timao"],
  [/palmeiras/, "verdao porco"],
  [/^santos|santos fc|santos futebol/, "peixe"],
  [/cruzeiro/, "raposa"],
  [/america (mineiro|futebol clube \(mg\))|america-mg/, "coelho"],
];
const apelidos = (time) => {
  const t = sem(time);
  return APELIDOS.filter(([re]) => re.test(t)).map(([, a]) => a).join(" ");
};

// A miniatura de cada foto fica no mesmo caminho, dentro de "miniaturas/"
// (gerada no envio por scripts/miniaturas.py). A galeria usa só miniaturas:
// as 417 fotos originais pesariam ~50 MB no celular dele (24/09/2026).
const miniatura = (url) => (url || "").replace("/fotos-camisas/", "/fotos-camisas/miniaturas/");

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
  // fila: conferindo as que faltam, na ordem · lista: galeria de todas ·
  // camisa: uma camisa aberta pela galeria · fim: não há nada pendente
  const [modo, setModo] = useState("fila");
  const [form, setForm] = useState(null);
  const [acrescimo, setAcrescimo] = useState("");
  const [estado, setEstado] = useState("carregando"); // carregando | ok | erro | vazio
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState("nome"); // nome | chegada
  const rolagemLista = useRef(0);
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

  // Carrega todas as camisas. Se houver alguma que ele ainda não conferiu,
  // começa nela; se não houver, mostra que terminou — e não recomeça da
  // primeira (em 24/09/2026 isso o fez reconferir 300 camisas sem precisar).
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
      if (pendente === -1) setModo("fim");
      else setIdx(pendente);
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

  // Ao voltar para a lista, ele volta para o mesmo ponto em que estava; em
  // qualquer outra troca de tela, começa do topo.
  useLayoutEffect(() => {
    if (modo === "lista") window.scrollTo(0, rolagemLista.current);
    else window.scrollTo(0, 0);
  }, [modo, idx]);

  const atual = camisas[idx];
  const totalConfirmadas = camisas.filter((c) => c.revisado).length;
  const pendentes = camisas.length - totalConfirmadas;

  // Ele mexeu em alguma coisa? É isso que muda o texto do botão.
  const mexeu = useMemo(() => {
    if (!atual || !form) return false;
    const algumCampoMudou = EDITAVEIS.some(
      (k) => (form[k] || "") !== (atual[k] || "")
    );
    return algumCampoMudou || acrescimo.trim().length > 0;
  }, [atual, form, acrescimo]);

  const continuarConferindo = useCallback(() => {
    const p = camisas.findIndex((c) => !c.revisado);
    if (p === -1) { setModo("fim"); return; }
    setIdx(p);
    setModo("fila");
  }, [camisas]);

  const abrirLista = useCallback(() => {
    rolagemLista.current = 0;
    setModo("lista");
  }, []);

  const abrirDaLista = useCallback((i) => {
    rolagemLista.current = window.scrollY;
    setIdx(i);
    setModo("camisa");
  }, []);

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

    // Aberta pela lista: volta para a lista, no mesmo ponto em que ele estava.
    if (modo === "camisa") { setModo("lista"); return; }

    // Na fila: segue para a próxima que ele ainda não conferiu, e não para a
    // seguinte da ordem — as já conferidas não podem ficar no caminho.
    const depois = novas.findIndex((c, i) => i > idx && !c.revisado);
    const antes = novas.findIndex((c) => !c.revisado);
    const proxima = depois !== -1 ? depois : antes;
    if (proxima === -1) setModo("fim");
    else setIdx(proxima);
  }, [atual, form, acrescimo, idx, camisas, modo]);

  function voltar() {
    if (idx === 0) return;
    setIdx(idx - 1);
  }

  if (estado === "carregando") return <Tela><p className="aviso">Carregando…</p></Tela>;
  if (estado === "erro") return <Tela><p className="aviso">Não consegui abrir. Tente recarregar a página.</p></Tela>;
  if (estado === "vazio") return <Tela><p className="aviso">Nenhuma camisa cadastrada ainda.</p></Tela>;

  // Só aparece quando há camisa esperando por ele.
  const faixaContinuar = pendentes > 0 && (
    <button className="faixa-continuar" onClick={continuarConferindo}>
      <span>{pendentes === 1 ? "Falta 1 camisa para conferir" : `Faltam ${pendentes} camisas para conferir`}</span>
      <strong>Continuar conferindo →</strong>
    </button>
  );

  if (modo === "fim") {
    return (
      <Tela>
        <div className="fim-tela">
          <p className="fim-titulo">✓ Você já conferiu todas as {camisas.length} camisas.</p>
          <p className="fim-obrigado">Obrigado!</p>
          <p className="fim-texto">Quando chegar camisa nova, ela aparece aqui para você conferir.</p>
          <button className="botao-grande" onClick={abrirLista}>Ver todas as camisas</button>
        </div>
      </Tela>
    );
  }

  if (modo === "lista") {
    return (
      <Lista
        camisas={camisas}
        busca={busca}
        setBusca={setBusca}
        ordem={ordem}
        setOrdem={setOrdem}
        aoAbrir={abrirDaLista}
        faixa={faixaContinuar}
      />
    );
  }

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
  const naFila = modo === "fila";
  const outrasPendentes = camisas.some((c, i) => i !== idx && !c.revisado);

  const textoBotao = salvando
    ? "Salvando…"
    : !naFila
      ? (mexeu ? "Salvar minhas correções e voltar para a lista" : "Está tudo certo — voltar para a lista")
      : mexeu
        ? (outrasPendentes ? "Salvar minhas correções e ir para a próxima" : "Salvar minhas correções e terminar")
        : (outrasPendentes ? "Está tudo certo — ir para a próxima" : "Está tudo certo — terminar");

  return (
    <Tela>
      {naFila ? (
        <>
          <header className="topo">
            <div className="contador">
              {pendentes === 1 ? "Falta 1 para conferir" : `Faltam ${pendentes} para conferir`}
            </div>
            <div className="progresso">{totalConfirmadas} já conferidas</div>
          </header>
          <button className="ver-todas" onClick={abrirLista}>Ver todas as camisas</button>
          <p className="instrucao">
            Olhe as fotos e confira os dados abaixo. Se estiver tudo certo, é só tocar no
            botão verde. Se algo estiver errado, corrija antes de tocar nele.
          </p>
        </>
      ) : (
        <>
          <button className="voltar-lista" onClick={() => setModo("lista")}>← Voltar para a lista</button>
          {faixaContinuar}
        </>
      )}

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
              <img src={im.src} alt={im.legenda} />
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
        {textoBotao}
      </button>

      <p className="dica">
        {mexeu
          ? "Você mudou alguma coisa. O botão verde salva a sua correção."
          : "Só toque no botão verde depois de olhar as fotos e conferir os dados."}
      </p>

      <nav className="navegacao">
        {naFila ? (
          <button onClick={voltar} disabled={idx === 0 || salvando}>
            ← Voltar para a anterior
          </button>
        ) : (
          <button onClick={() => setModo("lista")} disabled={salvando}>
            ← Voltar para a lista sem salvar
          </button>
        )}
      </nav>
    </Tela>
  );
}

// Galeria de todas as camisas, com busca. Ele rola, acha e toca na que quer.
function Lista({ camisas, busca, setBusca, ordem, setOrdem, aoAbrir, faixa }) {
  const itens = useMemo(() => {
    const termos = sem(busca).split(/\s+/).filter(Boolean);
    const lista = camisas
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => {
        if (termos.length === 0) return true;
        const texto = sem([c.time, apelidos(c.time), c.pais, c.ano, c.modelo, c.fornecedor, c.numero_nome].join(" "));
        return termos.every((t) => texto.includes(t));
      });
    if (ordem === "nome") {
      lista.sort((a, b) =>
        (a.c.time || "").trim().localeCompare((b.c.time || "").trim(), "pt", { sensitivity: "base" }) ||
        (a.c.ordem || 0) - (b.c.ordem || 0)
      );
    }
    return lista;
  }, [camisas, busca, ordem]);

  return (
    <Tela>
      <h1 className="lista-titulo">Todas as camisas</h1>
      {faixa}

      <label className="busca">
        <span>Procurar camisa</span>
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Ex.: Galo, Boca, 2014, adidas"
          enterKeyHint="search"
        />
      </label>

      <div className="ordem" role="group" aria-label="Ordem da lista">
        <button type="button" className={ordem === "nome" ? "sel" : ""} onClick={() => setOrdem("nome")}>Por nome do time</button>
        <button type="button" className={ordem === "chegada" ? "sel" : ""} onClick={() => setOrdem("chegada")}>Por ordem de chegada</button>
      </div>

      <p className="contagem">
        {busca.trim()
          ? (itens.length === 0 ? "Nenhuma camisa encontrada." : `${itens.length} ${itens.length === 1 ? "camisa encontrada" : "camisas encontradas"}`)
          : `${camisas.length} camisas`}
      </p>

      <div className="grade">
        {itens.map(({ c, i }) => (
          <button key={c.id} className="cartao" onClick={() => aoAbrir(i)}>
            <img
              src={miniatura(c.foto_frente)}
              alt=""
              loading="lazy"
              onError={(e) => {
                if (e.currentTarget.src !== c.foto_frente) e.currentTarget.src = c.foto_frente;
              }}
            />
            <span className="cartao-time">{c.time}</span>
            <span className="cartao-ano">{c.ano}</span>
            {!c.revisado && <span className="cartao-falta">Falta conferir</span>}
          </button>
        ))}
      </div>
    </Tela>
  );
}

function Tela({ children }) {
  return <main className="tela">{children}</main>;
}
