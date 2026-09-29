/**
 * Auto-torch assist for barcode scanners (iOS AVFoundation needs more light;
 * Android also benefits in low light).
 *
 * After `delayMs` with camera live and no successful accept, turn torch on.
 * Manual off during a session suppresses further auto-on until reset.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export function useAutoTorchAssist(opts: {
  /** Camera is mounted and actively scanning */
  active: boolean;
  delayMs?: number;
  onAutoOn?: () => void;
}): {
  torchOn: boolean;
  setTorchOn: (next: boolean | ((prev: boolean) => boolean)) => void;
  toggleTorch: () => void;
  /** True when torch was turned on by the assist (not manual) */
  torchAutoOn: boolean;
  /** Call on Scan Again / leave so auto can run again */
  resetTorchAssist: () => void;
} {
  const delayMs = opts.delayMs ?? 2000;
  const [torchOn, setTorchOnState] = useState(false);
  const [torchAutoOn, setTorchAutoOn] = useState(false);
  const userSuppressedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onAutoOnRef = useRef(opts.onAutoOn);
  onAutoOnRef.current = opts.onAutoOn;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const setTorchOn = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    setTorchOnState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      if (value) {
        userSuppressedRef.current = false;
      } else {
        // Manual / programmatic off — don't auto-reenable this session
        userSuppressedRef.current = true;
        setTorchAutoOn(false);
      }
      return value;
    });
  }, []);

  const toggleTorch = useCallback(() => {
    setTorchOnState((prev) => {
      const value = !prev;
      if (value) {
        userSuppressedRef.current = false;
        setTorchAutoOn(false);
      } else {
        userSuppressedRef.current = true;
        setTorchAutoOn(false);
      }
      return value;
    });
  }, []);

  const resetTorchAssist = useCallback(() => {
    clearTimer();
    userSuppressedRef.current = false;
    setTorchOnState(false);
    setTorchAutoOn(false);
  }, [clearTimer]);

  useEffect(() => {
    clearTimer();
    if (!opts.active || torchOn || userSuppressedRef.current) return;

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (userSuppressedRef.current) return;
      setTorchOnState(true);
      setTorchAutoOn(true);
      onAutoOnRef.current?.();
    }, delayMs);

    return clearTimer;
  }, [opts.active, torchOn, delayMs, clearTimer]);

  return { torchOn, setTorchOn, toggleTorch, torchAutoOn, resetTorchAssist };
}
