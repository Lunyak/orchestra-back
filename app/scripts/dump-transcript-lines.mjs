import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const transcript =
  "C:/Users/Lunyak-Rdp/.cursor/projects/c-Users-Lunyak-Rdp-orchestra-back/agent-transcripts/131cec51-3cdd-44fd-bc4f-1fb807283cb0/131cec51-3cdd-44fd-bc4f-1fb807283cb0.jsonl";

const lines = fs.readFileSync(transcript, "utf8").split("\n");
for (const lineNo of [2002, 2255, 2011, 2005]) {
  const j = JSON.parse(lines[lineNo - 1]);
  const parts = [];
  for (const c of j.message?.content || []) {
    const s = c.input?.new_string || c.input?.contents;
    if (typeof s === "string") parts.push(s);
  }
  const out = parts.join("\n\n---\n\n");
  fs.writeFileSync(path.join(dir, `chunk-L${lineNo}.txt`), out);
  console.log("L" + lineNo, out.length);
}
