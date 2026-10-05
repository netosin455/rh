// ============================================================
// banco/verificar_schema.mjs — SuperRH
// Confere, SOMENTE LENDO, se o banco real tem as tabelas e colunas que o schema.sql e as
// migrations descrevem. Foi criado depois que a tabela salary_history ficou semanas sem existir
// em produção (testes com banco simulado não pegam isso).
//
// Uso:   npm run db:verify
// Banco: DATABASE_URL do ambiente ou do arquivo .env. Nunca escreve nada.
// Saída: código 0 = tudo certo; código 1 = falta tabela/coluna; código 2 = não conseguiu verificar.
// Rode ANTES de cada push que mude SQL em api/ (ver docs/maestri/quality/RELEASE_CHECKLIST.md).
// ============================================================

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import { extrairEsperado, compararSchema } from './schema_parser.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

function lerDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const arquivoEnv = join(raiz, '.env');
  if (!existsSync(arquivoEnv)) return null;
  const linha = readFileSync(arquivoEnv, 'utf8').match(/^DATABASE_URL=(.*)$/m);
  return linha ? linha[1].replace(/^["']|["']$/g, '') : null;
}

const url = lerDatabaseUrl();
if (!url) {
  console.error('DATABASE_URL não encontrada (ambiente ou .env). Nada foi verificado.');
  process.exit(2);
}

const arquivosSql = [
  join(raiz, 'banco', 'schema.sql'),
  ...readdirSync(join(raiz, 'banco', 'migrations'))
    .filter((nome) => nome.endsWith('.sql'))
    .sort()
    .map((nome) => join(raiz, 'banco', 'migrations', nome)),
];
const esperado = extrairEsperado(arquivosSql.map((arquivo) => readFileSync(arquivo, 'utf8')));

let existente;
try {
  const sql = neon(url);
  const linhas = await sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
  `;
  existente = {};
  for (const { table_name: tabela, column_name: coluna } of linhas) {
    (existente[tabela] ??= new Set()).add(coluna);
  }
} catch (erro) {
  console.error(`Não foi possível ler o banco (${erro?.code ?? erro?.name ?? 'erro'}). Nada foi verificado.`);
  process.exit(2);
}

const { tabelasFaltando, colunasFaltando, semDescricao } = compararSchema(esperado, existente);
const totalColunas = Object.values(esperado).reduce((soma, colunas) => soma + colunas.size, 0);

console.log(`Verificadas ${Object.keys(esperado).length} tabelas e ${totalColunas} colunas descritas em ${arquivosSql.length} arquivos SQL.`);

if (semDescricao.length > 0) {
  console.log(`\nAviso: no banco mas sem descrição no SQL do repositório (${semDescricao.length}): ${semDescricao.join(', ')}`);
}

if (tabelasFaltando.length === 0 && colunasFaltando.length === 0) {
  console.log('\nOK: o banco tem tudo o que o repositório descreve.');
  process.exit(0);
}

if (tabelasFaltando.length > 0) {
  console.log(`\nTABELAS QUE O REPOSITÓRIO DESCREVE E O BANCO NÃO TEM (${tabelasFaltando.length}):`);
  for (const tabela of tabelasFaltando) console.log(`  - ${tabela}`);
}
if (colunasFaltando.length > 0) {
  console.log(`\nCOLUNAS QUE O REPOSITÓRIO DESCREVE E O BANCO NÃO TEM (${colunasFaltando.length}):`);
  for (const coluna of colunasFaltando) console.log(`  - ${coluna}`);
}
console.log('\nSe o código novo usa algo desta lista, rode a migration correspondente ANTES do push.');
process.exit(1);
