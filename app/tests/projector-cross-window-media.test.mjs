import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProjectorMediaLoadPlan,
  buildShowHoldCommand,
  buildShowVideoCommand,
  canResolveProjectorMedia,
  isWindowLocalMediaUrl,
  listProjectorMediaSourceSteps,
  sanitizeCrossWindowMediaSrc,
} from "../src/features/projector/model/projector-cross-window-media.ts";
import {
  normalizeProjectorTransitionMs,
  normalizeVideoPreviewTimeSec,
  resolveVideoPreviewSeekTime,
} from "../src/features/projector/model/projector-video-preview.ts";

test("blob: URLs are window-local and must not cross documents", () => {
  assert.equal(isWindowLocalMediaUrl("blob:http://localhost/abc"), true);
  assert.equal(isWindowLocalMediaUrl("BLOB:xyz"), true);
  assert.equal(isWindowLocalMediaUrl("project-images://hamlet/hold.png"), false);
  assert.equal(isWindowLocalMediaUrl("/local-project-media/hamlet/images/a.jpg"), false);
  assert.equal(isWindowLocalMediaUrl("https://cdn.example/hold.jpg"), false);
  assert.equal(isWindowLocalMediaUrl(null), false);
});

test("sanitizeCrossWindowMediaSrc drops blob: and keeps shared URLs", () => {
  assert.equal(sanitizeCrossWindowMediaSrc("blob:http://localhost/1"), null);
  assert.equal(
    sanitizeCrossWindowMediaSrc("project-images://hamlet/hold.png"),
    "project-images://hamlet/hold.png",
  );
  assert.equal(
    sanitizeCrossWindowMediaSrc("https://example.com/hold.jpg"),
    "https://example.com/hold.jpg",
  );
  assert.equal(sanitizeCrossWindowMediaSrc("  "), null);
});

test("CRITICAL: show-hold never ships main-window blob: to projector", () => {
  const cmd = buildShowHoldCommand({
    holdId: 2,
    projectSlug: "hamlet",
    src: "blob:http://127.0.0.1:5173/deadbeef",
    storageKey: "projects/hamlet/images/hold-2.jpg",
    fileName: "hold-2.jpg",
  });

  assert.equal(cmd.type, "show-hold");
  assert.equal(cmd.src, null, "blob: must be stripped for the projector window");
  assert.equal(cmd.storageKey, "projects/hamlet/images/hold-2.jpg");
  assert.equal(cmd.fileName, "hold-2.jpg");
  assert.equal(cmd.projectSlug, "hamlet");
  assert.equal(cmd.holdId, 2);
  assert.equal(canResolveProjectorMedia(buildProjectorMediaLoadPlan(cmd)), true);
});

test("CRITICAL: show-hold with only blob: and no key/file is unresolvable (fail loud)", () => {
  const cmd = buildShowHoldCommand({
    holdId: 1,
    projectSlug: "hamlet",
    src: "blob:http://localhost/only-in-main",
    storageKey: null,
    fileName: null,
  });

  assert.equal(cmd.src, null);
  assert.equal(
    canResolveProjectorMedia(buildProjectorMediaLoadPlan(cmd)),
    false,
    "projector must not pretend a blob-only cue is showable",
  );
});

test("CRITICAL: load plan prefers storageKey then local file then safe URL", () => {
  const plan = buildProjectorMediaLoadPlan({
    storageKey: "projects/hamlet/images/a.jpg",
    src: "blob:http://localhost/x",
    fileName: "folder/a.jpg",
    projectSlug: "hamlet",
  });

  assert.equal(plan.droppedWindowLocalSrc, true);
  assert.equal(plan.crossWindowSrc, null);
  assert.equal(plan.fileName, "a.jpg");

  const steps = listProjectorMediaSourceSteps(plan);
  assert.deepEqual(
    steps.map((step) => step.kind),
    ["storageKey", "localFile"],
  );
  assert.equal(steps[0].kind, "storageKey");
  if (steps[0].kind === "storageKey") {
    assert.equal(steps[0].storageKey, "projects/hamlet/images/a.jpg");
  }
  assert.equal(steps[1].kind, "localFile");
  if (steps[1].kind === "localFile") {
    assert.equal(steps[1].fileName, "a.jpg");
    assert.equal(steps[1].projectSlug, "hamlet");
  }
});

test("CRITICAL: desktop/dev local URLs survive cross-window sanitize", () => {
  const cmd = buildShowHoldCommand({
    holdId: 3,
    projectSlug: "hamlet",
    src: "project-images://hamlet/hold.png",
    storageKey: null,
    fileName: "hold.png",
  });

  assert.equal(cmd.src, "project-images://hamlet/hold.png");
  const steps = listProjectorMediaSourceSteps(buildProjectorMediaLoadPlan(cmd));
  assert.deepEqual(
    steps.map((step) => step.kind),
    ["localFile", "url"],
  );
});

test("CRITICAL: show-video strips blob for video and fallback hold", () => {
  const cmd = buildShowVideoCommand({
    videoId: 9,
    projectSlug: "hamlet",
    src: "blob:http://localhost/video",
    storageKey: "projects/hamlet/videos/v9.mp4",
    fileName: "v9.mp4",
    holdId: 1,
    holdSrc: "blob:http://localhost/hold",
    holdStorageKey: "projects/hamlet/images/h1.jpg",
    holdFileName: "h1.jpg",
    muted: false,
    volume: 1,
  });

  assert.equal(cmd.src, "");
  assert.equal(cmd.storageKey, "projects/hamlet/videos/v9.mp4");
  assert.equal(cmd.fileName, "v9.mp4");
  assert.equal(cmd.holdSrc, null);
  assert.equal(cmd.holdStorageKey, "projects/hamlet/images/h1.jpg");
  assert.equal(cmd.holdFileName, "h1.jpg");
  assert.equal(cmd.projectSlug, "hamlet");
});

test("folder-picker hold without storageKey still resolves via localFile step", () => {
  const plan = buildProjectorMediaLoadPlan({
    storageKey: null,
    src: "blob:http://localhost/main-only",
    fileName: "заставка.png",
    projectSlug: "hamlet",
  });

  assert.equal(plan.droppedWindowLocalSrc, true);
  assert.equal(canResolveProjectorMedia(plan), true);
  const steps = listProjectorMediaSourceSteps(plan);
  assert.equal(steps.length, 1);
  assert.equal(steps[0].kind, "localFile");
});

test("CRITICAL: preview frame time can skip black first frame", () => {
  assert.equal(normalizeVideoPreviewTimeSec(-1), null);
  assert.equal(normalizeVideoPreviewTimeSec(1.234), 1.23);
  assert.equal(normalizeVideoPreviewTimeSec(12, 10), 9.95);
  assert.equal(resolveVideoPreviewSeekTime(3.5, 60), 3.5);
  assert.equal(resolveVideoPreviewSeekTime(null, 10), 0.2);
  assert.equal(resolveVideoPreviewSeekTime(undefined), 0.25);
});

test("CRITICAL: projector step transition ms clamps and allows hard cut", () => {
  assert.equal(normalizeProjectorTransitionMs(0), 0);
  assert.equal(normalizeProjectorTransitionMs(-10), 0);
  assert.equal(normalizeProjectorTransitionMs(250), 250);
  assert.equal(normalizeProjectorTransitionMs(99999), 3000);
  const withFade = buildShowHoldCommand({
    holdId: 1,
    projectSlug: "hamlet",
    storageKey: "k",
    fadeMs: 400,
  });
  assert.equal(withFade.fadeMs, 400);
});
