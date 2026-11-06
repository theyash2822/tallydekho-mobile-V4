/**
 * Export-artifact sweep (SEC-032) — pure part.
 *
 * Every PDF / CSV / JSON the app hands to the share sheet is first written to the
 * app cache (`expo-print` → `<cache>/Print/*.pdf`, our own writers → `<cache>/*.pdf`,
 * `*.csv`, `IRN-*.json`). They are financial documents, so they must not outlive
 * the sign-in. This module decides *which* entries to delete; `tempFiles.ts` binds
 * it to expo-file-system. Kept free of React Native imports so it can be tested
 * with node against a temp directory.
 */

/** Names the sweep deletes: exported documents and the e-invoice signed JSON. */
export const EXPORT_ARTIFACT_RE = /(\.pdf|\.csv|\.json)$|^IRN-/i;

/** Sub-directories of the cache that hold exports (expo-print writes to `Print/`). */
export const EXPORT_SUBDIRS = ['Print'] as const;

export function isExportArtifact(name: string): boolean {
  return EXPORT_ARTIFACT_RE.test(String(name || ''));
}

/** Minimal file-system surface the sweep needs (expo-file-system legacy or node). */
export interface SweepFs {
  /** Entry names (not paths) in `dir`; may throw or return [] if `dir` is missing. */
  readDirectory(dir: string): Promise<string[]>;
  isDirectory(path: string): Promise<boolean>;
  /** Must not throw on a file that is already gone. */
  deleteFile(path: string): Promise<void>;
}

export function joinPath(dir: string, name: string): string {
  return dir.endsWith('/') ? `${dir}${name}` : `${dir}/${name}`;
}

async function sweepOneDir(dir: string, fs: SweepFs, deleted: string[]): Promise<void> {
  let names: string[] = [];
  try {
    names = await fs.readDirectory(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (!isExportArtifact(name)) continue;
    const full = joinPath(dir, name);
    try {
      if (await fs.isDirectory(full)) continue;
      await fs.deleteFile(full);
      deleted.push(full);
    } catch {
      /* best effort: a locked / vanished file must not stop the sweep */
    }
  }
}

/**
 * Deletes export artifacts in `cacheDir` and in each of `EXPORT_SUBDIRS` beneath it.
 * Returns the paths it deleted. Never throws.
 */
export async function sweepExportFiles(cacheDir: string | null | undefined, fs: SweepFs): Promise<string[]> {
  const deleted: string[] = [];
  if (!cacheDir) return deleted;
  await sweepOneDir(cacheDir, fs, deleted);
  for (const sub of EXPORT_SUBDIRS) {
    await sweepOneDir(joinPath(cacheDir, sub), fs, deleted);
  }
  return deleted;
}
