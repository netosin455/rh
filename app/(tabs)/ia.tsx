// ============================================================
// app/(tabs)/ia.tsx — SuperRH  Assistente IA (Groq)
// ============================================================

import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Keyboard,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../services/api';
import { ChatMessage } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { theme } from '../../theme';

const SUGGESTIONS = [
  'Quais processos estão urgentes?',
  'Quem tem férias pendentes?',
  'Quais eventos tenho hoje?',
  'Mostre os colaboradores ativos',
];

let msgId = 0;
function nextId() { return String(++msgId); }

export default function IAScreen() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: nextId(),
      role: 'assistant',
      content: `Olá, ${user?.name?.split(' ')[0] || 'advogado'}! Sou o assistente do SuperRH. Posso ajudar com informações sobre colaboradores, processos, agenda e muito mais. Como posso ajudar?`,
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

  const renderItem = ({ item, index }: { item: ChatMessage; index: number }) => {
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

      {/* Sugestões — só quando há apenas 1 mensagem (a intro) */}
      {messages.length === 1 && !loading && (
        <View style={styles.suggestions}>
          <Text style={styles.suggestionsLabel}>Sugestões</Text>
          <View style={styles.suggestionsGrid}>
            {SUGGESTIONS.map(s => (
              <TouchableOpacity key={s} style={styles.suggestionChip} onPress={() => send(s)}>
                <Text style={styles.suggestionText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Pergunte algo..."
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

  listContent: { padding: 16, paddingBottom: 8 },

  msgWrapper:          { flexDirection: 'row', marginBottom: 12, gap: 8 },
  msgWrapperUser:      { justifyContent: 'flex-end' },
  msgWrapperAssistant: { justifyContent: 'flex-start' },

  avatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: theme.goldDim, borderWidth: 1, borderColor: theme.border2,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-end',
  },

  bubble: {
    maxWidth: '80%', borderRadius: 14, padding: 12,
  },
  bubbleAssistant: {
    backgroundColor: theme.surface,
    borderWidth: 1, borderColor: theme.border,
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: theme.gold,
    borderBottomRightRadius: 4,
  },
  bubbleText:     { fontSize: 14, color: theme.text, lineHeight: 20 },
  bubbleTextUser: { color: '#000' },
  timestamp:      { fontSize: 10, color: theme.textMuted, marginTop: 4, textAlign: 'right' },
  timestampUser:  { color: 'rgba(0,0,0,0.5)' },

  typingRow: { flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'flex-end' },
  typingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    borderRadius: 14, borderBottomLeftRadius: 4, padding: 12,
  },
  typingText: { fontSize: 12, color: theme.textMuted },

  suggestions:      { paddingHorizontal: 16, paddingBottom: 8 },
  suggestionsLabel: { fontSize: 10, color: theme.textMuted, marginBottom: 8, letterSpacing: 1 },
  suggestionsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border2,
    borderRadius: 16,
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
    borderRadius: 20, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 14, color: theme.text,
    maxHeight: 100,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: theme.surface2 },
});
