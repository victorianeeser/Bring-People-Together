# Multiplayer Board: tldraw sync proof of concept

**Live multiplayer link: https://mayawalsh19-art.github.io/multiplayer-poc/?room=class**

Open it, click **Copy link**, and send it to others. Everyone on the same link draws on the same board at once.

A shared whiteboard. Everyone who opens the same `?room=` link draws on the same canvas live, with cursors, names, and presence.

- **Deployed from:** https://github.com/mayawalsh19-art/multiplayer-poc
- **Stack:** Vite + React + `tldraw` + `@tldraw/sync` (`useSyncDemo`, which uses tldraw's hosted demo sync server)

## Run locally
    cd app
    npm install
    npm run dev

## Notes
- tldraw needs a license key on a real website, or the board disappears after about 5 seconds. The live site gets its key from the `TLDRAW_LICENSE_KEY` variable on the source repo. Locally (`npm run dev`) no key is needed.
- The demo sync server is for prototyping: rooms are public to anyone with the ID and get wiped after about a day.
- For something real, swap `useSyncDemo` for `useSync` pointed at your own server (tldraw's `sync-cloudflare` template).
