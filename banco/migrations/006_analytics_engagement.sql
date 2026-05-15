-- ============================================================
-- Migration 006 — Risco de Turnover com Engajamento
-- Atualiza vw_employee_analytics adicionando avg_pulse_score
-- no nível da empresa (não por colaborador — respostas são
-- anônimas, não é possível vincular ao indivíduo sem quebrar
-- o anonimato).
-- A API usa o avg_pulse_score da empresa para elevar o nível
-- de risco de colaboradores que já estão em "medio".
-- ============================================================

DROP VIEW IF EXISTS vw_employee_analytics;

CREATE VIEW vw_employee_analytics AS
SELECT
  e.id,
  e.company_id,
  e.name,
  e.department_id,
  d.name                                        AS department_name,
  e.status,
  e.hire_date,
  e.legal_area,
  e.role_title,
  COALESCE(ab.total_absences_90d, 0)           AS total_absences_90d,
  (CURRENT_DATE - e.hire_date)                 AS days_in_company,
  co.avg_pulse_score,
  CASE
    -- alto: faltas elevadas, recém-contratado, ou clima muito ruim na empresa
    WHEN COALESCE(ab.total_absences_90d, 0) >= 4
      OR (CURRENT_DATE - e.hire_date) < 90
      OR COALESCE(co.avg_pulse_score, 5) < 2.5  THEN 'alto'
    -- medio: faltas moderadas ou clima abaixo do esperado
    WHEN COALESCE(ab.total_absences_90d, 0) >= 2
      OR COALESCE(co.avg_pulse_score, 5) < 3.5  THEN 'medio'
    ELSE 'baixo'
  END                                           AS turnover_risk
FROM employees e
LEFT JOIN departments d ON d.id = e.department_id
LEFT JOIN (
  SELECT employee_id, COUNT(*)::int AS total_absences_90d
  FROM absences
  WHERE created_at >= NOW() - INTERVAL '90 days'
  GROUP BY employee_id
) ab ON ab.employee_id = e.id
LEFT JOIN (
  -- Média de engajamento da empresa nos últimos 30 dias (anônimo)
  SELECT
    ps.company_id,
    ROUND(AVG(pr.score::numeric), 2) AS avg_pulse_score
  FROM pulse_responses pr
  JOIN pulse_surveys ps ON ps.id = pr.survey_id AND ps.type = 'scale'
  WHERE pr.score IS NOT NULL
    AND pr.responded_at >= NOW() - INTERVAL '30 days'
  GROUP BY ps.company_id
) co ON co.company_id = e.company_id;
