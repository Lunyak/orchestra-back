import fs from "fs";

const p =
  "C:/Users/Lunyak-Rdp/.cursor/projects/c-Users-Lunyak-Rdp-orchestra-back/agent-transcripts/131cec51-3cdd-44fd-bc4f-1fb807283cb0/131cec51-3cdd-44fd-bc4f-1fb807283cb0.jsonl";
const lines = fs.readFileSync(p, "utf8").split("\n");
const j = JSON.parse(lines[13]);
let text = "";
for (const c of j.message?.content || []) {
  if (c.input?.contents) text = c.input.contents;
}

const idx = text.indexOf("value={layout.hallWidth}");
console.log("idx", idx);
const chunk = text.slice(idx - 800, idx + 3500);
fs.writeFileSync("hall-grid-legacy.txt", chunk, "utf8");
console.log("len", chunk.length);
