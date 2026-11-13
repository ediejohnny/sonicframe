import { PlayButton, SonicFrame, loadWaveform, markers } from 'sonicframe';

const box = document.querySelector('#markers-keys');
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

const items = [
    { time: 2.4, label: 'Title' },
    { time: 9, label: 'Second line' },
    { time: 21, label: 'Last lines' },
];
frame.use(markers({ items, keys: { letter: 'k', backGrace: 2 } })); // K and Shift+K
