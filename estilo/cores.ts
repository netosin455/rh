export const cores = {
  superficie: {
    pagina: '#F7F8FA',
    elevada: '#FFFFFF',
    sutil: '#F9FAFB',
    destaque: '#EEF0FF',
    transparente: 'transparent',
  },
  texto: {
    primario: '#101828',
    secundario: '#475467',
    discreto: '#667085',
    sobreAccent: '#FFFFFF',
    sobreEscuro: '#FFFFFF',
    accentSobreClaro: '#434EC2',
  },
  borda: {
    sutil: '#EAECF0',
    forte: '#D0D5DD',
  },
  // Nomes "dourado*" ficam por compatibilidade (evita reescrever todo consumidor);
  // o valor é a nova cor principal (índigo). Dourado real virou só o traço da marca (BrandMark).
  accent: {
    dourado: '#4F5BD5',
    douradoClaro: '#818CF0',
    douradoProfundo: '#434EC2',
    superficie: '#EEF0FF',
    borda: 'rgba(79,91,213,0.30)',
    sutil: 'rgba(79,91,213,0.12)',
  },
  status: {
    sucesso: { forte: '#12B76A', superficie: '#ECFDF3', borda: '#ABEFC6' },
    erro: { forte: '#F04438', superficie: '#FEF3F2', borda: '#FECDCA' },
    informacao: { forte: '#2E90FA', superficie: '#EFF8FF', borda: '#B2DDFF' },
    pendente: { forte: '#F79009', superficie: '#FFFAEB', borda: '#FEDF89' },
  },
  sidebar: {
    superficie: '#171A21',
    hover: '#20232A',
    itemAtivo: '#272B35',
    // Mantido por compatibilidade; sem uso previsto no login novo (que agora é claro).
    superficieProfunda: '#161616',
    texto: '#FFFFFF',
    textoInativo: 'rgba(255,255,255,0.72)',
    accent: '#4F5BD5',
  },
  foco: {
    anel: '#4F5BD5',
    superficie: '#EEF0FF',
  },
  elevacao: {
    sombra: 'rgba(16,24,40,0.06)',
    backdrop: 'rgba(16,24,40,0.45)',
  },
  categoria: {
    civel: '#D4AF37',
    trabalhista: '#60A5FA',
    tributario: '#F87171',
    familia: '#A78BFA',
    criminal: '#FB923C',
    empresarial: '#34D399',
    outro: '#6B7280',
  },
  ausencia: {
    maternidade: '#6F4A9A',
    paternidade: '#19714F',
  },
} as const;

// ============================================================
// TEMA SUPERRH — Modern Law
// Paleta: Grafite Profundo + Champagne Gold + Off-White
// ============================================================

/** @deprecated Use `cores` nos novos componentes; mantido para telas ainda não migradas. */
export const theme = {
  superficie: cores.superficie,
  texto: cores.texto,
  bordaSemantica: cores.borda,
  accent: cores.accent,
  status: cores.status,
  sidebarSemantica: cores.sidebar,
  foco: cores.foco,
  elevacao: cores.elevacao,

  /**
   * @deprecated Aliases abaixo existem só pras 2 telas ainda não migradas pro objeto `cores`
   * (notificacoes.tsx, responder/[id].tsx). Apontam pra `cores`/`accent` em vez de duplicar hex,
   * pra não ficarem com a paleta antiga quando o resto do app mudar de identidade visual.
   */
  card: cores.superficie.elevada,
  borderStrong: cores.borda.forte,
  textPrimary: cores.texto.primario,
  textSecondary: cores.texto.secundario,
  goldPale: cores.accent.superficie,
  onGold: cores.texto.sobreAccent,
  successBackground: cores.status.sucesso.superficie,
  dangerBackground: cores.status.erro.superficie,
  onDark: cores.texto.sobreEscuro,
  warningBackground: cores.status.pendente.superficie,
  infoBackground: cores.status.informacao.superficie,
  sidebar: cores.sidebar.superficie,
  tabSidebarInactive: cores.sidebar.textoInativo,
  tabSidebarActive: cores.sidebar.accent,
  tabMobileInactive: cores.texto.discreto,
  shadow: cores.elevacao.sombra,
  shadowStrong: cores.elevacao.backdrop,

  // ── Fundos ──────────────────────────────────────────────
  bg:           cores.superficie.pagina,
  surface:      cores.superficie.elevada,
  surface2:     cores.superficie.elevada,
  surface3:     cores.superficie.destaque,

  // ── Accent (nome "gold*" mantido por compatibilidade; valor é o índigo novo) ──
  gold:         cores.accent.dourado,
  goldLight:    cores.accent.douradoClaro,
  goldDeep:     cores.accent.douradoProfundo,
  goldDim:      cores.accent.sutil,
  goldGlow:     cores.accent.sutil,
  goldOutline:  cores.accent.borda,
  dangerSubtle: cores.status.erro.superficie,
  dangerBorder: cores.status.erro.borda,
  dangerOutline: cores.status.erro.borda,
  pendingBackground: cores.status.pendente.superficie,
  pendingBorder: cores.status.pendente.borda,
  pendingCard: 'rgba(23,26,33,0.95)',

  // ── Bordas ──────────────────────────────────────────────
  border:       cores.borda.sutil,
  border2:      cores.borda.forte,
  borderWhite:  cores.borda.sutil,

  // ── Textos ──────────────────────────────────────────────
  white:        cores.texto.primario,
  text:         cores.texto.primario,
  textMuted:    cores.texto.discreto,
  textLight:    cores.texto.secundario,

  // ── Status ──────────────────────────────────────────────
  success:      cores.status.sucesso.forte,
  warning:      cores.status.pendente.forte,
  danger:       cores.status.erro.forte,
  info:         cores.status.informacao.forte,
  absenceMaternity: '#6F4A9A',
  absencePaternity: '#19714F',

  // ── Categorias jurídicas ─────────────────────────────────
  category: {
    civel:       '#D4AF37', // champagne gold
    trabalhista: '#60A5FA', // azul
    tributario:  '#F87171', // vermelho
    familia:     '#A78BFA', // roxo
    criminal:    '#FB923C', // laranja
    empresarial: '#34D399', // verde
    outro:       '#6B7280', // cinza
  },
} as const;

// Constantes de espaçamento
/** @deprecated Use `spacing` de `estilo/espaco`. */
export { spacing } from './espaco';

// Border radius
/** @deprecated Use `radius` de `estilo/espaco`. */
export { radius } from './espaco';
