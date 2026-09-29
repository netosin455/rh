import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getEmployees } from '../conexoes/colaboradores';
import type { CreateFeedbackData, Employee } from '../tipos/modelos';
import { cores } from '../estilo/cores';
import { borda, espaco, raio, tamanho } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';
import { Input } from './Input';
import { Skeleton } from './Skeleton';

type FeedbackFormProps = {
  value: CreateFeedbackData;
  onChange: (value: CreateFeedbackData) => void;
  disabled?: boolean;
};

function employeeDescription(employee: Employee): string {
  return [employee.role_title, employee.department_name].filter(Boolean).join(' · ');
}

/** Formulário reutilizado para criar e editar o rascunho, para os campos não divergirem. */
export function FeedbackForm({ value, onChange, disabled = false }: FeedbackFormProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState('');
  const selected = employees.find((employee) => employee.id === value.employee_id);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return query ? employees.filter((employee) => employee.name.toLocaleLowerCase('pt-BR').includes(query)) : employees;
  }, [employees, search]);

  useEffect(() => {
    getEmployees().then(setEmployees).catch(() => setError('Não foi possível carregar os colaboradores.')).finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.form}>
      <View>
        <Text style={styles.label}>Colaborador</Text>
        {selected ? <Text style={styles.selected}>Para {selected.name} · {employeeDescription(selected) || 'Colaborador'}</Text> : <Text style={styles.hint}>Escolha a pessoa que receberá este feedback.</Text>}
        <Input
          editable={!disabled && !loading}
          label="Buscar colaborador"
          onChangeText={(query) => { setSearch(query); setPickerOpen(true); }}
          onFocus={() => setPickerOpen(true)}
          placeholder={selected ? selected.name : 'Buscar por nome'}
          value={search}
        />
        {loading ? <Skeleton accessibilityLabel="Carregando colaboradores" style={styles.skeleton} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && !error && pickerOpen ? (
          <ScrollView contentContainerStyle={styles.employeeList} nestedScrollEnabled style={styles.employeeScroll}>
            {filtered.map((employee) => {
              const active = employee.id === value.employee_id;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active, disabled }}
                  disabled={disabled}
                  key={employee.id}
                  onPress={() => { onChange({ ...value, employee_id: employee.id }); setSearch(''); setPickerOpen(false); }}
                  style={[styles.employee, active && styles.employeeSelected]}
                >
                  <View style={styles.employeeCopy}>
                    <Text style={styles.employeeName}>{employee.name}</Text>
                    <Text style={styles.employeeMeta}>{employeeDescription(employee) || 'Colaborador'}</Text>
                  </View>
                  <View style={[styles.radio, active && styles.radioSelected]}>{active ? <View style={styles.radioDot} /> : null}</View>
                </Pressable>
              );
            })}
            {!filtered.length ? <Text style={styles.hint}>Nenhum colaborador encontrado.</Text> : null}
          </ScrollView>
        ) : null}
      </View>
      <Input
        editable={!disabled}
        label="Título"
        maxLength={140}
        onChangeText={(title) => onChange({ ...value, title })}
        placeholder="Ex.: Feedback sobre seu desenvolvimento"
        value={value.title}
      />
      <Input
        editable={!disabled}
        inputStyle={styles.contentInput}
        label="Texto do feedback"
        maxLength={10000}
        multiline
        onChangeText={(content) => onChange({ ...value, content })}
        placeholder="Escreva o feedback de forma clara e respeitosa."
        textAlignVertical="top"
        value={value.content}
      />
      <Text style={styles.count}>{value.content.length.toLocaleString('pt-BR')} / 10.000 caracteres</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: espaco.lg },
  label: { ...tipografia.rotulo, color: cores.texto.discreto, marginBottom: espaco.xs, textTransform: 'uppercase' },
  hint: { ...tipografia.legenda, color: cores.texto.discreto, marginBottom: espaco.sm },
  selected: { ...tipografia.corpoForte, color: cores.texto.primario, marginBottom: espaco.sm },
  error: { ...tipografia.legenda, color: cores.status.erro.forte, marginTop: espaco.sm },
  skeleton: { height: tamanho.toqueMinimo * 2, marginTop: espaco.sm },
  employeeScroll: { borderColor: cores.borda.sutil, borderRadius: raio.controle, borderWidth: borda.fina, marginTop: espaco.sm, maxHeight: tamanho.toqueMinimo * 4 },
  employeeList: { paddingVertical: espaco.xs },
  employee: { alignItems: 'center', flexDirection: 'row', gap: espaco.md, minHeight: tamanho.toqueMinimo, paddingHorizontal: espaco.md },
  employeeSelected: { backgroundColor: cores.status.informacao.superficie },
  employeeCopy: { flex: 1 },
  employeeName: { ...tipografia.corpoForte, color: cores.texto.primario },
  employeeMeta: { ...tipografia.legenda, color: cores.texto.discreto, marginTop: espaco.micro },
  radio: { alignItems: 'center', borderColor: cores.borda.forte, borderRadius: raio.pill, borderWidth: borda.fina, height: espaco.md, justifyContent: 'center', width: espaco.md },
  radioSelected: { borderColor: cores.accent.dourado },
  radioDot: { backgroundColor: cores.accent.dourado, borderRadius: raio.pill, height: espaco.sm, width: espaco.sm },
  contentInput: { minHeight: tamanho.toqueMinimo * 5 },
  count: { ...tipografia.legenda, color: cores.texto.discreto, marginTop: -espaco.md, textAlign: 'right' },
});
