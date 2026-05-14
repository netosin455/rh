-- ============================================================
-- SEED: Colaboradores CLT — gestao Arielle.xlsx
-- Ajuste v_company_id conforme o ID real da empresa no banco.
-- ATENÇÃO: JESSICA FLAVIA GIANNASI CRUZ — data de nascimento
--   corrigida de 22/07/1191 para 22/07/1991 (typo na planilha).
-- ============================================================

DO $$
DECLARE
  v_company_id  integer := 1;
  v_dep_campo   integer;
  v_dep_escrit  integer;
  v_dep_jur     integer;
BEGIN

  -- ── Departamentos ─────────────────────────────────────────
  SELECT id INTO v_dep_campo
    FROM departments WHERE company_id = v_company_id AND name = 'Campo' LIMIT 1;
  IF v_dep_campo IS NULL THEN
    INSERT INTO departments (company_id, name) VALUES (v_company_id, 'Campo')
    RETURNING id INTO v_dep_campo;
  END IF;

  SELECT id INTO v_dep_escrit
    FROM departments WHERE company_id = v_company_id AND name = 'Escritório' LIMIT 1;
  IF v_dep_escrit IS NULL THEN
    INSERT INTO departments (company_id, name) VALUES (v_company_id, 'Escritório')
    RETURNING id INTO v_dep_escrit;
  END IF;

  SELECT id INTO v_dep_jur
    FROM departments WHERE company_id = v_company_id AND name = 'Jurídico' LIMIT 1;
  IF v_dep_jur IS NULL THEN
    INSERT INTO departments (company_id, name) VALUES (v_company_id, 'Jurídico')
    RETURNING id INTO v_dep_jur;
  END IF;

  -- ── Colaboradores ─────────────────────────────────────────
  INSERT INTO employees
    (company_id, name, cpf, birth_date, hire_date, department_id, role_title, phone, vacation_days)
  VALUES
    (v_company_id, 'ALECIO CEREGATTI',                    '676.646.289-20', '1968-01-08', '2023-10-17', v_dep_campo,  'AUXILIAR DE ESCRITÓRIO',    '(18) 98147-7615', 10),
    (v_company_id, 'ALEXSANDRO BORGES DOS SANTOS',         '865.729.709-49', '1973-06-30', '2025-10-20', v_dep_campo,  'AUXILIAR DE ESCRITÓRIO',    '(44)99161-3200',  30),
    (v_company_id, 'ALINE JOSE DE OLIVEIRA MOTTA',         '069.128.409-14', '1990-05-14', '2012-05-02', v_dep_escrit, 'AUXILIAR DE ESCRITÓRIO',    '(44)99919-5023',  30),
    (v_company_id, 'AMANDA SCHUELTER',                     '036.722.831-93', '1996-11-14', '2023-09-01', v_dep_jur,    'ADVOGADA TRAINNE',          '(67)99989-0289',  30),
    (v_company_id, 'ANA MARIA OLIVEIRA CARLOS DE LIMA',    '488.498.218-59', '2000-08-16', '2023-09-01', v_dep_escrit, 'AUXILIAR DE ESCRITÓRIO',    '(18)98108-8550',  15),
    (v_company_id, 'ANTHONY SAMUEL RECHE BECK',            '491.734.918-45', '2003-05-08', '2025-07-16', v_dep_escrit, 'AUXILIAR DE ESCRITÓRIO',    '(18)98123-4396',  30),
    (v_company_id, 'ARIELLE TAYNARA BUONO DA FONSECA',     '065.528.569-54', '1992-01-08', '2025-04-01', v_dep_escrit, 'COORDENADORA ADM II',       '(44)99157-9436',  30),
    (v_company_id, 'CARLA FRANCIELE FERREIRA CRUZ',        '383.743.488-52', '1989-02-04', '2024-04-11', v_dep_campo,  'AUXILIAR DE ESCRITÓRIO',    '(18)99674-0964',  30),
    (v_company_id, 'CLAUDEIR JOSE RIBEIRO',                '406.323.618-83', '1990-08-25', '2024-04-18', v_dep_campo,  'AUXILIAR DE ESCRITÓRIO',    '(18)98135-2186',  20),
    (v_company_id, 'CRISTIANE MICHELE DOS SANTOS',         '343.587.898-38', '1985-05-31', '2014-01-06', v_dep_escrit, 'AUXILIAR DE ESCRITÓRIO',    '(18)99770-0606',  30),
    (v_company_id, 'DANIELA ELENA ROCHEMBACH SCHWAB',      '012.568.969-18', '1998-03-27', '2026-02-02', v_dep_escrit, 'AUXILIAR DE ESCRITÓRIO',    '(44)99835-4932',  30),
    (v_company_id, 'FABIANO SENSON DE SOUZA',              '082.309.979-26', '1991-11-26', '2018-05-02', v_dep_escrit, 'AUXILIAR DE ESCRITÓRIO',    '(44)99765-8775',  30),
    (v_company_id, 'GABRIELA FERNANDES SILVA',             '063.889.181-74', '1997-10-26', '2025-03-10', v_dep_escrit, 'AUXILIAR DE ESCRITÓRIO',    '(67)99937-1255',  30),
    (v_company_id, 'ISABELLA COUTINHO NASCIMENTO',         '452.384.418-60', '2002-05-22', '2025-11-03', v_dep_jur,    'AUXILIAR DE ESCRITÓRIO',    '(18)99167-8334',  30),
    (v_company_id, 'JAQUELINE CAMPOS DA SILVA',            '418.835.718-55', '1994-03-16', '2017-05-08', v_dep_jur,    'ADVOGADO PLENO',            '(18)98136-0879',  30),
    (v_company_id, 'JESSICA DOS SANTOS CAL FRAUCHES',      '086.548.779-01', '1992-11-16', '2023-02-03', v_dep_escrit, 'AUXILIAR DE ESCRITÓRIO',    '(44)99988-5948',  30),
    -- birth_date corrigida: 1191 → 1991
    (v_company_id, 'JESSICA FLAVIA GIANNASI CRUZ',         '395.792.998-97', '1991-07-22', '2026-03-02', v_dep_campo,  'AUXILIAR DE ESCRITÓRIO',    '(18)98120-5561',  30),
    (v_company_id, 'JOÃO RAFAEL DOS SANTOS CARMO COSTA',   '512.679.478-70', '2003-06-15', '2025-11-03', v_dep_escrit, 'AUXILIAR DE ESCRITÓRIO',    '(18)98154-8094',  30),
    (v_company_id, 'JONAS GONÇALVES',                      '047.930.269-31', '1985-07-01', '2024-01-15', v_dep_escrit, 'AUXILIAR DE ESCRITÓRIO',    '(44)99857-5076',  25),
    (v_company_id, 'JOSE MOTTA NETO',                      '059.254.619-59', '1986-06-09', '2016-02-01', v_dep_campo,  'SUPERVISOR DE ESCRITÓRIO',  '(44)99932-2335',  30),
    (v_company_id, 'LEANDRO RODRIGUES DOS SANTOS',         '101.385.159-56', '1996-08-04', '2024-09-02', v_dep_campo,  'AUXILIAR DE ESCRITÓRIO',    '(44)99702-9130',  30),
    -- tel pessoal vazio; usando tel corporativo
    (v_company_id, 'LEANDRO SANTANA THOMAZ',               '376.940.488-24', '1989-11-07', '2018-05-02', v_dep_campo,  'AUXILIAR DE ESCRITÓRIO',    '(18)99752-0014',  30),
    (v_company_id, 'LEONARDO OLIVEIRA ALVES',              '129.427.376-03', '1996-04-13', '2024-04-01', v_dep_campo,  'AUXILIAR DE ESCRITÓRIO',    '(18)99626-3255',  30),
    (v_company_id, 'LUCAS GABRIEL MENDES BASSETO',         '096.346.859-60', '1998-11-21', '2021-06-01', v_dep_escrit, 'COORDENADOR FINANCEIRO',    '(44)99737-1181',  30),
    (v_company_id, 'MARIA ROSA BRAIDO DE SOUZA',           '298.025.598-06', '1980-11-28', '2024-07-17', v_dep_escrit, 'AUXILIAR DE ESCRITÓRIO',    '(18)99708-2716',  10),
    (v_company_id, 'MATHEUS HENRIQUE CARNEVALLI',          '085.698.449-30', '1994-11-07', '2025-02-05', v_dep_campo,  'AUXILIAR DE ESCRITÓRIO',    '(44)99904-3774',   0),
    (v_company_id, 'MURILO CARVALHO DE OLIVEIRA',          '397.851.528-80', '1995-03-17', '2025-10-20', v_dep_campo,  'AUXILIAR DE ESCRITÓRIO',    '(18)99183-1903',  30),
    (v_company_id, 'PAMELA SIMONE DE OLIVEIRA DIAS',       '189.810.956-90', '1991-12-25', '2024-07-08', v_dep_jur,    'ADVOGADA TRAINNE',          '(18)98109-5690',  30),
    (v_company_id, 'PAMELA YUMI SHIMADA SOUZA',            '418.121.208-42', '1993-11-27', '2024-03-01', v_dep_escrit, 'AUXILIAR DE ESCRITÓRIO',    '(18)98156-6282',  10),
    (v_company_id, 'PAULA FERNANDA SOUZA DOS SANTOS',      '393.928.928-02', '1990-07-02', '2025-11-03', v_dep_jur,    'ADVOGADA TRAINNE',          '(18)99602-6102',  30),
    (v_company_id, 'PAULO DE CARVALHO BASSETO',            '899.016.579-20', '1972-06-30', '2021-06-01', v_dep_campo,  'AUXILIAR DE ESCRITÓRIO',    '(44)99768-6717',  30),
    (v_company_id, 'RAYSSA TEIXEIRA CHAVES DULOVISCHI',    '514.923.218-18', '2004-09-03', '2025-08-01', v_dep_escrit, 'AUXILIAR DE ESCRITÓRIO',    '(18)99795-1763',  30),
    (v_company_id, 'TIAGO FERNANDO DE SOUZA',              '064.321.399-61', '1987-06-18', '2025-11-14', v_dep_escrit, 'AUXILIAR DE ESCRITÓRIO',    '(44)99740-4958',  30),
    (v_company_id, 'VALERIA MONTEIRO DE OLIVEIRA',         '344.212.638-00', '1985-12-20', '2017-06-01', v_dep_jur,    'ADVOGADO PLENO',            '(18)99776-6872',  20),
    (v_company_id, 'VENERA MEIRA STOPA',                   '073.118.339-81', '1994-04-21', '2022-09-16', v_dep_jur,    'ADVOGADA JUNIOR',           '(44)99707-1075',  30),
    (v_company_id, 'YOHANA LESSA OLIVEIRA',                '089.501.719-96', '1994-03-11', '2025-09-01', v_dep_escrit, 'AUXILIAR DE ESCRITÓRIO',    '(44)99985-3995',  30);

  RAISE NOTICE 'Seed concluído: 36 colaboradores inseridos (company_id = %)', v_company_id;
END $$;
