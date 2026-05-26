import fs from "fs";
const p =
  "C:/Users/Lunyak-Rdp/.cursor/projects/c-Users-Lunyak-Rdp-orchestra-back/agent-transcripts/131cec51-3cdd-44fd-bc4f-1fb807283cb0/131cec51-3cdd-44fd-bc4f-1fb807283cb0.jsonl";
const needle = process.argv[2];
const lines = fs.readFileSync(p, "utf8").split("\n");
let best = { len: 0, line: 0 };
for (let i = 0; i < lines.length; i++) {
  if (!lines[i].includes(needle)) continue;
  try {
    const j = JSON.parse(lines[i]);
    for (const c of j.message?.content || []) {
      for (const k of ["new_string", "contents"]) {
        const s = c.input?.[k];
        if (typeof s === "string" && s.includes(needle) && s.length > best.len) {
          best = { len: s.length, line: i + 1 };
        }
      }
    }
  } catch {
    // ignore
  }
}
console.log(needle, best);
