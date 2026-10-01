// ============================================================
// componentes/QrCodeModal.tsx — SuperRH
// QR code do link público da pesquisa, gerado no próprio aparelho (helpers/qr.ts).
// Web: baixar como imagem (PNG) e imprimir. Qualquer plataforma: copiar o link.
// ============================================================

import * as Clipboard from 'expo-clipboard';
import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useToast } from '../contextos/Toast';
import { cores } from '../estilo/cores';
import { borda, espaco, raio } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';
import { MARGEM_QR, MatrizQr, gerarQr, htmlParaImpressao, qrParaSvg, trechosDoQr } from '../helpers/qr';
import { Button } from './Button';
import { Modal } from './Modal';

type QrCodeModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Nome da pesquisa (vai no arquivo e na folha impressa). */
  titulo: string;
  /** Link público que o QR aponta. */
  link: string;
};

const LADO_MAXIMO = 260;

function nomeDoArquivo(titulo: string): string {
  const base = titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return `qr-${base || 'pesquisa'}.png`;
}

/** Desenha o QR com Views (um bloco por trecho escuro): funciona igual na web e no celular. */
function QrDesenhado({ matriz }: { matriz: MatrizQr }) {
  const total = matriz.tamanho + MARGEM_QR * 2;
  // Módulo com número inteiro de pixels: sem linhas finas entre blocos.
  const modulo = Math.max(2, Math.floor(LADO_MAXIMO / total));
  const lado = modulo * total;
  const trechos = useMemo(() => trechosDoQr(matriz), [matriz]);
  return (
    <View
      accessibilityLabel="QR code da pesquisa"
      accessibilityRole="image"
      style={[styles.qr, { height: lado, width: lado }]}
    >
      {trechos.map((t) => (
        <View key={`${t.x}-${t.y}`} style={{ backgroundColor: '#000000', height: modulo, left: (t.x + MARGEM_QR) * modulo, position: 'absolute', top: (t.y + MARGEM_QR) * modulo, width: t.largura * modulo }} />
      ))}
    </View>
  );
}

/** Web: rasteriza o SVG num canvas e baixa como PNG (bom para WhatsApp e impressão). */
function baixarPng(svg: string, nomeArquivo: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('Canvas indisponível')); return; }
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1000, 1000);
      ctx.drawImage(img, 0, 0, 1000, 1000);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('Não foi possível gerar a imagem')); return; }
        const href = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = href;
        a.download = nomeArquivo;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(href), 1000);
        resolve();
      }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível desenhar o QR')); };
    img.src = url;
  });
}

/** Web: abre uma folha simples e chama a impressão. Devolve false se o navegador bloqueou a janela. */
function imprimir(svg: string, titulo: string, link: string): boolean {
  const janela = window.open('', '_blank');
  if (!janela) return false;
  janela.document.write(htmlParaImpressao(svg, titulo, link));
  janela.document.close();
  janela.focus();
  janela.print();
  return true;
}

export function QrCodeModal({ visible, onClose, titulo, link }: QrCodeModalProps) {
  const toast = useToast();
  const web = Platform.OS === 'web';
  const matriz = useMemo(() => {
    if (!link) return null; // modal fechado: nada a gerar
    try { return gerarQr(link); } catch (e: unknown) { console.warn('[QR] não foi possível gerar:', e instanceof Error ? e.message : 'erro'); return null; }
  }, [link]);

  async function copiar() {
    await Clipboard.setStringAsync(link);
    toast.success('Link copiado.');
  }

  async function baixar() {
    if (!matriz) return;
    try {
      await baixarPng(qrParaSvg(matriz), nomeDoArquivo(titulo));
      toast.success('Imagem do QR code baixada.');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível baixar o QR code.');
    }
  }

  function imprimirQr() {
    if (!matriz) return;
    if (!imprimir(qrParaSvg(matriz), titulo, link)) toast.error('O navegador bloqueou a janela de impressão. Libere pop-ups para este site.');
  }

  return (
    <Modal onClose={onClose} subtitle="O cliente aponta a câmera do celular e responde, sem login." title="QR code da pesquisa" visible={visible}>
      <View style={styles.corpo}>
        <Text accessibilityRole="header" style={styles.titulo}>{titulo}</Text>
        {matriz ? <QrDesenhado matriz={matriz} /> : <Text style={styles.erro}>Não foi possível gerar o QR code. Use o link abaixo.</Text>}
        <Text selectable style={styles.link}>{link}</Text>
        <View style={styles.acoes}>
          <Button accessibilityLabel="Copiar link da pesquisa" icon="copy-outline" label="Copiar link" onPress={() => { void copiar(); }} variant="secondary" />
          {web && matriz ? <Button accessibilityLabel="Baixar o QR code como imagem" icon="download-outline" label="Baixar imagem" onPress={() => { void baixar(); }} variant="secondary" /> : null}
          {web && matriz ? <Button accessibilityLabel="Imprimir o QR code" icon="print-outline" label="Imprimir" onPress={imprimirQr} /> : null}
        </View>
        {!web ? <Text style={styles.dica}>Para baixar ou imprimir o QR code, abra o SuperRH pelo computador.</Text> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  corpo: { alignItems: 'center', gap: espaco.lg },
  titulo: { ...tipografia.subtitulo, color: cores.texto.primario, textAlign: 'center' },
  qr: { backgroundColor: '#FFFFFF', borderColor: cores.borda.sutil, borderRadius: raio.controle, borderWidth: borda.fina, overflow: 'hidden', position: 'relative' },
  link: { ...tipografia.legenda, color: cores.texto.secundario, textAlign: 'center' },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm, justifyContent: 'center' },
  erro: { ...tipografia.corpo, color: cores.status.erro.forte, textAlign: 'center' },
  dica: { ...tipografia.legenda, color: cores.texto.discreto, textAlign: 'center' },
});
