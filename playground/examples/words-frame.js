import {
    PlayButton,
    SonicFrame,
    loadWaveform,
    soundDescription,
} from 'sonicframe';

const box = document.querySelector('#words-frame');
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

frame.use(soundDescription({ lang: 'pt', keys: true }));
