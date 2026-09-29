import { sql } from '../_lib';

export type PublicFeedbackRow = {
  title: string;
  content: string;
  status: 'published' | 'acknowledged' | 'revoked';
  published_at: string;
  acknowledged_at: string | null;
  employee_name: string;
  employee_role_title: string | null;
  employee_department_name: string | null;
  company_name: string;
  created_by_name: string | null;
  created_by_role: string | null;
};

export function isFeedbackToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export async function findPublicFeedback(token: string): Promise<PublicFeedbackRow | null> {
  const rows = await sql`
    SELECT f.title, f.content, f.status, f.published_at, f.acknowledged_at,
      e.name AS employee_name, e.role_title AS employee_role_title,
      d.name AS employee_department_name, c.name AS company_name,
      u.name AS created_by_name, u.role AS created_by_role
    FROM feedbacks f
    JOIN employees e ON e.id = f.employee_id AND e.company_id = f.company_id
    JOIN companies c ON c.id = f.company_id
    LEFT JOIN departments d ON d.id = e.department_id AND d.company_id = e.company_id
    LEFT JOIN users u ON u.id = f.created_by AND u.company_id = f.company_id
    WHERE f.public_token = ${token}
    LIMIT 1
  `;
  return (rows[0] as PublicFeedbackRow | undefined) ?? null;
}
