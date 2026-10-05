// ============================================================
// banco/schema_parser.mjs — SuperRH
// Extrai de SQL (schema.sql + migrations) quais tabelas e colunas o projeto espera existir.
// Sem rede e sem banco: só texto. Usado por banco/verificar_schema.mjs e testado em
// tests/schema-parser.test.ts.
// ============================================================

/** Remove comentários de linha (-- até o fim da linha) e de bloco. */
export function removerComentarios(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, '');
}

/** Acha o índice do parêntese que fecha o que abre em `inicio` (ignora aspas simples). */
function acharFechamento(texto, inicio) {
  let profundidade = 0;
  let emAspas = false;
  for (let i = inicio; i < texto.length; i += 1) {
    const c = texto[i];
    if (c === "'") emAspas = !emAspas;
    if (emAspas) continue;
    if (c === '(') profundidade += 1;
    if (c === ')') {
      profundidade -= 1;
      if (profundidade === 0) return i;
    }
  }
  return -1;
}

/** Divide o corpo de um CREATE TABLE em itens, respeitando parênteses (numeric(12,2), CHECK (...)). */
function dividirItens(corpo) {
  const itens = [];
  let profundidade = 0;
  let emAspas = false;
  let atual = '';
  for (const c of corpo) {
    if (c === "'") emAspas = !emAspas;
    if (!emAspas) {
      if (c === '(') profundidade += 1;
      if (c === ')') profundidade -= 1;
      if (c === ',' && profundidade === 0) {
        itens.push(atual.trim());
        atual = '';
        continue;
      }
    }
    atual += c;
  }
  if (atual.trim()) itens.push(atual.trim());
  return itens;
}

const PALAVRAS_DE_CONSTRAINT = new Set(['constraint', 'primary', 'unique', 'check', 'foreign', 'exclude', 'like']);

/** Nome da coluna de um item de CREATE TABLE, ou null se o item for uma constraint de tabela. */
function nomeDaColuna(item) {
  const primeiro = item.match(/^"?([a-z_][\w]*)"?/i);
  if (!primeiro) return null;
  const nome = primeiro[1].toLowerCase();
  return PALAVRAS_DE_CONSTRAINT.has(nome) ? null : nome;
}

/**
 * Lê vários trechos de SQL e devolve { tabela: Set(colunas) } com tudo o que eles criam
 * (CREATE TABLE) ou acrescentam (ALTER TABLE ... ADD COLUMN).
 */
export function extrairEsperado(trechosDeSql) {
  const esperado = {};
  const garantir = (tabela) => {
    if (!esperado[tabela]) esperado[tabela] = new Set();
    return esperado[tabela];
  };

  for (const bruto of trechosDeSql) {
    const sql = removerComentarios(bruto);

    const criar = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-z_][\w]*)"?\s*\(/gi;
    let achado;
    while ((achado = criar.exec(sql)) !== null) {
      const tabela = achado[1].toLowerCase();
      const abre = achado.index + achado[0].length - 1;
      const fecha = acharFechamento(sql, abre);
      if (fecha === -1) continue;
      const colunas = garantir(tabela);
      for (const item of dividirItens(sql.slice(abre + 1, fecha))) {
        const coluna = nomeDaColuna(item);
        if (coluna) colunas.add(coluna);
      }
    }

    const alterar = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?"?([a-z_][\w]*)"?\s+([^;]+);/gi;
    while ((achado = alterar.exec(sql)) !== null) {
      const tabela = achado[1].toLowerCase();
      const adicionar = /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-z_][\w]*)"?/gi;
      let col;
      while ((col = adicionar.exec(achado[2])) !== null) garantir(tabela).add(col[1].toLowerCase());
    }
  }
  return esperado;
}

/**
 * Compara o esperado com o que existe no banco.
 * `existente` é { tabela: Set(colunas) }. Devolve o que falta e as tabelas do banco que o SQL não descreve.
 */
export function compararSchema(esperado, existente) {
  const tabelasFaltando = [];
  const colunasFaltando = [];
  for (const [tabela, colunas] of Object.entries(esperado)) {
    const real = existente[tabela];
    if (!real) {
      tabelasFaltando.push(tabela);
      continue;
    }
    for (const coluna of [...colunas].sort()) {
      if (!real.has(coluna)) colunasFaltando.push(`${tabela}.${coluna}`);
    }
  }
  const semDescricao = Object.keys(existente).filter((t) => !esperado[t]).sort();
  return { tabelasFaltando: tabelasFaltando.sort(), colunasFaltando: colunasFaltando.sort(), semDescricao };
}
