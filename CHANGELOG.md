# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- The now-playing bar, `nowPlaying` in `sonicframe/playlist`: a small bar fixed to the window that follows the
  player that started playing last, so the sound can be controlled while the page scrolls. It shows while that
  player plays out of view (`when`: also `'playing'` or `'always'`), at the bottom or the top (`place`, `align`,
  `offset`, `width`, `zIndex`), holds the `parts` asked for (play, title, time, progress, close, the tracks
  around the sound, back to the player, speed), wears the player's colors or its own, and is a named region that
  Escape closes. `<sonic-now-playing>` is the same as a tag, a playlist brings one with `nowPlaying` (or the
  `now-playing` attribute), and `currentPlayer()` in `sonicframe/player` gives the player that played last.
  Players also have a `tracks` getter.
- A podcast's feed as a playlist: `feed` (or the tag's `feed`, `feed-order`, `feed-limit`) reads each episode's
  sound, length, picture, chapters and transcript, newest first by default, with a limit. `readFeed` and `loadFeed`
  read one by themselves, in `sonicframe/playlist` and in `sonicframe/analysis` for servers. The feed is read by
  SonicFrame's own small XML reader, not the browser's, so it works under a strict Content-Security-Policy with
  Trusted Types and in Node. One that declares entities is refused, and its ceilings are options: `maxSize` (5 MB,
  up to 20 MB), `maxDepth` (100, up to 256), `maxElements` (200000, up to 1000000), `maxAttributes` (200, up to 10000) and `maxNameLength` (1000, up to 50000). The defaults are the ones the most used XML readers settled on;
  an app's code may raise each up to its most, and the tag's `feed-max-*` attributes may only lower them. A feed past
  one, or an option past its most or under its least, throws a `RangeError` that names the option.
- `SONIC_TAGS`, in `sonicframe` and `sonicframe/analysis`: each tag with the attributes it reads, its children that
  count (a playlist's links) and the starts of names it also reads, for a CMS's HTML filter (WordPress's KSES,
  DOMPurify) to let authors place players. None is an event handler; `upload-url`, which sends a visitor's recording
  to the address an author picks, is marked `trustedOnly`. The docs' new page "On a CMS or WordPress" gives the
  filter ready to paste and how a shortcode or block escapes the tag on the server.
- The `title` and `artist` parts, off unless the look places them: the sound's name (the player's `a11y.label`, or
  without one its file's name, "little-elf.mp3" as "Little elf", which `look.titleFromFile: false` turns off) and
  the new `artist` option, as text that screen readers skip (they hear the name on the player itself). Each
  takes its text's width up to `look.nameMaxWidth` (12 rem) and gives up its room before the wave. `artist` is
  also the media controls' artist when `mediaSession` names none, and a playlist's track brings its own. On
  `<sonic-player>`, the `artist` attribute, and `line` and `meta` (part names by spaces, `"play wave title"`) place
  the parts as `look.line` and `look.meta` do.
- `a11y.sliderName` (the tag's `a11y-slider-name`) names the wave's slider by its sound: `'label'` the sound's
  name, `'both'` the name and the slider's word ("Little Elf, Playback position"), so a page of many players tells
  their sliders apart. The default stays `'position'`, the word alone; `setLabel` updates it, and `frame.label` wins.
- Minified files beside the readable ones, for pages without a bundler: `dist/player.min.js` and each other entry,
  with their own minified chunks, in about half the bytes. From npm they are `sonicframe/min`,
  `sonicframe/min/player`, `sonicframe/min/record`, `sonicframe/min/playlist` and `sonicframe/min/analysis`. The
  readable files are unchanged.

### Changed

- A `<sonic-playlist>`'s own links are inert as well as hidden while its playlist stands, so a page whose CSS shows
  hidden elements still cannot click or focus one (one with a `javascript:` address included); they come back as
  they were when the tag leaves the page.
- Ceilings that could only be lowered now go up to a fixed most, studied in mature projects and the browsers' own
  limits: the player's `decode.maxBytes` (50 MiB, up to 256 MiB) and `decode.maxSeconds` (30 minutes, up to 10
  hours), `readPeaks`'s limit (20 000, up to 1 000 000), and a recording's `maxSeconds` (300, up to 6 hours, from 3600) and `maxBytes` (100 MiB, up to 1 GiB); `<sonic-recorder max-seconds>` keeps to 3600, as before. A larger
  value is kept at the most until 2.0. Chapters: `loadChapters`'s `maxBytes` goes up to 5 MB, and the new
  `maxChapters` (1000, up to 10 000) is also taken by `readChapters` and by the chapters plugin's `load` for chapters
  given as a list or a text. Tracks: `readTracks` takes `maxTracks` (1000, up to 10 000) and `maxText` (512 KB, up
  to 5 MB), `loadTracks` takes `maxTracks` and its `maxBytes` goes up to 5 MB, the playlist takes `maxTracks`, and a
  feed's `limit` goes up to 10 000. Regions and markers in a file: `readRegions` and `readMarkers` take `maxItems`
  (2000, up to 20 000) and `maxText` (512 KB, up to 5 MB); the markers plugin's `max` goes up to 20 000. The
  player's `remember.sounds` goes up to 5000. A clip's `width` and `height` go up to 3840 × 2160, and `exportClip`
  takes `maxSeconds` (120, up to 600), `bitrate` (8 Mbps, up to 50) and `maxBytes` (100 MiB, up to 1 GiB). The
  spectrogram's `fftSize` goes up to 32 768 (the Web Audio standard's own most), its `columns` up to 16 384 and its
  `rows` up to 4096, and its job gives the `fftSize` it used; `levels` and `findSilences` take `maxWindows` (200 000,
  up to 2 000 000), and `findSilences` and `silencesFromPeaks` take `maxSilences` (10 000, up to 100 000). New
  options `maxPeaks` and `maxBytes` on `loadPeaks` (20 000 and 2 MB, up to 1 000 000 and 64 MB) refuse a value past
  either end with a `RangeError` that names them.

