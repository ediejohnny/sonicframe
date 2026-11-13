import { PlayButton, SonicFrame, loadWaveform } from 'sonicframe';

const box = document.querySelector('#analysis-clip');
const media = new Audio('./sounds/little-elf.mp3');
const row = document.createElement('div');
row.style.display = 'flex';
row.style.alignItems = 'center';
row.style.gap = '0.75rem';
const button = document.createElement('button');
button.type = 'button';
button.textContent = 'Make a clip of 0:08 to 0:16';
const video = document.createElement('video');
video.controls = true;
video.hidden = true;
box.append(row, button, video);

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

button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Making the clip…';
    const clip = await frame.exportClip({
        start: 8,
        end: 16,
        caption: 'The second verse',
    });
    video.src = URL.createObjectURL(clip.blob);
    video.hidden = false;
    button.textContent = 'Done: play it below';
});
