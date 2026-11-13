// Table of contents interactions: the idea popover ("I'm in", "We did it!") and the "Add an idea" form.

import { CATEGORIES, COSTS, SEASONS } from './model.js';
import { ME } from './seed.js';
import { toggleImIn, markDone, addBucketItem } from './state.js';
import { spreadIndexOf, spreadPageNumbers } from './pages.js';
import { ICONS, esc, toast, announce } from './ui.js';

const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
const POP_WIDTH = 360;
const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');
const face = (m) => `<span class="avatar" style="--avatar:${esc(m.color)}" aria-hidden="true">${esc(m.name.charAt(0))}</span>`;

// The popover that opens when you click an idea in the table of contents.
export function createIdeaPopover(container, { book, turnTo, rerender, findAnchor }) {
  const pop = document.createElement('div');
  pop.className = 'idea-pop';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-labelledby', 'pop-title');
  pop.hidden = true;
  container.append(pop);
  let itemId = null;

  const item = () => book.bucketList.find((i) => i.id === itemId);

  function render() {
    const it = item();
    if (!it) return close();
    const members = Object.fromEntries(book.members.map((m) => [m.id, m]));
    const adder = members[it.addedBy];
    const going = it.whosIn.map((id) => members[id]).filter(Boolean);
    const imIn = it.whosIn.includes(ME);
    const done = it.status === 'done';
    const spreadIndex = spreadIndexOf(book, it.spreadId);
    const page = spreadIndex > 0 ? spreadPageNumbers(spreadIndex)[0] : null;
    const fact = (label, value) => `<div><dt>${label}</dt><dd>${value ? esc(value) : '<span class="muted">Not set</span>'}</dd></div>`;
    pop.innerHTML = `
      <div class="pop-head">
        <span class="pop-cat"><span class="cat-dot" style="background:${CATEGORIES[it.category] || '#DDD'}"></span>${esc(it.category)}${done ? ' · Done' : ''}</span>
        <button type="button" class="pop-close" data-pop="close" aria-label="Close">${ICONS.close}</button>
      </div>
      <h2 id="pop-title">${esc(it.title)}</h2>
      <p class="pop-sub">Added by ${esc(adder?.name || 'someone')}${it.addedAt ? ` · ${formatDate(it.addedAt)}` : ''}</p>
      <dl class="pop-facts">
        ${fact('Where', it.location)}
        ${fact('When', it.when)}
        ${fact('Cost', it.cost)}
        ${fact('Season', it.season || 'Someday')}
      </dl>
      ${it.notes ? `<p class="pop-notes">${esc(it.notes)}</p>` : ''}
      <div class="pop-who">
        <h3>Who's in (${going.length})</h3>
        ${going.length ? `<ul>${going.map((m) => `<li>${face(m)}${esc(m.name)}${m.id === ME ? ' (you)' : ''}</li>`).join('')}</ul>` : '<p class="muted">No one yet. Be the first.</p>'}
      </div>
      <div class="pop-actions">
        <button type="button" class="pill-btn ${imIn ? 'is-on' : ''}" data-pop="im-in" aria-pressed="${imIn}">${imIn ? CHECK : ''}I'm in</button>
        ${done
          ? (page ? `<button type="button" class="pill-btn solid" data-pop="go" data-index="${spreadIndex}">Go to page ${page} →</button>` : '')
          : '<button type="button" class="pill-btn solid" data-pop="did-it">We did it!</button>'}
      </div>`;
  }

  function place(anchor) {
    const rect = anchor.getBoundingClientRect();
    const height = pop.offsetHeight;
    let left = rect.right + 16;
    if (left + POP_WIDTH > innerWidth - 16) left = rect.left - POP_WIDTH - 16;
    left = Math.max(16, Math.min(left, innerWidth - POP_WIDTH - 16));
    const top = Math.max(16, Math.min(rect.top - 24, innerHeight - height - 16));
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  function open(id, anchor) {
    itemId = id;
    pop.hidden = false;
    render();
    place(anchor);
    pop.querySelector('[data-pop="im-in"]').focus();
    document.addEventListener('pointerdown', onOutside, true);
  }

  function close({ refocus = true } = {}) {
    if (pop.hidden) return;
    pop.hidden = true;
    document.removeEventListener('pointerdown', onOutside, true);
    if (refocus) findAnchor(itemId)?.focus({ preventScroll: true });
  }

  function onOutside(event) {
    if (!pop.contains(event.target)) close({ refocus: false });
  }

  pop.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-pop]');
    if (!btn) return;
    const it = item();
    const action = btn.dataset.pop;
    if (action === 'close') close();
    if (action === 'im-in') {
      const nowIn = toggleImIn(book.id, it.id);
      rerender();
      render();
      pop.querySelector('[data-pop="im-in"]').focus();
      announce(nowIn ? `You're in for ${it.title}` : `You're out of ${it.title}`);
    }
    if (action === 'did-it') {
      const spread = markDone(book.id, it.id);
      close({ refocus: false });
      rerender();
      const target = spreadIndexOf(book, spread.id);
      toast(`Made a spread for "${it.title}" on page ${spreadPageNumbers(target)[0]}`);
      turnTo(target);
    }
    if (action === 'go') {
      close({ refocus: false });
      turnTo(Number(btn.dataset.index));
    }
  });

  return { open, close, isOpen: () => !pop.hidden };
}

