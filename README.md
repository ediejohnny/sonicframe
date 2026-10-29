# SonicFrame.js

Audio visualization and interaction framework for the web.

SonicFrame draws a sound's waveform on a canvas, follows an `<audio>` or `<video>` element as it plays, and lets
people seek by clicking, dragging or using the keyboard. It has no dependencies, works with any framework (or none),
and keeps pages with hundreds of players light.

- Sharp bars at any zoom or screen density: every bar has the same width in whole device pixels, edge to edge.
- Smooth progress while playing, from one shared animation loop that runs only while something plays on screen.
- Click, drag (touch included) and the WAI-ARIA slider keys; one seek per drag; a cancelled drag changes nothing.
- Colors from your CSS, including custom properties (`var(--name)`), so the waveform follows your theme.
- Lazy by default: pixels and peaks are taken only near the screen.
- Plugins drawn under or over the bars, with captions, regions, a timeline, markers, a spectrogram, live
  frequency bars and clip export in the box.
- Works under a strict Content-Security-Policy: no inline style attributes, no `eval`, no blob workers.

## Install

```sh
npm install sonicframe
```

## Quick start

```html
<audio id="voice" src="/voice.mp3" preload="metadata"></audio>
<div id="wave" style="height: 32px"></div>
```

```ts
import { SonicFrame, loadPeaks } from 'sonicframe';

const frame = SonicFrame.create({
    container: document.getElementById('wave')!,
    media: document.getElementById('voice') as HTMLAudioElement,
    peaks: () => loadPeaks('/voice.peaks.json'),
    label: 'Playback position',
});

frame.on('seek', ({ time, source }) => console.log('seek', time, source));
```

The element keeps its size from your CSS (give it a height); SonicFrame adds a canvas inside it. `frame.destroy()`
removes the canvas and gives the element back exactly as it was.

## Peaks

Peaks are the loudest point of each slice of the sound, as numbers from 0 to 1. SonicFrame never decodes audio to
draw it: compute peaks once (on your server, when the file is uploaded) and serve them as JSON, either a list or
`{ "peaks": [...] }`. A few hundred to a few thousand values are plenty; SonicFrame folds or stretches them to the
number of bars that fit.

- `loadPeaks(url)` fetches a peaks file once per page, however many frames use it. Files with more than 20,000 values
  are refused.
- `peaksFromChannel(samples, count)` computes peaks in the browser from decoded samples, for example a recording's
  preview: `peaksFromChannel(audioBuffer.getChannelData(0), 400)`.
- `peaks` takes a list, a function returning a promise of a list (called when the frame first comes near the
  screen), or `null` for a thin line until peaks arrive.

## Options

| Option           | Default            | What it does                                                                  |
| ---------------- | ------------------ | ----------------------------------------------------------------------------- |
| `container`      | (required)         | The element to draw in.                                                       |
| `media`          | `null`             | An audio or video element to follow and control.                              |
| `peaks`          | `null`             | Peaks, or a function that loads them.                                         |
| `duration`       | `null`             | Seconds, used until the media knows its own (or without media).               |
| `bar`            | see below          | `{ width, gap, radius, minHeight, align, curve }` in CSS pixels.              |
| `wave`           | `'bars'`           | How the sound is drawn: a name or `{ style, lineWidth, glow, mirror, … }`.    |
| `colors`         | see below          | `{ wave, progress, hover, cursor, knob }`.                                    |
| `cursorWidth`    | `2`                | Width of the cursor line in CSS pixels.                                       |
| `interact`       | `true`             | Click, drag and keys seek; `false` makes a picture only (`role="img"`).       |
| `label`          | `'Audio position'` | The accessible name.                                                          |
| `valueText`      | `0:12 / 0:45`      | `(time, ratio, duration) => string`, the position in words.                   |
| `stepSeconds`    | `5`                | Seconds moved by an arrow key (5 % of the sound while its length is unknown). |
| `largeStepRatio` | `0.1`              | Part of the sound moved by Page Up / Page Down.                               |
| `rewindOnEnd`    | `false`            | Show the start again when the media ends.                                     |
| `lazy`           | `true`             | Keep pixels and load peaks only near the screen.                              |
| `animate`        | `true`             | Let the bars grow in when peaks arrive (never with reduced motion).           |
| `plugins`        | `[]`               | Plugins to start with.                                                        |

