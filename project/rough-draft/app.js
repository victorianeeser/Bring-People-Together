// Saving, the page router, the sidebar, the bucket list, the detail panel and the add form.

const STORE_KEY = 'bucketlist.v4';
const main = document.getElementById('main');
const sidebar = document.getElementById('sidebar');
const panel = document.getElementById('panel');
const addModal = document.getElementById('add-modal');
const confirmModal = document.getElementById('confirm-modal');
const toastEl = document.getElementById('toast');

const ui = { season: null, category: null, imIn: false, addedByMe: false, panelId: null };
let db = load();

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return upgradeData(JSON.parse(raw));
  } catch {
    // Unreadable or blocked storage falls back to the demo data.
  }
  return createSeed();
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
    return true;
  } catch {
    return false;
  }
}

function saveOrWarn() {
  if (!save()) toast("Couldn't save. This browser's storage may be full.");
}

const uid = () => Math.random().toString(36).slice(2, 10);
const currentGroup = () => db.groups.find((g) => g.id === db.currentGroup) || db.groups[0];
const find = (id) => currentGroup().activities.find((a) => a.id === id);
const member = (id) => currentGroup().members.find((m) => m.id === id) || { id, name: 'Someone' };
const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const nameOf = (id) => member(id).name;

function avatar(id, size = '') {
  const m = member(id);
  const photo = MEMBER_PHOTOS[m.id];
  return `<span class="avatar ${size}" aria-hidden="true">${esc(m.name[0])}${photo ? `<img src="${esc(photo)}" alt="">` : ''}</span>`;
}

// A portrait that can't load falls back to the initial underneath it.
document.addEventListener('error', (event) => {
  if (event.target.closest && event.target.closest('.avatar')) event.target.remove();
}, true);

function avatarStack(ids) {
  return `<span class="stack">${ids.slice(0, 5).map((id) => avatar(id)).join('')}</span>`;
}

function timeAgo(iso) {
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'a month ago' : `${months} months ago`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

let toastTimer;
function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
}

function askConfirm(title, body, okLabel) {
  confirmModal.innerHTML = `
    <h2 id="confirm-title">${esc(title)}</h2>
    <p>${esc(body)}</p>
    <div class="row-end">
      <button type="button" class="btn" id="confirm-no">Keep going</button>
      <button type="button" class="btn primary" id="confirm-yes">${esc(okLabel)}</button>
    </div>`;
  confirmModal.showModal();
  return new Promise((resolve) => {
    let answer = false;
    confirmModal.querySelector('#confirm-yes').onclick = () => { answer = true; confirmModal.close(); };
    confirmModal.querySelector('#confirm-no').onclick = () => confirmModal.close();
    confirmModal.addEventListener('close', () => resolve(answer), { once: true });
  });
}

function seasonOptions(selected) {
  return SEASONS.map((s) => `<option value="${s}" ${s === selected ? 'selected' : ''}>${s}</option>`).join('');
}

// Sidebar

const phoneQuery = window.matchMedia('(max-width: 820px)');
let sidebarView = 'list';

const TAB_ICONS = {
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>',
  scrapbook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7c-2-1.6-4.6-2.2-8-2v13c3.4-.2 6 .4 8 2 2-1.6 4.6-2.2 8-2V5c-3.4-.2-6 .4-8 2ZM12 7v13"/></svg>',
};

