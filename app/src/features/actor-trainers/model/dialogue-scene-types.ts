import type { WordToken } from "./wordTokens";

export type DialogueSceneExercise = {
  id: string;
  lineId: string;
  sceneId: number;
  sceneTitle: string;
  role: string;
  text: string;
  target: WordToken[];
  shuffled: WordToken[];
};