Bars: `width` 3, `gap` 2, `radius` 1.5, `minHeight` 2, `align` `'center'` (or `'bottom'` for a bar meter), `curve`
0.7 (below 1 lifts quiet sounds so speech reads well; 1 draws the peaks as they are; above 1 leaves only the loud parts
standing out).

Drawings (`wave`): `'bars'`, `'needles'` (thin lines), `'blocks'` (square LED cells), `'dots'` (a dot matrix),
`'steps'` (an 8-bit staircase), `'line'`, `'area'`, `'scope'` (an oscilloscope trace), `'pulse'` (a heartbeat monitor)
and `'track'` (only a track, which needs no peaks). The bar style still sets their density, curve and alignment, and the
played, hover and unplayed colors work for all of them; live frequency and exported clips use the same drawing. Details:
`lineWidth` 2 (line drawings and the track), `glow` 0, `mirror` `true` (the line also traces the lower edge), `smooth`
`true` (curves instead of corners) and `knob` 0, the diameter of a dot that rides the playing position over any
drawing. `{ style: 'track', knob: 12 }` is a plain track with a moving dot.

Colors take any CSS color or `var(--name, fallback)`:

- `wave`: bars not yet played, `var(--sonicframe-wave, #c4cad4)`.
- `progress`: bars already played, `var(--sonicframe-progress, #2f6fdb)`.
- `hover`: the band between the played part and the mouse pointer; `'auto'` (the default) mixes the two colors
  above, `null` shows no hover.
- `cursor`: a line at the playing position; `null` (the default) draws none.
- `waveHover` / `progressHover`: recolor the unplayed and played bars while the pointer is over the frame; `'auto'`
  nudges the wave toward the played color and lightens or darkens the played color, a CSS color sets it outright, and
  `null` (the default) leaves them alone. Only the frame the pointer enters or leaves repaints.
- `knob`: the dot riding the playing position (`wave.knob`); `null` (the default) takes `progress`.

## Methods

| Method                 | What it does                                                         |
| ---------------------- | -------------------------------------------------------------------- |
| `SonicFrame.create(o)` | Same as `new SonicFrame(o)`.                                         |
| `setPeaks(source)`     | New peaks (a list, a loader function or `null`).                     |
| `bind(media)`          | Follow another media element, or none (`null`).                      |
| `setDuration(seconds)` | The duration to use until the media knows its own.                   |
| `setProgress(ratio)`   | The position shown (0..1) while no media is bound.                   |
| `seekTo(ratio)`        | Move to a position (the media too) and emit `seek`.                  |
| `setBar(bar)`          | Change part of the bar style.                                        |
| `setWave(wave)`        | Change the drawing (a name) or some of its details.                  |
| `setColors(colors)`    | Change some colors.                                                  |
| `setLabel(label)`      | Change the accessible name.                                          |
| `refresh()`            | Read the colors again after a theme change (dark mode is automatic). |
| `use(plugin)`          | Add a plugin; returns the function that removes it.                  |
| `on(event, listener)`  | Listen to an event; returns the function that stops listening.       |
| `destroy()`            | Remove everything SonicFrame added. Safe to call twice.              |

`progress` (0..1) and `duration` (seconds or `null`) are read-only properties.

## Events

| Event            | Arguments                 | When                                                                             |
| ---------------- | ------------------------- | -------------------------------------------------------------------------------- |
| `seek`           | `{ ratio, time, source }` | Click, drag, keyboard or `seekTo` (`source` says which).                         |
| `hover`          | `ratio, time`             | The mouse moved over the frame (`null` when it left).                            |
| `timeupdate`     | `time, ratio`             | The media moved, at the media's own pace, never once per frame.                  |
| `durationchange` | `duration`                | The duration became known or changed (`null` when unknown again).                |
| `resize`         | `geometry`                | The wave area changed size or a lazy frame got its pixels near the screen.       |
| `rangeend`       |                           | A range being played (`host.playRange`) ended or was abandoned.                  |
| `error`          | `error`                   | Loading peaks, drawing a plugin or a plugin's own work (a download, say) failed. |
| `destroy`        |                           | The frame was destroyed.                                                         |

## Play button

