/**
 * One-shot: dump non-empty Scene.markdown to .tools/tech-card-export/, then NULL those fields.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(backRoot, "..");
const outRoot = path.join(repoRoot, ".tools", "tech-card-export");

config({ path: path.join(backRoot, ".env") });
config({ path: path.join(repoRoot, ".env") });

function sanitizeDirName(value) {
  return String(value ?? "untitled")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "untitled";
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const scenes = await prisma.scene.findMany({
    where: {
      deletedAt: null,
      markdown: { not: null },
    },
    select: {
      id: true,
      sourceId: true,
      title: true,
      order: true,
      markdown: true,
      playbook: {
        select: {
          id: true,
          name: true,
          project: {
            select: { id: true, slug: true, name: true },
          },
        },
      },
    },
    orderBy: [{ playbookId: "asc" }, { order: "asc" }],
  });

  const nonEmpty = scenes.filter((s) => String(s.markdown ?? "").trim().length > 0);
  if (nonEmpty.length === 0) {
    console.log("No scenes with non-empty markdown. Nothing to export.");
    return;
  }

  mkdirSync(outRoot, { recursive: true });
  const exportedIds = [];
  const byProject = new Map();

  for (const scene of nonEmpty) {
    const project = scene.playbook.project;
    const projectDirName = sanitizeDirName(`${project.slug} — ${project.name}`);
    const playbookDirName = sanitizeDirName(scene.playbook.name);
    const dir = path.join(outRoot, projectDirName, playbookDirName);
    mkdirSync(dir, { recursive: true });

    const fileName = `${String(scene.order).padStart(3, "0")}-${sanitizeDirName(scene.title)}.md`;
    const filePath = path.join(dir, fileName);
    const header = [
      "---",
      `projectSlug: ${project.slug}`,
      `projectName: ${project.name}`,
      `projectId: ${project.id}`,
      `playbookName: ${scene.playbook.name}`,
      `playbookId: ${scene.playbook.id}`,
      `sceneId: ${scene.id}`,
      `sourceId: ${scene.sourceId}`,
      `title: ${scene.title}`,
      `order: ${scene.order}`,
      "---",
      "",
    ].join("\n");

    writeFileSync(filePath, `${header}${String(scene.markdown)}\n`, "utf8");
    exportedIds.push(scene.id);

    const key = `${project.slug} (${project.name})`;
    const list = byProject.get(key) ?? [];
    list.push(`${scene.order}. ${scene.title}`);
    byProject.set(key, list);
  }

  await prisma.scene.updateMany({
    where: { id: { in: exportedIds } },
    data: { markdown: null },
  });

  console.log(`Exported ${exportedIds.length} scene(s) → ${outRoot}`);
  for (const [project, titles] of byProject) {
    console.log(`\n${project}`);
    for (const title of titles) console.log(`  - ${title}`);
  }
  console.log("\nCleared Scene.markdown for exported rows.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
