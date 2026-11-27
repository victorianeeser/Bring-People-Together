// Counts what people do, with Plausible (the script is in index.html).
// Only the event name and a few plain labels are sent: never names, invite codes, room names,
// text, or photos. Plausible only records these on keepsake2.netlify.app, not on your computer.
// To see an event in the dashboard, add its name as a goal in Plausible (Site settings > Goals).

export const EVENTS = {
  joinedScrapbook: 'Joined the scrapbook',
  joinedBook: 'Joined a book',
  createdBook: 'Created a book',
  leftBook: 'Left a book',
  openedBook: 'Opened a book',
  addedIdea: 'Added an idea',
  imIn: "I'm in",
  weDidIt: 'We did it',
  addedPages: 'Added pages',
  addedPhoto: 'Added a photo',
  addedNote: 'Added a note',
  addedSticker: 'Added a sticker',
  reported: 'Reported something',
};

// props: a few plain labels, e.g. { kind: 'photo' }. Never anything a person typed.
export function track(name, props) {
  try {
    if (typeof window.plausible !== 'function') return;
    window.plausible(name, props ? { props } : undefined);
  } catch {
    // Analytics must never break the scrapbook.
  }
}
