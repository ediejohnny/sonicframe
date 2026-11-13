import { PlayButton, SonicFrame, loadWaveform } from 'sonicframe';

const box = document.querySelector('#frame-play');
box.style.display = 'flex';
box.style.alignItems = 'center';
box.style.gap = '0.75rem';
const media = new Audio('./sounds/little-elf.mp3');

PlayButton.create({
    container: box,
    media,
    shape: 'circle',
    fill: 'solid',
    size: 32,
});
const wave = document.createElement('div');
wave.style.flex = '1';
wave.style.height = '4rem';
box.append(wave);
new SonicFrame({
    container: wave,
    media,
    peaks: () => loadWaveform('./sounds/little-elf.dat'),
});
