import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type PrintableFeedback = {
  company_name: string;
  employee_name: string;
  employee_role_title?: string | null;
  employee_department_name?: string | null;
  created_by_name?: string | null;
  created_by_role?: string | null;
  title: string;
  content: string;
  published_at: string;
  acknowledged_at?: string | null;
  acknowledgment_note?: string | null;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function safeText(value: string): string {
  return value.normalize('NFC').replace(/[^\x20-\xFF\n]/g, '?');
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function senderRole(role?: string | null): string {
  if (role === 'rh') return 'Recursos Humanos';
  if (role === 'admin' || role === 'super_admin' || role === 'adm') return 'Administração';
  return 'SuperRH';
}

function splitLines(text: string, measure: (value: string) => number): string[] {
  return safeText(text).split(/\r?\n/).flatMap((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const lines: string[] = [];
    let line = '';
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (line && measure(candidate) > CONTENT_WIDTH) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    return lines;
  });
}

/** Gera um PDF de texto, sem chamar serviços externos e sem incluir o token secreto. */
export async function createFeedbackPdf(feedback: PrintableFeedback): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - MARGIN;

  function nextPage() {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursorY = PAGE_HEIGHT - MARGIN;
    page.drawText('SuperRH', { x: MARGIN, y: cursorY, size: 14, font: bold, color: rgb(0.31, 0.36, 0.84) });
    cursorY -= 34;
  }

  function write(text: string, font = regular, size = 11, color = rgb(0.09, 0.1, 0.13)) {
    const lineHeight = size + 5;
    splitLines(text, (value) => font.widthOfTextAtSize(value, size)).forEach((line) => {
      if (cursorY < MARGIN + lineHeight) nextPage();
      page.drawText(line, { x: MARGIN, y: cursorY, size, font, color });
      cursorY -= lineHeight;
    });
  }

  function rule() {
    if (cursorY < MARGIN + 24) nextPage();
    page.drawLine({
      start: { x: MARGIN, y: cursorY },
      end: { x: PAGE_WIDTH - MARGIN, y: cursorY },
      thickness: 1,
      color: rgb(0.918, 0.925, 0.941),
    });
    cursorY -= 20;
  }

  function drawCheck() {
    const x = MARGIN + 1;
    const y = cursorY + 5;
    page.drawLine({ start: { x, y }, end: { x: x + 4, y: y - 4 }, thickness: 1.6, color: rgb(0.07, 0.72, 0.42) });
    page.drawLine({ start: { x: x + 4, y: y - 4 }, end: { x: x + 11, y: y + 5 }, thickness: 1.6, color: rgb(0.07, 0.72, 0.42) });
  }

  write('SuperRH', bold, 18, rgb(0.31, 0.36, 0.84));
  const documentDate = formatShortDate(feedback.published_at);
  page.drawText(documentDate, {
    x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(documentDate, 9),
    y: PAGE_HEIGHT - MARGIN + 3,
    size: 9,
    font: regular,
    color: rgb(0.4, 0.44, 0.52),
  });
  write('FEEDBACK', bold, 10, rgb(0.32, 0.34, 0.39));
  cursorY -= 12;
  write(feedback.employee_name, bold, 14);
  const employeeMeta = [feedback.employee_role_title, feedback.employee_department_name].filter(Boolean).join(' · ');
  if (employeeMeta) write(employeeMeta, regular, 10, rgb(0.38, 0.4, 0.45));
  cursorY -= 8;
  write(feedback.title, bold, 18);
  rule();
  write(`Publicado em: ${formatDate(feedback.published_at)}`, regular, 10, rgb(0.38, 0.4, 0.45));
  cursorY -= 14;
  write(feedback.content, regular, 11);
  cursorY -= 12;
  rule();
  write('Enviado por', bold, 9, rgb(0.38, 0.4, 0.45));
  write(feedback.created_by_name || feedback.company_name, bold, 11);
  write(senderRole(feedback.created_by_role), regular, 10, rgb(0.38, 0.4, 0.45));
  cursorY -= 14;
  write('CONFIRMAÇÃO', bold, 9, rgb(0.38, 0.4, 0.45));
  if (feedback.acknowledged_at) {
    if (cursorY < MARGIN + 24) nextPage();
    drawCheck();
    page.drawText('Leitura confirmada', { x: MARGIN + 18, y: cursorY, size: 10, font: bold, color: rgb(0.05, 0.4, 0.26) });
    cursorY -= 16;
    write(formatDate(feedback.acknowledged_at), regular, 10, rgb(0.38, 0.4, 0.45));
    if (feedback.acknowledgment_note) {
      cursorY -= 8;
      write('Observação do colaborador', bold, 9, rgb(0.38, 0.4, 0.45));
      write(feedback.acknowledgment_note, regular, 10);
    }
  } else {
    write('Leitura ainda não confirmada.', bold, 10, rgb(0.38, 0.4, 0.45));
  }
  rule();
  write('Documento gerado pelo SuperRH', regular, 9, rgb(0.45, 0.47, 0.52));

  return document.save();
}