```ts
import { PlayButton } from 'sonicframe';

const button = PlayButton.create({
    container: document.getElementById('controls')!,
    media: document.getElementById('voice') as HTMLAudioElement,
    shape: 'circle',
    fill: 'solid',
    size: 32,
});
```

A real `<button>` with an SVG icon, so the keyboard and screen readers work as usual; its accessible name switches
between `labels.play` and `labels.pause` (`'Play'` and `'Pause'` by default). The play triangle is centered by its
centroid, so it looks centered.

| Option      | Default    | What it does                                                                    |
| ----------- | ---------- | ------------------------------------------------------------------------------- |
| `container` | (required) | The element the button is added to.                                             |
| `media`     | `null`     | The audio or video element it plays and pauses (without one it is disabled).    |
| `shape`     | `'circle'` | `'circle'`, `'rounded'` or `'square'`.                                          |
| `fill`      | `'solid'`  | `'solid'`, `'outline'` (a ring) or `'ghost'` (only the icon).                   |
| `size`      | `32`       | Width and height in CSS pixels.                                                 |
| `radius`    | `null`     | Corner radius in CSS pixels, instead of the shape's own.                        |
| `colors`    | see below  | `{ background, icon }`: any CSS color or `var(--name, fallback)`.               |
| `labels`    | see above  | `{ play, pause }`, the accessible names.                                        |
| `exclusive` | `true`     | Starting this media pauses every other media that has an exclusive play button. |

Colors: `background` is `var(--sonicframe-button, var(--sonicframe-progress, #2f6fdb))` (the fill, the ring, or the
icon of outline and ghost buttons) and `icon` is `var(--sonicframe-button-icon, #fff)` (the icon on a solid button).
`setLook({ shape, fill, size, radius, colors })` changes any of them later, `bind(media)` follows another media,
`on('error', listener)` hears when the browser refuses to play, and `destroy()` removes the button.

## Volume control

```ts
import { VolumeControl } from 'sonicframe';

const volume = VolumeControl.create({
    container: controls,
    media: audio,
    slider: 'hover',
});
```

A speaker button that mutes and unmutes (its icon shows one or two sound waves, or a cross when muted) and a bar to set
the level. The bar is a keyboard slider (`role="slider"`; arrows move by `step`, Page Up / Page Down by a tenth, Home
and End to the ends) that speaks the level in percent, and a press or drag sets the level under the pointer. Unmuting
brings the level back (half volume if it was at zero). The control follows the media's own `volume` and `muted`, so
other controls stay in step. Where the browser does not let a page set the volume (iOS), only the mute button shows.

