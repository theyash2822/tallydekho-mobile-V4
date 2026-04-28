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

const GOLD   = '#A89060';
const DARK   = '#1A1A1A';
const DARK2  = '#252525';
const DARK3  = '#333333';
const GUIDE_KEY = 'hasSeenGuide';

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 1 — Hero
// ─────────────────────────────────────────────────────────────────────────────
function HeroSlide() {
  const logoScale   = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textY       = useRef(new Animated.Value(24)).current;
  const glowScale   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale,   { toValue: 1, useNativeDriver: true, tension: 65, friction: 8 }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(textY,       { toValue: 0,  duration: 500, useNativeDriver: true }),
      ]),
    ]).start();

    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, { toValue: 1.14, duration: 1600, useNativeDriver: true }),
        Animated.timing(glowScale, { toValue: 1,    duration: 1600, useNativeDriver: true }),
      ])
    );
    glow.start();
    return () => glow.stop();
  }, []);

  return (
    <View style={hero.container}>
      {/* Glow ring */}
      <Animated.View style={[hero.glowRing, { transform: [{ scale: glowScale }] }]} />
      <Animated.View style={[hero.glowRing2, { transform: [{ scale: glowScale }] }]} />

      {/* Logo box */}
      <Animated.View style={[hero.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <View style={hero.logoBox}>
          <Ionicons name="stats-chart" size={42} color={GOLD} />
        </View>
      </Animated.View>

      {/* App name + tagline */}
      <Animated.View style={{ alignItems: 'center', opacity: textOpacity, transform: [{ translateY: textY }] }}>
        <Text style={hero.appName}>TallyDekho</Text>
        <Text style={hero.tagline}>Ab Hisab Ungaliyon Par</Text>
        <Text style={hero.subtitle}>
          Your complete business dashboard —{'\n'}invoices, stocks, ledgers and reports{'\n'}all at your fingertips.
        </Text>
      </Animated.View>
    </View>
  );
}

const hero = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  glowRing:  {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(168,144,96,0.06)',
    borderWidth: 1, borderColor: 'rgba(168,144,96,0.14)',
  },
  glowRing2: {
    position: 'absolute', width: 310, height: 310, borderRadius: 155,
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: 'rgba(168,144,96,0.06)',
  },
  logoWrap: { marginBottom: 28 },
  logoBox:  {
    width: 96, height: 96, borderRadius: 26,
    backgroundColor: DARK2, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(168,144,96,0.4)',
    shadowColor: GOLD, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
  },
  appName:  { fontSize: 34, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 6, textAlign: 'center' },
  tagline:  { fontSize: 16, fontWeight: '600', color: GOLD, textAlign: 'center', marginBottom: 18, letterSpacing: 0.4 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 21 },
});

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 2 — Swipe Demo
// ─────────────────────────────────────────────────────────────────────────────
function SwipeDemo() {
  const slideX     = useRef(new Animated.Value(0)).current;
  const actionOp   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(700),
        Animated.parallel([
          Animated.timing(slideX,   { toValue: -90, duration: 550, useNativeDriver: true }),
          Animated.timing(actionOp, { toValue: 1,   duration: 450, useNativeDriver: true }),
        ]),
        Animated.delay(1400),
        Animated.parallel([
          Animated.timing(slideX,   { toValue: 0, duration: 450, useNativeDriver: true }),
          Animated.timing(actionOp, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]),
        Animated.delay(700),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={sd.wrap}>
      {/* Action revealed behind card */}
      <Animated.View style={[sd.actionBg, { opacity: actionOp }]}>
        <Ionicons name="create-outline" size={22} color="#fff" />
        <Text style={sd.actionLbl}>Edit Stock</Text>
      </Animated.View>

      {/* Main card */}
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
      </Animated.View>

      {/* Ghost card 2 */}
      <View style={[sd.card, { opacity: 0.3, marginTop: 8 }]}>
        <View style={sd.cardIcon}><Ionicons name="cube-outline" size={16} color="#555" /></View>
        <View style={{ flex: 1, gap: 5 }}>
          <View style={[sd.shimmer, { width: '55%' }]} />
          <View style={[sd.shimmer, { width: '38%', opacity: 0.5 }]} />
        </View>
      </View>

      {/* Ghost card 3 */}
      <View style={[sd.card, { opacity: 0.15, marginTop: 8 }]}>
        <View style={sd.cardIcon}><Ionicons name="cube-outline" size={16} color="#555" /></View>
        <View style={{ flex: 1, gap: 5 }}>
          <View style={[sd.shimmer, { width: '68%' }]} />
          <View style={[sd.shimmer, { width: '45%', opacity: 0.5 }]} />
        </View>
      </View>

      {/* Swipe hint */}
      <Animated.View style={[sd.hint, { opacity: actionOp.interpolate({ inputRange: [0, 0.25], outputRange: [1, 0] }) }]}>
        <Ionicons name="arrow-back-outline" size={12} color="rgba(168,144,96,0.55)" />
        <Text style={sd.hintTxt}>swipe left</Text>
      </Animated.View>
    </View>
  );
}

