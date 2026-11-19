# Log

Updated at least weekly. For each entry: what we tested, with whom, what happened, what surprised us. Oldest at the top.

## Nov 2

- **Victoria:** created the repo
- **Maya:** set up the log, todo, numbers and notes
- **Everyone:** added names to the README

## Nov 3

- **Leandra:** tried 3 multiplayer products, added interview takeaways and a transcript
- **Maya:** tried 3 multiplayer products, added interview notes, wrote README paragraph

## Nov 4

- **Victoria:** organized the README by name and the notes by person, tried 3 multiplayer products, added notes and transcripts from 3 interviews, wrote README paragraph, updated numbers and log
- **Maya:** came up with 10 storyboard ideas from her interviews, sketched all 10 by hand, added cropped sketches and descriptions, added her 3 interview transcripts, prototyped storyboard 9 "Settle It" (an iMessage-style group chat where a quick mini game decides the plan and the winner picks), tested the idea with 5 people (Addie, Lanie, Anthony, Charles, Megan), documented their reactions and the prototype changes they led to, added prototype 1 screens
- **Leandra** came up with 10 storyboard sketches from interviews. Picked "study group" idea to pursue prototyping.

## Nov 7

- **Leandra** finished a rough prototype of the study group web app. Ready for testing and tested the prototype with two people.

## Nov 8

- **Victoria:** made a prototype of the Bucket List idea (a shared checklist that turns finished plans into scrapbook pages) with Claude Code

## Nov 9

- **Everyone:** got feedback in class crit ([notes](notes/crit/2026-11-09/crit-notes.md))

## Nov 10

