// src/index.ts

import path from 'path';
import Player from './audio-player.js';
import { AudioQueue } from './audio-queue.js'; 
const player = new Player(AudioQueue);

// --- Manejo de Eventos con Tipos Explícitos ---

player.on('start', (data: { track: string }) => {
  console.log(`EVENT: 'start' -> Now playing ${path.basename(data.track)}`);
});

player.on('progress', (data: { track: string; elapsed: number }) => {
  const seconds = Math.floor(data.elapsed);
  if (seconds > 0 && seconds % 5 === 0) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    console.log(`EVENT: 'progress' -> ${minutes}:${remainingSeconds.toString().padStart(2, '0')}`);
  }
});

player.on('pause', (data: { track: string; progress: number }) => {
  console.log(`EVENT: 'pause' -> Paused at ${Math.floor(data.progress)}s`);
});

player.on('end', (data: { track: string }) => {
  console.log(`EVENT: 'end' -> Finished ${path.basename(data.track)}. Playing next...`);
  player.play(); // Reproducir la siguiente automáticamente
});

player.on('queue-end', () => {
  console.log("EVENT: 'queue-end' -> Playback queue is empty.");
});

player.on('error', (error: Error) => {
  console.error('EVENT: "error" -> An error occurred:', error.message);
});



export {
  AudioQueue,
  player
}