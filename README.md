<img src="https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/logo.svg" alt="SonicFrame logo" width="72" height="72">

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
- The wave in words: a short description of the sound's shape for people who cannot see it, read by their own screen
  reader, in English or Portuguese (opt-in).
- Works under a strict Content-Security-Policy: no inline style attributes, no `eval`, no blob workers.

![A SonicFrame player: a round play button, the waveform with the played part in blue, a time ruler and the time](https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/screenshots/player.png)

The playground shows every drawing, theme and plugin, plus a gallery of all themes in all palettes: run `npm run dev`
in a clone and open `/playground/`.

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
- `peaks` takes a list, `{ peaks, duration }`, a function returning a promise of either (called when the frame first
  comes near the screen), or `null` for a thin line until peaks arrive. A duration that comes with the peaks is used
  while neither the media nor the `duration` option gives one, so a long sound shows its length before it loads.

### Ready-made waveform files

SonicFrame reads the files of the audiowaveform tool, binary (`.dat`) or JSON, version 1 or 2, 8 or 16 bits, any
number of channels, and the simple list above. The format comes from the content, never from the address. A file
also brings the sound's duration, so the wave and the time show up before the sound is loaded, and a sound of hours
never has to be decoded in the browser.

```js
import { SonicFrame, loadWaveform } from 'sonicframe';

new SonicFrame({
    container: document.querySelector('#episode'),
    media: document.querySelector('audio'),
    peaks: () => loadWaveform('/episode.dat'),
});
```

- `loadWaveform(url, options)` fetches a file, piece by piece, and reads it. The same address with the same options is
  fetched once per page; a failed fetch is forgotten, so it can be tried again.
- `readWaveform(input, options)` reads one you already have: its bytes (an `ArrayBuffer` or any view of one), its JSON
  text, or JSON already parsed.
- Both give `{ peaks, duration, sampleRate, samplesPerPeak, channels, bits, format }`, which `peaks` takes as it is.
  `format` is `'dat'`, `'json'` (the audiowaveform JSON) or `'list'`.
- A file whose data does not match its header, or with a value out of range, is refused with a `TypeError` or a
  `RangeError`; a file with more points than `maxPeaks` is folded while it is read, keeping the loudest point of each
  slice, so its size in memory stays at `maxPeaks`.

| Option (reading) | Default   | What it does                                                                      |
| ---------------- | --------- | --------------------------------------------------------------------------------- |
| `maxPeaks`       | `20000`   | The most peaks kept; more points are folded. From 1 to 1,000,000.                 |
| `maxBytes`       | `8000000` | A larger file is refused before it is read. From 1 to 64,000,000.                 |
| `channel`        | `'all'`   | `'all'` keeps the loudest of every channel; a number (from 0) keeps that channel. |
| `normalize`      | `false`   | Makes the loudest peak 1.                                                         |
| `shared`         | `true`    | `loadWaveform` only: the same address and options are fetched once per page.      |
| `fetcher`        | `fetch`   | `loadWaveform` only: your own `fetch`.                                            |

A strange value falls back to the default; a channel the file does not have counts as `'all'`.

**Writing one.** `writeWaveform(channels, options)` writes a file from decoded samples (from -1 to 1), in the
audiowaveform format, version 2: the bytes of a `.dat` file, or the JSON as an object for `JSON.stringify`. Each point
keeps the lowest and highest sample of its slice. It runs in the browser or in Node, and is also on
`sonicframe/analysis`, so a server can write the files when sounds are uploaded.

```js
import { writeWaveform } from 'sonicframe/analysis';

const channels = [0, 1].map((index) => audioBuffer.getChannelData(index));
const bytes = writeWaveform(channels, { sampleRate: audioBuffer.sampleRate });
```

| Option (writing) | Default    | What it does                                                                   |
| ---------------- | ---------- | ------------------------------------------------------------------------------ |
| `sampleRate`     | (required) | The samples' rate, per second.                                                 |
| `samplesPerPeak` | `256`      | Samples per point.                                                             |
| `bits`           | `16`       | `16` or `8`.                                                                   |
| `format`         | `'dat'`    | `'dat'` (bytes) or `'json'` (an object).                                       |
| `channels`       | `'mix'`    | `'mix'` writes one channel, the loudest of all; `'each'` writes every channel. |

A missing sample rate, no channels or channels of different lengths throw.

