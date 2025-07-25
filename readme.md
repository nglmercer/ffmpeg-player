# ffmpeg-audio-player

A lightweight Node.js library that streams and plays audio files using FFmpeg under the hood.

> **Note:** This package is currently a thin wrapper around `fluent-ffmpeg` and `speaker`.  
> Future releases may bundle pre-compiled FFmpeg binaries and add native pause/resume.

---

## Features

- ✅ Play any audio format supported by FFmpeg (MP3, WAV, FLAC, AAC, OGG, …)  
- ✅ In-memory playlist (queue) with FIFO order  
- ✅ Simple play / stop / skip controls  
- ✅ Progress & lifecycle events (`start`, `progress`, `end`, `queue-end`, `error`)  
- ✅ Zero-config on most platforms (auto-detects FFmpeg and default audio backend)

---

## Installation

```bash
npm install ffmpeg-audio-player
```

### System Requirements

* Node.js ≥ 18  
* FFmpeg binaries must be discoverable in `PATH`  
  (macOS & most Linux distros: `brew install ffmpeg` or `apt install ffmpeg`)  
  (Windows: download from [https://ffmpeg.org](https://ffmpeg.org) and add to `%PATH%`)

---

## Quick Start

```ts
import { Player, AudioQueue } from 'ffmpeg-audio-player';

const queue = new AudioQueue();
const player = new Player(queue);

// 1. Add tracks
queue.add('./music/track1.mp3');
queue.add('./music/track2.wav');

// 2. Start playback
await player.play();      // plays track1.mp3
```

---

## API Reference

### `AudioQueue`

In-memory FIFO playlist.

| Method                         | Description                                      |
| ------------------------------ | ------------------------------------------------ |
| `add(filePath: string): void`  | Push a file to the end of the queue              |
| `getNext(): string \| undefined` | Pop (and return) the next file path              |
| `peek(): string \| undefined`  | Preview the next file without removing it        |
| `list(): string[]`             | Current queue as an array                        |
| `clear(): void`                | Empty the queue                                  |

---

### `Player`

Event-emitter that plays files from an `AudioQueue`.

#### Constructor

```ts
import { Player } from 'ffmpeg-audio-player';
const player = new Player(queueInstance);
```

#### Methods

| Signature                                   | Description                                                                 |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| `play(filePath?: string): Promise<void>`    | Play the supplied path **or** the next item in the queue                    |
| `pause(): void`                             | **Stops** the current track (pause is not yet supported)                    |
| `resume(): void`                            | Alias for `pause()` (placeholder)                                           |
| `stop(): void`                              | Immediately stop playback and flush the PCM stream                          |
| `skip(): void`                              | Stop current track and start the next one from the queue                    |
| `getCurrentProgress(): number`              | Seconds elapsed on the active track (`0` if idle)                           |
| `hasTrack(): boolean`                       | `true` when a track is currently loaded                                     |
| `destroy(): void`                           | Kill FFmpeg process, remove listeners, and free resources                   |

#### Events

| Event        | Payload                                           | Emitted when …                                  |
| ------------ | ------------------------------------------------- | ----------------------------------------------- |
| `start`      | `{ track: string }`                               | A new track starts                              |
| `progress`   | `{ track: string, current: number, total: number }` | Every second while playing                      |
| `end`        | `{ track: string }`                               | Current track finishes (naturally or skipped)   |
| `queue-end`  | —                                                 | Last track in the queue finished                |
| `error`      | `Error`                                           | FFmpeg or I/O error occurred                    |

Example usage with events:

```ts
player
  .on('start', ({ track }) => console.log(`▶️  ${track}`))
  .on('progress', ({ current, total }) =>
    console.log(`⏳ ${current.toFixed(1)}s / ${total.toFixed(1)}s`)
  )
  .on('end', ({ track }) => console.log(`✅ ${track} finished`))
  .on('queue-end', () => console.log('🎉 Playlist complete'))
  .on('error', err => console.error('❌', err.message));
```

---

## Advanced Example

```ts
import { Player, AudioQueue } from 'ffmpeg-audio-player';

const playlist = new AudioQueue();
const player   = new Player(playlist);

// Add some songs
['a.mp3', 'b.wav', 'c.flac'].forEach(f => playlist.add(f));

// Simple CLI controls
process.stdin.setRawMode(true);
process.stdin.on('data', chunk => {
  switch (chunk.toString()) {
    case ' ': player.pause(); break;
    case 'n': player.skip();  break;
    case 'q': process.exit(0);
  }
});

await player.play();
```

---

## FAQ / Troubleshooting

| Issue | Fix |
|-------|-----|
| `Error: spawn ffmpeg ENOENT` | Ensure FFmpeg is installed and available in `PATH` (`ffmpeg -v` should work). |
| No sound on Linux | Install ALSA headers: `sudo apt-get install libasound2-dev` then `npm rebuild`. |
| Cannot pause/resume | True pause requires saving FFmpeg state; use `skip()` to jump tracks instead. |

---

## Roadmap

- [ ] Native pause/resume via FFmpeg seek & offset caching  
- [ ] Optional bundled FFmpeg binaries  
- [ ] Gapless playback / cross-fade  
- [ ] Volume & equalizer controls  
- [ ] Web / Electron renderer

---
### Documentation in spanish[here](https://github.com/nglmercer/ffmpeg-player/blob/main/readme.es.md)
## License

MIT © 2025 ffmpeg-audio-player contributors