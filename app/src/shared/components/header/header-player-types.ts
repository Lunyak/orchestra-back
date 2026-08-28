export interface HeaderSound {
  id: number;
  title: string;
  file: string;
  icon?: string;
  /** URL иконки в MinIO — для отображения на вебе */
  iconRemoteKey?: string;
  iconRemoteUrl?: string;
  volume?: number;
  fadeMs?: number;
  loop?: boolean;
  /** If true, stopping the sound resets playback position to the start. */
  restartOnStop?: boolean;
  remoteUrl?: string;
  remoteKey?: string;
  /** Полный путь к файлу на диске (только локально, для загрузки на сервер) */
  filePath?: string;
}

export interface LoadedTrack {
  id: number;
  name: string;
  /** URL для воспроизведения (remoteUrl или локальный file) */
  url: string;
  /** Короткое имя файла для сохранения в сцене (как в плейлисте) */
  file?: string;
  icon?: string;
  iconRemoteKey?: string;
  iconRemoteUrl?: string;
  iconPreviewUrl?: string;
  volume: number;
  fadeMs: number;
  loop: boolean;
  restartOnStop: boolean;
  isPlaying: boolean;
  filePath?: string;
  remoteKey?: string;
  remoteUrl?: string;
}

export interface HeaderPlayerProps {
  projectName: string;
  sceneName: string;
  sounds?: HeaderSound[];
  /** Вызывается после успешного сохранения звуков в файл (чтобы пушнуть сцену на сервер) */
  onSoundsSaved?: () => void;
  /** Регистрирует внешний обработчик toggle звука по id (для кликов из show-script markdown). */
  onRegisterToggleHandler?: (handler: (soundId: number) => void) => void;
  /** Внешний режим настроек (например, общий с плеером). */
  settingsOpen?: boolean;
  /** Показать локальную кнопку настроек. По умолчанию true. */
  showSettingsToggle?: boolean;
}
