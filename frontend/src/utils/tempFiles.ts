/**
 * Temporary export files (SEC-032).
 *
 * - `deleteTempFile(uri)`: remove one generated PDF/CSV/JSON once the share sheet
 *   or print dialog has closed. Best effort, never throws.
 * - `sweepExportCache()`: on sign-out, remove every export left in the app cache
 *   (`*.pdf`, `*.csv`, `*.json`, `IRN-*`, including expo-print's `Print/` folder).
 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { sweepExportFiles, type SweepFs } from './exportCacheSweep';

const expoFs: SweepFs = {
  readDirectory: (dir) => FileSystem.readDirectoryAsync(dir),
  isDirectory: async (path) => {
    const info = await FileSystem.getInfoAsync(path);
    return !!info.exists && !!info.isDirectory;
  },
  deleteFile: (path) => FileSystem.deleteAsync(path, { idempotent: true }),
};

/** Delete a generated file after it has been shared / printed. Safe to call twice. */
export async function deleteTempFile(uri: string | null | undefined): Promise<void> {
  if (!uri || Platform.OS === 'web') return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    /* already gone, or a content:// URI we do not own */
  }
}

/** Run `fn`, then delete `uri` whether or not `fn` threw. */
export async function withTempFile<T>(uri: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } finally {
    await deleteTempFile(uri);
  }
}

/** Sign-out sweep of the export cache. Returns deleted paths; never throws. */
export async function sweepExportCache(): Promise<string[]> {
  if (Platform.OS === 'web') return [];
  const dir = FileSystem.cacheDirectory;
  if (!dir) return [];
  try {
    return await sweepExportFiles(dir, expoFs);
  } catch {
    return [];
  }
}
