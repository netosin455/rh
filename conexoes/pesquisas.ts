import { apiFetch, publicFetch } from './http';
import { normalizarPesquisaPublica, normalizarResultados, ResultadosBrutos } from '../helpers/pesquisa';
import type { CreateSurveyData, PublicSurvey, PulseSurvey, SurveyAnswerInput, SurveyAudience, SurveyContactInput, SurveyResults } from '../tipos/modelos';

/** Lista por público: employees (Pesquisas) ou customers (NPS). A API sem o parâmetro devolve employees. */
export async function getSurveys(audience: SurveyAudience = 'employees'): Promise<PulseSurvey[]> {
  return apiFetch<PulseSurvey[]>(`/api/surveys?audience=${audience}`);
}

export async function getSurvey(id: number): Promise<PulseSurvey> {
  return apiFetch<PulseSurvey>(`/api/surveys/${id}`);
}

/** Resultados por pergunta (RH). Aceita também o formato antigo de 1 pergunta. */
export async function getSurveyResults(id: number): Promise<SurveyResults> {
  return normalizarResultados(await apiFetch<ResultadosBrutos>(`/api/surveys/${id}/results`));
}

export async function createSurvey(data: CreateSurveyData): Promise<PulseSurvey> {
  return apiFetch<PulseSurvey>('/api/surveys', { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteSurvey(id: number): Promise<void> {
  return apiFetch(`/api/surveys/${id}`, { method: 'DELETE' });
}

/** Pesquisa para a página pública do colaborador (sem login). */
export async function getPublicSurvey(id: number): Promise<PublicSurvey> {
  return normalizarPesquisaPublica(await publicFetch(`/api/surveys/${id}`));
}

export type EnvioResposta =
  | { voter_token: string; answers: SurveyAnswerInput[]; /** Só com consentimento explícito do cliente. */ contact?: SurveyContactInput }
  /** Formato antigo (pesquisa de 1 pergunta sem `questions`). */
  | { voter_token: string; score?: number; choice?: string };

/** Envia a participação inteira de uma vez: o servidor grava tudo ou nada. Resposta repetida dá 409. */
export async function respondSurvey(id: number, envio: EnvioResposta): Promise<void> {
  await publicFetch(`/api/surveys/${id}/respond`, { method: 'POST', body: JSON.stringify(envio) });
}

/**
 * RH marca que já retornou o contato deste cliente.
 * Usa a rota existente /api/surveys/:id com ?contact=<participação> (sem rota nova na API).
 */
export async function marcarContatado(surveyId: number, submissionId: number): Promise<{ contacted_at: string }> {
  return apiFetch<{ contacted_at: string }>(`/api/surveys/${surveyId}?contact=${submissionId}`, { method: 'PATCH', body: JSON.stringify({ contacted: true }) });
}

/** Apaga nome, telefone e e-mail desta participação (pedido do titular). A nota e as respostas continuam, anônimas. */
export async function apagarContato(surveyId: number, submissionId: number): Promise<void> {
  await apiFetch(`/api/surveys/${surveyId}?contact=${submissionId}`, { method: 'DELETE' });
}

const FALLBACK_APP_URL = 'https://super-rh.vercel.app';

/** Link público de resposta (o mesmo vai no QR code). */
export function linkPublicoPesquisa(id: number): string {
  const configurado = process.env.EXPO_PUBLIC_APP_URL;
  const api = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/api\/?$/, '');
  const base = configurado || api || FALLBACK_APP_URL;
  return `${base.replace(/\/$/, '')}/responder/${id}`;
}
