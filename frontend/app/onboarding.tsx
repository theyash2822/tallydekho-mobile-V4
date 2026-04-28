import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, ScrollView, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SW } = Dimensions.get('window');

// ── App theme (exact match) ───────────────────────────────────────────────────
const PAGE_BG  = '#F5F4EF';
const CARD_BG  = '#FFFFFF';
const BORDER   = '#E9E8E3';
const DARK     = '#1A1A1A';
const GOLD     = '#A89060';
const TEXT_PRI = '#1A1A1A';
const TEXT_SEC = '#787774';
const TEXT_TER = '#AEACA8';

const GUIDE_KEY = 'hasSeenGuide';

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 1 — Hero (light theme)
// ─────────────────────────────────────────────────────────────────────────────
function HeroSlide() {
  const logoScale   = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textY       = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale,   { toValue: 1, useNativeDriver: true, tension: 65, friction: 8 }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(textY,       { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={hero.container}>
      {/* App logo */}
      <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }], marginBottom: 28 }}>
        <View style={hero.logoBox}>
          <Ionicons name="stats-chart" size={42} color={GOLD} />
        </View>
      </Animated.View>

      {/* Text */}
      <Animated.View style={{ alignItems: 'center', opacity: textOpacity, transform: [{ translateY: textY }] }}>
        <Text style={hero.appName}>TallyDekho</Text>
        <Text style={hero.tagline}>Ab Hisab Ungaliyon Par</Text>
        <View style={hero.divider} />
        <Text style={hero.subtitle}>
          Your complete business dashboard —{'\n'}invoices, stocks, ledgers and reports{'\n'}all at your fingertips.
        </Text>
      </Animated.View>
    </View>
  );
}

