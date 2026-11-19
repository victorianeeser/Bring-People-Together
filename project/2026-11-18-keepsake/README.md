# 11/18 | Keepsake branded scrapbook

A copy of the [live scrapbook](../2026-11-13-live/) (with Leandra's safety features), branded as **Keepsake** using Maya's handmade brand boards in Figma (Branding page: the Keepsake board, the sticker set and the multiplayer states).

**Live link: https://scrapbook-proto.netlify.app/?room=class**

Join the class book with the invite code **IXD415**. Change `class` to a new room name for each test session (for example `?room=test1`) so every group starts with fresh books.

It uses the same Firebase rooms as the 11/13 live version, so the books there show up here in the Keepsake look.

**Analytics:** visits to the live site are counted with [Plausible](https://plausible.io) (Leandra's account). **Public dashboard: https://plausible.io/scrapbook-proto.netlify.app** (anyone can view it; nobody can change it). Plausible uses no cookies and doesn't collect personal data. The script is in the `<head>` of [`index.html`](index.html). It only counts visits on scrapbook-proto.netlify.app, not when you run the site on your own computer.

The site also sends these events ([`js/analytics.js`](js/analytics.js)). Each one only shows up in Plausible once it's added as a goal (**Site settings > Goals > Add goal > Custom event**, with the name exactly as written):

| Event | When it's sent |
|---|---|
| `Joined the scrapbook` | Someone types their name the first time |
| `Joined a book` | Someone joins a book with its invite code |
| `Created a book` | Someone makes a new book |
| `Left a book` | Someone leaves a book |
| `Opened a book` | Someone opens a book |
| `Added an idea` | A new plan on a bucket list |
| `I'm in` | Someone says they're in for a plan |
| `We did it` | A plan is marked done |
| `Added pages` | Someone adds two blank pages |
| `Added a photo` / `Added a note` / `Added a sticker` | Something added to a page |
| `Reported something` | A report (with `kind`: photo, text, sticker or plan) |

Book events carry one label, `book`: either "IxD 415 class book" or "other book". Nothing a person types (names, titles, notes, invite codes, room names) is ever sent.

## To do for Leandra (11/19): put the new changes online

Two steps. Both need Leandra's logins, so nobody else can do them.

**1. Update the live site (Netlify).** This puts the 11/19 changes online: invite-only book links, delete only removing a book for you, bucket list editing, backgrounds, the × remove button, videos, recently uploaded, the camera roll and the photo editor.

1. Download **[keepsake-netlify-drop.zip](../keepsake-netlify-drop.zip)** (or `git pull` and use this folder).
2. In [Netlify](https://app.netlify.com), open the **scrapbook-proto** site and go to **Deploys**.
3. Drag the zip onto the page. Wait for it to say **Published**.

**2. Publish the new database rules (Firebase).** This turns on videos. Until it's done, a video only shows for the person who added it, and everyone else sees a placeholder.

1. Go to the [Firebase console](https://console.firebase.google.com) and open the **scrapbook-e2dc2** project.
2. Open **Build > Realtime Database**, then the **Rules** tab.
3. Select everything in the box, delete it, and paste in the rules below. They're the same as [`database.rules.json`](database.rules.json).
4. Click **Publish**.

What changed: the only new part is the **`videos`** section. It accepts videos (`data:video/...`) up to 10 MB each. Everything else is the same as before.

```json
{
  "rules": {
    "rooms": {
      "$room": {
        ".read": "$room.matches(/^[a-z0-9-]{1,40}$/)",
        "seeded": {
          ".write": true,
          ".validate": "newData.isBoolean()"
        },
        "books": {
          "$book": {
            ".validate": "$book.matches(/^[A-Za-z0-9_-]{1,64}$/)",
            "info": {
              ".write": true,
              ".validate": "newData.isString() && newData.val().length <= 20000"
            },
            "members": {
              "$member": {
                ".write": true,
                ".validate": "$member.matches(/^[A-Za-z0-9_-]{1,64}$/) && newData.isString() && newData.val().length <= 2000"
              }
            },
            "bucket": {
              "$idea": {
                ".write": true,
                ".validate": "$idea.matches(/^[A-Za-z0-9_-]{1,64}$/) && newData.isString() && newData.val().length <= 10000"
              }
            },
            "spreads": {
              "$spread": {
                ".write": true,
                ".validate": "$spread.matches(/^[A-Za-z0-9_-]{1,64}$/) && newData.isString() && newData.val().length <= 200000"
              }
            },
            "$other": { ".validate": false }
          }
        },
        "photos": {
          "$photo": {
            ".write": true,
            ".validate": "$photo.matches(/^[A-Za-z0-9_-]{1,64}$/) && newData.isString() && newData.val().beginsWith('data:image/') && newData.val().length <= 3000000"
          }
        },
        "videos": {
          "$video": {
            ".write": true,
            ".validate": "$video.matches(/^[A-Za-z0-9_-]{1,64}$/) && newData.isString() && newData.val().beginsWith('data:video/') && newData.val().length <= 10000000"
          }
        },
        "presence": {
          "$person": {
            ".write": true,
            ".validate": "$person.matches(/^[A-Za-z0-9_-]{1,64}$/) && newData.hasChild('name') && newData.child('name').isString() && newData.child('name').val().length <= 40"
          }
        },
        "cursors": {
          "$person": {
            ".write": true,
            ".validate": "$person.matches(/^[A-Za-z0-9_-]{1,64}$/) && newData.hasChildren()"
          }
        },
        "$other": { ".validate": false }
      }
    }
  }
}
```

To check it worked: open the live link, go to a page, click **Edit**, and add a short video. If the "couldn't be shared yet" message doesn't show up, it's working.

## Updating the live site

Keepsake replaced the 11/13 version at scrapbook-proto.netlify.app on 11/18. The site was made with Netlify Drop, so it doesn't update itself when this folder changes. To put new changes online:

1. Update **[keepsake-netlify-drop.zip](../keepsake-netlify-drop.zip)**, or `git pull` and use this `2026-11-18-keepsake` folder.
2. In Netlify, open the **scrapbook-proto** site and go to **Deploys**.
3. Drag the zip (or this folder) onto the page.

The books are saved in Firebase, so nothing is lost when the site is updated.

## What the branding changed

- **Logo.** The real Keepsake wordmark from Figma (Figma Hand, outlined, with the olive tape and the asterisk) is in the library header and the join dialog, with the tagline "every page, together". The berry drop mark is the browser tab icon. Files are in [`brand/`](brand/).
- **Colors.** Paper, Rose dust, Berry, Olive, Taupe and Maroon from the board. Maroon replaces the navy ink everywhere, the background is warm paper, and covers use the brand colors (same cover ids, so saved books keep their cover).
- **Fonts.** Headlines and the secondary font: Avenir (Nunito where Avenir isn't installed). Notes, live tags and page text: Miniver. Body: Inter. Big moments (dialog titles, buttons, the bucket list heading, cover titles): Kalam Bold, because Figma Hand isn't a web font.
- **Note fonts.** Select a note in Edit mode to pick **Notes** (Miniver, like "best night ever" on the board) or **Big moment** (Kalam Bold, like "our first trip"). Notes saved with the old fonts show as Notes.
- **Stickers.** The sticker tray is the 14 stickers from the Figma sticker set, exported as SVGs into [`brand/stickers/`](brand/stickers/). Stickers saved before the branding (stars, hearts, suns, washi tape and so on) now show as their Keepsake match.
- **Tape & doodles.** A second row in the tray has every piece from the board's Elements row, exported into [`brand/elements/`](brand/elements/): olive tape, pink tape, the berry star, the small star, the drop mark, the little notebook, and the hand-drawn heart, circle, star, sparkle, arrow and underline.
- **Covers.** Every cover is a Keepsake notebook: brand color and pattern (polka dots, sunrise, stars, stripes, waves, gingham, hearts and stars, graph paper), spiral rings down the spine like the board's notebook, real tape across the top, and the title on a paper label with a stitched edge and a doodle. Photo covers get the same tape and label.
- **Pages.** The stitched edge from the board's in-app page runs across the top of every page, and every photo gets a strip of olive or pink tape.
- **Hand-drawn touches.** The underline sits under the selected book's title and "Our bucket list", the circle goes around the page numbers, and the heart, star, sparkle and small star are scattered around the library and the join dialog.
- **People colors.** Everyone's color is from the brand palette (taupe, berry, olive first). People saved with the old colors are shown in the matching brand color. Names on tags are lowercase like the board.
- **All 9 multiplayer states from the board:**
  1. **Who's here now:** your face and everyone else's in the book header, with an olive "N here now" pill.
  2. **See what someone is touching:** a dashed outline in their color with their name tag.
  3. **Smooth drag:** things someone else moves glide on your screen.
  4. **Someone is typing:** their text box gets a solid outline and a "leandra is typing •••" pill with the board's typing dots.
  5. **Who's on which page:** in **See all spreads**, each spread shows the faces of the people on it ("you're here", "2 people").
  6. **Heads up, not a surprise:** things someone else adds fade in with a soft glow and a "new" tag, and a note says "tori added a photo to this page".
  7. **Pick who's in this book:** invite codes, unchanged from the 11/13 version.
  8. **Empty book:** a blank spread shows a dashed "nothing here yet" card with a star sticker and tape.
  9. **Just you here:** with nobody else in the book, the header says "just you" and has an **invite friends** button that copies the invite.
- **Cursors.** The live cursor is the rounded triangle from the board's Elements row, in each person's color.

What's still different from the board: the words don't appear letter by letter while someone types (they show when they finish), and the big moments use Kalam Bold because Figma Hand isn't a web font (the logo itself is the real Figma Hand artwork).

## Photo editor (11/19, from the 11/18 crit)

**The "who added this" tag** now floats above the whole spread, so it's never cut off by the page edge or hidden under other photos. Near the bottom of a page it shows above the item instead of below.

**Double-click any photo or video** to open the photo editor (it turns on Edit mode if it's off), or select it and click **Edit photo**. This works on the demo books' color-block photos too. The preview on the left shows exactly how it'll look on the page.

- **Crop.** Drag the box to move it and drag its corner to resize it. Presets: Free, Square, 4:3, 3:4 and 16:9. **Reset** goes back to the whole photo. Resizing the photo on the page still works with the corner handle or the **Size** slider.
- **Frame & cut-out.** **Polaroid** (white border and tape, the default), **Plain** (just the photo with a soft shadow), or **Cut-out sticker**: the photo in a circle, heart, star, scallop or rounded shape with a white die-cut edge, like the sticker set. Round shapes square up the crop automatically.
- **Filter.** Original, Warm, Vintage, B&W, Faded, Rosy, Film or Cool.
- **Fit it in the frame.** Under the preview, **Zoom** makes the photo bigger or smaller inside its frame or sticker shape, and dragging the photo in the preview moves it, so the part you want shows in the heart, star or circle. The frame keeps its shape while you do it.

**Save** applies it for everyone, and Undo takes it back.

**Who can edit a photo.** Anyone in the book can edit any photo or video: crop, frame, filter, move and resize, with no permission messages. Removing one stays with the person who added it (and the book's creator), so nobody can delete someone else's photos. The side panel says "Anyone can edit it. Only Tori can remove it." Stickers and notes still follow the original rule: only the person who added them (or the book's creator) can change them.

## Editing the page (11/19, from the 11/18 crit)

- **Removing things.** Select anything in Edit mode and click the berry **×** on its corner, or press Delete. The × sits in a layer above the whole spread, so tape and other photos can't cover it, and it stays inside the book even when the item hangs off the page edge. On someone else's photo, note or sticker the × is gray and explains that only they (or the book's creator) can remove it, and you can report it instead. (Anyone can still edit other people's photos; see the photo editor below.) That's Leandra's safety rule from [threats.md](../../threats.md).
- **Videos.** Drag a video onto a page or use **Browse**, like a photo. It goes on the page as a polaroid that plays on a loop with no sound. Videos can be up to 7 MB (a short phone clip), because the database stores up to 10 MB per file.
- **Recently uploaded.** Under the photo drop zone in the edit panel, the 8 newest photos and videos in the book. Click one to put it on the page you're on.
- **Camera roll.** The camera button in the book's top right (or **Camera roll** next to Recently uploaded) shows every photo and video in the book, from everyone. **Add photos or videos** uploads straight to it without putting them on a page, and clicking one adds it to the page you're on.

**Videos need the new database rules published.** See [To do for Leandra](#to-do-for-leandra-1119-put-the-new-changes-online) at the top. Until then, a video shows for the person who added it, and everyone else sees a placeholder.

## Bucket list editing and backgrounds (11/19, from the 11/18 crit)

- **Edit an idea.** Click an idea on the bucket list, then **Edit this idea**. The form opens filled in: change the name, where, when, season, cost, category or notes and **Save changes**. If the idea already has a spread, its spread title changes with it. Anyone can edit ideas from before credit existed; otherwise it's the person who added it or the book's creator.
- **Remove an idea.** In the edit form, **Remove from the list** takes it off the bucket list for everyone. Its pages stay in the book.
- **Bucket list background.** **change background** in the top right of the bucket list opens 8 papers: paper, graph paper, dots, lined, gingham, rose, butter and sage. Everyone in the book sees the one you pick.
- **Page backgrounds.** In Edit mode, **Page background** in the edit panel sets the same papers for the spread you're on. Undo works on it.

## Invite-only fixes (11/19, from the 11/18 crit)

- **A book link doesn't open a book you're not in.** Opening a link to someone else's book (like `#/book/book-ixd415`) shows "This book is invite only" with **Join with a code**. Once you join with the right code, the book opens. Your library only ever shows the books you've joined.
- **The who's here list doesn't name books you're not in.** It says "In another book" instead.
- **Delete only removes the book for you.** If anyone else is in the book, Delete becomes **Remove from my books**: it leaves your library and stays for everyone else, and you can join again with its code. It's only deleted for good when you're the last person in it.
- **Reset demo data is hidden in the class room** (`?room=class`), because it wipes every book for everyone. It still shows in test rooms.

People who used the 11/13 version before invite codes were added to every book automatically, and they're still members of those books.

## Saving fixes (11/18)

- **Edit waits until it's connected.** Before, anything you did while the bottom bar said "Connecting…" was never sent, and it was wiped when the shared books loaded. Now Edit says "Still connecting…" until the books have loaded.
- **Failed saves aren't silent.** Before, if the database refused one piece of a change, the whole change disappeared without a message. Now each piece is retried on its own, and if something still doesn't save you get a message saying so.

## Run it

```bash
python3 -m http.server 8090
```

Then go to [http://localhost:8090/?room=class](http://localhost:8090/?room=class).

To put it online, drag this `2026-11-18-keepsake` folder onto [Netlify Drop](https://app.netlify.com/drop) (a new site, so the 11/13 link stays as it is).

---

*Everything below is from the 11/13 live version and still applies.*

## What's different from the original

- **Join with your name.** The first time you open it, it asks what your friends should call you.
- **Books are invite only.** Your library shows only the books you're in. To join one, click **Join a book** and type its invite code. **Try the class book with the code `IXD415`.** Each book's code shows next to its people in the library (click it to copy), and **Share** copies an invite with the link and the code. New books get their own code.
- **Leave book** is in the **More** menu. The book stays for everyone else; you can come back with its code.
- **Add pages** (under the book) adds two blank pages right after the ones you're on and opens them for editing, so books without a bucket list can grow too.
- **Who's here.** A bar in the bottom-left corner shows **Live**, how many people are here, and a circle for each person. Click it to see a list of everyone here and where they are (which book, which pages, and whether they're editing). **Copy link** copies the link to send to others.
- **Live cursors.** On a spread, you see everyone else on the same pages: their cursor with their name, and a colored outline around whatever they've selected. When someone drags, resizes or rotates something, it glides on your screen as they move it. Each person gets their own color.
- **Here now.** The top right of an open book shows who else is in it. Click someone to jump to the pages they're on.
- **Rooms.** The link ends in `?room=class`. A different room name (`?room=test1`) is a separate set of books, so each test can start fresh.
- **Photos are shared.** Uploaded photos are saved to the room, so everyone sees them. They're shrunk to 1200px to keep them quick to load.
- **Reset demo data** resets the room **for everyone** on that link.

If two people edit the **same spread** at the exact same moment, the last save wins. Different spreads and different ideas never overwrite each other.

## Safety features (from [threats.md](../../threats.md))

- **Every photo, note and sticker shows who added it.** Hover over it, or select it in Edit mode, to see a tag with their name in their color. Nothing is anonymous. *(Mean captions and stickers)*
- **You can only change your own things.** In Edit mode you can select anyone's item, but only the person who added it can move, resize, rotate, recolor, edit or remove it. The person who **made the book** can change anything. Undo only brings back your own things, so it can never erase what someone else added. Things in the demo books from before this feature have no name on them, so anyone can still change them. *(Erasing someone from the year)*
- **Report.** Select someone else's photo, note or sticker in Edit mode and click **Report**, or open a plan on the bucket list and click **Report this plan**. It's hidden for you right away and hidden for everyone after **2 reports**. Reporting an **intimate photo** removes it for everyone on the first report and shows links to [Take It Down](https://takeitdown.ncmec.org/) and [StopNCII](https://stopncii.org/). Reported things stay in the database (hidden), so they could be reviewed. *(Mean captions, Piling on, Pressure to do risky things, An ex who's still in the group)*
- **A limit on piling on.** One person can add at most **10 things to a spread per minute**. After that they're told how many seconds to wait. *(Piling on)*
- **Photo location is removed.** Every uploaded photo is redrawn and saved as a new JPEG, which drops the hidden location (GPS) info. *(Location in photos)*
- **Tighter database rules** in [`database.rules.json`](database.rules.json): the database only accepts the kinds of data the app uses (books, photos, who's here, cursors), with size limits on each, and nobody can wipe a whole room or list every room in one request.

**What this doesn't stop:** there are no accounts, so the database can't tell people apart. Own-only edits, reports and the add limit are checked by the app, so someone who knows how to edit the code in their browser could get around them. A real version would need sign-in (for example Firebase Authentication) so the database rules can check who is making each change.

## Firebase

The shared books live in a free Firebase Realtime Database. **This is already set up** (project `scrapbook-e2dc2`, config in [`js/firebase-config.js`](js/firebase-config.js)). The steps below are how it was done, in case it ever needs redoing. If the config is emptied, this folder works like the original one-person demo.

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and sign in with a Google account. **Create a project** (any name, Google Analytics can be off).
2. In the left menu, open **Build > Realtime Database** and click **Create Database**. Pick a location, then choose **Start in test mode**.
3. Open the **Rules** tab, replace everything with the contents of [`database.rules.json`](database.rules.json), and click **Publish**.
4. Go to **Project settings** (gear icon) > **Your apps** > the **</>** (Web) button. Register an app (any nickname, no hosting).
5. Copy the values from the `firebaseConfig` it shows into [`js/firebase-config.js`](js/firebase-config.js): `apiKey`, `authDomain`, `databaseURL`, `projectId`, `appId`. If `databaseURL` is missing, copy it from the top of the Realtime Database page (it ends in `firebaseio.com` or `firebasedatabase.app`).
6. Commit and push. The Firebase values aren't secret; they just name the project.

**Privacy note:** anyone who has the link and room name can still read and change the books. That's fine for a class test. Don't put anything private in it.

## Run it

Open a terminal in this folder and run:

```bash
python3 -m http.server 8083
```

Then go to [http://localhost:8083/?room=class](http://localhost:8083/?room=class). To try it as two people on one computer, open the link in a normal window and a private window.

With GitHub Pages on, the link to share is:
`https://victorianeeser.github.io/Bring-People-Together/project/2026-11-13-live/?room=class`

## What was added

| File | What it does |
|---|---|
| `js/firebase-config.js` | Your Firebase project's config |
| `js/sync.js` | Sends changes to the room and applies other people's changes, shares photos, tracks who's here and their cursors |
| `js/identity.js` | Who you are in this browser: an id, the name you typed, and your live color |
| `js/moderation.js` | Safety rules: who can change what, when reported things are hidden, the add limit |
| `js/report.js` | The Report dialog and the take-down help links |
| `database.rules.json` | The Firebase Realtime Database rules to paste into the console |
| `js/join.js` | "Join a book" with an invite code |
| `js/state.js` | Same as before, plus sending every change to the room and adding you to each book |
| `js/storage.js` | Same as before, plus uploading and downloading shared photos |
| `js/book.js` | Same as before, plus redrawing an open book when someone else changes it (it waits until you finish a drag or a page turn) and drawing other people's cursors |
| `js/main.js` | Same as before, plus the join dialog and the "who's here" bar |
| `js/seed.js` | The demo books use a member called Hannah instead of "you" |
