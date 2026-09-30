/**
 * Stock barcode scanner — Jun 11 UI on a full-screen stack route.
 *
 * Forensic (2026-09-25):
 * - Jun 11 design (130px strip frame, spatial filter, torch, zoom, result panel) is correct.
 * - Putting that UI inside RN Modal → black preview on iOS (privacy green, no frames)
 *   and frame collapses to the top (absoluteFill flex overlay inside Modal).
 * - Sales product-scanner works because it is a stack screen — same mount path here.
 * - Expo docs: useCameraPermissions(); only mount CameraView after granted;
 *   use `active` + focus so the native session pauses when unfocused.
 *
 * NOT the purchase-invoice Modal QR scanner and NOT the 240×240 product-scanner frame.
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Linking, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useBarcodeScanner } from '../../src/hooks/useBarcodeScanner';
import { stocksBarcodeScan } from '../../src/utils/stocksBarcodeScan';
import { barcodePicker } from '../../src/utils/barcodePicker';
import { CAMERA_DIAG_BUILD, cameraDiag } from '../../src/utils/cameraDiag';
import { useCameraMountId, useCameraOwnerGate } from '../../src/hooks/useCameraOwnerGate';
import { useAutoTorchAssist } from '../../src/hooks/useAutoTorchAssist';
import { barcodeCenterInFrame } from '../../src/utils/barcodeFrameHit';

const AMBER = '#A89060';
const FRAME_H = 130;
const INSTANCE = 'stocks-barcode';

export default function StockBarcodeScannerScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  // mode=pick: opened from an invoice/order item row — found product goes back to that row
  // via barcodePicker; no details/link actions. Scan pipeline is identical to the Stocks mode.
  const { companyGuid, mode } = useLocalSearchParams<{ companyGuid?: string; mode?: string }>();
  const pickMode = mode === 'pick';
  const [permission, requestPermission] = useCameraPermissions();
  const askedRef = useRef(false);
  const [hostSize, setHostSize] = useState({ w: 0, h: 0 });
  const [cameraSize, setCameraSize] = useState({ w: 0, h: 0 });
  const mountId = useCameraMountId(INSTANCE);
  const { isFocused, appForeground, mountCamera, barcodeListenReady } = useCameraOwnerGate({
    permissionGranted: !!permission?.granted,
    bounds: hostSize,
  });

  const {
    scanned, scanLookingUp, scanResult,
    handleBarcodeScanned, resetScanner, isProcessingRef,
  } = useBarcodeScanner(companyGuid);

  const [zoom, setZoom] = useState(0);
  const [showHelper, setShowHelper] = useState(false);
  const [outOfFrame, setOutOfFrame] = useState(false);
  const [frameScreenBounds, setFrameScreenBounds] = useState<{
    x: number; y: number; width: number; height: number;
  } | null>(null);

  const listening = barcodeListenReady && !scanned && !scanLookingUp;

  const {
    torchOn, toggleTorch, torchAutoOn, resetTorchAssist,
  } = useAutoTorchAssist({
    active: mountCamera && listening && !scanResult?.found,
    delayMs: 2000,
    onAutoOn: () => cameraDiag(mountId, 'torch_auto_on', {
      platform: Platform.OS,
    }, '/stocks/barcode-scanner'),
  });

  const zoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const helperTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomStepRef = useRef(0);
  const frameMeasureRef = useRef<View>(null);
  const cameraMeasureRef = useRef<View>(null);
  const outOfFrameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentDataRef = useRef<{ data: string; time: number }[]>([]);

  // c1cef8f8 — must be stable; iOS AVFoundation re-inits barcode pipeline on new object
  const barcodeScannerSettings = useMemo(
    () => ({
      barcodeTypes: [
        'qr', 'code128', 'code39', 'ean13', 'ean8', 'upc_a', 'upc_e', 'codabar', 'itf14',
      ] as any,
    }),
    [],
  );

  const clearTimers = useCallback(() => {
    if (zoomTimerRef.current) { clearTimeout(zoomTimerRef.current); zoomTimerRef.current = null; }
    if (helperTimerRef.current) { clearTimeout(helperTimerRef.current); helperTimerRef.current = null; }
    if (outOfFrameTimerRef.current) { clearTimeout(outOfFrameTimerRef.current); outOfFrameTimerRef.current = null; }
  }, []);

  // Delay zoom until after first listen window so iOS first aim isn't disrupted
  const startZoomTimer = useCallback(() => {
    zoomStepRef.current = 0;
    const delay = Platform.OS === 'ios' ? 2200 : 1200;
    zoomTimerRef.current = setTimeout(() => {
      zoomStepRef.current = 1;
      setZoom(0.08);
      zoomTimerRef.current = null;
    }, delay);
  }, []);

  const resetScannerUI = useCallback(() => {
    clearTimers();
    setZoom(0);
    resetTorchAssist();
    setShowHelper(false);
    setOutOfFrame(false);
    recentDataRef.current = [];
    zoomStepRef.current = 0;
  }, [clearTimers, resetTorchAssist]);

  // Expo: request once when undetermined (OS dialog). Already granted → no dialog.
  useEffect(() => {
    if (!permission || askedRef.current) return;
    if (permission.granted) return;
    if (permission.canAskAgain === false) return;
    askedRef.current = true;
    requestPermission();
  }, [permission, requestPermission]);

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
    }, '/stocks/barcode-scanner');
  }, [mountId, isFocused, appForeground, permission?.granted, hostSize, cameraSize]);

  // Zoom/helper only while focused + granted (no delayed remount gate)
  useEffect(() => {
    if (!permission?.granted || !isFocused) {
      clearTimers();
      return;
    }
    startZoomTimer();
    helperTimerRef.current = setTimeout(() => setShowHelper(true), 2000);
    return clearTimers;
  }, [permission?.granted, isFocused, startZoomTimer, clearTimers]);

  const handleFrameLayout = useCallback(() => {
    frameMeasureRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) setFrameScreenBounds({ x, y, width, height });
    });
  }, []);

  // June ab4df78f: screen-dp spatial for BOTH platforms; dedup only when bounds invalid.
  const handleBarcodeScanWithBoundsCheck = useCallback(
    (result: { data: string; bounds?: { origin: { x: number; y: number }; size: { width: number; height: number } } }) => {
      if (isProcessingRef.current) return;

      cameraDiag(mountId, 'scan_fire', {
        platform: Platform.OS,
        hasBounds: !!result.bounds,
        bw: result.bounds?.size.width ?? 0,
        bh: result.bounds?.size.height ?? 0,
      }, '/stocks/barcode-scanner');

      const hit = barcodeCenterInFrame({
        bounds: result.bounds,
        frame: frameScreenBounds,
      });

      if (hit === 'outside') {
        setOutOfFrame(true);
        if (outOfFrameTimerRef.current) clearTimeout(outOfFrameTimerRef.current);
        outOfFrameTimerRef.current = setTimeout(() => setOutOfFrame(false), 900);
        cameraDiag(mountId, 'scan_reject_frame', {
          platform: Platform.OS,
          hasBounds: !!result.bounds,
        }, '/stocks/barcode-scanner');
        return;
      }

      if (hit === 'unknown') {
        // Dedup fallback (June): reject only when 2+ different codes in 400ms
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
      if (outOfFrameTimerRef.current) {
        clearTimeout(outOfFrameTimerRef.current);
        outOfFrameTimerRef.current = null;
      }
      recentDataRef.current = [];
      cameraDiag(mountId, 'scan_accept', {
        platform: Platform.OS,
        hit,
      }, '/stocks/barcode-scanner');
      handleBarcodeScanned(result);
    },
    [frameScreenBounds, handleBarcodeScanned, isProcessingRef, mountId],
  );

  const handleScanAgain = useCallback(() => {
    resetScanner();
    resetScannerUI();
    startZoomTimer();
    helperTimerRef.current = setTimeout(() => setShowHelper(true), 2000);
  }, [resetScanner, resetScannerUI, startZoomTimer]);

  const handleCancel = useCallback(() => {
    stocksBarcodeScan.clear();
    if (pickMode) barcodePicker.clear();
    resetScanner();
    resetScannerUI();
    router.back();
  }, [resetScanner, resetScannerUI, router, pickMode]);

  const pickResolvedRef = useRef(false);
  useEffect(() => {
    if (!pickMode || pickResolvedRef.current) return;
    if (!scanResult?.found || !scanResult.item || scanLookingUp) return;
    pickResolvedRef.current = true;
    const item = scanResult.item as any;
    barcodePicker.resolve({
      productName: item.name || item.stockGuid || item.displayName,
      unit: item.unit,
    });
    router.back();
  }, [pickMode, scanResult, scanLookingUp, router]);

  const askPermission = useCallback(async () => {
    const result = await requestPermission();
    if (!result?.granted) {
      if (result?.canAskAgain === false) {
        Alert.alert(
          t('screens.stocksBarcodeScanner.accessDeniedTitle'),
          t('screens.stocksBarcodeScanner.accessDeniedMsg'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('screens.stocksBarcodeScanner.openSettings'), onPress: () => Linking.openSettings() },
          ],
        );
      } else {
        Alert.alert(t('screens.stocksBarcodeScanner.permissionDenied'), t('screens.stocksBarcodeScanner.cameraRequired'));
      }
    }
  }, [requestPermission, t]);

  if (!permission) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={s.permSafe}>
        <View style={s.permWrap}>
          <Ionicons name="camera-outline" size={64} color={COLORS.textTertiary} />
          <Text style={s.permTitle}>{t('screens.stocksBarcodeScanner.accessRequired')}</Text>
          <Text style={s.permSub}>
            {t('screens.stocksBarcodeScanner.permSub')}
            {permission.canAskAgain === false
              ? t('screens.stocksBarcodeScanner.permDeniedHint')
              : t('screens.stocksBarcodeScanner.permPromptHint')}
          </Text>
          {permission.canAskAgain !== false ? (
            <TouchableOpacity style={s.permBtn} onPress={askPermission} activeOpacity={0.85}>
              <Text style={s.permBtnTxt}>{t('screens.stocksBarcodeScanner.grantAccess')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.permBtn} onPress={() => Linking.openSettings()} activeOpacity={0.85}>
              <Text style={s.permBtnTxt}>{t('screens.stocksBarcodeScanner.openSettings')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleCancel} style={s.cancelLink} activeOpacity={0.7}>
            <Text style={s.cancelTxt}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Own the camera only while focused + foreground + full-screen host measured
  return (
    <View
      style={s.root}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setHostSize({ w: width, h: height });
        cameraDiag(mountId, 'host_layout', {
          width, height, platform: Platform.OS, frameH: FRAME_H,
        }, '/stocks/barcode-scanner');
      }}
    >
      {/* Full-screen CameraView (measured pixels). Brackets + spatial filter only. */}
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
              }, '/stocks/barcode-scanner');
            }}
            onCameraReady={() => cameraDiag(mountId, 'onCameraReady', {
              platform: Platform.OS, hostW: hostSize.w, hostH: hostSize.h,
              cameraW: cameraSize.w, cameraH: cameraSize.h,
            }, '/stocks/barcode-scanner')}
            onMountError={(ev) => cameraDiag(mountId, 'onMountError', {
              message: ev?.message ?? 'unknown',
              platform: Platform.OS,
            }, '/stocks/barcode-scanner')}
          />
        ) : (
          <View style={s.camBoot}>
            <ActivityIndicator color="#fff" />
          </View>
        )}
      </View>

      {/* Jun 11 overlay — transparent center strip; spatial filter accepts only in-bracket codes */}
      <View style={s.scanOverlay} pointerEvents="box-none">
        <TouchableOpacity style={s.torchBtn} onPress={toggleTorch} activeOpacity={0.8}>
          <Ionicons name={torchOn ? 'flash' : 'flash-outline'} size={22} color={torchOn ? '#FFD700' : '#fff'} />
        </TouchableOpacity>

        <View style={s.scanDimTop} pointerEvents="none">
          <Text style={s.scanTopHint}>{t('screens.stocksBarcodeScanner.aimHint')}</Text>
        </View>

        <View style={s.scanMiddleRow} pointerEvents="none">
          <View style={s.scanDimSide} />
          <View
            ref={frameMeasureRef}
            style={s.scanFrame}
            onLayout={handleFrameLayout}
          >
            <View style={[s.corner, s.cornerTL]} />
            <View style={[s.corner, s.cornerTR]} />
            <View style={[s.corner, s.cornerBL]} />
            <View style={[s.corner, s.cornerBR]} />
          </View>
          <View style={s.scanDimSide} />
        </View>

        <View style={s.scanDimBottom} pointerEvents="box-none">
          {!scanLookingUp && !scanResult && (
            <>
              {outOfFrame ? (
                <Text style={[s.scanHint, s.scanHintOutOfFrame]}>{t('screens.stocksBarcodeScanner.moveIntoFrame')}</Text>
              ) : torchAutoOn ? (
                <Text style={s.scanHelperText}>{t('screens.stocksBarcodeScanner.flashOn')}</Text>
              ) : showHelper ? (
                <Text style={s.scanHelperText}>{t('screens.stocksBarcodeScanner.moveCloser')}</Text>
              ) : (
                <Text style={s.scanHint}>{t('screens.stocksBarcodeScanner.holdSteady')}</Text>
              )}
              <TouchableOpacity style={s.scanCloseBtn} onPress={handleCancel} activeOpacity={0.8}>
                <Text style={s.scanCloseBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </>
          )}

          {scanLookingUp && (
            <View style={s.scanResultPanel}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={s.scanResultLooking}>{t('screens.stocksBarcodeScanner.lookingUp')}</Text>
            </View>
          )}

          {scanResult?.found && scanResult.item && pickMode && (
            <View style={s.scanResultPanel}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={s.scanResultName} numberOfLines={2}>{scanResult.item.displayName}</Text>
            </View>
          )}

          {scanResult?.found && scanResult.item && !pickMode && (
            <View style={s.scanResultPanel}>
              <View style={s.scanResultBadgeFound}>
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                <Text style={s.scanResultBadgeText}>{t('screens.stocksBarcodeScanner.productFound')}</Text>
              </View>
              <Text style={s.scanResultName} numberOfLines={2}>{scanResult.item.displayName}</Text>
              <Text style={s.scanResultBarcode}>{scanResult.barcode}</Text>
              <View style={s.scanResultMeta}>
                <View style={s.scanResultMetaItem}>
                  <Text style={s.scanResultMetaLabel}>{t('pdf.qty')}</Text>
                  <Text style={s.scanResultMetaValue}>
                    {Math.round(scanResult.item.currentQty).toLocaleString()} {scanResult.item.unit}
                  </Text>
                </View>
                {scanResult.item.sku ? (
                  <View style={s.scanResultMetaItem}>
                    <Text style={s.scanResultMetaLabel}>{t('screens.stocksBarcodeScanner.sku')}</Text>
                    <Text style={s.scanResultMetaValue} numberOfLines={1}>{scanResult.item.sku}</Text>
                  </View>
                ) : null}
                {scanResult.item.groupName ? (
                  <View style={s.scanResultMetaItem}>
                    <Text style={s.scanResultMetaLabel}>{t('screens.stocksBarcodeScanner.group')}</Text>
                    <Text style={s.scanResultMetaValue} numberOfLines={1}>{scanResult.item.groupName}</Text>
                  </View>
                ) : null}
              </View>
              <View style={s.scanResultActions}>
                <TouchableOpacity
                  style={s.scanResultBtnPrimary}
                  activeOpacity={0.85}
                  onPress={() => {
                    const id = scanResult.item?.stockGuid;
                    // Clear bridge so barcodes list doesn't also navigate / race with back()
                    stocksBarcodeScan.clear();
                    if (id) {
                      // replace scanner → detail (avoid push+back race that left user on scanner)
                      router.replace(`/stocks/item-detail?id=${encodeURIComponent(id)}` as any);
                    } else {
                      router.back();
                    }
                  }}
                >
                  <Ionicons name="open-outline" size={16} color="#fff" />
                  <Text style={s.scanResultBtnPrimaryText}>{t('screens.stocksBarcodeScanner.viewDetails')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.scanResultBtnSecondary} activeOpacity={0.8} onPress={handleScanAgain}>
                  <Ionicons name="scan-outline" size={16} color="#fff" />
                  <Text style={s.scanResultBtnSecondaryText}>{t('screens.stocksBarcodeScanner.scanAgain')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {scanResult && !scanResult.found && (
            <View style={s.scanResultPanel}>
              <View style={s.scanResultBadgeNotFound}>
                <Ionicons name="help-circle" size={16} color="#fff" />
                <Text style={s.scanResultBadgeText}>{t('screens.stocksBarcodeScanner.notLinked')}</Text>
              </View>
              <Text style={s.scanResultName}>{t('screens.stocksBarcodeScanner.notLinkedMsg')}</Text>
              <Text style={s.scanResultBarcode}>{scanResult.barcode}</Text>
              {pickMode ? (
                <View style={s.scanResultActions}>
                  <TouchableOpacity style={s.scanResultBtnPrimary} activeOpacity={0.85} onPress={handleScanAgain}>
                    <Ionicons name="scan-outline" size={16} color="#fff" />
                    <Text style={s.scanResultBtnPrimaryText}>{t('screens.stocksBarcodeScanner.scanAgain')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.scanResultBtnSecondary} activeOpacity={0.8} onPress={handleCancel}>
                    <Ionicons name="close" size={16} color="#fff" />
                    <Text style={s.scanResultBtnSecondaryText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
              <View style={s.scanResultActions}>
                <TouchableOpacity
                  style={s.scanResultBtnPrimary}
                  activeOpacity={0.85}
                  onPress={() => {
                    const barcode = scanResult.barcode;
                    // Back to list first, then open link sheet (avoid race with scanner still focused)
                    router.back();
                    setTimeout(() => {
                      stocksBarcodeScan.resolve({ found: false, barcode });
                    }, 120);
                  }}
                >
                  <Ionicons name="link-outline" size={16} color="#fff" />
                  <Text style={s.scanResultBtnPrimaryText}>{t('screens.stocksBarcodeScanner.linkToProduct')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.scanResultBtnSecondary} activeOpacity={0.8} onPress={handleScanAgain}>
                  <Ionicons name="scan-outline" size={16} color="#fff" />
                  <Text style={s.scanResultBtnSecondaryText}>{t('screens.stocksBarcodeScanner.scanAgain')}</Text>
                </TouchableOpacity>
              </View>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  permSafe: { flex: 1, backgroundColor: COLORS.pageBg },
  permWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: SPACING.xl },
  permTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  permSub: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  permBtn: {
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl, paddingVertical: 14, marginTop: 8,
  },
  permBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
  cancelLink: { marginTop: 4 },
  cancelTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary, fontWeight: '600' },

  // Jun 11 overlay on stack: flex:1 (NOT absoluteFill — that pins the 130 strip to the top)
  scanOverlay: { flex: 1 },
  torchBtn: {
    position: 'absolute', top: 54, right: 20, zIndex: 10,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  scanDimTop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 10,
  },
  scanTopHint: { color: 'rgba(255,255,255,0.6)', fontSize: 11, letterSpacing: 0.3 },
  scanMiddleRow: { flexDirection: 'row', height: FRAME_H, flexGrow: 0, flexShrink: 0 },
  scanDimSide: { width: 12, backgroundColor: 'rgba(0,0,0,0.45)' },
  scanFrame: { flex: 1, height: FRAME_H, position: 'relative', backgroundColor: 'transparent' },
  camBoot: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000', alignItems: 'center', justifyContent: 'center',
  },
  corner: { position: 'absolute', width: 24, height: 24 },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#fff', borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#fff', borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#fff', borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#fff', borderBottomRightRadius: 4 },
  scanDimBottom: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 60, gap: 20,
  },
  scanHint: { color: 'rgba(255,255,255,0.7)', fontSize: TYPOGRAPHY.sm, textAlign: 'center' },
  scanHintOutOfFrame: { color: '#FF6B35', fontWeight: '700', fontSize: TYPOGRAPHY.sm },
  scanHelperText: { color: '#FFD700', fontSize: 13, fontWeight: '600', textAlign: 'center', paddingHorizontal: 20 },
  scanCloseBtn: {
    paddingHorizontal: 36, paddingVertical: 13,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  scanCloseBtnText: { color: '#fff', fontSize: TYPOGRAPHY.sm, fontWeight: '700' },

  scanResultPanel: { width: '100%', paddingHorizontal: 20, paddingVertical: 20, alignItems: 'center', gap: 10 },
  scanResultLooking: { color: 'rgba(255,255,255,0.8)', fontSize: TYPOGRAPHY.sm, marginTop: 8 },
  scanResultBadgeFound: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 5, backgroundColor: '#22c55e', borderRadius: RADIUS.full,
  },
  scanResultBadgeNotFound: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 5, backgroundColor: AMBER, borderRadius: RADIUS.full,
  },
  scanResultBadgeText: { color: '#fff', fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  scanResultName: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: '#fff', textAlign: 'center', paddingHorizontal: 10 },
  scanResultBarcode: {
    fontSize: TYPOGRAPHY.xs, color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.5, fontFamily: 'monospace',
  },
  scanResultMeta: { flexDirection: 'row', gap: 16, marginTop: 2 },
  scanResultMetaItem: { alignItems: 'center', gap: 2 },
  scanResultMetaLabel: {
    fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5,
  },
  scanResultMetaValue: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: '#fff', maxWidth: 100 },
  scanResultActions: { flexDirection: 'row', gap: 10, marginTop: 4, width: '100%' },
  scanResultBtnPrimary: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 13, borderRadius: RADIUS.full, backgroundColor: COLORS.brandPrimary,
  },
  scanResultBtnPrimaryText: { color: '#fff', fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
  scanResultBtnSecondary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 13, borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  scanResultBtnSecondaryText: { color: '#fff', fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
});
