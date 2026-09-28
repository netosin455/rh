// ============================================================
// app/(tabs)/ia.tsx — SuperRH Assistente IA (Groq)
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList,
  StyleSheet, KeyboardAvoidingView,
  Platform, Keyboard,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { apiFetch } from '../../conexoes/http';
import { ChatMessage } from '../../tipos/modelos';
import { useAuth } from '../../contextos/Autenticacao';
import { Avatar } from '../../componentes/Avatar';
import { Button } from '../../componentes/Button';
import { Card } from '../../componentes/Card';
import { Input } from '../../componentes/Input';
import { ScreenHeader } from '../../componentes/ScreenHeader';
import { Skeleton } from '../../componentes/Skeleton';
import { cores } from '../../estilo/cores';
import { borda, espaco, raio, tamanho } from '../../estilo/espaco';
import { tipografia } from '../../estilo/tipografia';
import { useMotion } from '../../estilo/movimento';

const SUGGESTIONS = [
  { label: 'Risco de saída',   text: 'Quais colaboradores têm maior risco de saída da empresa?' },
  { label: 'Onboarding',       text: 'Como está o andamento dos onboardings em curso?' },
  { label: 'Pesquisas',        text: 'Quais são os resultados das pesquisas de pulso ativas?' },
  { label: 'Aniversários',     text: 'Quem faz aniversário essa semana?' },
];

let msgId = 0;
function nextId() { return String(++msgId); }

export default function IAScreen() {
  const { user } = useAuth();
  const motion = useMotion();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: nextId(),
      role: 'assistant',
      content: `Olá, ${user?.name?.split(' ')[0] || 'usuário'}! Sou o assistente do SuperRH. Posso ajudar com informações sobre colaboradores, férias, agenda e muito mais. Como posso ajudar?`,
      timestamp: new Date(),
    },
  ]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);
  const thinkingOpacity = useSharedValue(0);

  useEffect(() => {
    thinkingOpacity.value = withTiming(loading ? 1 : 0, {
      duration: motion.duracao(loading ? 'normal' : 'fast'),
      easing: loading ? motion.entrada : motion.saida,
    });
  }, [loading, motion, thinkingOpacity]);

  const thinkingStyle = useAnimatedStyle(() => ({ opacity: thinkingOpacity.value }));

  const send = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;

    const userMsg: ChatMessage = { id: nextId(), role: 'user', content, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    Keyboard.dismiss();

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const { message } = await apiFetch<{ message: string }>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: history }),
      });
      const assistantMsg: ChatMessage = {
        id: nextId(), role: 'assistant', content: message, timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e: any) {
      const errMsg: ChatMessage = {
        id: nextId(),
        role: 'assistant',
        content: e.message || 'Erro ao processar sua mensagem. Tente novamente.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  function formatTime(date: Date) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAssistant]}>
        {!isUser ? <Avatar name="Assistente SuperRH" size="small" accessibilityLabel="Assistente SuperRH" /> : null}
        {isUser ? (
          <View style={styles.userBubble}>
            <Text style={styles.userText}>{item.content}</Text>
            <Text style={styles.userTimestamp}>{formatTime(item.timestamp)}</Text>
          </View>
        ) : (
          <Card style={styles.assistantBubble}>
            <Text style={styles.bubbleText}>{item.content}</Text>
            <Text style={styles.timestamp}>{formatTime(item.timestamp)}</Text>
          </Card>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <View style={styles.header}><ScreenHeader title="Assistente" subtitle="Pergunte sobre pessoas, férias, agenda e rotinas de RH." /></View>

      {/* Lista de mensagens */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
        ListFooterComponent={loading ? (
          <Animated.View style={[styles.thinkingRow, thinkingStyle]}>
            <Avatar name="Assistente SuperRH" size="small" accessibilityLabel="Assistente SuperRH processando" />
            <Card style={styles.thinkingBubble}><Skeleton width={tamanho.iconeGrande} height={tamanho.indicador} /><Text style={styles.thinkingText}>Processando sua solicitação…</Text></Card>
          </Animated.View>
        ) : null}
      />

      {/* Sugestões — só quando há apenas 1 mensagem */}
      {messages.length === 1 && !loading && (
        <View style={styles.suggestions}>
          <Text style={styles.suggestionsLabel}>Sugestões</Text>
          <View style={styles.suggestionsGrid}>
            {SUGGESTIONS.map((suggestion) => <Button key={suggestion.text} label={suggestion.label} icon="sparkles-outline" variant="secondary" accessibilityLabel={`Perguntar: ${suggestion.label}`} onPress={() => send(suggestion.text)} />)}
          </View>
        </View>
      )}

      <View style={styles.inputRow}>
        <Input
          label="Mensagem"
          placeholder="Pergunte algo sobre a equipe..."
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
          blurOnSubmit
          containerStyle={styles.messageInput}
          inputStyle={styles.input}
          rightAccessory={<Button icon="arrow-up" accessibilityLabel="Enviar mensagem" onPress={() => send(input)} disabled={!input.trim() || loading} variant="primary" style={styles.sendButton} />}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: cores.superficie.pagina, flex: 1 },
  header: { borderBottomColor: cores.borda.sutil, borderBottomWidth: borda.fina, padding: espaco.xl },
  listContent: { gap: espaco.md, padding: espaco.xl, paddingBottom: espaco.md },
  messageRow: { alignItems: 'flex-end', flexDirection: 'row', gap: espaco.sm },
  messageRowUser: { justifyContent: 'flex-end' },
  messageRowAssistant: { justifyContent: 'flex-start' },
  assistantBubble: { maxWidth: '80%' },
  userBubble: { backgroundColor: cores.accent.dourado, borderBottomRightRadius: espaco.xs, borderRadius: raio.cartao, maxWidth: '80%', padding: espaco.md },
  bubbleText: { ...tipografia.corpo, color: cores.texto.primario },
  userText: { ...tipografia.corpo, color: cores.texto.sobreAccent },
  timestamp: { ...tipografia.legenda, color: cores.texto.discreto, marginTop: espaco.xs, textAlign: 'right' },
  userTimestamp: { ...tipografia.legenda, color: cores.texto.sobreAccent, marginTop: espaco.xs, textAlign: 'right' },
  thinkingRow: { alignItems: 'flex-end', flexDirection: 'row', gap: espaco.sm },
  thinkingBubble: { alignItems: 'center', flexDirection: 'row', gap: espaco.sm },
  thinkingText: { ...tipografia.legenda, color: cores.texto.discreto },
  suggestions: { borderTopColor: cores.borda.sutil, borderTopWidth: borda.fina, gap: espaco.sm, paddingHorizontal: espaco.xl, paddingTop: espaco.md },
  suggestionsLabel: { ...tipografia.legenda, color: cores.texto.discreto },
  suggestionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  inputRow: { backgroundColor: cores.superficie.elevada, borderTopColor: cores.borda.sutil, borderTopWidth: borda.fina, padding: espaco.md, paddingBottom: Platform.OS === 'ios' ? espaco.xl : espaco.md },
  messageInput: { width: '100%' },
  input: { maxHeight: tamanho.toqueMinimo * 2 },
  sendButton: { marginRight: espaco.xs, minWidth: tamanho.toqueMinimo, paddingHorizontal: espaco.sm },
});