const sd = StyleSheet.create({
  wrap:       { width: '100%', overflow: 'hidden', gap: 0 },
  actionBg:   {
    position: 'absolute', right: 0, top: 0, bottom: 8, width: 90,
    backgroundColor: GOLD, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', gap: 5, zIndex: 0,
  },
  actionLbl:  { fontSize: 10, fontWeight: '700', color: '#fff' },
  card:       {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: DARK2, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: DARK3, zIndex: 1,
  },
  cardIcon:   { width: 36, height: 36, borderRadius: 10, backgroundColor: '#1F1C16', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(168,144,96,0.2)' },
  cardName:   { fontSize: 12, fontWeight: '700', color: '#fff' },
  cardSub:    { fontSize: 10, color: '#666', marginTop: 2 },
  cardVal:    { fontSize: 12, fontWeight: '700', color: '#fff' },
  qtyBadge:   { backgroundColor: DARK3, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  qtyTxt:     { fontSize: 9, color: '#888' },
  shimmer:    { height: 9, backgroundColor: DARK3, borderRadius: 4 },
  hint:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, justifyContent: 'flex-end', paddingRight: 4 },
  hintTxt:    { fontSize: 10, color: 'rgba(168,144,96,0.6)', fontStyle: 'italic' },
});

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 3 — Multi-Select Demo
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
          Animated.timing(barY,  { toValue: 0, duration: 360, useNativeDriver: true }),
          Animated.timing(barOp, { toValue: 1, duration: 360, useNativeDriver: true }),
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
              backgroundColor: row.anim.interpolate({ inputRange: [0, 1], outputRange: [DARK2, '#2A2418'] }),
              borderColor:     row.anim.interpolate({ inputRange: [0, 1], outputRange: [DARK3, 'rgba(168,144,96,0.35)'] }),
            },
          ]}
        >
          <Animated.View
            style={[
              msd.checkbox,
              {
                backgroundColor: row.anim.interpolate({ inputRange: [0, 1], outputRange: ['transparent', GOLD] }),
                borderColor:     row.anim.interpolate({ inputRange: [0, 1], outputRange: ['#555', GOLD] }),
              },
            ]}
          >
            <Animated.View style={{ opacity: row.anim }}>
              <Ionicons name="checkmark" size={9} color="#fff" />
            </Animated.View>
          </Animated.View>
          <View style={{ flex: 1 }}>
            <Text style={msd.rowName}>{row.name}</Text>
            <Text style={msd.rowSub}>{row.sub}</Text>
          </View>
        </Animated.View>
      ))}

      {/* Sliding action bar */}
      <Animated.View style={[msd.actionBar, { transform: [{ translateY: barY }], opacity: barOp }]}>
        <Text style={msd.barCount}>3 selected</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={[msd.barBtn, { backgroundColor: GOLD }]}><Text style={msd.barBtnTxt}>PDF</Text></View>
          <View style={[msd.barBtn, { backgroundColor: '#444' }]}><Text style={msd.barBtnTxt}>Transfer</Text></View>
        </View>
      </Animated.View>
    </View>
  );
}

