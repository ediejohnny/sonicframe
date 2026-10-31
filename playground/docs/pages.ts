/**
 * Every docs page, in the order the sidebar lists them and "Previous / Next" walks them. The build
 * reads this list to draw the sidebar, the footer and the pager into each page; a page that is not
 * here is still served but appears in no menu.
 */

export type DocsPage = {
    /** The page's file in `playground/`. */
    file: string;
    /** Its name in the sidebar, the pager and the search. */
    name: string;
};

export type DocsGroup = { group: string; pages: DocsPage[] };

export const PAGES: readonly DocsGroup[] = [
    {
        group: 'Getting started',
        pages: [
            { file: 'index.html', name: 'Introduction' },
            { file: 'installation.html', name: 'Installation' },
            { file: 'quickstart.html', name: 'Quickstart' },
            { file: 'upgrade.html', name: 'Upgrade guide' },
            { file: 'browsers.html', name: 'Browser support' },
        ],
    },
    {
        group: 'The basics',
        pages: [
            { file: 'frame.html', name: 'The frame' },
            { file: 'peaks.html', name: 'Peaks' },
            { file: 'playing.html', name: 'Playing and seeking' },
            { file: 'events.html', name: 'Events' },
            { file: 'styling.html', name: 'Colors and CSS' },
        ],
    },
    {
        group: 'The player',
        pages: [
            { file: 'player.html', name: 'Player basics' },
            { file: 'layouts.html', name: 'Parts and layouts' },
            { file: 'drawings.html', name: 'Drawings' },
            { file: 'theming.html', name: 'Themes and palettes' },
            { file: 'themes.html', name: 'Theme gallery' },
            { file: 'element.html', name: 'The HTML tag' },
        ],
    },
    {
        group: 'Accessibility',
        pages: [
            { file: 'accessibility.html', name: 'Overview' },
            { file: 'keyboard.html', name: 'Keyboard' },
            { file: 'announcements.html', name: 'Screen readers' },
            { file: 'words.html', name: 'The wave in words' },
            { file: 'captions.html', name: 'Captions' },
            { file: 'motion.html', name: 'Motion' },
        ],
    },
    {
        group: 'Long sounds',
        pages: [
            { file: 'zoom.html', name: 'Zoom and scroll' },
            { file: 'minimap.html', name: 'The minimap' },
            { file: 'chapters.html', name: 'Chapters' },
            { file: 'waveform-files.html', name: 'Ready-made peaks' },
            { file: 'long-sound.html', name: 'A one-hour sound' },
        ],
    },
    {
        group: 'Plugins',
        pages: [
            { file: 'plugins.html', name: 'Overview' },
            { file: 'markers.html', name: 'Markers' },
            { file: 'regions.html', name: 'Regions' },
            { file: 'timeline.html', name: 'Timeline' },
            { file: 'spectrogram.html', name: 'Spectrogram' },
            { file: 'skip-silences.html', name: 'Skip silences' },
            { file: 'live-frequency.html', name: 'Live frequency' },
            { file: 'analysis.html', name: 'Analysis and clips' },
            { file: 'writing-plugins.html', name: 'Writing a plugin' },
        ],
    },
    {
        group: 'Guides',
        pages: [
            { file: 'guide-podcast.html', name: 'A podcast player' },
            { file: 'guide-voice-note.html', name: 'A chat voice note' },
            { file: 'performance.html', name: 'Many players on a page' },
        ],
    },
    {
        group: 'Reference',
        pages: [
            { file: 'frame-options.html', name: 'Frame options' },
            { file: 'frame-api.html', name: 'Frame methods and events' },
            { file: 'player-options.html', name: 'Player options' },
            { file: 'tag-attributes.html', name: 'Tag attributes' },
            { file: 'plugin-api.html', name: 'Plugin API' },
            { file: 'css-variables.html', name: 'CSS variables' },
            { file: 'security.html', name: 'Security' },
        ],
    },
];

/** Every page in reading order, each with its group. */
export function readingOrder(): (DocsPage & { group: string })[] {
    return PAGES.flatMap(({ group, pages }) =>
        pages.map((page) => ({ ...page, group })),
    );
}
