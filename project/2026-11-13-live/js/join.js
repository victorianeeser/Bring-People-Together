// "Join a book": pick which of this room's books you're part of, instead of being added to all of them.

import { otherBooks, joinBook } from './state.js';
import { coverHtml, hydrateCovers } from './covers.js';
import { esc, toast, avatarStack } from './ui.js';

export function openJoinBooks({ onJoined, firstTime = false } = {}) {
  const dialog = document.getElementById('confirm');
  if (dialog.open) return;
  const books = otherBooks();
  dialog.innerHTML = `
    <form method="dialog" class="confirm-box join-books" novalidate>
      <h2 id="confirm-title">${firstTime ? 'Which books are you in?' : 'Join a book'}</h2>
      <p>${books.length
        ? 'Pick the books for your groups. You can join more later from <strong>Join a book</strong>.'
        : "You're already in every book here. Make a new one with <strong>New book</strong>."}</p>
      ${books.length ? `
        <ul class="join-list">
          ${books.map((b) => `
            <li>
              <label class="join-choice">
                <input type="checkbox" name="book" value="${esc(b.id)}">
                <span class="join-cover" aria-hidden="true">${coverHtml(b)}</span>
                <span class="join-text">
                  <strong>${esc(b.title)}</strong>
                  <span class="join-people">${avatarStack(b.members, { max: 5 })}<span>${b.members.length} ${b.members.length === 1 ? 'person' : 'people'}</span></span>
                </span>
                <span class="join-check" aria-hidden="true"></span>
              </label>
            </li>`).join('')}
        </ul>` : ''}
      <div class="confirm-actions">
        <button type="button" class="pill-btn" data-close>${firstTime ? 'Not now' : 'Cancel'}</button>
        ${books.length ? '<button type="submit" class="pill-btn solid" disabled>Join</button>' : ''}
      </div>
    </form>`;
  dialog.classList.add('wide');
  dialog.setAttribute('aria-labelledby', 'confirm-title');
  hydrateCovers(dialog);

  const form = dialog.querySelector('form');
  const submit = form.querySelector('[type="submit"]');
  const picked = () => [...form.querySelectorAll('input[name="book"]:checked')].map((i) => i.value);
  form.addEventListener('change', () => {
    const n = picked().length;
    submit.disabled = !n;
    submit.textContent = n > 1 ? `Join ${n} books` : 'Join';
  });
  form.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const ids = picked();
    if (!ids.length) return;
    ids.forEach(joinBook);
    dialog.close();
    toast(ids.length > 1 ? `Joined ${ids.length} books` : 'Joined the book');
    onJoined?.(ids);
  });
  dialog.addEventListener('close', () => dialog.classList.remove('wide'), { once: true });
  dialog.showModal();
  (form.querySelector('input[name="book"]') || form.querySelector('[data-close]')).focus();
}
