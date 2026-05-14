-- ============================================================
-- MIGRAÇÃO 001 — Analytics View
-- View materializada de analytics de colaboradores
-- ============================================================

CREATE OR REPLACE VIEW vw_employee_analytics AS
SELECT
  e.id,
  e.company_id,
  e.name,
  e.department_id,
  d.name                                     AS department_name,
  e.status,
  e.hire_date,
  e.legal_area,
  e.role_title,
  COALESCE(ab.total_absences_90d, 0)        AS total_absences_90d,
  (CURRENT_DATE - e.hire_date)              AS days_in_company,
  CASE
    WHEN COALESCE(ab.total_absences_90d, 0) >= 4
      OR (CURRENT_DATE - e.hire_date) < 90  THEN 'alto'
    WHEN COALESCE(ab.total_absences_90d, 0) >= 2 THEN 'medio'
    ELSE 'baixo'
  END                                        AS turnover_risk
FROM employees e
LEFT JOIN departments d ON d.id = e.department_id
LEFT JOIN (
  SELECT employee_id, COUNT(*)::int AS total_absences_90d
  FROM absences
  WHERE created_at >= NOW() - INTERVAL '90 days'
  GROUP BY employee_id
) ab ON ab.employee_id = e.id;