// The "Add an idea" form.
export function openAddIdea(book, { rerender, findAnchor }) {
  const dialog = document.getElementById('confirm');
  const radios = (name, options, checked, dot) => options.map((o) => `
    <label class="choice">
      <input type="radio" name="${name}" value="${esc(o)}" ${o === checked ? 'checked' : ''}>
      <span>${dot ? `<span class="cat-dot" style="background:${CATEGORIES[o]}"></span>` : ''}${esc(o)}</span>
    </label>`).join('');
  dialog.innerHTML = `
    <form method="dialog" class="confirm-box" id="idea-form" novalidate>
      <h2 id="confirm-title">Add an idea</h2>
      <p>Something your group wants to do together.</p>
      <label class="field"><span>What do you want to do?</span>
        <input name="title" maxlength="70" autocomplete="off" aria-describedby="idea-error" placeholder="Sunrise hike, taco crawl, movie night">
      </label>
      <p class="field-error" id="idea-error" hidden></p>
      <div class="field-row">
        <label class="field"><span>Where <span class="optional">(optional)</span></span><input name="location" maxlength="60" autocomplete="off"></label>
        <label class="field"><span>When <span class="optional">(optional)</span></span><input name="when" maxlength="40" autocomplete="off" placeholder="Before finals"></label>
      </div>
      <fieldset class="field"><legend>Season</legend><div class="choice-row">${radios('season', SEASONS, 'Someday')}</div></fieldset>
      <fieldset class="field"><legend>Cost</legend><div class="choice-row">${radios('cost', COSTS, 'Free')}</div></fieldset>
      <fieldset class="field"><legend>Category</legend><div class="choice-row">${radios('category', Object.keys(CATEGORIES), 'Adventure', true)}</div></fieldset>
      <label class="field"><span>Notes <span class="optional">(optional)</span></span><textarea name="notes" rows="2" maxlength="300"></textarea></label>
      <div class="confirm-actions">
        <button type="button" class="pill-btn" data-close>Cancel</button>
        <button type="submit" class="pill-btn solid">Add to the list</button>
      </div>
    </form>`;
  dialog.classList.add('wide');
  dialog.setAttribute('aria-labelledby', 'confirm-title');
  const form = dialog.querySelector('#idea-form');
  const titleInput = form.elements.title;
  const error = form.querySelector('#idea-error');
  let addedId = null;

  form.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  titleInput.addEventListener('input', () => { error.hidden = true; titleInput.removeAttribute('aria-invalid'); });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    if (!title) {
      error.textContent = 'Give the idea a name first.';
      error.hidden = false;
      titleInput.setAttribute('aria-invalid', 'true');
      titleInput.focus();
      return;
    }
    const data = new FormData(form);
    const item = addBucketItem(book.id, {
      title,
      location: String(data.get('location')).trim(),
      when: String(data.get('when')).trim(),
      cost: data.get('cost'),
      season: data.get('season'),
      category: data.get('category'),
      notes: String(data.get('notes')).trim(),
    });
    addedId = item.id;
    dialog.close();
    rerender();
    toast(`Added "${title}" to the bucket list`);
  });
  dialog.addEventListener('close', () => {
    dialog.classList.remove('wide');
    (addedId ? findAnchor(addedId) : document.querySelector('[data-action="add-idea"]'))?.focus({ preventScroll: true });
  }, { once: true });
  dialog.showModal();
  titleInput.focus();
}
