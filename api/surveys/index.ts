// ============================================================
// api/surveys/index.ts
// GET  /api/surveys              → listar pesquisas
// POST /api/surveys              → criar pesquisa
// GET  /api/surveys/:id          → detalhe
// GET  /api/surveys/:id/results  → resultados consolidados
// POST /api/surveys/:id/respond  → registrar resposta (sem auth — público)
// DELETE /api/surveys/:id        → excluir pesquisa
// ============================================================

import type { Request as VercelRequest, Response as VercelResponse } from 'express';
import { sql, cors, authenticate, err, CAN_MANAGE_EMPLOYEES, sendPush } from '../_lib';

const SURVEY_TYPES = ['scale', 'choice', 'text'] as const;
const MAX_QUESTIONS = 10;
const MAX_TEXT_LENGTH = 1000;

type SurveyType = typeof SURVEY_TYPES[number];
type JsonObject = Record<string, unknown>;
type SurveyQuestion = {
  id: number;
  position: number;
  question: string;
  type: SurveyType;
  options: string[] | null;
  required: boolean;
};
type SurveyQuestionInput = Omit<SurveyQuestion, 'id'>;
type SurveyAnswerInput = { question_id: number; score?: number; choice?: string; text?: string };

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSurveyType(value: unknown): value is SurveyType {
  return typeof value === 'string' && (SURVEY_TYPES as readonly string[]).includes(value);
}

