// En src/example.ts
import path from 'path';
import { Player, AudioQueue } from './index.js'; // Importa desde el punto de entrada

// El usuario de la librería definirá dónde están sus audios.
// Podría ser una ruta absoluta o relativa a su propio proyecto.
const audioFolder = path.resolve(process.cwd(), 'audio_outputs');

console.log(`Buscando audios en: ${audioFolder}`);

const player = new Player(AudioQueue);

// ... (el resto de tus manejadores de eventos) ...

function test() {
  console.log('--- Node.js Audio Player (TypeScript) ---');

  AudioQueue.add(path.join(audioFolder, 'track1.mp3'));
  AudioQueue.add(path.join(audioFolder, 'track2.mp3'));
  
  console.log('\nInitial queue:', AudioQueue.list().map(p => path.basename(p)));
  console.log('\nStarting playback...');
  
  player.play();

  setTimeout(() => {
    console.log("\n--- DEMO: Pausing after 7 seconds ---");
    player.pause();
  }, 7000);

  setTimeout(() => {
    console.log("\n--- DEMO: Resuming after 10 seconds ---");
    player.resume();
  }, 10000);
  
  setTimeout(() => {
    console.log("\n--- DEMO: Skipping track after 15 seconds ---");
    player.skip();
  }, 15000);
}

test();