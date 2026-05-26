import fs from "fs";

const p =
  "C:/Users/Lunyak-Rdp/.cursor/projects/c-Users-Lunyak-Rdp-orchestra-back/agent-transcripts/131cec51-3cdd-44fd-bc4f-1fb807283cb0/131cec51-3cdd-44fd-bc4f-1fb807283cb0.jsonl";
const text = fs.readFileSync(p, "utf8");

for (const needle of [
  'sectionId="layout-view"',
  'sectionId="layout-seats"',
  'sectionId="layout-hall-size"',
  'sectionId="layout-stage-grid"',
  'sectionId="layout-walls-3d"',
  'sectionId="layout-stage"',
]) {
  const idx = text.indexOf(needle);
  console.log(needle, idx >= 0 ? "found" : "missing");
  if (idx >= 0) {
    console.log(text.slice(idx, idx + 500).replace(/\\n/g, "\n"));
    console.log("---");
  }
}

// Find largest Write to TheaterControls that contains layout-view
const lines = text.split("\n");
let best = { len: 0, line: 0 };
for (let i = 0; i < lines.length; i++) {
  if (!lines[i].includes("TheaterControls")) continue;
  try {
    const j = JSON.parse(lines[i]);
    for (const c of j.message?.content || []) {
      const contents = c.input?.contents || c.input?.new_string || "";
      if (
        typeof contents === "string" &&
        contents.includes("layout-view") &&
        contents.length > best.len
      ) {
        best = { len: contents.length, line: i + 1, contents, path: c.input?.path };
      }
    }
  } catch {
    // ignore
  }
}
console.log("best chunk", best.line, best.len, best.path);
if (best.contents) {
  fs.writeFileSync(
    new URL("./_layout-chunk.txt", import.meta.url),
    best.contents,
  );
}