function positiveId(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseQuestion(value: unknown, position: number, requireRequired: boolean): SurveyQuestionInput | null {
  if (!isObject(value) || !isSurveyType(value.type)) return null;
  const question = typeof value.question === 'string' ? value.question.trim() : '';
  if (!question || (requireRequired && typeof value.required !== 'boolean')) return null;
  const required = typeof value.required === 'boolean' ? value.required : true;
  if (value.type === 'choice') {
    if (!Array.isArray(value.options) || value.options.length < 2 || value.options.length > 8) return null;
    const options = value.options.map((option) => typeof option === 'string' ? option.trim() : '');
    if (options.some((option) => !option) || new Set(options.map((option) => option.toLocaleLowerCase('pt-BR'))).size !== options.length) return null;
    return { position, question, type: value.type, options, required };
  }
  return value.options == null ? { position, question, type: value.type, options: null, required } : null;
}

function parseSurveyQuestions(body: unknown): SurveyQuestionInput[] | null {
  if (!isObject(body)) return null;
  const isNewFormat = Array.isArray(body.questions);
  const rawQuestions: unknown[] = isNewFormat && Array.isArray(body.questions)
    ? body.questions
    : [{ question: body.question, type: body.type ?? 'scale', options: body.options, required: true }];
  if (rawQuestions.length < 1 || rawQuestions.length > MAX_QUESTIONS) return null;
  const questions = rawQuestions.map((question, index) => parseQuestion(question, index + 1, isNewFormat));
  return questions.every((question): question is SurveyQuestionInput => question !== null) ? questions : null;
}

function normalizeQuestions(rows: readonly unknown[]): SurveyQuestion[] {
  return rows.map((row) => {
    const question = row as SurveyQuestion;
    return {
      id: Number(question.id),
      position: Number(question.position),
      question: String(question.question),
      type: question.type,
      options: Array.isArray(question.options) ? question.options.map(String) : null,
      required: question.required !== false,
    };
  }).sort((first, second) => first.position - second.position);
}

async function findQuestions(surveyId: number): Promise<SurveyQuestion[]> {
  const rows = await sql`
    SELECT id, position, question, type, options, required
    FROM survey_questions WHERE survey_id = ${surveyId} ORDER BY position
  `;
  return normalizeQuestions(rows);
}

function parseAnswers(body: unknown, questions: readonly SurveyQuestion[]): SurveyAnswerInput[] | string {
  if (!isObject(body)) return 'Corpo da resposta inválido';
  const rawAnswers = Array.isArray(body.answers)
    ? body.answers
    : questions.length === 1
      ? [{ question_id: questions[0].id, score: body.score, choice: body.choice, text: body.text }]
      : null;
  if (!rawAnswers || rawAnswers.length > questions.length) return 'answers é obrigatório para esta pesquisa';
  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const answeredIds = new Set<number>();
  const answers: SurveyAnswerInput[] = [];
  for (const rawAnswer of rawAnswers) {
    if (!isObject(rawAnswer)) return 'Resposta inválida';
    const questionId = positiveId(rawAnswer.question_id);
    const question = questionId ? questionsById.get(questionId) : undefined;
    if (!question) return 'Pergunta não pertence a esta pesquisa';
    if (answeredIds.has(question.id)) return 'Uma pergunta não pode ter mais de uma resposta';
    const fields = ['score', 'choice', 'text'].filter((field) => rawAnswer[field] != null);
    if (fields.length !== 1) return 'Cada resposta deve conter somente um valor';
    if (question.type === 'scale') {
      if (!Number.isInteger(rawAnswer.score) || Number(rawAnswer.score) < 1 || Number(rawAnswer.score) > 5) return 'score deve ser entre 1 e 5';
      answers.push({ question_id: question.id, score: Number(rawAnswer.score) });
    } else if (question.type === 'choice') {
      const choice = typeof rawAnswer.choice === 'string' ? rawAnswer.choice.trim() : '';
      if (!choice || !(question.options ?? []).includes(choice)) return 'Opção inválida';
      answers.push({ question_id: question.id, choice });
    } else {
      const text = typeof rawAnswer.text === 'string' ? rawAnswer.text.trim() : '';
      if (!text || text.length > MAX_TEXT_LENGTH) return `text deve ter entre 1 e ${MAX_TEXT_LENGTH} caracteres`;
      answers.push({ question_id: question.id, text });
    }
    answeredIds.add(question.id);
  }
  return questions.some((question) => question.required && !answeredIds.has(question.id))
    ? 'Há pergunta obrigatória sem resposta'
    : answers;
}

function isUniqueViolation(error: unknown): boolean {
  return isObject(error) && error.code === '23505';
}

function resultsByQuestion(questions: readonly SurveyQuestion[], rows: readonly unknown[]) {
  const answers = rows as Array<{ question_id: number; score: number | null; choice: string | null; text: string | null }>;
  return questions.map((question) => {
    const answered = answers.filter((answer) => Number(answer.question_id) === question.id);
    if (question.type === 'scale') {
      const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
      const scores = answered.map((answer) => Number(answer.score)).filter((score) => Number.isInteger(score));
      scores.forEach((score) => { distribution[String(score)] = (distribution[String(score)] ?? 0) + 1; });
      const avg = scores.length ? Math.round((scores.reduce((total, score) => total + score, 0) / scores.length) * 10) / 10 : 0;
      return { question_id: question.id, position: question.position, question: question.question, type: question.type, answered: scores.length, avg, distribution };
    }
    if (question.type === 'choice') {
      const distribution: Record<string, number> = {};
      (question.options ?? []).forEach((option) => { distribution[option] = 0; });
      answered.forEach((answer) => {
        if (typeof answer.choice === 'string') distribution[answer.choice] = (distribution[answer.choice] ?? 0) + 1;
      });
      return { question_id: question.id, position: question.position, question: question.question, type: question.type, answered: answered.length, distribution };
    }
    const texts = answered.map((answer) => answer.text).filter((text): text is string => typeof text === 'string').slice(0, 200);
    return { question_id: question.id, position: question.position, question: question.question, type: question.type, answered: texts.length, texts };
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const surveyId = req.query.id ? Number(req.query.id) : null;

  // ── POST :id/respond — PÚBLICO (sem autenticação) ─────────
  if (surveyId && req.query.respond === 'true' && req.method === 'POST') {
    const surveyRows = await sql`
      SELECT id, company_id, question, type, options, expires_at
      FROM pulse_surveys WHERE id = ${surveyId}
    `;
    const survey = surveyRows[0] as { expires_at: string | null; question: string; type: SurveyType; options: string[] | null } | undefined;
    if (!survey) return err(res, 404, 'Pesquisa não encontrada');
    if (survey.expires_at && new Date(survey.expires_at) < new Date()) return err(res, 410, 'Esta pesquisa já encerrou');

    const questions = await findQuestions(surveyId);
    if (!questions.length) return err(res, 409, 'Pesquisa ainda não foi preparada para respostas');
    const answers = parseAnswers(req.body as unknown, questions);
    if (typeof answers === 'string') return err(res, 400, answers);

    const body = isObject(req.body) ? req.body : {};
    if (body.voter_token != null && typeof body.voter_token !== 'string') return err(res, 400, 'voter_token inválido');
    const voterToken = typeof body.voter_token === 'string' && body.voter_token ? body.voter_token : null;
    if (voterToken) {
      const already = await sql`
        SELECT 1 FROM survey_submissions WHERE survey_id = ${surveyId} AND voter_token = ${voterToken} LIMIT 1
      `;
      if (already[0]) return err(res, 409, 'Você já respondeu esta pesquisa');
    }

    try {
      // A única instrução é atômica: não existe participação sem todas as respostas validadas.
      await sql`
        WITH nova_participacao AS (
          INSERT INTO survey_submissions (survey_id, voter_token)
          VALUES (${surveyId}, ${voterToken})
          RETURNING id
        )
        INSERT INTO survey_answers (submission_id, question_id, score, choice, text)
        SELECT nova_participacao.id, resposta.question_id, resposta.score, resposta.choice, resposta.text
        FROM nova_participacao
        CROSS JOIN jsonb_to_recordset(${JSON.stringify(answers)}::jsonb)
          AS resposta(question_id integer, score integer, choice text, text text)
      `;
    } catch (error: unknown) {
      if (isUniqueViolation(error)) return err(res, 409, 'Você já respondeu esta pesquisa');
      console.error(`[${new Date().toISOString()}] [ERROR] resposta de pesquisa:`, error);
      return err(res, 500, 'Não foi possível registrar a resposta');
    }

    return res.status(201).json({ ok: true });
  }

  // ── GET :id — público quando sem token (página de resposta) ──
  if (surveyId && req.method === 'GET' && !req.headers['authorization']) {
    const rows = await sql`
      SELECT id, title, question, type, options, expires_at
      FROM pulse_surveys WHERE id = ${surveyId}
    `;
    if (!rows[0]) return err(res, 404, 'Pesquisa não encontrada');
    const questions = await findQuestions(surveyId);
    return res.json(questions.length ? { ...rows[0], questions } : rows[0]);
  }

  // ── Demais rotas exigem autenticação ─────────────────────
  let ctx: ReturnType<typeof authenticate>;
  try {
    ctx = authenticate(req);
  } catch (error: unknown) {
    const authError = error as { status?: number; message?: string };
    return err(res, authError.status ?? 401, authError.message ?? 'Não autorizado');
  }

  // ── GET :id/results ───────────────────────────────────────
  if (surveyId && req.query.results === 'true' && req.method === 'GET') {
    const surveys = await sql`
      SELECT ps.*, u.name AS created_by_name, d.name AS dept_name
      FROM pulse_surveys ps
      LEFT JOIN users u ON u.id = ps.created_by
      LEFT JOIN departments d ON d.id = ps.target_dept AND d.company_id = ps.company_id
      WHERE ps.id = ${surveyId} AND ps.company_id = ${ctx.company_id}
    `;
    if (!surveys[0]) return err(res, 404, 'Pesquisa não encontrada');
    const s = surveys[0];

    const questions = await findQuestions(surveyId);
    if (questions.length) {
      const totals = await sql`
        SELECT COUNT(*)::int AS total FROM survey_submissions WHERE survey_id = ${surveyId}
      `;
      const answers = await sql`
        SELECT sa.question_id, sa.score, sa.choice, sa.text
        FROM survey_answers sa
        JOIN survey_submissions ss ON ss.id = sa.submission_id
        WHERE ss.survey_id = ${surveyId}
        ORDER BY ss.submitted_at DESC
      `;
      const total = Number((totals[0] as { total?: unknown } | undefined)?.total ?? 0);
      return res.json({
        survey: { ...s, questions, question_count: questions.length },
        total_responses: Number.isFinite(total) ? total : 0,
        questions: resultsByQuestion(questions, answers),
      });
    }

    const responses = await sql`
      SELECT score, choice, responded_at
      FROM pulse_responses WHERE survey_id = ${surveyId}
      ORDER BY responded_at DESC
    `;

    const total = responses.length;

    const legacyResponses = responses as Array<{ score: number | null; choice: string | null; responded_at: string }>;
    let results: { avg?: number; distribution: Record<string, number> };
    if (s.type === 'scale') {
      const scores = legacyResponses.map((response) => response.score).filter((score): score is number => Number.isInteger(score));
      const avg = scores.length ? Math.round((scores.reduce((first, second) => first + second, 0) / scores.length) * 10) / 10 : 0;
      const dist: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
      scores.forEach((score) => { dist[String(score)] = (dist[String(score)] ?? 0) + 1; });
      results = { avg, distribution: dist };
    } else {
      const opts = Array.isArray(s.options) ? s.options.map(String) : [];
      const dist: Record<string, number> = {};
      opts.forEach((option) => { dist[option] = 0; });
      legacyResponses.forEach((response) => {
        if (response.choice) dist[response.choice] = (dist[response.choice] ?? 0) + 1;
      });
      results = { distribution: dist };
    }

    return res.json({ survey: s, total_responses: total, results, recent: legacyResponses.slice(0, 5) });
  }

  // ── GET :id ───────────────────────────────────────────────
  if (surveyId && req.method === 'GET') {
    const rows = await sql`
      SELECT ps.*, u.name AS created_by_name, d.name AS dept_name,
        (SELECT COUNT(*)::int FROM survey_submissions WHERE survey_id = ps.id) AS response_count,
        (SELECT COUNT(*)::int FROM survey_questions WHERE survey_id = ps.id) AS question_count
      FROM pulse_surveys ps
      LEFT JOIN users u ON u.id = ps.created_by
      LEFT JOIN departments d ON d.id = ps.target_dept AND d.company_id = ps.company_id
      WHERE ps.id = ${surveyId} AND ps.company_id = ${ctx.company_id}
    `;
    if (!rows[0]) return err(res, 404, 'Pesquisa não encontrada');
    const questions = await findQuestions(surveyId);
    return res.json({ ...rows[0], questions, question_count: questions.length });
  }

  // ── DELETE :id ────────────────────────────────────────────
  if (surveyId && req.method === 'DELETE') {
    if (!CAN_MANAGE_EMPLOYEES.includes(ctx.role)) return err(res, 403, 'Sem permissão');
    const deleted = await sql`
      DELETE FROM pulse_surveys WHERE id = ${surveyId} AND company_id = ${ctx.company_id}
      RETURNING id
    `;
    if (!deleted[0]) return err(res, 404, 'Pesquisa não encontrada');
    return res.status(200).json({ deleted: true });
  }

  // ── GET /api/surveys — listar ─────────────────────────────
  if (!surveyId && req.method === 'GET') {
    const rows = await sql`
      SELECT ps.*, u.name AS created_by_name, d.name AS dept_name,
        (SELECT COUNT(*)::int FROM survey_submissions WHERE survey_id = ps.id) AS response_count,
        (SELECT COUNT(*)::int FROM survey_questions WHERE survey_id = ps.id) AS question_count
      FROM pulse_surveys ps
      LEFT JOIN users u ON u.id = ps.created_by
      LEFT JOIN departments d ON d.id = ps.target_dept AND d.company_id = ps.company_id
      WHERE ps.company_id = ${ctx.company_id}
      ORDER BY ps.created_at DESC
      LIMIT 50
    `;
    return res.json(rows);
  }

  // ── POST /api/surveys — criar ─────────────────────────────
  if (!surveyId && req.method === 'POST') {
    if (!CAN_MANAGE_EMPLOYEES.includes(ctx.role)) return err(res, 403, 'Sem permissão');

    const body = isObject(req.body) ? req.body : null;
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const questions = parseSurveyQuestions(body);
    if (!title || !questions) return err(res, 400, 'title e questions válidos são obrigatórios');
    const targetDepartmentId = body?.target_dept == null || body.target_dept === '' ? null : positiveId(body.target_dept);
    if (body?.target_dept != null && body.target_dept !== '' && !targetDepartmentId) return err(res, 400, 'target_dept inválido');
    if (body?.expires_at != null && typeof body.expires_at !== 'string') return err(res, 400, 'expires_at inválido');
    if (targetDepartmentId != null) {
      const department = await sql`
        SELECT id FROM departments WHERE id = ${targetDepartmentId} AND company_id = ${ctx.company_id}
      `;
      if (!department[0]) return err(res, 404, 'Departamento não encontrado');
    }

    const firstQuestion = questions[0];
    if (!firstQuestion) return err(res, 400, 'Pesquisa precisa de ao menos uma pergunta');
    const rows = await sql`
      WITH nova_pesquisa AS (
        INSERT INTO pulse_surveys (company_id, created_by, title, question, type, options, target_dept, expires_at)
        VALUES (
          ${ctx.company_id}, ${ctx.sub}, ${title}, ${firstQuestion.question}, ${firstQuestion.type},
          ${firstQuestion.options ? JSON.stringify(firstQuestion.options) : null}, ${targetDepartmentId},
          ${typeof body?.expires_at === 'string' ? body.expires_at : null}
        )
        RETURNING *
      ), novas_perguntas AS (
        INSERT INTO survey_questions (survey_id, position, question, type, options, required)
        SELECT nova_pesquisa.id, dados.position, dados.question, dados.type, dados.options, dados.required
        FROM nova_pesquisa
        CROSS JOIN jsonb_to_recordset(${JSON.stringify(questions)}::jsonb)
          AS dados(position integer, question text, type text, options jsonb, required boolean)
        RETURNING id
      )
      SELECT * FROM nova_pesquisa
    `;

    // Notificação + push para todos da empresa
    await sql`
      INSERT INTO notifications (company_id, user_id, title, body, type, route)
      VALUES (${ctx.company_id}, NULL, '📊 Nova pesquisa de pulso', ${title}, 'pesquisa', '/pesquisas')
    `.catch(() => {});
    const tokens = await sql`
      SELECT pt.token FROM push_tokens pt
      JOIN users u ON u.id = pt.user_id
      WHERE u.company_id = ${ctx.company_id}
    `.catch(() => []);
    await sendPush(
      (tokens as Array<{ token: string }>).map((token) => token.token),
      '📊 Nova pesquisa de pulso',
      title,
      { route: '/pesquisas' },
    );

    return res.status(201).json(rows[0]);
  }

  return err(res, 405, 'Método não permitido');
}
