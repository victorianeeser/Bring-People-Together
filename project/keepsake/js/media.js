// Photos and videos (from the 11/18 crit): uploading them, and each book's camera roll.
// A video is stored like a photo (an item of type "photo" with `video: true`), so moving, resizing,
// credit, reports and removing all work the same way.

import { putPhoto, putVideo, resizeImage } from './storage.js';
import { ME } from './identity.js';
import { toast } from './ui.js';

export const MAX_VIDEO_MB = 7; // the database stores up to 10 MB per value, and sharing makes a file about a third bigger
const ROLL_LIMIT = 120; // the book's info has a size limit in the database, so keep the newest 120

const isVideo = (file) => file.type.startsWith('video/');
const isImage = (file) => file.type.startsWith('image/');
export const mediaFiles = (files) => [...files].filter((f) => isImage(f) || isVideo(f));

// Width/height of a video file, read from its first frame's metadata.
function videoSize(file) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => { resolve({ width: v.videoWidth || 16, height: v.videoHeight || 9, duration: v.duration }); URL.revokeObjectURL(v.src); };
    v.onerror = () => { resolve({ width: 16, height: 9, duration: 0 }); URL.revokeObjectURL(v.src); };
    v.src = URL.createObjectURL(file);
  });
}

// Saves each file (photos shrunk to 1200px, videos as they are) and returns what to put on a page or in the roll:
// [{ key, video, aspect }]. Files that are too big or fail are skipped with a message.
export async function storeMedia(files) {
  const out = [];
  let unshared = 0;
  for (const file of mediaFiles(files)) {
    try {
      if (isVideo(file)) {
        if (file.size > MAX_VIDEO_MB * 1024 * 1024) { toast(`${file.name} is over ${MAX_VIDEO_MB} MB. Try a shorter clip.`); continue; }
        const { width, height } = await videoSize(file);
        const { key, shared } = await putVideo(file);
        if (!shared) unshared += 1;
        out.push({ key, video: true, aspect: height / width });
      } else {
        const { blob, width, height } = await resizeImage(file);
        const key = await putPhoto(blob);
        out.push({ key, video: false, aspect: height / width });
      }
    } catch {
      toast(`Couldn't add ${file.name}`);
    }
  }
  if (unshared) toast("The video is on your screen, but it couldn't be shared yet. The database needs the new video rule (see the README).");
  return out;
}

// Remembers uploads in the book's camera roll (newest first, no repeats).
export function addToRoll(book, entries) {
  const at = Date.now();
  const fresh = entries.map((e, i) => ({ key: e.key, video: Boolean(e.video), aspect: e.aspect, by: ME, at: at + i }));
  const keys = new Set(fresh.map((e) => e.key));
  book.roll = [...fresh.reverse(), ...(book.roll || []).filter((e) => !keys.has(e.key))].slice(0, ROLL_LIMIT);
}

// Every photo and video in the book, newest first: the camera roll plus anything already on a page
// (photos added before the camera roll existed). Keys start with the upload time, so they sort by it.
export function rollOf(book) {
  const seen = new Map();
  for (const e of book.roll || []) if (!seen.has(e.key)) seen.set(e.key, e);
  for (const spread of book.spreads) {
    for (const item of [...spread.leftPage.items, ...spread.rightPage.items]) {
      if (item.type === 'photo' && item.photoKey && !seen.has(item.photoKey) && !item.removedForAll) {
        seen.set(item.photoKey, { key: item.photoKey, video: Boolean(item.video), aspect: item.aspect, by: item.addedBy, at: timeOf(item.photoKey) });
      }
    }
  }
  return [...seen.values()].sort((a, b) => (b.at || 0) - (a.at || 0));
}

function timeOf(key) {
  const t = parseInt(String(key).split('-')[1] || '', 36);
  return Number.isFinite(t) ? t : 0;
}

// A small square tile for the recently uploaded row and the camera roll.
export const tileHtml = (e, attrs = '') => `<button type="button" class="roll-tile${e.video ? ' is-video' : ''}" data-roll-key="${e.key}" ${attrs}>
    ${e.video
      ? `<video class="roll-media" data-photo-key="${e.key}" muted playsinline preload="metadata"></video><span class="roll-play" aria-hidden="true"></span>`
      : `<img class="roll-media" data-photo-key="${e.key}" alt="">`}
  </button>`;
