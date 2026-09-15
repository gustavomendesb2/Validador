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

## A observação de cada camisa — obrigatória e específica

Decidido em 15/09/2026. **Toda camisa tem observação preenchida**, e ela fala daquela
peça: o ano, o time naquela temporada, o jogador do número, o patrocinador, o detalhe
que a peça tem. Curiosidade genérica sobre o clube não serve — "o Peñarol é o clube mais
titulado do Uruguai" vale para qualquer camisa do Peñarol e por isso não vale para
nenhuma. O que serve: "titular de 2002, o ano do centenário, com o escudo de três
estrelas que só foi usado nessa temporada".

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

## Documentação na wiki — obrigatória e sempre atualizada

Este projeto é documentado em `C:\Users\B2\Documents\Wiki\validador\`.
**Leia a página de estado antes de mexer em qualquer coisa**, e atualize-a
depois de qualquer mudança.

As três páginas e o que vai em cada uma:

| Página | O que é | Como se escreve |
|---|---|---|
| `validador-estado-atual` | O retrato do presente: quantas camisas, quantas revisadas, o que está no ar, o que falta | **Reescrita no lugar.** Sempre verdadeira agora |
| `validador-arquitetura-e-decisoes` | Como as peças se encaixam e por quê. Regras inegociáveis | Muda pouco. Acrescente decisão nova com data e motivo |
| `validador-historico` | O que aconteceu, em ordem, com data | Só cresce |

**A regra que não pode ser quebrada:** quando algo mudar — um lote novo de
camisas subir, o app mudar, um número mudar — **edite a página de estado no
lugar**. Não crie página nova dizendo "mais 50 camisas foram adicionadas", e
não acrescente parágrafo de novidade no fim dela.

O motivo é concreto: um agente que ler só o documento antigo vai agir sobre
número falso. Um documento que descreve o presente não tem esse problema; um
documento que descreve uma sequência de novidades tem.

O acúmulo tem lugar próprio, que é o histórico. Estado e histórico são coisas
diferentes e não se misturam.

Ao editar qualquer página: atualize o campo `updated` do frontmatter e
acrescente uma entrada no `log.md` da raiz da wiki. As convenções completas
estão no `SCHEMA.md` da wiki, que manda sobre este arquivo no que for formato.

## Como catalogar camisa — o processo, decidido em 11/09/2026

Nada de agente por peça. **Eu cataloguei uma por uma, eu mesmo**, e para CADA
peça uso os dois caminhos juntos:

1. **As duas fotos**, lidas com atenção — frente e verso. Quando um detalhe
   pequeno decide (autógrafo, etiqueta, patrocínio de manga), recorto a região
   e amplio antes de concluir.
2. **O arquivo de uniformes** (Football Kit Archive), aberto no navegador, em
   **TODAS as peças** — decidido pelo Gustavo em 15/09/2026, revertendo o
   afrouxamento de 12/09 que mandava consultar só na dúvida. Consultar sempre se
   mostrou mais eficiente do que julgar se vale a pena consultar. Vá
   na página do ano candidato. Ele bloqueia acesso automatizado com 403 — só
   abre por navegador de verdade. É o que crava desenho, patrocinador de manga
   e qual uniforme era titular, reserva ou terceiro.
3. **Busca por imagem (Google Lens)**, com a URL pública da foto no Supabase.
   Resolve o que o arquivo não cataloga: agasalho, peça de treino, polo de
   passeio, réplica de loja. Foi ela que datou a jaqueta da Topper e explicou
   a camisa do Telemar.

Os dois se cruzam: o arquivo diz o que o clube usou naquele ano, a busca por
imagem diz o que já foi vendido igual àquela peça. Quando os dois concordam, o
ano está cravado. Quando discordam, o campo vai com a divergência declarada.

**Por que não agente:** o tempo não é o problema do Gustavo, a assertividade é.
Agente por peça é rápido e paralelo, mas não abre o arquivo (403), queima a cota
de busca compartilhada da sessão, e — o mais importante — **não enxerga a coleção
inteira**. Foram comparações entre peças que resolveram vários anos: o Centauro
na manga de uma e o Muriel na de outra são âncoras de temporadas diferentes; duas
peças de treino formam par da mesma linha; duas camisetas eram o mesmo modelo.
Um agente por peça não vê nada disso.

**Referência de apoio:** `backup-camisas/referencia-galo.md` traz a linha do
tempo verificada de fornecedores, patrocinadores e estrelas do escudo. Cruzar
fornecedor contra ano é a conferência que pega o erro mais comum — atribuir a
peça a um ano em que aquela marca não vestia o clube.
