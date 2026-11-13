// Small shared UI helpers: escaping, icons, toasts, announcements, confirm dialog.

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const svg = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
export const ICONS = {
  carousel: svg('<rect x="7" y="5" width="10" height="14" rx="1.5"/><path d="M3.5 7.5v9M20.5 7.5v9"/>'),
  grid: svg('<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>'),
  more: svg('<circle cx="6" cy="12" r="1.4" class="fill"/><circle cx="12" cy="12" r="1.4" class="fill"/><circle cx="18" cy="12" r="1.4" class="fill"/>'),
  share: svg('<path d="M12 15V4M8 8l4-4 4 4"/><path d="M6 12v6.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V12"/>'),
  trash: svg('<path d="M4.5 7h15M10 4h4M6.5 7l1 12.5A1.5 1.5 0 0 0 9 21h6a1.5 1.5 0 0 0 1.5-1.5L17.5 7M10 11v6M14 11v6"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  reset: svg('<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5"/>'),
};

// A row of small initial circles, one per member, in each member's color.
export function avatarStack(members, { max = 6 } = {}) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  const names = members.map((m) => m.name).join(', ');
  return `
    <span class="avatars" role="img" aria-label="${esc(`${members.length} ${members.length === 1 ? 'person' : 'people'}: ${names}`)}">
      ${shown.map((m) => `<span class="avatar" style="--avatar:${esc(m.color)}" title="${esc(m.name)}" aria-hidden="true">${esc(m.name.trim().charAt(0).toUpperCase())}</span>`).join('')}
      ${extra > 0 ? `<span class="avatar more" aria-hidden="true">+${extra}</span>` : ''}
    </span>`;
}

let toastTimer = null;
export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

export function announce(message) {
  const el = document.getElementById('live');
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = message; });
}

export function confirmDialog({ title, body, confirmLabel = 'OK', danger = false }) {
  const dialog = document.getElementById('confirm');
  dialog.innerHTML = `
    <form method="dialog" class="confirm-box">
      <h2 id="confirm-title">${esc(title)}</h2>
      <p>${esc(body)}</p>
      <div class="confirm-actions">
        <button class="pill-btn" value="cancel">Cancel</button>
        <button class="pill-btn solid ${danger ? 'danger' : ''}" value="ok">${esc(confirmLabel)}</button>
      </div>
    </form>`;
  dialog.setAttribute('aria-labelledby', 'confirm-title');
  const opener = document.activeElement;
  dialog.showModal();
  dialog.querySelector('[value="cancel"]').focus();
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'ok');
      opener?.focus?.();
    }, { once: true });
  });
}

export const isTyping = (target) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
export const dialogOpen = () => Boolean(document.querySelector('dialog[open]'));
