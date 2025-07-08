// src/utils/ffmpeg-detector.ts
import { execSync } from 'child_process';
import { existsSync } from 'fs';
// Ya no importamos ffmpeg-static ni ffprobe-static

interface FFmpegPaths {
  ffmpeg: string | null;
  ffprobe: string | null;
  /**
   * Indica si la ruta detectada es para los binarios nativos del sistema
   * (en el PATH) o una ruta personalizada/incluida.
   */
  isNative: boolean;
}

export class FFmpegDetector {
  private static _instance: FFmpegDetector;
  private _cachedPaths: FFmpegPaths | null = null;
  private _customFfmpegPath: string | null = null;
  private _customFfprobePath: string | null = null;

  private constructor() {}

  public static getInstance(): FFmpegDetector {
    if (!FFmpegDetector._instance) {
      FFmpegDetector._instance = new FFmpegDetector();
    }
    return FFmpegDetector._instance;
  }

  /**
   * Establece rutas personalizadas para FFmpeg y FFprobe.
   * Si se establecen, estas rutas tendrán prioridad sobre la detección nativa.
   * @param ffmpegPath La ruta completa al binario ffmpeg.
   * @param ffprobePath La ruta completa al binario ffprobe.
   */
  public setCustomPaths(ffmpegPath: string | null, ffprobePath: string | null): void {
    this._customFfmpegPath = ffmpegPath;
    this._customFfprobePath = ffprobePath;
    this.clearCache(); // Limpiar caché para forzar nueva detección
    console.log(`[FFmpegDetector] Custom paths set: ffmpeg=${ffmpegPath}, ffprobe=${ffprobePath}`);
  }

  /**
   * Verifica si un comando existe en el sistema (en el PATH).
   */
  private commandExists(command: string): boolean {
    try {
      execSync(`which ${command}`, { stdio: 'ignore' });
      return true;
    } catch {
      try {
        // Fallback para Windows
        execSync(`where ${command}`, { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Verifica si las rutas personalizadas provistas son válidas y existen.
   */
  private customBinariesExist(): { ffmpeg: boolean; ffprobe: boolean } {
    const ffmpegExists = this._customFfmpegPath && existsSync(this._customFfmpegPath);
    const ffprobeExists = this._customFfprobePath && existsSync(this._customFfprobePath);
    
    return {
      ffmpeg: !!ffmpegExists,
      ffprobe: !!ffprobeExists
    };
  }

  /**
   * Obtiene las rutas de FFmpeg y FFprobe, priorizando rutas personalizadas sobre nativas.
   *
   * @returns Un objeto con las rutas de ffmpeg y ffprobe.
   * @throws Error si no se encuentra FFmpeg ni FFprobe.
   */
  public async detectFFmpegPaths(): Promise<FFmpegPaths> {
    if (this._cachedPaths) {
      return this._cachedPaths;
    }

    const customExists = this.customBinariesExist();
    const nativeExists = {
      ffmpeg: this.commandExists('ffmpeg'),
      ffprobe: this.commandExists('ffprobe')
    };

    let result: FFmpegPaths;

    if (customExists.ffmpeg && customExists.ffprobe) {
      // Usar binarios personalizados si están definidos y existen
      result = {
        ffmpeg: this._customFfmpegPath,
        ffprobe: this._customFfprobePath,
        isNative: false // No es nativo del PATH, es una ruta explícita
      };
      console.log('[FFmpegDetector] Using custom FFmpeg binaries');
    } else if (nativeExists.ffmpeg && nativeExists.ffprobe) {
      // Usar FFmpeg nativo como fallback si no hay personalizados o no son válidos
      result = {
        ffmpeg: 'ffmpeg',
        ffprobe: 'ffprobe',
        isNative: true
      };
      console.log('[FFmpegDetector] Using native FFmpeg binaries');
    } else {
      // No hay FFmpeg disponible
      throw new Error(
        'FFmpeg not found. Please ensure FFmpeg is installed on your system ' +
        'and accessible via PATH, or provide custom FFmpeg paths using `setCustomPaths()`.'
      );
    }

    this._cachedPaths = result;
    return result;
  }

  /**
   * Fuerza el uso de FFmpeg nativo (desde el PATH del sistema).
   */
  public async forceNativeFFmpeg(): Promise<FFmpegPaths> {
    const nativeExists = {
      ffmpeg: this.commandExists('ffmpeg'),
      ffprobe: this.commandExists('ffprobe')
    };

    if (!nativeExists.ffmpeg || !nativeExists.ffprobe) {
      throw new Error(
        'Native FFmpeg not found. Please install FFmpeg on your system using:\n' +
        '- Ubuntu/Debian: sudo apt-get install ffmpeg\n' +
        '- CentOS/RHEL: sudo yum install ffmpeg\n' +
        '- macOS: brew install ffmpeg\n' +
        '- Windows: Download from https://ffmpeg.org/download.html and add to PATH.'
      );
    }

    this._cachedPaths = {
      ffmpeg: 'ffmpeg',
      ffprobe: 'ffprobe',
      isNative: true
    };

    console.log('[FFmpegDetector] Forced native FFmpeg usage');
    return this._cachedPaths;
  }

  /**
   * Fuerza el uso de binarios FFmpeg personalizados (si se han configurado).
   */
  public async forceCustomFFmpeg(): Promise<FFmpegPaths> {
    const customExists = this.customBinariesExist();

    if (!customExists.ffmpeg || !customExists.ffprobe) {
      throw new Error(
        'Custom FFmpeg binaries not found or not set. Please use `setCustomPaths()` ' +
        'to provide valid FFmpeg and FFprobe executable paths first.'
      );
    }

    this._cachedPaths = {
      ffmpeg: this._customFfmpegPath,
      ffprobe: this._customFfprobePath,
      isNative: false
    };

    console.log('[FFmpegDetector] Forced custom FFmpeg usage');
    return this._cachedPaths;
  }

  /**
   * Obtiene información sobre la disponibilidad de FFmpeg.
   */
  public getFFmpegAvailability(): {
    nativeAvailable: boolean;
    customAvailable: boolean;
    recommendation: string;
  } {
    const nativeExists = {
      ffmpeg: this.commandExists('ffmpeg'),
      ffprobe: this.commandExists('ffprobe')
    };

    const customExists = this.customBinariesExist();

    const nativeAvailable = nativeExists.ffmpeg && nativeExists.ffprobe;
    const customAvailable = customExists.ffmpeg && customExists.ffprobe;

    let recommendation: string;

    if (customAvailable && nativeAvailable) {
      recommendation = 'Both custom and native FFmpeg are available. Custom paths will be prioritized.';
    } else if (customAvailable) {
      recommendation = 'Only custom FFmpeg is available. This will be used.';
    } else if (nativeAvailable) {
      recommendation = 'Only native FFmpeg is available. This is the recommended option if possible.';
    } else {
      recommendation = 'No FFmpeg installation found. Please install FFmpeg on your system or provide custom paths.';
    }

    return {
      nativeAvailable,
      customAvailable,
      recommendation
    };
  }

  /**
   * Limpia la caché de rutas detectadas.
   */
  public clearCache(): void {
    this._cachedPaths = null;
  }
}