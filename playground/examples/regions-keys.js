import { PlayButton, SonicFrame, loadWaveform, regions } from 'sonicframe';

const box = document.querySelector('#regions-keys');
box.style.display = 'flex';
box.style.alignItems = 'center';
box.style.gap = '0.75rem';
const media = new Audio('./sounds/little-elf.mp3');

PlayButton.create({ container: box, media });
const wave = document.createElement('div');
wave.style.flex = '1';
wave.style.height = '4rem';
box.append(wave);
const frame = new SonicFrame({
    container: wave,
    media,
    peaks: () => loadWaveform('./sounds/little-elf.dat'),
});

frame.use(
    regions({
        items: [{ start: 8.5, end: 16, label: 'Verse' }],
        keys: {
            select: 'g', // G and Shift+G in place of R ('r'; false turns it off)
            loop: false, // no loop key ('l')
            play: true, // Enter
            nudge: true, // [ ] { }
            remove: false, // Delete and Backspace
            release: true, // Escape
        },
    }),
);