### Fixed

- A sound that cannot load no longer leaves the player silent about it at "0:00 / 0:00": a message over the wave
  says why ("Could not load the sound", "This sound cannot be played here"…) in the player's language, the
  live region says it, and the `error` event goes out with a `SoundError` (`sonicframe/player`) whose `reason` is
  `'network'`, `'unsupported'`, `'decode'` or `'aborted'`. The message and the announcement are on by default, so a
  person who cannot see the player learns it too; `loadError: false` and `a11y.loadError.announce: false` (the tag's
  `load-error="false"` and `a11y-load-error="false"`) turn them off. A language registered for 1.1 says the four new
  phrases in English until it gives its own.
- A WebVTT file's character reference named like a property every object has (`&constructor;`) was read as the
  text of a JavaScript function in a chapter's or a cue's title; it now stays as written, like any unknown
  reference.
- A clip's `maxSourceSeconds: Infinity` lifted every limit on the source decoded whole in memory, so a long
  enough sound could take the tab down; it now goes up to 2 hours (about 2.7 GB of decoded stereo), `Infinity`
  included.

## [1.2.0] - 2026-11-12

### Added

- A player can know the tracks around its sound, off by default: `tracks` (`previous`, `next`, `hasPrevious`,
  `hasNext`) and `setTracks` add the parts `previousTrack` and `nextTrack`, the key N (Shift+N back; `keys.track`
  picks the letter or turns it off) and the media controls' previous and next track. `mediaSession.previousNext`
  picks what those controls step through: the tracks or the chapters (`'auto'`, the default), only one, or nothing.
  At an end of the list a track button is marked unavailable and keeps its place in the tab order.
- `readTracks` and `writeTracks` in `sonicframe/analysis` read and write the tracks of a list: a list of
  `TrackInput`, SonicFrame's JSON or an M3U/M3U8 playlist (`#EXTINF`, `#EXTART`, `#EXTALB`, `#EXTIMG`), with the
  relative addresses of a list pointing beside it (`base`). Every address passes the same check as the rest of
  SonicFrame (only http, https or relative), every name is cleaned to one safe line of at most 120 characters, a
  list keeps at most 1000 tracks (`MAX_TRACKS`) and a text over 512 KB is refused.
- `sonicframe/playlist`, a new entry: `createPlaylist` plays a list of tracks one after the other, with one player
  on one media element (the volume, the mute and the speed carry on) or a player for each track (`layout: 'each'`).
  The list is the same one the player's chapters use (inline, popover or drawer, with every look option), with
  shuffle and repeat buttons, `advance`, `repeat`, `shuffle`, `gap`, `previousRestarts`, `playOnSelect`, and
  `remember` for the track, the shuffle and the repeat. The list is one stop in the tab order (arrows, Home, End),
  the track playing is `aria-current`, and each change is said ("Playing: Title, 3 of 12"). `<sonic-playlist>` is
  the same as a tag, its tracks from its own links or from `src`. `loadTracks` fetches a JSON or M3U list, sending
  cookies only to the page's own site unless asked.
- `registerLanguage` takes a language written for an earlier version: the phrases added since 1.0 may be left out
  and are said in English. `wordsFor` gives every phrase, as the new `CompleteWords` type.

### Changed

