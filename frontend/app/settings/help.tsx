import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, Linking,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

// ─── Types ────────────────────────────────────────────────────────────────────
type Role = 'user' | 'bot';
interface Message { id: string; role: Role; text: string; time: string; }

// ─── FAQs ─────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: 'How do I pair with Tally?',
    a: 'Go to Settings → Integrations → Tally Prime Sync. Download the TallyDekho Desktop Agent, open it and note the 6-digit pairing code, then enter it in the Pair Device section.',
  },
  {
    q: 'How to change GSTIN?',
    a: 'Go to Settings → Tax Information, then tap Edit GSTIN. Enter your new GSTIN and upload the required proof. Changes will reflect after verification.',
  },
  {
    q: 'Can I use the app offline?',
    a: 'Yes! All data entry features work offline. Your entries will automatically sync to Tally when your device reconnects to the internet.',
  },
  {
    q: 'How do I create a Sales Invoice?',
    a: 'Tap the + button on the Dashboard, select Sales Invoice, fill in the party name, items, and amounts, then tap Save.',
  },
  {
    q: 'What are Optional entries?',
    a: 'Optional entries are saved in TallyDekho but not posted to Tally books until you manually approve and push them.',
  },
];

// ─── Mock bot response ────────────────────────────────────────────────────────
const getBotResponse = (msg: string): string => {
  const m = msg.toLowerCase();
  if (m.includes('pair') || m.includes('sync') || m.includes('connect') || m.includes('tally'))
    return 'To pair with Tally:\n1. Go to Settings → Tally Prime Sync\n2. Download the TallyDekho Desktop Agent\n3. Open the agent and note the 6-digit code\n4. Enter the code in the Pair Device section on your phone ✓';
  if (m.includes('invoice') || m.includes('bill') || m.includes('voucher') || m.includes('sales'))
    return 'To create a Sales Invoice:\n1. Tap the + button on the Dashboard\n2. Select Sales Invoice\n3. Fill in party name, items, and amounts\n4. Tap Save — it syncs to Tally automatically 📄';
  if (m.includes('gstin') || m.includes('gst') || m.includes('tax'))
    return 'To update your GSTIN:\nGo to Settings → Tax Information → Edit GSTIN. Enter your new GSTIN and upload proof. Changes reflect after verification.';
  if (m.includes('offline'))
    return 'Yes! TallyDekho works fully offline 📵\nAll entry features work without internet and automatically sync when you reconnect.';
  if (m.includes('ledger') || m.includes('party') || m.includes('account'))
    return 'To add a party/ledger:\n1. Go to the Ledger tab\n2. Tap + to add new\n3. Fill in name, group, and contact info\n4. Save — syncs to Tally automatically';
  if (m.includes('stock') || m.includes('inventory') || m.includes('item'))
    return 'To manage stock:\n• Go to Stock tab from the bottom navigation\n• Tap any item to view/edit details\n• Use + to add new stock items\n• Stock levels sync automatically with Tally';
  if (m.includes('plan') || m.includes('upgrade') || m.includes('price') || m.includes('credit'))
    return 'TallyDekho offers Free, Professional, and Enterprise plans.\nTo upgrade: Go to Settings → License & Plans and choose your plan.';
  if (m.match(/^(hi|hello|hey|namaste)/i))
    return "Hello! \uD83D\uDC4B I'm the TallyDekho assistant. Ask me anything about:\n\u2022 Pairing with Tally\n\u2022 Creating invoices\n\u2022 Managing inventory\n\u2022 GSTIN & tax settings\n\u2022 Plans & billing";
  return 'I can help you with TallyDekho! Try asking about:\n• Pairing with Tally\n• Creating invoices or vouchers\n• GSTIN updates\n• Offline usage\n• Plans & pricing';
};

