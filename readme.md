# ffmpeg-audio-player

Una librería para reproducir audio en Node.js usando FFmpeg y Speaker. Permite gestionar una cola de reproducción, controlar eventos y personalizar el uso de binarios FFmpeg.

## Novedades (Changelog)

### vX.Y.Z (fecha)
- [Describe aquí los cambios principales que realizaste. Ejemplo:]
- Añadido soporte para nuevos formatos de audio.
- Mejorada la gestión de errores en la cola.
- Refactorizada la clase `Player` para mayor eficiencia.
- Documentación actualizada y ejemplos mejorados.
- [Agrega aquí cualquier otro cambio relevante.]

## Características

- Reproducción de archivos de audio (MP3, WAV, etc.) en Node.js.
- Gestión de cola de pistas (añadir, limpiar, listar).
- Control de reproducción: play, stop, skip, resume.
- Detección automática de FFmpeg nativo o personalizado.
- Emisión de eventos: inicio, progreso, pausa, fin de pista, fin de cola, error.
- Basado en [fluent-ffmpeg](https://www.npmjs.com/package/fluent-ffmpeg) y [speaker](https://www.npmjs.com/package/speaker).

## Instalación

```sh
npm install ffmpeg-audio-player
```

Asegúrate de tener FFmpeg instalado y accesible en tu sistema (`ffmpeg` y `ffprobe` en el PATH), o proporciona rutas personalizadas. El paquete incluye binarios estáticos para la mayoría de plataformas.

## Uso Básico

```ts
import { Player, AudioQueue } from 'ffmpeg-audio-player';

const player = new Player(AudioQueue);

AudioQueue.add('/ruta/a/mi_audio1.mp3');
AudioQueue.add('/ruta/a/mi_audio2.mp3');

player.play();
```

## API

### Player

- `constructor(audioQueue, options?)`
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

## Opciones de Player

- `ffmpegPath`: Ruta personalizada a FFmpeg.
- `ffprobePath`: Ruta personalizada a FFprobe.
- `forceNativeFFmpeg`: Forzar uso de FFmpeg nativo del sistema.

## Ejemplo Completo

Consulta [src/example.ts](src/example.ts) para un ejemplo de uso interactivo.

## Requisitos

- Node.js >= 18
- FFmpeg y FFprobe instalados o rutas personalizadas configuradas (incluido vía dependencia).
