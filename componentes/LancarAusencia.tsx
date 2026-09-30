// ============================================================
// componentes/LancarAusencia.tsx — SuperRH
// Tela única "Lançar": falta, folga, hora extra, férias e licença.
// Só o RH usa o app, então tudo que é lançado aqui já entra aprovado (a API decide).
// Regras e payloads vivem em helpers/lancamento.ts; aqui só UI e a chamada de escrita.
// ============================================================

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { createAbsence } from '../conexoes/ausencias';
import { updateEmployee } from '../conexoes/colaboradores';
import { useToast } from '../contextos/Toast';
import { cores } from '../estilo/cores';
import { borda, espaco, raio, tamanho } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';
import { getTodayString, maskDate } from '../helpers/datas';
import {
  EntradaLancamento,
  SUBTIPOS_LICENCA,
  TIPOS_LANCAMENTO,
  TipoLancamento,
  bloqueioDeSaldo,
  descreverLancamento,
  diasDoPeriodo,
  ATALHOS_HORAS_FOLGA,
  entradaInicial,
  faltamHorasNaFolga,
  formatarHoras,
  mostraBancoHoras,
  montarLancamento,
  previaBancoHoras,
  previaFerias,
  usaPeriodo,
  usaQuanto,
} from '../helpers/lancamento';
import type { Employee } from '../tipos/modelos';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Card } from './Card';
import { Input } from './Input';
import { ListRow } from './ListRow';
import { Modal } from './Modal';

const ICONES: Record<TipoLancamento, keyof typeof Ionicons.glyphMap> = {
  faltou: 'close-circle-outline',
  folga: 'time-outline',
  hora_extra: 'add-circle-outline',
  ferias: 'umbrella-outline',
  licenca: 'medkit-outline',
};

type LancarAusenciaProps = {
  visible: boolean;
  onClose: () => void;
  /** Lista de colaboradores já carregada pela tela (getEmployees paginado). */
  employees: Employee[];
  /** Quando aberto pela linha da pessoa, já vem preenchido. */
  employeeId?: number | null;
  /** Chamado depois de salvar com sucesso, para a tela recarregar saldos/lista. */
  onLancado: () => void;
};

function Opcao({ label, icon, selecionada, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; selecionada: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{ selected: selecionada }}
      onPress={onPress}
      style={[styles.opcao, selecionada && styles.opcaoAtiva]}
    >
      <Ionicons color={selecionada ? cores.texto.sobreAccent : cores.accent.douradoProfundo} name={icon} size={tamanho.iconeGrande} />
      <Text style={[styles.opcaoTexto, selecionada && styles.opcaoTextoAtivo]}>{label}</Text>
    </Pressable>
  );
}

function Chip({ label, selecionado, onPress }: { label: string; selecionado: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{ selected: selecionado }}
      onPress={onPress}
      style={[styles.chip, selecionado && styles.chipAtivo]}
    >
      <Text style={[styles.chipTexto, selecionado && styles.chipTextoAtivo]}>{label}</Text>
    </Pressable>
  );
}

function Rotulo({ children }: { children: string }) {
  return <Text accessibilityRole="header" style={styles.rotulo}>{children}</Text>;
}

