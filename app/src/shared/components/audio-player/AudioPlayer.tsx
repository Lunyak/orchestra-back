import React, { useRef, useState } from "react";
import "./style.css";

export interface Sound {
  name: string;
  url: string;
}

export const AudioPlayer: React.FC = () => {
  const [loadedSounds, setLoadedSounds] = useState<Sound[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileLoad = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newSounds: Sound[] = [];
      Array.from(files).forEach((file) => {
        if (file.type.startsWith("audio/")) {
          const url = URL.createObjectURL(file);
          newSounds.push({
            name: file.name,
            url: url,
          });
        }
      });
      setLoadedSounds((prev) => [...prev, ...newSounds]);
    }
  };

  const playSound = (url: string) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.src = url;
      audioPlayerRef.current.play().catch((error) => {
        console.error("Ошибка воспроизведения:", error);
      });
    }
  };

  return (
    <div className="audio-player-container">
      <audio ref={audioPlayerRef} controls />
      <div className="audio-controls">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          multiple
          className="native-file-input--hidden"
          onChange={handleFileChange}
        />
        <button className="btn btn-primary" onClick={handleFileLoad}>
          Загрузить звуки
        </button>
        <div className="sound-list">
          {loadedSounds.map((sound, index) => (
            <button
              key={index}
              className="btn btn-sound"
              onClick={() => playSound(sound.url)}
              title={`Воспроизвести: ${sound.name}`}
            >
              {sound.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
