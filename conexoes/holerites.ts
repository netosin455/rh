import { apiFetch } from './http';
import { comInvalidacao } from '../helpers/invalidacaoCache';
import { Payslip } from '../tipos/modelos';

export async function getPayslips(employeeId?: number): Promise<Payslip[]> {
  const qs = employeeId ? `?employee_id=${employeeId}` : '';
  return apiFetch<Payslip[]>(`/api/payslips${qs}`);
}

export async function createPayslip(data: {
  employee_id: number;
  month: string;
  description?: string;
  file_url: string;
}): Promise<Payslip> {
  return comInvalidacao('payslips', apiFetch<Payslip>('/api/payslips', {
    method: 'POST',
    body: JSON.stringify(data),
  }));
}

export async function deletePayslip(id: number): Promise<void> {
  return comInvalidacao('payslips', apiFetch(`/api/payslips/${id}`, { method: 'DELETE' }));
}
