<div align="center">

<img src="https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/logo.svg" alt="SonicFrame logo" width="88" height="88">

# SonicFrame.js

Draw sound on the web: waveforms, ready-made players, spectrograms and more, with no dependencies.

[![npm version](https://img.shields.io/npm/v/sonicframe?color=1f4fbf&label=npm)](https://www.npmjs.com/package/sonicframe)
[![MIT license](https://img.shields.io/badge/license-MIT-1f4fbf)](LICENSE)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-1f4fbf)](package.json)
[![Unpacked size](https://img.shields.io/npm/unpacked-size/sonicframe?color=1f4fbf)](https://www.npmjs.com/package/sonicframe)

**[Docs](https://ediejohnny.github.io/sonicframe/)** ·
[Quickstart](https://ediejohnny.github.io/sonicframe/quickstart.html) ·
[Examples](https://ediejohnny.github.io/sonicframe/guide-podcast.html) ·
[Changelog](CHANGELOG.md)

<img src="https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/screenshots/player.png" alt="A SonicFrame player: a round play button, the waveform with the played part in blue, a time ruler and the time" width="720">

</div>

## <img src="https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/icons/why.svg" alt="" width="24" height="24"> Why SonicFrame

<table>
<tr>
<td width="50%" valign="top">
<img src="https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/icons/deps.svg" alt="" width="20" height="20">
<strong>Nothing else to install</strong><br>
One MIT package with no dependencies. Plain pages or any framework: it only asks for an element to draw in.
</td>
<td width="50%" valign="top">
<img src="https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/icons/accessibility.svg" alt="" width="20" height="20">
<strong>Accessible from the start</strong><br>
Every wave is a keyboard slider that says where it is, and every control is a real button.
</td>
</tr>
<tr>
<td valign="top">
<img src="https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/icons/light.svg" alt="" width="20" height="20">
<strong>Light with hundreds of players</strong><br>
Shared observers and one animation loop; only a wave near the screen keeps pixels, and only a playing one moves.
</td>
<td valign="top">
<img src="https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/icons/csp.svg" alt="" width="20" height="20">
<strong>Strict CSP friendly</strong><br>
No inline styles, no <code>eval</code>, no blob workers, no HTML parsed. Colors come from your CSS.
</td>
</tr>
<tr>
<td valign="top">
<img src="https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/icons/zoom.svg" alt="" width="20" height="20">
<strong>Long sounds</strong><br>
Zoom, scroll and a minimap, with ready-made peaks files, so an hour of audio opens at once.
</td>
<td valign="top">
<img src="https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/icons/themes.svg" alt="" width="20" height="20">
<strong>A whole player in one line</strong><br>
24 themes, 8 palettes and 10 drawings, from JavaScript or as an HTML tag.
</td>
</tr>
</table>

## <img src="https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/icons/install.svg" alt="" width="24" height="24"> Install

```sh
npm install sonicframe
```

## <img src="https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/icons/quickstart.svg" alt="" width="24" height="24"> Quick start

In JavaScript:

```js
import { createPlayer } from 'sonicframe/player';

createPlayer({
    container: document.querySelector('#voice'),
    src: '/voice.mp3',
    theme: 'bubble',
});
```

As an HTML tag:

```html
<sonic-player src="/voice.mp3" theme="bubble"></sonic-player>

<script type="module">
    import { defineSonicPlayer } from 'sonicframe/player';
    defineSonicPlayer();
</script>
```

Only the wave, on your own `<audio>`:

```js
import { SonicFrame, loadWaveform } from 'sonicframe';

SonicFrame.create({
    container: document.querySelector('#wave'),
    media: document.querySelector('audio'),
    peaks: () => loadWaveform('/voice.dat'),
    label: 'Playback position',
});
```

The [Quickstart](https://ediejohnny.github.io/sonicframe/quickstart.html) goes through it step by step, and
[Peaks](https://ediejohnny.github.io/sonicframe/peaks.html) shows how to serve the waveform so the page never decodes
the audio.

## <img src="https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/icons/accessibility.svg" alt="" width="24" height="24"> Accessibility

Sound is for everyone, so accessibility is where SonicFrame starts, not an add-on.

- **The wave is a slider.** It takes the focus, has `role="slider"`, and says where it is as a time ("1:05 / 3:20").
  The keys are the WAI-ARIA ones: the arrows step, Page Up and Page Down jump further, Home and End go to the ends.
- **Every control is a real button** with a name, and the player's words come in English and Portuguese, or yours.
- **One place for it all, the `a11y` group,** by place and action. On the tag, the attributes start with `a11y-`.

    ```js
    createPlayer({
        container,
        src: '/episode.mp3',
        a11y: {
            lang: 'pt',
            description: { keys: true, button: true },
        },
    });
    ```

    ```html
    <sonic-player
        src="/episode.mp3"
        a11y-lang="pt"
        a11y-description="keys button"
    ></sonic-player>
    ```

- **Announcements** go through one shared, polite live region: with `a11y.zoom.announce`, for example, the new view
  after a zoom by the keys.
- **The wave in words.** For people who cannot see the wave, its shape is written out and read by their own screen
  reader: "33 seconds. Sound until 20 seconds, a pause of 4 seconds, then sound to the end. Loudest at 12 seconds."
  With `keys`, D says it again and P moves between the parts; with `button`, a button reads it in the browser's own
  voice. Off until you turn it on.
- **Captions:** a line of text under the wave (a transcript's first words, a title) whose full text reaches screen
  readers through the wave's description.
- **Motion is opt-in.** Animations are off by default and never run when the person asks for reduced motion.

**How we check it.** Roles, names, values, keys and announcements are covered by the tests and checked by hand in
the browser. The real proof comes from people who use a screen reader every day: if that is you, please
[open an issue](https://github.com/ediejohnny/sonicframe/issues) and tell us what works and what does not.

More in the docs: [Accessibility](https://ediejohnny.github.io/sonicframe/accessibility.html),
[Keyboard](https://ediejohnny.github.io/sonicframe/keyboard.html) and
[The wave in words](https://ediejohnny.github.io/sonicframe/words.html).

## <img src="https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/icons/inside.svg" alt="" width="24" height="24"> What's inside

| Part                             | What it does                                                                                 | Docs                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| The frame (`sonicframe`)         | The waveform: draws it, follows an `<audio>` or `<video>`, seeks by click, drag and keys.    | [The frame](https://ediejohnny.github.io/sonicframe/frame.html)      |
| The player (`sonicframe/player`) | A whole player: play, time, speed, skip, volume, zoom buttons, and the `<sonic-player>` tag. | [Player basics](https://ediejohnny.github.io/sonicframe/player.html) |
| Themes and palettes              | A whole look in one word; make your own from any of them.                                    | [Themes](https://ediejohnny.github.io/sonicframe/theming.html)       |
| Plugins                          | Markers, regions, a timeline, captions, a spectrogram, skipped silences and live frequency.  | [Plugins](https://ediejohnny.github.io/sonicframe/plugins.html)      |
| Long sounds                      | Zoom, scroll, a minimap, and audiowaveform `.dat` and JSON files, read and written.          | [Zoom and scroll](https://ediejohnny.github.io/sonicframe/zoom.html) |
| Analysis (`sonicframe/analysis`) | Levels, silences, the wave in words and waveform files, pure, in the browser or in Node.     | [Analysis](https://ediejohnny.github.io/sonicframe/analysis.html)    |

Every option, method, event and attribute is in the
[Reference](https://ediejohnny.github.io/sonicframe/frame-options.html).

## <img src="https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/icons/gallery.svg" alt="" width="24" height="24"> Gallery

![The ten drawings, each part played: bars, needles, blocks, dots, steps, line, area, scope, pulse and track](https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/screenshots/drawings.png)

![Six themes, one per row: card, a podcast card; bubble, a chat voice note; pulse, a heartbeat monitor; glass; retro, in 8-bit steps; and brutal](https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/screenshots/themes.png)

![Plugins on the wave: two markers, a region named Verse, a timeline, a caption with badges, a spectrogram under a line, and live frequency bars](https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/screenshots/plugins.png)

![The bubble and pill themes, each in all eight palettes](https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/screenshots/gallery.png)

<img src="https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/screenshots/narrow.png" alt="On a phone the player turns into a voice note: the play button beside the wave, the time under the wave on the left, and the speed and zoom buttons on its right" width="360">

## <img src="https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/icons/browsers.svg" alt="" width="24" height="24"> Browser support

Current Chrome, Edge, Firefox and Safari. Rounded bars fall back to drawn arcs where `roundRect` is missing, and sizes
fall back to CSS pixels times the screen density where `device-pixel-content-box` is missing.

## <img src="https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/icons/security.svg" alt="" width="24" height="24"> Security

- No HTML is ever parsed: text goes in as text, icons are built element by element, and nothing uses `innerHTML` or
  `eval`. Styles are set through the CSSOM, so a strict Content-Security-Policy without `'unsafe-inline'` works.
- Colors only reach properties that take nothing but a color, so a color can never make the page fetch an address.
- Everything that comes from outside has a ceiling: peaks files, text, regions, FFT sizes, clips and downloads.
- No runtime dependencies and no install scripts. The only text in the package that looks like an address is the SVG
  namespace, `http://www.w3.org/2000/svg`, a name the browser needs to create the icons; it is never fetched, and
  the build check fails on any other.

Report a vulnerability privately to the author (see the npm page) rather than in a public issue. The details are in
[Security](https://ediejohnny.github.io/sonicframe/security.html).

## <img src="https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/icons/contributing.svg" alt="" width="24" height="24"> Report a problem or contribute

- Found a bug, or something hard to use? [Open an issue](https://github.com/ediejohnny/sonicframe/issues) with what
  you did, what you expected and what happened.
- To run it: clone the repository, `npm install`, then `npm run dev` and open `/playground/`, the docs site with
  every example live. `npm test` runs the tests.

## <img src="https://raw.githubusercontent.com/ediejohnny/sonicframe/main/assets/icons/license.svg" alt="" width="24" height="24"> License

[MIT](LICENSE) © Edie Johnny
