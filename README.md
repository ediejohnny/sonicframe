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
- Plugins drawn under or over the bars; `markers` ships with it.
- Works under a strict Content-Security-Policy: no inline style attributes, no `eval`.

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
| `colors`         | see below          | `{ wave, progress, hover, cursor }`.                                          |
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

Bars: `width` 2, `gap` 1, `radius` 1, `minHeight` 2, `align` `'center'` (or `'bottom'` for a bar meter), `curve` 1
(below 1 lifts quiet sounds, above 1 leaves only the loud parts standing out).

Colors take any CSS color or `var(--name, fallback)`:

- `wave`: bars not yet played, `var(--sonicframe-wave, #c4cad4)`.
- `progress`: bars already played, `var(--sonicframe-progress, #2f6fdb)`.
- `hover`: the band between the played part and the mouse pointer; `'auto'` (the default) mixes the two colors
  above, `null` shows no hover.
- `cursor`: a line at the playing position; `null` (the default) draws none.

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
| `setColors(colors)`    | Change some colors.                                                  |
| `setLabel(label)`      | Change the accessible name.                                          |
| `refresh()`            | Read the colors again after a theme change (dark mode is automatic). |
| `use(plugin)`          | Add a plugin; returns the function that removes it.                  |
| `on(event, listener)`  | Listen to an event; returns the function that stops listening.       |
| `destroy()`            | Remove everything SonicFrame added. Safe to call twice.              |

`progress` (0..1) and `duration` (seconds or `null`) are read-only properties.

## Events

| Event        | Arguments                 | When                                                            |
| ------------ | ------------------------- | --------------------------------------------------------------- |
| `seek`       | `{ ratio, time, source }` | Click, drag, keyboard or `seekTo` (`source` says which).        |
| `hover`      | `ratio, time`             | The mouse moved over the frame (`null` when it left).           |
| `timeupdate` | `time, ratio`             | The media moved, at the media's own pace, never once per frame. |
| `error`      | `error`                   | Loading peaks or drawing a plugin failed.                       |
| `destroy`    |                           | The frame was destroyed.                                        |

## Markers

```ts
import { markers } from 'sonicframe';

const flags = markers({ times: [12.5, 40], color: 'var(--danger)', width: 2 });
frame.use(flags);
flags.set([3, 18]);
```

Times are in seconds, so they stay in place when the frame changes size; nothing is drawn while the duration is
unknown.

## Writing a plugin

A plugin is an object with a `name` and any of `setup(host)`, `draw(paint)` and `destroy()`. `layer: 'under'` draws it
before the bars, `'over'` (the default) after them. `draw` gets the canvas context in device pixels with `width`,
`height`, `pixelRatio`, `progress`, `duration`, `hover`, `xAt(ratio)` and `color(value)`; the host gives `duration`,
`progress`, `invalidate()` (ask for a new picture) and `on()`.

## Styling and accessibility

The container becomes a slider (`role="slider"`, focusable, `aria-valuenow` from 0 to 100 and `aria-valuetext` in
words) and gets `touch-action: pan-y`, so a vertical swipe still scrolls the page. Style its focus ring with
`:focus-visible`. Keys: arrows step by `stepSeconds`, Page Up / Page Down by `largeStepRatio`, Home and End jump to
the ends; keys held with Ctrl, Alt or Meta are left to the page.

## Many players on one page

Each frame keeps its canvas pixels only while it is on or near the screen and loads its peaks the first time it gets
there. All frames share one ResizeObserver, one IntersectionObserver and one animation loop, and only a frame whose
media is playing on screen animates.

## Browser support

Current Chrome, Edge, Firefox and Safari. Rounded bars fall back to drawn arcs where `roundRect` is missing, and sizes
fall back to CSS pixels times the screen density where `device-pixel-content-box` is missing.

## License

[MIT](LICENSE) © Edie Johnny
