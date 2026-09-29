import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type PrintableFeedback = {
  company_name: string;
  employee_name: string;
  title: string;
  content: string;
  published_at: string;
  acknowledged_at?: string | null;
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
  }

  function write(text: string, font = regular, size = 11, color = rgb(0.09, 0.1, 0.13)) {
    const lineHeight = size + 5;
    splitLines(text, (value) => font.widthOfTextAtSize(value, size)).forEach((line) => {
      if (cursorY < MARGIN + lineHeight) nextPage();
      page.drawText(line, { x: MARGIN, y: cursorY, size, font, color });
      cursorY -= lineHeight;
    });
  }

  write('SuperRH', bold, 18, rgb(0.31, 0.36, 0.84));
  write('FEEDBACK INDIVIDUAL', bold, 10, rgb(0.32, 0.34, 0.39));
  cursorY -= 12;
  write(feedback.title, bold, 18);
  write(`Para: ${feedback.employee_name}`, regular, 11);
  write(`Publicado em: ${formatDate(feedback.published_at)}`, regular, 10, rgb(0.38, 0.4, 0.45));
  cursorY -= 14;
  write(feedback.content, regular, 11);
  cursorY -= 12;
  write(
    feedback.acknowledged_at
      ? `Leitura confirmada em ${formatDate(feedback.acknowledged_at)}.`
      : 'Leitura ainda não confirmada.',
    bold,
    10,
    feedback.acknowledged_at ? rgb(0.05, 0.4, 0.26) : rgb(0.58, 0.35, 0.02),
  );
  write(`Documento emitido por ${feedback.company_name}.`, regular, 9, rgb(0.45, 0.47, 0.52));

  return document.save();
}
