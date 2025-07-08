// src/audio-player.ts
import fs from 'fs';
import { EventEmitter } from 'events';
import Speaker from 'speaker';
import ffmpeg from 'fluent-ffmpeg';
import { FFmpegDetector } from '../utils/ffmpeg-detector.js';
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

interface AudioFormat {
  channels: number;
  bitDepth: number;
  sampleRate: number;
}

export interface PlayerOptions {
  preferNativeFFmpeg?: boolean;
  forceNativeFFmpeg?: boolean;
  forceStaticFFmpeg?: boolean;
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

  constructor(audioQueue: IAudioQueue, options: PlayerOptions = {}) {
    super();
    this.audioQueue = audioQueue;
    this.options = {
      preferNativeFFmpeg: true,
      forceNativeFFmpeg: false,
      forceStaticFFmpeg: false,
      ...options
    };
    this.ffmpegDetector = FFmpegDetector.getInstance();
  }

  /**
   * Configura FFmpeg según las opciones especificadas
   */
  private async configureFFmpeg(): Promise<void> {
    if (this.isFFmpegConfigured) return;

    try {
      let ffmpegPaths;

      if (this.options.forceNativeFFmpeg) {
        ffmpegPaths = await this.ffmpegDetector.forceNativeFFmpeg();
      } else if (this.options.forceStaticFFmpeg) {
        ffmpegPaths = await this.ffmpegDetector.forceStaticFFmpeg();
      } else {
        ffmpegPaths = await this.ffmpegDetector.detectFFmpegPaths(
          this.options.preferNativeFFmpeg
        );
      }

      // Configurar las rutas en fluent-ffmpeg
      if (ffmpegPaths.ffmpeg) {
        ffmpeg.setFfmpegPath(ffmpegPaths.ffmpeg);
      }
      if (ffmpegPaths.ffprobe) {
        ffmpeg.setFfprobePath(ffmpegPaths.ffprobe);
      }

      this.isFFmpegConfigured = true;
      
      console.log(`[Player] FFmpeg configured: ${ffmpegPaths.isNative ? 'Native' : 'Static'}`);
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
    staticAvailable: boolean;
    recommendation: string;
  } {
    return this.ffmpegDetector.getFFmpegAvailability();
  }

  public async play(filePath?: string): Promise<void> {
    if (this.isPlaying) {
      console.log('[Player] A track is already playing. Stop it first.');
      return;
    }

    // Configurar FFmpeg antes de reproducir
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
      this.play(); // Intenta con el siguiente en la cola
      return;
    }

    this.currentTrack = trackToPlay;
    this.isPlaying = true;
    this.isPaused = false;

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

      this.speaker.on('error', (err) => {
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
          console.error('[Player] FFmpeg error:', err.message);
          this.emit('error', err);
          this._cleanup();
        })
        .on('end', () => {
          console.log(`[Player] FFmpeg finished processing: ${this.currentTrack}`);
        });

      this.ffmpegCommand.pipe(this.speaker, { end: true });

    } catch (error) {
      console.error('[Player] Error starting playback:', error);
      this.emit('error', error);
      this._cleanup();
    }
  }

  public pause(): void {
    console.warn("[Player] Pause is not fully supported with ffmpeg. Use stop() instead.");
    this.stop();
  }

  public resume(): void {
    return this.pause();
  }
  
  public stop(): void {
    if (!this.isPlaying) return;
    
    console.log('[Player] Stopping playback...');
    this.emit('stop', { track: this.currentTrack });
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
    const finishedTrack = this.currentTrack;
    
    setTimeout(() => {
      if (finishedTrack === this.currentTrack) {
        console.log(`[Player] Track finished: ${finishedTrack}`);
        this._cleanup();
        this.emit('end', { track: finishedTrack });
        
        if (this.audioQueue.getNext()){
          setTimeout(() => this.play(), 500);
        }
      }
    }, 300);
  }

  private _cleanup(): void {
    console.log('[Player] Cleaning up resources...');
    
    this._stopProgressTracker();
    
    if (this.ffmpegCommand) {
      this.ffmpegCommand.kill('SIGKILL');
      this.ffmpegCommand = null;
    }
    
    if (this.speaker) {
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

  /**
   * Reconfigura FFmpeg con nuevas opciones
   */
  public async reconfigureFFmpeg(options: PlayerOptions): Promise<void> {
    this.options = { ...this.options, ...options };
    this.isFFmpegConfigured = false;
    this.ffmpegDetector.clearCache();
    await this.configureFFmpeg();
  }
}

export default Player;