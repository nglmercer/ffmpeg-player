// src/audio-player.ts
import fs from 'fs';
import { EventEmitter } from 'events';
import Speaker from 'speaker';
import ffmpeg from 'fluent-ffmpeg';
import { FFmpegDetector } from '../utils/ffmpeg-detector.js'; // Asegúrate de que la ruta sea correcta
import { type IAudioQueue } from './audio-queue.js';

// Interfaz para la información del stream obtenida con ffprobe
interface FfprobeData {
  streams: Array<{
    codec_type: string;
    channels: number;
    sample_rate: string;
    bits_per_sample?: number;
  }>;
}

// Interface for Player Options, now including custom FFmpeg paths
export interface PlayerOptions {
  /**
   * Ruta opcional al binario de FFmpeg. Si se proporciona, tendrá prioridad.
   */
  ffmpegPath?: string;
  /**
   * Ruta opcional al binario de FFprobe. Si se proporciona, tendrá prioridad.
   */
  ffprobePath?: string;
  /**
   * Si es `true`, fuerza el uso de los binarios nativos de FFmpeg/FFprobe
   * disponibles en el PATH del sistema, ignorando cualquier ruta personalizada.
   */
  forceNativeFFmpeg?: boolean;
  // `preferNativeFFmpeg` and `forceStaticFFmpeg` are removed as their logic
  // is now handled implicitly by the new FFmpegDetector or are no longer applicable.
}

class Player extends EventEmitter {
  private audioQueue: IAudioQueue;
  private options: PlayerOptions;
  private ffmpegDetector: FFmpegDetector;
  private isFFmpegConfigured: boolean = false;

  public isPlaying: boolean = false;
  public isPaused: boolean = false;
  public currentTrack: string | null = null;
  public pausedTime: number = 0;

  private ffmpegCommand: ffmpeg.FfmpegCommand | null = null;
  private speaker: Speaker | null = null;
  private startTime: number = 0;
  private progressInterval: NodeJS.Timeout | null = null;
  private _isStoppingIntentionally: boolean = false; // Bandera clave para el manejo de errores

  constructor(audioQueue: IAudioQueue, options: PlayerOptions = {}) {
    super();
    this.audioQueue = audioQueue;
    this.options = {
      forceNativeFFmpeg: false,
      ...options
    };
    this.ffmpegDetector = FFmpegDetector.getInstance();

    if (this.options.ffmpegPath || this.options.ffprobePath) {
      this.ffmpegDetector.setCustomPaths(
        this.options.ffmpegPath || null,
        this.options.ffprobePath || null
      );
    }
  }

  /**
   * Configura FFmpeg según las opciones especificadas
   */
  private async configureFFmpeg(): Promise<void> {
    if (this.isFFmpegConfigured) return;

    try {
      let ffmpegPaths;

      if (this.options.forceNativeFFmpeg) {
        // Si se fuerza nativo, el detector intentará usar solo el nativo
        ffmpegPaths = await this.ffmpegDetector.forceNativeFFmpeg();
      } else {
        // Si no se fuerza nativo, el detector usará personalizado (si se estableció) o nativo
        ffmpegPaths = await this.ffmpegDetector.detectFFmpegPaths();
      }

      // Configurar las rutas en fluent-ffmpeg
      if (ffmpegPaths.ffmpeg) {
        ffmpeg.setFfmpegPath(ffmpegPaths.ffmpeg);
      }
      if (ffmpegPaths.ffprobe) {
        ffmpeg.setFfprobePath(ffmpegPaths.ffprobe);
      }

      this.isFFmpegConfigured = true;
      
      console.log(`[Player] FFmpeg configured: ${ffmpegPaths.isNative ? 'Native' : 'Custom/Fallback'}`);
      console.log(`[Player] FFmpeg path: ${ffmpegPaths.ffmpeg}`);
      console.log(`[Player] FFprobe path: ${ffmpegPaths.ffprobe}`);

    } catch (error) {
      console.error('[Player] Failed to configure FFmpeg:', error);
      throw error;
    }
  }

