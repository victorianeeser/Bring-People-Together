// Small shared UI helpers: escaping, icons, toasts, announcements, confirm dialog.

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const svg = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
export const ICONS = {
  carousel: svg('<rect x="7" y="5" width="10" height="14" rx="1.5"/><path d="M3.5 7.5v9M20.5 7.5v9"/>'),
  grid: svg('<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/>'),
  join: svg('<circle cx="9.5" cy="8" r="3.5"/><path d="M3 19.5c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M18.5 8v6M15.5 11h6"/>'),
  leave: svg('<path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14M10 16l-4-4 4-4M6 12h10"/>'),
  copy: svg('<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>'),
  more: svg('<circle cx="6" cy="12" r="1.4" class="fill"/><circle cx="12" cy="12" r="1.4" class="fill"/><circle cx="18" cy="12" r="1.4" class="fill"/>'),
  share: svg('<path d="M12 15V4M8 8l4-4 4 4"/><path d="M6 12v6.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V12"/>'),
  trash: svg('<path d="M4.5 7h15M10 4h4M6.5 7l1 12.5A1.5 1.5 0 0 0 9 21h6a1.5 1.5 0 0 0 1.5-1.5L17.5 7M10 11v6M14 11v6"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  reset: svg('<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5"/>'),
};

// Keepsake: people saved before the branding (and anyone still on the old version) have the old
// blue/green/purple colors. Show them in the matching Keepsake color instead.
const OLD_COLORS = {
  '#F4A988': '#9B9090', '#9CC5A1': '#D06B6B', '#8FB3E8': '#D0C96B', '#D7A6E0': '#FF9797', '#F2CF72': '#F2CF72',
  '#A8E2DC': '#BCD4C9', '#FFC7B8': '#E1CFCD', '#BFD4FD': '#510C0D', '#E7B7C3': '#C99A6B', '#C9D99A': '#8FA89B',
  '#3D6FE0': '#9B9090', '#D9534F': '#D06B6B', '#8A4FC7': '#B5AD45', '#1E9467': '#510C0D', '#D9730D': '#C27A4E',
  '#D23C8A': '#7E9A8C', '#0F86A0': '#B8577A', '#8B5A2B': '#8A6F5C',
};
export const brandColor = (hex) => OLD_COLORS[String(hex || '').toUpperCase()] || hex;

// Letter color for a circle: maroon ink on light colors, white on strong ones.
export function inkFor(hex) {
  hex = brandColor(hex);
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return '#510C0D';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? '#510C0D' : '#FFFFFF';
}

// A row of small initial circles, one per member, in each member's color.
export function avatarStack(members, { max = 6 } = {}) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  const names = members.map((m) => m.name).join(', ');
  return `
    <span class="avatars" role="img" aria-label="${esc(`${members.length} ${members.length === 1 ? 'person' : 'people'}: ${names}`)}">
      ${shown.map((m) => `<span class="avatar" style="--avatar:${esc(brandColor(m.color))};--avatar-ink:${inkFor(m.color)}" title="${esc(m.name)}" aria-hidden="true">${esc(m.name.trim().charAt(0).toUpperCase())}</span>`).join('')}
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
    // Answer as soon as a button is pressed (the dialog's close event can arrive late),
    // or when the dialog closes some other way (Esc counts as Cancel).
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      resolve(ok);
      opener?.focus?.();
    };
    dialog.querySelector('form').addEventListener('submit', (event) => finish(event.submitter?.value === 'ok'), { once: true });
    dialog.addEventListener('close', () => finish(dialog.returnValue === 'ok'), { once: true });
  });
}

export const isTyping = (target) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
export const dialogOpen = () => Boolean(document.querySelector('dialog[open]'));
