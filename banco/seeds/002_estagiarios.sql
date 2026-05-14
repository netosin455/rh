-- ============================================================
-- SEED: Estagiários — gestao Arielle.xlsx (aba ESTAGIARIOS)
-- Ajuste v_company_id conforme o ID real da empresa no banco.
-- ============================================================

DO $$
DECLARE
  v_company_id integer := 1;
  v_dep_est    integer;
BEGIN

  -- Departamento Estágio
  SELECT id INTO v_dep_est
    FROM departments WHERE company_id = v_company_id AND name = 'Estágio' LIMIT 1;
  IF v_dep_est IS NULL THEN
    INSERT INTO departments (company_id, name) VALUES (v_company_id, 'Estágio')
    RETURNING id INTO v_dep_est;
  END IF;

  -- 7 estagiários
  INSERT INTO employees
    (company_id, name, cpf, birth_date, hire_date, department_id, role_title, phone, vacation_days)
  VALUES
    (v_company_id, 'BRUNA DA SILVA CONEGERO',          '108.609.669-09', '2007-05-08', '2025-08-11', v_dep_est, 'ESTAGIÁRIO', '(44)99708-6397', 15),
    (v_company_id, 'CARLA FRANCIELI CARDOZO VAZ',      '414.520.268-66', '1993-06-28', '2026-04-27', v_dep_est, 'ESTAGIÁRIO', null,              15),
    (v_company_id, 'CARLOS PEGORARO NETO',             '146.487.999-09', '2006-10-16', '2026-03-09', v_dep_est, 'ESTAGIÁRIO', '(44)99969-8818', 15),
    (v_company_id, 'CLARA HELENA DOS ANJOS FERREIRA',  '561.650.828-40', '2007-03-13', '2025-07-01', v_dep_est, 'ESTAGIÁRIO', '(18)99797-5706', 15),
    (v_company_id, 'MARIA ALICE GOMES DE OLIVEIRA',    '066.997.141-39', '2005-06-09', '2026-03-10', v_dep_est, 'ESTAGIÁRIO', '(67)99673-0576', 15),
    (v_company_id, 'NYCOLLY SANTOS POPOV',             '493.768.938-08', '2004-08-11', '2025-08-01', v_dep_est, 'ESTAGIÁRIO', '(18)99614-5063', 15),
    (v_company_id, 'RAFAEL AUGUSTO ALVES DOS SANTOS',  '564.614.248-22', '2004-05-06', '2026-01-19', v_dep_est, 'ESTAGIÁRIO', '(18)98128-9507', 15);

  RAISE NOTICE 'Seed concluído: 7 estagiários inseridos (company_id = %)', v_company_id;
END $$;
