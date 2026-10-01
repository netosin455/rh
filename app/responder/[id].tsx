// ============================================================
// app/responder/[id].tsx — Página PÚBLICA de resposta
// Sem autenticação — o colaborador acessa pelo link compartilhado, em geral no celular.
// Uma pergunta por tela (componentes/ResponderPesquisa.tsx).
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button } from '../../componentes/Button';
import { EmptyState } from '../../componentes/EmptyState';
import { ResponderPesquisa } from '../../componentes/ResponderPesquisa';
import { Skeleton } from '../../componentes/Skeleton';
import { ApiError } from '../../conexoes/http';
import { getPublicSurvey, respondSurvey } from '../../conexoes/pesquisas';
import { cores } from '../../estilo/cores';
import { espaco } from '../../estilo/espaco';
import { ehFormatoAntigo } from '../../helpers/pesquisa';
import type { PublicSurvey, SurveyAnswerInput, SurveyContactInput } from '../../tipos/modelos';

// Gera UUID v4 simples sem dependência externa
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Identifica o aparelho (não a pessoa): impede resposta dupla sem coletar dado pessoal.
async function getVoterToken(): Promise<string> {
  const key = 'superrh_voter_token';
  let token = await AsyncStorage.getItem(key);
  if (!token) {
    token = uuidv4();
    await AsyncStorage.setItem(key, token);
  }
  return token;
}

function idFromParam(value: string | string[] | undefined): number | null {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export default function ResponderScreen() {
  const { id: rawId } = useLocalSearchParams<{ id?: string }>();
  const id = idFromParam(rawId);
  const { width } = useWindowDimensions();
  const [pesquisa, setPesquisa] = useState<PublicSurvey | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<{ mensagem: string; podeTentar: boolean } | null>(null);

  const carregar = useCallback(async () => {
    if (!id) { setErro({ mensagem: 'Confira se o endereço foi copiado por completo.', podeTentar: false }); setLoading(false); return; }
    setLoading(true);
    setErro(null);
    try {
      const data = await getPublicSurvey(id);
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setErro({ mensagem: 'Esta pesquisa já foi encerrada.', podeTentar: false });
      } else {
        setPesquisa(data);
      }
    } catch (e: unknown) {
      const semConexao = e instanceof ApiError && e.status === 0;
      setErro({ mensagem: semConexao ? e.message : 'Pesquisa não encontrada.', podeTentar: semConexao });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function enviar(respostas: SurveyAnswerInput[], _locais: unknown, contato: SurveyContactInput | null) {
    if (!id || !pesquisa) return;
    const voter_token = await getVoterToken();
    if (ehFormatoAntigo(pesquisa)) {
      // Pesquisa de 1 pergunta no formato antigo: o servidor ainda aceita {score|choice}.
      const r = respostas[0];
      await respondSurvey(id, { voter_token, score: r?.score, choice: r?.choice });
    } else {
      // `contact` só existe quando o cliente marcou o consentimento; senão nenhum dado pessoal sai daqui.
      await respondSurvey(id, { voter_token, answers: respostas, ...(contato ? { contact: contato } : {}) });
    }
  }

  const estreito = width < 540;
  return (
    <ScrollView contentContainerStyle={[styles.conteudo, estreito && styles.conteudoEstreito]} keyboardShouldPersistTaps="handled" style={styles.tela}>
      <View style={styles.coluna}>
        {loading ? (
          <View style={styles.carregando}>
            <Skeleton accessibilityLabel="Carregando pesquisa" style={styles.esqueleto} />
            <Skeleton accessibilityLabel="Carregando pesquisa" style={styles.esqueleto} />
          </View>
        ) : erro ? (
          <EmptyState
            action={erro.podeTentar ? <Button icon="refresh-outline" label="Tentar de novo" onPress={() => { void carregar(); }} /> : undefined}
            description={erro.mensagem}
            icon="close-circle-outline"
            title="Pesquisa indisponível"
          />
        ) : pesquisa ? (
          <ResponderPesquisa onEnviar={enviar} pesquisa={pesquisa} />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tela: { backgroundColor: cores.superficie.elevada, flex: 1 },
  conteudo: { alignItems: 'center', flexGrow: 1, paddingHorizontal: espaco.xl, paddingVertical: espaco.xxxl },
  conteudoEstreito: { paddingHorizontal: espaco.lg, paddingVertical: espaco.xl },
  coluna: { alignSelf: 'center', maxWidth: 560, width: '100%' },
  carregando: { gap: espaco.lg },
  esqueleto: { height: espaco.secao },
});
