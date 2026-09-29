/**
 * product-scanner.tsx
 *
 * Full-screen barcode scanner for product lookup inside invoice creation.
 * Uses the same scanner stack as app/stocks/barcodes.tsx:
 *   - useBarcodeScanner hook (lookup + vibrate)
 *   - Frame constraint (spatial filter, both iOS + Android)
 *   - Auto-zoom (0 → 0.08 → 0.18 over 1.6s)
 *   - Torch toggle
 *   - Dedup fallback for first-frame zero-bounds
 *
 * On successful scan: calls barcodePicker.resolve() then router.back().
 * On cancel / not found: stays open so user can scan again.
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Linking, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useBarcodeScanner } from '../../src/hooks/useBarcodeScanner';
import { barcodePicker } from '../../src/utils/barcodePicker';
import { CAMERA_DIAG_BUILD, cameraDiag } from '../../src/utils/cameraDiag';
import { useCameraMountId, useCameraOwnerGate } from '../../src/hooks/useCameraOwnerGate';
import { useAutoTorchAssist } from '../../src/hooks/useAutoTorchAssist';
import { barcodeCenterInFrame } from '../../src/utils/barcodeFrameHit';

/** Product barcode scan window — locked square (not Jun 11 strip). */
const FRAME_SIZE = 240;

