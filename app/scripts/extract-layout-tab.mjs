import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const p =
  "C:/Users/Lunyak-Rdp/.cursor/projects/c-Users-Lunyak-Rdp-orchestra-back/agent-transcripts/131cec51-3cdd-44fd-bc4f-1fb807283cb0/131cec51-3cdd-44fd-bc4f-1fb807283cb0.jsonl";
const lines = fs.readFileSync(p, "utf8").split("\n");
const j = JSON.parse(lines[2333]);
let text = "";
for (const c of j.message?.content || []) {
  if (c.input?.contents) text = c.input.contents;
  if (c.input?.new_string && c.input.new_string.length > text.length) text = c.input.new_string;
}
console.log("total", text.length);
for (const id of [
  "layout-template",
  "layout-view",
  "layout-stage-grid",
  "layout-seats",
  "layout-hall-size",
  "layout-walls-3d",
  "layout-stage",
  "layout-recesses",
  "layout-doors",
]) {
  const re = new RegExp(
    `<TheaterCollapsibleSection[\\s\\S]*?sectionId="${id}"[\\s\\S]*?</TheaterCollapsibleSection>`,
  );
  const m = text.match(re);
  console.log(id, m ? m[0].length : "MISSING");
  if (m) fs.writeFileSync(path.join(dir, `block-${id}.txt`), m[0], "utf8");
}
