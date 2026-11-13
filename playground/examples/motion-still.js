import { PlayButton, SonicFrame, loadWaveform } from 'sonicframe';

const box = document.querySelector('#motion-still');
box.style.display = 'flex';
box.style.alignItems = 'center';
box.style.gap = '0.75rem';
const media = new Audio('./sounds/little-elf.mp3');

PlayButton.create({ container: box, media });
const wave = document.createElement('div');
wave.style.flex = '1';
wave.style.height = '4rem';
box.append(wave);
new SonicFrame({
    container: wave,
    media,
    peaks: () => loadWaveform('./sounds/little-elf.dat'),
    animate: false, // the bars appear at once, without growing in
});