const timestamp = () => {
  const d = new Date();
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
};

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <View style={[mb.wrap, isUser ? mb.wrapUser : mb.wrapBot]}>
      {!isUser && (
        <View style={mb.botAvatar}>
          <Ionicons name="chatbubbles-outline" size={14} color={COLORS.white} />
        </View>
      )}
      <View style={[mb.bubble, isUser ? mb.bubbleUser : mb.bubbleBot]}>
        <Text style={[mb.text, isUser ? mb.textUser : mb.textBot]}>{msg.text}</Text>
        <Text style={[mb.time, isUser ? mb.timeUser : mb.timeBot]}>{msg.time}</Text>
      </View>
    </View>
  );
}
const mb = StyleSheet.create({
  wrap:       { flexDirection:'row', alignItems:'flex-end', gap:8, marginBottom:12 },
  wrapUser:   { justifyContent:'flex-end' },
  wrapBot:    { justifyContent:'flex-start' },
  botAvatar:  { width:28, height:28, borderRadius:14, backgroundColor:COLORS.brandPrimary, alignItems:'center', justifyContent:'center', marginBottom:4, flexShrink:0 },
  bubble:     { maxWidth:'78%', borderRadius:18, paddingHorizontal:14, paddingVertical:10 },
  bubbleUser: { backgroundColor:COLORS.brandPrimary, borderBottomRightRadius:4 },
  bubbleBot:  { backgroundColor:COLORS.cardBg, borderWidth:1, borderColor:COLORS.borderDefault, borderBottomLeftRadius:4 },
  text:       { fontSize:TYPOGRAPHY.sm, lineHeight:20 },
  textUser:   { color:COLORS.white },
  textBot:    { color:COLORS.textPrimary },
  time:       { fontSize:10, marginTop:4 },
  timeUser:   { color:'rgba(255,255,255,0.65)', textAlign:'right' },
  timeBot:    { color:COLORS.textTertiary },
});

