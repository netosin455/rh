-- Migration 018: leituras individuais de notificações
-- Impacto: cria a tabela notification_reads e migra somente leituras já feitas
--          em notificações individuais. Nenhuma notificação é removida ou alterada.
-- Decisão para globais legadas: notifications.read continua como estado global, pois
--          não há histórico para identificar qual usuário as leu antes desta migration.
-- Rollback: DROP TABLE IF EXISTS notification_reads; O rollback remove apenas os
--           registros individuais criados após esta migration e preserva notifications.

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id integer NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id         integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS notification_reads_user_idx
  ON notification_reads (user_id, notification_id);

-- Backfill não destrutivo: apenas a dona de uma notificação individual já lida
-- recebe seu respectivo registro. Globais legadas ficam inalteradas por decisão acima.
INSERT INTO notification_reads (notification_id, user_id, read_at)
SELECT n.id, n.user_id, now()
FROM notifications n
WHERE n.user_id IS NOT NULL
  AND n.read IS TRUE
ON CONFLICT (notification_id, user_id) DO NOTHING;

-- ROLLBACK (executar somente se for necessário reverter a migration):
-- DROP TABLE IF EXISTS notification_reads;
