import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";

// Página "Preciso da sua ajuda".
//
// As perguntas vêm de /duvidas.json, um arquivo estático que o Claude gera
// junto com o catálogo — mesma ideia do catalogo-base.json. As respostas ficam
// guardadas no próprio navegador e, se a tabela `duvidas` existir no banco,
// também são gravadas lá.
//
// Por que o navegador e não só o banco: a chave do app pode ler e atualizar,
// mas não pode criar tabela. Enquanto a tabela não existir, o botão "Copiar
// respostas" resolve — o Gustavo cola no chat e o Claude segue.

const CHAVE = "validador.duvidas.v1";

function lerLocal() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) || "{}");
  } catch {
    return {};
  }
}

function gravarLocal(dados) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(dados));
  } catch {
    /* navegador sem espaço ou em modo privado: segue só em memória */
  }
}

export default function Duvidas({ navegar }) {
  const [perguntas, setPerguntas] = useState(null);
  const [respostas, setRespostas] = useState(lerLocal);
  const [temTabela, setTemTabela] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    fetch("/duvidas.json")
      .then((r) => (r.ok ? r.json() : []))
      .then(setPerguntas)
      .catch(() => setErro("Não consegui carregar as perguntas."));

    // A tabela `duvidas` é opcional. Se ela existir, as respostas também vão
    // para o banco; se não existir, o app nem reclama.
    supabase
      .from("duvidas")
      .select("id,resposta")
      .then(({ data, error }) => {
        if (error || !data) return;
        setTemTabela(true);
        setRespostas((atual) => {
          const juntas = { ...atual };
          for (const linha of data) {
            if (linha.resposta && !juntas[linha.id]) juntas[linha.id] = linha.resposta;
          }
          gravarLocal(juntas);
          return juntas;
        });
      });
  }, []);

  const responder = (id, texto) => {
    const novas = { ...respostas, [id]: texto };
    setRespostas(novas);
    gravarLocal(novas);
    if (temTabela) {
      supabase
        .from("duvidas")
        .update({ resposta: texto, respondido_em: new Date().toISOString() })
        .eq("id", id)
        .then(() => {});
    }
  };

  const respondidas = useMemo(
    () => (perguntas || []).filter((p) => (respostas[p.id] || "").trim()).length,
    [perguntas, respostas]
  );

  const copiar = () => {
    const linhas = (perguntas || [])
      .map((p) => {
        const r = (respostas[p.id] || "").trim();
        if (!r) return null;
        return `${p.camisa} — ${p.titulo}\nPergunta: ${p.pergunta}\nResposta: ${r}`;
      })
      .filter(Boolean);
    const texto = linhas.length
      ? "Respostas do Gustavo:\n\n" + linhas.join("\n\n")
      : "(nenhuma resposta preenchida ainda)";
    navigator.clipboard?.writeText(texto).then(
      () => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2500);
      },
      () => setErro("O navegador não deixou copiar. Selecione o texto na mão.")
    );
  };

  if (erro && !perguntas) return <p className="p-aviso">{erro}</p>;
  if (!perguntas) return <p className="p-aviso">Carregando…</p>;

  if (perguntas.length === 0) {
    return (
      <>
        <h1 className="p-titulo">Preciso da sua ajuda</h1>
        <p className="p-sub">Nada pendente agora. Quando eu travar em alguma camisa, ela aparece aqui.</p>
      </>
    );
  }

  return (
    <>
      <h1 className="p-titulo">Preciso da sua ajuda</h1>
      <p className="p-sub">
        {perguntas.length} coisa{perguntas.length > 1 ? "s" : ""} que eu não consegui resolver sozinho
        {respondidas > 0 ? ` · ${respondidas} respondida${respondidas > 1 ? "s" : ""}` : ""}
      </p>

      <div className="p-acoes">
        <button className="p-botao p-copiar" onClick={copiar}>
          {copiado ? "Copiado ✓" : "Copiar respostas para mandar ao Claude"}
        </button>
        {temTabela && <span className="p-tag ver">Salvando no banco</span>}
      </div>
      {erro && <p className="p-legenda">{erro}</p>}

      {perguntas.map((p, i) => (
        <Duvida
          key={p.id}
          n={i + 1}
          duvida={p}
          resposta={respostas[p.id] || ""}
          onResponder={(t) => responder(p.id, t)}
          navegar={navegar}
        />
      ))}

      <section className="p-cartao p-sql">
        <h2>Opcional — salvar direto no banco</h2>
        <p className="p-legenda">
          Hoje as respostas ficam guardadas neste navegador e você me manda pelo botão de copiar.
          Se quiser que elas gravem direto no banco, cole o bloco abaixo uma única vez no editor
          de SQL do Supabase. Depois disso a página passa a salvar sozinha.
        </p>
        <pre className="p-codigo">{SQL_DUVIDAS}</pre>
        <button
          className="p-botao p-secundario"
          onClick={() => navigator.clipboard?.writeText(SQL_DUVIDAS)}
        >
          Copiar o comando
        </button>
      </section>
    </>
  );
}

function Duvida({ n, duvida: d, resposta, onResponder, navegar }) {
  const [texto, setTexto] = useState(resposta);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => setTexto(resposta), [resposta]);

  const salvar = () => {
    onResponder(texto);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 1800);
  };

  const respondida = (resposta || "").trim().length > 0;

  return (
    <section className={"p-cartao p-duvida" + (respondida ? " respondida" : "")}>
      <div className="p-duvida-topo">
        <span className="p-numero">{n}</span>
        <div>
          <strong className="p-duvida-titulo">{d.titulo}</strong>
          {d.camisa && (
            <button className="p-link" onClick={() => navegar(["camisa", d.camisa])}>
              {d.camisa.replace("camisa_", "camisa nº ")}
            </button>
          )}
        </div>
        {respondida && <span className="p-tag ver">respondida</span>}
      </div>

      {d.fotos?.length > 0 && (
        <div className="p-duvida-fotos">
          {d.fotos.map((f) => (
            <a key={f} href={f} target="_blank" rel="noreferrer">
              <img src={f} alt="" loading="lazy" />
            </a>
          ))}
        </div>
      )}

      {d.contexto && <p className="p-texto">{d.contexto}</p>}

      <p className="p-pergunta">{d.pergunta}</p>

      {d.opcoes?.length > 0 && (
        <div className="p-opcoes">
          {d.opcoes.map((o) => (
            <button
              key={o}
              className={texto === o ? "sel" : ""}
              onClick={() => {
                setTexto(o);
                onResponder(o);
                setSalvo(true);
                setTimeout(() => setSalvo(false), 1800);
              }}
            >
              {o}
            </button>
          ))}
        </div>
      )}

      <textarea
        className="p-resposta"
        rows={3}
        placeholder="Escreva aqui o que você vê na peça"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <div className="p-duvida-rodape">
        <button className="p-botao p-secundario" onClick={salvar} disabled={!texto.trim()}>
          {salvo ? "Guardado ✓" : "Guardar resposta"}
        </button>
      </div>
    </section>
  );
}

const SQL_DUVIDAS = `create table if not exists duvidas (
  id text primary key,
  camisa text,
  titulo text,
  pergunta text,
  resposta text,
  respondido_em timestamptz
);

alter table duvidas enable row level security;

create policy "anon le duvidas"     on duvidas for select to anon using (true);
create policy "anon responde duvidas" on duvidas for update to anon using (true) with check (true);`;
