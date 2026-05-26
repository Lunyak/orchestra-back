import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/features/theater/ui/controls");

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

const cyr = /[\u0400-\u04FF]/;
const suspicious = /[\uFFFD\u0080-\u009F]|пїЅ|ï¿½|Р[А-Яа-я]{2,}Р|╨|ï»¿/;

for (const file of walk(root)) {
  const text = fs.readFileSync(file, "utf8");
  if (suspicious.test(text)) {
    console.log("SUSPICIOUS:", path.relative(root, file));
    continue;
  }
  for (const attr of ["title=", "summary=", "label=", "placeholder="]) {
    const re = new RegExp(`${attr.replace("=", "")}="([^"]*)"`, "g");
    let m;
    while ((m = re.exec(text))) {
      const s = m[1];
      if (!s || /^[A-Za-z0-9+→←×.?…:;,!@#$%^&*()_\-\/\\|<>[\]{} ]+$/.test(s)) continue;
      if (!cyr.test(s) && /[^\x00-\x7F]/.test(s)) {
        console.log(path.relative(root, file), attr, JSON.stringify(s.slice(0, 40)));
      }
      if (/^[\x00-\x7F]*$/.test(s) && s.includes("?") && s.length > 3) {
        console.log(path.relative(root, file), attr, "latin-q", JSON.stringify(s));
      }
      // cp1251 misread as latin: lots of high bytes in string when only ? shown
      if (/^[\?\s]+$/.test(s) || /^[\x80-\xff]{4,}$/.test(s)) {
        console.log(path.relative(root, file), attr, "garbage", JSON.stringify(s.slice(0, 50)));
      }
    }
  }
  // lines with only ? and spaces in JSX text
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/>[^<]{2,40}</.test(line)) {
      const inner = line.match(/>([^<]+)</)?.[1]?.trim() ?? "";
      if (inner && !cyr.test(inner) && /[^\x00-\x7F]/.test(inner)) {
        console.log(path.relative(root, file), `L${i + 1}`, JSON.stringify(inner.slice(0, 50)));
      }
      if (/^[\?]{2,}$/.test(inner) || (inner.includes("") && inner.length > 2)) {
        console.log(path.relative(root, file), `L${i + 1} REPL`, JSON.stringify(inner.slice(0, 50)));
      }
    }
  }
}
