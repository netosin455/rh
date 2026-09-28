import { Badge } from './Badge';

type StatusPillProps = {
  label: string;
  status?: 'success' | 'info' | 'pending' | 'danger' | 'muted' | 'ativo' | 'licenca' | 'pendente' | 'erro' | 'inativo';
};

const statusTone = {
  success: 'success',
  info: 'info',
  pending: 'gold',
  danger: 'danger',
  muted: 'muted',
  ativo: 'success',
  licenca: 'info',
  pendente: 'gold',
  erro: 'danger',
  inativo: 'muted',
} as const;

/** Especializa Badge para estados de domínio, sem duplicar a superfície visual. */
export function StatusPill({ label, status = 'muted' }: StatusPillProps) {
  return <Badge label={label} tone={statusTone[status]} />;
}
