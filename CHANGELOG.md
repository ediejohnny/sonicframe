# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- `markers` can now carry a label and a color per mark (`marks: [{ time, label, color, id }]`, still
  accepting plain `times`). A click on a marker seeks to it, hovering shows a tooltip, `M` and
  `Shift+M` step through them, and markers that crowd together become one pill with a count.

### Added

- Plugins can take pointer and keyboard input: `pointerDown` claims a press (`'take'` now, or
  `'drag'` only once it moves past a few pixels, so a tap still seeks), with `pointerMove`,
  `pointerUp`, `pointerCancel` and a `pointerHover` that returns a cursor; `keyDown` runs before the
  slider keys. Plugins can play a stretch of the sound (`host.playRange` / `host.stopRange`, with a
  `rangeend` event), seek (`host.seekTo`), and speak to a screen reader through a shared polite live
  region (`host.announce`). A seek out of a range being played abandons it.
- Hover colors: `colors.waveHover` and `colors.progressHover` recolor the unplayed and played bars
  while the pointer is over a frame. Each takes `'auto'` (nudges the wave toward the played color,
  and lightens or darkens the played color), a CSS color, or null. Off by default, so an upgrade
  looks the same; only the frame the pointer enters or leaves repaints.
- `caption`: a line under the bars that fades out on the right, with optional badges (an `auto`
  mark, a language tag) and a tooltip that opens on hover, on keyboard focus and on a tap, closes on
  Escape, and stays while the pointer rests on it. Text goes in as text, never HTML; the fade is a
  fixed mask, never built from a page color; the tooltip's text color is chosen for contrast on its
  background; and the whole caption reaches screen readers through `aria-describedby`. Clicking it
  never seeks.
- Plugins can stack a lane above or below the bars (`host.addLane`); the wave shrinks to make room,
  and a press on a lane is not a seek. They can also draw into a shared layer over the canvas
  (`host.overlay`), read the peaks and the wave's geometry (`host.peaks`, `host.geometry`), and learn
  when the wave area changes size (the `resize` event and a `resize` hook on a plugin), and resolve a
  CSS color against the frame (`host.color`). All of this is additive: a 0.1.0 plugin keeps working
  unchanged.

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
