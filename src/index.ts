// src/index.ts - El nuevo punto de entrada de la librería
// Exportamos la clase Player como el export por defecto
export { default as Player } from './player/audio-player.js';

// Exportamos la cola de audio y su interfaz
export { AudioQueue, type IAudioQueue } from './player/audio-queue.js';
