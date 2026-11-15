# 11/14 | Live version test notes

A tech check of the [live scrapbook](../../../project/2026-11-13-live/) before our 5-person test, done with Claude Code. Two browser windows played two people, "Ana" (on the [Netlify site](https://scrapbook-proto.netlify.app/?room=class)) and "Ben", in the same room on our Firebase. These were test windows, not real users, so this doesn't count toward our testers.

## What works

- **Joining:** each person types a name, and the bar in the corner shows **Live · 2 here** with a circle for each person. Hovering over a circle shows which book they're in.
- **Adding an idea:** Ana added "Picnic at the lake," and it showed up on Ben's open bucket list 1–2 seconds later, marked "added by A."
- **"I'm in":** Ben clicked "I'm in," and his face appeared next to the idea on Ana's screen.
- **"We did it!":** Ana marked the picnic done. On Ben's list it got crossed out with a "p. 7 →" link that took him to the new picnic page.
- **Editing a page:** Ana added a sticker and Ben saw it. When Ana dragged it, Ben saw it jump to the new spot when she let go.
- **Leaving:** when Ben closed his window, Ana's bar went back to **1 here** right away.

## Problems

1. **Two people editing the same page at the same moment can lose a change.** Ana and Ben each added a note to the picnic page within about a second. Only Ben's note was saved. A few seconds apart, both changes stay.
2. **Everyone's circle in the "who's here" bar is the same peach color**, so people are hard to tell apart.
3. **It doesn't fit on phones.** The library gets cut off and the open book is too small to use. This comes from the original layout, not the live version. Testers should use laptops.
4. **Other people see items jump, not slide.** Moves show up when the item is dropped, not while it's being dragged.

## Things to watch for in the real test

- Does everyone notice the **Live · 5 here** bar?
- Do people try to decorate the same page together? That's where problem 1 shows up.
- Use a new room name for each session (`?room=test1`, `?room=test2`) so each group starts fresh.
