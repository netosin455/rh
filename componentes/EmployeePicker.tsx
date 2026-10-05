// ============================================================
// componentes/EmployeePicker.tsx — SuperRH
// Escolha de colaborador com busca por nome/cargo e lista curta. Reutilizável: quem usa
// continua dono dos dados (recebe a lista e devolve o colaborador escolhido).
// - Com `selectedId` e `onClear`: mostra a pessoa escolhida e o botão "Trocar".
// - Sem selecionado: campo de busca + lista curta de resultados.
// ============================================================

import { StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { cores } from '../estilo/cores';
import { espaco, raio } from '../estilo/espaco';
import { tipografia } from '../estilo/tipografia';
import { filtrarColaboradores } from '../helpers/buscaColaborador';
import type { Employee } from '../tipos/modelos';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Card } from './Card';
import { Input } from './Input';
import { ListRow } from './ListRow';

type EmployeePickerProps = {
  employees: readonly Employee[];
  selectedId?: number | null;
  onSelect: (employee: Employee) => void;
  /** Se informado, a pessoa escolhida aparece com o botão "Trocar" (que chama isto). */
  onClear?: () => void;
  label?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  /** Máximo de resultados (padrão 6). */
  maxResultados?: number;
  /** Lista os primeiros sem digitar nada (padrão: só depois de digitar). */
  listarSemBusca?: boolean;
};

export function EmployeePicker({
  employees, selectedId = null, onSelect, onClear, label = 'Buscar colaborador', required, error, disabled, autoFocus, placeholder = 'Digite o nome ou o cargo', maxResultados, listarSemBusca,
}: EmployeePickerProps) {
  const [busca, setBusca] = useState('');
  const escolhido = selectedId != null ? employees.find((e) => e.id === selectedId) ?? null : null;
  const resultados = filtrarColaboradores(employees, busca, { max: maxResultados, listarSemBusca });

  if (escolhido && onClear) {
    return (
      <View style={styles.pessoa}>
        <Avatar name={escolhido.name} size="small" />
        <View style={styles.pessoaTexto}>
          <Text style={styles.pessoaNome}>{escolhido.name}</Text>
          <Text style={styles.pessoaCargo}>{escolhido.role_title}</Text>
        </View>
        <Button accessibilityLabel="Trocar colaborador" disabled={disabled} label="Trocar" onPress={() => { setBusca(''); onClear(); }} variant="ghost" />
      </View>
    );
  }

  return (
    <View style={styles.raiz}>
      <Input autoFocus={autoFocus} editable={!disabled} error={error} label={label} onChangeText={setBusca} placeholder={placeholder} required={required} value={busca} />
      {busca.trim() !== '' || listarSemBusca ? (
        resultados.length > 0 ? (
          <Card padded={false}>
            {resultados.map((e) => (
              <ListRow accessibilityLabel={`Escolher ${e.name}`} description={e.role_title} key={e.id} leading={<Avatar name={e.name} size="small" />} onPress={() => { setBusca(''); onSelect(e); }} title={e.name} />
            ))}
          </Card>
        ) : <Text style={styles.vazio}>Ninguém encontrado com esse nome ou cargo.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { gap: espaco.sm },
  pessoa: { alignItems: 'center', backgroundColor: cores.superficie.sutil, borderRadius: raio.controle, flexDirection: 'row', gap: espaco.md, padding: espaco.sm },
  pessoaTexto: { flex: 1 },
  pessoaNome: { ...tipografia.corpoForte, color: cores.texto.primario },
  pessoaCargo: { ...tipografia.legenda, color: cores.texto.discreto },
  vazio: { ...tipografia.legenda, color: cores.texto.discreto },
});