  /**
   * Obtiene información sobre la disponibilidad de FFmpeg
   */
  public getFFmpegInfo(): {
    nativeAvailable: boolean;
    customAvailable: boolean; // Renombrado de staticAvailable
    recommendation: string;
  } {
    const info = this.ffmpegDetector.getFFmpegAvailability();
    return {
      nativeAvailable: info.nativeAvailable,
      customAvailable: info.customAvailable, // Usar la nueva propiedad
      recommendation: info.recommendation
    };
  }

  public async play(filePath?: string): Promise<void> {
    if (this.isPlaying) {
      console.log('[Player] A track is already playing. Stop it first.');
      return;
    }

    await this.configureFFmpeg();

    const trackToPlay = filePath || this.audioQueue.getNext();
    if (!trackToPlay) {
      this.emit('queue-end');
      return;
    }

    this._cleanup();

    if (!fs.existsSync(trackToPlay)) {
      console.error(`[Player] Error: File not found at ${trackToPlay}`);
      this.emit('error', new Error(`File not found: ${trackToPlay}`));
      this.play();
      return;
    }

    this.currentTrack = trackToPlay;
    this.isPlaying = true;
    this.isPaused = false;
    // La bandera se resetea aquí, el único lugar seguro para hacerlo.
    this._isStoppingIntentionally = false; 

    try {
      console.log(`[Player] Probing audio format for: ${this.currentTrack}`);

      const metadata = await this.getAudioMetadata(this.currentTrack);
      console.log('[Player] Audio format detected:', metadata);

      this.speaker = new Speaker({
        channels: metadata.channels,
        bitDepth: metadata.bitDepth,
        sampleRate: metadata.sampleRate,
      });

      this.speaker.on('open', () => {
        console.log(`[Player] Speaker opened for: ${this.currentTrack}`);
        this.startTime = Date.now();
        this.emit('start', { track: this.currentTrack });
        this._startProgressTracker();
      });

      this.speaker.on('close', () => {
        console.log(`[Player] Speaker closed.`);
        this._handleTrackEnd();
      });

      this.speaker.on('error', (err: Error & { code?: string }) => {
        // Suprime ERR_STREAM_WRITE_AFTER_END si la detención fue intencional
        if (this._isStoppingIntentionally && err.code === 'ERR_STREAM_WRITE_AFTER_END') {
          console.log('[Player] Suppressing ERR_STREAM_WRITE_AFTER_END during intentional stop.');
          return;
        }

        console.error('[Player] Speaker error:', err);
        this.emit('error', err);
        this._cleanup();
      });

      console.log(`[Player] Starting playback: ${this.currentTrack}`);
      this.ffmpegCommand = ffmpeg(this.currentTrack)
        .toFormat('s16le')
        .audioChannels(metadata.channels)
        .audioFrequency(metadata.sampleRate)
        .on('error', (err) => {
          // Si el error es un SIGKILL y la detención fue intencional, suprimirlo
          if (this._isStoppingIntentionally) {
            console.log('[Player] FFmpeg process intentionally stopped (SIGKILL). Suppressing error.');
            // NO reiniciar la bandera aquí. Este es el cambio clave.
            return; 
          }

          // Para todos los demás errores inesperados, emitir y limpiar
          console.error('[Player] FFmpeg error:', err.message);
          this.emit('error', err);
          this._cleanup();
        })
        .on('end', () => {
          console.log(`[Player] FFmpeg finished processing: ${this.currentTrack}`);
          // Si la pista termina normalmente, es seguro reiniciar la bandera
          this._isStoppingIntentionally = false;
        });

      this.ffmpegCommand.pipe(this.speaker, { end: true });

    } catch (error) {
      console.error('[Player] Error starting playback:', error);
      this.emit('error', error as Error);
      this._cleanup();
    }
  }

  public pause(): void {
    console.warn("[Player] Pause is not fully supported with ffmpeg. Use stop() instead.");
    this.stop();
  }

  public resume(): void {
    if (!this.isPlaying && this.currentTrack === null) {
      this.play();
    } else if (this.currentTrack !== null && !this.isPlaying) {
      console.log("[Player] Resume called, but pause currently stops playback. Re-playing current track.");
      this.play(this.currentTrack);
    } else if (this.isPlaying) {
      console.log("[Player] Already playing. Resume has no effect.");
    }
  }
  
