// "Join a book": books are invite-only. You type the code a friend sent you to join their book.

import { findByCode, joinBook, isMine } from './state.js';
import { toast } from './ui.js';

export function openJoinBooks({ onJoined } = {}) {
  const dialog = document.getElementById('confirm');
  if (dialog.open) return;
  dialog.innerHTML = `
    <form method="dialog" class="confirm-box join-code" novalidate>
      <h2 id="confirm-title">Join a book</h2>
      <p>Books are invite only. Type the invite code a friend sent you.</p>
      <p class="test-code">For testing, use the code <strong>IXD415</strong>.</p> <!-- TEMP: remove after user testing -->
      <label class="field"><span>Invite code</span>
        <input name="code" class="code-input" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false"
          placeholder="ABC123" aria-describedby="code-error">
      </label>
      <p class="field-error" id="code-error" hidden></p>
      <div class="confirm-actions">
        <button type="button" class="pill-btn" data-close>Cancel</button>
        <button type="submit" class="pill-btn solid">Join</button>
      </div>
    </form>`;
  dialog.setAttribute('aria-labelledby', 'confirm-title');
  const form = dialog.querySelector('form');
  const input = form.elements.code;
  const error = form.querySelector('#code-error');
  const fail = (message) => {
    error.textContent = message;
    error.hidden = false;
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  };

  input.addEventListener('input', () => { error.hidden = true; input.removeAttribute('aria-invalid'); });
  form.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!input.value.trim()) { fail('Type the invite code first.'); return; }
    const book = findByCode(input.value);
    if (!book) { fail("There's no book with that code. Check it and try again."); return; }
    dialog.close();
    if (isMine(book)) toast(`You're already in "${book.title}"`);
    else { joinBook(book.id); toast(`Joined "${book.title}"`); }
    onJoined?.(book.id);
  });
  dialog.showModal();
  input.focus();
}

// The code for a book, ready to read out or paste.
export const inviteText = (book) => `Join "${book.title}" on our scrapbook with the invite code ${book.code}`;
