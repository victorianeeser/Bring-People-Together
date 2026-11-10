# Multiplayer Board: tldraw sync proof of concept

**Live multiplayer link: https://mayawalsh19-art.github.io/multiplayer-poc/**

Open it, click **Copy link**, and send it to others. Everyone on the same link draws on the same board at once.

A shared whiteboard. Everyone who opens the same `?room=` link draws on the same canvas live, with cursors, names, and presence.

- **Deployed from:** https://github.com/mayawalsh19-art/multiplayer-poc
- **Stack:** Vite + React + `tldraw` + `@tldraw/sync` (`useSyncDemo`, which uses tldraw's hosted demo sync server)

## Run locally
    npm install
    npm run dev

## Notes
- The demo sync server is for prototyping: rooms are public to anyone with the ID and get wiped after about a day.
- For something real, swap `useSyncDemo` for `useSync` pointed at your own server (tldraw's `sync-cloudflare` template).
