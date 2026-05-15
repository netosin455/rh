// helpers/pdf.ts — geração de relatórios PDF client-side (apenas web)
// Usa jspdf + jspdf-autotable
import { Platform } from 'react-native';
import type { Employee, Absence, AnalyticsOverview } from '../tipos/modelos';
import { ABSENCE_TYPE_LABELS, STATUS_LABELS } from '../tipos/modelos';

const GOLD   = [201, 168, 76]  as const;
const DARK   = [15, 17, 21]    as const;
const MUTED  = [120, 124, 137] as const;
const WHITE  = [255, 255, 255] as const;
const DANGER = [224, 82, 82]   as const;

function formatDate(s?: string) {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function addHeader(doc: any, title: string, subtitle?: string) {
  doc.setFillColor(...DARK);
  doc.rect(0, 0, doc.internal.pageSize.width, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...GOLD);
  doc.text('SuperRH', 14, 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, 14, 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...WHITE);
  doc.text(title, 14, 24);

  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text(subtitle, 14, 30);
  }

  return subtitle ? 38 : 34;
}

// ── Relatório de Colaboradores ────────────────────────────────
export async function exportEmployeesPDF(employees: Employee[]) {
  if (Platform.OS !== 'web') return;
  const { default: jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm' });
  const startY = addHeader(doc, 'Relatório de Colaboradores', `${employees.length} colaboradores`);

  const rows = employees.map(e => [
    e.name,
    e.role_title,
    e.department_name ?? '—',
    STATUS_LABELS[e.status] ?? e.status,
    formatDate(e.hire_date),
  ]);

  (doc as any).autoTable({
    startY,
    head: [['Nome', 'Cargo', 'Departamento', 'Status', 'Admissão']],
    body: rows,
    styles:       { fontSize: 9, cellPadding: 3 },
    headStyles:   { fillColor: GOLD, textColor: DARK, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [24, 27, 33] },
    bodyStyles:   { fillColor: [18, 21, 27], textColor: WHITE },
    margin:       { left: 14, right: 14 },
  });

  doc.save('colaboradores-superrh.pdf');
}

// ── Relatório de Ausências ────────────────────────────────────
export async function exportAbsencesPDF(absences: (Absence & { employee_name?: string })[]) {
  if (Platform.OS !== 'web') return;
  const { default: jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm' });
  const startY = addHeader(doc, 'Relatório de Ausências', `${absences.length} registros`);

  const STATUS_PT: Record<string, string> = {
    pendente: 'Pendente', aprovado: 'Aprovado', recusado: 'Recusado', cancelado: 'Cancelado',
  };

  const rows = absences.map(a => [
    a.employee_name ?? '—',
    ABSENCE_TYPE_LABELS[a.type] ?? a.type,
    formatDate(a.start_date),
    formatDate(a.end_date),
    String(a.days_count ?? '—'),
    STATUS_PT[a.status] ?? a.status,
  ]);

  (doc as any).autoTable({
    startY,
    head: [['Colaborador', 'Tipo', 'Início', 'Fim', 'Dias', 'Status']],
    body: rows,
    styles:       { fontSize: 9, cellPadding: 3 },
    headStyles:   { fillColor: GOLD, textColor: DARK, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [24, 27, 33] },
    bodyStyles:   { fillColor: [18, 21, 27], textColor: WHITE },
    margin:       { left: 14, right: 14 },
  });

  doc.save('ausencias-superrh.pdf');
}

// ── Relatório de Analytics (Headcount) ────────────────────────
export async function exportAnalyticsPDF(overview: AnalyticsOverview) {
  if (Platform.OS !== 'web') return;
  const { default: jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const doc = new jsPDF({ unit: 'mm' });
  let y = addHeader(doc, 'Relatório de People Analytics');

  const s = overview.summary;

  // ── Resumo numérico
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text('Resumo de Headcount', 14, y + 4);
  y += 10;

  const summaryRows = [
    ['Total de colaboradores', String(s.total)],
    ['Ativos', String(s.ativo)],
    ['Em Férias', String(s.ferias)],
    ['Em Licença', String(s.licenca)],
    ['Afastados', String(s.afastado)],
    ['Desligados', String(s.desligado)],
  ];

  (doc as any).autoTable({
    startY: y,
    body: summaryRows,
    styles:     { fontSize: 10, cellPadding: 3 },
    bodyStyles: { fillColor: [18, 21, 27], textColor: WHITE },
    alternateRowStyles: { fillColor: [24, 27, 33] },
    columnStyles: { 1: { fontStyle: 'bold', textColor: GOLD } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ── Headcount por departamento
  if (overview.headcount_by_dept?.length) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GOLD);
    doc.text('Headcount por Departamento', 14, y + 4);
    y += 10;

    (doc as any).autoTable({
      startY: y,
      head: [['Departamento', 'Colaboradores']],
      body: overview.headcount_by_dept.map((d: any) => [d.department ?? 'Sem depto.', String(d.count)]),
      styles:     { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: GOLD, textColor: DARK, fontStyle: 'bold' },
      bodyStyles: { fillColor: [18, 21, 27], textColor: WHITE },
      alternateRowStyles: { fillColor: [24, 27, 33] },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Absenteísmo
  const ab = overview.absenteeism;
  if (ab) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GOLD);
    doc.text('Absenteísmo', 14, y + 4);
    y += 10;

    (doc as any).autoTable({
      startY: y,
      body: [
        ['Período atual — dias', String(ab.current.days)],
        ['Período atual — percentual', `${ab.current.pct}%`],
        ['Período anterior — dias', String(ab.prev.days)],
        ['Período anterior — percentual', `${ab.prev.pct}%`],
      ],
      styles:     { fontSize: 9, cellPadding: 3 },
      bodyStyles: { fillColor: [18, 21, 27], textColor: WHITE },
      alternateRowStyles: { fillColor: [24, 27, 33] },
      margin: { left: 14, right: 14 },
    });
  }

  doc.save('analytics-superrh.pdf');
}
