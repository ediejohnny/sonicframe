import { PlayButton, SonicFrame, caption, loadWaveform } from 'sonicframe';

const box = document.querySelector('#caption-tooltip');
box.style.display = 'flex';
box.style.alignItems = 'center';
box.style.gap = '0.75rem';
const media = new Audio('./sounds/little-elf.mp3');

PlayButton.create({ container: box, media });
const wave = document.createElement('div');
wave.style.flex = '1';
wave.style.height = '5rem';
box.append(wave);
const frame = new SonicFrame({
    container: wave,
    media,
    peaks: () => loadWaveform('./sounds/little-elf.dat'),
});

frame.use(
    caption({
        text: 'I met a little elf-man, once, down where the lilies blow.',
        height: '1.25rem',
        tooltipMax: 400,
        tooltip: [
            {
                label: 'Transcript',
                text: 'I met a little elf-man, once, down where the lilies blow. I asked him why he was so small, and why he did not grow.',
                max: 200,
            },
            { label: 'Language', text: 'English' },
        ],
    }),
);
