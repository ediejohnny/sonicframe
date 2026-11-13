import { PlayButton, VolumeControl } from 'sonicframe';

const box = document.querySelector('#frame-volume');
box.style.display = 'flex';
box.style.alignItems = 'center';
box.style.gap = '0.75rem';
const media = new Audio('./sounds/little-elf.mp3');

PlayButton.create({ container: box, media });
VolumeControl.create({ container: box, media, slider: 'hover' });
