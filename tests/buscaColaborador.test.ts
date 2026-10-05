// tests/buscaColaborador.test.ts
import { describe, expect, it } from 'vitest';
import { filtrarColaboradores, normalizarTexto } from '../helpers/buscaColaborador';

type C = { id: number; name: string; role_title: string; status: 'ativo' | 'desligado' | 'ferias' };
const LISTA: C[] = [
  { id: 1, name: 'João Álvares', role_title: 'Advogado', status: 'ativo' },
  { id: 2, name: 'Maria Souza', role_title: 'Analista Jurídica', status: 'ativo' },
  { id: 3, name: 'José Antônio', role_title: 'Estagiário', status: 'ferias' },
  { id: 4, name: 'Joana Lima', role_title: 'Advogada', status: 'desligado' },
  ...Array.from({ length: 10 }, (_, i) => ({ id: 10 + i, name: `Pedro ${i}`, role_title: 'Auxiliar', status: 'ativo' as const })),
];

describe('normalizarTexto', () => {
  it('tira acento, caixa e espaços das pontas', () => {
    expect(normalizarTexto('  JOÃO Álvares ')).toBe('joao alvares');
  });
});

describe('filtrarColaboradores', () => {
  it('acha por nome sem acento e sem diferenciar maiúsculas', () => {
    expect(filtrarColaboradores(LISTA, 'joao').map((e) => e.id)).toEqual([1]);
    expect(filtrarColaboradores(LISTA, 'JOSE').map((e) => e.id)).toEqual([3]);
    expect(filtrarColaboradores(LISTA, 'alvares').map((e) => e.id)).toEqual([1]);
  });

  it('acha por cargo', () => {
    expect(filtrarColaboradores(LISTA, 'juridica').map((e) => e.id)).toEqual([2]);
    expect(filtrarColaboradores(LISTA, 'advogado').map((e) => e.id)).toEqual([1]); // Joana (Advogada) está desligada
  });

  it('desligados ficam de fora, salvo se pedido', () => {
    expect(filtrarColaboradores(LISTA, 'joana')).toEqual([]);
    expect(filtrarColaboradores(LISTA, 'joana', { incluirDesligados: true }).map((e) => e.id)).toEqual([4]);
  });

  it('sem digitar nada não lista (padrão) ou lista os primeiros (listarSemBusca)', () => {
    expect(filtrarColaboradores(LISTA, '')).toEqual([]);
    expect(filtrarColaboradores(LISTA, '   ')).toEqual([]);
    expect(filtrarColaboradores(LISTA, '', { listarSemBusca: true })).toHaveLength(6);
  });

  it('lista curta: no máximo 6 por padrão; max configurável', () => {
    expect(filtrarColaboradores(LISTA, 'pedro')).toHaveLength(6);
    expect(filtrarColaboradores(LISTA, 'pedro', { max: 3 })).toHaveLength(3);
    expect(filtrarColaboradores(LISTA, 'pedro', { max: 50 })).toHaveLength(10);
  });

  it('mantém a ordem original e não muda a lista recebida', () => {
    const copia = [...LISTA];
    expect(filtrarColaboradores(LISTA, 'a', { max: 50 }).map((e) => e.id)).toEqual(LISTA.filter((e) => e.status !== 'desligado' && normalizarTexto(`${e.name} ${e.role_title}`).includes('a')).map((e) => e.id));
    expect(LISTA).toEqual(copia);
  });

  it('nada encontrado devolve lista vazia', () => {
    expect(filtrarColaboradores(LISTA, 'zzz')).toEqual([]);
  });
});