export function LancarAusencia({ visible, onClose, employees, employeeId, onLancado }: LancarAusenciaProps) {
  const toast = useToast();
  const { height } = useWindowDimensions();
  const [entrada, setEntrada] = useState<EntradaLancamento>(entradaInicial);
  const [escolhidoId, setEscolhidoId] = useState<number | null>(null);
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  // Trava síncrona: dois cliques rápidos podem chegar antes do re-render do "salvando".
  const emAndamento = useRef(false);

  // Cada abertura recomeça do zero (e já vem com a pessoa, se abriu pela linha dela).
  useEffect(() => {
    if (!visible) return;
    setEntrada(entradaInicial());
    setEscolhidoId(employeeId ?? null);
    setBusca('');
    setErro('');
    setSalvando(false);
    emAndamento.current = false;
  }, [visible, employeeId]);

  const colaborador = useMemo(() => employees.find((e) => e.id === escolhidoId) ?? null, [employees, escolhidoId]);
  const resultados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return [];
    return employees.filter((e) => e.status !== 'desligado' && e.name.toLowerCase().includes(q)).slice(0, 6);
  }, [employees, busca]);

  const saldo = { vacation_days: colaborador?.vacation_days ?? 0, folga_hours: Number(colaborador?.folga_hours ?? 0) };
  const nome = colaborador?.name ?? '';
  const bloqueio = colaborador ? bloqueioDeSaldo(entrada, nome, saldo) : null;
  const previaBanco = colaborador ? previaBancoHoras(entrada, saldo) : null;
  const feriasPrevia = colaborador && entrada.tipo === 'ferias' ? previaFerias(entrada, saldo) : null;

  function mudar(parcial: Partial<EntradaLancamento>) {
    setEntrada((atual) => ({ ...atual, ...parcial }));
    setErro('');
  }

  async function salvar() {
    if (emAndamento.current) return;
    setErro('');
    const resultado = montarLancamento(entrada, colaborador?.id ?? 0, nome, saldo, getTodayString());
    if (!resultado.ok) { setErro(resultado.erro); return; }

    emAndamento.current = true;
    setSalvando(true);
    try {
      // Escrita nunca é repetida sozinha (apiFetch não faz retry): erro fica visível e o RH decide.
      if (resultado.payload.via === 'banco_horas') {
        await updateEmployee(resultado.payload.employee_id, { folga_hours_delta: resultado.payload.folga_hours_delta });
      } else {
        await createAbsence(resultado.payload.dados);
      }
      toast.success(descreverLancamento(resultado.payload, entrada, nome, resultado.previa));
      onLancado();
      onClose();
    } catch (e: unknown) {
      setErro(e instanceof Error && e.message ? e.message : 'Não foi possível lançar. Tente novamente.');
    } finally {
      emAndamento.current = false;
      setSalvando(false);
    }
  }

  const periodoDias = usaPeriodo(entrada.tipo) ? diasDoPeriodo(entrada) : null;
  const salvarBloqueado = salvando || Boolean(bloqueio) || faltamHorasNaFolga(entrada);

  return (
    <Modal
      footer={
        <View style={styles.rodape}>
          <Button accessibilityLabel="Cancelar" disabled={salvando} label="Cancelar" onPress={onClose} style={styles.botaoRodape} variant="secondary" />
          <Button accessibilityLabel="Salvar lançamento" disabled={salvarBloqueado} label="Salvar" loading={salvando} onPress={salvar} style={styles.botaoRodape} />
        </View>
      }
      onClose={onClose}
      subtitle="Falta, folga, hora extra, férias ou licença."
      title="Lançar"
      visible={visible}
    >
      <ScrollView contentContainerStyle={styles.conteudo} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ maxHeight: Math.min(520, height * 0.55) }}>
        <View style={styles.bloco}>
          <Rotulo>Lançar para:</Rotulo>
          {colaborador ? (
            <View style={styles.pessoa}>
              <Avatar name={colaborador.name} size="small" />
              <View style={styles.pessoaTexto}>
                <Text style={styles.pessoaNome}>{colaborador.name}</Text>
                <Text style={styles.dica}>{colaborador.role_title}</Text>
              </View>
              <Button accessibilityLabel="Trocar colaborador" disabled={salvando} label="Trocar" onPress={() => { setEscolhidoId(null); setBusca(''); }} variant="ghost" />
            </View>
          ) : (
            <>
              <Input label="Buscar colaborador" onChangeText={setBusca} placeholder="Digite o nome" value={busca} />
              {busca.trim() !== '' ? (
                resultados.length > 0 ? (
                  <Card padded={false}>
                    {resultados.map((e) => (
                      <ListRow accessibilityLabel={`Escolher ${e.name}`} description={e.role_title} key={e.id} leading={<Avatar name={e.name} size="small" />} onPress={() => { setEscolhidoId(e.id); setBusca(''); }} title={e.name} />
                    ))}
                  </Card>
                ) : <Text style={styles.dica}>Ninguém encontrado com esse nome.</Text>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.bloco}>
          <Rotulo>O que aconteceu?</Rotulo>
          <View accessibilityRole="radiogroup" style={styles.grade}>
            {TIPOS_LANCAMENTO.map((t) => (
              <Opcao icon={ICONES[t.key]} key={t.key} label={t.label} onPress={() => mudar({ tipo: t.key })} selecionada={entrada.tipo === t.key} />
            ))}
          </View>
          {entrada.tipo === 'licenca' ? (
            <View style={styles.subBloco}>
              <Text style={styles.subRotulo}>Qual licença?</Text>
              <View accessibilityRole="radiogroup" style={styles.linhaChips}>
                {SUBTIPOS_LICENCA.map((s) => <Chip key={s.key} label={s.label} onPress={() => mudar({ licenca: s.key })} selecionado={entrada.licenca === s.key} />)}
              </View>
            </View>
          ) : null}
        </View>

        {usaPeriodo(entrada.tipo) ? (
          <View style={styles.bloco}>
            <Rotulo>Quando?</Rotulo>
            <View style={styles.duasColunas}>
              <Input containerStyle={styles.coluna} keyboardType="numeric" label="De" maxLength={10} onChangeText={(v) => mudar({ inicio: maskDate(v) })} placeholder="DD/MM/AAAA" value={entrada.inicio} />
              <Input containerStyle={styles.coluna} keyboardType="numeric" label="Até" maxLength={10} onChangeText={(v) => mudar({ fim: maskDate(v) })} placeholder="DD/MM/AAAA" value={entrada.fim} />
            </View>
            {periodoDias != null ? <Text style={styles.dica}>{periodoDias} dia{periodoDias === 1 ? '' : 's'} no período.</Text> : null}
          </View>
        ) : entrada.tipo !== 'hora_extra' ? (
          <View style={styles.bloco}>
            <Rotulo>Quando?</Rotulo>
            <View accessibilityRole="radiogroup" style={styles.linhaChips}>
              <Chip label="Hoje" onPress={() => mudar({ atalhoData: 'hoje' })} selecionado={entrada.atalhoData === 'hoje'} />
              <Chip label="Ontem" onPress={() => mudar({ atalhoData: 'ontem' })} selecionado={entrada.atalhoData === 'ontem'} />
              <Chip label="Outro dia" onPress={() => mudar({ atalhoData: 'outro' })} selecionado={entrada.atalhoData === 'outro'} />
            </View>
            {entrada.atalhoData === 'outro' ? (
              <Input keyboardType="numeric" label="Dia" maxLength={10} onChangeText={(v) => mudar({ outroDia: maskDate(v) })} placeholder="DD/MM/AAAA" value={entrada.outroDia} />
            ) : null}
          </View>
        ) : null}

        {usaQuanto(entrada.tipo) ? (
          <View style={styles.bloco}>
            <Rotulo>Quanto?</Rotulo>
            <View accessibilityRole="radiogroup" style={styles.linhaChips}>
              <Chip label="Dia inteiro" onPress={() => mudar({ quanto: 'dia_inteiro' })} selecionado={entrada.quanto === 'dia_inteiro'} />
              <Chip label="Só algumas horas" onPress={() => mudar({ quanto: 'algumas_horas' })} selecionado={entrada.quanto === 'algumas_horas'} />
            </View>
            {entrada.quanto === 'algumas_horas' ? (
              <Input accessibilityLabel="Quantidade de horas" keyboardType="decimal-pad" label="Quantas horas?" onChangeText={(v) => mudar({ horas: v })} placeholder="Ex.: 3" value={entrada.horas} />
            ) : null}
          </View>
        ) : null}

        {entrada.tipo === 'folga' ? (
          <View style={styles.bloco}>
            <Rotulo>Quantas horas de folga?</Rotulo>
            <View accessibilityRole="radiogroup" style={styles.linhaChips}>
              {ATALHOS_HORAS_FOLGA.map((h) => (
                <Chip key={h} label={`${h}h`} onPress={() => mudar({ horas: String(h) })} selecionado={Number(entrada.horas.replace(',', '.')) === h} />
              ))}
            </View>
            <Input accessibilityLabel="Quantidade de horas de folga" keyboardType="decimal-pad" label="Horas" onChangeText={(v) => mudar({ horas: v })} placeholder="Ex.: 3" value={entrada.horas} />
          </View>
        ) : null}

        {entrada.tipo === 'hora_extra' ? (
          <View style={styles.bloco}>
            <Rotulo>Quantas horas extras?</Rotulo>
            <Input accessibilityLabel="Quantidade de horas extras" keyboardType="decimal-pad" label="Horas" onChangeText={(v) => mudar({ horas: v })} placeholder="Ex.: 2" value={entrada.horas} />
          </View>
        ) : null}

        <View style={styles.bloco}>
          <Input label="Observação (opcional)" onChangeText={(v) => mudar({ observacao: v })} placeholder="Motivo ou detalhes, se precisar" value={entrada.observacao} />
        </View>

      </ScrollView>

      {/* Resumo e avisos ficam FORA do scroll: quem não consegue salvar precisa ver o porquê sem rolar. */}
      <View style={styles.fixo}>
        {colaborador && mostraBancoHoras(entrada.tipo) ? (
          <View accessibilityLiveRegion="polite" style={styles.saldo}>
            <Text style={styles.saldoRotulo}>Banco de horas</Text>
            <Text style={styles.saldoValor}>
              {previaBanco && previaBanco.depois < 0
                ? `${formatarHoras(previaBanco.antes)} disponíveis (o pedido passa do saldo)`
                : previaBanco && previaBanco.antes !== previaBanco.depois
                  ? `${formatarHoras(previaBanco.antes)} → fica ${formatarHoras(previaBanco.depois)}`
                  : `${formatarHoras(saldo.folga_hours)} agora`}
            </Text>
          </View>
        ) : null}

        {feriasPrevia ? (
          <View accessibilityLiveRegion="polite" style={styles.saldo}>
            <Text style={styles.saldoRotulo}>Dias de férias disponíveis</Text>
            <Text style={styles.saldoValor}>
              {feriasPrevia.dias != null && feriasPrevia.depois >= 0
                ? `${feriasPrevia.antes} → ficam ${feriasPrevia.depois}`
                : `${feriasPrevia.antes} dia${feriasPrevia.antes === 1 ? '' : 's'}${feriasPrevia.dias != null ? ' (o período passa do saldo)' : ''}`}
            </Text>
          </View>
        ) : null}

        {bloqueio ? (
          <View accessibilityRole="alert" style={styles.erro}>
            <Ionicons color={cores.status.erro.forte} name="alert-circle-outline" size={tamanho.iconeMedio} />
            <Text style={styles.erroTexto}>{bloqueio}</Text>
          </View>
        ) : null}
        {erro && erro !== bloqueio ? (
          <View accessibilityRole="alert" style={styles.erro}>
            <Ionicons color={cores.status.erro.forte} name="alert-circle-outline" size={tamanho.iconeMedio} />
            <Text style={styles.erroTexto}>{erro}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  conteudo: { gap: espaco.xl, paddingBottom: espaco.md },
  fixo: { gap: espaco.sm, marginTop: espaco.md },
  bloco: { gap: espaco.sm },
  subBloco: { gap: espaco.xs, marginTop: espaco.xs },
  rotulo: { ...tipografia.corpoForte, color: cores.texto.primario },
  subRotulo: { ...tipografia.legenda, color: cores.texto.secundario },
  dica: { ...tipografia.legenda, color: cores.texto.discreto },
  pessoa: { alignItems: 'center', backgroundColor: cores.superficie.sutil, borderRadius: raio.controle, flexDirection: 'row', gap: espaco.md, padding: espaco.sm },
  pessoaTexto: { flex: 1 },
  pessoaNome: { ...tipografia.corpoForte, color: cores.texto.primario },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  opcao: { alignItems: 'center', backgroundColor: cores.superficie.elevada, borderColor: cores.borda.forte, borderRadius: raio.cartao, borderWidth: borda.fina, flexBasis: '30%', flexGrow: 1, gap: espaco.xs, justifyContent: 'center', minHeight: tamanho.toqueMinimo + espaco.xl, minWidth: 96, paddingHorizontal: espaco.sm, paddingVertical: espaco.md },
  opcaoAtiva: { backgroundColor: cores.accent.dourado, borderColor: cores.accent.dourado },
  opcaoTexto: { ...tipografia.corpoForte, color: cores.texto.primario, textAlign: 'center' },
  opcaoTextoAtivo: { color: cores.texto.sobreAccent },
  linhaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  chip: { alignItems: 'center', backgroundColor: cores.superficie.elevada, borderColor: cores.borda.forte, borderRadius: raio.pill, borderWidth: borda.fina, justifyContent: 'center', minHeight: tamanho.toqueMinimo, paddingHorizontal: espaco.lg },
  chipAtivo: { backgroundColor: cores.accent.superficie, borderColor: cores.accent.dourado },
  chipTexto: { ...tipografia.corpo, color: cores.texto.secundario },
  chipTextoAtivo: { color: cores.texto.primario, fontWeight: '600' },
  duasColunas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.md },
  // minWidth 0 + basis: o campo não pode impor a largura padrão do TextInput e estourar o modal no celular.
  coluna: { flexBasis: 140, flexGrow: 1, flexShrink: 1, minWidth: 0 },
  saldo: { backgroundColor: cores.accent.superficie, borderRadius: raio.controle, gap: espaco.micro, padding: espaco.md },
  saldoRotulo: { ...tipografia.legenda, color: cores.texto.secundario },
  saldoValor: { ...tipografia.subtitulo, color: cores.texto.primario },
  erro: { alignItems: 'center', backgroundColor: cores.status.erro.superficie, borderColor: cores.status.erro.borda, borderRadius: raio.controle, borderWidth: borda.fina, flexDirection: 'row', gap: espaco.sm, padding: espaco.md },
  erroTexto: { ...tipografia.corpo, color: cores.status.erro.forte, flex: 1 },
  rodape: { flexDirection: 'row', gap: espaco.sm },
  botaoRodape: { flex: 1 },
});
