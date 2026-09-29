import { sql } from '../_lib';

export type PublicFeedbackRow = {
  title: string;
  content: string;
  status: 'published' | 'acknowledged' | 'revoked';
  published_at: string;
  acknowledged_at: string | null;
  employee_name: string;
  company_name: string;
};

export function isFeedbackToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export async function findPublicFeedback(token: string): Promise<PublicFeedbackRow | null> {
  const rows = await sql`
    SELECT f.title, f.content, f.status, f.published_at, f.acknowledged_at,
      e.name AS employee_name, c.name AS company_name
    FROM feedbacks f
    JOIN employees e ON e.id = f.employee_id AND e.company_id = f.company_id
    JOIN companies c ON c.id = f.company_id
    WHERE f.public_token = ${token}
    LIMIT 1
  `;
  return (rows[0] as PublicFeedbackRow | undefined) ?? null;
}
