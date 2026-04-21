/** Global settings stored in Stream Deck for the OBS plugin */
export interface OBSGlobalSettings {
  obsHost?: string;
  obsPort?: number;
  obsPassword?: string;
}

/** Per-action settings for the Scene Switcher */
export interface SceneSettings {
  sceneName?: string;
}

/** Per-action settings for the Mic Mute action */
export interface MuteSettings {
  inputName?: string;
}

/** OBS recording status */
export interface RecordStatus {
  outputActive: boolean;
  outputPaused: boolean;
  outputTimecode: string;
  outputDuration: number;
  outputBytes: number;
}

/** OBS stream status */
export interface StreamStatus {
  outputActive: boolean;
  outputReconnecting: boolean;
  outputTimecode: string;
  outputDuration: number;
  outputCongestion: number;
  outputBytes: number;
  outputSkippedFrames: number;
  outputTotalFrames: number;
}
