import fs from "fs";
const transcript =
  "C:/Users/Lunyak-Rdp/.cursor/projects/c-Users-Lunyak-Rdp-orchestra-back/agent-transcripts/131cec51-3cdd-44fd-bc4f-1fb807283cb0/131cec51-3cdd-44fd-bc4f-1fb807283cb0.jsonl";
const lineNo = Number(process.argv[2]);
const lines = fs.readFileSync(transcript, "utf8").split("\n");
const j = JSON.parse(lines[lineNo - 1]);
const out = [];
for (const c of j.message?.content || []) {
  if (c.input?.new_string) out.push(c.input.new_string);
  if (c.input?.contents) out.push(c.input.contents);
}
fs.writeFileSync(process.argv[3], out.join("\n---\n"), "utf8");
console.log("wrote", process.argv[3], out.join("").length);
