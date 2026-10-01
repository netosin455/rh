// ============================================================
// helpers/qr.ts — SuperRH
// QR code gerado NO CLIENTE (nenhum dado sai do aparelho). Usa a lib `toqr`
// (MIT, ~3 KB, só codifica) e converte a matriz em linhas para desenhar com Views
// ou em SVG para baixar/imprimir. Sem React e sem rede.
// ============================================================

import { toQR } from 'toqr';

export interface MatrizQr {
  /** Módulos por lado (a matriz é quadrada). */
  tamanho: number;
  /** modulos[y][x] === true => módulo escuro. */
  modulos: boolean[][];
}

/** Trecho horizontal contínuo de módulos escuros (menos elementos para desenhar). */
export interface TrechoQr {
  x: number;
  y: number;
  largura: number;
}

/** Margem de silêncio recomendada pela especificação: 4 módulos. */
export const MARGEM_QR = 4;

/** Codifica o texto (ex.: a URL pública da pesquisa) em uma matriz de módulos. */
export function gerarQr(texto: string): MatrizQr {
  if (!texto.trim()) throw new Error('Texto vazio: não há o que codificar no QR.');
  const bytes = toQR(texto);
  const tamanho = Math.round(Math.sqrt(bytes.length));
  if (tamanho * tamanho !== bytes.length) throw new Error('QR inválido: a matriz não é quadrada.');
  const modulos: boolean[][] = [];
  for (let y = 0; y < tamanho; y++) {
    const linha: boolean[] = [];
    for (let x = 0; x < tamanho; x++) linha.push(bytes[y * tamanho + x] === 1);
    modulos.push(linha);
  }
  return { tamanho, modulos };
}

/** Junta módulos escuros vizinhos de cada linha em trechos. */
export function trechosDoQr(matriz: MatrizQr): TrechoQr[] {
  const trechos: TrechoQr[] = [];
  matriz.modulos.forEach((linha, y) => {
    let inicio = -1;
    for (let x = 0; x <= linha.length; x++) {
      const escuro = x < linha.length && linha[x] === true;
      if (escuro && inicio < 0) inicio = x;
      if (!escuro && inicio >= 0) { trechos.push({ x: inicio, y, largura: x - inicio }); inicio = -1; }
    }
  });
  return trechos;
}

/** SVG com fundo branco e margem de silêncio, pronto para baixar ou imprimir. */
export function qrParaSvg(matriz: MatrizQr, margem: number = MARGEM_QR): string {
  const lado = matriz.tamanho + margem * 2;
  const caminho = trechosDoQr(matriz).map((t) => `M${t.x + margem} ${t.y + margem}h${t.largura}v1h-${t.largura}z`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" width="${lado * 10}" height="${lado * 10}" shape-rendering="crispEdges"><rect width="${lado}" height="${lado}" fill="#ffffff"/><path d="${caminho}" fill="#000000"/></svg>`;
}

function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Página simples para imprimir: título, QR grande e o link por extenso (título e link escapados). */
export function htmlParaImpressao(svg: string, titulo: string, link: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escaparHtml(titulo)}</title><style>body{font-family:Arial,sans-serif;text-align:center;margin:48px}h1{font-size:28px;margin:0 0 8px}p{font-size:18px;color:#333}svg{width:360px;height:360px;margin:24px auto;display:block}small{font-size:14px;color:#555;word-break:break-all}@media print{body{margin:24px}}</style></head><body><h1>${escaparHtml(titulo)}</h1><p>Aponte a câmera do celular para responder.</p>${svg}<small>${escaparHtml(link)}</small></body></html>`;
}
