import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = process.argv[2];
const bad = [];

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(ent.name)) check(p);
  }
}

function check(file) {
  const buf = fs.readFileSync(file);
  const text = buf.toString("utf8");
  const issues = [];
  if (text.includes("\uFFFD")) issues.push("U+FFFD");
  if (text.includes("пїЅ") || text.includes("ï¿½")) issues.push("mojibake");
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) issues.push("BOM");
  // cp1251 cyrillic stored wrong: common pattern is only ASCII + 0x80-0xFF runs in strings
  for (const m of text.matchAll(/title="([^"]*)"/g)) {
    const s = m[1];
    if (/[\u0400-\u04FF]/.test(s)) continue;
    if (/^[\x20-\x7e?]+$/.test(s) && s.includes("?")) issues.push(`title:${s}`);
    if (/^[^\x00-\x7F]+$/.test(s) && !/[\u0400-\u04FF]/.test(s) && s.length > 2)
      issues.push(`title-noncyr:${s.slice(0, 20)}`);
  }
  for (const m of text.matchAll(/summary="([^"]*)"/g)) {
    const s = m[1];
    if (s.includes("${")) continue;
    if (/[\u0400-\u04FF]/.test(s)) continue;
    if (s.length > 2 && !/^[\x20-\x7e]+$/.test(s)) issues.push(`summary:${s.slice(0, 25)}`);
  }
  if (issues.length) bad.push({ file: path.relative(root, file), issues });
}

walk(root);
for (const b of bad) console.log(b.file, b.issues.join(" | "));
