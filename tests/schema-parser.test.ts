import { describe, expect, it } from 'vitest';
// @ts-expect-error módulo .mjs de script, sem tipos
import { compararSchema, extrairEsperado, removerComentarios } from '../banco/schema_parser.mjs';

type Esperado = Record<string, Set<string>>;

describe('extrairEsperado', () => {
  it('lê colunas de CREATE TABLE, ignorando constraints de tabela e tipos com vírgula', () => {
    const sql = `
      CREATE TABLE IF NOT EXISTS salary_history (
        id            serial PRIMARY KEY,
        company_id    integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        old_salary    numeric(12,2),
        new_salary    numeric(12,2) NOT NULL,
        created_at    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT salary_pos CHECK (new_salary > 0),
        UNIQUE (company_id, id)
      );`;
    const e = extrairEsperado([sql]) as Esperado;
    expect([...e.salary_history!].sort()).toEqual(['company_id', 'created_at', 'id', 'new_salary', 'old_salary']);
  });

  it('ignora comentários, inclusive com palavras de SQL dentro', () => {
    const sql = `
      -- CREATE TABLE fantasma (id int);
      /* ALTER TABLE x ADD COLUMN y int; */
      CREATE TABLE real_tab (
        id int, -- comentário (com parênteses, e vírgula)
        nome text
      );`;
    const e = extrairEsperado([sql]) as Esperado;
    expect(Object.keys(e)).toEqual(['real_tab']);
    expect([...e.real_tab!].sort()).toEqual(['id', 'nome']);
  });

  it('soma colunas de ALTER TABLE ADD COLUMN (várias em um comando) às da tabela criada antes', () => {
    const criar = 'CREATE TABLE survey_submissions (id serial PRIMARY KEY, survey_id int);';
    const alterar = `ALTER TABLE survey_submissions
      ADD COLUMN IF NOT EXISTS contact_name text,
      ADD COLUMN IF NOT EXISTS ip_hash text;`;
    const e = extrairEsperado([criar, alterar]) as Esperado;
    expect([...e.survey_submissions!].sort()).toEqual(['contact_name', 'id', 'ip_hash', 'survey_id']);
  });

  it('o rollback comentado no fim da migration não conta como coluna esperada', () => {
    const sql = `
      ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS acknowledgment_note text;
      -- ROLLBACK: ALTER TABLE feedbacks DROP COLUMN IF EXISTS acknowledgment_note;
      -- ALTER TABLE x ADD COLUMN fantasma int;`;
    const e = extrairEsperado([sql]) as Esperado;
    expect(Object.keys(e)).toEqual(['feedbacks']);
    expect([...e.feedbacks!]).toEqual(['acknowledgment_note']);
  });
});

describe('compararSchema', () => {
  const esperado: Esperado = { employees: new Set(['id', 'name']), salary_history: new Set(['id', 'new_salary']) };

  it('aponta tabela inexistente (o caso da salary_history)', () => {
    const r = compararSchema(esperado, { employees: new Set(['id', 'name']) });
    expect(r.tabelasFaltando).toEqual(['salary_history']);
    expect(r.colunasFaltando).toEqual([]);
  });

  it('aponta coluna inexistente em tabela existente', () => {
    const r = compararSchema(esperado, { employees: new Set(['id']), salary_history: new Set(['id', 'new_salary']) });
    expect(r.colunasFaltando).toEqual(['employees.name']);
  });

  it('tudo certo: nada falta; tabelas extras do banco só viram aviso', () => {
    const r = compararSchema(esperado, {
      employees: new Set(['id', 'name', 'extra']),
      salary_history: new Set(['id', 'new_salary']),
      recognitions: new Set(['id']),
    });
    expect(r.tabelasFaltando).toEqual([]);
    expect(r.colunasFaltando).toEqual([]);
    expect(r.semDescricao).toEqual(['recognitions']);
  });
});

describe('removerComentarios', () => {
  it('remove -- e /* */', () => {
    expect(removerComentarios('a -- x\nb /* y */ c').replace(/\s+/g, ' ').trim()).toBe('a b c');
  });
});
