// Persistence: book data as JSON in localStorage, photos as blobs in IndexedDB.
// Live version: photos are also uploaded to the shared room so everyone can see them,
// and the local copy of the books is kept per room.

import { ROOM, liveEnabled, uploadPhoto, downloadPhoto, removeRemotePhotos } from './sync.js';

const DATA_KEY = liveEnabled ? `scrapbook.v1.room.${ROOM}` : 'scrapbook.v1';
const DB_NAME = 'scrapbook-photos';
const STORE = 'photos';

export function loadData() {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

let dbPromise = null;
function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

function run(mode, action) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const result = action(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(result?.result);
    tx.onerror = () => reject(tx.error);
  }));
}

export async function putPhoto(blob) {
  const key = `photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await run('readwrite', (store) => store.put(blob, key));
  if (liveEnabled) await uploadPhoto(key, blob).catch((error) => console.warn('Photo upload failed:', error));
  return key;
}

export const getPhoto = (key) => run('readonly', (store) => store.get(key));

export async function deletePhotos(keys) {
  if (!keys.length) return;
  await run('readwrite', (store) => keys.forEach((key) => store.delete(key)));
  keys.forEach(revokePhotoUrl);
  if (liveEnabled) removeRemotePhotos(keys).catch(() => {});
}

export async function clearPhotos() {
  try {
    await run('readwrite', (store) => store.clear());
  } catch {
    // IndexedDB may be unavailable (private mode); nothing to clear.
  }
  for (const key of urlCache.keys()) revokePhotoUrl(key);
}

const urlCache = new Map();
export async function photoUrl(key) {
  if (urlCache.has(key)) return urlCache.get(key);
  let blob = await getPhoto(key).catch(() => null);
  if (!blob && liveEnabled) {
    // Someone else's photo: fetch it from the shared room and keep a local copy.
    blob = await downloadPhoto(key).catch(() => null);
    if (blob) await run('readwrite', (store) => store.put(blob, key)).catch(() => {});
  }
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}

function revokePhotoUrl(key) {
  const url = urlCache.get(key);
  if (url) URL.revokeObjectURL(url);
  urlCache.delete(key);
}

// Shrinks an uploaded image so its longest side is at most `max` pixels.
export async function resizeImage(file, max = 1200, quality = 0.8) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  return { blob, width: canvas.width, height: canvas.height };
}
