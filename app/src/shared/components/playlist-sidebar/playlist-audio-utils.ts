export function tagPlaylistAudioPlayRequest(
  audio: HTMLAudioElement,
  requestId: number,
  expectedSrc: string,
) {
  try {
    audio.dataset.playRequestId = String(requestId);
    audio.dataset.playExpectedSrc = expectedSrc;
  } catch {
    // ignore
  }
}
