# mi-audio-player

Una librería para reproducir audio en un backend de Node.js usando FFmpeg.

## Características

- Reproducción de archivos de audio (MP3, WAV, etc.) en Node.js.
- Cola de reproducción (playlist) gestionada en memoria.
- Control de reproducción: play, stop, skip.
- Eventos para seguimiento de progreso, inicio, fin y errores.
- Basado en [fluent-ffmpeg](https://www.npmjs.com/package/fluent-ffmpeg) y [speaker](https://www.npmjs.com/package/speaker).

## Instalación

```sh
npm install mi-audio-player
```

Asegúrate de tener FFmpeg instalado (el paquete incluye binarios estáticos para la mayoría de plataformas).

## Uso Básico

```ts
import { Player, AudioQueue } from 'mi-audio-player';

const player = new Player(AudioQueue);

AudioQueue.add('/ruta/a/mi_audio1.mp3');
AudioQueue.add('/ruta/a/mi_audio2.mp3');

player.play();
```

## API

### Player

- `play(filePath?: string): Promise<void>`  
  Inicia la reproducción del archivo especificado o del siguiente en la cola.

- `pause(): void`  
  Pausa la reproducción (equivalente a stop, por limitaciones técnicas).

- `resume(): void`  
  Reanuda la reproducción (no implementado, llama internamente a pause).

- `stop(): void`  
  Detiene la reproducción actual.

- `skip(): void`  
  Salta a la siguiente pista en la cola.

- `getCurrentProgress(): number`  
  Devuelve el tiempo transcurrido en segundos.

- `hasTrack(): boolean`  
  Indica si hay una pista cargada.

- `destroy(): void`  
  Limpia recursos y elimina listeners.

#### Eventos

- `'start'` — Cuando inicia una pista.
- `'progress'` — Cada segundo, con el progreso.
- `'end'` — Cuando termina una pista.
- `'queue-end'` — Cuando la cola termina.
- `'error'` — Si ocurre un error.

### AudioQueue

- `add(filePath: string): void`  
  Agrega un archivo a la cola.

- `getNext(): string | undefined`  
  Obtiene y elimina el siguiente archivo de la cola.

- `list(): string[]`  
  Devuelve la lista actual de la cola.

- `clear(): void`  
  Limpia la cola.

## Ejemplo Completo

Consulta [src/example.ts](src/example.ts) para un ejemplo de uso interactivo.

## Requisitos

- Node.js >= 18
- FFmpeg (incluido vía dependencia)