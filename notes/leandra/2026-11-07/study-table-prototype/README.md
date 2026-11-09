# 11/7 | Study Table prototype

Round-1 prototype for IxD415, "Bring People Together."

**The concept:** A quiet online study table for friends: set your goals, focus together, and check in every hour to show your work.

Everyone sits at a shared table and adds a short checklist of goals. One focus timer runs for the whole table. During focus there's no chat and no video, only who is focusing and how many goals they've checked off. When the timer ends, everyone checks in: did you hit your goals, show your work, set goals for the next hour, and friends react or leave a quick comment. Anyone can pause the timer or end the session for everyone.

## Live version
[Open Study Table](https://claude.ai/artifact/UCUDsFj9YRPgMPmC7PrbZ9)

The live table (seeing friends and sharing one clock) only works in that link, for people signed in to claude.ai. The copy in this folder runs in **solo mode**: everything works, but only you are at the table.

Tip for testing: open **Timing** on the start screen and pick **1 min** focus to reach the check-in quickly.

## Run it
Open a terminal in this folder and run:

```bash
python3 -m http.server 8080
```

Then go to [http://localhost:8080](http://localhost:8080). Press `Ctrl+C` in the terminal to stop it.

With GitHub Pages turned on for the repo, the solo version is at:
`https://victorianeeser.github.io/Bring-People-Together/notes/leandra/2026-11-07/study-table-prototype/`

## Testing notes
See [leandra-rough-prototype.md](../leandra-rough-prototype.md).
