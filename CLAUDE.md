# Validador de Camisas — contexto do projeto

## O que é
App web onde meu sogro (idoso, pouca familiaridade com tecnologia, usando o **celular**)
valida e corrige, **uma camisa por vez**, os dados de uma coleção de ~400 camisas de futebol
que foram catalogadas por IA. Ele recebe um único link; cada confirmação salva direto no banco.

## Stack
- Frontend: **React + Vite** (este repositório).
- Dados e fotos: **Supabase** (Postgres + Storage).
- Cliente: **@supabase/supabase-js**.
- Deploy: **Vercel** (o link de produção é fixo).

## Banco (Supabase) — tabela `camisas`
Campos: `id` (text, PK), `time`, `pais`, `ano`, `modelo`, `fornecedor`, `numero_nome`,
`oficial` ("Sim"/"Não"), `foto_frente` (url), `foto_verso` (url), `observacoes`,
`dados_ia` (jsonb, palpite original da IA), `revisado` (bool), `revisado_em` (timestamptz),
`ordem` (serial, ordem de navegação).
RLS: a chave anon pode **ler e atualizar**, não pode inserir nem apagar.

## Estrutura do app
- `src/supabaseClient.js` — cria o cliente com as env vars.
- `src/App.jsx` — a tela única de validação.
- `src/App.css` — estilo.

## Variáveis de ambiente (em `.env.local`, NUNCA commitar)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`  ← chave **anon** (pública). 

## Regras inegociáveis
- A chave **service_role** do Supabase JAMAIS entra neste app. Ela só vive no script de seed local.
- Nunca sobrescrever o campo `dados_ia` — ele guarda o palpite original da IA para comparação.
- A UI é em **português do Brasil**.

## Princípios de design (usuário idoso no celular)
- Mobile-first, alto contraste, fonte de sistema (legível, sem importar fonte externa).
- Alvos de toque grandes (mínimo ~56px), texto grande, **uma camisa por tela**, sem tabela.
- O botão principal é o gesto certo: "✓ Está tudo certo" (verde, grande).
- Respeitar `prefers-reduced-motion` e foco visível no teclado.

## O que NÃO fica neste repositório
Os scripts Python (catalogador e seed) rodam só na minha máquina e não são deployados.
Mantê-los fora deste repo mantém o deploy limpo e os segredos longe do Git.
