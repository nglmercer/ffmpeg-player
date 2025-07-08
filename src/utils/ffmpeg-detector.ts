// src/utils/ffmpeg-detector.ts
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from 'ffprobe-static';

interface FFmpegPaths {
  ffmpeg: string | null;
  ffprobe: string | null;
  isNative: boolean;
}

export class FFmpegDetector {
  private static _instance: FFmpegDetector;
  private _cachedPaths: FFmpegPaths | null = null;

  private constructor() {}

  public static getInstance(): FFmpegDetector {
    if (!FFmpegDetector._instance) {
      FFmpegDetector._instance = new FFmpegDetector();
    }
    return FFmpegDetector._instance;
  }

  /**
   * Verifica si un comando existe en el sistema
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
   * Verifica si los binarios estáticos están disponibles
   */
  private staticBinariesExist(): { ffmpeg: boolean; ffprobe: boolean } {
    const ffmpegExists = ffmpegPath && existsSync(ffmpegPath);
    const ffprobeExists = ffprobePath && existsSync(ffprobePath.path);
    
    return {
      ffmpeg: !!ffmpegExists,
      ffprobe: !!ffprobeExists
    };
  }

  /**
   * Obtiene las rutas de FFmpeg y FFprobe, priorizando nativo sobre estático
   */
  public async detectFFmpegPaths(preferNative: boolean = true): Promise<FFmpegPaths> {
    if (this._cachedPaths) {
      return this._cachedPaths;
    }

    const nativeExists = {
      ffmpeg: this.commandExists('ffmpeg'),
      ffprobe: this.commandExists('ffprobe')
    };

    const staticExists = this.staticBinariesExist();

    let result: FFmpegPaths;

    if (preferNative && nativeExists.ffmpeg && nativeExists.ffprobe) {
      // Usar FFmpeg nativo si está disponible y se prefiere
      result = {
        ffmpeg: 'ffmpeg',
        ffprobe: 'ffprobe',
        isNative: true
      };
      console.log('[FFmpegDetector] Using native FFmpeg binaries');
    } else if (staticExists.ffmpeg && staticExists.ffprobe) {
      // Usar binarios estáticos como fallback
      result = {
        ffmpeg: ffmpegPath,
        ffprobe: ffprobePath.path,
        isNative: false
      };
      console.log('[FFmpegDetector] Using static FFmpeg binaries');
    } else if (nativeExists.ffmpeg && nativeExists.ffprobe) {
      // Si los estáticos no están disponibles, usar nativos
      result = {
        ffmpeg: 'ffmpeg',
        ffprobe: 'ffprobe',
        isNative: true
      };
      console.log('[FFmpegDetector] Static binaries not available, using native FFmpeg');
    } else {
      // No hay FFmpeg disponible
      throw new Error(
        'FFmpeg not found. Please install FFmpeg on your system or ensure ffmpeg-static package is properly installed.'
      );
    }

    this._cachedPaths = result;
    return result;
  }

  /**
   * Fuerza el uso de FFmpeg nativo
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
        '- Windows: Download from https://ffmpeg.org/download.html'
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
   * Fuerza el uso de binarios estáticos
   */
  public async forceStaticFFmpeg(): Promise<FFmpegPaths> {
    const staticExists = this.staticBinariesExist();

    if (!staticExists.ffmpeg || !staticExists.ffprobe) {
      throw new Error(
        'Static FFmpeg binaries not found. This may be due to unsupported architecture or platform. ' +
        'Consider using native FFmpeg installation instead.'
      );
    }

    this._cachedPaths = {
      ffmpeg: ffmpegPath,
      ffprobe: ffprobePath.path,
      isNative: false
    };

    console.log('[FFmpegDetector] Forced static FFmpeg usage');
    return this._cachedPaths;
  }

  /**
   * Obtiene información sobre la disponibilidad de FFmpeg
   */
  public getFFmpegAvailability(): {
    nativeAvailable: boolean;
    staticAvailable: boolean;
    recommendation: string;
  } {
    const nativeExists = {
      ffmpeg: this.commandExists('ffmpeg'),
      ffprobe: this.commandExists('ffprobe')
    };

    const staticExists = this.staticBinariesExist();

    const nativeAvailable = nativeExists.ffmpeg && nativeExists.ffprobe;
    const staticAvailable = staticExists.ffmpeg && staticExists.ffprobe;

    let recommendation: string;

    if (nativeAvailable && staticAvailable) {
      recommendation = 'Both native and static FFmpeg are available. Native is recommended for better compatibility.';
    } else if (nativeAvailable) {
      recommendation = 'Only native FFmpeg is available. This is the recommended option.';
    } else if (staticAvailable) {
      recommendation = 'Only static FFmpeg is available. Consider installing native FFmpeg for better compatibility.';
    } else {
      recommendation = 'No FFmpeg installation found. Please install FFmpeg on your system.';
    }

    return {
      nativeAvailable,
      staticAvailable,
      recommendation
    };
  }

  /**
   * Limpia la caché de rutas detectadas
   */
  public clearCache(): void {
    this._cachedPaths = null;
  }
}