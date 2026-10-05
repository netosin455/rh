import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable,
  StyleSheet, RefreshControl, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contextos/Autenticacao';
import { Ionicons } from '@expo/vector-icons';
import { getEmployees, createEmployee } from '../../conexoes/colaboradores';
import { Employee, EmployeeStatus, LegalArea, STATUS_LABELS, CreateEmployeeData } from '../../tipos/modelos';
import { cores } from '../../estilo/cores';
import { FiltroEquipe, ROTULO_FILTRO_TEMPORARIO, combinaComFiltroEquipe, lerFiltroEquipe } from '../../helpers/filtros';
import { borda, espaco, raio, tamanho } from '../../estilo/espaco';
import { tipografia } from '../../estilo/tipografia';
import { normalizarTexto } from '../../helpers/buscaColaborador';
import { isoParaBr } from '../../helpers/camposData';
import { brToIso, getTodayString, todayBr } from '../../helpers/datas';
import { maskCPF, maskPhone } from '../../helpers/validacoes';
import { exportEmployeesPDF } from '../../helpers/pdf';
import { Avatar } from '../../componentes/Avatar';
import { Button } from '../../componentes/Button';
import { DateField } from '../../componentes/DateField';
import { EmptyState } from '../../componentes/EmptyState';
import { LancarAusencia } from '../../componentes/LancarAusencia';
import { ErroComRetry } from '../../componentes/ErroComRetry';
import { Input } from '../../componentes/Input';
import { Modal } from '../../componentes/Modal';
import { ScreenHeader } from '../../componentes/ScreenHeader';
import { Skeleton } from '../../componentes/Skeleton';
import { StatusPill } from '../../componentes/StatusPill';

// Mesmo mapeamento de tom usado no Dashboard: estado real comunicado por cor semantica.
function employeeStatusTone(status: EmployeeStatus): 'success' | 'info' | 'pending' | 'muted' {
  if (status === 'ativo') return 'success';
  if (status === 'ferias' || status.startsWith('licenca')) return 'info';
  if (status === 'afastado') return 'pending';
  return 'muted';
}

const FILTERS: { key: FiltroEquipe; label: string }[] = [
  { key: 'todos',    label: 'Todos' },
  { key: 'ativo',    label: 'Ativos' },
  { key: 'ferias',   label: 'Férias' },
  { key: 'licenca',  label: 'Licença' },
  { key: 'afastado', label: 'Afastado' },
];

// A regra de cada filtro mora em helpers/filtros.ts ("Licença" cobre as variantes médica/maternidade/paternidade).

const LEGAL_AREAS: { key: LegalArea; label: string }[] = [
  { key: 'civel',       label: 'Cível' },
  { key: 'trabalhista', label: 'Trabalhista' },
  { key: 'tributario',  label: 'Tributário' },
  { key: 'familia',     label: 'Família' },
  { key: 'criminal',    label: 'Criminal' },
  { key: 'empresarial', label: 'Empresarial' },
  { key: 'outro',       label: 'Outro' },
];

const STATUS_OPTIONS: { key: EmployeeStatus; label: string }[] = [
  { key: 'ativo',     label: 'Ativo' },
  { key: 'ferias',    label: 'Férias' },
  { key: 'licenca',   label: 'Licença' },
  { key: 'afastado',  label: 'Afastado' },
  { key: 'desligado', label: 'Desligado' },
];

