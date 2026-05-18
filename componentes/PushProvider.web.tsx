// ============================================================
// componentes/PushProvider.web.tsx — Web (no-op)
// Push notifications não são suportadas no web — só renderiza children
// ============================================================

import React from 'react';

export function PushProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
