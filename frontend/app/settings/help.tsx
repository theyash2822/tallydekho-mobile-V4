import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, Linking, type TextInput as TextInputType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { askHelpAI } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { useTranslation } from 'react-i18next';
import i18n from '../../src/i18n';

// ─── Constants ────────────────────────────────────────────────────────────────
const CHAT_TTL_MS    = 24 * 60 * 60 * 1000; // 24 hours
const MAX_HISTORY    = 8;                      // messages to send to LLM
const AMBER          = '#F5A623';

// ─── Safe URL opener ─────────────────────────────────────────────────────────
const openLink = async (url: string, fallbackMsg?: string) => {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Toast.show({
        type: 'info',
        text1: fallbackMsg || i18n.t('screens.settingsHelp.cannotOpen'),
        text2: i18n.t('screens.settingsHelp.tryManually', { url: url.replace(/^mailto:|^https?:\/\//, '') }),
        visibilityTime: 4000,
      });
    }
  } catch {
    Toast.show({
      type: 'info',
      text1: fallbackMsg || i18n.t('screens.settingsHelp.cannotOpen'),
      text2: url.replace(/^mailto:/, '').replace(/^https:\/\/wa\.me\//, '+'),
      visibilityTime: 4000,
    });
  }
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Role = 'user' | 'bot';
interface Message { id: string; role: Role; text: string; time: string; }

// ─── FAQs ─────────────────────────────────────────────────────────────────────
const FAQS = [
  { qKey: 'screens.settingsHelp.faq1Q', aKey: 'screens.settingsHelp.faq1A' },
  { qKey: 'screens.settingsHelp.faq2Q', aKey: 'screens.settingsHelp.faq2A' },
  { qKey: 'screens.settingsHelp.faq3Q', aKey: 'screens.settingsHelp.faq3A' },
  { qKey: 'screens.settingsHelp.faq4Q', aKey: 'screens.settingsHelp.faq4A' },
  { qKey: 'screens.settingsHelp.faq5Q', aKey: 'screens.settingsHelp.faq5A' },
  { qKey: 'screens.settingsHelp.faq6Q', aKey: 'screens.settingsHelp.faq6A' },
  { qKey: 'screens.settingsHelp.faq7Q', aKey: 'screens.settingsHelp.faq7A' },
  { qKey: 'screens.settingsHelp.faq8Q', aKey: 'screens.settingsHelp.faq8A' },
  { qKey: 'screens.settingsHelp.faq9Q', aKey: 'screens.settingsHelp.faq9A' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const timestamp = () => {
  const d = new Date();
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
};

const WELCOME_MSG: Message = {
  id: 'welcome',
  role: 'bot',
  text: "Hi! I'm the TallyDekho Support Assistant.\nAsk me anything — pairing with Tally, creating vouchers, payment reminders, GST, reports, and more.",
  time: timestamp(),
};

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  const { t } = useTranslation();
  const isUser = msg.role === 'user';
  return (
    <View style={[mb.wrap, isUser ? mb.wrapUser : mb.wrapBot]}>
      {!isUser && (
        <View style={mb.botAvatar}>
          <Ionicons name="sparkles" size={13} color={COLORS.white} />
        </View>
      )}
      <View style={[mb.bubble, isUser ? mb.bubbleUser : mb.bubbleBot]}>
        <Text style={[mb.text, isUser ? mb.textUser : mb.textBot]}>{msg.id === 'welcome' ? t('screens.settingsHelp.welcome') : msg.text}</Text>
        <Text style={[mb.time, isUser ? mb.timeUser : mb.timeBot]}>{msg.time}</Text>
      </View>
    </View>
  );
}
const mb = StyleSheet.create({
  wrap:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 10 },
  wrapUser:   { justifyContent: 'flex-end' },
  wrapBot:    { justifyContent: 'flex-start' },
  botAvatar:  {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4, flexShrink: 0,
  },
  bubble:     { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: COLORS.brandPrimary, borderBottomRightRadius: 4 },
  bubbleBot:  {
    backgroundColor: COLORS.cardBg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    borderBottomLeftRadius: 4,
  },
  text:     { fontSize: TYPOGRAPHY.sm, lineHeight: 20 },
  textUser: { color: COLORS.white },
  textBot:  { color: COLORS.textPrimary },
  time:     { fontSize: 10, marginTop: 3 },
  timeUser: { color: 'rgba(255,255,255,0.6)', textAlign: 'right' },
  timeBot:  { color: COLORS.textTertiary },
});

// ─── Typing Indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <View style={[mb.wrap, mb.wrapBot]}>
      <View style={mb.botAvatar}>
        <Ionicons name="sparkles" size={13} color={COLORS.white} />
      </View>
      <View style={[mb.bubble, mb.bubbleBot, { paddingVertical: 12 }]}>
        <Text style={{ fontSize: 18, color: COLORS.textTertiary, letterSpacing: 4 }}>· · ·</Text>
      </View>
    </View>
  );
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────
function FaqItem({ q, a, isLast, onPress }: { q: string; a: string; isLast: boolean; onPress: (q: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <View style={[fq.item, !isLast && fq.border]}>
      <TouchableOpacity style={fq.row} onPress={() => setOpen(v => !v)} activeOpacity={0.7}>
        <Text style={fq.question}>{q}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textTertiary} />
      </TouchableOpacity>
      {open && (
        <View style={fq.answerWrap}>
          <Text style={fq.answer}>{a}</Text>
          <TouchableOpacity style={fq.askBtn} onPress={() => onPress(q)} activeOpacity={0.75}>
            <Ionicons name="chatbubble-outline" size={13} color={COLORS.brandPrimary} />
            <Text style={fq.askBtnTxt}>{t('screens.settingsHelp.askFollowUp')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
const fq = StyleSheet.create({
  item:       { paddingVertical: 2 },
  border:     { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  row:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, gap: 12 },
  question:   { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  answerWrap: { paddingBottom: 14, paddingRight: 8 },
  answer:     { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 10 },
  askBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  askBtnTxt:  { fontSize: TYPOGRAPHY.xs, color: COLORS.brandPrimary, fontWeight: '600' },
});

// ─── Section Divider ──────────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <View style={sd.row}>
      <View style={sd.line} />
      <Text style={sd.txt}>{label}</Text>
      <View style={sd.line} />
    </View>
  );
}
const sd = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 },
  line: { flex: 1, height: 1, backgroundColor: COLORS.borderDefault },
  txt:  { fontSize: 10, color: COLORS.textTertiary, fontWeight: '600', letterSpacing: 0.5 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HelpCenterScreen() {
  const router    = useRouter();
  const { t }     = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const inputRef   = useRef<TextInputType>(null);
  const { user }  = useAuth();

  const chatKey = `td_help_chat_${user?.phone || 'guest'}`;

  const [messages,     setMessages]     = useState<Message[]>([WELCOME_MSG]);
  const [input,        setInput]        = useState('');
  const [sending,      setSending]      = useState(false);
  const [chatRestored, setChatRestored] = useState(false);
  const [showFAQ,      setShowFAQ]      = useState(true);

  // ── Load persisted chat on mount (24-hour TTL) ────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(chatKey).then(raw => {
      if (!raw) return;
      try {
        const { messages: saved, savedAt }: { messages: Message[]; savedAt: number } = JSON.parse(raw);
        const age = Date.now() - savedAt;
        if (age < CHAT_TTL_MS && saved.length > 1) {
          setMessages(saved);
          setChatRestored(true);
          setShowFAQ(false);
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 200);
        } else {
          // expired — clear it
          AsyncStorage.removeItem(chatKey);
        }
      } catch { /* corrupted, ignore */ }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatKey]);

  // ── Persist chat whenever messages change ─────────────────────────────────
  useEffect(() => {
    if (messages.length <= 1) return; // don't persist welcome-only state
    AsyncStorage.setItem(chatKey, JSON.stringify({ messages, savedAt: Date.now() })).catch(() => {});
  }, [messages, chatKey]);

  // ── Clear chat ────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    setMessages([WELCOME_MSG]);
    setChatRestored(false);
    setShowFAQ(true);
    AsyncStorage.removeItem(chatKey);
  }, [chatKey]);

  // ── Send message ──────────────────────────────────────────────────────────
  const doSend = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: trimmed, time: timestamp() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    // Force-clear the TextInput (needed for multiline on React Native)
    setTimeout(() => inputRef.current?.clear(), 0);
    setSending(true);
    setShowFAQ(false);

    // Pass last N messages as history (excluding welcome)
    const historyMsgs = [...messages, userMsg]
      .filter(m => m.id !== 'welcome')
      .slice(-MAX_HISTORY);

    askHelpAI(trimmed, historyMsgs).then((res: any) => {
      const reply = res?.data?.reply || i18n.t('screens.settingsHelp.botTrouble');
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'bot', text: reply, time: timestamp() }]);
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }).catch(() => {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'bot',
        text: i18n.t('screens.settingsHelp.botOffline'),
        time: timestamp(),
      }]);
      setSending(false);
    });

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [input, sending, messages]);

  const handleSend = useCallback(() => doSend(input), [doSend, input]);
  const handleFAQAsk = useCallback((q: string) => {
    setShowFAQ(false);
    doSend(q);
  }, [doSend]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <View style={s.hdrCenter}>
          <View style={s.hdrBadgeRow}>
            <View style={s.aiBadge}>
              <Ionicons name="sparkles" size={10} color={COLORS.white} />
              <Text style={s.aiBadgeTxt}>{t('screens.settingsHelp.aiSupport')}</Text>
            </View>
          </View>
          <Text style={s.hdrTitle}>{t('settings.help')}</Text>
          <Text style={s.hdrSub}>{t('screens.settingsHelp.hdrSub')}</Text>
        </View>

        <View style={s.hdrRight}>
          <TouchableOpacity
            style={s.iconBtn}
            onPress={() => openLink('mailto:support@tallydekho.com', t('screens.settingsHelp.emailFallback'))}
            activeOpacity={0.75}
          >
            <Ionicons name="mail-outline" size={21} color={COLORS.brandPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.iconBtn}
            onPress={() => openLink('https://wa.me/919024466791', t('screens.settingsHelp.whatsappFallback'))}
            activeOpacity={0.75}
          >
            <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Chat restored banner ───────────────────────────────────────────── */}
      {chatRestored && (
        <View style={s.restoredBanner}>
          <Ionicons name="time-outline" size={13} color={COLORS.brandPrimary} />
          <Text style={s.restoredTxt}>{t('screens.settingsHelp.restored')}</Text>
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.restoredClear}>{t('common.clear')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {/* ── Chat messages ─────────────────────────────────────────────── */}
          <View style={s.messagesArea}>
            {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
            {sending && <TypingIndicator />}
          </View>

          {/* ── FAQs (collapsible, shown when no real conversation yet) ───── */}
          {showFAQ && (
            <View style={s.faqSection}>
              <SectionLabel label={t('screens.settingsHelp.faqLabel')} />
              <View style={s.faqCard}>
                {FAQS.map((item, i) => (
                  <FaqItem
                    key={item.qKey}
                    q={t(item.qKey)}
                    a={t(item.aKey)}
                    isLast={i === FAQS.length - 1}
                    onPress={handleFAQAsk}
                  />
                ))}
              </View>


            </View>
          )}

          {/* Show FAQ toggle when in chat mode */}
          {!showFAQ && (
            <TouchableOpacity style={s.faqToggle} onPress={() => setShowFAQ(true)} activeOpacity={0.7}>
              <Ionicons name="help-circle-outline" size={15} color={COLORS.brandPrimary} />
              <Text style={s.faqToggleTxt}>{t('screens.settingsHelp.browseFaq')}</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 8 }} />
        </ScrollView>

        {/* ── Input Bar ──────────────────────────────────────────────────────── */}
        <View style={s.inputBar}>
          <View style={s.inputRow}>
            <TextInput
              ref={inputRef}
              style={s.inputBox}
              value={input}
              onChangeText={setInput}
              placeholder={t('screens.settingsHelp.inputPh')}
              placeholderTextColor={COLORS.textTertiary}
              multiline
              maxLength={500}
              selectionColor={COLORS.brandPrimary}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
              onPress={handleSend}
              activeOpacity={0.85}
              disabled={!input.trim() || sending}
            >
              <Ionicons name="send" size={18} color={COLORS.white} />
            </TouchableOpacity>
          </View>
          <Text style={s.inputDisclaimer}>
            {t('screens.settingsHelp.disclaimer')}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  // Header
  hdr: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: SPACING.sm, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
    gap: 4,
  },
  iconBtn:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  hdrCenter:  { flex: 1, alignItems: 'center' },
  hdrBadgeRow:{ flexDirection: 'row', marginBottom: 2 },
  aiBadge:    {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  aiBadgeTxt: { fontSize: 10, color: COLORS.white, fontWeight: '700', letterSpacing: 0.3 },
  hdrTitle:   { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  hdrSub:     { fontSize: 10, color: COLORS.textTertiary, marginTop: 1 },
  hdrRight:   { flexDirection: 'row', alignItems: 'center' },

  // Restored banner
  restoredBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.brandPrimary + '12',
    paddingHorizontal: SPACING.md, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.brandPrimary + '20',
  },
  restoredTxt:   { flex: 1, fontSize: TYPOGRAPHY.xs, color: COLORS.brandPrimary },
  restoredClear: { fontSize: TYPOGRAPHY.xs, color: COLORS.brandPrimary, fontWeight: '700' },

  // Scroll
  scroll:      { padding: SPACING.md, paddingBottom: 8 },
  messagesArea:{ marginBottom: 4 },

  // FAQ
  faqSection: { marginTop: 4 },
  faqCard: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  faqToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16,
    marginTop: 4,
  },
  faqToggleTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.brandPrimary, fontWeight: '600' },

  // Input bar
  inputBar: {
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
    paddingHorizontal: SPACING.md, paddingTop: 10, paddingBottom: 12,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
  },
  inputBox: {
    flex: 1,
    fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary,
    minHeight: 42, maxHeight: 100,
    paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.35 },
  inputDisclaimer: {
    fontSize: 10, color: COLORS.textTertiary,
    textAlign: 'center', marginTop: 6,
    fontStyle: 'italic',
  },
});