  public stop(): void {
    if (!this.isPlaying) return;

    console.log('[Player] Stopping playback...');
    this.emit('stop', { track: this.currentTrack });
    // Establecer la bandera ANTES de limpiar/matar FFmpeg
    this._isStoppingIntentionally = true; 
    this._cleanup();
  }

  public skip(): void {
    console.log('[Player] Skipping track...');
    this.stop();
    setTimeout(() => this.play(), 100);
  }

  private getAudioMetadata(filePath: string): Promise<{ channels: number; sampleRate: number; bitDepth: number; }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, data: FfprobeData | any) => {
        if (err) {
          return reject(err);
        }
        const audioStream = data.streams.find((s: any) => s.codec_type === 'audio');
        if (!audioStream) {
          return reject(new Error('No audio stream found in file'));
        }
        resolve({
          channels: audioStream.channels,
          sampleRate: parseInt(audioStream.sample_rate, 10),
          bitDepth: audioStream.bits_per_sample || 16,
        });
      });
    });
  }

  public getCurrentProgress(): number {
    if (!this.isPlaying) return 0;
    if (this.isPaused) return this.pausedTime / 1000;
    return (Date.now() - this.startTime) / 1000;
  }

  public hasTrack(): boolean {
    return this.currentTrack !== null;
  }

  private _startProgressTracker(): void {
    this._stopProgressTracker();
    this.progressInterval = setInterval(() => {
      if (this.isPlaying && !this.isPaused) {
        const elapsedSeconds = (Date.now() - this.startTime) / 1000;
        this.emit('progress', { 
          track: this.currentTrack, 
          elapsed: elapsedSeconds 
        });
      }
    }, 1000);
  }

  private _stopProgressTracker(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  private _handleTrackEnd(): void {
    // Si el reproductor fue detenido intencionalmente por el usuario (vía stop() o skip()),
    // el método `_cleanup()` ya fue llamado. No debemos hacer nada más aquí,
    // especialmente no intentar reproducir la siguiente pista.
    if (this._isStoppingIntentionally) {
      console.log('[Player] Speaker closed due to intentional stop. No further action needed.');
      return;
    }

    // Si llegamos aquí, significa que la pista terminó de forma natural.
    const finishedTrack = this.currentTrack;
    console.log(`[Player] Track finished naturally: ${finishedTrack}`);
    
    this.emit('end', { track: finishedTrack });
    this._cleanup(); // Limpiar los recursos de la pista que acaba de terminar.

    // Ahora, intentemos reproducir la siguiente pista de la cola.
    const nextTrack = this.audioQueue.getNext();
    if (nextTrack) {
        console.log('[Player] Automatically playing next track...');
        // Usamos la nueva variable `nextTrack` para asegurar que pasamos la pista correcta a play()
        // y un pequeño retardo para permitir que los recursos se liberen por completo.
        setTimeout(() => this.play(nextTrack), 100);
    } else {
        console.log('[Player] Queue finished.');
        this.emit('queue-end');
    }
  }


  private _cleanup(): void {
    console.log('[Player] Cleaning up resources...');

    this._stopProgressTracker();

    if (this.ffmpegCommand) {
      this.ffmpegCommand.kill('SIGKILL');
      this.ffmpegCommand = null;
    }

    if (this.speaker) {
      // .end() es importante para que se emita 'close' pero puede causar el error 'write after end'
      // que ya estamos manejando.
      this.speaker.end();
      this.speaker = null;
    }

    this.currentTrack = null;
    this.isPlaying = false;
    this.isPaused = false;
    this.startTime = 0;
  }

  public destroy(): void {
    console.log('[Player] Destroying player...');
    this._cleanup();
    this.removeAllListeners();
  }

  public async reconfigureFFmpeg(options: PlayerOptions): Promise<void> {
    this.options = { ...this.options, ...options };
    if (this.options.ffmpegPath || this.options.ffprobePath) {
      this.ffmpegDetector.setCustomPaths(
        this.options.ffmpegPath || null,
        this.options.ffprobePath || null
      );
    }

    this.isFFmpegConfigured = false; 
    this.ffmpegDetector.clearCache(); 
    await this.configureFFmpeg();
  }
}

export default Player;