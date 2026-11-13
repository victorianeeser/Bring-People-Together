// The New book form, also used for Book settings (rename, change cover, turn the bucket list on or off).

import { COVER_PRESETS, MEMBER_COLORS, createBook, uid } from './model.js';
import { ME, ME_NAME } from './seed.js';
import { addBook, updateBook } from './state.js';
import { coverHtml } from './covers.js';
import { putPhoto, resizeImage, photoUrl, deletePhotos } from './storage.js';
import { esc, toast } from './ui.js';

const UPLOAD_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m4.5 17.5 5-5 4 4 2.5-2.5 3.5 3.5"/></svg>';

// book: when given, the form edits that book (Book settings) instead of making a new one.
// onSaved(book, { isNew }) runs after saving.
export function openBookForm({ book = null, onSaved } = {}) {
  const isNew = !book;
  const dialog = document.getElementById('confirm');
  const state = {
    title: book?.title || '',
    cover: book ? { ...book.cover } : { type: 'preset', presetId: COVER_PRESETS[Math.floor(Math.random() * COVER_PRESETS.length)].id },
    people: [], // names added in this form (new books only)
    hasBucketList: book ? book.hasBucketList : true,
  };
  const uploaded = []; // photo keys uploaded in this form, cleaned up if not used
  let saved = false;

  dialog.innerHTML = `
    <form method="dialog" class="confirm-box book-form" id="book-form" novalidate>
      <h2 id="confirm-title">${isNew ? 'New book' : 'Book settings'}</h2>
      <p>${isNew ? 'Make a book for a friend group, a trip, a semester, or anything else.' : `Change the title, cover, or bucket list for ${esc(book.title)}.`}</p>
      <label class="field"><span>Title</span>
        <input name="title" maxlength="40" autocomplete="off" value="${esc(state.title)}" aria-describedby="title-error" placeholder="Friends, Summer trip, Movie nights">
      </label>
      <p class="field-error" id="title-error" hidden></p>

      <fieldset class="field">
        <legend>Cover</legend>
        <div class="cover-picker" id="cover-picker"></div>
        <input type="file" id="cover-file" accept="image/*" hidden>
      </fieldset>

      ${isNew ? `
        <fieldset class="field">
          <legend>People</legend>
          <ul class="people-chips" id="people-chips"></ul>
          <div class="people-add">
            <input id="person-name" maxlength="30" autocomplete="off" placeholder="Add someone by name" aria-label="Name of someone to add">
            <button type="button" class="pill-btn small" data-form="add-person">Add</button>
          </div>
          <p class="form-note">You can invite people by email later with the + next to the book.</p>
        </fieldset>` : ''}

      <label class="switch-row">
        <input type="checkbox" role="switch" name="bucket" ${state.hasBucketList ? 'checked' : ''}>
        <span class="switch" aria-hidden="true"></span>
        <span>Include a bucket list <span class="optional">(it becomes your table of contents)</span></span>
      </label>

      <div class="confirm-actions">
        <button type="button" class="pill-btn" data-form="cancel">Cancel</button>
        <button type="submit" class="pill-btn solid">${isNew ? 'Create book' : 'Save'}</button>
      </div>
    </form>`;
  dialog.classList.add('wide');
  dialog.setAttribute('aria-labelledby', 'confirm-title');

  const form = dialog.querySelector('#book-form');
  const titleInput = form.elements.title;
  const picker = form.querySelector('#cover-picker');
  const fileInput = form.querySelector('#cover-file');
  const titleError = form.querySelector('#title-error');

  function renderCovers() {
    const title = titleInput.value.trim() || 'Your title';
    const photoChecked = state.cover.type === 'photo';
    picker.innerHTML = COVER_PRESETS.map((p) => {
      const checked = state.cover.type === 'preset' && state.cover.presetId === p.id;
      return `
        <label class="cover-choice" title="${esc(p.id.replace('-', ' '))}">
          <input type="radio" name="cover" value="${p.id}" ${checked ? 'checked' : ''} aria-label="${esc(p.id.replace('-', ' '))} cover">
          <span class="mini-cover">${coverHtml({ title, cover: { type: 'preset', presetId: p.id } })}</span>
        </label>`;
    }).join('') + `
      <label class="cover-choice upload-choice">
        <input type="radio" name="cover" value="photo" ${photoChecked ? 'checked' : ''} aria-label="Upload a photo for the cover">
        <span class="mini-cover">${photoChecked ? coverHtml({ title, cover: state.cover }) : `<span class="upload-tile">${UPLOAD_ICON}<span>Upload photo</span></span>`}</span>
      </label>`;
    if (photoChecked) {
      const img = picker.querySelector('.cover-photo');
      photoUrl(state.cover.photoKey).then((url) => { if (url && img) { img.src = url; img.hidden = false; } }).catch(() => {});
    }
  }

  function renderPeople() {
    const chips = form.querySelector('#people-chips');
    if (!chips) return;
    chips.innerHTML = `<li class="chip is-you">${esc(ME_NAME)} (you)</li>` + state.people.map((name, i) => `
      <li class="chip">${esc(name)}<button type="button" class="chip-remove" data-form="remove-person" data-index="${i}" aria-label="Remove ${esc(name)}">×</button></li>`).join('');
  }

  function addPerson() {
    const input = form.querySelector('#person-name');
    const name = input.value.trim();
    if (!name) return;
    if (name.toLowerCase() === ME_NAME.toLowerCase() || state.people.some((p) => p.toLowerCase() === name.toLowerCase())) {
      toast(`${name} is already in this book`);
      return;
    }
    state.people.push(name);
    input.value = '';
    renderPeople();
    input.focus();
  }

  async function uploadCover(file) {
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const { blob } = await resizeImage(file, 1200);
      const key = await putPhoto(blob);
      uploaded.push(key);
      state.cover = { type: 'photo', photoKey: key };
      renderCovers();
      picker.querySelector('input[value="photo"]').focus();
    } catch {
      toast("Couldn't use that photo");
    }
  }

  picker.addEventListener('change', (event) => {
    if (event.target.name !== 'cover') return;
    if (event.target.value === 'photo') {
      if (state.cover.type !== 'photo') fileInput.click();
      return;
    }
    state.cover = { type: 'preset', presetId: event.target.value };
  });
  // Clicking the upload tile again lets you pick a different photo.
  picker.addEventListener('click', (event) => {
    if (event.target.closest('.upload-choice') && state.cover.type === 'photo' && event.detail > 0) fileInput.click();
  });
  fileInput.addEventListener('change', () => {
    uploadCover(fileInput.files[0]);
    fileInput.value = '';
  });
  titleInput.addEventListener('input', () => {
    titleError.hidden = true;
    titleInput.removeAttribute('aria-invalid');
    renderCovers();
  });
  form.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-form]');
    if (!btn) return;
    if (btn.dataset.form === 'cancel') dialog.close();
    if (btn.dataset.form === 'add-person') addPerson();
    if (btn.dataset.form === 'remove-person') {
      state.people.splice(Number(btn.dataset.index), 1);
      renderPeople();
      form.querySelector('#person-name').focus();
    }
  });
  form.querySelector('#person-name')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); addPerson(); }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    if (!title) {
      titleError.textContent = 'Give the book a title first.';
      titleError.hidden = false;
      titleInput.setAttribute('aria-invalid', 'true');
      titleInput.focus();
      return;
    }
    const hasBucketList = form.elements.bucket.checked;
    let result;
    if (isNew) {
      const members = [
        { id: ME, name: ME_NAME, color: MEMBER_COLORS[0] },
        ...state.people.map((name, i) => ({ id: uid('member'), name, color: MEMBER_COLORS[(i + 1) % MEMBER_COLORS.length] })),
      ];
      result = createBook({ title, cover: state.cover, members, hasBucketList });
      addBook(result);
    } else {
      const oldCover = book.cover;
      result = updateBook(book.id, { title, cover: state.cover, hasBucketList });
      if (oldCover?.type === 'photo' && oldCover.photoKey !== state.cover.photoKey) deletePhotos([oldCover.photoKey]).catch(() => {});
    }
    saved = true;
    dialog.close();
    onSaved?.(result, { isNew });
  });

  dialog.addEventListener('close', () => {
    dialog.classList.remove('wide');
    // Drop photos uploaded here that didn't end up on the cover.
    const keep = saved && state.cover.type === 'photo' ? state.cover.photoKey : null;
    const unused = uploaded.filter((key) => key !== keep);
    if (unused.length) deletePhotos(unused).catch(() => {});
  }, { once: true });

  renderCovers();
  renderPeople();
  dialog.showModal();
  titleInput.focus();
}
