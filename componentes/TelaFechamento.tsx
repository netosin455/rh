// ============================================================
// componentes/TelaFechamento.tsx — SuperRH
// Fechamento do mês: por colaborador, faltas, folgas, férias, licenças e saldo do banco de horas.
// Mês escolhido por setas (sem digitar). Baixar CSV (Excel brasileiro) e Imprimir / PDF.
// Regras de formatação, filtro e CSV moram em helpers/fechamento.ts.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { getFechamento } from '../conexoes/fechamento';
import { useToast } from '../contextos/Toast';
import { cores } from '../estilo/cores';
import { borda, espaco, raio, tamanho } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';
import { getTodayString } from '../helpers/datas';
import { baixarTexto } from '../helpers/download';
import {
  AVISO_SALDO_BANCO,
  COLUNAS_FECHAMENTO,
  celula,
  filtrarLinhas,
  mesDaData,
  montarCsvFechamento,
  nomeArquivoFechamento,
  rotuloDoMes,
  somarLinhas,
  somarMeses,
} from '../helpers/fechamento';
import { exportFechamentoPDF } from '../helpers/pdf';
import type { Fechamento } from '../tipos/modelos';
import { Button } from './Button';
import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { ErroComRetry } from './ErroComRetry';
import { Input } from './Input';
import { ScreenHeader } from './ScreenHeader';
import { Skeleton } from './Skeleton';

const LARGURA_NOME = 200;
const LARGURA_DEPARTAMENTO = 140;
const LARGURA_NUMERO = 104;

