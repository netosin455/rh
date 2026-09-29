import { apiFetch } from './http';
import { Employee, CreateEmployeeData, UpdateEmployeeData } from '../tipos/modelos';

/** Tamanho de página pedido à API (o servidor limita em 100). */
const TAMANHO_PAGINA = 100;

interface PaginaColaboradores {
  data: Employee[];
  total: number;
  totalPages: number;
}

function ehPagina(valor: unknown): valor is PaginaColaboradores {
  if (typeof valor !== 'object' || valor === null) return false;
  const p = valor as Record<string, unknown>;
  return Array.isArray(p.data) && typeof p.total === 'number' && typeof p.totalPages === 'number';
}

async function buscarPagina(page: number): Promise<PaginaColaboradores> {
  const res = await apiFetch<unknown>(`/api/employees?page=${page}&limit=${TAMANHO_PAGINA}`);
  if (!ehPagina(res)) throw new Error('Resposta inesperada da API de colaboradores.');
  return res;
}

/** Retorna TODOS os colaboradores: busca a 1ª página e as demais em paralelo. */
export async function getEmployees(): Promise<Employee[]> {
  const primeira = await buscarPagina(1);
  if (primeira.totalPages <= 1) return primeira.data;

  const numeros = Array.from({ length: primeira.totalPages - 1 }, (_, i) => i + 2);
  const restantes = await Promise.all(numeros.map(buscarPagina));
  return primeira.data.concat(...restantes.map((pagina) => pagina.data));
}

export async function getEmployeeById(id: number): Promise<Employee> {
  return apiFetch(`/api/employees/${id}`);
}

export async function createEmployee(data: CreateEmployeeData): Promise<Employee> {
  return apiFetch('/api/employees', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateEmployee(id: number, data: UpdateEmployeeData): Promise<Employee> {
  return apiFetch(`/api/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteEmployee(id: number): Promise<void> {
  return apiFetch(`/api/employees/${id}`, { method: 'DELETE' });
}
