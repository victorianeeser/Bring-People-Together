// The Report dialog (threats.md: "Mean captions and stickers", "Piling on", "Pressure to do risky things",
// "An ex who's still in the group"). Resolves with { intimate } when the person reports, or null if they cancel.

import { esc } from './ui.js';
import { REPORTS_TO_HIDE } from './moderation.js';

const NOUN = { photo: 'photo', text: 'note', sticker: 'sticker', idea: 'plan' };

export function openReportDialog(kind) {
  const dialog = document.getElementById('confirm');
  const noun = NOUN[kind] || 'item';
  const reasons = [
    ['mean', `It's mean or makes fun of someone`],
    ['private', `It's private or embarrassing`],
    ...(kind === 'idea' ? [['pressure', 'It pressures people into something risky']] : []),
    ...(kind === 'photo' ? [['intimate', 'It\'s an intimate or nude photo of someone']] : []),
    ['other', 'Something else'],
  ];
  dialog.innerHTML = `
    <form method="dialog" class="confirm-box report-box">
      <h2 id="confirm-title">Report this ${esc(noun)}?</h2>
      <p>It's hidden for you right away. If ${REPORTS_TO_HIDE - 1} more person reports it, it's hidden for everyone. Your name isn't shown to anyone.</p>
      <fieldset class="report-reasons">
        <legend>What's wrong with it?</legend>
        ${reasons.map(([value, label], i) => `
          <label><input type="radio" name="reason" value="${value}" ${i === 0 ? 'checked' : ''}> ${esc(label)}</label>`).join('')}
      </fieldset>
      <p class="report-intimate-note" hidden>An intimate photo is removed for everyone as soon as it's reported.</p>
      <div class="confirm-actions">
        <button class="pill-btn" value="cancel">Cancel</button>
        <button class="pill-btn solid danger" value="ok">Report</button>
      </div>
    </form>`;
  dialog.setAttribute('aria-labelledby', 'confirm-title');
  const form = dialog.querySelector('form');
  const note = form.querySelector('.report-intimate-note');
  form.addEventListener('change', () => { note.hidden = form.elements.reason.value !== 'intimate'; });
  const opener = document.activeElement;
  dialog.showModal();
  form.querySelector('[value="cancel"]').focus();
  return new Promise((resolve) => {
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      resolve(result);
      opener?.focus?.();
    };
    form.addEventListener('submit', (event) => {
      finish(event.submitter?.value === 'ok' ? { intimate: form.elements.reason.value === 'intimate', reason: form.elements.reason.value } : null);
    }, { once: true });
    dialog.addEventListener('close', () => finish(null), { once: true });
  });
}

// After an intimate photo is reported: where to get it taken down everywhere else too.
export function showTakeDownHelp() {
  const dialog = document.getElementById('confirm');
  dialog.innerHTML = `
    <form method="dialog" class="confirm-box">
      <h2 id="confirm-title">The photo is removed</h2>
      <p>Nobody in the book can see it now. If it's been shared anywhere else, these free services can help get it taken down:</p>
      <ul class="help-links">
        <li><a href="https://takeitdown.ncmec.org/" target="_blank" rel="noopener">Take It Down</a> if the person in the photo is under 18</li>
        <li><a href="https://stopncii.org/" target="_blank" rel="noopener">StopNCII</a> if they're 18 or over</li>
      </ul>
      <div class="confirm-actions">
        <button class="pill-btn solid" value="ok">OK</button>
      </div>
    </form>`;
  dialog.setAttribute('aria-labelledby', 'confirm-title');
  dialog.showModal();
}
