import { apiFetch } from './http';
import { Recognition, RecognitionCategory } from '../../tipos/modelos';

export async function getRecognitions(toEmployeeId?: number): Promise<{ data: Recognition[]; total: number }> {
  const qs = toEmployeeId ? `?to_employee_id=${toEmployeeId}` : '';
  return apiFetch<{ data: Recognition[]; total: number }>(`/api/recognitions${qs}`);
}

export async function createRecognition(data: {
  to_employee_id: number;
  message: string;
  category: RecognitionCategory;
}): Promise<Recognition> {
  return apiFetch<Recognition>('/api/recognitions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteRecognition(id: number): Promise<void> {
  return apiFetch(`/api/recognitions/${id}`, { method: 'DELETE' });
}
