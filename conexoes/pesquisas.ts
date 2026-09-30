import { apiFetch, publicFetch } from './http';
import { normalizarPesquisaPublica, normalizarResultados, ResultadosBrutos } from '../helpers/pesquisa';
import type { CreateSurveyData, PublicSurvey, PulseSurvey, SurveyAnswerInput, SurveyResults } from '../tipos/modelos';

export async function getSurveys(): Promise<PulseSurvey[]> {
  return apiFetch<PulseSurvey[]>('/api/surveys');
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
  | { voter_token: string; answers: SurveyAnswerInput[] }
  /** Formato antigo (pesquisa de 1 pergunta sem `questions`). */
  | { voter_token: string; score?: number; choice?: string };

/** Envia a participação inteira de uma vez: o servidor grava tudo ou nada. Resposta repetida dá 409. */
export async function respondSurvey(id: number, envio: EnvioResposta): Promise<void> {
  await publicFetch(`/api/surveys/${id}/respond`, { method: 'POST', body: JSON.stringify(envio) });
}
