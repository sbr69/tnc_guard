import { components } from '../api/types';

type DocumentAnalysisResult = components['schemas']['DocumentAnalysisResult'];

export interface HistoryEntry {
  historyId: string;
  savedAt: number;
  result: DocumentAnalysisResult;
}

const DB_NAME = 'unmask_terms_db';
const STORE_NAME = 'analysis_history';
const DB_VERSION = 1;
const MAX_ENTRIES = 5;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'historyId' });
        store.createIndex('savedAt', 'savedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAnalysisToHistory(result: DocumentAnalysisResult): Promise<void> {
  if (!result?.id) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const entry: HistoryEntry = {
      historyId: `${result.id}_${Date.now()}`,
      savedAt: Date.now(),
      result,
    };

    const getAllRequest = store.getAll();
    getAllRequest.onsuccess = () => {
      const existing: HistoryEntry[] = getAllRequest.result ?? [];
      existing.sort((a, b) => a.savedAt - b.savedAt);
      store.put(entry);
      const overflow = existing.length - (MAX_ENTRIES - 1);
      if (overflow > 0) {
        existing.slice(0, overflow).forEach((old) => store.delete(old.historyId));
      }
    };

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.warn('[Unmask-Terms] Failed to save analysis to history:', err);
  }
}

export async function getAnalysisHistory(): Promise<HistoryEntry[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const getAllRequest = store.getAll();

    return new Promise<HistoryEntry[]>((resolve, reject) => {
      tx.oncomplete = () => {
        db.close();
        const entries: HistoryEntry[] = getAllRequest.result ?? [];
        resolve(entries.sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX_ENTRIES));
      };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.warn('[Unmask-Terms] Failed to load analysis history:', err);
    return [];
  }
}

export async function deleteHistoryEntry(historyId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(historyId);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.warn('[Unmask-Terms] Failed to delete history entry:', err);
  }
}
