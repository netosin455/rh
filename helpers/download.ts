// ============================================================
// helpers/download.ts — SuperRH
// Baixar um texto como arquivo. Web: link temporário (Blob). Nativo: abre o compartilhar do sistema.
// ============================================================

import { Platform, Share } from 'react-native';

/** Devolve false se não deu para entregar o arquivo. `conteudo` já deve levar o BOM, se precisar. */
export async function baixarTexto(nomeArquivo: string, conteudo: string, tipo = 'text/csv;charset=utf-8'): Promise<boolean> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }
  try {
    await Share.share({ title: nomeArquivo, message: conteudo });
    return true;
  } catch {
    return false;
  }
}
