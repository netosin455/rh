import { apiFetch } from './http';
import { OnboardingProcess, OnboardingTemplate } from '../../tipos/modelos';

export async function getOnboardings(activeOnly = false): Promise<OnboardingProcess[]> {
  return apiFetch<OnboardingProcess[]>(`/api/onboarding${activeOnly ? '?active_only=true' : ''}`);
}

export async function getOnboarding(id: number): Promise<OnboardingProcess> {
  return apiFetch<OnboardingProcess>(`/api/onboarding/${id}`);
}

export async function startOnboarding(employee_id: number, template_id?: number): Promise<OnboardingProcess> {
  return apiFetch<OnboardingProcess>('/api/onboarding', {
    method: 'POST',
    body: JSON.stringify({ employee_id, template_id }),
  });
}

export async function markStep(id: number, step_index: number, completed: boolean): Promise<OnboardingProcess> {
  return apiFetch<OnboardingProcess>(`/api/onboarding/${id}/step`, {
    method: 'PATCH',
    body: JSON.stringify({ step_index, completed }),
  });
}

export async function deleteOnboarding(id: number): Promise<void> {
  return apiFetch(`/api/onboarding/${id}`, { method: 'DELETE' });
}

export async function getTemplates(): Promise<OnboardingTemplate[]> {
  return apiFetch<OnboardingTemplate[]>('/api/onboarding/templates');
}
