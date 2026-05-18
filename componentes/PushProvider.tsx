// ============================================================
// componentes/PushProvider.tsx — fallback (web/SSR)
// No-op: expo-notifications não funciona em web/SSR
// Metro usa .native.tsx em iOS/Android e .web.tsx no browser;
// este arquivo serve de fallback para o renderer SSR do Expo.
// ============================================================

import React from 'react';

export function PushProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
