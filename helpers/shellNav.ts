// ============================================================
// helpers/shellNav.ts — SuperRH
// Configuração de navegação do shell (sidebar web e aba "Mais" no mobile).
// Sem componentes: só dados e regras de acesso.
// ============================================================

import type { Ionicons } from '@expo/vector-icons';

export type TabName = 'index' | 'colaboradores' | 'ferias' | 'agenda' | 'avisos' | 'reconhecimentos' | 'analytics' | 'ia' | 'admin' | 'mais';

export type ShellNavigationItem = {
  key: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  /** Rotas de detalhe que pertencem a este item (ex.: /colaborador/[id] marca Equipe). */
  subrotas?: readonly string[];
  tabName?: Exclude<TabName, 'mais'>;
  roles: readonly string[] | null;
};

type ShellNavigationGroup = {
  title: string;
  items: readonly ShellNavigationItem[];
};

export const SHELL_GROUPS: readonly ShellNavigationGroup[] = [
  {
    title: 'Visão geral',
    items: [{ key: 'dashboard', title: 'Dashboard', icon: 'grid', href: '/(tabs)', tabName: 'index', roles: null }],
  },
  {
    title: 'Pessoas',
    items: [
      { key: 'equipe', title: 'Equipe', icon: 'people', href: '/(tabs)/colaboradores', tabName: 'colaboradores', subrotas: ['/colaborador'], roles: null },
      { key: 'onboarding', title: 'Onboarding', icon: 'rocket', href: '/onboarding', roles: null },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { key: 'ferias', title: 'Férias', icon: 'umbrella', href: '/(tabs)/ferias', tabName: 'ferias', roles: null },
      { key: 'agenda', title: 'Agenda', icon: 'calendar', href: '/(tabs)/agenda', tabName: 'agenda', roles: null },
      // Mesma permissão do Analytics (mexe com saldo e ausência de todo mundo).
      { key: 'fechamento', title: 'Fechamento', icon: 'document-text', href: '/fechamento', roles: ['rh', 'admin', 'super_admin', 'adm'] },
    ],
  },
  {
    title: 'Comunicação',
    items: [
      { key: 'avisos', title: 'Avisos', icon: 'megaphone', href: '/(tabs)/avisos', tabName: 'avisos', roles: null },
      { key: 'reconhecimentos', title: 'Kudos', icon: 'trophy', href: '/(tabs)/reconhecimentos', tabName: 'reconhecimentos', roles: null },
      { key: 'pesquisas', title: 'Pesquisas', icon: 'stats-chart', href: '/pesquisas', roles: null },
      // Área própria de satisfação do cliente (mesma permissão de Pesquisas); /nps/* mantém o item ativo.
      { key: 'nps', title: 'NPS', icon: 'speedometer', href: '/nps', roles: null },
      { key: 'feedbacks', title: 'Feedbacks', icon: 'chatbox-ellipses', href: '/feedbacks', roles: ['super_admin', 'admin', 'rh', 'adm'] },
    ],
  },
  {
    title: 'Inteligência',
    items: [
      { key: 'analytics', title: 'Analytics', icon: 'bar-chart', href: '/(tabs)/analytics', tabName: 'analytics', roles: ['rh', 'admin', 'super_admin', 'adm'] },
      { key: 'ia', title: 'Assistente', icon: 'sparkles', href: '/(tabs)/ia', tabName: 'ia', roles: null },
    ],
  },
  {
    title: 'Administração',
    items: [{ key: 'admin', title: 'Admin', icon: 'shield-checkmark', href: '/(tabs)/admin', tabName: 'admin', roles: ['super_admin'] }],
  },
];

export const MOBILE_PRIMARY_KEYS = new Set(['dashboard', 'equipe', 'ferias', 'agenda']);

export const CAN_APPROVE = ['super_admin', 'admin', 'rh', 'adm', 'gestor'];
export function canAccessNavigation(roles: readonly string[] | null, role: string | undefined) {
  return roles === null || roles.includes(role ?? '');
}
