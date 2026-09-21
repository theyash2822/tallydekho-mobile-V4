/**
 * Fail-closed deep-link / route guard (Wave 2).
 * While workspace caps are loading/unknown → deny (no content).
 * Once known and missing → toast + replace/back to home.
 */
import React, { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useWorkspace } from '../context/WorkspaceContext';

type Options = {
  /** Fallback when router cannot go back. Default: home tabs. */
  href?: string;
  message?: string;
};

export function useRequireCapability(capability: string, opts?: Options): boolean {
  const { hasCapability, loading } = useWorkspace();
  const router = useRouter();
  const redirected = useRef(false);
  // Once granted for this mount, stay true across background workspace re-lists.
  // Without this, refreshWorkspaces → loading=true remounts every create-voucher form.
  const grantedOnce = useRef(false);
  if (!loading && hasCapability(capability)) {
    grantedOnce.current = true;
  }
  const allowed = grantedOnce.current || (!loading && hasCapability(capability));

  useEffect(() => {
    if (loading || redirected.current || grantedOnce.current) return;
    if (hasCapability(capability)) return;
    redirected.current = true;
    Toast.show({
      type: 'error',
      text1: 'Not allowed',
      text2: opts?.message || 'You do not have access to this screen',
    });
    try {
      if (typeof (router as any).canGoBack === 'function' && (router as any).canGoBack()) {
        router.back();
      } else {
        router.replace((opts?.href || '/(tabs)') as any);
      }
    } catch {
      router.replace((opts?.href || '/(tabs)') as any);
    }
  }, [loading, capability, hasCapability, router, opts?.href, opts?.message]);

  return allowed;
}

interface Props extends Options {
  capability: string;
  children: React.ReactNode;
}

/** Wrap a screen body — renders nothing while denied/loading. */
export default function RequireCapability({ capability, children, href, message }: Props) {
  const allowed = useRequireCapability(capability, { href, message });
  if (!allowed) return null;
  return <>{children}</>;
}
