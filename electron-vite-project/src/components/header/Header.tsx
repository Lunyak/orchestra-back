import React from "react";
import { HeaderPlayer, HeaderSound } from "./HeaderPlayer";
import "./style.css";

interface HeaderProps {
  projectName: string;
  sceneName: string;
  sounds?: HeaderSound[];
  showSounds?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  projectName,
  sceneName,
  sounds = [],
  showSounds = true,
}) => {
  return (
    <header className="header">
      {showSounds && (
        <HeaderPlayer
          projectName={projectName}
          sceneName={sceneName}
          sounds={sounds}
        />
      )}
    </header>
  );
};