const hero = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  logoBox:   {
    width: 96, height: 96, borderRadius: 26,
    backgroundColor: DARK, alignItems: 'center', justifyContent: 'center',
    shadowColor: DARK, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22, shadowRadius: 20, elevation: 10,
  },
  appName:  { fontSize: 34, fontWeight: '800', color: TEXT_PRI, letterSpacing: -0.5, marginBottom: 6, textAlign: 'center' },
  tagline:  { fontSize: 16, fontWeight: '600', color: GOLD, textAlign: 'center', letterSpacing: 0.4 },
  divider:  { width: 40, height: 2, backgroundColor: GOLD, borderRadius: 1, marginVertical: 16, opacity: 0.6 },
  subtitle: { fontSize: 13, color: TEXT_SEC, textAlign: 'center', lineHeight: 21 },
});

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 2 — Swipe Demo (BOTH directions)
// ─────────────────────────────────────────────────────────────────────────────
function SwipeDemo() {
  const slideX        = useRef(new Animated.Value(0)).current;
  const leftActionOp  = useRef(new Animated.Value(0)).current;  // Transfer (swipe right)
  const rightActionOp = useRef(new Animated.Value(0)).current;  // Edit Stock (swipe left)

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        // ── Cycle 1: swipe RIGHT → Transfer revealed on LEFT ──
        Animated.parallel([
          Animated.timing(slideX,       { toValue: 88,  duration: 520, useNativeDriver: true }),
          Animated.timing(leftActionOp, { toValue: 1,   duration: 420, useNativeDriver: true }),
        ]),
        Animated.delay(1200),
        Animated.parallel([
          Animated.timing(slideX,       { toValue: 0, duration: 420, useNativeDriver: true }),
          Animated.timing(leftActionOp, { toValue: 0, duration: 320, useNativeDriver: true }),
        ]),
        Animated.delay(500),
        // ── Cycle 2: swipe LEFT → Edit Stock revealed on RIGHT ──
        Animated.parallel([
          Animated.timing(slideX,        { toValue: -88, duration: 520, useNativeDriver: true }),
          Animated.timing(rightActionOp, { toValue: 1,   duration: 420, useNativeDriver: true }),
        ]),
        Animated.delay(1200),
        Animated.parallel([
          Animated.timing(slideX,        { toValue: 0, duration: 420, useNativeDriver: true }),
          Animated.timing(rightActionOp, { toValue: 0, duration: 320, useNativeDriver: true }),
        ]),
        Animated.delay(500),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={sd.wrap}>
      {/* LEFT revealed: Transfer (dark #1A1A1A like actual app) */}
      <Animated.View style={[sd.actionLeft, { opacity: leftActionOp }]}>
        <Ionicons name="swap-horizontal-outline" size={20} color="#fff" />
        <Text style={sd.actionLbl}>Transfer</Text>
      </Animated.View>

      {/* RIGHT revealed: Edit Stock (gold #A89060 like actual app) */}
      <Animated.View style={[sd.actionRight, { opacity: rightActionOp }]}>
        <Ionicons name="create-outline" size={20} color="#fff" />
        <Text style={sd.actionLbl}>Edit Stock</Text>
      </Animated.View>

      {/* Main stock card */}
      <Animated.View style={[sd.card, { transform: [{ translateX: slideX }] }]}>
        <View style={sd.cardIcon}>
          <Ionicons name="cube-outline" size={16} color={GOLD} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={sd.cardName}>Cotton Fabric — White</Text>
          <Text style={sd.cardSub}>CF001 · Textiles</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 3 }}>
          <Text style={sd.cardVal}>₹12,500</Text>
          <View style={sd.qtyBadge}><Text style={sd.qtyTxt}>240 units</Text></View>
        </View>
        <Ionicons name="chevron-forward" size={13} color={TEXT_TER} style={{ marginLeft: 2 }} />
      </Animated.View>

      {/* Ghost card */}
      <View style={[sd.card, { opacity: 0.38, marginTop: 8 }]}>
        <View style={sd.cardIcon}><Ionicons name="cube-outline" size={16} color={TEXT_TER} /></View>
        <View style={{ flex: 1, gap: 5 }}>
          <View style={[sd.shimmer, { width: '55%' }]} />
          <View style={[sd.shimmer, { width: '38%', opacity: 0.5 }]} />
        </View>
      </View>

      {/* Direction hint tags */}
      <View style={sd.hintRow}>
        <Animated.View style={[sd.hintTag, sd.hintDark, { opacity: leftActionOp }]}>
          <Ionicons name="arrow-forward-outline" size={10} color="#fff" />
          <Text style={[sd.hintTxt, { color: '#fff' }]}>swipe right → Transfer</Text>
        </Animated.View>
        <Animated.View style={[sd.hintTag, sd.hintGold, { opacity: rightActionOp }]}>
          <Ionicons name="arrow-back-outline" size={10} color="#fff" />
          <Text style={[sd.hintTxt, { color: '#fff' }]}>swipe left → Edit</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const sd = StyleSheet.create({
  wrap:        { width: '100%', overflow: 'hidden' },
  actionLeft:  {
    position: 'absolute', left: 0, top: 0, bottom: 8, width: 84,
    backgroundColor: DARK, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', gap: 5, zIndex: 0,
  },
  actionRight: {
    position: 'absolute', right: 0, top: 0, bottom: 8, width: 84,
    backgroundColor: GOLD, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', gap: 5, zIndex: 0,
  },
  actionLbl: { fontSize: 10, fontWeight: '700', color: '#fff' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: CARD_BG, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: BORDER, zIndex: 1,
  },
  cardIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#FBF7EE', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#F0E8D5',
  },
  cardName: { fontSize: 12, fontWeight: '700', color: TEXT_PRI },
  cardSub:  { fontSize: 10, color: TEXT_SEC, marginTop: 2 },
  cardVal:  { fontSize: 12, fontWeight: '700', color: TEXT_PRI },
  qtyBadge: { backgroundColor: PAGE_BG, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: BORDER },
  qtyTxt:   { fontSize: 9, color: TEXT_SEC },
  shimmer:  { height: 8, backgroundColor: BORDER, borderRadius: 4 },
  hintRow:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  hintTag:  { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  hintDark: { backgroundColor: DARK },
  hintGold: { backgroundColor: GOLD },
  hintTxt:  { fontSize: 10, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 3 — Multi-Select Demo (light theme)
// ─────────────────────────────────────────────────────────────────────────────
function MultiSelectDemo() {
  const a1 = useRef(new Animated.Value(0)).current;
  const a2 = useRef(new Animated.Value(0)).current;
  const a3 = useRef(new Animated.Value(0)).current;
  const barY  = useRef(new Animated.Value(50)).current;
  const barOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(a1, { toValue: 1, duration: 260, useNativeDriver: false }),
        Animated.delay(140),
        Animated.timing(a2, { toValue: 1, duration: 260, useNativeDriver: false }),
        Animated.delay(140),
        Animated.timing(a3, { toValue: 1, duration: 260, useNativeDriver: false }),
        Animated.parallel([
          Animated.timing(barY,  { toValue: 0,  duration: 360, useNativeDriver: true }),
          Animated.timing(barOp, { toValue: 1,  duration: 360, useNativeDriver: true }),
        ]),
        Animated.delay(1400),
        Animated.parallel([
          Animated.timing(barY,  { toValue: 50, duration: 280, useNativeDriver: true }),
          Animated.timing(barOp, { toValue: 0,  duration: 240, useNativeDriver: true }),
          Animated.timing(a3,    { toValue: 0,  duration: 180, useNativeDriver: false }),
          Animated.timing(a2,    { toValue: 0,  duration: 180, useNativeDriver: false }),
          Animated.timing(a1,    { toValue: 0,  duration: 180, useNativeDriver: false }),
        ]),
        Animated.delay(600),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const rows = [
    { anim: a1, name: 'Cotton Fabric', sub: '240 units' },
    { anim: a2, name: 'Silk Dupatta',  sub: '120 units' },
    { anim: a3, name: 'Linen Blend',   sub: '85 units'  },
  ];

  return (
    <View style={msd.wrap}>
      {rows.map((row, i) => (
        <Animated.View
          key={i}
          style={[
            msd.row,
            {
              backgroundColor: row.anim.interpolate({ inputRange: [0, 1], outputRange: [CARD_BG, '#FBF7EE'] }),
              borderColor:     row.anim.interpolate({ inputRange: [0, 1], outputRange: [BORDER, '#F0E8D5'] }),
            },
          ]}
        >
          <Animated.View
            style={[
              msd.checkbox,
              {
                backgroundColor: row.anim.interpolate({ inputRange: [0, 1], outputRange: ['transparent', DARK] }),
                borderColor:     row.anim.interpolate({ inputRange: [0, 1], outputRange: [TEXT_TER, DARK] }),
              },
            ]}
          >
            <Animated.View style={{ opacity: row.anim }}>
              <Ionicons name="checkmark" size={9} color="#fff" />
            </Animated.View>
          </Animated.View>
          <View style={msd.cardIcon}>
            <Ionicons name="cube-outline" size={14} color={i === 0 ? GOLD : TEXT_TER} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={msd.rowName}>{row.name}</Text>
            <Text style={msd.rowSub}>{row.sub}</Text>
          </View>
        </Animated.View>
      ))}

      {/* Sliding action bar (same as real app) */}
      <Animated.View style={[msd.actionBar, { transform: [{ translateY: barY }], opacity: barOp }]}>
        <Text style={msd.barCount}>3 selected</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={[msd.barBtn, { backgroundColor: GOLD }]}>
            <Ionicons name="share-outline" size={11} color="#fff" />
            <Text style={msd.barBtnTxt}>PDF</Text>
          </View>
          <View style={[msd.barBtn, { backgroundColor: '#444' }]}>
            <Ionicons name="swap-horizontal-outline" size={11} color="#fff" />
            <Text style={msd.barBtnTxt}>Transfer</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const msd = StyleSheet.create({
  wrap:      { width: '100%', gap: 6, overflow: 'hidden' },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  checkbox:  { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  cardIcon:  { width: 30, height: 30, borderRadius: 8, backgroundColor: PAGE_BG, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: BORDER },
  rowName:   { fontSize: 11, fontWeight: '700', color: TEXT_PRI },
  rowSub:    { fontSize: 9, color: TEXT_SEC, marginTop: 2 },
  actionBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: DARK, borderRadius: 10, padding: 10, marginTop: 2,
  },
  barCount:  { fontSize: 11, fontWeight: '700', color: '#fff' },
  barBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  barBtnTxt: { fontSize: 10, fontWeight: '700', color: '#fff' },
});

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 4 — Cashflow Ring Demo (light theme)
// ─────────────────────────────────────────────────────────────────────────────
function CashflowDemo() {
  const tapScale    = useRef(new Animated.Value(1)).current;
  const rippleScale = useRef(new Animated.Value(0)).current;
  const rippleOp    = useRef(new Animated.Value(0)).current;
  const tooltipOp   = useRef(new Animated.Value(0)).current;
  const tooltipSc   = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(900),
        Animated.parallel([
          Animated.timing(tapScale,    { toValue: 0.92, duration: 110, useNativeDriver: true }),
          Animated.timing(rippleScale, { toValue: 2.0,  duration: 400, useNativeDriver: true }),
          Animated.timing(rippleOp,    { toValue: 0.5,  duration: 120, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(tapScale, { toValue: 1,   duration: 150, useNativeDriver: true }),
          Animated.timing(rippleOp, { toValue: 0,   duration: 300, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(tooltipOp, { toValue: 1, duration: 360, useNativeDriver: true }),
          Animated.spring(tooltipSc, { toValue: 1, useNativeDriver: true, tension: 90, friction: 8 }),
        ]),
        Animated.delay(1500),
        Animated.parallel([
          Animated.timing(tooltipOp,   { toValue: 0,    duration: 280, useNativeDriver: true }),
          Animated.timing(tooltipSc,   { toValue: 0.85, duration: 280, useNativeDriver: true }),
          Animated.timing(rippleScale, { toValue: 0,    duration: 200, useNativeDriver: true }),
        ]),
        Animated.delay(700),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={cfd.wrap}>
      {/* Card matching actual CashflowCard */}
      <View style={cfd.card}>
        {/* Card header */}
        <View style={cfd.cardHeader}>
          <View style={cfd.headerIcon}>
            <Ionicons name="eye-outline" size={13} color={TEXT_SEC} />
          </View>
          <Text style={cfd.cardTitle}>Cashflow</Text>
          <Text style={cfd.tapHint}>Tap ring to see breakdown</Text>
        </View>

        {/* Ring */}
        <View style={cfd.ringArea}>
          <Animated.View style={{ transform: [{ scale: tapScale }] }}>
            <Animated.View style={[cfd.ripple, { transform: [{ scale: rippleScale }], opacity: rippleOp }]} />
            <View style={cfd.ring}>
              <View style={cfd.ringCenter}>
                <Text style={cfd.ringLbl}>Net Cash</Text>
                <Text style={cfd.ringVal}>₹8,500</Text>
              </View>
            </View>
            {/* Tooltip */}
            <Animated.View style={[cfd.tooltip, { opacity: tooltipOp, transform: [{ scale: tooltipSc }] }]}>
              <View style={cfd.ttRow}>
                <View style={[cfd.ttDot, { backgroundColor: DARK }]} />
                <Text style={cfd.ttLbl}>Income</Text>
                <Text style={cfd.ttVal}>₹37,440</Text>
              </View>
              <View style={cfd.ttDiv} />
              <View style={cfd.ttRow}>
                <View style={[cfd.ttDot, { backgroundColor: '#A0A0A0' }]} />
                <Text style={cfd.ttLbl}>Expense</Text>
                <Text style={cfd.ttVal}>₹28,940</Text>
              </View>
            </Animated.View>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const cfd = StyleSheet.create({
  wrap:       { width: '100%' },
  card:       { backgroundColor: CARD_BG, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: BORDER },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  headerIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: PAGE_BG, alignItems: 'center', justifyContent: 'center' },
  cardTitle:  { fontSize: 13, fontWeight: '600', color: TEXT_PRI },
  tapHint:    { flex: 1, textAlign: 'right', fontSize: 9, color: TEXT_TER },
  ringArea:   { alignItems: 'center', paddingVertical: 4 },
  ripple:     { position: 'absolute', width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(168,144,96,0.15)' },
  ring:       {
    width: 110, height: 110, borderRadius: 55, borderWidth: 14,
    borderTopColor: DARK, borderRightColor: DARK,
    borderBottomColor: '#E0DEDA', borderLeftColor: '#E0DEDA',
    alignItems: 'center', justifyContent: 'center',
  },
  ringCenter: { alignItems: 'center' },
  ringLbl:    { fontSize: 9, color: TEXT_SEC },
  ringVal:    { fontSize: 14, fontWeight: '800', color: TEXT_PRI, marginTop: 1 },
  tooltip: {
    position: 'absolute', right: -90, top: 8,
    backgroundColor: CARD_BG, borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: BORDER, minWidth: 130,
    shadowColor: DARK, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  ttRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ttDot:    { width: 8, height: 8, borderRadius: 4 },
  ttLbl:    { flex: 1, fontSize: 10, color: TEXT_SEC },
  ttVal:    { fontSize: 10, fontWeight: '700', color: TEXT_PRI },
  ttDiv:    { height: 1, backgroundColor: BORDER, marginVertical: 5 },
});

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 5 — Voice Search Demo (light theme)
// ─────────────────────────────────────────────────────────────────────────────
function VoiceDemo() {
  const micScale = useRef(new Animated.Value(1)).current;
  const pulse1   = useRef(new Animated.Value(1)).current;
  const pulse2   = useRef(new Animated.Value(1)).current;
  const textOp   = useRef(new Animated.Value(0)).current;
  const textY    = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(micScale, { toValue: 1.1, duration: 180, useNativeDriver: true }),
        Animated.parallel([
          Animated.loop(
            Animated.parallel([
              Animated.sequence([
                Animated.timing(pulse1, { toValue: 1.75, duration: 650, useNativeDriver: true }),
                Animated.timing(pulse1, { toValue: 1,    duration: 0,   useNativeDriver: true }),
              ]),
              Animated.sequence([
                Animated.delay(320),
                Animated.timing(pulse2, { toValue: 2.1, duration: 650, useNativeDriver: true }),
                Animated.timing(pulse2, { toValue: 1,   duration: 0,   useNativeDriver: true }),
              ]),
            ]),
            { iterations: 3 }
          ),
        ]),
        Animated.parallel([
          Animated.timing(textOp, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(textY,  { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
        Animated.delay(1200),
        Animated.parallel([
          Animated.timing(textOp,   { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(textY,    { toValue: 8, duration: 300, useNativeDriver: true }),
          Animated.timing(micScale, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]),
        Animated.delay(500),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={vd.wrap}>
      {/* Search bar matching actual app style */}
      <View style={vd.searchBar}>
        <Ionicons name="search-outline" size={14} color={TEXT_TER} />
        <Animated.Text style={[vd.searchText, { opacity: textOp, transform: [{ translateY: textY }] }]}>
          Sales Invoice
        </Animated.Text>
        <View style={vd.micWrap}>
          <Animated.View style={[vd.pulseRing, { transform: [{ scale: pulse1 }], opacity: pulse1.interpolate({ inputRange: [1, 1.75], outputRange: [0.3, 0] }) }]} />
          <Animated.View style={[vd.pulseRing, { width: 34, height: 34, borderRadius: 17, transform: [{ scale: pulse2 }], opacity: pulse2.interpolate({ inputRange: [1, 2.1], outputRange: [0.2, 0] }) }]} />
          <Animated.View style={[vd.micCircle, { transform: [{ scale: micScale }] }]}>
            <Ionicons name="mic" size={13} color="#fff" />
          </Animated.View>
        </View>
      </View>

      {/* Results preview */}
      <Animated.View style={[vd.resultCard, { opacity: textOp }]}>
        <Ionicons name="document-text-outline" size={14} color={GOLD} />
        <View style={{ flex: 1 }}>
          <Text style={vd.resultTitle}>Sales Invoice #1042</Text>
          <Text style={vd.resultSub}>Rajesh Traders · ₹24,500</Text>
        </View>
        <Ionicons name="chevron-forward" size={12} color={TEXT_TER} />
      </Animated.View>

      {/* Listening hint */}
      <Animated.View style={[vd.listenRow, { opacity: textOp }]}>
        <View style={vd.listenDot} />
        <Text style={vd.listenTxt}>Listening…</Text>
      </Animated.View>
    </View>
  );
}

const vd = StyleSheet.create({
  wrap:        { width: '100%', paddingHorizontal: 2, gap: 10 },
  searchBar:   {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD_BG, borderRadius: 30,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: BORDER, gap: 8,
  },
  searchText:  { flex: 1, fontSize: 12, color: TEXT_PRI, fontWeight: '500' },
  micWrap:     { alignItems: 'center', justifyContent: 'center', width: 28, height: 28 },
  pulseRing:   { position: 'absolute', width: 26, height: 26, borderRadius: 13, backgroundColor: GOLD },
  micCircle:   { width: 26, height: 26, borderRadius: 13, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  resultCard:  {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: CARD_BG, borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: BORDER,
  },
  resultTitle: { fontSize: 11, fontWeight: '700', color: TEXT_PRI },
  resultSub:   { fontSize: 9, color: TEXT_SEC, marginTop: 1 },
  listenRow:   { flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 4 },
  listenDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD },
  listenTxt:   { fontSize: 11, color: TEXT_SEC, fontStyle: 'italic' },
});

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 6 — Quick Actions Bottom Sheet Demo (matches actual QuickActionsModal)
// ─────────────────────────────────────────────────────────────────────────────
function QuickAddDemo() {
  const sheetY   = useRef(new Animated.Value(240)).current;
  const sheetOp  = useRef(new Animated.Value(0)).current;
  const expandH  = useRef(new Animated.Value(0)).current;
  const chevronR = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(400),
        // Sheet slides up
        Animated.parallel([
          Animated.spring(sheetY,  { toValue: 0, useNativeDriver: true, tension: 68, friction: 11 }),
          Animated.timing(sheetOp, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]),
        Animated.delay(700),
        // Sales section expands
        Animated.parallel([
          Animated.timing(expandH,  { toValue: 1, duration: 360, useNativeDriver: false }),
          Animated.timing(chevronR, { toValue: 1, duration: 360, useNativeDriver: true }),
        ]),
        Animated.delay(1500),
        // Sales section collapses
        Animated.parallel([
          Animated.timing(expandH,  { toValue: 0, duration: 300, useNativeDriver: false }),
          Animated.timing(chevronR, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
        Animated.delay(500),
        // Sheet slides down
        Animated.parallel([
          Animated.timing(sheetY,  { toValue: 240, duration: 380, useNativeDriver: true }),
          Animated.timing(sheetOp, { toValue: 0,   duration: 280, useNativeDriver: true }),
        ]),
        Animated.delay(700),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const chevronDeg = chevronR.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  const SECTIONS = [
    { label: 'Sales',    icon: 'receipt-outline',    color: '#2D7D46', bg: '#F0FBF4',
      items: ['Create Invoice', 'Create Quotation', 'Sales Order'] },
    { label: 'Purchase', icon: 'bag-handle-outline', color: '#C0392B', bg: '#FDECEA', items: [] },
    { label: 'Voucher',  icon: 'wallet-outline',     color: '#D97706', bg: '#FFFBEB', items: [] },
  ];

  return (
    <View style={qad.outerWrap}>
      {/* Dim overlay (shows when sheet opens) */}
      <Animated.View style={[qad.dimOverlay, { opacity: sheetOp.interpolate({ inputRange: [0, 1], outputRange: [0, 0.3] }) }]} />

      {/* Bottom Sheet */}
      <Animated.View style={[qad.sheet, { transform: [{ translateY: sheetY }], opacity: sheetOp }]}>
        {/* Handle */}
        <View style={qad.handle} />

        {/* Header */}
        <View style={qad.sheetHeader}>
          <Text style={qad.sheetTitle}>Quick Actions</Text>
          <View style={qad.closeBtn}>
            <Ionicons name="close" size={16} color={TEXT_PRI} />
          </View>
        </View>

        {/* Section cards */}
        <View style={qad.sections}>
          {SECTIONS.map((sec, i) => (
            <View key={i} style={[qad.sectionCard, i === 0 && { borderLeftWidth: 3, borderLeftColor: sec.color }]}>
              <View style={qad.sectionRow}>
                <View style={[qad.secIcon, { backgroundColor: sec.bg }]}>
                  <Ionicons name={sec.icon as any} size={18} color={sec.color} />
                </View>
                <Text style={qad.secLabel}>{sec.label}</Text>
                {i === 0 ? (
                  <Animated.View style={{ transform: [{ rotate: chevronDeg }] }}>
                    <Ionicons name="chevron-down" size={16} color={sec.color} />
                  </Animated.View>
                ) : (
                  <Ionicons name="chevron-down" size={16} color={TEXT_TER} />
                )}
              </View>

              {/* Expanding items for Sales */}
              {i === 0 && (
                <Animated.View style={[qad.itemsWrap, {
                  maxHeight: expandH.interpolate({ inputRange: [0, 1], outputRange: [0, 110] }),
                  opacity: expandH,
                  overflow: 'hidden',
                }]}>
                  {sec.items.map((item, j) => (
                    <View key={j} style={[qad.subItem, j < sec.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: BORDER }]}>
                      <View style={[qad.subItemIcon, { backgroundColor: sec.bg }]}>
                        <Ionicons name="document-text-outline" size={12} color={sec.color} />
                      </View>
                      <Text style={qad.subItemTxt}>{item}</Text>
                      <Ionicons name="chevron-forward" size={11} color={sec.color + '80'} />
                    </View>
                  ))}
                </Animated.View>
              )}
            </View>
          ))}
        </View>

        {/* Close circle button */}
        <View style={qad.bottomRow}>
          <View style={qad.bottomClose}>
            <Ionicons name="close" size={18} color="#fff" />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const qad = StyleSheet.create({
  outerWrap:  { width: '100%', height: 260, overflow: 'hidden', position: 'relative' },
  dimOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#F4F4F4', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 12,
  },
  handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  sheetTitle:  { fontSize: 16, fontWeight: '700', color: TEXT_PRI },
  closeBtn:    { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  sections:    { paddingHorizontal: 12, gap: 6 },
  sectionCard: { backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1.5, borderColor: BORDER, overflow: 'hidden' },
  sectionRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, gap: 10 },
  secIcon:     { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  secLabel:    { flex: 1, fontSize: 14, fontWeight: '700', color: TEXT_PRI },
  itemsWrap:   { borderTopWidth: 1, borderTopColor: BORDER },
  subItem:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 12 },
  subItemIcon: { width: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  subItemTxt:  { flex: 1, fontSize: 12, fontWeight: '500', color: TEXT_PRI },
  bottomRow:   { alignItems: 'center', paddingTop: 10 },
  bottomClose: { width: 44, height: 44, borderRadius: 22, backgroundColor: DARK, alignItems: 'center', justifyContent: 'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE DATA
// ─────────────────────────────────────────────────────────────────────────────
interface SlideInfo {
  id:          string;
  emoji?:      string;
  title:       string;
  description: string;
  isHero?:     boolean;
  Demo?:       React.FC;
}

const SLIDES: SlideInfo[] = [
  { id: 'hero', title: 'TallyDekho', description: '', isHero: true },
  {
    id: 'swipe', emoji: '👈👉',
    title: 'Swipe for Quick Actions',
    description: 'Swipe right on a stock tile to Transfer, or swipe left to Edit Stock — instantly.',
    Demo: SwipeDemo,
  },
  {
    id: 'multiselect', emoji: '👆',
    title: 'Long Press to Select',
    description: 'Long press any stock item to enter multi-select. Bulk export as PDF or transfer in one tap.',
    Demo: MultiSelectDemo,
  },
  {
    id: 'cashflow', emoji: '📊',
    title: 'Tap Ring for Breakdown',
    description: 'Tap the cashflow ring on Home to instantly reveal your income vs expense split.',
    Demo: CashflowDemo,
  },
  {
    id: 'voice', emoji: '🎤',
    title: 'Voice Search',
    description: 'Tap the mic on home and speak — find any invoice, party or transaction in seconds.',
    Demo: VoiceDemo,
  },
  {
    id: 'quickadd', emoji: '➕',
    title: 'One Tap to Create',
    description: 'Tap + anywhere to open Quick Actions — create invoices, vouchers, stock entries and more.',
    Demo: QuickAddDemo,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const router   = useRouter();
  const params   = useLocalSearchParams<{ replay?: string }>();
  const isReplay = params.replay === 'true';

  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideH,       setSlideH]       = useState(520);
  const scrollRef = useRef<ScrollView>(null);

  const goToIndex = useCallback((idx: number) => {
    scrollRef.current?.scrollTo({ x: idx * SW, animated: true });
    setCurrentIndex(idx);
  }, []);

  const goNext = useCallback(() => {
    if (currentIndex < SLIDES.length - 1) {
      goToIndex(currentIndex + 1);
    } else {
      finishGuide();
    }
  }, [currentIndex, goToIndex]);

  const finishGuide = useCallback(async () => {
    if (!isReplay) await AsyncStorage.setItem(GUIDE_KEY, 'true');
    if (isReplay) router.back();
    else          router.replace('/(tabs)');
  }, [isReplay, router]);

  const onScroll = useCallback((e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SW);
    setCurrentIndex(idx);
  }, []);

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <View style={s.container}>
      {/* Skip button */}
      {!isLast && (
        <SafeAreaView edges={['top']} style={s.skipWrap}>
          <TouchableOpacity style={s.skipBtn} onPress={finishGuide} activeOpacity={0.7}>
            <Text style={s.skipTxt}>Skip</Text>
          </TouchableOpacity>
        </SafeAreaView>
      )}

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal pagingEnabled scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        onLayout={(e) => setSlideH(e.nativeEvent.layout.height)}
        style={{ flex: 1 }}
        bounces={false}
      >
        {SLIDES.map((slide) => {
          if (slide.isHero) {
            return (
              <View key={slide.id} style={{ width: SW, height: slideH }}>
                <HeroSlide />
              </View>
            );
          }
          const DemoComponent = slide.Demo!;
          return (
            <View key={slide.id} style={{ width: SW, height: slideH, paddingTop: 68, paddingHorizontal: 22 }}>
              {/* Demo frame card */}
              <View style={s.demoFrame}>
                <View style={s.frameBar} />
                <DemoComponent />
              </View>

              {/* Slide text */}
              <View style={s.textBlock}>
                <Text style={s.slideEmoji}>{slide.emoji}</Text>
                <Text style={s.slideTitle}>{slide.title}</Text>
                <Text style={s.slideDesc}>{slide.description}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Bottom nav */}
      <SafeAreaView edges={['bottom']} style={s.bottomNav}>
        <View style={s.dotsRow}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goToIndex(i)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
              <View style={[s.dot, i === currentIndex && s.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[s.ctaBtn, isLast && s.ctaBtnGold]} onPress={goNext} activeOpacity={0.85}>
          <Text style={s.ctaTxt}>{isLast ? 'Get Started  →' : 'Next  →'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: PAGE_BG },

  skipWrap:   { position: 'absolute', top: 0, right: 16, zIndex: 20 },
  skipBtn:    { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(26,26,26,0.07)', marginTop: 10, borderWidth: 1, borderColor: BORDER },
  skipTxt:    { fontSize: 13, fontWeight: '600', color: TEXT_SEC },

  demoFrame:  {
    backgroundColor: CARD_BG, borderRadius: 18, padding: 14,
    borderWidth: 1.5, borderColor: BORDER,
    shadowColor: DARK, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
    overflow: 'hidden',
  },
  frameBar:   { height: 3, backgroundColor: GOLD, borderRadius: 2, marginBottom: 12, width: 36, alignSelf: 'center', opacity: 0.85 },

  textBlock:  { paddingTop: 18 },
  slideEmoji: { fontSize: 28, marginBottom: 8 },
  slideTitle: { fontSize: 22, fontWeight: '800', color: TEXT_PRI, marginBottom: 6, letterSpacing: -0.3 },
  slideDesc:  { fontSize: 13, color: TEXT_SEC, lineHeight: 21 },

  bottomNav:  { paddingHorizontal: 22, paddingBottom: 12, paddingTop: 6, backgroundColor: PAGE_BG, borderTopWidth: 1, borderTopColor: BORDER },
  dotsRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 14 },
  dot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(26,26,26,0.15)' },
  dotActive:  { width: 22, height: 6, borderRadius: 3, backgroundColor: GOLD },

  ctaBtn:     { backgroundColor: DARK, borderRadius: 13, paddingVertical: 15, alignItems: 'center' },
  ctaBtnGold: { backgroundColor: GOLD },
  ctaTxt:     { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
});
