import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProjectorMediaLoadPlan,
  buildShowVideoCommand,
  listProjectorMediaSourceSteps,
} from "../src/features/projector/model/projector-cross-window-media.ts";
import { resolveProjectorStorageKey } from "../src/features/projector/model/projector-storage-key.ts";

test("CRITICAL: launching a projector video keeps storageKey on show-video", () => {
  const storageKey = resolveProjectorStorageKey({
    remoteKey: "projects/hamlet/videos/v9.mp4",
  });
  assert.equal(storageKey, "projects/hamlet/videos/v9.mp4");

  const cmd = buildShowVideoCommand({
    videoId: 9,
    projectSlug: "hamlet",
    storageKey,
    fileName: "end.mp4",
    startTime: 4.5,
    paused: true,
  });

  assert.equal(cmd.type, "show-video");
  assert.equal(cmd.videoId, 9);
  assert.equal(cmd.storageKey, "projects/hamlet/videos/v9.mp4");
  assert.equal(cmd.fileName, "end.mp4");
  assert.equal(cmd.startTime, 4.5);
  assert.equal(cmd.paused, true);
  assert.equal(cmd.src, "");
});

test("CRITICAL: launched video must stream via play-url before blob download", () => {
  const cmd = buildShowVideoCommand({
    videoId: 9,
    projectSlug: "hamlet",
    storageKey: "projects/hamlet/videos/v9.mp4",
    fileName: "end.mp4",
  });
  const steps = listProjectorMediaSourceSteps(buildProjectorMediaLoadPlan(cmd), "video");
  assert.equal(steps[0]?.kind, "playUrl");
  if (steps[0]?.kind === "playUrl") {
    assert.equal(steps[0].storageKey, "projects/hamlet/videos/v9.mp4");
  }
});
