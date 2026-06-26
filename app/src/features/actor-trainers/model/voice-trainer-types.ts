export type VoiceExercise = {
  id: string;
  lineId: string;
  sceneId: number;
  sceneTitle: string;
  role: string;
  textRaw: string;
  textForCheck: string;
  prev?: { lineId: string; role?: string; text: string } | null;
  nextPartner?: { lineId: string; role?: string; text: string } | null;
};