- **Leandra:** researched existing scrapbook and bucket list platforms (Canva, Mixbook, Memora, The Bucket App) and made a moodboard for the group's digital bucket list and scrapbook platform
- **Everyone:** worked in Figma on inspo, concept, user persona, research, branding, and wireframes (screenshot of [Victoria's workboard](notes/victoria/2026-11-10/figma-board-progress.webp))
- **Everyone:** decided to move forward with Victoria's bucket list and scrapbook idea, and started a [rough draft](project/2026-11-10-rough-draft/) from her prototype
- **Maya:** built a shared whiteboard where several people can draw on the same board at the same time from one link, put it online, and added it to [notes/multiplayer-poc](notes/multiplayer-poc/) ([try it](https://mayawalsh19-art.github.io/multiplayer-poc/?room=class)); in Figma, compared 6 apps that turn photos and plans into books, made 2 inspo boards with notes, and wrote persona notes from her interviews; wrote our final idea and who we're designing for in the README; typed up Monday's [crit notes](notes/crit/2026-11-09/crit-notes.md)

## Nov 12

- **Maya:** created [branding/logo options](notes/maya/2026-11-12/maya.md), created [threats.md](threats.md) and filled it out

## Nov 13

- **Victoria:** redid the [prototype](project/2026-11-13/) so it flows better, getting it ready for this weekend's user testing
- **Leandra:** made a [live version](project/2026-11-13-live/) of the prototype with Claude Code so several people can use it at the same time for our 5-person test: shared books, photos, and a "who's here" bar, synced through Firebase. Set up the Firebase project, tested it with two browsers, and put it online with Netlify ([try it](https://scrapbook-proto.netlify.app/?room=class))
- **Victoria:** tested the [prototype](project/2026-11-13/) with 5 people in person on one shared laptop, one at a time and then as a group. Testers liked testing together. Found that everyone gets added to all three books automatically, "live here" isn't clickable, and the page flip jumps when the edit button pushes the book down. [Notes and photo](notes/victoria/2026-11-13/victoria-user-testing.md)

## Nov 14

- **Leandra:** tested the [live version](project/2026-11-13-live/) with 5 people at the library, each on their own laptop. Joining, adding bucket list ideas and adding stickers all synced to everyone. Found that everyone's circle in the "who's here" bar is the same peach color, and other people see moved items jump instead of slide. [Notes](notes/leandra/2026-11-14/group-testing-notes.md)

## Nov 15

- **Maya:** tested the [live scrapbook](project/2026-11-13-live/) with 5 people. Everyone knew what to click and how to add things, and adding friends was easy. Found that stickers can't be deleted and show up on every spread. [Notes, photos and video](notes/maya/2026-11-15/maya-user-testing.md)

## Nov 16

- **Maya:** added [crit notes](notes/crit/2026-11-16/crit-notes.md) from class, made the [to do list](todo.md) for Wednesday, November 18

## Nov 17

- **Maya:** made the logo more handwritten, made two handmade brand boards (Stuck Together and Keepsake), a sticker set, and 9 multiplayer state designs in Figma. [Notes and images](notes/maya/2026-11-17/maya.md)
- **Leandra:** added safety features from [threats.md](threats.md) to the [live scrapbook](project/2026-11-13-live/) with Claude Code: every photo, note and sticker shows who added it; only the person who added something (or the book's creator) can change or remove it; anyone can report a photo, note, sticker or plan (hidden for them right away, for everyone after 2 reports, and intimate photos are removed on the first report with links to Take It Down and StopNCII); and a limit of 10 additions per person per spread per minute. Set up tighter Firebase database rules ([database.rules.json](project/2026-11-13-live/database.rules.json)) that block wiping a room, unexpected data and oversized uploads, and tested everything with two browsers

## Nov 18

- **Maya:** branded the scrapbook prototype as Keepsake with Claude Code: new logo, colors, fonts (secondary font changed to Avenir), stickers, tape and doodles, notebook covers, and all 9 multiplayer states. Tested it and fixed changes not saving. [Notes and images](notes/maya/2026-11-18/maya.md), [prototype](project/2026-11-18-keepsake/)
- **Maya:** added [crit notes](notes/crit/2026-11-18/crit-notes.md) from class
- **Maya:** made the [to do list](todo.md) for Monday, November 23
- **Leandra:** put the [Keepsake version](project/2026-11-18-keepsake/) online at the [live link](https://scrapbook-proto.netlify.app/?room=class) with Claude Code, replacing the 11/13 version. Added [Plausible](https://plausible.io) analytics to count visits (no cookies, no personal data), plus events for key actions like joining, opening or making a book, adding ideas, pages, photos, notes and stickers, and reporting something

## Nov 19

- **Maya:** fixed joining and deleting books in the [Keepsake prototype](project/2026-11-18-keepsake/) with Claude Code, from the [11/18 crit](notes/crit/2026-11-18/crit-notes.md): an invite code now only gets you into that one book (a link to a book you're not in asks for its code), and deleting a book only removes it from your own books unless you're the last one in it
- **Maya:** made the bucket list editable in the [Keepsake prototype](project/2026-11-18-keepsake/) with Claude Code (edit or remove ideas), and added backgrounds for the bucket list and every page: paper, graph paper, dots, lined, gingham, rose, butter and sage
- **Maya:** added more page editing to the [Keepsake prototype](project/2026-11-18-keepsake/) with Claude Code: a × to remove things, videos on the page, a recently uploaded row, and a camera roll for each book with every photo and video in it
- **Maya:** added a photo editor to the [Keepsake prototype](project/2026-11-18-keepsake/) with Claude Code: double-click a photo or video to crop it, turn it into a cut-out sticker (circle, heart, star, scallop or rounded), change its frame, or add a filter. Also put the steps for Leandra (update Netlify and publish the video rules) at the top of the README
- **Maya:** made every photo editable by anyone in the book with no permission messages (only the person who added a photo can still remove it)
- **Maya:** fixed the "who added this" tag getting cut off when you hover over a photo, and made every photo open the photo editor with a double-click, even when Edit is off
- **Maya:** added zoom and drag to the photo editor so a photo can be fit inside a cut-out sticker shape or frame
- **Maya:** fixed the × on selected photos getting cut off at the page edge or hidden behind tape
- **Maya:** added every brand board font (Miniver, Figma Hand, Avenir, Inter) and note colors, redesigned the crowded edit panel with more spacing, added tape colors for tape and photos, and made it so you can follow someone from the who's here list to the pages they're on
- **Maya:** gave the color choices more room (named chips in a grid) and made the edit panel stay with you while editing: picking a font or color keeps you typing in the note instead of closing it
- **Maya:** moved the note's font and color options into a dropdown under "+ Add text box", and made a selected photo come to the front so it's easy to resize and delete
- **Maya:** moved a note's size and angle sliders into the note dropdown so all of a note's options are together
- **Maya:** evened out the selection ring on page backgrounds and colors, and gave the color choices more room