- Donations moved to Buy Me a Coffee (https://buymeacoffee.com/ediejohnny): `npm fund`, the repository's Sponsor
  button, the README and the docs site point there.

## [1.1.0] - 2026-11-11

Nothing changes in your code: the player's time reads as it did until you turn the new clock on.

### Added

- A precise clock, off by default: the look's `timePrecision` (`time-precision` on `<sonic-player>`) adds
  `'tenths'`, `'hundredths'` or `'milliseconds'` to the player's time, rounded to the nearest, or a timecode's
  `'frames'` at `timeFps` frames a second (`time-fps`, 1 to 120). `timeHours` (`time-hours`) shows the hours from
  one hour on but always with a frame (`'auto'`), always, or from one hour on with a frame too (`'needed'`);
  `timeDigits` gives each field its least digits, up to 4; `timeDecimal` (`time-decimal`) picks the decimal mark, a
  point by default or the player's language's with `'auto'`. `timeFormat` (`time-format`) writes the time with a
  mask of your own over all of these: `h`, `H`, `m`, `s`, `S` and `f` are the fields, repeated for their digits, and
  anything else, or text in brackets, is written as it is (`'hh[h]mm[m]ss[s]'` writes `00h37m26s`). While the sound
  plays, the time changes as often as its last digit does, and no more; paused, nothing runs. The time played and
  the time left add up to the length shown, each time keeps the room of its widest text, and the slider still speaks
  whole seconds. `formatClock` writes a time the same way, with the types `ClockFormat`, `ClockPrecision`,
  `ClockHours` and `ClockDigits`.

## [1.0.0] - 2026-11-01

SonicFrame leaves the beta. 1.0 is 0.8 with a promise: from here on it follows Semantic Versioning, so a 1.x
version never breaks code written for 1.0, and old names keep working until 2.0. Moving from 0.8 changes nothing
in your code.

### Added

- The "Versions and support" page says what the promise covers, which defaults stay and which versions get fixes,
  and `SECURITY.md` says how to report a vulnerability privately on GitHub.
- Every version is published to npm from the repository's GitHub workflow, with provenance (`npm audit
  signatures` checks it).
- The package names its donation campaign (`funding`), so `npm fund` and the npm page show where to support
  SonicFrame.

## [0.8.0] - 2026-11-01

### Added

- The player's own keys, off by default: `keys: true` (or `keys` on `<sonic-player>`) plays and pauses with
  Space, mutes with M, skips with ← →, turns the volume up and down with ↑ ↓ and goes up and down the look's
  speeds with `>` and `<`. Each key can be your own or `false`, `seconds` and `volumeStep` set the steps, and
  `scope: 'page'` (`keys="page"`) lets them reach the player that played last while nothing on the page has
  the focus. The control with the focus keeps the keys it uses, and nothing happens while someone types.
  `a11y.keys.announce` (`a11y-keys="announce"`) says what they change. The type `PlayerKeys` names them.
- The player remembers between visits, off by default: `remember: true` (or `remember` on `<sonic-player>`)
  brings back where each sound was left (it resumes there, unless near its end), the volume, the mute and the
  speed. `position`, `volume` and `speed` pick what to keep, `key` names the group (`remember-key`), `sound`
  names the sound, `store` takes `sessionStorage` or your own storage, `sounds` and `nearEnd` set the limits.
  `player.forget()` clears it, the `resume` event (`sonicframe:resume`) tells where a sound resumed, and
  `a11y.remember.announce` (`a11y-remember="announce"`) says it at the first play, with the new word
  `player.resume` in every language. The types `PlayerRemember` and `RememberStore` name them.
- Regions and markers go out and come back as files: `writeRegions` and `writeMarkers` write JSON (the
  default), WebVTT, CSV or Audacity labels, and `readRegions` and `readMarkers` read any of the four, finding
  the format by the content. CSV takes a `separator` (`,`, `;` or a tab) and a `decimal` mark, and guards a cell
  a spreadsheet would run as a formula with a `'` (`guardFormulas`, on by default), which reading takes back.
  Markers written as WebVTT last until the next one, so the file serves as chapters. Reading refuses a text over
  512 KB, keeps at most 2000 items and cleans every label. On `sonicframe` and `sonicframe/analysis`, with the
  types `MarksFormat`, `MarksWriteOptions`, `MarkersWriteOptions`, `MarksReadOptions` and `CsvSeparator`, and
  `MARKS_FORMATS`.
- `regions()` tells `onInput` at every move of a drag that changes a region (drawing, moving or resizing it),
  for an app that shows the times as they change. The type `RegionInput` names a region as you give it.
- M and Shift+M say "No more markers" when there is no marker that way (the word `markers.none`, in every
  language), as C says "No more chapters".
- `KeyModifiers.repeat`: a plugin's `keyDown` hears whether the key is held down and repeating.

### Changed

- `regions()` tells `onChange` once when a drag is let go, no longer at every move: an app that saves there
  saves once. Follow the times while they move with `onInput`.
- `regions()` tells the app only of real changes: no `onChange` for a press on a region that
  moves nothing, for `remove()` of an id no region has or for an `update()` that changes nothing, and no
  `onSelect` when the selection stays the same.
- `<sonic-player>` keeps its sound through what does not change it: a player built again for an attribute keeps
  the same audio, where it was and at its volume and speed, and the tag moved to another place on the page keeps
  its player. Only a new `src` or `preload` brings a new sound.

### Fixed

- Regions keep an id of their own: an id given twice, or one the plugin would make (`region-1` in a file read
  back), no longer makes two regions share it, which removed both, stacked their labels and could drag the
  wrong one. `items` takes ids, as `add()` and `set()` do.
- `add()`, `set()` and `update()` of `regions()` refuse a start or end that is not a finite number, which left a
  region at `NaN` for good.
- `update()` of `regions()` works before the sound's length is known (it did nothing): the label and the color
  change at once, and the times are fitted to the sound once its length is known.
- A looping region that is removed (by `remove()`, `clear()`, `set()` or Delete) stops playing.
- `onSelect` of `regions()` gets a copy, as every other call does, and `select()` of an id no region has
  selects none; a drawing cut short (the pointer taken away) no longer leaves the selection on a region that
  is gone, where L still said "loop on".
- R with no region, and M with no marker, let the key go on to the page.
- A held L switches a region's loop once, not at every repeat.
- `markers()` leaves out a moment that is not a finite number, and no longer breaks on `null`.
- The keys pressed on the minimap's slider stay its own: Delete no longer removes the selected region, nor do
  Enter, C, M or the zoom keys reach the wave behind it.
- The zoom's letters of your own (`keys: { in: 'i' }`) work whatever their case, so Caps Lock changes nothing,
  as for every other letter.
- P of `soundDescription()` brings a zoomed view to the part it lands on, as C and M do.
- `largeStepRatio` is kept from 0.01 to 1 (a negative one turned Page Up around), and the volume control's
  `step` from 0.01 to 1.
- `formatTime` with decimals carries a rounded fraction to the next minute (`1:00.0`, never `0:60.0`).
- The volume bar takes the focus when it is pressed, so its keys work right after a click.
- `Player.destroy()` stops the download of the sound it made, too.
- A fast seek from the system's media controls lets go of a looping stretch, which pulled the sound back while
  the person dragged.

## [0.7.0] - 2026-11-01

The API is tidied up before it is promised: one name for one idea everywhere. Nothing breaks. Every old name
keeps working, marked `@deprecated` with what to use instead, until 2.0.

### Added

- Types an app or a plugin needs to name: `WavePoint`, `PointerClaim`, `Placement`, `KeyModifiers`,
  `TooltipA11y`, `ClipResult`, `VolumeLook`, `Fetcher`, `FetchedResponse`, `ChaptersSource` and `LanguageTag`;
  the options and results of the analysis functions (`LevelsOptions`, `Levels`, `FindSilencesOptions`,
  `SilencesFromPeaksOptions`, `PeakLevel`, `SilenceKind`); `RecorderWords` on every entry; `LevelTrack`,
  `RecorderAfterSend`, `RecorderLive`, `RECORDER_AFTER_SEND`, `RECORDER_LIVE` and `RECORDER_ICONS` on
  `sonicframe/record`; and on `sonicframe/player`, every type its options and getters reach (`MinimapOptions`,
  `ZoomOptions`, `WaveStyle`, `PlayerChapterListStyle` and the rest).
- `wordsFor(tag)`: every word of the language a tag finds, frozen.
- `normalizePeaks` and `resamplePeaks`; `resamplePeaks` is on `sonicframe/analysis` too.
- Everything a screen reader hears now lives in the `a11y` group, by place, and your own words are always
  `a11y.words`: the frame's `a11y.label` and `a11y.valueText`; `a11y.words` on `PlayButton`,
  `VolumeControl`, `markers()`, `chapters()`, the player and the recorder screen; `a11y.valueNote` and
  `a11y.announce` on `chapters()`; the player's `a11y.label`; `announce` on `soundDescription()`. On the
  tag, `a11y-label` and `a11y-chapters` (`announce`, `readable`, `no-value-note`). The types `MarkersA11y` and
  `ChaptersA11y` name the groups.
- The zoom's and the minimap's words can be phrases (`'Zoom {level}: {from} to {to}'`), like every other
  word, as well as functions; the minimap takes its name as `a11y.words.label`.
- The player: `showVolume(show)`, `setBar(bar)` and `setLabel(label)`, and the `descriptionchange` event. The
  look's names say what they measure: `narrowWidth`, `waveMinWidth`, `fontWeight`, `volumeSlider`,
  `marqueePauseOnHover` and `marqueePauseSeconds` (in seconds, like every other time); the part
  `previousChapter` (class `.sonicframe-previous-chapter`); `decode.peakCount`; the chapter list's `box`. The play
  button's `size` takes rem too (`'2.5rem'`), so it grows with the page's text.
- The tag: the `player` property gives the player it built (`chapters.go()`, `setLook()`), the
  `SonicPlayerElement` type and `document.createElement('sonic-player')` know it, and `PlayerAttribute` names its
  attributes. Its words follow the options' names in kebab-case: `chapters-options`, `stay-open`, `edge-scroll`,
  `auto-hide`, `pause-in-value` and `pause-on-hover`.

- Plugins: `markers()` takes `items`, gives them back as `items`, groups by `groupDistance` and takes its keys
  as `keys` (your own letter, or `false`; `keys.backGrace`); `regions()` gives `items`, replaces them all with
  `set(items)`, creates by `create` (on or off) and `createGesture`, and takes each key as your own letter or
  `false` (`keys: { select, loop, play, nudge, remove, release }`); `regions()` and `skipSilences()` snap their
  edges with `pixelSnap`; `skipSilences()` takes its shade as `color`. The types `MarkersKeys` and
  `RegionsKeys` name the keys.
- `chapters()` tells `onChapterChange`, gives the chapters as `items`, and turns its strip of titles on with
  `lane: true`, placed by `lanePlacement` (`'below'` by default, or `'above'`).
- Heights take their unit: `height` on `timeline()` and `caption()`, `height` and `gap` on `minimap()` and
  `laneHeight` on `chapters()` take `'1.5rem'` or `'20px'` as well as a number (in pixels, and in rem for
  `laneHeight`, as before). The type `CssLength` names them.
- `timeline()` and `minimap()` sit over the wave with `placement: 'above'`.
- `caption()` cuts its tooltip at `tooltipMax` and a section at its `max`, and its tooltip's colors follow
  `a11y.tooltip.readable` (on by default, as it always was; off, the page's color for text on the played color).
- `timeFormat` on `soundDescription()` and `describeSound()`, `bands` on `liveFrequency()`, and `channel:
  'all' | 'each'` on `writeWaveform()`.
- `loadPeaks(url, { fetcher, shared })` takes the same `Fetcher` as the other loaders, and `shared: false`
  fetches every time. The type `LoadPeaksOptions` names them.
- Recording: the screen's states are `RecorderScreenState` and `RECORDER_SCREEN_STATES` (the `Recorder` alone
  has its `RecorderPhase`); `Recorder` takes `decode: { peakCount }` (the type `RecorderDecode`, as the
  player's `decode.peakCount`), `levelsPerSecond` and `mimeTypes`, and a `Recording` names its type as
  `mimeType`; the screen takes `liveSeconds` and `recBlink`, and tells `statechange`; an upload takes
  `bodyType`.
- `<sonic-recorder>`: `max-seconds`, `live-seconds`, `after-send="reset|keep"` and `rec-blink`, and `wave` and
  `font` (with `font-src` or `font-stylesheet`), as `<sonic-player>` reads them; it dispatches
  `sonicframe:statechange`, and it builds again when the `icon-<name>` of one of the page's buttons changes.

### Changed

- `lang` offers the built-in tags and `'auto'` as you type, `theme` and `extends` the theme names, and
  `WavePoint.pointerType` is `'mouse' | 'touch' | 'pen'` (a pointer the browser leaves unnamed is a mouse).
- A palette of your own may leave colors out (they come from `light`), a theme takes a palette of its own and a
  drawing by its name (`wave: 'bars'`), `outlineSound` and `resamplePeaks` read any list of numbers (a
  `Float32Array`), and `ChaptersPlugin.set` says what it takes.
- A palette colors the chapters' lines too (`--sonicframe-chapter`, its quiet color), so they no longer stay gray
  on a dark palette.
- `PART_NAMES` lists `previousChapter` where it listed `prevChapter`; `prevChapter` is still read as it.
- The recorder screen refuses an app's button named `resume` or `cancel`, the names of two of its own icons: on
  `<sonic-recorder>`, its `icon-resume` or `icon-cancel` would draw both.
- `findSilences` keeps its `windowSeconds` from 0.001 to 1 second (a longer window took the whole sound as one
  stretch), and the TSDoc of each `threshold` says what it measures against.

### Fixed

- `soundDescription()` with a `keys.backGrace` that is not a number kept Shift+P from going back at all; it
  now takes the usual second.
- `silencesFromPeaks` with a `threshold` over 0.5 never ended a silence (it ends above twice the threshold,
  past the loudest peak); the threshold is kept from 0.001 to 0.45, as `outlineSound`'s is.

### Deprecated

- `normalize` and `resample` (use `normalizePeaks` and `resamplePeaks`), `Claim` (`PointerClaim`),
  `WaveformFetcher` and `ChaptersFetcher` (`Fetcher`), `WaveformResponse` (`FetchedResponse`), and
  `CHAPTER_WORDS`, `ZOOM_WORDS`, `MINIMAP_WORDS` and `DESCRIPTION_WORDS` (`wordsFor`).
- Accessibility outside the `a11y` group (use the name in parentheses; given both, the new one wins): the
  frame's `label` and `valueText` (`a11y.label`, `a11y.valueText`), `labels` of `PlayButton` and
  `VolumeControl` (`a11y.words`), `words` of `markers()` and `chapters()` (`a11y.words`), the chapters'
  `valueNote` and `announceChange` (`a11y.valueNote`, `a11y.announce`), the player's `label` (`a11y.label`),
  `a11y.labels` of the player and the recorder screen (`a11y.words`), the minimap's `a11y.label`
  (`a11y.words.label`), `soundDescription`'s `announceWhenReady` (`announce`), and the words `announce` and
  `readable` in the tag's `chapter-options` (`a11y-chapters`).
- The player's names that did not say what they are: `setVolume` (`showVolume`), the look's `narrow`, `waveMin`,
  `weight`, `volume`, `marqueeHoverPause` and `marqueePause` in milliseconds (`narrowWidth`, `waveMinWidth`,
  `fontWeight`, `volumeSlider`, `marqueePauseOnHover`, `marqueePauseSeconds`), the part `prevChapter` and its
  class `.sonicframe-prev-chapter` (`previousChapter`), `decode.peaks` (`decode.peakCount`), the chapter list's
  `style` (`box`), the `description` event (`descriptionchange`) and the type `ButtonAnimation`
  (`ListenButtonAnimation`). A resolved look gives each old name back with the same value.
- The plugins' names that meant two things or said nothing: `markers()`' `marks` and `times` (`items`), its
  getter `marks` (`items`), `group` (`groupDistance`) and `backGrace` (`keys.backGrace`); `regions()`' `list()`
  (`items`) and `create: 'shift-drag' | 'drag'` (`createGesture`); `snap` on `regions()` and `skipSilences()`
  (`pixelSnap`; the `snap` of markers and chapters, a click going to the exact moment, stays); `skipSilences()`'
  `dimColor` (`color`); `chapters()`' `onChange` (`onChapterChange`), its getter `chapters` (`items`) and `lane:
  'above' | 'below'` (`lane: true` and `lanePlacement`); `size` on `timeline()` and `caption()` (`height`);
  `side` on `timeline()` and `minimap()` (`placement`; `side` keeps meaning left or right); `caption()`'
  `tooltipLimit` and a section's `limit` (`tooltipMax`, `max`); `times` on `soundDescription()` and
  `describeSound()` (`timeFormat`); `liveFrequency()`'s `bars` (`bands`); `writeWaveform()`'s `channels: 'mix'
  | 'each'` (`channel: 'all' | 'each'`); a fetcher as `loadPeaks`' second argument, and its type `PeaksFetcher`
  (`{ fetcher }`, a `Fetcher`).
- The tag's older words: `chapter-options` (`chapters-options`), `stay`, `edges`, `autohide`, `pauses` and
  `hover-pause` (`stay-open`, `edge-scroll`, `auto-hide`, `pause-in-value`, `pause-on-hover`).
- Recording: `RecorderState` and `RECORDER_STATES` (`RecorderScreenState`, `RECORDER_SCREEN_STATES`);
  `Recorder`'s `peaks`, `rate` and `mimeType` (`decode.peakCount`, `levelsPerSecond`, `mimeTypes`); a
  `Recording`'s `type` (`mimeType`; both are given until 2.0); the screen's `window` and `recordBlink`
  (`liveSeconds`, `recBlink`) and its `state` event (`statechange`; both are told until 2.0); an upload's
  `body` (`bodyType`); and on `<sonic-recorder>`, `max`, `window`, `keep`, `record-blink` and
  `sonicframe:state` (`max-seconds`, `live-seconds`, `after-send="keep"`, `rec-blink`,
  `sonicframe:statechange`).
- Names that were the library's own pieces: `markerSpans`, `pickMimeType`, `clipPlan`, `MediaLike`,
  `soundWords`, `SoundWords`, `playerWords`, `PlayerWords`, `pickPalette`, `resolveFont`, `safeFontUrl`,
  `RecorderEvent` and `RECORDER_EVENTS`.

## [0.6.0] - 2026-11-01

### Added

- `a11y.tooltip.readable` for `markers()` and `chapters()` (and so the player's `chapters`; on the tag, the
  word `readable` in `chapter-options`): the tooltip's text in black or white, whichever reads on its color
  (4.5:1), as the caption and the long chapter name already do. Off by default: the page's color for text on
  the played color (`--sonicframe-on-progress`), as before.
- Three more languages: Portuguese as spoken in Portugal (`pt-PT`), Spanish (`es`) and French (`fr`), for every
  word SonicFrame says (names, values, announcements and the wave in words). `pt` stays the Portuguese of Brazil
  and `en` the English of the United States. A tag finds its language the BCP 47 way, the whole tag first, then
  shorter (`es-MX` speaks Spanish, `pt-BR` Brazilian Portuguese); any other tag still speaks English.
- `registerLanguage(tag, words)` brings a whole language at run time (`ja`, say), checked against English: every
  phrase, nothing more, the same marks; `languageProblems(words)` says what is wrong. Built-in languages cannot
  be replaced. `LANGUAGE_NAMES` and the `Words`, `MarkerWords` and `RegionWords` types are exported.
- `a11y.lang` on the frame (its plugins speak it too), `PlayButton` and `VolumeControl`, and `host.lang` for
  plugins. English by default, as before; the player hands its language to its wave, so the plugins an app adds
  to a player speak the player's language.
- The markers' `words` (`{ more }`, the tooltip's "and 3 more"), the regions' `a11y.words` (what R and L say),
  the volume control's `labels.muted` and the player's `muted` label.
- `CONTRIBUTING.md`, with "Adding a language": one file and one line, checked by the tests.
- A player's own background, `look.background`, off by default: a color, a gradient (two to five colors,
  linear, radial or conic) or an image (a web, relative or `blob:` address; size, place and repeat), with
  filters (blur, brightness, contrast, saturate, grayscale, sepia), an opacity and six ready-made effects
  drawn by SonicFrame: `dim`, `vignette`, `frost`, `tint`, `duotone` and `grain`. It takes the surface's
  place, sits behind the controls and is hidden from screen readers; colors are read as numbers before any
  style gets them. Themes can bring one, and a player's own look changes only what it gives.
- `look.backgroundAnimation`, off by default: `pan`, `zoom`, `pulse`, `hue` or `flow`, with its `duration`
  and `strength`. It moves only while the sound plays unless `while: 'always'`, holds still under the mouse
  or the focus with `pauseOnHover`, and never runs with reduced motion.
- The tag's `background-` attributes: `background-color`, `background-gradient`, `background-image`,
  `background-options`, `background-angle`, `background-blur`, `background-opacity`, `background-effects`,
  `background-animation` and `background-duration`.
- The lock screen and the media keys: `mediaSession()`, a plugin for the system's media controls, and the
  player's `mediaSession` option, off by default. The controls show the title (the player's `label` unless
  given), artist, album and pictures, and play, pause, skip (the controls' own step, or `look.skip`), seek and
  stop; previous and next track go to your `onPrevious`/`onNext` or, on a player with chapters, to the chapter
  before and after, and browsers that list chapters show them. The media that played last owns the page's
  controls, and the others leave them alone. Words are cleaned, pictures come only from web, relative or
  `blob:` addresses (at most eight), and the position is sent only for a sound of known length. On the tag:
  `media-session`, `media-title`, `media-artist`, `media-album` and `media-artwork`, changed without stopping
  the sound. A new docs page, "Lock screen and media keys".
- `sonicframe/record`, a new entry for recording from the microphone: record, hear, send.
    - `createRecorder({ container, onSend })`, a ready-made screen dressed like a player (theme, look, palette):
      a record button; while recording, the time, a live wave (scrolling through the last `window` seconds, or
      `live: 'fit'`) and the buttons to pause, stop and delete; then a player of the recording, and Send. The
      parts of each stage are lists (`parts`), `hold` records while the button is held, and `afterSend` starts
      over or keeps the recording. `onSend` may return a Promise: the screen says it is sending, and a failure
      keeps the recording to send again.
    - What follows a stop is yours: `afterStop` goes to review (the default), sends right away, or with
      `'none'` only hands the recording over (`onRecorded`) and starts again, so a screen can be a single
      record button. `actions` adds your own buttons to any stage, `icons` draws any button with your own
      SVG path, `align` lines the buttons up beside the player of the recording (on its bars by default) and
      `reviewLook` is that player's own look.
    - Sending to your server: `upload` (address, method, form field, fields, headers) sends with no code,
      `uploadRecording()` does the same from your own `onSend`, which now gets a `signal` and `progress`;
      "Sending, 40%" shows under the parts, and `cancelSend` (off by default) lets a send be canceled.
    - The record button's style (`recordStyle`): a red button (the default), the dot in the player's colors, a
      microphone (its outline, or filled with `micStyle`; on the red button, or in the player's colors with
      `micColor`), or a retro REC mark, in your own red (`recordColor`). While recording, REC shows as a badge before the time, as the stop
      button, or holding the time (`recPlace`), and its dot can blink once a second (`recordBlink`, off by
      default, never with reduced motion, still under the pointer or the focus).
    - Accessibility: every button named, the focus on each stage's main button, the live wave hidden from
      screen readers, and the live region saying each change and why the microphone cannot be used;
      `a11y.announceEvery` also says the time while recording (off by default). Words in every language, with
      `a11y.labels` for your own.
    - `Recorder`, the same without a screen: `start()` (asks for the microphone only then), `pause()`,
      `resume()`, `stop()` (the recording, with its length, type, size and peaks), `cancel()`, live `levels`, and
      a `RecordError` whose `reason` says why it cannot record. The microphone is never sent to the speakers and
      is let go on stop, cancel and destroy; a recording stops at `maxSeconds` (300 by default) and past
      `maxBytes`.
    - `<sonic-recorder>`, with `defineSonicRecorder()`, and its `sonicframe:` events.
    - New docs: a "Voice" group with the page "Recording", and "A chat voice note" made with the recorder.

### Changed

- The README keeps only the logo, the badges and one picture of the player; every theme, palette and drawing is
  live in the docs' [theme gallery](https://ediejohnny.github.io/sonicframe/themes.html) instead.

### Fixed

- The shared tooltip (markers, chapters, captions, a long chapter name) keeps clear of the page's scrollbars, as
  the chapters popover already did.
- The regions' labels show again after the player builds its wave anew (a new theme, look or volume control),
  and on any frame the same regions plugin is set up on later.
- A `max` that is not a number (`NaN`, a string) falls back to the default: every marker is kept (up to 2000)
  instead of none, and the regions stay capped at 200 instead of unlimited. The same goes for the `threshold` of
  `soundDescription()` and `outlineSound` (0.06), which found no pauses before.
- The other numbers the options read within a range fall back to their default too when they are not numbers,
  instead of turning into `NaN`: the timeline's `size` and `minSpacing`, the caption's `size`, `tooltipLimit`
  and a tooltip section's `limit` (the tooltip showed only "(...)"), `skipSilences`' `lead` (it jumped to no
  time at all), the browser voice's `rate`, `frequencyBands`' and the live frequency's `minHz` and `maxHz` (all
  bars stayed at zero), the regions' `minLength` and the markers' `group` (crowded markers never shared a pill).
- The numbers the options read without a range fall back to their default as well when they are not finite
  numbers: the volume control's `size`, `width` and `step` (a step written as text muted the sound on an arrow
  key) and the play button's `size` and `radius`, also through `setLook`; the frame's `cursorWidth` (the cursor
  vanished), `stepSeconds` and `largeStepRatio` (Page Up sent the sound back to its start); the markers' and
  chapters' line `width` (the lines vanished); `decodeAudio`'s `sampleRate` (decoding failed);
  `createSpectrogram`'s `minDb` and `maxDb` (the picture went black); `levels`' `windowSeconds`,
  `findSilences`' `thresholdDb`, `minDuration` and `windowSeconds`, and `silencesFromPeaks`' `threshold` and
  `minDuration` (no silence was ever found). The Security page says the rule for every option.
- A skip of one second says "Back 1 second", not "Back 1 seconds": the player's new `backOne` and `forwardOne`
  labels are used when the language says the number in the singular, by its own plural rules (so "1,5
  seconde" in French). An app's own `back` or `forward` without its singular still serves both.
- A player in Portuguese says its words in Portuguese everywhere: the volume slider said "muted", and the regions
  and the markers' "and N more" spoke English, whatever the player's language.
- A player with a timeline above the wave and zoom no longer lays itself out again on every frame at some widths:
  its parts move to meet the bars only for a difference of a whole pixel, so they settle.
- A player no longer sets off "ResizeObserver loop completed with undelivered notifications" when it is made with
  a strip beside the wave (a timeline, a caption, chapter titles) or when its width crosses into a voice note. The
  page never showed it, but error trackers logged it, development overlays showed it as an error and some test
  runners failed on it. The player now lines its parts up with the bars before the first paint.
- The length on a chapter's picture in the list has room around it, instead of touching its edges.
- The docs: a code block's Copy button has a column of its own, so the code no longer runs under it on a phone
  or when a long line is scrolled.

## [0.5.0] - 2026-10-31

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
- The chapters list's items show a number (sound bars for the chapter playing), a picture with the chapter's
  length on it, a title in up to two lines and its stretch ("0:25 – 0:50"); the chapter playing is tinted and
  fills a thin bar as it plays, and a head (`header`) can name the list and the playing chapter's place. All of
  it is configurable through `listLook` (on the player, `list.look`): picture size, shape and corners, which
  pieces show, title lines, padding, corners and gap.
- `underStart` in the player's look (`'wave'`, the default, or `'line'`): the rows under a wave in the line start
  at the wave's left edge, or at the line's, under the play button.
- Long chapter names in the player's look, off by default: `nameOverflow` (`'ellipsis'`, the default, `'fade'`
  with `nameFade` rem and `nameFadeStart`, a fade at the start while the name walks, or `'clip'`), `nameTooltip`
  (the whole name under the mouse), and `marquee`: the name walks across its room as an endless strip, its copy
  `marqueeGap` behind and coming to rest where it started (`marqueeType: 'loop'`), or back to its start
  (`'restart'`), or back and forth (`'bounce'`), at `marqueeSpeed`, resting `marqueePause`, stopping under the
  mouse (`marqueeHoverPause`), never with reduced motion. `metaWrap` lets the row
  under the wave break in two, the parts after a spacer together on the far side; by default it keeps one line.
- The tag's `chapters` and `chapter-options` attributes, and the `sonicframe:chapterchange` event.
- The docs' Chapters page, with a WebVTT and a JSON example, and an upgrade guide from 0.4 to 0.5.
- `frame.time`: where the sound is, in seconds. The media's own time, or, before the media loads
  (`preload="none"`), where a seek will start it, while the media itself still says 0.
- `formatPosition(time, duration)`: a position for a clock. A seek can land a hair before the time it
  asked for (an MP3 asked for 0:15 can start at 14.998), so a position within 50 ms of the next second
  shows that second, never past the duration; `formatTime` cuts it to the second before.

### Changed

- The docs' Installation page now starts from the latest version: the CDN address carries no version (unpkg sends
  it on to the latest version's own address, so an entry and its pieces always match), and the source code comes
  from a plain `git clone` of `main` or its zip. A "Want a specific version?" part under each shows the same with
  `x.y.z`, to fill in with the version's numbers.
- The size ceiling of each entry rises from 96 KB to 128 KB (gzip, unminified, comments and chunks included).
- The keyboard focus ring of a control with a border of its own (the player's speed button, an outlined play
  button) now lies on that border instead of 2 px around it: one line, not a border and a ring side by side.
  Controls without a border keep the ring 2 px out, where their own fill cannot hide it.
- The docs' header is icons without borders, all of one size: the menu, the search (a box with a magnifying
  glass on wide screens), GitHub's and npm's marks in their own colors, the font and a moon or a sun for the
  scheme; each is named for screen readers, and the version is plain text. The font is chosen in a panel where
  every name is written in its own font (it was a select cut short on a phone). Keyboard focus on the docs is one
  ring, on a control's own edge.

### Fixed

- The parts beside a wave in the player's line (the play button, the time) sat lower than the bars whenever a
  plugin added a strip above or below them, or rows sat under the wave: the line centered them on the wave's
  whole box or column. They now line up with the bars' middle, moved by `translate` alone.
- Centered on short bars at the top of their box (a strip of titles under them), the play button stuck out of
  the player's line into its padding. The wave's box now takes a margin by the overshoot.
- The chapters popover's arrow sat one border-width off its button's middle, and its border stayed 1 px whatever
  the list's `style.border`; the drawer's close button sat above the list's head and off its right edge. Both now
  line up, measured when the list opens.
- With `preload="none"`, a seek before play left the player's time at 0:00 while the wave showed the place
  chosen, and the skip buttons started from 0:00. Both now go by the frame's time.
- A step to a whole second could land a hair before it (in floating point, 5 / 77 × 77 is 4.999…), so the time
  and the slider's words showed one second less (0:04 for 0:05). Every time the frame works out from a ratio
  (the seek itself, its event, `timeupdate` and the slider's words) is now kept to the microsecond.
- The browser itself can land a seek a hair short: an MP3 asked for 0:15 before it loaded started at 14.998,
  and the player's time and the slider's words said 0:14 from then on. They now write the position with
  `formatPosition`.
- The fade between docs pages never ran on the published site, and every move logged an uncaught
  `InvalidStateError`: the build put the stylesheet after the page's first script, so the arriving page read as
  not opting in. The stylesheets now come first, and a fade the browser skips on its own (a second click before
  the first page arrived) is no longer reported as an error.
- The docs' search said its words and its keys as one ("Search the docsCtrl K"), and once something was typed
  it took Escape twice to close. Its keys are said by `aria-keyshortcuts` only, and one Escape closes it.
- The docs, for people who cannot see the page:
    - **Search results:** each one says its title and its place apart ("Zoom and scroll, Long sounds", not "Zoom and
      scrollLong sounds").
    - **Previous and Next:** said the same way ("Previous: Overview").
    - **Menu on a phone:** while it is open, Tab and screen readers stay in the header and the list of pages,
      instead of wandering into the page behind it.
    - **Copy buttons:** each is described by the heading over its code, and "Copied." is said aloud.
    - **Wide code blocks:** a block wider than the screen can be scrolled from the keyboard.
    - **"On this page":** the link to a heading whose words the page already used as an address (the Words page's
      "Keys") now reaches that heading.
    - **Header:** the font and scheme switches left the landmark of links to other sites.
    - **Status lines:** the one-hour sound's status and the clip export's are said aloud.

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
