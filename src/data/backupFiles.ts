import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { LocalDate } from '@/domain/types';
import { assertBackupWithinSizeLimit, MAX_BACKUP_BYTES } from './backup';

export function makeBackupFilename(today: LocalDate): string {
  return `khoroch-backup-${today}.json`;
}

export async function shareBackupFile(jsonContent: string, filename: string): Promise<void> {
  if (Platform.OS === 'web') {
    const doc = (globalThis as { document?: Document }).document;
    const urlApi = (globalThis as { URL?: typeof URL }).URL;
    if (doc && urlApi && typeof Blob !== 'undefined') {
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = urlApi.createObjectURL(blob);
      const anchor = doc.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      doc.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => urlApi.revokeObjectURL(url), 1000);
      return;
    }
    throw new Error('File download is unavailable in this browser.');
  }

  const targetFile = new File(Paths.cache, filename);
  targetFile.create({ overwrite: true });
  await targetFile.write(jsonContent);

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('System share sheet is unavailable on this device.');
  }
  await Sharing.shareAsync(targetFile.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: 'Save Khoroch backup',
  });
}

export async function saveBackupToDeviceFolder(
  jsonContent: string,
  filename: string
): Promise<{ saved: boolean; canceled?: boolean }> {
  if (Platform.OS !== 'android') {
    await shareBackupFile(jsonContent, filename);
    return { saved: true };
  }

  const { StorageAccessFramework } = LegacyFileSystem;
  const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permissions.granted) {
    return { saved: false, canceled: true };
  }

  const baseName = filename.replace(/\.json$/i, '');
  const safUri = await StorageAccessFramework.createFileAsync(
    permissions.directoryUri,
    baseName,
    'application/json'
  );
  await StorageAccessFramework.writeAsStringAsync(safUri, jsonContent);
  return { saved: true };
}

export type PickedBackupReadResult =
  | { canceled: true }
  | { canceled: false; name: string; byteSize: number; content: string };

export async function pickAndReadBackupFile(): Promise<PickedBackupReadResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return { canceled: true };
  }

  const asset = result.assets[0];
  if (typeof asset.size === 'number') {
    assertBackupWithinSizeLimit(asset.size);
  }

  if (Platform.OS === 'web') {
    const webFile = asset.file;
    if (webFile) {
      assertBackupWithinSizeLimit(webFile.size);
      const content = await webFile.text();
      assertBackupWithinSizeLimit(content.length);
      return {
        canceled: false,
        name: asset.name,
        byteSize: webFile.size,
        content,
      };
    }
    if (asset.uri.startsWith('data:')) {
      const commaIdx = asset.uri.indexOf(',');
      const raw = commaIdx >= 0 ? asset.uri.slice(commaIdx + 1) : '';
      const content =
        asset.uri.includes(';base64,') && typeof atob === 'function'
          ? atob(raw)
          : decodeURIComponent(raw);
      return {
        canceled: false,
        name: asset.name,
        byteSize: content.length,
        content,
      };
    }
    const resp = await fetch(asset.uri);
    const lenHeader = resp.headers.get('content-length');
    if (lenHeader) {
      const parsedLen = Number.parseInt(lenHeader, 10);
      if (Number.isFinite(parsedLen) && parsedLen > MAX_BACKUP_BYTES) {
        assertBackupWithinSizeLimit(parsedLen);
      }
    }
    const content = await resp.text();
    return {
      canceled: false,
      name: asset.name,
      byteSize: content.length,
      content,
    };
  }

  // Check native file size before reading contents into memory.
  try {
    const fileRef = new File(asset.uri);
    if (typeof fileRef.size === 'number' && fileRef.size > 0) {
      assertBackupWithinSizeLimit(fileRef.size);
    }
    const content = await fileRef.text();
    return {
      canceled: false,
      name: asset.name,
      byteSize: fileRef.size > 0 ? fileRef.size : content.length,
      content,
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes('20 MB')) {
      throw err;
    }
    const info = await LegacyFileSystem.getInfoAsync(asset.uri);
    if (info.exists && 'size' in info && typeof info.size === 'number') {
      assertBackupWithinSizeLimit(info.size);
    }
    const content = await LegacyFileSystem.readAsStringAsync(asset.uri);
    return {
      canceled: false,
      name: asset.name,
      byteSize: asset.size ?? content.length,
      content,
    };
  }
}
