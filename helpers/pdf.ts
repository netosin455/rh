// helpers/pdf.ts — relatórios PDF via HTML + window.print()
// Abre em nova aba; usuário salva como PDF pelo diálogo de impressão.
// Sem dependências externas — funciona direto no browser.
import { Platform } from 'react-native';
import type { Employee, Absence, AnalyticsOverview } from '../tipos/modelos';
import { ABSENCE_TYPE_LABELS, STATUS_LABELS } from '../tipos/modelos';

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #111; font-size: 12px; }
  .page { max-width: 960px; margin: 0 auto; padding: 32px; }
  header { display: flex; justify-content: space-between; align-items: flex-start;
           border-bottom: 2px solid #C9A84C; padding-bottom: 14px; margin-bottom: 22px; }
  .brand { font-size: 22px; font-weight: 800; color: #C9A84C; letter-spacing: 1px; }
  .meta  { font-size: 11px; color: #666; text-align: right; margin-top: 4px; }
  h1 { font-size: 18px; font-weight: 700; color: #111; margin-bottom: 4px; }
  h2 { font-size: 14px; font-weight: 700; color: #C9A84C; margin: 24px 0 8px; text-transform: uppercase; letter-spacing: 0.5px; }
  .sub { font-size: 11px; color: #666; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #C9A84C; color: #111; font-weight: 700; font-size: 10px;
       text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px; text-align: left; }
  td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
  tr:nth-child(even) td { background: #f9f9f9; }
  .badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; }
  .badge-green  { background: #D1FAE5; color: #065F46; }
  .badge-yellow { background: #FEF3C7; color: #92400E; }
  .badge-red    { background: #FEE2E2; color: #991B1B; }
  .badge-blue   { background: #DBEAFE; color: #1E40AF; }
  .badge-gray   { background: #F3F4F6; color: #374151; }
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 24px; }
  .kpi { background: #f9f7f2; border: 1px solid #e5d99a; border-radius: 8px; padding: 14px 16px; }
  .kpi-value { font-size: 28px; font-weight: 800; color: #C9A84C; line-height: 1; }
  .kpi-label { font-size: 10px; color: #777; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
  footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb;
           font-size: 10px; color: #aaa; text-align: center; }
  @media print {
    body { background: white; }
    .no-print { display: none !important; }
  }
`;

function formatDate(s?: string) {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function openPrint(html: string) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const win = window.open('', '_blank');
  if (!win) { window.alert('Permita pop-ups para exportar o PDF'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 600);
}

function shell(title: string, subtitle: string, body: string): string {
  const now = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>${title}</title><style>${CSS}</style></head>
    <body><div class="page">
      <header>
        <div>
          <div class="brand">SuperRH</div>
          <h1>${title}</h1>
          <div class="sub">${subtitle}</div>
        </div>
        <div class="meta">Gerado em<br><strong>${now}</strong></div>
      </header>
      ${body}
      <footer>SuperRH · Relatório gerado automaticamente · ${now}</footer>
    </div></body></html>`;
}

function statusBadge(status: string): string {
  const map: Record<string, [string, string]> = {
    ativo:      ['badge-green',  'Ativo'],
    ferias:     ['badge-blue',   'Férias'],
    licenca:    ['badge-yellow', 'Licença'],
    afastado:   ['badge-yellow', 'Afastado'],
    desligado:  ['badge-gray',   'Desligado'],
    aprovado:   ['badge-green',  'Aprovado'],
    pendente:   ['badge-yellow', 'Pendente'],
    recusado:   ['badge-red',    'Recusado'],
    cancelado:  ['badge-gray',   'Cancelado'],
  };
  const [cls, label] = map[status] ?? ['badge-gray', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

// ── Colaboradores ─────────────────────────────────────────────
export function exportEmployeesPDF(employees: Employee[]) {
  if (Platform.OS !== 'web') return;
  const rows = employees.map(e => `
    <tr>
      <td>${e.name}</td>
      <td>${e.role_title}</td>
      <td>${e.department_name ?? '—'}</td>
      <td>${statusBadge(e.status)}</td>
      <td>${formatDate(e.hire_date)}</td>
    </tr>`).join('');

  const body = `
    <table>
      <thead><tr><th>Nome</th><th>Cargo</th><th>Departamento</th><th>Status</th><th>Admissão</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  openPrint(shell(
    'Relatório de Colaboradores',
    `${employees.length} colaborador${employees.length !== 1 ? 'es' : ''}`,
    body,
  ));
}

// ── Ausências ─────────────────────────────────────────────────
export function exportAbsencesPDF(absences: (Absence & { employee_name?: string })[]) {
  if (Platform.OS !== 'web') return;
  const rows = absences.map(a => `
    <tr>
      <td>${a.employee_name ?? `Colaborador #${a.employee_id}`}</td>
      <td>${ABSENCE_TYPE_LABELS[a.type] ?? a.type}</td>
      <td>${formatDate(a.start_date)}</td>
      <td>${formatDate(a.end_date)}</td>
      <td style="text-align:center">${a.days_count ?? '—'}</td>
      <td>${statusBadge(a.status)}</td>
    </tr>`).join('');

  const body = `
    <table>
      <thead><tr><th>Colaborador</th><th>Tipo</th><th>Início</th><th>Fim</th><th>Dias</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  openPrint(shell(
    'Relatório de Ausências',
    `${absences.length} registro${absences.length !== 1 ? 's' : ''}`,
    body,
  ));
}

// ── Analytics ─────────────────────────────────────────────────
export function exportAnalyticsPDF(overview: AnalyticsOverview) {
  if (Platform.OS !== 'web') return;
  const s = overview.summary;
  const ab = overview.absenteeism;

  const kpis = `
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-value">${s.total}</div><div class="kpi-label">Total</div></div>
      <div class="kpi"><div class="kpi-value">${s.ativo}</div><div class="kpi-label">Ativos</div></div>
      <div class="kpi"><div class="kpi-value">${s.ferias + s.licenca + s.afastado}</div><div class="kpi-label">Ausentes</div></div>
    </div>`;

  const deptRows = (overview.headcount_by_dept ?? []).map(d => `
    <tr><td>${d.department ?? 'Sem departamento'}</td><td style="text-align:center"><strong>${d.count}</strong></td></tr>
  `).join('');

  const deptTable = deptRows ? `
    <h2>Headcount por Departamento</h2>
    <table>
      <thead><tr><th>Departamento</th><th style="text-align:center">Colaboradores</th></tr></thead>
      <tbody>${deptRows}</tbody>
    </table>` : '';

  const abSection = ab ? `
    <h2>Absenteísmo</h2>
    <table>
      <thead><tr><th>Período</th><th>Dias</th><th>Percentual</th></tr></thead>
      <tbody>
        <tr><td>Atual</td><td>${ab.current.days}</td><td>${ab.current.pct}%</td></tr>
        <tr><td>Anterior</td><td>${ab.prev.days}</td><td>${ab.prev.pct}%</td></tr>
      </tbody>
    </table>` : '';

  const riskRows = [
    ...(overview.turnover_risk?.alto?.employees ?? []).map(e => ({ ...e, risk: 'Alto' })),
    ...(overview.turnover_risk?.medio?.employees ?? []).map(e => ({ ...e, risk: 'Médio' })),
  ].slice(0, 10).map(e => `
    <tr>
      <td>${e.name}</td>
      <td>${e.department_name ?? '—'}</td>
      <td>${e.role_title}</td>
      <td>${e.days_in_company} dias</td>
      <td>${e.absences_90d} (90d)</td>
      <td>${statusBadge(e.risk === 'Alto' ? 'recusado' : 'pendente').replace(e.risk === 'Alto' ? 'Recusado' : 'Pendente', e.risk)}</td>
    </tr>`).join('');

  const riskTable = riskRows ? `
    <h2>Risco de Turnover</h2>
    <table>
      <thead><tr><th>Colaborador</th><th>Departamento</th><th>Cargo</th><th>Tempo</th><th>Ausências</th><th>Risco</th></tr></thead>
      <tbody>${riskRows}</tbody>
    </table>` : '';

  const body = kpis + deptTable + abSection + riskTable;
  openPrint(shell('Relatório de People Analytics', `Gerado em ${new Date().toLocaleDateString('pt-BR')}`, body));
}