| Option      | Default    | What it does                                                                       |
| ----------- | ---------- | ---------------------------------------------------------------------------------- |
| `container` | (required) | The element the control is added to.                                               |
| `media`     | `null`     | The audio or video element it controls (without one it is disabled).               |
| `slider`    | `'always'` | `'always'` shows the bar beside the speaker; `'hover'` opens it on hover or focus. |
| `size`      | `32`       | The speaker button (and the bar's height) in CSS pixels.                           |
| `width`     | `80`       | The bar's width in CSS pixels.                                                     |
| `step`      | `0.05`     | How far an arrow key moves the level (0..1).                                       |
| `colors`    | see below  | `{ icon, track, fill }`: any CSS color or `var(--name, fallback)`.                 |
| `labels`    | see above  | `{ mute, unmute, volume }`, the accessible names.                                  |

Colors: `icon` is `var(--sonicframe-button, var(--sonicframe-progress, #2f6fdb))`, `track` is
`var(--sonicframe-wave, #c4cad4)` and `fill` (the level and its handle) is `var(--sonicframe-progress, #2f6fdb)`.
`setLook({ slider, size, width, colors })` changes them later, `bind(media)` follows another media, and `destroy()`
removes the control.

## Player (`sonicframe/player`)

```ts
import { createPlayer } from 'sonicframe/player';

const player = createPlayer({
    container,
    src: '/notes/42.ogg',
    palette: 'ocean',
    volume: true,
});
```

One option picks a whole look, palette and drawing — a theme:

```ts
createPlayer({ container, src, theme: 'bubble' });
createPlayer({ container, src, theme: 'pulse', palette: 'ocean' }); // your own options win over the theme
```

Themes: `bubble` (a chat voice note), `pill`, `blocky`, `card` (a podcast card), `minimal`, `terminal`, `pulse` (a
heartbeat monitor), `scope` (an oscilloscope), `neon`, `glass`, `soft`, `brutal`, `studio`, `retro` (8-bit), `dots`,
`paper` (editorial), `bold`, `stream`, `led` (a level meter), `smooth`, `compact`, `bubbly`, `mono` and `classic`. Each
has its own palette and wears any other. Make your own from one with
`defineTheme({ extends: 'bubble', palette: 'dark', look: { corner: 0 } })`, or give it a name every player can use
with `registerTheme('brand-note', { extends: 'pill', wave: { knob: 14 } })` (built-in names cannot be replaced).
`player.setTheme(name)` switches later; the options the player was created with still win.

A ready-made player on its own entry, so an app that only draws waves never loads it. It puts a play button, the wave
and the time together, plus any of these parts: `speed` (steps through `1×`, `1.5×`, `2×`), `back` and `forward`
(skip seconds), `volume` (the `VolumeControl`, **off unless `volume: true`**), `slot` (your own element, such as an
avatar, given back on destroy) and `spacer`. Given only `src`, it makes its own media element and decodes the peaks in
the browser when it first comes near the screen (`peaks` skips that).

| Option      | Default    | What it does                                                                        |
| ----------- | ---------- | ----------------------------------------------------------------------------------- |
| `container` | (required) | The element the player is added to.                                                 |
| `src`       | none       | The sound's address; the player makes its own `<audio>`.                            |
| `media`     | none       | Your own audio or video element instead.                                            |
| `peaks`     | decoded    | Peaks or a loader, as for `SonicFrame`.                                             |
| `theme`     | none       | A theme name (built-in or registered) or one made with `defineTheme`.               |
| `look`      | see below  | How the player is put together.                                                     |
| `palette`   | `'light'`  | A palette name, `'auto'` (light or dark, following the system), or your own colors. |
| `wave`      | `'bars'`   | How the sound is drawn (as for `SonicFrame`).                                       |
| `font`      | the look's | A stack name, a `font-family` list, or a font you bring (see below).                |
| `volume`    | `false`    | Show the volume control.                                                            |
| `slot`      | none       | Your element for the `slot` part.                                                   |
| `frame`     | `{}`       | Any other `SonicFrame` option (`label`, `lazy`, `colors`…).                         |

The look: `line` and `meta` (the parts of the main line and of the small line under the wave), `wavePlace`
(`'inline'` or `'top'`), `time` (`'elapsed'`, `'remaining'`, `'duration'` or `'both'`), `button`
(`{ shape, fill, size }`), `waveHeight`, `corner`, `padding`, `gap` (rem), `border` (CSS pixels), `shadow` (`'none'`,
`'soft'`, `'hard'`, `'glow'`), `surface` (`'solid'`, `'glass'`, `'none'`), `font`, `fontSize`, `weight`, `uppercase`,
`skip` (seconds), `speeds` and `volume` (`'always'` or `'hover'`). Unknown names fall back and numbers are kept in
range.

Palettes: `light`, `dark`, `ocean`, `forest`, `sunset`, `berry`, `paper` and `contrast`, each checked for readable text
and visible controls (WCAG contrast). A palette is set as `--sonicframe-*` custom properties on the player, so plain CSS
can still override one color; shadows and the glass surface are built from colors read back as numbers.

Fonts: SonicFrame ships no font files. The stacks (`system`, `rounded`, `mono`, `serif`, `humanist`, `geometric`,
`industrial`, `slab`, `handwritten`) name fonts already on the device. To use another font, bring it:
`font: { family: 'Brand Sans', src: '/fonts/brand.woff2' }` (a file) or `stylesheet:` (a font service's CSS address).
It loads once per page, the system stack stays behind it, and an address is used only when it is http(s) or a
relative path; your Content-Security-Policy decides the rest.

`setLook`, `setPalette`, `setWave` and `setFont` change a player later; `on(event, listener)` hears the wave's events;
`player.frame`, `player.button` and `player.volume` reach the parts; `destroy()` gives the container back (a media
element the player made is stopped, yours is left alone).

## Markers

```ts
import { markers } from 'sonicframe';

const flags = markers({ times: [12.5, 40], color: 'var(--danger)', width: 2 });
frame.use(flags);
flags.set([3, 18]);
```

Times are in seconds, so they stay in place when the frame changes size; nothing is drawn while the duration is
unknown. A marker can carry a label and a color (`marks: [{ time, label, color, id }]`, still accepting plain
`times`); a click seeks to it, hovering shows a tooltip, `M` and `Shift+M` step through them, and markers that crowd
together become one pill with a count. Like a player's "previous track", `Shift+M` within `backGrace` seconds of a
marker (1 by default) goes to the one before it, and later returns to that marker; `backGrace: 0` always lands on it.
Shift picks the direction, not the letter's case, so Caps Lock changes nothing (the same goes for `R` in regions).

## Captions, regions, timelines and more (0.2.0)

Each of these is a plugin; import it and `frame.use(it)`.

- **`caption({ text, badges, tooltip, tooltipLimit })`** — a line under the bars that fades out on the right, with
  optional badges (an `auto` mark, a language tag) and a tooltip (hover, keyboard focus, or a tap) carrying the fuller
  text. `set(text)` / `setTooltip(content)` update it; the full text reaches screen readers through `aria-describedby`
  (next to any ids the page put there, which it never removes). Text goes in as text, never HTML.
- **`regions({ items, create, minLength, keys })`** — stretches to mark, play or loop. Shift-drag makes one (a plain
  drag still scrubs), the body moves it, an edge resizes it; with focus, `R`/`Shift+R` select, `Enter` plays, `L`
  loops, `[` `]` `{` `}` nudge the edges and `Delete` removes. API: `add` (returns a copy, or `null` once `max`
  regions exist), `update`, `remove`, `clear`, `list`, `play`, `stop`, `select`, with `onChange` / `onSelect`.
  Regions are fitted to the sound once its length is known.
- **`timeline({ side, size, minSpacing })`** — a ruler with labels on round seconds and minutes, in a lane above or
  below the bars.
- **`spectrogram({ source | samples, map, fftSize, columns, rows })`** — a time–frequency image, computed in the
  browser with a dependency-free FFT, in slices so it never freezes, and only once the frame is near the screen
  (like the peaks); color maps `viridis`, `magma`, `gray`.
- **`liveFrequency({ fftSize, smoothing, bars })`** — while the sound plays, the bars dance to its spectrum (Web
  Audio), in up to 512 bands. Cross-origin media without CORS is refused with an `error`, never silenced.
- **`skipSilences({ silences, lead, dim })`** — jumps past the quiet stretches during forward playback, landing
  `lead` seconds (0.1 by default) before each one ends, so the next word is not clipped.

### Analysis and clips

- `sonicframe/analysis` (also on the main entry): `levels`, `findSilences`, `silencesFromPeaks`, `peakLevel` and
  `mixdown` — pure, safe in Node or a worker.
- `frame.exportClip({ start, end, caption, width, height, fps, signal, maxSourceSeconds })` records a short video of
  the wave playing (canvas + MediaRecorder), capped in length, size, resolution and bitrate; it resolves with
  `{ blob, mimeType, duration }`. An `AbortSignal` cancels it, download included. Call it from a user gesture (a
  click): browsers keep audio suspended until one, and a clip whose audio never starts is rejected rather than left
  waiting.
- The source is decoded whole before the clip is cut — about 23 MB of memory per minute of stereo audio — so it is
  limited to `maxSourceSeconds` (10 minutes by default, `DEFAULT_MAX_SOURCE_SECONDS`). A longer one is refused before
  the download when its length is known (`sourceSeconds`; the frame passes its own media's), otherwise right after
  decoding. Raise the limit where memory allows (`Infinity` lifts it), or pass a `Blob` or `AudioBuffer` holding just
  the part to clip. Clips are made from recorded sources: an endless live stream cannot be decoded whole, and its
  download stops at the 100 MB cap.

## Writing a plugin

A plugin is an object with a `name` and any of `setup(host)`, `draw(paint)`, `resize(geometry)`, `destroy()`, and the
input hooks `pointerDown` / `pointerMove` / `pointerUp` / `pointerCancel` / `pointerHover` / `keyDown`. `layer:
'under'` draws it before the bars, `'over'` (the default) after them. `draw` gets the canvas context in device pixels
with `width`, `height`, `pixelRatio`, `progress`, `duration`, `hover`, `xAt(ratio)` and `color(value)`.

`pointerDown` returns `'take'` to own the press now, or `'drag'` to own it only once it moves past a few pixels (so a
tap still seeks); `pointerHover` returns a CSS cursor; `keyDown` runs before the slider keys and returns whether it
used the key. The host gives `container`, `duration`, `progress`, `peaks`, `media`, `geometry`, `invalidate()`,
`on()`, `color(value)`, `addLane(side, px)` (a strip above or below the bars, so the wave shrinks), `overlay()` (a
layer over the canvas for text), `seekTo`, `playRange` / `stopRange`, `setValues` (override the bar heights) and
`announce(text)` (a shared polite live region) and `reportError(error)` (a failure met outside its hooks, such as a
download, heard as the `error` event). A plugin that throws from any hook is parked and an `error` event is emitted,
so one broken plugin never breaks the frame.

## Styling and accessibility

The container becomes a slider (`role="slider"`, focusable, `aria-valuenow` from 0 to 100 and `aria-valuetext` in
words) and gets `touch-action: pan-y`, so a vertical swipe still scrolls the page. Style its focus ring with
`:focus-visible`. Keys: arrows step by `stepSeconds`, Page Up / Page Down by `largeStepRatio`, Home and End jump to
the ends; keys held with Ctrl, Alt or Meta are left to the page.

Every color SonicFrame draws can come from a custom property, so plain CSS on any ancestor themes the frame, the
button and all plugins:

| Property                   | Default                    | Used for                                |
| -------------------------- | -------------------------- | --------------------------------------- |
| `--sonicframe-wave`        | `#c4cad4`                  | Bars not yet played.                    |
| `--sonicframe-progress`    | `#2f6fdb`                  | Bars played; tooltips of the plugins.   |
| `--sonicframe-button`      | the progress color         | The play button.                        |
| `--sonicframe-button-icon` | `#fff`                     | The icon on the play button.            |
| `--sonicframe-on-progress` | `#ffffff`                  | Text over the played color and markers. |
| `--sonicframe-marker`      | `#e5484d`                  | Markers.                                |
| `--sonicframe-timeline`    | `#8a94a6`                  | The timeline ruler.                     |
| `--sonicframe-region`      | `rgba(47, 111, 219, 0.18)` | The band of a region.                   |
| `--sonicframe-dim`         | `rgba(0, 0, 0, 0.12)`      | Dimmed silences (`skipSilences`).       |
| `--sonicframe-badge`       | `rgba(0, 0, 0, 0.08)`      | The badges of a caption.                |

## Many players on one page

Each frame keeps its canvas pixels only while it is on or near the screen and loads its peaks the first time it gets
there. All frames share one ResizeObserver, one IntersectionObserver and one animation loop, and only a frame whose
media is playing on screen animates.

## Security

- No HTML is ever parsed: labels and value texts go into attributes, icons are built element by element, and
  nothing uses `innerHTML` or `eval`. Styles are set through the CSSOM, so a strict Content-Security-Policy without
  `'unsafe-inline'` keeps working.
- Colors only reach properties that accept nothing but a color (the canvas, `background-color`, `color`, `border`),
  so a color can never make the page fetch an address. CSS variables are resolved in linear time and at most eight
  levels deep.
- Peaks files are read up to 2 MB (the download stops there, announced or not) and 20,000 values, and must be a list
  of finite numbers. Captions and tooltips go in through `textContent` with control and bidi characters stripped and
  a length cap; every other input is bounded too — marks, regions, analysis windows, FFT size, live frequency bands,
  spectrogram columns and rows and audio length, the clip's length, size, resolution and bitrate, and the decode
  download (streamed and capped).
- Live frequency never silences playback: media it cannot read without muting (cross-origin without CORS) is refused
  with an `error`, and the shared audio context is never closed nor its output disconnected.
- No runtime dependencies, no install scripts; the published package holds only `dist`, the readme, the changelog
  and the license.

Report a vulnerability privately to the author (see the npm page) rather than in a public issue.

## Browser support

Current Chrome, Edge, Firefox and Safari. Rounded bars fall back to drawn arcs where `roundRect` is missing, and sizes
fall back to CSS pixels times the screen density where `device-pixel-content-box` is missing.

## License

[MIT](LICENSE) © Edie Johnny