const EMPTY_FORM = {
  name:         '',
  role_title:   '',
  hire_date:    todayBr(),
  status:       'ativo' as EmployeeStatus,
  phone:        '',
  email:        '',
  cpf:          '',
  birth_date:   '',
  legal_area:   undefined as LegalArea | undefined,
  oab_number:   '',
  vacation_days: 30,
  folga_hours:  0,
};

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function ColaboradoresScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const canManageEmployees = ['super_admin','admin','rh','adm'].includes(user?.role ?? '');

  const [employees,  setEmployees]  = useState<Employee[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');
  // O filtro de status mora na URL (/colaboradores?status=ativo): números de outras telas levam para cá já filtrados.
  const params = useLocalSearchParams<{ status?: string | string[] }>();
  const filtroUrl = lerFiltroEquipe(params.status);
  const [filter,     setFilter]     = useState<FiltroEquipe>(filtroUrl);
  const [showModal,  setShowModal]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [formError,  setFormError]  = useState('');
  // Tela única "Lançar" (falta, folga, hora extra, férias, licença), já com a pessoa da linha.
  const [lancar, setLancar] = useState<{ employeeId: number } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [hoveredEmployeeId, setHoveredEmployeeId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setEmployees(await getEmployees());
      setLoadError(false);
    } catch (e) {
      console.error('[Colaboradores]', e);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  // A URL mudou (ex.: veio de outro card): acompanha.
  useEffect(() => { setFilter(filtroUrl); }, [filtroUrl]);

  function escolherFiltro(novo: FiltroEquipe) {
    setFilter(novo);
    router.setParams({ status: novo === 'todos' ? undefined : novo });
  }

  const filtered = useMemo(() => {
    // Sem diferenciar acento nem maiúscula: "juridico" acha "Jurídico" (igual ao seletor do Lançar).
    const q = normalizarTexto(search);
    return employees.filter(e => {
      const matchStatus = combinaComFiltroEquipe(e.status, filter);
      const matchSearch = !q || normalizarTexto(e.name).includes(q) || normalizarTexto(e.role_title ?? '').includes(q);
      return matchStatus && matchSearch;
    });
  }, [employees, filter, search]);

  function setF(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function openModal() {
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  }

  async function handleSave() {
    setFormError('');
    if (!form.name.trim())       { setFormError('Informe o nome completo.'); return; }
    if (!form.role_title.trim()) { setFormError('Informe o cargo.'); return; }
    if (!form.hire_date)         { setFormError('Informe a data de admissão.'); return; }

    const hireDateIso  = brToIso(form.hire_date);
    const birthDateIso = form.birth_date ? brToIso(form.birth_date) : '';
    if (!hireDateIso)                          { setFormError('Data de admissão inválida. Use DD/MM/AAAA.'); return; }
    if (form.birth_date && !birthDateIso)      { setFormError('Data de nascimento inválida. Use DD/MM/AAAA.'); return; }

    setSaving(true);
    try {
      const data: CreateEmployeeData = {
        name:          form.name.trim(),
        role_title:    form.role_title.trim(),
        hire_date:     hireDateIso,
        status:        form.status,
        phone:         form.phone.trim() || undefined,
        email:         form.email.trim() || undefined,
        cpf:           form.cpf.trim() || undefined,
        birth_date:    birthDateIso || undefined,
        legal_area:    form.legal_area,
        oab_number:    form.oab_number.trim() || undefined,
        vacation_days: form.vacation_days,
        folga_hours:   form.folga_hours,
      };
      const created = await createEmployee(data);
      setEmployees(prev => [created, ...prev]);
      setShowModal(false);
      setForm(EMPTY_FORM);
    } catch (e: any) {
      setFormError(e.message || 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContent}>
          <Skeleton height={espaco.tela} />
          <Skeleton height={tamanho.toqueMinimo} />
          <Skeleton height={espaco.tela * 3} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerArea}>
        <ScreenHeader
          title="Equipe"
          subtitle="Gerencie colaboradores, cargos e disponibilidade."
          action={Platform.OS === 'web' && filtered.length > 0 ? (
            <Button accessibilityLabel="Exportar equipe em PDF" icon="download-outline" label="PDF" onPress={() => exportEmployeesPDF(filtered)} variant="ghost" />
          ) : undefined}
        />

        <View style={styles.searchRow}>
          <Ionicons color={cores.texto.discreto} name="search-outline" size={tamanho.iconePequeno} />
          <TextInput
            accessibilityLabel="Buscar colaborador por nome ou cargo"
            autoCorrect={false}
            onChangeText={setSearch}
            placeholder="Buscar por nome ou cargo..."
            placeholderTextColor={cores.texto.discreto}
            style={styles.searchInput}
            value={search}
          />
          {search.length > 0 && (
            <Pressable accessibilityLabel="Limpar busca" accessibilityRole="button" onPress={() => setSearch('')}>
              <Ionicons color={cores.texto.discreto} name="close-circle" size={tamanho.iconePequeno} />
            </Pressable>
          )}
        </View>

        <ScrollView contentContainerStyle={styles.filterContent} horizontal showsHorizontalScrollIndicator={false}>
          {FILTERS.map(f => (
            <Chip active={filter === f.key} key={f.key} label={f.label} onPress={() => escolherFiltro(f.key)} />
          ))}
          {/* Filtros que vêm de outras telas (ex.: "Em licença" do Analytics) só aparecem enquanto estão ativos. */}
          {ROTULO_FILTRO_TEMPORARIO[filter] ? <Chip active key={filter} label={ROTULO_FILTRO_TEMPORARIO[filter] ?? ''} onPress={() => escolherFiltro('todos')} /> : null}
        </ScrollView>

        <Text style={styles.countLabel}>{filtered.length} colaborador{filtered.length !== 1 ? 'es' : ''}</Text>
      </View>

      <ScrollView
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={cores.accent.dourado} />}
        style={styles.list}
      >
        {loadError ? <ErroComRetry mensagem="Não foi possível carregar os colaboradores." onTentarNovamente={onRefresh} carregando={refreshing} /> : null}
        {filtered.length === 0 && !loadError ? (
          <EmptyState
            description={search ? 'Tente outro termo de busca.' : 'Nenhum resultado para este filtro.'}
            icon="people-outline"
            title="Nenhum colaborador"
          />
        ) : (
          filtered.map(emp => (
            // Sem ListRow aqui de propósito: as ações rápidas do trailing são botões
            // próprios, e ListRow com onPress embrulha tudo (incluindo o trailing) num
            // <button>, o que aninhava botão dentro de botão (HTML inválido, quebra o
            // clique e confunde leitor de tela). Só a área de navegação é pressionável.
            <View key={emp.id} style={[styles.row, hoveredEmployeeId === emp.id && styles.rowHover]}>
              <Pressable
                accessibilityLabel={`Abrir perfil de ${emp.name}`}
                accessibilityRole="button"
                onHoverIn={() => setHoveredEmployeeId(emp.id)}
                onHoverOut={() => setHoveredEmployeeId(null)}
                onPress={() => router.push(`/colaborador/${emp.id}` as any)}
                style={styles.rowPress}
              >
                <Avatar name={emp.name} />
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{emp.name}</Text>
                  <Text numberOfLines={2} style={styles.rowDescription}>
                    {emp.oab_number ? `${emp.role_title} · OAB ${emp.oab_number}` : emp.role_title}
                  </Text>
                </View>
              </Pressable>
              <View style={styles.trailing}>
                <StatusPill label={STATUS_LABELS[emp.status]} status={employeeStatusTone(emp.status)} />
                {canManageEmployees && (
                  <Button
                    accessibilityLabel={`Lançar falta, folga, hora extra, férias ou licença para ${emp.name}`}
                    icon="add"
                    label="Lançar"
                    onPress={() => setLancar({ employeeId: emp.id })}
                    variant="secondary"
                  />
                )}
              </View>
            </View>
          ))
        )}
        <View style={{ height: espaco.tela }} />
      </ScrollView>

      {canManageEmployees && (
        <Pressable accessibilityLabel="Adicionar colaborador" accessibilityRole="button" onPress={openModal} style={styles.fab}>
          <Ionicons color={cores.texto.sobreAccent} name="add" size={tamanho.iconeGrande} />
        </Pressable>
      )}

      <Modal
        footer={
          <View style={styles.modalFooter}>
            <Button accessibilityLabel="Cancelar cadastro" label="Cancelar" onPress={() => setShowModal(false)} style={{ flex: 1 }} variant="secondary" />
            <Button accessibilityLabel="Salvar colaborador" label="Salvar" loading={saving} onPress={handleSave} style={{ flex: 2 }} />
          </View>
        }
        onClose={() => setShowModal(false)}
        subtitle="Preencha os dados do colaborador"
        title="Novo colaborador"
        visible={showModal}
      >
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.modalBody}>
          <Input accessibilityLabel="Nome completo" label="Nome *" onChangeText={v => setF('name', v)} placeholder="Nome completo" value={form.name} />
          <Input containerStyle={styles.field} label="Cargo *" onChangeText={v => setF('role_title', v)} placeholder="Ex: Advogado Pleno, Estagiário" value={form.role_title} />
          <DateField containerStyle={styles.field} label="Data de admissão" onChange={(iso) => setF('hire_date', isoParaBr(iso))} required value={brToIso(form.hire_date)} />

          <Text style={styles.label}>Status</Text>
          <View style={styles.chipGroup}>
            {STATUS_OPTIONS.map(o => (
              <Chip active={form.status === o.key} key={o.key} label={o.label} onPress={() => setF('status', o.key)} />
            ))}
          </View>

          <Text style={styles.label}>Área jurídica</Text>
          <View style={styles.chipGroup}>
            {LEGAL_AREAS.map(o => (
              <Chip active={form.legal_area === o.key} key={o.key} label={o.label} onPress={() => setF('legal_area', form.legal_area === o.key ? undefined : o.key)} />
            ))}
          </View>

          <Input containerStyle={styles.field} label="Número OAB" onChangeText={v => setF('oab_number', v)} placeholder="Ex: SP 123456" value={form.oab_number} />
          <Input containerStyle={styles.field} keyboardType="phone-pad" label="Telefone" onChangeText={v => setF('phone', maskPhone(v))} placeholder="(11) 99999-9999" value={form.phone} />
          <Input accessibilityLabel="Email do colaborador" autoCapitalize="none" autoComplete="email" autoCorrect={false} containerStyle={styles.field} keyboardType="email-address" label="Email (para avisos, ex.: reconhecimentos)" onChangeText={v => setF('email', v)} placeholder="nome@empresa.com" value={form.email} />
          <DateField containerStyle={styles.field} label="Data de nascimento" max={getTodayString()} onChange={(iso) => setF('birth_date', isoParaBr(iso))} value={brToIso(form.birth_date)} />
          <Input containerStyle={styles.field} keyboardType="numeric" label="CPF" onChangeText={v => setF('cpf', maskCPF(v))} placeholder="000.000.000-00" value={form.cpf} />

          {formError ? (
            <View style={styles.errorBox}>
              <Ionicons color={cores.status.erro.forte} name="alert-circle-outline" size={tamanho.iconePequeno} />
              <Text style={styles.errorText}>{formError}</Text>
            </View>
          ) : null}
          <View style={{ height: espaco.lg }} />
        </ScrollView>
      </Modal>

      <LancarAusencia
        employeeId={lancar?.employeeId ?? null}
        employees={employees}
        onClose={() => setLancar(null)}
        onLancado={() => { void load(); }}
        visible={lancar !== null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: cores.superficie.pagina, flex: 1 },
  loadingContent: { gap: espaco.lg, padding: espaco.lg },

  headerArea: { backgroundColor: cores.superficie.elevada, borderBottomColor: cores.borda.sutil, borderBottomWidth: borda.fina, gap: espaco.md, padding: espaco.lg },

  searchRow: {
    alignItems: 'center', backgroundColor: cores.superficie.pagina, borderColor: cores.borda.sutil, borderRadius: raio.controle, borderWidth: borda.fina,
    flexDirection: 'row', gap: espaco.sm, paddingHorizontal: espaco.md, minHeight: tamanho.toqueMinimo,
  },
  searchInput: { ...tipografia.corpo, color: cores.texto.primario, flex: 1 },

  filterContent: { gap: espaco.sm, flexDirection: 'row' },
  chip: { backgroundColor: cores.superficie.pagina, borderColor: cores.borda.sutil, borderRadius: raio.pill, borderWidth: borda.fina, paddingHorizontal: espaco.md, paddingVertical: espaco.xs },
  chipActive: { backgroundColor: cores.accent.sutil, borderColor: cores.accent.borda },
  chipText: { ...tipografia.legenda, color: cores.texto.discreto },
  chipTextActive: { color: cores.accent.douradoProfundo },

  countLabel: { ...tipografia.legenda, color: cores.texto.discreto },

  list: { flex: 1 },
  row: { alignItems: 'center', borderBottomColor: cores.borda.sutil, borderBottomWidth: borda.fina, flexDirection: 'row', gap: espaco.md, minHeight: tamanho.toqueMinimo, paddingHorizontal: espaco.lg, paddingVertical: espaco.md },
  rowHover: { backgroundColor: cores.superficie.sutil },
  rowPress: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: espaco.md },
  rowCopy: { flex: 1, gap: espaco.micro },
  rowTitle: { ...tipografia.corpoForte, color: cores.texto.primario },
  rowDescription: { ...tipografia.legenda, color: cores.texto.discreto },
  trailing: { alignItems: 'flex-end', gap: espaco.xs },

  fab: {
    alignItems: 'center', backgroundColor: cores.accent.dourado, borderRadius: raio.pill, bottom: espaco.xl,
    height: tamanho.avatarGrande, justifyContent: 'center', position: 'absolute', right: espaco.lg, width: tamanho.avatarGrande,
  },

  modalBody: { maxHeight: 480 },
  field: { marginTop: espaco.md },
  label: { ...tipografia.rotulo, color: cores.texto.discreto, marginBottom: espaco.xs, marginTop: espaco.md, textTransform: 'uppercase' },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },

  errorBox: { alignItems: 'center', backgroundColor: cores.status.erro.superficie, borderRadius: raio.controle, flexDirection: 'row', gap: espaco.sm, marginTop: espaco.md, padding: espaco.md },
  errorText: { ...tipografia.legenda, color: cores.status.erro.forte, flex: 1 },

  modalFooter: { flexDirection: 'row', gap: espaco.sm },
});
