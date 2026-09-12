import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import "./painel.css";

// Campos que o sogro pode alterar na tela dele. São esses que comparamos
// contra o catálogo original para saber o que ele corrigiu.
const CAMPOS = [
  { chave: "time", rotulo: "Time" },
  { chave: "pais", rotulo: "País" },
  { chave: "ano", rotulo: "Ano" },
  { chave: "modelo", rotulo: "Modelo" },
  { chave: "fornecedor", rotulo: "Marca" },
  { chave: "numero_nome", rotulo: "Número / Nome" },
  { chave: "oficial", rotulo: "Oficial do clube" },
];

const norm = (v) => (v == null ? "" : String(v)).trim();

function diferencas(camisa, base) {
  if (!base) return [];
  return CAMPOS.filter(({ chave }) => norm(camisa[chave]) !== norm(base[chave])).map(
    ({ chave, rotulo }) => ({ chave, rotulo, antes: norm(base[chave]), agora: norm(camisa[chave]) })
  );
}

function quando(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.round(h / 24);
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  return d.toLocaleDateString("pt-BR");
}

export default function Painel({ rota, navegar }) {
  const [camisas, setCamisas] = useState([]);
  const [base, setBase] = useState(null);
  const [estado, setEstado] = useState("carregando");

  useEffect(() => {
    (async () => {
      const [res, baseRes] = await Promise.all([
        supabase.from("camisas").select("*").order("ordem", { ascending: true }),
        fetch("/catalogo-base.json").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (res.error) { setEstado("erro"); return; }
      setCamisas(res.data || []);
      setBase(baseRes);
      setEstado("ok");
    })();
  }, []);

  const enriquecidas = useMemo(
    () => camisas.map((c) => ({ ...c, _dif: diferencas(c, base?.[c.id]), _base: base?.[c.id] || null })),
    [camisas, base]
  );

  if (estado === "carregando") return <Casca><p className="p-aviso">Carregando…</p></Casca>;
  if (estado === "erro") return <Casca><p className="p-aviso">Não consegui abrir o banco.</p></Casca>;

  if (rota[0] === "camisa" && rota[1]) {
    const c = enriquecidas.find((x) => x.id === rota[1]);
    if (!c) return <Casca><p className="p-aviso">Camisa não encontrada.</p></Casca>;
    return <Ficha camisa={c} navegar={navegar} lista={enriquecidas} />;
  }
  if (rota[0] === "camisas") return <Lista camisas={enriquecidas} navegar={navegar} />;
  return <Resumo camisas={enriquecidas} navegar={navegar} />;
}

function Casca({ children }) {
  return <main className="painel">{children}</main>;
}

/* ---------- Visão geral ---------- */

function Resumo({ camisas, navegar }) {
  const total = camisas.length;
  const feitas = camisas.filter((c) => c.revisado);
  const corrigidas = feitas.filter((c) => c._dif.length > 0);
  const pct = total ? Math.round((feitas.length / total) * 100) : 0;

  const ultima = feitas
    .filter((c) => c.revisado_em)
    .sort((a, b) => new Date(b.revisado_em) - new Date(a.revisado_em))[0];

  const proxima = camisas.find((c) => !c.revisado);

  const hoje = new Date().toDateString();
  const ontem = new Date(Date.now() - 86400000).toDateString();
  const noDia = (d) => feitas.filter((c) => c.revisado_em && new Date(c.revisado_em).toDateString() === d).length;

  const faltam = total - feitas.length;
  const porDia = noDia(hoje) || noDia(ontem);
  const previsao = porDia > 0 ? Math.ceil(faltam / porDia) : null;

  return (
    <Casca>
      <h1 className="p-titulo">Como está indo</h1>

      <section className="p-cartao">
        <div className="p-numerao">{feitas.length}<span> de {total}</span></div>
        <div className="p-barra"><div style={{ width: `${pct}%` }} /></div>
        <p className="p-legenda">{pct}% conferido · faltam {faltam}</p>
      </section>

      <div className="p-grade2">
        <section className="p-cartao">
          <h2>Onde ele parou</h2>
          {ultima ? (
            <>
              <p className="p-forte">{ultima.time}{ultima.ano ? ` · ${ultima.ano}` : ""}</p>
              <p className="p-legenda">Última conferida {quando(ultima.revisado_em)}</p>
            </>
          ) : (
            <p className="p-legenda">Ele ainda não começou.</p>
          )}
          {proxima && (
            <p className="p-legenda p-prox">
              A próxima da fila é a {proxima.id.replace("camisa_", "nº ")} — {proxima.time}
            </p>
          )}
        </section>

        <section className="p-cartao">
          <h2>Ritmo</h2>
          <p className="p-forte">{noDia(hoje)} hoje · {noDia(ontem)} ontem</p>
          <p className="p-legenda">
            {previsao ? `Nesse passo, faltam uns ${previsao} dia${previsao > 1 ? "s" : ""}.` : "Sem movimento nos últimos dois dias."}
          </p>
        </section>
      </div>

      <section className="p-cartao">
        <h2>O que ele corrigiu</h2>
        <p className="p-forte">{corrigidas.length} de {feitas.length || 0} conferidas</p>
        <p className="p-legenda">
          {feitas.length === 0
            ? "Nada conferido ainda."
            : corrigidas.length === 0
              ? "Ele confirmou tudo sem mudar nada até agora."
              : "Camisas em que ele mexeu em algum campo. Aparecem em âmbar na lista."}
        </p>
        {corrigidas.length > 0 && (
          <ul className="p-mini">
            {corrigidas.slice(0, 5).map((c) => (
              <li key={c.id}>
                <button onClick={() => navegar(["camisa", c.id])}>
                  {c.time} · {c._dif.map((d) => d.rotulo).join(", ")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button className="p-botao" onClick={() => navegar(["camisas"])}>
        Ver as {total} camisas
      </button>
    </Casca>
  );
}

/* ---------- Lista ---------- */

function Lista({ camisas, navegar }) {
  const [filtro, setFiltro] = useState("todas");
  const [busca, setBusca] = useState("");

  const vistas = camisas.filter((c) => {
    if (filtro === "pendentes" && c.revisado) return false;
    if (filtro === "conferidas" && !c.revisado) return false;
    if (filtro === "corrigidas" && c._dif.length === 0) return false;
    const t = busca.trim().toLowerCase();
    if (!t) return true;
    return [c.time, c.pais, c.ano, c.fornecedor, c.modelo].some((v) =>
      norm(v).toLowerCase().includes(t)
    );
  });

  const abas = [
    ["todas", "Todas", camisas.length],
    ["pendentes", "Pendentes", camisas.filter((c) => !c.revisado).length],
    ["conferidas", "Conferidas", camisas.filter((c) => c.revisado).length],
    ["corrigidas", "Corrigidas", camisas.filter((c) => c._dif.length > 0).length],
  ];

  return (
    <Casca>
      <button className="p-voltar" onClick={() => navegar([])}>← Como está indo</button>
      <h1 className="p-titulo">Todas as camisas</h1>

      <div className="p-abas">
        {abas.map(([id, rotulo, n]) => (
          <button key={id} className={filtro === id ? "sel" : ""} onClick={() => setFiltro(id)}>
            {rotulo} <span>{n}</span>
          </button>
        ))}
      </div>

      <input
        className="p-busca"
        placeholder="Buscar por time, país, ano ou marca"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      <p className="p-legenda p-contagem">{vistas.length} camisa{vistas.length === 1 ? "" : "s"}</p>

      <div className="p-grade">
        {vistas.map((c) => (
          <button key={c.id} className="p-card" onClick={() => navegar(["camisa", c.id])}>
            <div className="p-foto">
              {c.foto_frente ? <img src={c.foto_frente} alt="" loading="lazy" /> : <div className="p-sem" />}
              <span className={"p-sinal " + (c._dif.length > 0 ? "amb" : c.revisado ? "ver" : "cin")} />
            </div>
            <strong>{c.time || "—"}</strong>
            <small>{[c.ano, c.fornecedor].filter(Boolean).join(" · ")}</small>
          </button>
        ))}
      </div>
    </Casca>
  );
}

/* ---------- Ficha ---------- */

function Ficha({ camisa: c, navegar, lista }) {
  const i = lista.findIndex((x) => x.id === c.id);
  const anterior = i > 0 ? lista[i - 1] : null;
  const seguinte = i < lista.length - 1 ? lista[i + 1] : null;

  return (
    <Casca>
      <button className="p-voltar" onClick={() => navegar(["camisas"])}>← Todas as camisas</button>

      <h1 className="p-titulo">{c.time || "—"}</h1>
      <p className="p-sub">
        {[c.ano, c.modelo, c.fornecedor].filter(Boolean).join(" · ")}
      </p>

      <div className="p-estado">
        {c.revisado ? (
          <span className="p-tag ver">✓ Conferida {quando(c.revisado_em) || ""}</span>
        ) : (
          <span className="p-tag cin">Ainda não conferida</span>
        )}
        {c._dif.length > 0 && <span className="p-tag amb">Ele corrigiu {c._dif.length} campo{c._dif.length > 1 ? "s" : ""}</span>}
        {c.oficial === "Não" && <span className="p-tag off">Não oficial</span>}
      </div>

      {c._dif.length > 0 && (
        <section className="p-cartao p-dif">
          <h2>O que ele mudou</h2>
          {c._dif.map((d) => (
            <div key={d.chave} className="p-linha-dif">
              <span className="p-rot">{d.rotulo}</span>
              <span className="p-antes">{d.antes || "(vazio)"}</span>
              <span className="p-seta">→</span>
              <span className="p-agora">{d.agora || "(vazio)"}</span>
            </div>
          ))}
        </section>
      )}

      <div className="p-fotos">
        {c.foto_frente && <figure><img src={c.foto_frente} alt="Frente" /><figcaption>Frente</figcaption></figure>}
        {c.foto_verso && <figure><img src={c.foto_verso} alt="Verso" /><figcaption>Verso</figcaption></figure>}
      </div>

      <section className="p-cartao">
        <h2>Dados</h2>
        <dl className="p-dados">
          {CAMPOS.map(({ chave, rotulo }) => (
            <div key={chave}>
              <dt>{rotulo}</dt>
              <dd>{norm(c[chave]) || "—"}</dd>
            </div>
          ))}
          <div><dt>Identificação</dt><dd>{c.id}</dd></div>
        </dl>
      </section>

      {c.observacoes && (
        <section className="p-cartao">
          <h2>Curiosidade</h2>
          <p className="p-texto">{c.observacoes}</p>
        </section>
      )}

      {c._base?.fonte && (
        <section className="p-cartao p-fonte">
          <h2>De onde veio essa classificação</h2>
          <p className="p-texto">{c._base.fonte}</p>
          {c._base.confianca && <p className="p-legenda">Confiança: {c._base.confianca}</p>}
        </section>
      )}

      <nav className="p-nav">
        <button disabled={!anterior} onClick={() => anterior && navegar(["camisa", anterior.id])}>← Anterior</button>
        <button disabled={!seguinte} onClick={() => seguinte && navegar(["camisa", seguinte.id])}>Seguinte →</button>
      </nav>
    </Casca>
  );
}
