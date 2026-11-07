import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Banner, Button, Icon, AppText, EmptyState, useBusy, useDialog } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { fmtDateTime } from '../../lib/format';
import { useMine } from '../../lib/member';
import { colors, radius, MAX_CONTENT_WIDTH } from '../../lib/theme';
import { useBreakpoint } from '../../lib/useBreakpoint';
import type { AiMessage } from '../../lib/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SUGGESTIONS = [
  'Create a 4-day workout plan for me',
  'What should I eat before and after training?',
  'Analyze my progress this month',
  'Suggest an alternative to push-ups',
  'How much rest do I need between workouts?',
  'Give me a simple 1-day meal plan',
];

export default function AiCoach() {
  const { profile } = useAuth();
  const { toast, confirm } = useDialog();
  const { run } = useBusy();
  const { isDesktop } = useBreakpoint();
  const insets = useSafeAreaInsets();
  const history = useMine<AiMessage>('aiChat', { order: ['at', 'asc'], limit: 100 });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const scroller = useRef<any>(null);

  const messages = history.data;
  useEffect(() => {
    const t = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages.length, pending, sending]);

  // Once the server-written copy of our message arrives, drop the optimistic bubble.
  useEffect(() => {
    if (pending && messages.some((m) => m.role === 'user' && m.text === pending)) setPending(null);
  }, [messages, pending]);

  const send = async (q?: string) => {
    const msg = (q ?? text).trim();
    if (!msg || sending) return;
    if (msg.length > 1500) return toast('Please keep your question under 1500 characters.', 'warn');
    setText('');
    setPending(msg);
    setSending(true);
    try {
      await api('/ai/chat', { body: { message: msg } });
    } catch (e: any) {
      toast(e?.message || 'The AI coach is unavailable right now.', 'bad');
      setPending(null);
      setText(msg);
    } finally {
      setSending(false);
    }
  };

  const clear = async () => {
    if (await confirm({ title: 'Clear conversation?', message: 'Your chat history will be deleted.', confirmText: 'Clear', destructive: true })) {
      await run(() => api('/ai/history', { method: 'DELETE' }), { success: 'Conversation cleared' });
    }
  };

  const empty = messages.length === 0 && !pending;
  const shown = useMemo(() => messages, [messages]);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: Math.max(insets.top, 12) + 4, paddingBottom: 10, gap: 10 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="robot-outline" size={24} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="h2">AI Fitness Coach</AppText>
            <AppText variant="caption" muted>Personalised using your level{profile?.goal ? ', goal' : ''} and logged progress</AppText>
          </View>
          {messages.length > 0 ? <Button title="Clear" icon="delete-outline" variant="ghost" size="sm" onPress={clear} /> : null}
        </View>

        <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {empty ? (
            <View>
              <EmptyState icon="chat-processing-outline" title="Ask me anything about fitness" text="I can suggest workouts, plan your week, explain exercises, and look at your progress." />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 }}>
                {SUGGESTIONS.map((s) => (
                  <Pressable key={s} onPress={() => send(s)} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
                    <Text style={{ color: colors.text, fontSize: 13.5 }}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {shown.map((m) => (
            <Bubble key={m.id} role={m.role} text={m.text} meta={`${fmtDateTime(m.at)}${m.provider && m.role === 'assistant' ? ` · ${m.provider}` : ''}`} />
          ))}
          {pending && !shown.some((m) => m.role === 'user' && m.text === pending) ? <Bubble role="user" text={pending} meta="Sending…" /> : null}
          {sending ? (
            <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, borderWidth: 1, borderColor: colors.border }}>
              <ActivityIndicator color={colors.primary} size="small" />
              <AppText muted>Coach is thinking…</AppText>
            </View>
          ) : null}
          {!empty ? (
            <AppText variant="caption" muted center style={{ marginTop: 8 }}>
              AI suggestions are general wellness information, not medical advice or a diagnosis. Check with a healthcare professional before changing your training or diet.
            </AppText>
          ) : null}
        </ScrollView>

        {!empty && !sending ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8 }}>
            {SUGGESTIONS.slice(0, 4).map((s) => (
              <Pressable key={s} onPress={() => send(s)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.textMuted, fontSize: 12.5 }}>{s}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, paddingBottom: isDesktop ? 16 : 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Ask your coach…"
            placeholderTextColor={colors.textDim}
            multiline
            maxLength={1500}
            onSubmitEditing={() => send()}
            blurOnSubmit
            style={[{ flex: 1, minHeight: 44, maxHeight: 120, color: colors.text, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15.5 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]}
            onKeyPress={(e: any) => {
              if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                e.preventDefault?.();
                send();
              }
            }}
          />
          <Pressable
            accessibilityLabel="Send message"
            onPress={() => send()}
            disabled={sending || !text.trim()}
            style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: sending || !text.trim() ? 0.45 : 1 }}
          >
            <Icon name="send" size={20} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ role, text, meta }: { role: 'user' | 'assistant'; text: string; meta?: string }) {
  const mine = role === 'user';
  return (
    <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
      <View style={{ backgroundColor: mine ? colors.primary : colors.surface, borderWidth: mine ? 0 : 1, borderColor: colors.border, borderRadius: radius.lg, borderBottomRightRadius: mine ? 4 : radius.lg, borderBottomLeftRadius: mine ? radius.lg : 4, padding: 12 }}>
        <RichText text={text} />
      </View>
      {meta ? <AppText variant="caption" muted style={{ marginTop: 3, alignSelf: mine ? 'flex-end' : 'flex-start' }}>{meta}</AppText> : null}
    </View>
  );
}

/** Minimal markdown: **bold**, "- " bullets, numbered lines, and "## " headings. */
function RichText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <View style={{ gap: 4 }}>
      {lines.map((raw, i) => {
        if (!raw.trim()) return <View key={i} style={{ height: 4 }} />;
        const heading = /^#{1,3}\s+(.*)/.exec(raw);
        const bullet = /^\s*[-*•]\s+(.*)/.exec(raw);
        const content = heading ? heading[1] : bullet ? bullet[1] : raw;
        const parts = content.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
        return (
          <View key={i} style={{ flexDirection: 'row', gap: 6 }}>
            {bullet ? <Text style={{ color: colors.text }}>•</Text> : null}
            <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22, flex: 1, fontWeight: heading ? '800' : '400' }}>
              {parts.map((p, k) => (p.startsWith('**') && p.endsWith('**') ? <Text key={k} style={{ fontWeight: '800' }}>{p.slice(2, -2)}</Text> : <Text key={k}>{p}</Text>))}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

void Banner;
