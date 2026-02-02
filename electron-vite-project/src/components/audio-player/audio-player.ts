export interface Sound {
  name: string;
  url: string;
}

export class AudioPlayer {
  private audioPlayer: HTMLAudioElement;
  private fileInput: HTMLInputElement;
  private loadButton: HTMLButtonElement;
  private soundList: HTMLDivElement;
  private loadedSounds: Sound[] = [];

  constructor() {
    this.audioPlayer = document.getElementById('audioPlayer') as HTMLAudioElement;
    this.fileInput = document.getElementById('fileInput') as HTMLInputElement;
    this.loadButton = document.getElementById('loadButton') as HTMLButtonElement;
    this.soundList = document.getElementById('soundList') as HTMLDivElement;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Открыть диалог выбора файлов при нажатии на кнопку
    this.loadButton.addEventListener('click', () => {
      this.fileInput.click();
    });

    // Обработка загрузки файлов
    this.fileInput.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        this.handleFiles(files);
      }
    });
  }

  private handleFiles(files: FileList): void {
    Array.from(files).forEach((file) => {
      if (file.type.startsWith('audio/')) {
        const url = URL.createObjectURL(file);
        const sound: Sound = {
          name: file.name,
          url: url,
        };
        this.loadedSounds.push(sound);
        this.addSoundButton(sound);
      }
    });
  }

  private addSoundButton(sound: Sound): void {
    const button = document.createElement('button');
    button.className = 'btn btn-sound';
    button.textContent = sound.name;
    button.title = `Воспроизвести: ${sound.name}`;
    
    button.addEventListener('click', () => {
      this.playSound(sound.url);
    });

    this.soundList.appendChild(button);
  }

  private playSound(url: string): void {
    this.audioPlayer.src = url;
    this.audioPlayer.play().catch((error) => {
      console.error('Ошибка воспроизведения:', error);
    });
  }

  public getLoadedSounds(): Sound[] {
    return this.loadedSounds;
  }
}
