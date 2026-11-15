# Presenting/viewing features in major presentation tools: survey for `svg-diagram serve`

Scope: features for presenting and viewing only, not authoring. Surveyed 2026-11-15. Source keys in [brackets] point to the list at the end. **(unverified)** means I could not confirm the claim from an official page; treat it as likely, not certain.

Status changes that affect the comparison:
- **PowerPoint "Present Live"** in PowerPoint for the web (QR code, audience followed on their phones with subtitles) was **retired on 2025-05-30**. Microsoft now points to PowerPoint Live in Teams [PPT-LIVE].
- **Keynote Live** is marked "will be discontinued" in Apple's guide. Apple recommends FaceTime and other video apps instead [KN-LIVE].

So in 2026 the main "audience follows on their own device" products are PowerPoint Live in Teams, Slidev, reveal.js multiplex, Canva, and Pitch.

---

## 1. Navigation

| Tool | How |
|---|---|
| PowerPoint | Next: N, Enter, PgDn, →/↓, Space. Prev: P, PgUp, ←/↑, Backspace. Home/End. **Type number + Enter** to jump. **H** = next hidden slide. Tab/Shift+Tab cycles hyperlinks. Ctrl+S = All Slides dialog [PPT-KEYS] |
| Keynote | →/↓ next build. Shift+↓ next slide, skipping builds. **Z = back through previously viewed slides**. Home/End. **Typing a number opens a slide switcher** (+/− to step, Return to go) [KN-KEYS] |
| Google Slides | Arrows. **Number + Enter**. Home/End [GS-PRESENT] |
| Canva | ←/→. "Go to page" Alt+Ctrl+G (Win) / ⌥⌘G (Mac) [CANVA] |
| reveal.js | Arrows/Space. 2-D navigation (`navigationMode`). `mouseWheel` option. `touch` swipe. `jumpToSlide` (type number). `hash`/`history` give each slide a URL and make Back work [RJS-CONFIG] |
| Slidev | Space/→ next step, ↑/↓ next/prev slide skipping clicks, **g = goto dialog** [SLIDEV-UI] |
| Marp (bespoke) | Keyboard and swipe, optional progress bar [MARP] |
| pdfpc | Arrows/PgDn/Space/**wheel**. Shift+→ jumps 10 slides. **g goto**. **Shift+Backspace / Shift+Space = history back/forward**. **m / Shift+m bookmark**. Hidden slides (Ctrl+h, Shift+n ignores hidden). Shift+PgDn skips overlay steps [PDFPC] |

Notes: everyone supports "type a number + Enter" and Home/End. Only Keynote (Z) and pdfpc have **history back**, which is handy after jumping to an appendix. Hidden or backup slides are standard in PowerPoint, Keynote, Google Slides and pdfpc.

## 2. Overview / thumbnails

- **PowerPoint**: "See all slides" grid in Presenter View. Ctrl+S opens the All Slides dialog [PPT-PV][PPT-KEYS].
- **PowerPoint Live (Teams)**: grid view for the presenter **and for each attendee** [PPT-TEAMS].
- **Keynote**: slide switcher by number. No grid during play **(unverified)** [KN-KEYS].
- **Google Slides**: "select slides from a list" in the toolbar [GS-PRESENT].
- **reveal.js**: **Esc or O** toggles a zoomed-out overview, navigable with arrows [RJS-OVERVIEW].
- **Slidev**: **o** opens Quick Overview. `/overview` shows a list with notes [SLIDEV-UI].
- **pdfpc**: **Tab** opens a thumbnail grid (arrows, Return to go, Esc cancels) [PDFPC].
- **Prezi**: the zoomed-out canvas acts as the overview [PREZI].

## 3. Zoom / magnify (key topic)

| Tool | Trigger | Pan | Who sees it |
|---|---|---|---|
| **PowerPoint desktop** | Presenter View magnifier: "Zoom into slide" on the part you point at. Ctrl+wheel and Ctrl+= / Ctrl+− also reported **(third-party sources)** [PPT-PV] | Click and drag | Audience screen shows the zoom (same show) |
| **PowerPoint Live in Teams, presenter** | **+ / −, Ctrl+wheel, trackpad pinch/stretch, touch stretch**, on-screen zoom controls | **Arrow keys**, click-drag, one-finger drag | Presumably broadcast to attendees. The page does not say explicitly **(unverified)** |
| **PowerPoint Live in Teams, attendee** | Same gestures | Same | **Private: "without affecting what others see"**. **Esc resets** [PPT-TEAMS2] |
| reveal.js zoom plugin | **Alt+click** on an element (Ctrl+click on Linux) zooms to that element. Click again to exit [RJS-PLUGINS] | None (element-fit) | Local only. Multiplex sends slide state only **(unverified)** |
| pdfpc | **2** = pointer mode, then drag a rectangle (everything outside is dimmed), then **z** zooms to that rectangle. Esc exits. **5** = spotlight. +/− resize the pointer or spotlight [PDFPC] | n/a | Shown on the audience screen |
| Prezi | Zoom is the core metaphor. Cmd+↑/↓ zooms the canvas, Alt+scroll zooms into a topic, wheel zoom [PREZI] | drag | Audience |
| Keynote, Google Slides, Canva, Slidev, Marp | No live zoom while presenting **(not found in docs)**. You fall back to OS or browser zoom | | |

Takeaways: the newest design, PowerPoint Live, accepts **+/−, Ctrl+wheel, pinch, drag, arrows to pan while zoomed, Esc to reset**, and gives each attendee a **private zoom**. pdfpc and reveal.js add a **targeted zoom to a region or element**, which suits a static diagram well.

## 4. Pointer and annotation

| Tool | Laser | Pen/highlighter | Eraser / clear | Persistence | Sync to remote audience |
|---|---|---|---|---|---|
| PowerPoint | Ctrl+L (⌘L) | Ctrl+P pen, highlighter in toolbar | Ctrl+E eraser, **E erase all** | **Ctrl+M show/hide ink**. Prompt to **keep ink annotations** at end of show | Teams: laser, pen, highlighter and eraser are shown live, but **not captured in recordings** [PPT-KEYS][PPT-TEAMS] |
| Keynote | Highlighting on iPad/iPhone. Not available during Keynote Live [KN-LIVE] | | | | |
| Google Slides | **l** toggles | Pen tool via Options, with colours | Erase | **Gone when slideshow ends** [GS-PRESENT] | n/a |
| Canva | No laser found | Pen, marker, highlighter | Eraser | Temporary, not saved [CANVA] | |
| Slidev | Pointer/cursor sync **(unverified)** | drauu: pen, shapes, stylus draws while finger navigates | Clear | `drawings.persist` saves SVG files, included in PDF exports | **Real-time sync to all instances**. `syncAll:false` = presenter only [SLIDEV-DRAW] |
| pdfpc | Pointer (2), spotlight (5) | Pen (3), 8 colours, +/− size | Eraser (4), c clear, Ctrl+Z/Y undo | d toggles visibility | n/a |
| reveal.js | Third-party plugins only (e.g. chalkboard) **(unverified)** | | | | |

Common expectations: a laser or pointer visible to remote viewers, pen with a few colours, erase-all, ink that **stays per slide** while you move back and forth during the session, and Esc to leave a tool.

## 5. Screen control

- **Black/white screen**: PowerPoint **B or .**, **W or ,** [PPT-KEYS]. Keynote **B / W** (also pauses) [KN-KEYS]. Google Slides **b / w** [GS-PRESENT]. reveal.js `pause` (**B or .** by default) [RJS-CONFIG]. pdfpc **b** [PDFPC]. Canva **B blurs** the slide [CANVA].
- **Freeze**: pdfpc **f** freezes the audience screen while the presenter keeps navigating [PDFPC]. Keynote **F** pauses, **H** hides the presentation [KN-KEYS].
- **Hide cursor**: PowerPoint Ctrl+H [PPT-KEYS]. Keynote **C** [KN-KEYS]. reveal.js `hideInactiveCursor` [RJS-CONFIG]. Slidev "hide idle cursor" setting [SLIDEV-UI].
- **Swap displays**: PowerPoint "Swap displays" [PPT-PV]. Keynote **X** [KN-KEYS]. pdfpc `-s` [PDFPC].
- **Choose a monitor**: Google Slides needs Chrome to target a second screen [GS-PRESENT].
- **Fullscreen**: Marp **f/F11** [MARP], Slidev **f** [SLIDEV-UI].
- **Screen mirror**: Slidev shows another monitor or window inside the slide area [SLIDEV-UI].
- **Keep the screen awake**: Slidev Wake Lock setting [SLIDEV-UI].

## 6. Presenter view

| Feature | Who |
|---|---|
| Current + next slide | All (PowerPoint, Keynote, Google Slides, Canva, reveal.js, Slidev, pdfpc, Prezi, Marp) |
| Notes font size | PowerPoint (two buttons) [PPT-PV]. Keynote (⌘+/⌘−, U/D scroll notes) [KN-KEYS]. pdfpc (+/−) [PDFPC]. Google Slides (zoom buttons) **(unverified)** |
| Elapsed timer, pause/reset | PowerPoint. Google Slides (Pause/Reset) [GS-QA]. Keynote **R resets** [KN-KEYS]. reveal.js (hover to reset) [RJS-SPEAKER]. pdfpc (s start, p pause, Ctrl+T reset) |
| Countdown / time remaining | Keynote (elapsed or remaining) [KN-PD]. pdfpc `-d` duration, `-e` end time [PDFPC]. Canva: number key starts an N-minute timer **on the audience screen** [CANVA] |
| **Pace guide** | reveal.js pacing timer: green on time, red go faster, blue slow down. Uses `defaultTiming`, `totalTime` or per-slide `data-timing` [RJS-SPEAKER]. pdfpc: orange behind, blue ahead (60 s threshold), red after zero [PDFPC] |
| Wall clock | Keynote, reveal.js, pdfpc (Shift+T cycles views) |
| "Ready to advance" indicator | Keynote: red/green bar while a build runs [KN-PD] |
| Custom layout | Keynote (Customize Presenter Display) [KN-PD]. pdfpc (Shift+C) [PDFPC]. Slidev (3 layouts) [SLIDEV-UI] |
| Edit notes live | pdfpc Ctrl+N [PDFPC]. Slidev notes editor [SLIDEV-UI] |
| Rehearse timings per slide | PowerPoint "Rehearse Timings" (T/O/M/R keys during rehearsal) [PPT-KEYS]. Keynote "Rehearse Slideshow" with no external display [KN-PD] |
| Audience feed in presenter view | PowerPoint Live in Teams shows attendee video, raised hands, reactions and chat [PPT-TEAMS] |
| Help overlay | Keynote **?** [KN-KEYS], reveal.js **?** [RJS-CONFIG], pdfpc **?**, Canva Shift+/ [CANVA] |

## 7. Audience on their own devices

- **PowerPoint Live in Teams** is the reference design [PPT-TEAMS][PPT-TEAMS2]:
  - attendees browse **privately**, then use **"Sync to presenter"** to return to the live slide;
  - the presenter can **turn off participant navigation** (Private view);
  - attendees get **grid view**, private **zoom and pan** (Esc resets), **high-contrast view**, **translated slides**, screen-reader access to slide text, and working hyperlinks and videos;
  - bandwidth is lower than screen sharing.
- **Keynote Live** (being discontinued): link plus optional password, viewers need only a browser, no annotation [KN-LIVE].
- **Slidev**: `--remote[=password]` protects only the presenter route. `--tunnel` uses a Cloudflare Quick Tunnel. Navigation and drawings sync to all open pages [SLIDEV-REMOTE][SLIDEV-DRAW].
- **reveal.js multiplex**: audience devices follow the master. It is a separate plugin [RJS-MULTIPLEX].
- **Q&A**: Google Slides Audience tools (**a**). Viewers submit questions from any device via a link, and the presenter can project them [GS-QA]. Canva Live gives the audience a link to ask questions [CANVA].
- **Reactions, polls, quizzes**: Teams (reactions and hands shown in presenter view). Mentimeter and Slido are the dedicated category: a join code, then polls, word clouds, quizzes and upvoted Q&A, embedded into PowerPoint or Google Slides via add-ins **(category note, not individually verified)**.
- **Captions / subtitles**: PowerPoint live captions, or **translated subtitles in 60+ display languages**, speech sent to Microsoft [PPT-SUBS]. Google Slides **Ctrl/⌘+Shift+C** uses the browser's speech-to-text, can change position and size, and switches off after 30 minutes idle [GS-CAPS].

## 8. Remote control from a phone

- **Keynote Remote**: iPhone or Apple Watch, paired with a 4-digit code over local network/Wi-Fi [KN-REMOTE].
- **PowerPoint mobile**: present from a smartphone with a laser pointer [PPT-PHONE].
- **Canva**: a **Remote Control link** works in any browser. The owner can pause or resume a co-presenter's control, notes appear for signed-in users, and Magic Shortcuts work from the remote [CANVA].
- **Slidev**: open `/presenter` on the phone through `--remote` (password) [SLIDEV-REMOTE].
- **Pitch**: co-presenters drive the same deck (premium feature) [PITCH].
- Hardware clickers send PgUp/PgDn, arrows, B, F5 or Esc, so supporting those keys matters.

## 9. Accessibility

- **Captions**: see §7.
- **High contrast**: PowerPoint Live attendee option [PPT-TEAMS2].
- **Colour filters**: Slidev CSS filters (invert, brightness, contrast and more) [SLIDEV-UI].
- **Screen reader access to slide text**: PowerPoint Live [PPT-TEAMS2].
- **Translated slides**: PowerPoint Live [PPT-TEAMS2].
- **Reduced motion**: no tool documents honouring `prefers-reduced-motion` while presenting **(not found)**.
- For us, the obvious items are SVG `<title>`/`<desc>` and alt text per slide, ARIA live announcements of "Slide n of N", and full keyboard operability.

## 10. Recording, rehearsal, coach, camera

- **Presenter Coach** (PowerPoint, Rehearse with Coach): feedback on pacing, pitch, filler words and sensitive phrases, with a summary report [PPT-COACH].
- **Cameo** (PowerPoint): live camera feed placed on slides [PPT-CAMEO].
- **Canva** "Present and record" [CANVA].
- **Prezi Video**: presenter and content layouts on keys 1, 2, 3 [PREZI].
- **Slidev**: camera view toggle and built-in recording [SLIDEV-UI].
- **Zoom "Slides as virtual background"**: video composited over slides. Reportedly removed in Zoom 6.3 in favour of Layouts **(unverified, community posts)** [ZOOM-BG].

## 11. Export, print, share

- **Google Slides**: Ctrl+P print, PDF/PPTX download from the presenting toolbar [GS-PRESENT].
- **reveal.js**: hash URL per slide. `showNotes` puts notes in the PDF [RJS-CONFIG][RJS-SPEAKER].
- **Slidev**: PDF download from the nav bar, plus a browser exporter [SLIDEV-UI].
- **Keynote Live**: shared link with password [KN-LIVE].
- **PowerPoint**: handouts with notes; this is authoring-side.
- **Common expectations**: shareable link per slide, PDF or print with optional notes (handout of 2, 3 or 6 per page), and password-protected live sessions.

## 12. Transitions, animations, builds

Every mainstream tool has slide transitions and builds:
- PowerPoint and Keynote animations;
- reveal.js `transition` and fragments [RJS-CONFIG];
- Slidev clicks;
- pdfpc treats beamer overlays as steps, with the option to skip them [PDFPC].

Our decks have no per-element builds. The only relevant decisions are an optional quick **cross-fade** between slides (off when `prefers-reduced-motion` is set) and the step model, which is not needed.

## 13. Other commonly expected features

- **Autoplay / kiosk loop**: Canva Autoplay [CANVA], reveal.js `autoSlide` [RJS-CONFIG].
- **Show live edits during a talk**: Canva [CANVA], PowerPoint Live "present the latest version" [PPT-TEAMS].
- **Progress bar and slide number**: reveal.js, Marp [RJS-CONFIG][MARP].
- **Link preview overlay**: reveal.js `previewLinks`.
- **Search slides**: reveal.js Ctrl+Shift+F [RJS-PLUGINS].
- **Dark mode**: Slidev **d** [SLIDEV-UI].
- **Fit or 1:1 scale**: Slidev [SLIDEV-UI].
- **Fun effects**: Canva Magic Shortcuts (C confetti, D drumroll and others) [CANVA].

---

## Recommendations for `svg-diagram serve` (static 16:9 SVG slides, presenter page + viewer page, local or Cloudflare Worker)

### Zoom: concrete proposal, based on PowerPoint Live, pdfpc and reveal.js

- **Input**:
  - **+ / −** keys;
  - **Ctrl+wheel**, trackpad pinch and touch pinch, centred on the cursor or fingers;
  - **double-click (or Alt+click) to zoom 2× at a point**;
  - optional **drag a rectangle to zoom** to that region (pdfpc style).
- **Pan**: drag, one-finger drag, and **arrow keys pan only while zoomed** (as PowerPoint Live does). At 1× the arrows navigate again.
- **Reset**: **Esc or 0**. Moving to another slide also resets.
- **Rendering**: since slides are SVG, change the `viewBox` or apply a CSS transform to the vector. Text stays sharp at any zoom, unlike PNG-based tools. Use a 1×–8× range.
- **Sync**: the presenter's zoom is broadcast to *linked* viewers as a normalized rectangle (x, y, w, h in slide units), so it works at every screen size. A viewer can zoom privately at any time. A private zoom or browsing unlinks that viewer, as in PowerPoint Live, and "back to live" restores the presenter's slide and zoom.
- **Presenter page**: show a mini-map outline of the zoomed region on the current-slide thumbnail.

### Priority table

| Feature | Verdict | Reason |
|---|---|---|
| Zoom/pan as above, synced to linked viewers, private for unlinked viewers | **Build now** | In progress already. SVG makes it sharp and cheap. PowerPoint Live has set the expectation |
| Jump to slide: number + Enter, plus Home/End | **Build now** | Every tool has it, and it is trivial |
| Black/white screen (B or ., W or ,) mirrored to viewers | **Build now** | Universal, and clickers send B or . |
| Clicker-compatible keys (PgUp/PgDn, Space, Backspace, F5/Esc) | **Build now** | Hardware remotes depend on them |
| History back (Keynote Z, pdfpc Shift+Backspace) | **Build now** | Cheap and useful after jumping to backup slides |
| Help overlay on **?** | **Build now** | Standard in Keynote, reveal.js, pdfpc and Canva |
| Timer: elapsed + countdown/target end + pace colours (reveal.js/pdfpc model), pause/reset, clock | **Build now** (extends existing pace) | The pdfpc colour scheme is proven |
| Notes font size +/− | **Build now** | Present in PowerPoint, Keynote and pdfpc. Easy |
| Hide idle cursor; Wake Lock | **Build now** | One-liners. Slidev and reveal.js have them |
| Viewer "Sync to presenter / back to live" button and presenter-side "lock viewers to live" toggle | **Build now** (partly exists) | Matches PowerPoint Live's Private view control |
| Laser pointer synced to viewers (normalized coordinates) | **Build now** if not already synced | Remote viewers cannot see a physical pointer |
| Freeze audience while presenter browses (pdfpc f) | **Later** | Useful, but linked or unlinked viewers partly cover it |
| Pen/highlighter + erase-all, per-slide in-memory ink, synced | **Later** | High value but more work. SVG overlay makes it natural. Do not persist to start with |
| Hidden/backup slides (skipped in sequence, reachable by number) | **Later** | Needs deck-format support |
| Spotlight (dim everything but a circle or rectangle) | **Later** | Cheap after zoom. Good for dense diagrams |
| Phone remote (presenter page on phone, short pairing code or token) | **Later** | The Worker deployment makes it nearly free. Needs auth |
| Password/token for presenter route on the Worker | **Later → soon** | Slidev and Keynote Live both gate control. Security matters once public |
| Print/PDF handout with notes (n per page) | **Later** | Print exists. Adding notes and n-up is an incremental step |
| Accessibility: per-slide alt text from SVG title/desc, ARIA "slide n of N", high-contrast/invert filter for viewers | **Later** | PowerPoint Live sets this expectation. Low cost |
| Swap/choose display, multi-monitor | **Skip** | The browser model already gives separate windows. OS handles placement |
| Live captions/translation | **Skip** (or the browser's Web Speech API later) | Heavy and privacy-sensitive. Meeting tools already provide it |
| Q&A, polls, reactions | **Skip** | Mentimeter, Slido and Teams cover it. Outside the scope of a renderer |
| Transitions/builds | **Skip** (optional fade honouring reduced-motion) | Static-SVG deck by design |
| Presenter Coach, Cameo, recording | **Skip** | Needs AI or media. OBS and meeting tools cover it |
| Magic Shortcuts / effects | **Skip** | Novelty |

---

## Sources

- [PPT-KEYS] https://support.microsoft.com/en-us/office/use-keyboard-shortcuts-to-deliver-powerpoint-presentations-1524ffce-bd2a-45f4-9a7f-f18b992b93a0
- [PPT-PV] https://support.microsoft.com/en-us/office/start-the-presentation-and-see-your-notes-in-presenter-view-4de90e28-487e-435c-9401-eb49a3801257
- [PPT-TEAMS] https://support.microsoft.com/en-us/office/share-powerpoint-slides-in-a-teams-meeting-fc5a5394-2159-419c-bc59-1f64c1f4e470
- [PPT-TEAMS2] https://support.microsoft.com/office/present-from-powerpoint-live-in-microsoft-teams-28b20e74-7165-499c-9bd4-0ad975d448ad
- [PPT-LIVE] https://support.microsoft.com/en-au/powerpoint/present-live-engage-your-audience-with-live-presentations ; retirement date: https://easi.its.utoronto.ca/?p=17075
- [PPT-SUBS] https://support.microsoft.com/office/present-with-real-time-automatic-captions-or-subtitles-in-powerpoint-68d20e49-aec3-456a-939d-34a79e8ddd5f
- [PPT-COACH] https://support.microsoft.com/en-au/topic/rehearse-your-presentation-with-presenter-coach-5624eba8-4188-457f-b2e4-218f34216ca7
- [PPT-CAMEO] https://support.microsoft.com/en-us/powerpoint/presenting-with-cameo
- [PPT-PHONE] https://support.office.com/en-US/article/Using-a-laser-pointer-on-your-smartphone-when-presenting-in-PowerPoint-485e8618-98ed-472b-84fa-443e23ea602a
- [KN-KEYS] https://support.apple.com/guide/keynote/keyboard-shortcuts-tanfde4a3e6d/mac
- [KN-PD] https://support.apple.com/guide/keynote/tana4da2681/mac (and https://help.apple.com/keynote/mac/7.2/en.lproj/tana4da2681.html)
- [KN-LIVE] https://support.apple.com/en-us/guide/keynote-icloud/play-a-presentation-over-the-internet-gilf6b3b4d27/13.1/icloud/1.0 ; https://support.apple.com/en-gb/101958
- [KN-REMOTE] https://support.apple.com/guide/keynote/tan85f5c958c/mac ; https://support.apple.com/119886
- [GS-PRESENT] https://support.google.com/docs/answer/1696787
- [GS-QA] https://support.google.com/a/users/answer/9308865
- [GS-CAPS] https://support.google.com/docs/answer/9109474
- [CANVA] https://www.canva.com/help/presenting-designs/ ; https://www.canva.com/newsroom/news/new-canva-presentations-features/
- [PITCH] https://help.pitch.com/en/articles/11750406-present-your-ideas-with-your-teammates
- [PREZI] https://support.prezi.com/hc/en-us/articles/360003499013-How-to-use-keyboard-shortcuts-in-Prezi-Present ; https://support.prezi.com/hc/en-us/articles/360003478034-Presenting-and-viewing-a-presentation
- [RJS-CONFIG] https://revealjs.com/config/
- [RJS-OVERVIEW] https://revealjs.com/overview/
- [RJS-SPEAKER] https://revealjs.com/speaker-view/
- [RJS-PLUGINS] https://revealjs.com/plugins/
- [RJS-MULTIPLEX] https://revealjs.com/multiplex/
- [SLIDEV-UI] https://sli.dev/guide/ui
- [SLIDEV-DRAW] https://sli.dev/features/drawing
- [SLIDEV-REMOTE] https://sli.dev/features/remote-access
- [MARP] https://github.com/marp-team/marp-cli (bespoke template section)
- [PDFPC] https://www.mankier.com/1/pdfpc
- [ZOOM-BG] https://community.zoom.com/t5/Zoom-Meetings/slides-as-virtual-background/m-p/236703

Not verified: Pitch presenter view, laser and remote details (help center not found); impress.js plugin key list (the docs point to a plugins README I did not read); whether a PowerPoint Live presenter's zoom is mirrored to attendees; Keynote's grid during play; the Google Slides notes zoom buttons.