export function TelaFechamento() {
  const toast = useToast();
  const [mes, setMes] = useState(() => mesDaData(getTodayString()));
  const [dados, setDados] = useState<Fechamento | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [busca, setBusca] = useState('');

  const carregar = useCallback(() => {
    let ativo = true;
    setLoading(true);
    setErro(false);
    getFechamento(mes)
      .then((d) => { if (ativo) setDados(d); })
      .catch((e: unknown) => {
        console.error('[Fechamento]', e);
        if (ativo) { setErro(true); setDados(null); }
      })
      .finally(() => { if (ativo) setLoading(false); });
    // Uma resposta atrasada de outro mês não pode sobrescrever a do mês que está na tela.
    return () => { ativo = false; };
  }, [mes]);

  useEffect(() => carregar(), [carregar]);

  const linhas = useMemo(() => filtrarLinhas(dados?.linhas ?? [], busca), [dados, busca]);
  // Sem filtro vale o total da API; com filtro, o TOTAL acompanha o que está na tela.
  const totais = useMemo(() => (busca.trim() || !dados ? somarLinhas(linhas) : dados.totais), [busca, dados, linhas]);
  const temDados = !loading && !erro && dados !== null && dados.linhas.length > 0;

  async function baixarCsv() {
    const ok = await baixarTexto(nomeArquivoFechamento(mes), montarCsvFechamento(mes, linhas, totais));
    if (ok) toast.success(`Arquivo ${nomeArquivoFechamento(mes)} gerado.`);
    else toast.error('Não foi possível gerar o arquivo.');
  }

  return (
    <ScrollView contentContainerStyle={styles.conteudo} style={styles.tela}>
      <View style={styles.pagina}>
        <ScreenHeader title="Fechamento do mês" subtitle="Faltas, folgas, férias, licenças e banco de horas de cada pessoa, para conferir a folha." />

        <View style={styles.barra}>
          <View style={styles.seletor}>
            <Button accessibilityLabel="Mês anterior" icon="chevron-back" onPress={() => setMes((m) => somarMeses(m, -1))} variant="secondary" />
            <Text accessibilityLiveRegion="polite" accessibilityRole="header" style={styles.mes}>{rotuloDoMes(mes)}</Text>
            <Button accessibilityLabel="Próximo mês" icon="chevron-forward" onPress={() => setMes((m) => somarMeses(m, 1))} variant="secondary" />
          </View>
          <View style={styles.acoes}>
            <Button accessibilityLabel="Baixar CSV" disabled={!temDados} icon="download-outline" label="Baixar CSV" onPress={() => { void baixarCsv(); }} variant="secondary" />
            <Button accessibilityLabel="Imprimir / PDF" disabled={!temDados} icon="print-outline" label="Imprimir / PDF" onPress={() => exportFechamentoPDF(mes, linhas, totais)} variant="secondary" />
          </View>
        </View>

        <View style={styles.aviso}>
          <Text style={styles.avisoTexto}>{AVISO_SALDO_BANCO}</Text>
        </View>

        <Input accessibilityLabel="Buscar colaborador" label="Buscar colaborador" onChangeText={setBusca} placeholder="Digite o nome" value={busca} />

        {loading ? (
          <View accessibilityLabel="Carregando fechamento" style={styles.carregando}><Skeleton height={espaco.tela} /><Skeleton height={espaco.tela} /><Skeleton height={espaco.tela} /></View>
        ) : erro ? (
          <ErroComRetry mensagem={`Não foi possível carregar o fechamento de ${rotuloDoMes(mes)}.`} onTentarNovamente={carregar} />
        ) : !dados || dados.linhas.length === 0 ? (
          <Card><EmptyState icon="calendar-outline" title="Sem colaboradores neste mês" description={`Não há dados para fechar em ${rotuloDoMes(mes)}.`} /></Card>
        ) : (
          <Card padded={false} style={styles.cartaoTabela}>
            {/* A rolagem horizontal fica DENTRO do cartão: no celular a página não rola de lado. */}
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View accessibilityLabel={`Fechamento de ${rotuloDoMes(mes)}`} role="table">
                <View role="row" style={[styles.linha, styles.cabecalho]}>
                  <Text role="columnheader" style={[styles.cabecalhoTexto, { width: LARGURA_NOME }]}>Colaborador</Text>
                  <Text role="columnheader" style={[styles.cabecalhoTexto, { width: LARGURA_DEPARTAMENTO }]}>Departamento</Text>
                  {COLUNAS_FECHAMENTO.map((c) => <Text key={c.chave} role="columnheader" style={[styles.cabecalhoTexto, styles.numero, { width: LARGURA_NUMERO }]}>{c.titulo}</Text>)}
                </View>
                {linhas.length === 0 ? (
                  <View role="row" style={styles.linha}><Text role="cell" style={[styles.texto, { padding: espaco.md }]}>Nenhum colaborador com esse nome.</Text></View>
                ) : linhas.map((l) => (
                  <View key={l.employee_id} role="row" style={styles.linha}>
                    <Text role="cell" style={[styles.textoForte, { width: LARGURA_NOME }]}>{l.name}</Text>
                    <Text role="cell" style={[styles.texto, { width: LARGURA_DEPARTAMENTO }]}>{l.department_name ?? '-'}</Text>
                    {COLUNAS_FECHAMENTO.map((c) => <Text key={c.chave} role="cell" style={[styles.texto, styles.numero, { width: LARGURA_NUMERO }]}>{celula(l[c.chave])}</Text>)}
                  </View>
                ))}
                <View role="row" style={[styles.linha, styles.linhaTotal]}>
                  <Text role="rowheader" style={[styles.textoForte, { width: LARGURA_NOME }]}>TOTAL</Text>
                  <Text role="cell" style={[styles.texto, { width: LARGURA_DEPARTAMENTO }]}> </Text>
                  {COLUNAS_FECHAMENTO.map((c) => <Text key={c.chave} role="cell" style={[styles.textoForte, styles.numero, { width: LARGURA_NUMERO }]}>{celula(totais[c.chave])}</Text>)}
                </View>
              </View>
            </ScrollView>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tela: { backgroundColor: cores.superficie.pagina, flex: 1 },
  conteudo: { alignItems: 'center', padding: espaco.xl, paddingBottom: espaco.tela },
  // minWidth 0: sem isso o filho com a tabela larga estica a página em vez de rolar dentro do cartão.
  pagina: { gap: espaco.xl, maxWidth: 1040, minWidth: 0, width: '100%' },
  barra: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: espaco.md, justifyContent: 'space-between' },
  seletor: { alignItems: 'center', flexDirection: 'row', gap: espaco.sm },
  mes: { ...tipografia.subtitulo, color: cores.texto.primario, minWidth: 160, textAlign: 'center' },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  aviso: { backgroundColor: cores.accent.superficie, borderColor: cores.accent.borda, borderRadius: raio.controle, borderWidth: borda.fina, padding: espaco.md },
  avisoTexto: { ...tipografia.corpoForte, color: cores.texto.primario },
  carregando: { gap: espaco.md },
  cartaoTabela: { alignSelf: 'stretch', overflow: 'hidden' },
  linha: { alignItems: 'center', borderBottomColor: cores.borda.sutil, borderBottomWidth: borda.fina, flexDirection: 'row', minHeight: tamanho.toqueMinimo, paddingHorizontal: espaco.md },
  cabecalho: { backgroundColor: cores.superficie.sutil },
  cabecalhoTexto: { ...tipografia.rotulo, color: cores.texto.discreto, textTransform: 'uppercase' },
  linhaTotal: { backgroundColor: cores.superficie.sutil, borderBottomWidth: 0 },
  texto: { ...tipografia.corpo, color: cores.texto.secundario, paddingRight: espaco.sm },
  textoForte: { ...tipografia.corpoForte, color: cores.texto.primario, paddingRight: espaco.sm },
  numero: { textAlign: 'right' },
});
