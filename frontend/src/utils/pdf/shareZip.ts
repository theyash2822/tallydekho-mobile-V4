/**
 * Pack multiple local PDF files into one ZIP and open a single share sheet.
 * Avoids sharing vouchers one-after-another.
 */
import { Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';

export type ZipPdfEntry = { uri: string; name: string };

function safeName(name: string, index: number): string {
  const base = (name || `document-${index + 1}`)
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

export async function sharePdfFilesAsZip(
  entries: ZipPdfEntry[],
  opts: {
    zipName?: string;
    onBeforeShare?: () => void;
  } = {}
): Promise<{ shared: number; failed: number }> {
  if (!entries.length) throw new Error('No PDFs to share.');

  const zip = new JSZip();
  let shared = 0;
  let failed = 0;
  const used = new Set<string>();

  for (let i = 0; i < entries.length; i++) {
    const { uri, name } = entries[i];
    try {
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      let fileName = safeName(name, i);
      if (used.has(fileName)) {
        const stem = fileName.replace(/\.pdf$/i, '');
        fileName = `${stem}-${i + 1}.pdf`;
      }
      used.add(fileName);
      zip.file(fileName, b64, { base64: true });
      shared += 1;
    } catch {
      failed += 1;
    }
  }

  if (shared === 0) throw new Error('Could not read any PDF files.');

  const zipB64 = await zip.generateAsync({ type: 'base64' });
  const zipName = (opts.zipName || `Documents-${shared}.zip`).replace(/[\\/:*?"<>|]+/g, '-');
  const outUri = `${FileSystem.cacheDirectory}${zipName}`;
  await FileSystem.writeAsStringAsync(outUri, zipB64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  opts.onBeforeShare?.();

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(outUri, {
      mimeType: 'application/zip',
      dialogTitle: zipName,
      UTI: 'public.zip-archive',
    });
  } else {
    await Share.share({ url: outUri, title: zipName });
  }

  return { shared, failed };
}
