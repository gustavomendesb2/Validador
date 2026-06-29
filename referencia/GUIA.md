# Validador de Camisas — Guia completo

Tudo que você precisa para colocar o projeto no ar: criar as contas, subir as camisas e mandar um único link pro seu sogro. Os arquivos do código já estão prontos nesta pasta.

**Como as peças se encaixam:** o **Supabase** guarda os dados e as fotos; o **app no Vercel** é só a tela que lê e grava no Supabase; cada confirmação do seu sogro cai na tabela na hora, e você acompanha de longe. Os dados moram no Supabase, não no app — por isso adicionar camisas depois **não exige mexer no Vercel**.

---

## Pré-requisitos (uma vez só)
- Node.js instalado (versão 18+).
- Python instalado (você já tem, do catalogador).
- Conta no GitHub, no Supabase e no Vercel (todas têm plano grátis que cobre isso de sobra).
- Na sua máquina, numa pasta de trabalho: o `catalogo_camisas.csv` e a pasta `fotos/` (os mesmos que o catalogador usa).

---

## Parte 1 — Supabase (banco + fotos)

1. Em supabase.com, crie um projeto novo. Anote a senha do banco.
2. Menu **SQL Editor** → cole o conteúdo de `supabase_schema.sql` → **Run**. Isso cria a tabela `camisas` e liga a segurança.
3. Menu **Storage** → **New bucket** → nome `fotos-camisas` → marque **Public bucket** → criar.
4. Menu **Settings → API**. Você vai usar três valores:
   - **Project URL** → vai no `.env` do seed e no `.env.local` do app.
   - **anon public** → chave do app (pode aparecer no navegador, tudo bem).
   - **service_role** → chave do seed. **Poder total no banco. Só no seu computador, nunca no GitHub nem no app.**

---

## Parte 2 — Subir as camisas (script de seed)

Na sua pasta de trabalho, junto do `catalogo_camisas.csv` e da pasta `fotos/`, coloque o `seed_supabase.py`.

1. Instale as bibliotecas:
   ```
   pip install supabase python-dotenv
   ```
2. Crie um arquivo `.env` (copie de `.env.example`) e preencha com a **Project URL** e a **service_role**.
3. **Teste com poucas primeiro.** Deixe no CSV só uma mãozinha de camisas (5 a 10) e rode:
   ```
   python seed_supabase.py
   ```
   Ele sobe as fotos para o Storage e insere as linhas no banco. Confira no Supabase (menu **Table Editor → camisas**) se apareceu certo.

O seed é seguro para rodar quantas vezes quiser: ele **só insere camisas novas** e nunca mexe nas que já estão lá — então jamais apaga o que seu sogro já revisou.

---

## Parte 3 — Criar o app

1. Numa pasta nova, crie o projeto Vite:
   ```
   npm create vite@latest validador-camisas -- --template react
   cd validador-camisas
   npm install
   npm install @supabase/supabase-js
   ```
2. Copie para dentro de `src/` os três arquivos da pasta `app/src/` deste pacote: `App.jsx`, `App.css` e `supabaseClient.js` (substituindo o `App.jsx` que veio de fábrica). Pode esvaziar o `src/index.css`.
3. Na raiz do projeto, crie um arquivo `.env.local` (copie de `app/.env.local.example`) com a **Project URL** e a chave **anon**.
4. Rode local para testar:
   ```
   npm run dev
   ```
   Abra o endereço que aparecer. Você deve ver a primeira camisa, com foto e campos. Edite algo, clique em **"Está tudo certo"** e confira no Supabase se a linha foi atualizada e `revisado` virou `true`.

---

## Parte 4 — GitHub + Vercel (publicar)

1. Crie um repositório no GitHub e suba o projeto do app. **Confirme que o `.gitignore` ignora `.env*`** (o template do Vite já faz isso) — a ideia é nunca commitar chave nenhuma.
2. Em vercel.com → **Add New → Project** → importe o repositório.
3. Em **Environment Variables**, cadastre as duas: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (mesmos valores do `.env.local`).
4. **Deploy.** No fim, o Vercel te dá um endereço de produção, tipo `validador-camisas.vercel.app`.

**Esse link de produção é fixo.** Toda vez que você der `git push`, o Vercel republica nesse mesmo endereço. O link que está no WhatsApp do seu sogro continua valendo pra sempre.

---

## Parte 5 — Entregar e acompanhar

- Mande o link único pro seu sogro (de preferência ele abre no **celular**). Ele vê uma camisa por tela, confere/corrige e toca no botão verde. Não baixa nem devolve nada.
- O app abre direto na **primeira camisa ainda não confirmada**, então ele retoma de onde parou a cada dia.
- Você acompanha o avanço no Supabase (**Table Editor**, coluna `revisado`).

---

## Parte 6 — Adicionar mais camisas depois (o fluxo de sempre)

Toda vez que organizar um lote novo:
1. Fotografe e rode o **catalogador** → atualiza o `catalogo_camisas.csv`.
2. Rode o **seed** (`python seed_supabase.py`) → sobe as fotos novas e insere só as camisas novas.
3. Pronto. O seu sogro abre o **mesmo link** e as novas já estão na fila dele. Você não toca no Vercel.

---

## Notas de segurança (rápidas, mas importantes)
- A **service_role** só existe no `.env` do seed, na sua máquina. Nunca no app, nunca no GitHub.
- O app usa a **anon** + as regras de RLS, que só permitem ler e editar a tabela `camisas` (não apagar, não inserir).
- O link é aberto: quem tiver o link consegue editar. Para uma coleção de família é aceitável; basta manter o link privado. Se quiser um cuidado a mais depois, dá para colocar um código secreto na URL — me avisa que eu adapto.
