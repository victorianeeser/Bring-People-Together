# 11/13 | Shared scrapbook, live version

A copy of Victoria's [11/13 prototype](../2026-11-13/) that several people can use **at the same time**, for our 5-person live test. Victoria's folder is unchanged.

**Live link: https://scrapbook-proto.netlify.app/?room=class**

Send that link to testers. Change `class` to a new room name for each test session (for example `?room=test1`) so every group starts with fresh books.

The Netlify site was made with Netlify Drop, so it doesn't update itself when this folder changes. After changing the code, drag the `2026-11-13-live` folder onto the site's **Deploys** page in Netlify again. The books are stored in Firebase, so redeploying doesn't lose anything.

Everyone who opens the same link shares the same books. When someone adds an idea, clicks **I'm in** or **We did it!**, or edits a spread, everyone else sees it within a second or two, including spreads that are open on their screen.

## What's different from the original

- **Join with your name.** The first time you open it, it asks what your friends should call you. You're added to every book, so your face shows up on ideas and "I'm in".
- **Who's here.** A bar in the bottom-left corner shows **Live**, how many people are here, and a circle for each person. Hover over a circle to see which book they're in. **Copy link** copies the link to send to others.
- **Rooms.** The link ends in `?room=class`. A different room name (`?room=test1`) is a separate set of books, so each test can start fresh.
- **Photos are shared.** Uploaded photos are saved to the room, so everyone sees them. They're shrunk to 1200px to keep them quick to load.
- **Reset demo data** resets the room **for everyone** on that link.

If two people edit the **same spread** at the exact same moment, the last save wins. Different spreads and different ideas never overwrite each other.

## Firebase

The shared books live in a free Firebase Realtime Database. **This is already set up** (project `scrapbook-e2dc2`, config in [`js/firebase-config.js`](js/firebase-config.js)). The steps below are how it was done, in case it ever needs redoing. If the config is emptied, this folder works like the original one-person demo.

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and sign in with a Google account. **Create a project** (any name, Google Analytics can be off).
2. In the left menu, open **Build > Realtime Database** and click **Create Database**. Pick a location, then choose **Start in test mode**.
3. Open the **Rules** tab, replace everything with this, and click **Publish**:
   ```json
   {
     "rules": {
       "rooms": { ".read": true, ".write": true }
     }
   }
   ```
4. Go to **Project settings** (gear icon) > **Your apps** > the **</>** (Web) button. Register an app (any nickname, no hosting).
5. Copy the values from the `firebaseConfig` it shows into [`js/firebase-config.js`](js/firebase-config.js): `apiKey`, `authDomain`, `databaseURL`, `projectId`, `appId`. If `databaseURL` is missing, copy it from the top of the Realtime Database page (it ends in `firebaseio.com` or `firebasedatabase.app`).
6. Commit and push. The Firebase values aren't secret; they just name the project.

**Privacy note:** with these rules, anyone who has the link and room name can read and change the books. That's fine for a class test. Don't put anything private in it.

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
| `js/sync.js` | Sends changes to the room and applies other people's changes, shares photos, tracks who's here |
| `js/identity.js` | Who you are in this browser: an id and the name you typed |
| `js/state.js` | Same as before, plus sending every change to the room and adding you to each book |
| `js/storage.js` | Same as before, plus uploading and downloading shared photos |
| `js/book.js` | Same as before, plus redrawing an open book when someone else changes it (it waits until you finish a drag or a page turn) |
| `js/main.js` | Same as before, plus the join dialog and the "who's here" bar |
| `js/seed.js` | The demo books use a member called Hannah instead of "you" |
