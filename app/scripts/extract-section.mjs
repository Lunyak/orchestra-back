import fs from "fs";

const transcript =
  "C:/Users/Lunyak-Rdp/.cursor/projects/c-Users-Lunyak-Rdp-orchestra-back/agent-transcripts/131cec51-3cdd-44fd-bc4f-1fb807283cb0/131cec51-3cdd-44fd-bc4f-1fb807283cb0.jsonl";
const id = process.argv[2] || "layout-stage";
const lines = fs.readFileSync(transcript, "utf8").split("\n");
let best = "";
for (const line of lines) {
  if (!line.includes(id)) continue;
  try {
    const j = JSON.parse(line);
    for (const c of j.message?.content || []) {
      for (const k of ["contents", "new_string"]) {
        const s = c.input?.[k];
        if (typeof s === "string" && s.includes(id) && s.length > best.length) {
          best = s;
        }
      }
    }
  } catch {
    // ignore
  }
}
const re = new RegExp(
  `<TheaterCollapsibleSection[\\s\\S]*?sectionId="${id}"[\\s\\S]*?</TheaterCollapsibleSection>`,
);
const m = best.match(re);
console.log(m ? m[0] : "NOT FOUND len=" + best.length);
