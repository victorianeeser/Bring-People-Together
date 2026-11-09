# 11/8 | Bucket List prototype

Round-1 prototype for IxD415, "Bring People Together."

**The concept:** A shared bucket list for a group of friends. Anyone in the group can add an activity, and friends say "I'm in." When the group finishes something, it becomes a scrapbook page with photos, a caption and stickers.

This is a one-person demo. It saves to your browser's localStorage, so friends on other computers won't see your changes. The photos on the demo pages are drawings that stand in for real ones.

## Run it
Open a terminal in this folder and run:

```bash
python3 -m http.server 8080
```

Then go to [http://localhost:8080](http://localhost:8080). Press `Ctrl+C` in the terminal to stop it.

"Reset demo data" in Settings brings back the starting lists and pages.

## Turn on GitHub Pages
1. Push this folder to GitHub.
2. On the repo, go to **Settings > Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose the **main** branch and the **/ (root)** folder, then click **Save**.
5. After a minute or two, the prototype will be at:
   `https://victorianeeser.github.io/Bring-People-Together/notes/victoria/2026-11-08/bucketlist/`
