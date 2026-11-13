import {
    PlayButton,
    SonicFrame,
    formatPosition,
    loadWaveform,
} from 'sonicframe';

const box = document.querySelector('#events-clock');
const media = new Audio('./sounds/little-elf.mp3');
const row = document.createElement('div');
row.style.display = 'flex';
row.style.alignItems = 'center';
row.style.gap = '0.75rem';
const clock = document.createElement('p');
clock.textContent = 'Press play, or click the wave.';
box.append(row, clock);

PlayButton.create({ container: row, media });
const wave = document.createElement('div');
wave.style.flex = '1';
wave.style.height = '4rem';
row.append(wave);
const frame = new SonicFrame({
    container: wave,
    media,
    peaks: () => loadWaveform('./sounds/little-elf.dat'),
});

frame.on('timeupdate', (time) => {
    clock.textContent = formatPosition(time);
});
frame.on('error', (error) => {
    clock.textContent = `Something went wrong: ${error.message}`;
});
