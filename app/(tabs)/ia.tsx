// ============================================================
// app/(tabs)/ia.tsx — SuperRH Assistente IA (Groq)
// ============================================================

import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Keyboard,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../conexoes/http';
import { ChatMessage } from '../../tipos/modelos';
import { useAuth } from '../../contextos/Autenticacao';
import { theme } from '../../estilo/cores';

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
      <Animated.View
        entering={FadeInUp.delay(50).duration(250)}
        style={[styles.msgWrapper, isUser ? styles.msgWrapperUser : styles.msgWrapperAssistant]}
      >
        {!isUser && (
          <View style={styles.avatar}>
            <Ionicons name="sparkles" size={12} color={theme.gold} />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{item.content}</Text>
          <Text style={[styles.timestamp, isUser && styles.timestampUser]}>
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </Animated.View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {/* Header modelo */}
      <View style={styles.modelHeader}>
        <View style={styles.modelDot} />
        <Text style={styles.modelName}>Groq · Llama 3</Text>
        <View style={styles.modelStatus}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Online</Text>
        </View>
      </View>

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
          <View style={styles.typingRow}>
            <View style={styles.avatar}>
              <Ionicons name="sparkles" size={12} color={theme.gold} />
            </View>
            <View style={styles.typingBubble}>
              <ActivityIndicator size="small" color={theme.gold} />
              <Text style={styles.typingText}>Pensando...</Text>
            </View>
          </View>
        ) : null}
      />

      {/* Sugestões — só quando há apenas 1 mensagem */}
      {messages.length === 1 && !loading && (
        <View style={styles.suggestions}>
          <Text style={styles.suggestionsLabel}>SUGESTÕES</Text>
          <View style={styles.suggestionsGrid}>
            {SUGGESTIONS.map(s => (
              <TouchableOpacity key={s.text} style={styles.suggestionChip} onPress={() => send(s.text)}>
                <Ionicons name="sparkles-outline" size={11} color={theme.gold} />
                <Text style={styles.suggestionText}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Pergunte algo sobre a equipe..."
          placeholderTextColor={theme.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
          blurOnSubmit
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => send(input)}
          disabled={!input.trim() || loading}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-up" size={16} color={!input.trim() || loading ? theme.textMuted : '#000'} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },

  modelHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: theme.surface,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  modelDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.gold },
  modelName: { fontSize: 12, color: theme.textLight, fontWeight: '600', flex: 1 },
  modelStatus: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.success },
  statusText: { fontSize: 11, color: theme.success },

  listContent: { padding: 16, paddingBottom: 8 },

  msgWrapper:          { flexDirection: 'row', marginBottom: 14, gap: 8 },
  msgWrapperUser:      { justifyContent: 'flex-end' },
  msgWrapperAssistant: { justifyContent: 'flex-start' },

  avatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: theme.goldDim, borderWidth: 1, borderColor: theme.border2,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-end',
  },

  bubble: { maxWidth: '80%', borderRadius: 16, padding: 12 },
  bubbleAssistant: {
    backgroundColor: theme.surface,
    borderWidth: 1, borderColor: theme.border,
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: theme.gold,
    borderBottomRightRadius: 4,
  },
  bubbleText:     { fontSize: 14, color: theme.text, lineHeight: 21 },
  bubbleTextUser: { color: '#000' },
  timestamp:      { fontSize: 10, color: theme.textMuted, marginTop: 5, textAlign: 'right' },
  timestampUser:  { color: 'rgba(0,0,0,0.5)' },

  typingRow: { flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'flex-end' },
  typingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    borderRadius: 16, borderBottomLeftRadius: 4, padding: 12,
  },
  typingText: { fontSize: 12, color: theme.textMuted },

  suggestions:      { paddingHorizontal: 14, paddingBottom: 8 },
  suggestionsLabel: { fontSize: 9, color: theme.textMuted, marginBottom: 8, letterSpacing: 1.5, fontWeight: '700' },
  suggestionsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border2,
    borderRadius: 20,
  },
  suggestionText: { fontSize: 12, color: theme.goldLight },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    padding: 12, paddingBottom: Platform.OS === 'ios' ? 20 : 12,
    backgroundColor: theme.surface,
    borderTopWidth: 1, borderTopColor: theme.border,
  },
  input: {
    flex: 1, backgroundColor: theme.surface2,
    borderWidth: 1, borderColor: theme.border,
    borderRadius: 22, paddingHorizontal: 16,
    paddingVertical: 10, fontSize: 14, color: theme.text,
    maxHeight: 100,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: theme.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: theme.surface2 },
});