// ─── FAQ Item (accordion) ─────────────────────────────────────────────────────
function FaqItem({ q, a, isLast }: { q: string; a: string; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[fq.item, !isLast && fq.border]}>
      <TouchableOpacity style={fq.row} onPress={()=>setOpen(v=>!v)} activeOpacity={0.7}>
        <Text style={fq.question}>{q}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textTertiary} />
      </TouchableOpacity>
      {open && <Text style={fq.answer}>{a}</Text>}
    </View>
  );
}
const fq = StyleSheet.create({
  item:     { paddingVertical:2 },
  border:   { borderBottomWidth:1, borderBottomColor:COLORS.borderDefault },
  row:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:14, gap:12 },
  question: { flex:1, fontSize:TYPOGRAPHY.base, fontWeight:'600', color:COLORS.textPrimary },
  answer:   { fontSize:TYPOGRAPHY.sm, color:COLORS.textSecondary, lineHeight:20, paddingBottom:14, paddingRight:8 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HelpCenterScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<Message[]>([
    { id:'0', role:'bot', text:"Hi! I'm the TallyDekho assistant.\nAsk me anything about the app \u2014 pairing, invoices, stock, GSTIN, plans, and more!", time: timestamp() },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: Message = { id: Date.now().toString(), role:'user', text, time: timestamp() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    // Simulate bot typing delay
    setTimeout(() => {
      const botMsg: Message = {
        id: (Date.now()+1).toString(),
        role: 'bot',
        text: getBotResponse(text),
        time: timestamp(),
      };
      setMessages(prev => [...prev, botMsg]);
      setSending(false);
      setTimeout(()=>scrollRef.current?.scrollToEnd({animated:true}), 100);
    }, 900);

    setTimeout(()=>scrollRef.current?.scrollToEnd({animated:true}), 80);
  }, [input, sending]);

  const handleAttach = async () => {
    try {
      // Show action sheet style: try document picker first (opens Files + images on iOS)
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const file = result.assets[0];
        const attachMsg: Message = {
          id: Date.now().toString(),
          role: 'user',
          text: `📎 Attached: ${file.name}`,
          time: timestamp(),
        };
        setMessages(prev => [...prev, attachMsg]);
        setTimeout(() => {
          const botMsg: Message = {
            id: (Date.now()+1).toString(),
            role: 'bot',
            text: `I received your file "${file.name}". Our support team will review it and get back to you shortly.`,
            time: timestamp(),
          };
          setMessages(prev => [...prev, botMsg]);
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        }, 800);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Could not open files', text2: 'Please try again.' });
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.hdr}>
        <TouchableOpacity onPress={()=>router.back()} style={s.back} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Help Center</Text>
        {/* WhatsApp + Mail icon buttons — top right */}
        <View style={s.hdrIcons}>
          <TouchableOpacity
            style={s.hdrIconBtn}
            onPress={()=>Linking.openURL('https://wa.me/919024466791')}
            activeOpacity={0.75}
          >
            <Ionicons name="logo-whatsapp" size={22} color={'#25D366'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.hdrIconBtn}
            onPress={()=>Linking.openURL('mailto:project@tallydekho.com')}
            activeOpacity={0.75}
          >
            <Ionicons name="mail-outline" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{flex:1}}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={()=>scrollRef.current?.scrollToEnd({animated:false})}
        >
          {/* ── Hero Banner ──────────────────────────────────────── */}
          <View style={s.heroBanner}>
            <View style={s.heroBadge}>
              <Ionicons name="pencil" size={11} color={COLORS.white} />
              <Text style={s.heroBadgeTxt}>Tally Dekho</Text>
            </View>
          </View>

          {/* ── Chat messages ────────────────────────────────────── */}
          <View style={s.messagesArea}>
            {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
            {sending && (
              <View style={[mb.wrap, mb.wrapBot]}>
                <View style={mb.botAvatar}>
                  <Ionicons name="chatbubbles-outline" size={14} color={COLORS.white} />
                </View>
                <View style={[mb.bubble, mb.bubbleBot, s.typingBubble]}>
                  <Text style={s.typingDots}>· · ·</Text>
                </View>
              </View>
            )}
          </View>

          <View style={{height:8}} />
        </ScrollView>

        {/* ── Input Bar ────────────────────────────────────────────── */}
        <View style={s.inputBar}>
          <TextInput
            style={s.inputBox}
            value={input}
            onChangeText={setInput}
            placeholder="Ask anything…"
            placeholderTextColor={COLORS.textTertiary}
            multiline
            maxLength={500}
            selectionColor={COLORS.brandPrimary}
          />
          <View style={s.inputActions}>
            <TouchableOpacity style={s.iconBtn} onPress={handleAttach} activeOpacity={0.7}>
              <Ionicons name="attach" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
              onPress={handleSend}
              activeOpacity={0.85}
              disabled={!input.trim() || sending}
            >
              <Text style={s.sendTxt}>Send</Text>
              <Ionicons name="chevron-forward" size={15} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     { flex:1, backgroundColor:COLORS.pageBg },
  hdr:      { flexDirection:'row', alignItems:'center', backgroundColor:COLORS.cardBg, paddingHorizontal:SPACING.sm, paddingVertical:10, borderBottomWidth:1, borderBottomColor:COLORS.borderDefault },
  back:     { width:40, height:40, alignItems:'center', justifyContent:'center' },
  hdrTitle: { flex:1, fontSize:TYPOGRAPHY.md, fontWeight:'700', color:COLORS.textPrimary, textAlign:'center' },
  hdrIcons: { flexDirection:'row', alignItems:'center', gap:2 },
  hdrIconBtn:{ width:40, height:40, alignItems:'center', justifyContent:'center', borderRadius:20 },
  scroll:   { padding:SPACING.md, paddingBottom:8 },

  // Hero
  heroBanner: {
    backgroundColor:COLORS.brandPrimary, borderRadius:18,
    padding:SPACING.lg, marginBottom:SPACING.md, alignItems:'center',
  },
  heroBadge:    { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'rgba(255,255,255,0.15)', paddingHorizontal:10, paddingVertical:5, borderRadius:RADIUS.full, marginBottom:10 },
  heroBadgeTxt: { fontSize:12, fontWeight:'700', color:COLORS.white },
  heroTitle:    { fontSize:TYPOGRAPHY.md, fontWeight:'800', color:COLORS.white, textAlign:'center', lineHeight:26 },

  // Chat
  messagesArea: { marginBottom:SPACING.md },
  typingBubble: { paddingVertical:12, paddingHorizontal:16 },
  typingDots:   { fontSize:18, color:COLORS.textTertiary, letterSpacing:4 },

  // FAQ
  card: { backgroundColor:COLORS.cardBg, borderRadius:RADIUS.lg, paddingHorizontal:SPACING.md, marginBottom:SPACING.md, borderWidth:1, borderColor:COLORS.borderDefault },

  // Contact
  contactRow: { flexDirection:'row', gap:12, marginBottom:SPACING.sm },
  contactBtn: {
    flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8,
    backgroundColor:COLORS.cardBg, borderRadius:RADIUS.md, paddingVertical:14,
    borderWidth:1.5, borderColor:COLORS.borderStrong,
  },
  contactBtnTxt: { fontSize:TYPOGRAPHY.sm, fontWeight:'700', color:COLORS.textPrimary },

  // Input bar
  inputBar: {
    flexDirection:'column',
    backgroundColor:COLORS.cardBg,
    borderTopWidth:1, borderTopColor:COLORS.borderDefault,
    paddingHorizontal:SPACING.md, paddingTop:10, paddingBottom:12,
  },
  inputBox: {
    fontSize:TYPOGRAPHY.base, color:COLORS.textPrimary,
    minHeight:44, maxHeight:100,
    paddingVertical:8,
  },
  inputActions: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:4 },
  iconBtn:    { width:38, height:38, alignItems:'center', justifyContent:'center', borderRadius:19, backgroundColor:COLORS.activeBg },
  sendBtn:    { flexDirection:'row', alignItems:'center', gap:5, backgroundColor:COLORS.brandPrimary, paddingHorizontal:18, paddingVertical:10, borderRadius:RADIUS.full },
  sendBtnDisabled: { opacity:0.4 },
  sendTxt:    { fontSize:TYPOGRAPHY.sm, fontWeight:'700', color:COLORS.white },
});
