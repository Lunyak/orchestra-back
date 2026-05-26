import fs from "fs";

const p =
  "C:/Users/Lunyak-Rdp/.cursor/projects/c-Users-Lunyak-Rdp-orchestra-back/agent-transcripts/131cec51-3cdd-44fd-bc4f-1fb807283cb0/131cec51-3cdd-44fd-bc4f-1fb807283cb0.jsonl";
const lines = fs.readFileSync(p, "utf8").split("\n");
const j = JSON.parse(lines[13]);
let text = "";
for (const c of j.message?.content || []) {
  if (c.input?.contents) text = c.input.contents;
}
for (const id of [
  "layout-hall-size",
  "layout-stage",
  "layout-doors",
  "layout-recesses",
  "layout-stage-grid",
]) {
  const re = new RegExp(
    `<TheaterCollapsibleSection[\\s\\S]*?sectionId="${id}"[\\s\\S]*?</TheaterCollapsibleSection>`,
  );
  const m = text.match(re);
  console.log(id, m ? m[0].length : "MISSING");
  if (m) fs.writeFileSync(`block-${id}.txt`, m[0], "utf8");
}