function renderSidebar(view) {
  sidebarView = view;
  const phone = phoneQuery.matches;
  const group = currentGroup();
  const todo = group.activities.filter((a) => !a.done).length;
  const done = group.activities.length - todo;
  const link = (hash, label, icon, count, active) => `
    <a class="nav-link" href="${hash}" ${active ? 'aria-current="page"' : ''}>
      ${phone ? TAB_ICONS[icon] : ''}<span>${label}</span>${phone ? '' : `<span class="count">${count}</span>`}
    </a>`;

  const picker = `
    <label class="eyebrow ${phone ? 'visually-hidden' : ''}" for="group-select">Your group</label>
    <div class="group-picker">
      <select id="group-select" class="group-select">
        ${db.groups.map((g) => `<option value="${esc(g.id)}" ${g.id === group.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}
      </select>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
    </div>`;
  const meta = `
    <div class="group-meta">
      <span>Created by ${esc(nameOf(group.createdBy))}</span>
      <button type="button" class="text-btn" data-action="group-open">+ New group</button>
    </div>`;
  const nav = `
    <nav class="nav" aria-label="Main">
      ${link('#/list', 'Bucket list', 'list', todo, view === 'list')}
      ${link('#/scrapbook', 'Scrapbook', 'scrapbook', done, view === 'scrapbook' || view === 'page')}
    </nav>`;
  const people = `
    <h2 class="side-heading">Members</h2>
    <ul class="members">
      ${group.members.map((m) => `<li>${avatar(m.id)}<span>${esc(m.name)}</span></li>`).join('')}
      <li>
        <button type="button" class="invite-btn" data-action="invite-open">
          <span class="invite-plus" aria-hidden="true">+</span>Invite
        </button>
      </li>
    </ul>
    <button type="button" class="settings-btn" data-action="settings-open">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
      Settings
    </button>`;

  sidebar.innerHTML = phone
    ? `${picker}
      <button type="button" class="icon-btn menu-btn" id="menu-btn" data-action="menu-open" aria-label="Open menu" aria-expanded="false" aria-controls="menu-drawer">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      </button>
      ${nav}
      <div class="scrim" id="menu-scrim" data-action="menu-close" hidden></div>
      <div class="drawer" id="menu-drawer" role="group" aria-label="Menu">
        <div class="drawer-head">
          <h2>Menu</h2>
          <button type="button" class="icon-btn" data-action="menu-close" aria-label="Close menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
        </div>
        ${meta}${people}
      </div>`
    : `${picker}${meta}${nav}${people}`;
}

function setMenu(open) {
  const drawer = document.getElementById('menu-drawer');
  if (!drawer || drawer.classList.contains('open') === open) return;
  drawer.classList.toggle('open', open);
  document.getElementById('menu-scrim').hidden = !open;
  const button = document.getElementById('menu-btn');
  button.setAttribute('aria-expanded', open);
  main.inert = open;
  sidebar.querySelector('.nav').inert = open;
  button.inert = open;
  sidebar.querySelector('.group-picker').inert = open;
  if (open) drawer.querySelector('.icon-btn').focus();
  else button.focus();
}

phoneQuery.addEventListener('change', () => {
  main.inert = false;
  if (!document.body.classList.contains('is-editor')) renderSidebar(sidebarView);
});

// Bucket list

function visibleActivities() {
  return currentGroup().activities
    .filter((a) => !ui.season || a.season === ui.season)
    .filter((a) => !ui.category || a.category === ui.category)
    .filter((a) => !ui.imIn || a.inIds.includes(ME))
    .filter((a) => !ui.addedByMe || a.addedBy === ME)
    .sort((a, b) => a.done - b.done || b.addedAt.localeCompare(a.addedAt));
}

function filterLabel() {
  const count = [ui.category, ui.imIn, ui.addedByMe].filter(Boolean).length;
  return count ? `Filter (${count})` : 'Filter';
}

function filterOption(label, key) {
  return `<label class="filter-option"><input type="checkbox" data-filter="${key}" ${ui[key] ? 'checked' : ''}>${esc(label)}</label>`;
}

function categoryOption(label, value) {
  return `<label class="filter-option"><input type="radio" name="filter-category" value="${esc(value)}" ${(ui.category || '') === value ? 'checked' : ''}>${esc(label)}</label>`;
}

function setFilterMenu(open) {
  const menu = document.getElementById('filter-menu');
  if (!menu) return;
  menu.hidden = !open;
  document.getElementById('filter-btn').setAttribute('aria-expanded', open);
}

function renderList() {
  const seasonTab = (label, value) => `<button type="button" class="season" data-action="filter-season" data-value="${value}" aria-pressed="${(ui.season || '') === value}">${label}</button>`;
  main.innerHTML = `
    <div class="container narrow">
      <header class="page-head list-head">
        <div>
          <h2 class="view-title">Bucket list</h2>
          <p class="muted">Things we said we'd do. Let's actually do them.</p>
        </div>
        <div class="head-actions">
          <div class="filter-wrap">
            <button type="button" class="btn filter-btn" id="filter-btn" data-action="filter-menu" aria-expanded="false" aria-controls="filter-menu">
              <span id="filter-label">${filterLabel()}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <div class="filter-menu" id="filter-menu" hidden>
              <fieldset>
                <legend>Category</legend>
                ${categoryOption('All categories', '')}
                ${Object.keys(CATEGORIES).map((c) => categoryOption(c, c)).join('')}
              </fieldset>
              <fieldset>
                <legend>People</legend>
                ${filterOption("I'm in", 'imIn')}
                ${filterOption('Added by me', 'addedByMe')}
              </fieldset>
            </div>
          </div>
          <button type="button" class="btn primary" data-action="add-open">+ Add to the list</button>
        </div>
      </header>
      <div class="seasons" role="group" aria-label="Filter by season">
        ${seasonTab('All', '')}
        ${SEASONS.map((s) => seasonTab(s, s)).join('')}
      </div>
      <div id="grid"></div>
    </div>`;
  syncChips();
  renderGrid();
}

function rowHtml(a) {
  const meta = [a.location, `Added by ${nameOf(a.addedBy)}`].filter(Boolean).join(' · ');
  const check = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 13 4 4L19 7"/></svg>';
  return `
    <li class="row ${a.done ? 'is-done' : ''}" data-card="${esc(a.id)}">
      ${a.done
        ? `<a class="check" href="#/page/${esc(a.id)}" aria-label="Done. See the scrapbook page for ${esc(a.title)}">${check}</a>`
        : `<button type="button" class="check" data-action="check" data-id="${esc(a.id)}" aria-label="Mark ${esc(a.title)} done and make its scrapbook page"></button>`}
      <div>
        <h3>${a.done
          ? `<a class="row-open" href="#/page/${esc(a.id)}">${esc(a.title)}</a>`
          : `<button type="button" class="row-open" data-action="open" data-id="${esc(a.id)}">${esc(a.title)}</button>`}</h3>
        <p class="row-meta">${esc(meta)}</p>
      </div>
      <div class="row-tail">
        <span class="cat" style="background:${CATEGORIES[a.category]}">${esc(a.category)}</span>
        <span class="row-in">${avatarStack(a.inIds)}</span>
      </div>
    </li>`;
}

function renderGrid() {
  const grid = document.getElementById('grid');
  if (!grid) return;
  const items = visibleActivities();
  grid.innerHTML = items.length
    ? `<ul class="bucket">${items.map(rowHtml).join('')}</ul>`
    : currentGroup().activities.length
      ? `<div class="empty"><p>${ui.season ? `Nothing on the list for ${ui.season === 'Someday' ? 'someday' : esc(ui.season.toLowerCase())} yet.` : 'Nothing on the list matches these filters.'}</p><button type="button" class="btn" data-action="filter-clear">Clear filters</button></div>`
      : '<div class="empty"><p>Nothing on this list yet.</p><button type="button" class="btn primary" data-action="add-open">+ Add the first thing</button></div>';
}

function syncChips() {
  main.querySelectorAll('[data-action="filter-season"]').forEach((b) => b.setAttribute('aria-pressed', (ui.season || '') === b.dataset.value));
  main.querySelectorAll('[name="filter-category"]').forEach((radio) => { radio.checked = (ui.category || '') === radio.value; });
  main.querySelectorAll('[data-filter]').forEach((box) => { box.checked = ui[box.dataset.filter]; });
  const label = document.getElementById('filter-label');
  if (label) {
    label.textContent = filterLabel();
    document.getElementById('filter-btn').classList.toggle('active', Boolean(ui.category || ui.imIn || ui.addedByMe));
  }
}

// Detail panel

function renderPanel() {
  const a = find(ui.panelId);
  if (!a) return;
  const imIn = a.inIds.includes(ME);
  const fact = (term, value) => `<div><dt>${term}</dt><dd>${value ? esc(value) : '<span class="muted">Not set</span>'}</dd></div>`;
  panel.innerHTML = `
    <div class="panel-inner">
      <header class="panel-head" style="background:${CATEGORIES[a.category]}">
        <button type="button" class="icon-btn" data-action="panel-close" aria-label="Close details">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
        <span class="cat outline">${esc(a.category)}</span>
        <h2 id="panel-title">${esc(a.title)}</h2>
        <p>Added by ${esc(nameOf(a.addedBy))}, ${esc(timeAgo(a.addedAt))}</p>
      </header>
      <div class="panel-body">
        <dl class="facts">
          ${fact('Where', a.location)}
          ${fact('When', a.when)}
          ${fact('Cost', a.cost)}
          ${fact("Who's in", `${a.inIds.length} of ${currentGroup().members.length}`)}
        </dl>
        <div class="field">
          <label for="panel-season">Season</label>
          <select id="panel-season">${seasonOptions(a.season)}</select>
        </div>
        <section>
          <h3>Who's in</h3>
          ${a.inIds.length
            ? `<ul class="people">${a.inIds.map((id) => `<li>${avatar(id)}<span>${esc(nameOf(id))}</span></li>`).join('')}</ul>`
            : '<p class="muted">No one yet. Be the first.</p>'}
        </section>
        <section>
          <h3>Notes</h3>
          <p class="notes">${a.notes ? esc(a.notes) : '<span class="muted">No notes yet.</span>'}</p>
        </section>
      </div>
      <footer class="panel-foot">
        <button type="button" class="btn toggle" data-action="toggle-in" aria-pressed="${imIn}">
          ${imIn ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 13 4 4L19 7"/></svg>' : ''}I'm in
        </button>
        <button type="button" class="btn primary" data-action="did-it">We did it!</button>
      </footer>
    </div>`;
}

function openPanel(id) {
  ui.panelId = id;
  renderPanel();
  panel.showModal();
}

panel.addEventListener('click', (event) => {
  if (event.target === panel) panel.close();
});

panel.addEventListener('close', () => {
  const card = main.querySelector(`[data-card="${CSS.escape(ui.panelId || '')}"] .row-open`);
  if (card) card.focus({ preventScroll: true });
  ui.panelId = null;
});

// Add form

function pills(name, values, type, isChecked) {
  return values.map((value) => `
    <label class="pill">
      <input type="${type}" name="${name}" value="${esc(value)}" ${isChecked(value) ? 'checked' : ''}>
      <span>${esc(value)}</span>
    </label>`).join('');
}

function openAddModal() {
  const members = currentGroup().members;
  const memberPills = members.map((m) => `
    <label class="pill">
      <input type="checkbox" name="inIds" value="${esc(m.id)}" ${m.id === ME ? 'checked' : ''}>
      <span>${esc(m.name)}</span>
    </label>`).join('');

  addModal.innerHTML = `
    <form id="add-form" novalidate>
      <header class="modal-head">
        <h2 id="add-title">Add to the list</h2>
        <button type="button" class="icon-btn" data-action="add-close" aria-label="Close form">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </header>
      <div class="modal-body">
        <div class="field">
          <label for="f-title">What do you want to do? <span class="muted">(required)</span></label>
          <input id="f-title" name="title" maxlength="70" aria-describedby="title-error" autocomplete="off">
          <p class="error" id="title-error" hidden>Give it a title first.</p>
        </div>
        <div class="two">
          <div class="field">
            <label for="f-location">Location</label>
            <input id="f-location" name="location" maxlength="60" autocomplete="off">
          </div>
          <div class="field">
            <label for="f-when">When</label>
            <input id="f-when" name="when" maxlength="40" placeholder="Before finals, over break" autocomplete="off">
          </div>
        </div>
        <fieldset><legend>Season</legend><div class="pills">${pills('season', SEASONS, 'radio', (v) => v === 'Someday')}</div></fieldset>
        <fieldset><legend>Cost</legend><div class="pills">${pills('cost', COSTS, 'radio', (v) => v === 'Free')}</div></fieldset>
        <fieldset><legend>Category</legend><div class="pills">${pills('category', Object.keys(CATEGORIES), 'radio', (v) => v === 'Adventure')}</div></fieldset>
        <div class="field">
          <label for="f-by">Added by</label>
          <select id="f-by" name="addedBy">
            ${members.map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')}
          </select>
        </div>
        <fieldset><legend>Who's in</legend><div class="pills">${memberPills}</div></fieldset>
        <div class="field">
          <label for="f-notes">Notes</label>
          <textarea id="f-notes" name="notes" rows="3" maxlength="400"></textarea>
        </div>
      </div>
      <footer class="modal-foot">
        <button type="button" class="btn" data-action="add-close">Cancel</button>
        <button type="submit" class="btn primary">Add to the list</button>
      </footer>
    </form>`;
  addModal.showModal();
  addModal.querySelector('#f-title').focus();
}

function submitAdd(form) {
  const data = new FormData(form);
  const title = String(data.get('title')).trim();
  const titleInput = form.querySelector('#f-title');
  const error = form.querySelector('#title-error');
  if (!title) {
    error.hidden = false;
    titleInput.setAttribute('aria-invalid', 'true');
    titleInput.focus();
    return;
  }
  currentGroup().activities.push({
    id: uid(),
    title,
    addedBy: data.get('addedBy'),
    addedAt: new Date().toISOString(),
    location: String(data.get('location')).trim(),
    when: String(data.get('when')).trim(),
    cost: data.get('cost'),
    category: data.get('category'),
    notes: String(data.get('notes')).trim(),
    season: data.get('season'),
    inIds: data.getAll('inIds'),
    done: false,
    doneAt: null,
    page: null,
  });
  saveOrWarn();
  addModal.close();
  clearFilters();
  if (location.hash === '#/list') refreshList();
  else location.hash = '#/list';
  toast(`Added "${title}"`);
}

function refreshList() {
  renderSidebar('list');
  renderList();
}

function clearFilters() {
  ui.season = null;
  ui.category = null;
  ui.imIn = false;
  ui.addedByMe = false;
}

function showGroup(id) {
  db.currentGroup = id;
  saveOrWarn();
  clearFilters();
  if (['', '#/list', '#/scrapbook', '#/book'].includes(location.hash)) route();
  else location.hash = '#/list';
}

function showFieldError(input, message) {
  const error = document.getElementById(input.getAttribute('aria-describedby'));
  error.textContent = message;
  error.hidden = false;
  input.setAttribute('aria-invalid', 'true');
  input.focus();
}

function smallFormHtml({ id, title, body, submit }) {
  return `
    <form id="${id}" novalidate>
      <header class="modal-head">
        <h2 id="add-title">${esc(title)}</h2>
        <button type="button" class="icon-btn" data-action="add-close" aria-label="Close form"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </header>
      <div class="modal-body">${body}</div>
      <footer class="modal-foot">
        <button type="button" class="btn" data-action="add-close">Cancel</button>
        <button type="submit" class="btn primary">${esc(submit)}</button>
      </footer>
    </form>`;
}

// Invite

function openInviteModal() {
  addModal.innerHTML = smallFormHtml({
    id: 'invite-form',
    title: `Invite to ${currentGroup().name}`,
    submit: 'Add to group',
    body: `
      <div class="field">
        <label for="f-invite">Their name</label>
        <input id="f-invite" name="name" maxlength="20" aria-describedby="invite-error" autocomplete="off">
        <p class="error" id="invite-error" hidden></p>
      </div>`,
  });
  addModal.showModal();
  addModal.querySelector('#f-invite').focus();
}

function submitInvite(form) {
  const input = form.querySelector('#f-invite');
  const name = input.value.trim();
  const group = currentGroup();
  if (!name) return showFieldError(input, 'Type their name first.');
  if (group.members.some((m) => m.name.toLowerCase() === name.toLowerCase())) return showFieldError(input, `${name} is already in this group.`);
  group.members.push({ id: uid(), name });
  saveOrWarn();
  addModal.close();
  route();
  toast(`Added ${name} to ${group.name}`);
}

// Settings

function currentTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function setTheme(theme) {
  if (theme === 'light') document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  try {
    localStorage.setItem('bucketlist.theme', theme);
  } catch (e) {
    // The theme still applies until the page is closed.
  }
}

function themeOption(value, label) {
  return `<label class="pill"><input type="radio" name="theme" value="${value}" ${currentTheme() === value ? 'checked' : ''}><span>${label}</span></label>`;
}

function openSettingsModal() {
  addModal.innerHTML = smallFormHtml({
    id: 'settings-form',
    title: 'Settings',
    submit: 'Save',
    body: `
      <div class="field">
        <label for="f-settings-name">Group name</label>
        <input id="f-settings-name" name="name" maxlength="30" value="${esc(currentGroup().name)}" aria-describedby="settings-error" autocomplete="off">
        <p class="error" id="settings-error" hidden></p>
      </div>
      <fieldset>
        <legend>Appearance</legend>
        <div class="pills">${themeOption('light', 'Light')}${themeOption('dark', 'Dark')}</div>
      </fieldset>
      <div class="settings-demo">
        <div>
          <h3>Demo data</h3>
          <p class="muted">Clears everything you added and brings back the starting lists and pages.</p>
        </div>
        <button type="button" class="btn" data-action="reset">Reset demo data</button>
      </div>`,
  });
  addModal.showModal();
  addModal.querySelector('#f-settings-name').focus();
}

function submitSettings(form) {
  const input = form.querySelector('#f-settings-name');
  const name = input.value.trim();
  const group = currentGroup();
  if (!name) return showFieldError(input, 'Give the group a name first.');
  if (db.groups.some((g) => g !== group && g.name.toLowerCase() === name.toLowerCase())) return showFieldError(input, 'You already have a group with that name.');
  const changed = name !== group.name;
  group.name = name;
  saveOrWarn();
  addModal.close();
  if (changed) {
    route();
    toast('Settings saved');
  }
}

// New group form

function openGroupModal() {
  addModal.innerHTML = `
    <form id="group-form" novalidate>
      <header class="modal-head">
        <h2 id="add-title">New group</h2>
        <button type="button" class="icon-btn" data-action="add-close" aria-label="Close form">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </header>
      <div class="modal-body">
        <div class="field">
          <label for="f-group">Group name <span class="muted">(required)</span></label>
          <input id="f-group" name="name" maxlength="30" aria-describedby="group-error" autocomplete="off">
          <p class="error" id="group-error" hidden></p>
        </div>
        <div class="field">
          <label for="f-people">Who's in it? <span class="muted">(names, separated by commas)</span></label>
          <input id="f-people" name="people" maxlength="200" placeholder="Alex, Sam, Taylor" autocomplete="off">
        </div>
      </div>
      <footer class="modal-foot">
        <button type="button" class="btn" data-action="add-close">Cancel</button>
        <button type="submit" class="btn primary">Create group</button>
      </footer>
    </form>`;
  addModal.showModal();
  addModal.querySelector('#f-group').focus();
}

function submitGroup(form) {
  const data = new FormData(form);
  const name = String(data.get('name')).trim();
  const input = form.querySelector('#f-group');
  const error = form.querySelector('#group-error');
  const fail = (message) => {
    error.textContent = message;
    error.hidden = false;
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  };
  if (!name) return fail('Give the group a name first.');
  if (db.groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) return fail('You already have a group with that name.');

  const seen = new Set(['you', ME_NAME.toLowerCase()]);
  const people = String(data.get('people')).split(',').map((p) => p.trim()).filter((p) => {
    const key = p.toLowerCase();
    if (!p || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 11);

  const group = {
    id: uid(),
    name,
    createdBy: ME,
    members: [{ id: ME, name: ME_NAME }, ...people.map((p) => ({ id: uid(), name: p }))],
    activities: [],
  };
  db.groups.push(group);
  addModal.close();
  showGroup(group.id);
  toast(`Created "${name}"`);
}

document.addEventListener('submit', (event) => {
  if (event.target.id === 'add-form') {
    event.preventDefault();
    submitAdd(event.target);
  } else if (event.target.id === 'group-form') {
    event.preventDefault();
    submitGroup(event.target);
  } else if (event.target.id === 'invite-form') {
    event.preventDefault();
    submitInvite(event.target);
  } else if (event.target.id === 'settings-form') {
    event.preventDefault();
    submitSettings(event.target);
  }
});

document.addEventListener('input', (event) => {
  if (!['f-title', 'f-group', 'f-invite', 'f-settings-name'].includes(event.target.id)) return;
  event.target.removeAttribute('aria-invalid');
  document.getElementById(event.target.getAttribute('aria-describedby')).hidden = true;
});

document.addEventListener('change', (event) => {
  if (event.target.id === 'group-select') showGroup(event.target.value);
  if (event.target.name === 'theme') setTheme(event.target.value);
  if (event.target.id === 'panel-season') {
    find(ui.panelId).season = event.target.value;
    saveOrWarn();
    renderPanel();
    renderGrid();
    panel.querySelector('#panel-season').focus();
  }
  if (event.target.name === 'filter-category') {
    ui.category = event.target.value || null;
    syncChips();
    renderGrid();
  }
  if (event.target.dataset.filter) {
    ui[event.target.dataset.filter] = event.target.checked;
    syncChips();
    renderGrid();
  }
});

// Clicks

const actions = {
  'add-open': openAddModal,
  'group-open': openGroupModal,
  'invite-open': openInviteModal,
  'settings-open': openSettingsModal,
  'add-close': () => addModal.close(),
  'panel-close': () => panel.close(),
  open: (button) => openPanel(button.dataset.id),
  'menu-open': () => setMenu(true),
  'menu-close': () => setMenu(false),
  'filter-menu': () => setFilterMenu(document.getElementById('filter-menu').hidden),
  'filter-season': (button) => {
    ui.season = button.dataset.value || null;
    syncChips();
    renderGrid();
  },
  check: (button) => {
    location.hash = `#/editor/${button.dataset.id}`;
  },
  'filter-clear': () => {
    clearFilters();
    syncChips();
    renderGrid();
    document.getElementById('filter-btn').focus();
  },
  'toggle-in': () => {
    const a = find(ui.panelId);
    a.inIds = a.inIds.includes(ME) ? a.inIds.filter((id) => id !== ME) : [...a.inIds, ME];
    saveOrWarn();
    renderPanel();
    renderGrid();
    panel.querySelector('[data-action="toggle-in"]').focus();
  },
  'did-it': () => {
    const id = ui.panelId;
    panel.close();
    location.hash = `#/editor/${id}`;
  },
  reset: async () => {
    const ok = await askConfirm('Reset the demo?', 'This clears everything you added and brings back the starting lists and pages.', 'Reset');
    if (!ok) return;
    if (addModal.open) addModal.close();
    db = createSeed();
    saveOrWarn();
    if (location.hash === '#/list') refreshList();
    else location.hash = '#/list';
    toast('Demo data reset');
  },
};

document.addEventListener('click', (event) => {
  if (!event.target.closest('.filter-wrap')) setFilterMenu(false);
  const target = event.target.closest('[data-action]');
  if (target && target.closest('#menu-drawer') && target.dataset.action !== 'menu-close') setMenu(false);
  if (target && actions[target.dataset.action]) actions[target.dataset.action](target, event);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !document.querySelector('dialog[open]')) setMenu(false);
  const menu = document.getElementById('filter-menu');
  if (event.key !== 'Escape' || !menu || menu.hidden) return;
  setFilterMenu(false);
  document.getElementById('filter-btn').focus();
});