export default function ProductScannerScreen() {
  const router = useRouter();
  const { companyGuid } = useLocalSearchParams<{ companyGuid?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [hostSize, setHostSize] = useState({ w: 0, h: 0 });
  const [cameraSize, setCameraSize] = useState({ w: 0, h: 0 });
  const mountId = useCameraMountId('sales-product');
  const { isFocused, appForeground, mountCamera, barcodeListenReady } = useCameraOwnerGate({
    permissionGranted: !!permission?.granted,
    bounds: hostSize,
  });

  const {
    scanned, scanLookingUp, scanResult,
    handleBarcodeScanned, resetScanner, isProcessingRef,
  } = useBarcodeScanner(companyGuid);

  const [zoom, setZoom] = useState(0);
  const zoomTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomStepRef    = useRef(0);

  const [outOfFrame, setOutOfFrame]               = useState(false);
  const [frameScreenBounds, setFrameScreenBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const frameMeasureRef    = useRef<View>(null);
  const cameraMeasureRef   = useRef<View>(null);
  const outOfFrameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentDataRef      = useRef<{ data: string; time: number }[]>([]);

  const listening = barcodeListenReady && !scanned && !scanLookingUp;

  const {
    torchOn, toggleTorch, torchAutoOn, resetTorchAssist,
  } = useAutoTorchAssist({
    active: mountCamera && listening && !scanResult?.found,
    delayMs: 2000,
    onAutoOn: () => cameraDiag(mountId, 'torch_auto_on', {
      platform: Platform.OS,
    }, '/sales/product-scanner'),
  });

  // c1cef8f8 — stable settings; iOS re-inits barcode pipeline on new object
  const barcodeScannerSettings = useMemo(
    () => ({
      barcodeTypes: [
        'qr', 'code128', 'code39', 'ean13', 'ean8', 'upc_a', 'upc_e', 'codabar', 'itf14',
      ] as any,
    }),
    [],
  );

  // Delay zoom until after first listen window (esp. iOS)
  const startZoomTimer = useCallback(() => {
    zoomStepRef.current = 0;
    const delay = Platform.OS === 'ios' ? 2200 : 1200;
    zoomTimerRef.current = setTimeout(() => {
      zoomStepRef.current = 1;
      setZoom(0.08);
      zoomTimerRef.current = null;
    }, delay);
  }, []);

  const clearTimers = useCallback(() => {
    if (zoomTimerRef.current)       { clearTimeout(zoomTimerRef.current);       zoomTimerRef.current       = null; }
    if (outOfFrameTimerRef.current) { clearTimeout(outOfFrameTimerRef.current); outOfFrameTimerRef.current = null; }
  }, []);

  useEffect(() => {
    startZoomTimer();
    return clearTimers;
  }, [startZoomTimer, clearTimers]);

  useEffect(() => {
    cameraDiag(mountId, 'screen', {
      build: CAMERA_DIAG_BUILD,
      focused: isFocused,
      appForeground,
      granted: !!permission?.granted,
      platform: Platform.OS,
      hostW: hostSize.w,
      hostH: hostSize.h,
      cameraW: cameraSize.w,
      cameraH: cameraSize.h,
    }, '/sales/product-scanner');
  }, [mountId, isFocused, appForeground, permission?.granted, hostSize, cameraSize]);

  const handleFrameLayout = useCallback(() => {
    frameMeasureRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) setFrameScreenBounds({ x, y, width, height });
    });
  }, []);

  // June ab4df78f: screen-dp spatial for BOTH platforms; dedup only when bounds invalid
  const handleBarcodeScanWithBoundsCheck = useCallback(
    (result: { data: string; bounds?: { origin: { x: number; y: number }; size: { width: number; height: number } } }) => {
      if (isProcessingRef.current) return;

      cameraDiag(mountId, 'scan_fire', {
        platform: Platform.OS,
        hasBounds: !!result.bounds,
        bw: result.bounds?.size.width ?? 0,
        bh: result.bounds?.size.height ?? 0,
      }, '/sales/product-scanner');

      const hit = barcodeCenterInFrame({
        bounds: result.bounds,
        frame: frameScreenBounds,
      });

      if (hit === 'outside') {
        setOutOfFrame(true);
        if (outOfFrameTimerRef.current) clearTimeout(outOfFrameTimerRef.current);
        outOfFrameTimerRef.current = setTimeout(() => setOutOfFrame(false), 900);
        return;
      }

      if (hit === 'unknown') {
        const now = Date.now();
        recentDataRef.current = recentDataRef.current.filter(r => now - r.time < 400);
        recentDataRef.current.push({ data: result.data, time: now });
        const uniqueCodes = new Set(recentDataRef.current.map(r => r.data));
        if (uniqueCodes.size > 1) {
          setOutOfFrame(true);
          if (outOfFrameTimerRef.current) clearTimeout(outOfFrameTimerRef.current);
          outOfFrameTimerRef.current = setTimeout(() => setOutOfFrame(false), 900);
          return;
        }
      }

      setOutOfFrame(false);
      if (outOfFrameTimerRef.current) { clearTimeout(outOfFrameTimerRef.current); outOfFrameTimerRef.current = null; }
      recentDataRef.current = [];
      handleBarcodeScanned(result);
    },
    [frameScreenBounds, handleBarcodeScanned, isProcessingRef, mountId],
  );

  // ── When scan resolves → hand off to barcodePicker ─────────────────────────
  useEffect(() => {
    if (!scanResult || scanLookingUp) return;
    if (scanResult.found && scanResult.item) {
      const item = scanResult.item as any;
      barcodePicker.resolve({
        productName: item.name || item.stockGuid || item.displayName,
        unit: item.unit,
      });
      router.back();
    }
    // not found: stay open, let user tap "Scan Again"
  }, [scanResult, scanLookingUp, router]);

  const handleScanAgain = useCallback(() => {
    resetScanner();
    clearTimers();
    setZoom(0);
    resetTorchAssist();
    setOutOfFrame(false);
    recentDataRef.current = [];
    startZoomTimer();
  }, [resetScanner, clearTimers, startZoomTimer, resetTorchAssist]);

  const handleCancel = useCallback(() => {
    barcodePicker.clear();
    clearTimers();
    router.back();
  }, [clearTimers, router]);

  // ── Permission wall ─────────────────────────────────────────────────────────
  if (!permission?.granted) {
    return (
      <SafeAreaView style={s.permSafe}>
        <View style={s.permWrap}>
          <Ionicons name="camera-outline" size={64} color={COLORS.textTertiary} />
          <Text style={s.permTitle}>Camera Access Required</Text>
          <Text style={s.permSub}>TallyDekho needs camera access to scan barcodes.</Text>
          {permission?.canAskAgain !== false ? (
            <TouchableOpacity style={s.permBtn} onPress={requestPermission} activeOpacity={0.85}>
              <Text style={s.permBtnTxt}>Grant Camera Access</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.permBtn} onPress={() => Linking.openSettings()} activeOpacity={0.85}>
              <Text style={s.permBtnTxt}>Open Settings</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleCancel} style={s.cancelLink} activeOpacity={0.7}>
            <Text style={s.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View
      style={s.root}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setHostSize({ w: width, h: height });
        cameraDiag(mountId, 'host_layout', {
          width, height, platform: Platform.OS, frameSize: FRAME_SIZE,
        }, '/sales/product-scanner');
      }}
    >
      {/* Full-screen CameraView — 240 frame is guide + spatial filter only */}
      <View
        ref={cameraMeasureRef}
        collapsable={false}
        style={hostSize.w > 0 && hostSize.h > 0
          ? { width: hostSize.w, height: hostSize.h, position: 'absolute', top: 0, left: 0 }
          : StyleSheet.absoluteFillObject}
      >
        {mountCamera ? (
          <CameraView
            style={{ width: hostSize.w, height: hostSize.h }}
            facing="back"
            zoom={zoom}
            enableTorch={torchOn}
            active={isFocused && appForeground}
            barcodeScannerSettings={barcodeScannerSettings}
            onBarcodeScanned={listening ? handleBarcodeScanWithBoundsCheck : undefined}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              setCameraSize({ w: width, h: height });
              cameraDiag(mountId, 'camera_layout', {
                width, height, platform: Platform.OS, hostW: hostSize.w, hostH: hostSize.h,
              }, '/sales/product-scanner');
            }}
            onCameraReady={() => cameraDiag(mountId, 'onCameraReady', {
              platform: Platform.OS, hostW: hostSize.w, hostH: hostSize.h,
              cameraW: cameraSize.w, cameraH: cameraSize.h,
            }, '/sales/product-scanner')}
            onMountError={(ev) => cameraDiag(mountId, 'onMountError', {
              message: ev?.message ?? 'unknown',
              platform: Platform.OS,
            }, '/sales/product-scanner')}
          />
        ) : null}
      </View>

      {/* ── Top header ── */}
      <SafeAreaView style={s.headerWrap} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity style={s.iconBtn} onPress={handleCancel} activeOpacity={0.8}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Scan Product Barcode</Text>
          <TouchableOpacity style={[s.iconBtn, torchOn && s.torchActive]} onPress={toggleTorch} activeOpacity={0.8}>
            <Ionicons name={torchOn ? 'flashlight' : 'flashlight-outline'} size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── Dark vignette + transparent 240 frame (no CameraView nested here) ── */}
      <View style={s.vignette} pointerEvents="none">
        <View style={s.vigTop} />
        <View style={s.vigMid}>
          <View style={s.vigSide} />
          <View
            ref={frameMeasureRef}
            onLayout={handleFrameLayout}
            style={[s.frame, outOfFrame && s.frameWarn]}
          >
            <View style={[s.corner, s.cornerTL]} />
            <View style={[s.corner, s.cornerTR]} />
            <View style={[s.corner, s.cornerBL]} />
            <View style={[s.corner, s.cornerBR]} />
          </View>
          <View style={s.vigSide} />
        </View>
        <View style={s.vigBottom} />
      </View>

      {/* ── Hints / Status ── */}
      <View style={s.hintArea} pointerEvents="none">
        {outOfFrame && (
          <View style={s.hintBadge}>
            <Text style={s.hintTxt}>📦 Move barcode into frame</Text>
          </View>
        )}
        {!scanned && !outOfFrame && torchAutoOn && (
          <Text style={s.prompt}>Flash on — hold barcode in the frame</Text>
        )}
        {!scanned && !outOfFrame && !torchAutoOn && (
          <Text style={s.prompt}>Point camera at product barcode</Text>
        )}
      </View>

      {/* ── Lookup spinner overlay ── */}
      {scanLookingUp && (
        <View style={s.lookupOverlay} pointerEvents="none">
          <View style={s.lookupCard}>
            <ActivityIndicator size="small" color={COLORS.brandPrimary} />
            <Text style={s.lookupTxt}>Looking up product…</Text>
          </View>
        </View>
      )}

      {/* ── Not-found result ── */}
      {scanResult && !scanLookingUp && !scanResult.found && (
        <View style={s.resultOverlay}>
          <View style={s.resultCard}>
            <Ionicons name="close-circle" size={32} color={COLORS.negative} />
            <Text style={s.resultTitle}>Product Not Found</Text>
            <Text style={s.resultSub}>No product is linked to barcode:{'\n'}{scanResult.barcode}</Text>
            <TouchableOpacity style={s.scanAgainBtn} onPress={handleScanAgain} activeOpacity={0.85}>
              <Ionicons name="barcode-outline" size={16} color={COLORS.white} />
              <Text style={s.scanAgainTxt}>Scan Again</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCancel} style={s.cancelLink2} activeOpacity={0.7}>
              <Text style={s.cancelTxt2}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#000' },
  permSafe:{ flex: 1, backgroundColor: COLORS.pageBg },
  permWrap:{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: SPACING.xl },
  permTitle:{ fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  permSub: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  permBtn: { backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.xl, paddingVertical: 14, marginTop: 8 },
  permBtnTxt:{ fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  cancelLink:{ marginTop: 4 },
  cancelTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary, fontWeight: '600' },

  // Header
  headerWrap:{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5 },
  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 12, gap: 12 },
  headerTitle:{ flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff', textAlign: 'center' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  torchActive:{ backgroundColor: 'rgba(255,200,0,0.35)' },

  // Vignette — flex:1 on stack (absoluteFill pins frame to top). Camera is full-screen underneath.
  vignette:{ flex: 1 },
  vigTop:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  vigMid:  { flexDirection: 'row', height: FRAME_SIZE, flexGrow: 0, flexShrink: 0 },
  vigSide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  vigBottom:{ flex: 1.5, backgroundColor: 'rgba(0,0,0,0.55)' },
  frame:   { width: FRAME_SIZE, height: FRAME_SIZE, borderRadius: 4, backgroundColor: 'transparent' },
  frameWarn:{ opacity: 0.6 },

  // Corner brackets
  corner: { position: 'absolute', width: 24, height: 24, borderColor: COLORS.brandPrimary, borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },

  // Hints
  hintArea:{ position: 'absolute', bottom: 140, left: 0, right: 0, alignItems: 'center', gap: 10 },
  hintBadge:{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(180,90,0,0.85)', borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 8 },
  hintTxt: { fontSize: TYPOGRAPHY.sm, color: '#fff', fontWeight: '700' },
  prompt:  { fontSize: TYPOGRAPHY.sm, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },

  // Lookup overlay
  lookupOverlay:{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  lookupCard:{ flexDirection: 'row', gap: 12, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: RADIUS.lg, paddingHorizontal: 20, paddingVertical: 14 },
  lookupTxt: { fontSize: TYPOGRAPHY.base, color: '#fff', fontWeight: '600' },

  // Not-found result overlay
  resultOverlay:{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  resultCard:{ backgroundColor: COLORS.cardBg, borderRadius: 20, padding: 28, width: '100%', alignItems: 'center', gap: 10 },
  resultTitle:{ fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  resultSub: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  scanAgainBtn:{ flexDirection: 'row', gap: 8, marginTop: 8, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingHorizontal: 24, paddingVertical: 12 },
  scanAgainTxt:{ fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  cancelLink2: { marginTop: 4 },
  cancelTxt2:  { fontSize: TYPOGRAPHY.base, color: COLORS.textTertiary, fontWeight: '600' },
});
