import { apiFetch } from './http';
import { Employee, CreateEmployeeData, UpdateEmployeeData } from '../../tipos/modelos';

export async function getEmployees(page = 1, limit = 50): Promise<Employee[]> {
  const res = await apiFetch(`/api/employees?page=${page}&limit=${limit}`);
  return res?.data ?? res;
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
