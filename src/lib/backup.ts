import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { exportAll } from '../db/repo';
import { todayISO } from './dates';

/** Gera o JSON do backup e abre o menu de compartilhar (Drive, WhatsApp, e-mail, Arquivos…). */
export async function exportBackup() {
  const data = exportAll();
  const file = new File(Paths.cache, `xpvault-backup-${todayISO()}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(data));
  if (!(await Sharing.isAvailableAsync())) throw new Error('Compartilhamento indisponível neste aparelho.');
  await Sharing.shareAsync(file.uri, { dialogTitle: 'Salvar backup do XPVault', mimeType: 'application/json' });
}

/** Abre o seletor de arquivos e devolve o conteúdo do backup (ou null se cancelar). */
export async function pickBackup(): Promise<unknown | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const file = new File(res.assets[0].uri);
  const text = await file.text();
  return JSON.parse(text);
}
