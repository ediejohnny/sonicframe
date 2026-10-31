# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Chapters. `readChapters` reads WebVTT (`kind="chapters"`, as the specification's parser reads it), the
  Podcasting 2.0 JSON chapters (text or parsed) or a list, from the content; `loadChapters` fetches a file once
  per page; `chapterAt`, `chapterEnds` and `nextChapter` answer which chapter plays, where it ends and where a
  step lands. All are on `sonicframe` and `sonicframe/analysis`. Read as untrusted: at most 512 KB and 1000
  chapters, titles cleaned to one line of 120 characters, pictures and links kept only from web or relative
  addresses (`safeUrl`, now exported).
- The `chapters()` plugin: a line where each chapter starts (`--sonicframe-chapter`), its name in the tooltip, a
  click on a line to go there, C and Shift+C (configurable, with a back grace like a previous track) that say
  where they landed, and the chapter in the slider's value in words. Off until asked: saying the chapter
  playback enters, a strip of titles above or below the wave, and a list (`nav` with `aria-current`) in an
  element of the app, with pictures and links only when asked.
- The player's `chapters` option (an address, a list or the plugin's options, plus `list`), off
  by default, with words in English and Portuguese; the look parts `chapter`, `prevChapter`, `nextChapter` and
  `chapters` (the list's button), shown only with chapters; `player.chapters`; and the `chapterchange` event.
- The player's chapters list takes options (`list: true` is still the list in the player): `type` `'popover'`
  (a box over the page under its button, kept inside the window, with an arrow at the button; `placement`) or
  `'drawer'` (a panel along the page's `side`, with a close button and an optional `backdrop`), `width`,
  `maxHeight`, `open`, `stayOpen`, and off by default: `animation` (`'fade'` or `'slide'`, never with reduced
  motion) and `swipe` (a finger's swipe off the wave, `swipeDirection`, opens and closes it). The list can wear
  its own `palette`, `font` and `style` (corner, border, shadow, padding, text size). A list that floats adds
  its button at the end of the line when the look places none. `arrowOffset` (pure) places the arrow.
- `underStart` in the player's look (`'wave'`, the default, or `'line'`): the rows under a wave in the line start
  at the wave's left edge, or at the line's, under the play button.
- The tag's `chapters` and `chapter-options` attributes, and the `sonicframe:chapterchange` event.
- The docs' Chapters page, with a WebVTT and a JSON example.

### Changed

- The docs' Installation page now starts from the latest version: the CDN address carries no version (unpkg sends
  it on to the latest version's own address, so an entry and its pieces always match), and the source code comes
  from a plain `git clone` of `main` or its zip. A "Want a specific version?" part under each shows the same with
  `x.y.z`, to fill in with the version's numbers.
- The size ceiling of each entry rises from 96 KB to 128 KB (gzip, unminified, comments and chunks included).

### Fixed

- The parts beside a wave in the player's line (the play button, the time) sat lower than the bars whenever a
  plugin added a strip above or below them, or rows sat under the wave: the line centered them on the wave's
  whole box or column. They now line up with the bars' middle, moved by `translate` alone.

## [0.4.1] - 2026-10-31

### Added

- `timeAlign` in the player's look (`'auto'`, `'start'`, `'center'` or `'end'`): where a time's text sits in the
  room it keeps. `'auto'` keeps to the end after the wave or a spacer, and on the right under a voice note's wave;
  to the start everywhere else.

### Fixed

- A player with the time beside the wave blinked now and then while playing, and its bars shifted a little each
  time. Digits are not all as wide in every font, even with tabular figures (in Segoe UI Semibold the 7 is
  narrower), so the time changed width as it counted and resized the wave. Each time now keeps the room of the
  longest time the sound can show, with a hidden mold of that time beside the shown text.
- A frame whose size changed showed a blank canvas for one frame (a new canvas size clears it, and the repaint
  waited for the next animation frame). It now repaints at once, before the page is painted, which also stops the
  wave blinking while the window is resized.

### Changed

- The time part holds its text in `.sonicframe-time-text`, next to the hidden mold `.sonicframe-time-mold`; read
  the shown time from `.sonicframe-time-text`.
- The docs' Installation page teaches building from the source code, for sites that use no package manager: get the version's
  tag, build with Node, copy the whole `dist/` folder with the license, and import by path or through an import map
  (with the hash a strict Content-Security-Policy needs), plus the TypeScript `paths`.

### Security

- The build and test tools move to vite-plus 1.4.0, which fixes GHSA-p458-7748-mcp3 (Vitest's own servers could
  serve protected files such as `.env`). Only the machine building the project was ever concerned, and only with
  those servers on; the published package has no dependencies and was never affected.

## [0.4.0] - 2026-10-30

### Added

- Ready-made waveform files: `readWaveform` and `loadWaveform` read the audiowaveform formats (binary `.dat` and
  JSON, versions 1 and 2, 8 or 16 bits, any channel or the loudest of all) and the simple peaks list, finding the
  format in the content. A file with more points than `maxPeaks` is folded while it is read; one whose data does not
  match its header is refused. Options: `maxPeaks`, `maxBytes`, `channel`, `normalize`, `shared` and `fetcher`.
- `writeWaveform` writes the audiowaveform `.dat` or JSON (version 2) from decoded samples, in the browser or in Node.
  The three are also on `sonicframe/analysis`.
- `peaks` also takes `{ peaks, duration }` (what `loadWaveform` gives): the duration is used while neither the media
  nor the app gives one. The frame's `peaksDuration` property.
- The `<sonic-player>` tag reads its `peaks` address with `loadWaveform`, so it takes `.dat` files and their duration.
- Zoom and scroll in the frame, off by default (`zoom: true` or `ZoomOptions`): `view`, `setView`, `zoomTo`,
  `zoomBy`, `scrollTo` and the `viewchange` event (with what moved the view). Each way of moving it has its own
  switch: zoom keys (`+`/`=`, `-`, `0`, or your own), the wheel with a modifier (Ctrl/⌘, Alt or none, and a
  touchpad pinch), sideways scrolling, two fingers, following the playing position (by pages, or centered, which
  falls back to pages with reduced motion; a scroll by the person holds it until the next seek or play), and
  scrolling while dragging near an edge. A keyboard seek outside the view brings the view to it (`revealKeys`, on).
  The bars of the view come from a pyramid of the peaks, so the cost follows the screen, and stay on the same piece
  of sound while scrolling. The largest zoom is one peak per bar unless `max` says otherwise.
- `a11y.zoom` on the frame: `announce` says the new view after a zoom by the keys, a button or two fingers, in
  `words` of your own (English by default).
- For plugins: `host.view`, `host.setView`, `paint.view`, `paint.ratioAt`, and `paint.xAt` through the view.
  `host.seekTo(ratio, source)` takes an optional source: a seek a key asked for passes `'keyboard'`, so the view
  follows it.
- The plugins follow the view: regions (bands, grab zones and labels; `scrollIntoView` brings a region chosen by R
  into view, off by default), markers (`markerSpans` takes an optional view; M brings the marker into view), the
  silences' shade, and the timeline, which marks the part in view down to tenths of a second and reuses its
  elements. The spectrogram shows its part of the picture; with `detail` (off by default) it computes a sharp
  picture of the part in view once the view rests (`detailDelay`, `detailColumns`).

- `minimap(options)`: a strip above or below the wave with the whole sound, the played part (`progress`) and a box
  over the part in view, in the theme's colors (`--sonicframe-minimap-view` and `--sonicframe-minimap-edge`, which
  fall back to the region and progress colors). Dragging the box and clicking beside it move the view, the wheel can
  zoom (`controls.drag`, `controls.click`, `controls.wheel`); a press on it never seeks. `autoHide` takes no room at
  the whole sound. Hidden from screen readers unless `a11y.keys` makes it a keyboard slider (arrows, Page Up/Down,
  Home, End) with its own `a11y.label` and `a11y.words`; as a slider, a press on it gives it the focus. `gap` keeps
  it apart from the wave (4 px), and `cursors` shows an open hand over the box, a closed one dragging it, a hand
  beside it, and the arrow where a press does nothing.

- The player takes `zoom` (the wave's zoom options plus `buttons`: zoom in, zoom out and back to the whole sound,
  three new look parts `zoomIn`, `zoomOut` and `zoomReset`, placed by the look or at the end of the line, marked
  `aria-disabled` at their limits so focus is never lost), `minimap` (its height and space from the look's new
  `minimapHeight` and `minimapGap`, in rem; the player grows to fit it), `a11y.zoom.announce`, `a11y.minimap.keys`, and the `viewchange` event. Their words come in
  English and Portuguese.
- The player's `decode`: `peaks` (1000), `peaksPerSecond` (100, with zoom on, so zooming in shows detail), and
  `maxSeconds` and `maxBytes`, which can only lower the decoder's ceilings.
- The tag's `zoom` attribute (`zoom="wheel scroll pinch keys follow center edges buttons"`), `zoom-max`, `minimap`
  (`above`, `autohide`, `wheel`), `a11y-zoom="announce"`, `a11y-minimap="keys"`, and the peaks file's
  `peaks-channel`, `peaks-max` and `peaks-normalize`. The tag dispatches `sonicframe:viewchange`.
- `loadWaveform` and `readWaveform` are on `sonicframe/player` too.
- `snap` on `regions` and `skipSilences` (off by default): their edges on whole device pixels, a little crisper and
  moved by less than half a pixel; without it they sit at fractions of a pixel, as before.
- `cursors` on `regions`: the open hand over a region now turns into a closed one while it moves (`'grabbing'`) and
  back after; each cursor can be changed. A plugin's mouse drag keeps that plugin's cursor while it lasts.
- `narrow` in the player's look (22 rem; `0` turns it off): a narrower player with the wave in its line turns into a
  voice note: the play button beside the wave and centered on it, the time under the wave on the left, and the
  other controls on the right of the time, where only the ones that do not fit wrap. It is on by default and only
  changes players narrower than that. The player gets `data-narrow` while it lasts. `narrowLine` and `narrowStart`
  choose which parts stay on the line and which go under the wave on the left; `narrowGap` (0.5 rem) is the space
  between the parts under the wave.
- `preload` on the player and the tag: how much of `src` its own `<audio>` loads before play (`'metadata'`, as
  before; `'none'`, so a page of many players fetches nothing until one plays; or `'auto'`).
- `waveMin` in the look (8 rem): with zoom buttons on the line, the wave keeps at least this width and the buttons
  wrap under it.

### Fixed

- A sound longer than the decoder's length ceiling is read evenly through, and the rate given back is now the rate of
  the samples given back (it was the file's), so times computed from it stay right.
- `exportClip` with `start`/`end` draws only that range across the clip, so the played part runs over the bars it
  plays (it used to draw the whole sound under a progress bar of the range).
- The plugins' shared overlay (`host.overlay()`) sits over the bars, as documented, and no longer over the lanes, so
  a region's label no longer lands on a timeline placed above the wave.
- On a 320 px screen the zoom buttons no longer crush the wave to a sliver beside them.

### Changed

- The tag's `peaks` file may now be up to 8 MB, and one with more than 20,000 values is folded instead of refused.
- The README is short now, with an Accessibility section of its own; every detail moved to the docs site, which is
  the package's homepage.
- The package holds no web address but the SVG namespace (`http://www.w3.org/2000/svg`, a name the browser needs to
  create the icons, never fetched); an example address left in a type comment is gone, and the build check now
  fails on any other.

## [0.3.0] - 2026-10-29

### Added

- The wave in words: `soundDescription()` describes a sound's shape for people who cannot see the
  wave (its length, where the sound and the pauses are, where it is loudest), through the wave's
  `aria-describedby`, so their own screen reader reads it. English and Portuguese are built in (`lang`,
  or `'auto'` for the page's language), your own `words` cover any other, and numbers and units come
  from `Intl`. Off until asked, each with its own option: an element of yours that shows the text,
  saying it when it arrives while the wave has focus, keys `D` (again) and `P` / `Shift+P` (between the
  parts), "pause" on the wave's value inside a silence, and the browser's own voice through `speak()`
  (voices on the device only, unless `voices: 'any'`; never on its own).
- `outlineSound` and `describeSound`, pure, also on `sonicframe/analysis`, so a server can write the
  description ahead of time.
- The player's accessibility options, in one group, `a11y`: `lang` (`'en'`, the default, `'pt'` or
  `'auto'`; given, it also marks the player with it), `labels` for any accessible name or word, the
  wave's value included, and `description` (off by default), the wave in words, with an optional
  `button` that reads it aloud. While it reads, the button wears the play button's colors;
  `button: { animation: true }` also moves it, as `animationType` says (`'pulse'`, the default, or
  `'fade'`), never with reduced motion. `player.description` and the `description` event. The tag's
  accessibility attributes start with `a11y-`: `a11y-lang` and
  `a11y-description="keys pauses speech announce button animation fade"`.
- The frame's `peakschange` event (peaks arrived, changed or went), the plugin hook `valueNote` (a note
  on the wave's value in words) and `host.updateValueText()`.

### Changed

- The size ceiling of each entry rises from 64 KB to 96 KB (gzip, unminified, chunks included).

## [0.2.0] - 2026-10-29

### Added

- `sonicframe/player`: a ready-made player on its own entry (`createPlayer`). It lays out a play
  button, the wave and the time, plus speed, skip, volume (off unless asked), a slot for the app's own
  element and spacers, by a look (parts, sizes in rem, corners, border, shadow, surface, font), and
  colors it with a palette (eight built in, `'auto'` following the system, or your own) set as
  `--sonicframe-*` properties. Given only `src`, it makes its own media element and decodes the peaks
  near the screen. Fonts come from system stacks or from the app (a file or a stylesheet, loaded once,
  addresses checked); no font ships with SonicFrame.
- Twenty-four player themes, each a whole look, palette and drawing in one option
  (`theme: 'bubble'`): a chat voice note, a podcast card, a heartbeat monitor, an oscilloscope, a
  level meter, 8-bit, editorial, glass, brutalist and more. The player's own options win over its
  theme; `defineTheme` extends one, `registerTheme` names your own (built-in names are kept), and
  `setTheme` switches later. Bar numbers from a theme are kept in range. Everything builds on the
  `default` theme, SonicFrame as it always looked: no theme, an unknown name or a theme that extends
  nothing ends up on it, and its `'default'` palette sets no variable, leaving the colors to SonicFrame
  and to the page.
- `<sonic-player>`: the player as an HTML tag, registered by `defineSonicPlayer()` (never on
  import). Attributes (`src`, `peaks`, `theme`, `palette`, `wave`, `font`, `font-src`,
  `font-stylesheet`, `label`, `volume`, `spectrogram`) are read as untrusted input, a changed
  attribute updates the player, removing the element destroys it, and the player's events reach the
  element as `sonicframe:<event>`. A player's own choices, at creation or through `setPalette`,
  `setWave`, `setLook` and the new `setVolume`, now keep winning over a later `setTheme`.
- The spectrogram takes its colors from your own stops (`map: { from, via, to }`, CSS colors or
  variables, read back as numbers) and repaints its image when they change, without computing again;
  new named maps `ice`, `fire` and `ocean`. `source` also takes a function that gives decoded audio,
  and the player's `spectrogram: true` draws one in the palette's colors from the same decode as its
  peaks.
- Ten ways to draw the sound (`wave`): bars, needles, LED blocks, a dot matrix, 8-bit steps, a line, a
  filled area, an oscilloscope trace, a heartbeat monitor, and a plain track that needs no peaks. The
  bar style still sets their density and alignment; played, hover and unplayed colors, live
  frequency and exported clips work with every drawing. A `knob` dot can ride the playing position
  (`colors.knob`), lines can glow, and `setWave` changes the drawing later. Every piece stays inside
  the frame and the number of pieces is capped.
- Every color a plugin draws can be themed with a custom property: `--sonicframe-region` (region
  bands), `--sonicframe-dim` (dimmed silences), `--sonicframe-badge` (caption badges) and
  `--sonicframe-on-progress` (the marker count and tooltip text), each defaulting to the color it
  had before.
- `VolumeControl`: a speaker button that mutes and unmutes (the icon follows the level) beside a
  bar that sets the level. The bar is a keyboard slider that speaks the level in percent and follows
  a press or a drag; unmuting brings the level back. It follows the media's own `volume` and `muted`,
  can show the bar always or only on hover and focus, and shows only the mute button where the
  browser keeps the volume fixed (iOS). The play button's focus ring now sets only `outline-color`
  from your color.
- `exportClip` (and `frame.exportClip`): records a short video of the wave playing — the decoded audio
  plays silently into a MediaStream, the wave is drawn each frame, and a MediaRecorder captures both.
  It picks a container the browser can record (`pickMimeType`: MP4/H.264 first, then WebM), runs in
  real time, stops at the end of the range, aborts if the tab is hidden or its `signal` fires (the
  download included), rejects rather than waits when the audio never starts (call it from a user
  gesture), always closes the audio it opened, and is capped (length, size, resolution, bitrate). The
  source is decoded whole, so it is limited to `maxSourceSeconds` (10 minutes by default,
  `DEFAULT_MAX_SOURCE_SECONDS`; `Infinity` lifts it): refused before the download when its length is
  known (`sourceSeconds`, which `frame.exportClip` fills in), otherwise right after decoding. No user
  color goes into a gradient; the caption is clipped, not faded through one.
- `liveFrequency`: while the sound plays, the bars dance to its spectrum (Web Audio), in up to 512
  bands (`frequencyBands`, capped at `MAX_BANDS`). One shared `AudioContext` routes each media element
  through an analyser once, the audio passes through unchanged, and the peaks return on pause. Media
  that cannot be read without muting it (cross-origin without CORS) is refused with an error, never
  silenced; the context is never closed and the output never disconnected. A plugin can also set the
  bar heights directly with `host.setValues`.
- `spectrogram`: a time–frequency image under the bars, computed in the browser with a dependency-free
  radix-2 FFT (`createSpectrogram`, resumable so it never freezes the page; run in slices on the main
  thread, since a strict CSP can block a blob worker). Like the peaks, it waits until the frame is near
  the screen, then decodes the audio with no user gesture (the download capped, streamed, and stopped
  if the frame is destroyed) or takes ready-made samples, and a failed download or decode reaches the
  frame's `error` event; color maps `viridis`, `magma` and `gray`, and colors only ever land in an
  `ImageData`. Window size, columns, rows and duration are all capped.
- Sound analysis, pure and on its own entry `sonicframe/analysis` (safe in Node and a worker):
  `levels` (RMS and peak per window), `findSilences` (with hysteresis), `silencesFromPeaks` (for
  apps that only have server peaks), `peakLevel` (peak, dBFS and clipping), and `mixdown`. Every one
  is capped. The `skipSilences` plugin jumps past the quiet stretches during forward playback (never
  right after a seek), landing a little before each one ends (`lead`) so the next word is not
  clipped, and can dim them.
- `timeline`: a thin ruler in a lane above or below the bars, with labels on round seconds and
  minutes and optional minor marks. It picks a nice step for the width (`niceTicks`), is
  `aria-hidden`, and rebuilds when the frame resizes or the duration becomes known or changes.
  `formatTime` takes an optional number of decimals.
- `regions`: stretches of the sound a listener can mark, play or loop. A band shows over the bars
  with its edges and an optional label; the pointer makes one by Shift-dragging (a plain drag still
  scrubs), moves it by its body and resizes it by an edge, and the keyboard — while the frame has
  focus — selects (`R` / `Shift+R`), plays (`Enter`), loops (`L`), nudges the edges (`[` `]` `{` `}`)
  and removes (`Delete`). A region never inverts or falls below a minimum length, and its edges have
  a touch-sized grab zone, and regions given before the sound's length is known are fitted to it once
  it is. The plugin offers `add` (a copy of the region, or `null` once `max` regions exist), `update`,
  `remove`, `clear`, `list`, `play`, `stop` and `select`.
- Plugins can take pointer and keyboard input: `pointerDown` claims a press (`'take'` now, or
  `'drag'` only once it moves past a few pixels, so a tap still seeks), with `pointerMove`,
  `pointerUp`, `pointerCancel` and a `pointerHover` that returns a cursor; `keyDown` runs before the
  slider keys. Plugins can play a stretch of the sound (`host.playRange` / `host.stopRange`, with a
  `rangeend` event), seek (`host.seekTo`), speak to a screen reader through a shared polite live
  region (`host.announce`), and report a failure met outside their hooks, such as a download, as the
  frame's `error` event (`host.reportError`). A seek out of a range being played abandons it.
- Hover colors: `colors.waveHover` and `colors.progressHover` recolor the unplayed and played bars
  while the pointer is over a frame. Each takes `'auto'` (nudges the wave toward the played color,
  and lightens or darkens the played color), a CSS color, or null. Off by default, so an upgrade
  looks the same; only the frame the pointer enters or leaves repaints.
- `caption`: a line under the bars that fades out on the right, with optional badges (an `auto`
  mark, a language tag) and a tooltip that opens on hover, on keyboard focus and on a tap, closes on
  Escape, and stays while the pointer rests on it. Text goes in as text, never HTML; the fade is a
  fixed mask, never built from a page color; the tooltip's text color is chosen for contrast on its
  background; and the whole caption reaches screen readers through `aria-describedby`, next to any
  ids the page put there (only the caption's own id is ever taken out). Clicking it never seeks.
- Plugins can stack a lane above or below the bars (`host.addLane`); the wave shrinks to make room,
  and a press on a lane is not a seek. They can also draw into a shared layer over the canvas
  (`host.overlay`), read the peaks and the wave's geometry (`host.peaks`, `host.geometry`), learn
  when the wave area changes size or a lazy frame gets its pixels near the screen (the `resize` event
  and a `resize` hook on a plugin) and when the
  duration becomes known or changes (the `durationchange` event), and resolve a CSS color against the
  frame (`host.color`). All of this is additive: a 0.1.0 plugin keeps working unchanged.

### Changed

- `markers` can now carry a label and a color per mark (`marks: [{ time, label, color, id }]`, still
  accepting plain `times`). A click on a marker seeks to it, hovering shows a tooltip, `M` and
  `Shift+M` step through them (Shift, not the letter's case, sets the direction), and markers that
  crowd together become one pill with a count. Within `backGrace` seconds of a marker (1 by
  default), `Shift+M` goes to the one before it, like a player's "previous track".

## [0.1.0] - 2026-10-08

### Added

- Peaks helpers: `readPeaks` reads a list or `{ "peaks": [...] }` and refuses anything else or more than 20,000
  values; `loadPeaks` fetches each address once per page and forgets a failure so it can be tried again; `resample`
  folds peaks keeping each slice's loudest point, or stretches them by blending neighbours; `peaksFromChannel` turns
  decoded samples into exactly the number of peaks asked for, normalized.
- A core that never touches the page, tested in Node: bar geometry in whole device pixels (one width for every bar,
  edge to edge, exactly centered, never overlapping), and playback state driven by a media element's events. A seek
  asked for before the metadata waits for it, a drag seeks once when it is let go, a cancelled drag changes nothing,
  the WAI-ARIA slider keys move by seconds, and the slider's values are written only when they change.
- `SonicFrame`: a waveform on a canvas inside any element, sharp at any zoom or screen density, that follows an
  audio or video element and seeks it by click, drag (touch included) or keyboard, with a hover band, an optional
  cursor line, colors from CSS custom properties and bars that grow in when peaks arrive (not with reduced motion).
  Pixels and peaks are taken only near the screen, every frame shares one ResizeObserver, one IntersectionObserver
  and one animation loop that runs only while something plays on screen, and `destroy()` gives the element back as
  it was.
- Plugins, drawn under or over the bars, and the first one: `markers`, lines at moments given in seconds.
- `PlayButton`: a play / pause `<button>` for an audio or video element, in three shapes (circle, rounded, square)
  and three fills (solid, outline, ghost), with any size, corner radius and colors from CSS. Its play triangle is
  centered by its centroid, so it looks centered, and starting one media pauses the others.
- Bars default to 3 px with a 2 px gap, rounded corners and quiet parts lifted (`curve` 0.7), so speech reads well.
