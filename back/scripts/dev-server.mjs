import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const POLL_INTERVAL_MS = 1000;
const PRISMA_PATHS = [
  "prisma/schema.prisma",
  "prisma/migrations",
  "prisma.config.ts",
];
const executable = process.platform === "win32" ? "npx.cmd" : "npx";

let nestProcess = null;
let prismaFingerprint = "";
let refreshing = false;
let stopping = false;

async function collectFingerprint(targetPath) {
  const absolutePath = path.resolve(targetPath);
  const targetStat = await stat(absolutePath).catch(() => null);
  if (!targetStat) return `${targetPath}:missing`;
  if (!targetStat.isDirectory()) {
    return `${targetPath}:${targetStat.size}:${targetStat.mtimeMs}`;
  }

  const entries = await readdir(absolutePath, { withFileTypes: true });
  const fingerprints = await Promise.all(
    entries
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) =>
        collectFingerprint(path.join(targetPath, entry.name)),
      ),
  );
  return fingerprints.join("|");
}

async function readPrismaFingerprint() {
  const fingerprints = await Promise.all(
    PRISMA_PATHS.map(collectFingerprint),
  );
  return fingerprints.join("|");
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} failed: ${signal ?? code ?? "unknown"}`,
        ),
      );
    });
  });
}

async function refreshPrisma() {
  console.log("[dev-server] Updating Prisma Client and migrations");
  await run(executable, ["prisma", "generate"]);
  await run(executable, ["prisma", "migrate", "deploy"]);
}

function startNest() {
  console.log("[dev-server] Starting Nest watch mode");
  nestProcess = spawn(executable, ["nest", "start", "--watch"], {
    stdio: "inherit",
    detached: process.platform !== "win32",
  });
  nestProcess.once("exit", (code, signal) => {
    nestProcess = null;
    if (!stopping && !refreshing) {
      console.error(
        `[dev-server] Nest stopped unexpectedly: ${signal ?? code ?? "unknown"}`,
      );
      process.exitCode = code || 1;
    }
  });
}

async function stopNest() {
  const child = nestProcess;
  if (!child?.pid) return;

  const exited = new Promise((resolve) => child.once("exit", resolve));
  if (process.platform === "win32") {
    child.kill("SIGTERM");
  } else {
    process.kill(-child.pid, "SIGTERM");
  }
  await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
}

async function checkPrismaChanges() {
  if (refreshing || stopping) return;
  const nextFingerprint = await readPrismaFingerprint();
  if (nextFingerprint === prismaFingerprint) return;

  refreshing = true;
  console.log("[dev-server] Prisma files changed; restarting backend");
  try {
    await stopNest();
    await refreshPrisma();
    prismaFingerprint = await readPrismaFingerprint();
    startNest();
  } catch (error) {
    console.error("[dev-server] Prisma refresh failed", error);
  } finally {
    refreshing = false;
  }
}

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`[dev-server] Received ${signal}; stopping`);
  await stopNest();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await refreshPrisma();
prismaFingerprint = await readPrismaFingerprint();
startNest();
setInterval(() => void checkPrismaChanges(), POLL_INTERVAL_MS);
