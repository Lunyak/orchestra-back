import assert from "node:assert/strict";
import test from "node:test";

const API_URL = String(
  process.env.PROJECTOR_E2E_API_URL ?? "http://213.226.126.196:3000",
).replace(/\/$/, "");
const EMAIL = String(process.env.PROJECTOR_E2E_EMAIL ?? "").trim();
const PASSWORD = String(process.env.PROJECTOR_E2E_PASSWORD ?? "").trim();

const VIDEO_BYTES = Buffer.from(
  "fake-orchestra-projector-e2e-video-bytes-for-range-and-play-url",
);

async function requestJson(path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { res, text, json };
}

test("CRITICAL: live API is reachable after deploy", async () => {
  const { res, text } = await requestJson("/");
  assert.equal(res.ok, true, `API ${API_URL}/ failed: ${res.status} ${text}`);
});

test("CRITICAL: live projector video upload, play-url and Range", async (t) => {
  if (!EMAIL || !PASSWORD) {
    t.skip("set PROJECTOR_E2E_EMAIL and PROJECTOR_E2E_PASSWORD to check real video load");
    return;
  }

  const login = await requestJson("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  assert.ok(login.res.ok, `login failed: ${login.res.status} ${login.text}`);
  const accessToken = String(login.json?.accessToken ?? "");
  assert.ok(accessToken, "login must return accessToken");

  const auth = { Authorization: `Bearer ${accessToken}` };
  const projects = await requestJson("/projects", { headers: auth });
  assert.equal(projects.res.ok, true, `projects failed: ${projects.res.status} ${projects.text}`);
  const projectId =
    String(process.env.PROJECTOR_E2E_PROJECT_ID ?? "").trim() ||
    String(projects.json?.[0]?.slug ?? projects.json?.[0]?.id ?? "");
  assert.ok(projectId, "need a project to upload projector video");

  const form = new FormData();
  form.set("projectId", projectId);
  form.set("type", "video");
  form.set(
    "file",
    new Blob([VIDEO_BYTES], { type: "video/mp4" }),
    "orchestra-e2e-projector.mp4",
  );

  const uploaded = await requestJson("/files/upload", {
    method: "POST",
    headers: auth,
    body: form,
  });
  assert.ok(
    uploaded.res.status === 200 || uploaded.res.status === 201,
    `upload failed: ${uploaded.res.status} ${uploaded.text}`,
  );
  const key = String(uploaded.json?.key ?? "");
  assert.ok(key, "upload must return storage key");

  const playUrlRes = await requestJson(`/files/play-url?key=${encodeURIComponent(key)}`, {
    headers: auth,
  });
  assert.equal(playUrlRes.res.ok, true, `play-url failed: ${playUrlRes.res.status} ${playUrlRes.text}`);
  const playUrl = String(playUrlRes.json?.url ?? "");
  assert.ok(playUrl, "play-url must return a streamable url");

  const playRes = await fetch(playUrl, {
    headers: { Range: "bytes=0-15" },
    signal: AbortSignal.timeout(20_000),
  });
  assert.ok(
    playRes.status === 200 || playRes.status === 206,
    `play url failed: ${playRes.status}`,
  );
  assert.match(String(playRes.headers.get("content-type") ?? ""), /video\/mp4|octet-stream/i);
  if (playRes.status === 206) {
    assert.match(String(playRes.headers.get("content-range") ?? ""), /bytes /);
  }
  const played = Buffer.from(await playRes.arrayBuffer());
  assert.ok(played.byteLength > 0, "play url must return video bytes");

  const streamRes = await fetch(`${API_URL}/files/stream?key=${encodeURIComponent(key)}`, {
    headers: { ...auth, Range: "bytes=0-15" },
    signal: AbortSignal.timeout(20_000),
  });
  assert.ok(
    streamRes.status === 200 || streamRes.status === 206,
    `stream failed: ${streamRes.status}`,
  );
  const streamed = Buffer.from(await streamRes.arrayBuffer());
  assert.ok(streamed.byteLength > 0, "stream must return video bytes");
});