// Routes: #/list, #/scrapbook, #/book, #/page/<id>, #/editor/<id>

function route() {
  const hash = location.hash || '#/list';
  const [, name, id] = hash.split('/');

  if (editor.id && editor.dirty && !(name === 'editor' && id === editor.id)) {
    location.hash = `#/editor/${editor.id}`;
    askConfirm('Leave without saving?', 'Your photos, stickers and text on this page will be lost.', 'Leave').then((ok) => {
      if (!ok) return;
      editor.dirty = false;
      location.hash = hash;
    });
    return;
  }
  if (name === 'editor' && id === editor.id) return;

  stopFit();
  editor.id = null;
  document.body.classList.toggle('is-editor', name === 'editor');

  if (name === 'editor' && find(id)) {
    renderEditor(find(id));
  } else if (name === 'page' && find(id) && find(id).page) {
    renderSidebar('page');
    renderPageView(find(id));
  } else if (name === 'scrapbook') {
    renderSidebar('scrapbook');
    renderScrapbook();
  } else if (name === 'book') {
    renderSidebar('scrapbook');
    renderBook();
  } else {
    document.body.classList.remove('is-editor');
    renderSidebar('list');
    renderList();
  }
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
}

window.addEventListener('hashchange', route);
window.addEventListener('beforeunload', (event) => {
  if (editor.id && editor.dirty) event.preventDefault();
});
document.addEventListener('DOMContentLoaded', () => {
  save();
  route();
});