const msd = StyleSheet.create({
  wrap:      { width: '100%', gap: 6, overflow: 'hidden' },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 10, borderWidth: 1 },
  checkbox:  { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  rowName:   { fontSize: 11, fontWeight: '700', color: '#fff' },
  rowSub:    { fontSize: 9, color: '#666', marginTop: 2 },
  actionBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: DARK, borderRadius: 10, padding: 10, marginTop: 4,
    borderWidth: 1, borderColor: 'rgba(168,144,96,0.3)',
  },
  barCount:  { fontSize: 11, fontWeight: '700', color: '#fff' },
  barBtn:    { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  barBtnTxt: { fontSize: 10, fontWeight: '700', color: '#fff' },
});

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 4 — Cashflow Ring Demo
// ─────────────────────────────────────────────────────────────────────────────
function CashflowDemo() {
  const tapScale    = useRef(new Animated.Value(1)).current;
  const rippleScale = useRef(new Animated.Value(0)).current;
  const rippleOp    = useRef(new Animated.Value(0)).current;
  const tooltipOp   = useRef(new Animated.Value(0)).current;
  const tooltipSc   = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(900),
        Animated.parallel([
          Animated.timing(tapScale,    { toValue: 0.92, duration: 110, useNativeDriver: true }),
          Animated.timing(rippleScale, { toValue: 2.0,  duration: 420, useNativeDriver: true }),
          Animated.timing(rippleOp,    { toValue: 1,    duration: 120, useNativeDriver: true }),
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
          Animated.timing(tooltipOp,   { toValue: 0,   duration: 280, useNativeDriver: true }),
          Animated.timing(tooltipSc,   { toValue: 0.8, duration: 280, useNativeDriver: true }),
          Animated.timing(rippleScale, { toValue: 0,   duration: 200, useNativeDriver: true }),
        ]),
        Animated.delay(600),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={cfd.wrap}>
      <Animated.View style={[cfd.ringWrap, { transform: [{ scale: tapScale }] }]}>
        {/* Ripple */}
        <Animated.View style={[cfd.ripple, { transform: [{ scale: rippleScale }], opacity: rippleOp }]} />

        {/* Ring (border trick — top/right colored, others dark) */}
        <View style={cfd.ring}>
          <View style={cfd.ringCenter}>
            <Text style={cfd.ringLbl}>Net Cash</Text>
            <Text style={cfd.ringVal}>₹8,500</Text>
            <Text style={cfd.ringHint}>tap ring</Text>
          </View>
        </View>

        {/* Tooltip */}
        <Animated.View style={[cfd.tooltip, { opacity: tooltipOp, transform: [{ scale: tooltipSc }] }]}>
          <View style={cfd.ttRow}>
            <View style={[cfd.ttDot, { backgroundColor: '#fff' }]} />
            <Text style={cfd.ttLbl}>Income</Text>
            <Text style={cfd.ttVal}>₹37,440</Text>
          </View>
          <View style={cfd.ttDivider} />
          <View style={cfd.ttRow}>
            <View style={[cfd.ttDot, { backgroundColor: '#666' }]} />
            <Text style={cfd.ttLbl}>Expense</Text>
            <Text style={cfd.ttVal}>₹28,940</Text>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const cfd = StyleSheet.create({
  wrap:      { width: '100%', alignItems: 'center', paddingVertical: 8 },
  ringWrap:  { alignItems: 'center', justifyContent: 'center', width: 170, height: 170 },
  ripple:    { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(168,144,96,0.18)' },
  ring:      {
    width: 120, height: 120, borderRadius: 60, borderWidth: 16,
    borderTopColor: GOLD, borderRightColor: GOLD,
    borderBottomColor: DARK3, borderLeftColor: DARK3,
    alignItems: 'center', justifyContent: 'center',
  },
  ringCenter:{ alignItems: 'center' },
  ringLbl:   { fontSize: 9,  color: '#666' },
  ringVal:   { fontSize: 14, fontWeight: '800', color: '#fff', marginTop: 1 },
  ringHint:  { fontSize: 8,  color: 'rgba(168,144,96,0.6)', marginTop: 1 },
  tooltip:   {
    position: 'absolute', right: -16, top: 8,
    backgroundColor: '#2A2A2A', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: 'rgba(168,144,96,0.25)', minWidth: 140,
  },
  ttRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ttDot:     { width: 8, height: 8, borderRadius: 4 },
  ttLbl:     { flex: 1, fontSize: 10, color: '#aaa' },
  ttVal:     { fontSize: 10, fontWeight: '700', color: '#fff' },
  ttDivider: { height: 1, backgroundColor: DARK3, marginVertical: 6 },
});

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 5 — Voice Search Demo
// ─────────────────────────────────────────────────────────────────────────────
function VoiceDemo() {
  const micScale  = useRef(new Animated.Value(1)).current;
  const pulse1    = useRef(new Animated.Value(1)).current;
  const pulse2    = useRef(new Animated.Value(1)).current;
  const textOp    = useRef(new Animated.Value(0)).current;
  const textY     = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(micScale, { toValue: 1.12, duration: 180, useNativeDriver: true }),
        Animated.parallel([
          Animated.loop(
            Animated.parallel([
              Animated.sequence([
                Animated.timing(pulse1, { toValue: 1.8, duration: 650, useNativeDriver: true }),
                Animated.timing(pulse1, { toValue: 1,   duration: 0,   useNativeDriver: true }),
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
      {/* Search bar */}
      <View style={vd.searchBar}>
        <Ionicons name="search-outline" size={14} color="#555" />
        <Animated.Text style={[vd.searchText, { opacity: textOp, transform: [{ translateY: textY }] }]}>
          Sales Invoice
        </Animated.Text>
        <View style={vd.micWrap}>
          <Animated.View style={[vd.pulseRing, { transform: [{ scale: pulse1 }], opacity: pulse1.interpolate({ inputRange: [1, 1.8], outputRange: [0.35, 0] }) }]} />
          <Animated.View style={[vd.pulseRing, { width: 34, height: 34, borderRadius: 17, transform: [{ scale: pulse2 }], opacity: pulse2.interpolate({ inputRange: [1, 2.1], outputRange: [0.25, 0] }) }]} />
          <Animated.View style={[vd.micCircle, { transform: [{ scale: micScale }] }]}>
            <Ionicons name="mic" size={13} color="#fff" />
          </Animated.View>
        </View>
      </View>

      {/* Listening row */}
      <Animated.View style={[vd.listenRow, { opacity: textOp }]}>
        <View style={vd.listenDot} />
        <Text style={vd.listenTxt}>Listening…</Text>
      </Animated.View>
    </View>
  );
}

const vd = StyleSheet.create({
  wrap:       { width: '100%', paddingHorizontal: 4, alignItems: 'center', gap: 14 },
  searchBar:  {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: DARK2, borderRadius: 30,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: DARK3, gap: 8, width: '100%',
  },
  searchText: { flex: 1, fontSize: 12, color: '#fff', fontWeight: '500' },
  micWrap:    { alignItems: 'center', justifyContent: 'center', width: 28, height: 28 },
  pulseRing:  { position: 'absolute', width: 26, height: 26, borderRadius: 13, backgroundColor: GOLD },
  micCircle:  { width: 26, height: 26, borderRadius: 13, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  listenRow:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  listenDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD },
  listenTxt:  { fontSize: 11, color: 'rgba(168,144,96,0.85)', fontStyle: 'italic' },
});

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 6 — Quick Add Demo
// ─────────────────────────────────────────────────────────────────────────────
function QuickAddDemo() {
  const btnRotate = useRef(new Animated.Value(0)).current;
  const item1     = useRef(new Animated.Value(0)).current;
  const item2     = useRef(new Animated.Value(0)).current;
  const item3     = useRef(new Animated.Value(0)).current;
  const item4     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const items = [item1, item2, item3, item4];
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(btnRotate, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.stagger(80, items.map(a =>
          Animated.spring(a, { toValue: 1, useNativeDriver: true, tension: 90, friction: 8 })
        )),
        Animated.delay(1500),
        Animated.parallel([
          Animated.timing(btnRotate, { toValue: 0, duration: 250, useNativeDriver: true }),
          ...items.map(a => Animated.timing(a, { toValue: 0, duration: 200, useNativeDriver: true })),
        ]),
        Animated.delay(700),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const rotate = btnRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  const ITEMS = [
    { icon: 'receipt-outline',  label: 'Invoice',  color: '#2D7D46' },
    { icon: 'card-outline',     label: 'Voucher',  color: '#7C3AED' },
    { icon: 'cart-outline',     label: 'Purchase', color: '#2563EB' },
    { icon: 'cash-outline',     label: 'Expense',  color: '#DC2626' },
  ];
  const anims = [item1, item2, item3, item4];

  return (
    <View style={qad.wrap}>
      {/* Quick items */}
      <View style={qad.itemsRow}>
        {ITEMS.map((item, i) => (
          <Animated.View
            key={i}
            style={[
              qad.item,
              {
                opacity: anims[i],
                transform: [
                  { scale: anims[i] },
                  { translateY: anims[i].interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
                ],
              },
            ]}
          >
            <View style={[qad.itemIcon, { backgroundColor: item.color + '22' }]}>
              <Ionicons name={item.icon as any} size={20} color={item.color} />
            </View>
            <Text style={qad.itemLabel}>{item.label}</Text>
          </Animated.View>
        ))}
      </View>

      {/* Mini tab bar */}
      <View style={qad.tabBar}>
        <Ionicons name="home"            size={18} color="#444" />
        <Ionicons name="documents-outline" size={18} color="#444" />
        <Animated.View style={[qad.plusBtn, { transform: [{ rotate }] }]}>
          <Ionicons name="add" size={22} color="#fff" />
        </Animated.View>
        <Ionicons name="cube-outline"   size={18} color="#444" />
        <Ionicons name="bar-chart-outline" size={18} color="#444" />
      </View>
    </View>
  );
}

const qad = StyleSheet.create({
  wrap:      { width: '100%', alignItems: 'center', gap: 14 },
  itemsRow:  { flexDirection: 'row', gap: 16, justifyContent: 'center', flexWrap: 'wrap' },
  item:      { alignItems: 'center', gap: 6, width: 64 },
  itemIcon:  { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  itemLabel: { fontSize: 10, fontWeight: '600', color: '#888', textAlign: 'center' },
  tabBar:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: DARK2, borderRadius: 16,
    paddingHorizontal: 20, paddingVertical: 10,
    borderWidth: 1, borderColor: DARK3, width: '100%',
  },
  plusBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center',
    marginTop: -18,
    shadowColor: GOLD, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 10, elevation: 8,
  },
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
  {
    id:    'hero',
    title: 'TallyDekho',
    description: '',
    isHero: true,
  },
  {
    id:    'swipe',
    emoji: '👈',
    title: 'Swipe for Quick Actions',
    description: 'Swipe left on any stock tile to edit, or right to transfer stock — instantly.',
    Demo: SwipeDemo,
  },
  {
    id:    'multiselect',
    emoji: '👆',
    title: 'Long Press to Select',
    description: 'Long press any item to enter multi-select mode. Bulk export as PDF or transfer in one tap.',
    Demo: MultiSelectDemo,
  },
  {
    id:    'cashflow',
    emoji: '📊',
    title: 'Tap Ring for Breakdown',
    description: 'Tap the cashflow ring on Home to instantly reveal your income vs expense split.',
    Demo: CashflowDemo,
  },
  {
    id:    'voice',
    emoji: '🎤',
    title: 'Voice Search',
    description: 'Tap the mic on the home screen and speak — find any transaction, party or invoice.',
    Demo: VoiceDemo,
  },
  {
    id:    'quickadd',
    emoji: '➕',
    title: 'One Tap to Create',
    description: 'Tap the + on the tab bar to instantly create invoices, vouchers or expenses.',
    Demo: QuickAddDemo,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ replay?: string }>();
  const isReplay = params.replay === 'true';

  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideH, setSlideH] = useState(520);
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
    if (!isReplay) {
      await AsyncStorage.setItem(GUIDE_KEY, 'true');
    }
    if (isReplay) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
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
        horizontal
        pagingEnabled
        scrollEventThrottle={16}
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
            <View key={slide.id} style={{ width: SW, height: slideH, paddingTop: 72, paddingHorizontal: 24 }}>
              {/* Demo frame */}
              <View style={s.demoFrame}>
                {/* Gold bar at top of frame */}
                <View style={s.demoFrameBar} />
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
        {/* Dot indicators */}
        <View style={s.dotsRow}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => goToIndex(i)}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <View style={[s.dot, i === currentIndex && s.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity style={s.ctaBtn} onPress={goNext} activeOpacity={0.85}>
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
  container: { flex: 1, backgroundColor: DARK },

  // Skip
  skipWrap: { position: 'absolute', top: 0, right: 16, zIndex: 20 },
  skipBtn:  { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 10 },
  skipTxt:  { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },

  // Demo frame (phone-like card)
  demoFrame: {
    backgroundColor: '#212121',
    borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: 'rgba(168,144,96,0.22)',
    shadowColor: GOLD, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 8,
    overflow: 'hidden',
  },
  demoFrameBar: {
    height: 3, backgroundColor: GOLD, borderRadius: 2,
    marginBottom: 14, width: 40, alignSelf: 'center', opacity: 0.7,
  },

  // Text block
  textBlock: { paddingTop: 22 },
  slideEmoji:{ fontSize: 30, marginBottom: 8 },
  slideTitle:{ fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginBottom: 8, letterSpacing: -0.3 },
  slideDesc: { fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 22 },

  // Bottom nav
  bottomNav: { paddingHorizontal: 24, paddingBottom: 12, paddingTop: 4 },
  dotsRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 16 },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)' },
  dotActive: { width: 22, height: 6, borderRadius: 3, backgroundColor: GOLD },

  // CTA button
  ctaBtn: {
    backgroundColor: GOLD, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: GOLD, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  ctaTxt: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
});