## Options

| Option           | Default            | What it does                                                                        |
| ---------------- | ------------------ | ----------------------------------------------------------------------------------- |
| `container`      | (required)         | The element to draw in.                                                             |
| `media`          | `null`             | An audio or video element to follow and control.                                    |
| `peaks`          | `null`             | Peaks, or a function that loads them.                                               |
| `duration`       | `null`             | Seconds, used until the media knows its own (or without media).                     |
| `bar`            | see below          | `{ width, gap, radius, minHeight, align, curve }` in CSS pixels.                    |
| `wave`           | `'bars'`           | How the sound is drawn: a name or `{ style, lineWidth, glow, mirror, … }`.          |
| `colors`         | see below          | `{ wave, progress, hover, cursor, knob }`.                                          |
| `cursorWidth`    | `2`                | Width of the cursor line in CSS pixels.                                             |
| `interact`       | `true`             | Click, drag and keys seek; `false` makes a picture only (`role="img"`).             |
| `label`          | `'Audio position'` | The accessible name.                                                                |
| `valueText`      | `0:12 / 0:45`      | `(time, ratio, duration) => string`, the position in words.                         |
| `stepSeconds`    | `5`                | Seconds moved by an arrow key (5 % of the sound while its length is unknown).       |
| `largeStepRatio` | `0.1`              | Part of the sound moved by Page Up / Page Down.                                     |
| `rewindOnEnd`    | `false`            | Show the start again when the media ends.                                           |
| `lazy`           | `true`             | Keep pixels and load peaks only near the screen.                                    |
| `animate`        | `true`             | Let the bars grow in when peaks arrive (never with reduced motion).                 |
| `zoom`           | `false`            | Zoom and scroll: `true` or `ZoomOptions` (see [Zoom and scroll](#zoom-and-scroll)). |
| `a11y`           | `{}`               | Accessibility: `a11y.zoom.announce` and `a11y.zoom.words`.                          |
| `plugins`        | `[]`               | Plugins to start with.                                                              |

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

![The ten drawings, each part played: bars, needles, blocks, dots, steps, line, area, scope, pulse and track](https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/screenshots/drawings.png)

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
| `setPeaks(source)`     | New peaks (a list, `{ peaks, duration }`, a loader or `null`).       |
| `bind(media)`          | Follow another media element, or none (`null`).                      |
| `setDuration(seconds)` | The duration to use until the media knows its own.                   |
| `setProgress(ratio)`   | The position shown (0..1) while no media is bound.                   |
| `seekTo(ratio)`        | Move to a position (the media too) and emit `seek`.                  |
| `setView(start, end)`  | Show part of the sound (ratios 0..1); zoom on only.                  |
| `zoomTo(level, at?)`   | Zoom to a level around a ratio (or the anchor); zoom on only.        |
| `zoomBy(factor, at?)`  | Zoom in (above 1) or out (below 1); zoom on only.                    |
| `scrollTo(start)`      | Move the view to begin at a ratio, keeping its size; zoom on only.   |
| `setBar(bar)`          | Change part of the bar style.                                        |
| `setWave(wave)`        | Change the drawing (a name) or some of its details.                  |
| `setColors(colors)`    | Change some colors.                                                  |
| `setLabel(label)`      | Change the accessible name.                                          |
| `refresh()`            | Read the colors again after a theme change (dark mode is automatic). |
| `use(plugin)`          | Add a plugin; returns the function that removes it.                  |
| `on(event, listener)`  | Listen to an event; returns the function that stops listening.       |
| `destroy()`            | Remove everything SonicFrame added. Safe to call twice.              |

`progress` (0..1), `duration` (seconds or `null`), `peaksDuration` (the duration the peaks came with, or `null`) and
`view` (`{ start, end, level, maxLevel }`, the whole sound while zoom is off) are read-only properties.

## Zoom and scroll

Off by default. `zoom: true` gives the frame a view of the sound and the methods above; each way of moving the view
has its own switch, so a page turns on exactly what it wants. Without zoom nothing changes, not even the cost.

```js
new SonicFrame({
    container,
    media,
    peaks: () => loadWaveform('/episode.dat'),
    zoom: {
        wheel: true,
        scroll: true,
        pinch: true,
        keys: true,
        follow: true,
        edgeScroll: true,
    },
    a11y: { zoom: { announce: true } },
});
```

| Option          | Default          | What it does                                                                                              |
| --------------- | ---------------- | --------------------------------------------------------------------------------------------------------- |
| `view`          | the whole sound  | The view at the start, `{ start, end }` as ratios of the sound.                                           |
| `max`           | one peak per bar | The largest zoom, from 1 to 10,000 (100 without peaks). Past the peaks' detail, bars blend.               |
| `step`          | `2`              | How much one key or button zooms in or out.                                                               |
| `anchor`        | `'position'`     | Keys and buttons zoom around the playing position (when in view) or the `'center'`.                       |
| `wheel`         | `false`          | The wheel zooms around the pointer; a touchpad pinch arrives as a wheel with Ctrl.                        |
| `wheelModifier` | `'ctrl'`         | The key held for the wheel to zoom: `'ctrl'` (Ctrl or ⌘), `'alt'` or `'none'`.                            |
| `wheelSpeed`    | `1`              | How fast the wheel zooms, from 0.1 to 10.                                                                 |
| `scroll`        | `false`          | The horizontal wheel, a touchpad swipe and Shift + wheel scroll the view.                                 |
| `pinch`         | `false`          | Two fingers zoom in and out and drag the view sideways.                                                   |
| `keys`          | `false`          | `true` gives `+` (and `=`), `-` and `0` (the whole sound); `{ in, out, reset }` sets your own or `false`. |
| `follow`        | `false`          | While playing, the view follows the position.                                                             |
| `followType`    | `'page'`         | `'page'` turns a whole view; `'center'` keeps the position in the middle (pages with reduced motion).     |
| `followHold`    | `true`           | A scroll or zoom by the person holds the following until the next seek or play.                           |
| `edgeScroll`    | `false`          | Dragging near an edge (a seek, a region) scrolls the view, so a selection can grow past the screen.       |
| `edgeSize`      | `32`             | The edge zone, in CSS pixels.                                                                             |
| `edgeSpeed`     | `1`              | Views scrolled per second right at the edge.                                                              |
| `revealKeys`    | `true`           | A keyboard seek (arrows, Home, End, M on a marker) outside the view brings the view to it.                |

The keys never take Ctrl, ⌘ or Alt, which belong to the browser's own page zoom. The bars on screen come from a pyramid
of the peaks built the first time the frame is zoomed in, so the cost follows the screen, not the file, and each bar
stays on the same piece of sound while the view scrolls. Give a long sound many peaks (a `.dat` file, or the player's
`decode.peaksPerSecond`) for detail when zoomed in. The cursor and the knob show only while the position is in view.

The `viewchange` event says the new view and what moved it: `'api'`, `'wheel'`, `'keys'`, `'pinch'`, `'follow'`,
`'edge'`, `'minimap'` or `'button'`. `a11y.zoom.announce` (off by default) says the new view through the live region
after a zoom by the keys, a button or two fingers ("Zoom 4×, 1:20 to 2:40"), in your own `a11y.zoom.words` if given.

The plugins follow the view: regions (with `scrollIntoView`, a region chosen by R comes into view), markers, the
timeline (down to tenths of a second), the silences' shade and the spectrogram (with `detail`, a sharp picture of the
part in view once the view rests; `detailDelay` 200 ms, `detailColumns` the width).

### The minimap

`minimap(options)` adds a strip with the whole sound, the played part and a box over the part in view.

```js
new SonicFrame({
    container,
    media,
    peaks,
    zoom: true,
    plugins: [minimap({ a11y: { keys: true } })],
});
```

| Option           | Default          | What it does                                                                                          |
| ---------------- | ---------------- | ----------------------------------------------------------------------------------------------------- |
| `side`           | `'below'`        | `'above'` or `'below'` the wave.                                                                      |
| `height`         | `24`             | The strip's height, in CSS pixels.                                                                    |
| `gap`            | `4`              | Space between the strip and the wave (or the lane next to it), in CSS pixels.                         |
| `cursors`        | hands            | `{ box, moving, beside }`: `'grab'`, `'grabbing'`, `'pointer'`; the arrow where a press does nothing. |
| `wave`, `bar`    | thin bars        | How the sound is drawn in the strip.                                                                  |
| `colors`         | the theme's      | `{ wave, progress, view, edge }`; `--sonicframe-minimap-view` and `--sonicframe-minimap-edge`.        |
| `progress`       | `true`           | Paints the played part.                                                                               |
| `controls.drag`  | `true`           | Dragging the box scrolls the view.                                                                    |
| `controls.click` | `true`           | A click beside the box brings the view there.                                                         |
| `controls.wheel` | `false`          | The wheel over the strip zooms around the pointer.                                                    |
| `autoHide`       | `false`          | Takes no room while the whole sound is in view.                                                       |
| `a11y.keys`      | `false`          | Makes the strip a keyboard slider of the part in view; off, it is hidden from screen readers.         |
| `a11y.label`     | `'Visible part'` | Its accessible name.                                                                                  |
| `a11y.words`     | English          | `{ value(from, to, total) }`, its value in words ("0:25 to 0:50 of 1:40").                            |

As a slider, the arrows move a quarter of the view, Page Up and Page Down a whole view, Home and End go to the ends. A
press on the strip never seeks.

## Events

| Event            | Arguments                 | When                                                                             |
| ---------------- | ------------------------- | -------------------------------------------------------------------------------- |
| `seek`           | `{ ratio, time, source }` | Click, drag, keyboard or `seekTo` (`source` says which).                         |
| `hover`          | `ratio, time`             | The mouse moved over the frame (`null` when it left).                            |
| `timeupdate`     | `time, ratio`             | The media moved, at the media's own pace, never once per frame.                  |
| `durationchange` | `duration`                | The duration became known or changed (`null` when unknown again).                |
| `peakschange`    | `peaks`                   | The peaks arrived, were replaced or went (`null`); never for live values.        |
| `resize`         | `geometry`                | The wave area changed size or a lazy frame got its pixels near the screen.       |
| `rangeend`       |                           | A range being played (`host.playRange`) ended or was abandoned.                  |
| `viewchange`     | `view, source`            | The view moved (zoom on only), and what moved it.                                |
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

![Six themes, one per row: card, a podcast card; bubble, a chat voice note; pulse, a heartbeat monitor; glass; retro, in 8-bit steps; and brutal](https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/screenshots/themes.png)

Themes: `default` (SonicFrame as it always looked; no theme, or a name that does not exist, gives this one),
`bubble` (a chat voice note), `pill`, `blocky`, `card` (a podcast card), `minimal`, `terminal`, `pulse` (a
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

| Option        | Default     | What it does                                                                                                                                                                              |
| ------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `container`   | (required)  | The element the player is added to.                                                                                                                                                       |
| `src`         | none        | The sound's address; the player makes its own `<audio>`.                                                                                                                                  |
| `media`       | none        | Your own audio or video element instead.                                                                                                                                                  |
| `peaks`       | decoded     | Peaks or a loader, as for `SonicFrame`.                                                                                                                                                   |
| `theme`       | none        | A theme name (built-in or registered) or one made with `defineTheme`.                                                                                                                     |
| `look`        | see below   | How the player is put together.                                                                                                                                                           |
| `palette`     | the theme's | A palette name, `'auto'`, `'default'`, or your own colors (see below).                                                                                                                    |
| `wave`        | `'bars'`    | How the sound is drawn (as for `SonicFrame`).                                                                                                                                             |
| `font`        | the look's  | A stack name, a `font-family` list, or a font you bring (see below).                                                                                                                      |
| `volume`      | `false`     | Show the volume control.                                                                                                                                                                  |
| `spectrogram` | `false`     | A spectrogram under the wave, in the palette's colors (the sound is decoded once).                                                                                                        |
| `zoom`        | `false`     | The wave's zoom options (see [Zoom and scroll](#zoom-and-scroll)), plus `buttons`.                                                                                                        |
| `minimap`     | `false`     | `true` or the `minimap` options: a strip under the wave, `minimapHeight` tall and `minimapGap` away; the player grows to fit it (with `autoHide`, it takes from the wave while it shows). |
| `decode`      | see below   | How a sound is decoded for its peaks.                                                                                                                                                     |
| `slot`        | none        | Your element for the `slot` part.                                                                                                                                                         |
| `a11y`        | `{}`        | Accessibility: `{ lang, labels, description, zoom, minimap }` (see below).                                                                                                                |
| `frame`       | `{}`        | Any other `SonicFrame` option (`label`, `lazy`, `colors`…).                                                                                                                               |

Accessibility options live in one group, `a11y`, arranged by place, and whatever adds behaviour is off until you turn
it on:

```ts
createPlayer({
    container,
    src,
    a11y: {
        lang: 'pt', // 'en' (the default), 'pt', 'pt-BR'…, or 'auto' (the page's language)
        labels: { play: 'Tocar' }, // your own accessible names, over the language's
        description: {
            // the wave in words (see "The wave in words"); off unless given
            keys: true,
            pauseInValue: true,
            // a button that reads it aloud; while reading it moves, as animationType says
            button: { animation: true, animationType: 'pulse' },
        },
    },
});
```

- `a11y.lang`: the language of the accessible names, the wave's value in words and the description; given, it also
  marks the player with its `lang` attribute, so a screen reader says the words in that voice.
- `a11y.labels`: `player`, `position`, `value` (`'{time} / {duration}'`), `play`, `pause`, `back` and `forward`
  (`'{seconds}'`), `speed` (`'{speed}'`), `mute`, `unmute`, `volume`, `listen`, `stopListening` and `speechFailed`
  (said through the live region when the browser cannot read the description aloud). English unless `lang` says
  otherwise (Portuguese is built in); a label you give is cleaned and capped, and its marks are filled with
  SonicFrame's own values only.
- `a11y.description`: `true`, or the `soundDescription` options plus `button`. While the button reads, its name says
  "Stop the description" and it wears the play button's colors, so people who see it know it can be pressed to stop.
  `button: { animation: true }` also moves it, as `animationType` says: `'pulse'` (the default, a type it does not
  know included: it grows a little and back) or `'fade'` (half transparent and back). Animation is off by default, and
  never shown to people who asked their system for less motion.
- `a11y.zoom.announce`: says the new view after a zoom by the keys, the buttons or two fingers ("Zoom 2×, from 0:30 to
  1:30" in Portuguese words when `lang` is Portuguese). Off by default.
- `a11y.minimap.keys`: makes the minimap a keyboard slider named in the player's language ("Visible part", "Parte
  visível"). Off by default: the minimap is hidden from screen readers.

**Zoom on the player.** `zoom: { buttons: true }` adds three buttons, zoom out, the whole sound and zoom in, as the look
parts `zoomOut`, `zoomReset` and `zoomIn`: where the look places them, or at the end of the line when it places none.
At a limit a button is marked `aria-disabled` and does nothing, but keeps its place in the tab order, so focus is never
lost under it. Zoom works with or without the buttons, by the ways switched on (wheel, two fingers, keys…); with zoom
off, none of it is there. The labels `zoomIn`, `zoomOut`, `zoomReset`, `zoomView`, `minimap` and `minimapValue` come in
English and Portuguese.

**Decoding.** `decode.peaks` (1000, from 100 to 100,000) is how many peaks a decoded sound gets; with zoom on,
`decode.peaksPerSecond` (100) gives a long sound more, never fewer than `peaks` nor more than 1,000,000.
`decode.maxSeconds` and `decode.maxBytes` can only lower the decoder's ceilings (30 minutes, a longer sound read evenly
through, and 50 MB).

The look: `line` and `meta` (the parts of the main line and of the small line under the wave), `wavePlace`
(`'inline'` or `'top'`), `time` (`'elapsed'`, `'remaining'`, `'duration'` or `'both'`), `button`
(`{ shape, fill, size }`), `waveHeight`, `minimapHeight`, `minimapGap`, `waveMin`, `narrow`, `corner`, `padding`, `gap`
(rem), `border` (CSS pixels), `shadow` (`'none'`, `'soft'`, `'hard'`, `'glow'`), `surface` (`'solid'`, `'glass'`,
`'none'`), `font`, `fontSize`, `weight`, `uppercase`, `skip` (seconds), `speeds` and `volume` (`'always'` or
`'hover'`). Unknown names fall back and numbers are kept in range.

A narrow player turns into a voice note. Under `narrow` (22 rem; `0` turns it off), a player with the wave in its
line keeps only the play button and the wave there; the time goes under the wave on the left and the other controls
on the right, wrapping under the time when they do not fit. The pieces are moved, not built again, so the wave keeps
its state, and the player gets a `data-narrow` attribute for your CSS (the row is `.sonicframe-under`). With zoom
buttons on a wider line, the wave keeps at least `waveMin` (8 rem) and the buttons wrap under it.

Palettes: `light`, `dark`, `ocean`, `forest`, `sunset`, `berry`, `paper` and `contrast`, each checked for readable text
and visible controls (WCAG contrast). A palette is set as `--sonicframe-*` custom properties on the player, so plain CSS
can still override one color; shadows and the glass surface are built from colors read back as numbers. `'auto'` is
`light` or `dark`, following the system; `'default'` (the default theme's) sets no variable at all, so SonicFrame's
own colors and any `--sonicframe-*` your page sets show, as without a player. An unknown name falls back to it.

![The bubble and pill themes, each in all eight palettes](https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/screenshots/gallery.png)

Fonts: SonicFrame ships no font files. The stacks (`system`, `rounded`, `mono`, `serif`, `humanist`, `geometric`,
`industrial`, `slab`, `handwritten`) name fonts already on the device. To use another font, bring it:
`font: { family: 'Brand Sans', src: '/fonts/brand.woff2' }` (a file) or `stylesheet:` (a font service's CSS address).
It loads once per page, the system stack stays behind it, and an address is used only when it is http(s) or a
relative path; your Content-Security-Policy decides the rest.

`setTheme`, `setLook`, `setPalette`, `setWave`, `setFont` and `setVolume` change a player later (your own choices keep
winning over the theme; `setPalette()`, `setWave()` or `setFont()` with nothing brings the theme's back);
`on(event, listener)` hears the wave's events (and `description`, with the new text); `player.frame`,
`player.button` and `player.volume` reach the parts and `player.description` gives the sound in words; `destroy()`
gives the container back (a media element the player made is stopped, yours is left alone).

### As an HTML tag

```html
<sonic-player
    src="/notes/42.ogg"
    theme="bubble"
    palette="ocean"
    volume
></sonic-player>

<script type="module">
    import { defineSonicPlayer } from 'sonicframe/player';
    defineSonicPlayer(); // once; nothing is registered just by importing
</script>
```

Attributes: `src`, `peaks` (the address of a waveform file: `.dat`, the audiowaveform JSON or a peaks list), `theme`, `palette`, `wave`, `font`, `font-src`,
`font-stylesheet`, `label`, and the switches `volume` and `spectrogram`. Accessibility attributes start with `a11y-`:
`a11y-lang` (the language of the player's words, `a11y-lang="pt-BR"`) and `a11y-description`, which turns the wave in
words on; words in it turn on its extras: `a11y-description="keys pauses"` (also `speech`, `announce`, `button`, and
`animation` for the button, of the type `pulse`, the default, or `fade`: `a11y-description="button animation fade"`).
Zoom is off unless `zoom` is there; its words turn on its ways and buttons:
`zoom="wheel scroll pinch keys follow center edges buttons"`, with `zoom-max="8"`. `minimap` adds the strip (its words:
`above`, `autohide`, `wheel`), `a11y-zoom="announce"` says a zoom and `a11y-minimap="keys"` makes the strip a slider.
`peaks-channel` (`all` or a number), `peaks-max` and `peaks-normalize` say how the peaks file is read.
They are read as untrusted input: an unknown name falls back to the default theme, text
goes in only as text, and a font address is used only when it is safe.
Changing an attribute updates the player; removing the element destroys it, and putting it back builds it again. The
player's events reach the element as `sonicframe:seek`, `sonicframe:timeupdate`, `sonicframe:error`… with their
arguments in `event.detail`. `defineSonicPlayer('my-player')` registers it under another name.

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

![Plugins on the wave: two markers, a region named Verse, a timeline, a caption with badges, a spectrogram under a line, and live frequency bars](https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/screenshots/plugins.png)

- **`caption({ text, badges, tooltip, tooltipLimit })`** — a line under the bars that fades out on the right, with
  optional badges (an `auto` mark, a language tag) and a tooltip (hover, keyboard focus, or a tap) carrying the fuller
  text. `set(text)` / `setTooltip(content)` update it; the full text reaches screen readers through `aria-describedby`
  (next to any ids the page put there, which it never removes). Text goes in as text, never HTML.
- **`regions({ items, create, minLength, keys })`** — stretches to mark, play or loop. Shift-drag makes one (a plain
  drag still scrubs), the body moves it, an edge resizes it; with focus, `R`/`Shift+R` select, `Enter` plays, `L`
  loops, `[` `]` `{` `}` nudge the edges and `Delete` removes. API: `add` (returns a copy, or `null` once `max`
  regions exist), `update`, `remove`, `clear`, `list`, `play`, `stop`, `select`, with `onChange` / `onSelect`.
  Regions are fitted to the sound once its length is known. Zoomed in, `scrollIntoView: true` brings a region chosen
  by `R` into view. `snap: true` draws the bands' edges on whole device pixels: a little crisper, each edge moved by
  less than half a pixel; off by default, the edges sit at fractions of a pixel, as they always did. `cursors`
  (`{ body, moving, edge }`, any CSS cursor) sets the mouse cursor: an open hand over a region (`'grab'`), a closed
  one while moving it (`'grabbing'`), and `'ew-resize'` over its edges and while resizing or drawing one.
- **`timeline({ side, size, minSpacing })`** — a ruler with labels on round seconds and minutes, in a lane above or
  below the bars; zoomed in, it marks the part in view, down to tenths of a second.
- **`spectrogram({ source | samples, map, fftSize, columns, rows })`** — a time–frequency image, computed in the
  browser with a dependency-free FFT, in slices so it never freezes, and only once the frame is near the screen
  (like the peaks). Color maps: `viridis`, `magma` (the default), `gray`, `ice`, `fire`, `ocean`, or your own colors
  from quiet to loud, `{ from, via, to }` (any CSS color or `var(--name, fallback)`, so a theme's palette works); when
  those colors change after `refresh()`, the image is repainted without computing again. `source` also takes a function
  that gives decoded audio, so the app can share one decode.
- **`liveFrequency({ fftSize, smoothing, bars })`** — while the sound plays, the bars dance to its spectrum (Web
  Audio), in up to 512 bands. Cross-origin media without CORS is refused with an `error`, never silenced.
- **`skipSilences({ silences, lead, dim })`** — jumps past the quiet stretches during forward playback, landing
  `lead` seconds (0.1 by default) before each one ends, so the next word is not clipped. `dim` shades them; `snap:
  true` puts the shade's edges on whole device pixels, as for regions.

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

## The wave in words

People who cannot see the wave get its shape in words: how long the sound is, where the sound and the pauses are, and
where it is loudest. Their own screen reader reads it (the text goes in the wave's `aria-describedby`, next to any ids
your page put there), so it comes in their voice, at their speed. It is off until you turn it on.

```ts
import { soundDescription } from 'sonicframe';

frame.use(soundDescription({ lang: 'pt' }));
// "33 segundos. Som até 20 segundos, uma pausa de 4 segundos, depois som até o fim.
//  Mais alto por volta de 12 segundos."
```

In English: "33 seconds. Sound until 20 seconds, a pause of 4 seconds, then sound to the end. Loudest at 12 seconds."
It is written from the peaks once the duration is known; a sound with many pauses is summed up by its longest one,
and the silence at the start and at the end is told apart. It says "sound", never "speech" or "music": peaks cannot tell
them apart, and they are relative, so it describes the shape, never how loud the recording is.

| Option              | Default        | What it does                                                                                      |
| ------------------- | -------------- | ------------------------------------------------------------------------------------------------- |
| `lang`              | `'en'`         | `'pt'`, `'pt-BR'`…, `'auto'` (the page's language), or any tag with your own `words`.             |
| `words`             | built in       | Your own phrases, templates with `{duration}`, `{at}`, `{count}`…; numbers come from `Intl`.      |
| `times`             | `'words'`      | `'clock'` says positions as `0:12`.                                                               |
| `text`              | from the peaks | Your own description (written ahead, say), used instead.                                          |
| `minPause`          | automatic      | The shortest pause in seconds: 3 % of the sound, from 0.75 to 5.                                  |
| `threshold`         | `0.06`         | Below this share of the loudest peak counts as quiet.                                             |
| `describedBy`       | `true`         | Put the text in the wave's `aria-describedby`.                                                    |
| `target`            | none           | An element of yours that shows the text (given back as it was on destroy).                        |
| `announceWhenReady` | `false`        | Say it once if it arrives while the wave has focus (a lazy frame loads peaks near the screen).    |
| `keys`              | `false`        | `true`: `D` says it again, `P` / `Shift+P` go to the next / previous part.                        |
| `pauseInValue`      | `false`        | Add "pause" (between parts) or "silence" (at the ends) to the wave's value: "0:22 / 0:33, pause". |
| `speech`            | `false`        | Let `speak()` read it with the browser's own voice; `{ voices, rate }`.                           |
| `onChange`          | none           | Called with the new text (or `null`).                                                             |

With `keys`, a step between the parts lands at the start of the next sound and says where: "Part 2 of 3, 24
seconds." `{ again: 'i', parts: false }` picks other letters or turns one off, and `backGrace` (1 by default) is how
many seconds into a part `Shift+P` goes back to its own start rather than the one before; the direction comes from
Shift, never from the letter's case. The plugin also gives `text`, `outline`, `locale`, `set(text)` (`null` goes back to the
peaks), `refresh()`, `say()` (through the live region), `speak()`, `stopSpeaking()` and `speaking`.

**Who narrates.** The screen reader: nothing is ever spoken on its own. For people without one, `speech` lets
`speak()`, called from a click, use the browser's own `speechSynthesis`, with nothing to download and no dependency.
It picks a voice of the text's language on the device: the online voices of some browsers send the text to a server,
so they are used only with `speech: { voices: 'any' }`. The text is read a sentence at a time (some browsers stop a
long utterance midway); `stopSpeaking()`, Escape on the wave, a new `speak()` or `destroy()` stop it, and `speak()`
rejects where no voice fits.

**Ahead of time.** `outlineSound(peaks, duration)` and `describeSound(outline, { lang })` are pure and also on
`sonicframe/analysis`, so a server can write the description when a file is uploaded and pass it as `text`, ready at
the first focus.

On the player it is `a11y.description` (see the player's accessibility options), in the player's `a11y.lang`;
`a11y: { description: { button: true, keys: true } }` adds a button that reads it aloud (where the browser has a
voice) and the keys.

## Writing a plugin

A plugin is an object with a `name` and any of `setup(host)`, `draw(paint)`, `resize(geometry)`, `destroy()`, and the
input hooks `pointerDown` / `pointerMove` / `pointerUp` / `pointerCancel` / `pointerHover` / `keyDown`. `layer:
'under'` draws it before the bars, `'over'` (the default) after them. `valueNote(time, ratio)` returns a short note
added to the wave's value in words (`"pause"` makes `"0:22 / 0:33, pause"`); `host.updateValueText()` asks for it again. `draw` gets the canvas context in device pixels
with `width`, `height`, `pixelRatio`, `progress`, `duration`, `hover`, `view`, `xAt(ratio)`, `ratioAt(x)` and
`color(value)`.

**Zoom-ready plugins.** Place things with `paint.xAt(ratio)`, which goes through the view (a position out of view lands
off the canvas), and read presses from `point.ratio` / `point.time`, which are already the sound's. `host.view` is the
part in view and `host.on('viewchange', …)` tells when it moves; `host.setView(start, end, source)` moves it. A seek a
key asked for passes `host.seekTo(ratio, 'keyboard')`, so the view follows it like the frame's own keys.

`pointerDown` returns `'take'` to own the press now, or `'drag'` to own it only once it moves past a few pixels (so a
tap still seeks); `pointerHover` returns a CSS cursor; `keyDown` runs before the slider keys and returns whether it
used the key. The host gives `container`, `duration`, `progress`, `peaks`, `media`, `geometry`, `view`, `setView`, `invalidate()`,
`on()`, `color(value)`, `addLane(side, px)` (a strip above or below the bars, so the wave shrinks), `overlay()` (a
layer over the canvas for text), `seekTo`, `playRange` / `stopRange`, `setValues` (override the bar heights) and
`announce(text)` (a shared polite live region) and `reportError(error)` (a failure met outside its hooks, such as a
download, heard as the `error` event). A plugin that throws from any hook is parked and an `error` event is emitted,
so one broken plugin never breaks the frame.

## Styling and accessibility

The container becomes a slider (`role="slider"`, focusable, `aria-valuenow` from 0 to 100 and `aria-valuetext` in
words) and gets `touch-action: pan-y`, so a vertical swipe still scrolls the page. Style its focus ring with
`:focus-visible`. Keys: arrows step by `stepSeconds`, Page Up / Page Down by `largeStepRatio`, Home and End jump to
the ends; keys held with Ctrl, Alt or Meta are left to the page. For people who cannot see the wave, the
`soundDescription` plugin describes it in words (see "The wave in words").

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
