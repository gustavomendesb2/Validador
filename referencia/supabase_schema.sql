-- =====================================================================
-- Estrutura do banco para o Validador de Camisas
-- Cole tudo isto no SQL Editor do Supabase e clique em "Run".
-- =====================================================================

create table if not exists camisas (
  id            text primary key,        -- ID_Camisa vindo do CSV
  time          text,
  pais          text,
  ano           text,
  modelo        text,
  fornecedor    text,
  numero_nome   text,
  oficial       text,                    -- "Sim" / "Não"
  foto_frente   text,                    -- URL pública no Storage
  foto_verso    text,
  observacoes   text default '',
  dados_ia      jsonb,                   -- snapshot do palpite original da IA
  revisado      boolean default false,
  revisado_em   timestamptz,
  ordem         serial                   -- ordem estável de navegação
);

-- Liga a segurança em nível de linha
alter table camisas enable row level security;

-- O app público (chave anon) pode LER e ATUALIZAR, mas NÃO inserir nem apagar.
-- A inserção é feita só pelo script de seed, que usa a service_role e ignora o RLS.
create policy "anon pode ler"   on camisas for select using (true);
create policy "anon pode editar" on camisas for update using (true) with check (true);
