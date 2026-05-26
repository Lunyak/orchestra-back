import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/features/theater");
const importLine = 'import { tc } from "../../../shared/styles/theme-color";\n';

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

for (const file of walk(root)) {
  let text = fs.readFileSync(file, "utf8");
  if (!text.includes('"var(--')) continue;
  text = text.replace(/"var\((--[^)]+)\)"/g, 'tc("$1")');
  if (!text.includes('from "../../../shared/styles/theme-color"') && !text.includes('from "../../../../shared/styles/theme-color"')) {
    const depth = file.split(path.sep).slice(root.split(path.sep).length).length - 1;
    const rel = "../".repeat(depth + 2) + "shared/styles/theme-color";
    text = `import { tc } from "${rel}";\n` + text;
  }
  fs.writeFileSync(file, text);
  console.log("fixed:", path.relative(root, file));
}
