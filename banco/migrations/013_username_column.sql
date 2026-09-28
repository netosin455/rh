-- Migration 013: documenta a coluna username (ja existe em producao)
-- A coluna users.username (text NOT NULL UNIQUE, usada no login) ja existia no banco
-- de producao mas nunca tinha sido registrada em banco/migrations/ nem em schema.sql —
-- por isso POST /api/users (criar conta) sempre quebrava com violacao de constraint
-- (500), pois o INSERT nunca preenchia esse campo. Esta migration e um no-op seguro em
-- producao (a coluna ja existe) e serve pra ambientes novos criados a partir do
-- schema.sql (que ja foi atualizado) ficarem alinhados.
--
-- Rollback: ALTER TABLE users DROP COLUMN IF EXISTS username;
-- (so reverter se username deixar de ser usado no login)

ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;
