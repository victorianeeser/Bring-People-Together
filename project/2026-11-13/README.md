# 11/13 | Shared scrapbook (round 1)

Round-1 prototype for IxD415, "Bring People Together."

## The concept

A shared digital scrapbook for friend groups. A group keeps a library of **books**: one for a friend group, a trip, a semester, movie nights, anything. Each book is made of **spreads** (two facing pages) that the group fills with photos, notes, and stickers.

A book can have a **bucket list**. When it's on, the bucket list lives on the first spread and works like a **table of contents**. Each item is something the group wants to do. When they do it, they click **We did it!**, the book gets a new spread for it, and the item turns into a page link ("p. 7 →") that jumps straight there.

The loop: add ideas to the list → do them together → make a spread → the book fills up over time.

## Try it

- **Library:** browse books in the carousel (arrow keys, scroll, or click a side book), or switch to the grid. Click the center book to open it. The circles under the title are the people in the book. Use **+** next to them to add someone by email.
- **New book:** give it a title, pick a cover (or upload a photo), add people, and choose whether to include a bucket list.
- **Bucket list:** click an idea for its details, **I'm in**, and **We did it!** Click **+ Add an idea** to add one.
- **Editing a spread:** click **Edit** under the page number. A panel opens on the right with photos, a text box, and stickers. Click anything on the page to move, resize, or rotate it. **Cmd+Z** undoes.
- **More menu (library):** Book settings (rename, change the cover, turn the bucket list on or off) and **Reset demo data**.

This is a one-person demo. Everything saves in your browser (books in localStorage, photos in IndexedDB), so friends on other computers won't see your changes. **Reset demo data** brings back the starting books.

## Run it

Open a terminal in this folder and run:

```bash
python3 -m http.server 8083
```

Then go to [http://localhost:8083](http://localhost:8083). Press `Ctrl+C` in the terminal to stop it.

It has to run from a local server (not by double-clicking `index.html`), because the code uses JavaScript modules.

## Turn on GitHub Pages

1. Push this folder to GitHub.
2. On the repo, go to **Settings > Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose the **main** branch and the **/ (root)** folder, then click **Save**.
5. After a minute or two, the prototype will be at:
   `https://victorianeeser.github.io/Bring-People-Together/project/2026-11-13/`

## How it's built

Plain HTML, CSS, and JavaScript modules. No framework and no build step.

| File | What it does |
|---|---|
| `js/model.js` | Data model: books, spreads, bucket list items, page items, covers |
| `js/state.js` | The book data and every action that changes it; saves on each change |
| `js/storage.js` | localStorage for book data, IndexedDB for photos (resized to 1600px) |
| `js/seed.js` | Demo books: The Roomies, Summer '26, Movie Nights |
| `js/library.js` | The library carousel and grid |
| `js/bookform.js` | New book and Book settings |
| `js/book.js` | The open book: spreads, page edges, page turns, overview |
| `js/toc.js` | Bucket list popover and the Add an idea form |
| `js/editor.js` | Editing a spread: the side panel, select, move, resize, rotate, undo |
| `js/pages.js`, `js/covers.js`, `js/stickers.js` | Drawing pages, covers, and stickers |
| `js/transitions.js` | Opening a book: the cover pulls up and flips open |
| `js/animation.js` | Animation timings (press <kbd>`</kbd> for a panel to tune them) |

`js/opening.js` is an earlier, fuller 3D opening animation that's turned off for now.

The fonts are plain Inter for now; branding will bring in display and handwriting fonts.
