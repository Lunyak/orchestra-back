require("dotenv").config();

const http = require("http");
const axios = require("axios");
const { fork } = require("node:child_process");
const path = require("node:path");

const HEALTH_PORT = Number(process.env.HEALTH_PORT) || 3001;

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      chunks.push(chunk);
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error("Payload too large"));
        try {
          req.destroy();
        } catch {}
      }
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function getRunnerSecret() {
  return process.env.INTERNAL_API_SECRET;
}

function assertRunnerSecret(req) {
  const secret = getRunnerSecret();
  const got = req.headers["x-internal-secret"] || req.headers["x-runner-secret"];
  if (!secret || String(got || "") !== String(secret)) {
    const e = new Error("unauthorized");
    e.statusCode = 401;
    throw e;
  }
}

function apiBaseUrl() {
  // inside docker network usually SERVER_URL=back:3000
  const base = process.env.BACK_INTERNAL_URL
    ? String(process.env.BACK_INTERNAL_URL)
    : `http://${process.env.SERVER_URL || "back:3000"}`;
  return base.replace(/\/+$/, "");
}

async function fetchIntegrations() {
  const secret = getRunnerSecret();
  if (!secret) throw new Error("BOT_RUNNER_SECRET is not configured");
  const { data } = await axios.get(`${apiBaseUrl()}/internal/telegram-bots/integrations`, {
    headers: { "X-Internal-Secret": secret },
    timeout: 15_000,
  });
  const items = Array.isArray(data?.items) ? data.items : [];
  return items;
}

function forkChild(integration) {
  const childPath = path.join(__dirname, "bot.js");
  const env = {
    ...process.env,
    RUNNER_CHILD: "1",
    BOT_TOKEN: String(integration.token || ""),
    TELEGRAM_BOT_INTEGRATION_ID: String(integration.id || ""),
    // per-bot settings (so legacy code keeps working)
    OWNER_TELEGRAM_ID: integration.ownerTelegramId ? String(integration.ownerTelegramId) : "",
    ADMIN_ID: integration.adminTelegramId ? String(integration.adminTelegramId) : "",
    GROUP_CHAT_ID: integration.groupChatId ? String(integration.groupChatId) : "",
    GROUP_CHAT_ID_ATTENTION: integration.attendanceThreadId
      ? String(integration.attendanceThreadId)
      : "",
    ANNOUNCEMENTS_THREAD_ID: integration.announcementsThreadId
      ? String(integration.announcementsThreadId)
      : "",
    // do not start its own http server / health port
    DISABLE_INTERNAL_HTTP: "1",
    HEALTH_PORT: "0",
  };

  const child = fork(childPath, [], {
    env,
    stdio: ["inherit", "inherit", "inherit", "ipc"],
  });
  child.__integrationId = String(integration.id || "");
  return child;
}

class BotRunner {
  constructor() {
    this.children = new Map(); // integrationId -> child
    this.pending = new Map(); // requestId -> { resolve, reject, timer }
  }

  start() {
    this._setupExitHandlers();
    this._startHttp();
    this._startRefreshLoop();
  }

  _setupExitHandlers() {
    const shutdown = () => {
      for (const child of this.children.values()) {
        try {
          child.kill("SIGTERM");
        } catch {}
      }
      process.exit(0);
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  }

  _startHttp() {
    http
      .createServer(async (req, res) => {
        try {
          const url = req.url || "/";
          const method = (req.method || "GET").toUpperCase();

          if (url === "/health" || url === "/") {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("ok");
            return;
          }

          if (method !== "POST") {
            res.writeHead(404);
            res.end();
            return;
          }

          if (
            url !== "/internal/publish-rehearsal" &&
            url !== "/internal/publish-director-session"
          ) {
            res.writeHead(404);
            res.end();
            return;
          }

          assertRunnerSecret(req);
          const body = await readJson(req);

          const integrationId =
            String(body?.botIntegrationId || "").trim() ||
            String(req.headers["x-telegram-bot-integration-id"] || "").trim();
          if (!integrationId) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                ok: false,
                error: "botIntegrationId is required",
              }),
            );
            return;
          }

          if (url === "/internal/publish-rehearsal") {
            const rehearsalId = String(body?.rehearsalId || "").trim();
            if (!rehearsalId) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ ok: false, error: "rehearsalId is required" }));
              return;
            }
            const out = await this.callChild(integrationId, {
              type: "publishRehearsal",
              rehearsalId,
            });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true, result: out || null }));
            return;
          }

          if (url === "/internal/publish-director-session") {
            const projectId = String(body?.projectId || "").trim();
            const sessionId = String(body?.sessionId || "").trim();
            if (!projectId || !sessionId) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  ok: false,
                  error: "projectId and sessionId are required",
                }),
              );
              return;
            }
            const out = await this.callChild(integrationId, {
              type: "publishDirectorSession",
              projectId,
              sessionId,
            });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true, result: out || null }));
            return;
          }

          res.writeHead(404);
          res.end();
        } catch (e) {
          const code = e?.statusCode || 500;
          res.writeHead(code, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: String(e?.message || e) }));
        }
      })
      .listen(HEALTH_PORT, "0.0.0.0", () => {
        console.log(`Runner HTTP: http://0.0.0.0:${HEALTH_PORT}/health`);
      });
  }

  async callChild(integrationId, payload) {
    const child = this.children.get(String(integrationId));
    if (!child) throw new Error(`bot integration is not running: ${integrationId}`);

    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("timeout"));
      }, 30_000);
      this.pending.set(requestId, { resolve, reject, timer });
      try {
        child.send({ requestId, ...payload });
      } catch (e) {
        clearTimeout(timer);
        this.pending.delete(requestId);
        reject(e);
      }
    });
  }

  _attachChild(child) {
    child.on("message", (msg) => {
      const requestId = msg?.requestId;
      if (!requestId) return;
      const p = this.pending.get(requestId);
      if (!p) return;
      clearTimeout(p.timer);
      this.pending.delete(requestId);
      if (msg.ok) p.resolve(msg.result);
      else p.reject(new Error(String(msg.error || "child_error")));
    });
    child.on("exit", (code, signal) => {
      const id = child.__integrationId;
      if (id && this.children.get(id) === child) {
        this.children.delete(id);
      }
      console.error("[runner] child exited", { id, code, signal });
    });
  }

  async refresh() {
    const list = await fetchIntegrations();
    const wanted = new Map();
    for (const it of list) {
      const id = String(it?.id || "").trim();
      const token = String(it?.token || "").trim();
      if (!id || !token) continue;
      wanted.set(id, it);
    }

    // stop removed
    for (const [id, child] of this.children.entries()) {
      if (!wanted.has(id)) {
        try {
          child.kill("SIGTERM");
        } catch {}
        this.children.delete(id);
      }
    }

    // start new
    for (const [id, it] of wanted.entries()) {
      if (this.children.has(id)) continue;
      const child = forkChild(it);
      this._attachChild(child);
      this.children.set(id, child);
      console.log("[runner] started bot", { id, username: it.botUsername || null });
    }
  }

  _startRefreshLoop() {
    const tick = async () => {
      try {
        await this.refresh();
      } catch (e) {
        console.error("[runner] refresh failed:", e?.message || e);
      }
    };
    tick();
    setInterval(tick, 30_000);
  }
}

new BotRunner().start();

