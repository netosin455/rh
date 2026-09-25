// ============================================================
// api/_email.ts — envio de emails transacionais via Resend
// ============================================================

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'SuperRH <noreply@super-rh.vercel.app>';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function isValidEmail(email: unknown): email is string {
  return typeof email === 'string'
    && email.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export interface EmailTemplateInput {
  title: string;
  greeting: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
}

/** Template curto e compartilhado, sem dados pessoais sensíveis. */
export function buildEmailTemplate(input: EmailTemplateInput): string {
  const action = input.actionUrl && input.actionLabel
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;background:#C9A84C;color:#111;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">${escapeHtml(input.actionLabel)}</a></p>`
    : '';

  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937">
  <h1 style="margin:0 0 16px;color:#7A6230;font-size:22px">${escapeHtml(input.title)}</h1>
  <p>Olá, ${escapeHtml(input.greeting)}.</p>
  <p style="white-space:pre-wrap;line-height:1.5">${escapeHtml(input.message)}</p>
  ${action}
  <p style="margin-top:28px;color:#6b7280;font-size:12px">Esta é uma mensagem automática do SuperRH.</p>
</div>`;
}

/**
 * Envia um email pelo Resend. Endereços ausentes ou inválidos são ignorados para
 * que efeitos colaterais nunca transformem uma operação de domínio em falha.
 * Erros de transporte e respostas não-2xx são propagados ao chamador, que deve
 * registrar o contexto e preservar a operação principal.
 */
export async function sendEmail(to: unknown, subject: string, html: string): Promise<boolean> {
  if (!isValidEmail(to)) return false;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY ausente; envio ignorado');
    return false;
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
      to: to.trim(),
      subject,
      html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend respondeu ${response.status}`);
  }
  return true;
}

export function buildRecognitionEmail(input: {
  employeeName: string;
  senderName: string;
  message: string;
  actionUrl?: string;
}): { subject: string; html: string } {
  return {
    subject: 'Você recebeu um reconhecimento no SuperRH',
    html: buildEmailTemplate({
      title: 'Você recebeu um reconhecimento',
      greeting: input.employeeName,
      message: `${input.senderName} reconheceu seu trabalho:\n\n“${input.message}”`,
      actionUrl: input.actionUrl,
      actionLabel: input.actionUrl ? 'Ver reconhecimentos' : undefined,
    }),
  };
}
