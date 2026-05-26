import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/features/theater");

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

for (const file of walk(root)) {
  let text = fs.readFileSync(file, "utf8");
  const next = text.replace(/(\w+)=tc\(("--[^"]+")\)/g, "$1={tc($2)}");
  if (next !== text) {
    fs.writeFileSync(file, next);
    console.log("fixed jsx:", path.relative(root, file));
  }
}
