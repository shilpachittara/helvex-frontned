#!/usr/bin/env node
/**
 * Helvex MainNet-branded demo video recorder (Playwright).
 *
 * Required env (no personal credentials in source):
 *   DEMO_USER_EMAIL / DEMO_SOLVER_EMAIL
 *   DEMO_VIDEO_PASSWORD (or DEMO_USER_PASSWORD / DEMO_SOLVER_PASSWORD)
 * Optional:
 *   DEMO_BASE_URL (default http://localhost:3001)
 *   DEMO_PAIR (default CC_USDCX)
 *   DEMO_SELL_AMOUNT (default 86 — ~$10 min notional at current CC price)
 *
 * Demo scenes: Account → Create → Solve (no Connect Wallet).
 *   USER  — Loop-linked (e.g. shilpachittara08@gmail.com): account + create.
 *   SOLVER — fill only (e.g. shilpa@dreamcapital.tech). Never open solver Account.
 *
 * Output: docs/demo/helvex-mainnet-demo.mp4 (also copied to helvex-testnet-demo.mp4)
 *
 * Requires NEXT_PUBLIC_DEMO_MODE=true on the frontend (masks emails/party IDs, MainNet badge).
 */
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(__dirname, "..");
const repoRoot = resolve(frontendRoot, "..");
const outDir = join(repoRoot, "docs", "demo");
// Use a fresh temp dir each run — avoids EPERM on leftover Playwright .webm under docs/.
const workDir = join(tmpdir(), `helvex-demo-${process.pid}-${Date.now()}`);
const videoRawDir = join(workDir, "raw");

const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3001";
const USER_EMAIL = (process.env.DEMO_USER_EMAIL ?? process.env.DEMO_MAKER_EMAIL ?? "").trim().toLowerCase();
const SOLVER_EMAIL = (process.env.DEMO_SOLVER_EMAIL ?? "").trim().toLowerCase();
const USER_PASSWORD =
  process.env.DEMO_USER_PASSWORD ??
  process.env.DEMO_MAKER_PASSWORD ??
  process.env.DEMO_VIDEO_PASSWORD ??
  "";
const SOLVER_PASSWORD =
  process.env.DEMO_SOLVER_PASSWORD ?? process.env.DEMO_VIDEO_PASSWORD ?? USER_PASSWORD;
// CC_USDCX: user sells CC; solver pays USDCx.
const PAIR = process.env.DEMO_PAIR ?? "CC_USDCX";
const SELL_AMOUNT = process.env.DEMO_SELL_AMOUNT ?? "86";
const TTL_LABEL = process.env.DEMO_TTL_LABEL ?? "15 minutes";

if (!USER_EMAIL || !SOLVER_EMAIL || !USER_PASSWORD || !SOLVER_PASSWORD) {
  console.error(
    "Set DEMO_USER_EMAIL, DEMO_SOLVER_EMAIL, and DEMO_VIDEO_PASSWORD (credentials are not hardcoded).",
  );
  process.exit(1);
}
if (USER_EMAIL === SOLVER_EMAIL) {
  console.error("DEMO_USER_EMAIL and DEMO_SOLVER_EMAIL must be different accounts.");
  process.exit(1);
}
// Solver account historically has no Loop wallet — refuse to use it as the Loop demo user.
if (USER_EMAIL.endsWith("@dreamcapital.tech")) {
  console.error(
    "DEMO_USER_EMAIL must be the Loop-linked user (e.g. shilpachittara08@gmail.com), not the solver (@dreamcapital.tech).",
  );
  process.exit(1);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Strip banners so the camera never catches a red alert. */
async function clearAlerts(page) {
  await page.evaluate(() => {
    document.querySelectorAll(".alert, .alert-error, .alert-success").forEach((el) => el.remove());
  });
}

/**
 * Account page Loop deposit/withdraw UI — only call while logged in as DEMO_USER_EMAIL
 * (Loop-linked). Never click prepare/submit (Loop popup isn't automatable and 400s on camera).
 */
async function showLoopFundOps(page) {
  await page.goto(`${BASE}/account`, { waitUntil: "networkidle" });
  await sleep(1500);
  await clearAlerts(page);

  const depositCard = page.locator(".fund-ops-card").filter({ hasText: "Deposit" }).first();
  await depositCard.waitFor({ state: "visible", timeout: 15_000 });
  const depositErr = page.locator(".alert-error, .alert.alert-error");
  if (await depositErr.isVisible().catch(() => false)) {
    const text = (await depositErr.textContent().catch(() => "")) || "";
    throw new Error(`Account page shows an error before Loop demo (wrong user / no Loop?): ${text}`);
  }

  await depositCard.scrollIntoViewIfNeeded();
  await sleep(800);
  await page.fill("#dep-amount", "5");
  await clearAlerts(page);
  await sleep(1500);

  await showCaption(
    page,
    "Deposit",
    "Deposit from your wallet — Helvex credits the trading party",
    3200,
  );

  await page.goto(`${BASE}/account`, { waitUntil: "networkidle" });
  await sleep(1200);
  await clearAlerts(page);

  const withdrawCard = page.locator(".fund-ops-card").filter({ hasText: "Withdraw" }).first();
  await withdrawCard.scrollIntoViewIfNeeded();
  await sleep(800);
  const wdAmount = page.locator("#wd-amount");
  if (!(await wdAmount.isEnabled().catch(() => false))) {
    throw new Error(
      "Withdraw amount disabled — DEMO_USER_EMAIL must be the Loop-linked account (shilpachittara08@gmail.com).",
    );
  }
  await wdAmount.fill("1");
  await clearAlerts(page);
  await sleep(1500);

  await showCaption(
    page,
    "Loop withdraw",
    "Funds return to the linked Loop wallet after approval",
    3200,
  );
  await clearAlerts(page);
}

function captionHtml(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  html,body{margin:0;height:100%;font-family:ui-sans-serif,system-ui,sans-serif;background:#0b1220;color:#f8fafc}
  .wrap{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px;text-align:center}
  .brand{letter-spacing:.18em;text-transform:uppercase;color:#94a3b8;font-size:14px;margin-bottom:24px}
  h1{font-size:42px;margin:0 0 16px;font-weight:650}
  p{font-size:20px;line-height:1.5;max-width:720px;color:#cbd5e1;margin:0}
</style></head><body><div class="wrap">
  <div class="brand">Helvex · Canton MainNet</div>
  <h1>${title}</h1>
  <p>${body}</p>
</div></body></html>`;
}

async function showCaption(page, title, body, ms = 2800) {
  await page.setContent(captionHtml(title, body), { waitUntil: "domcontentloaded" });
  await sleep(ms);
}

/** Mask login field text on camera (values still submitted). */
async function maskLoginFields(page) {
  await page.addStyleTag({
    content: `
      #email, #password {
        -webkit-text-security: disc !important;
        color: transparent !important;
        text-shadow: 0 0 0 #94a3b8 !important;
      }
      .login-demo-hint { display: none !important; }
    `,
  });
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await maskLoginFields(page);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await sleep(600);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30_000 });
  await sleep(1500);
}

async function signOut(page) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.locator(".user-menu").waitFor({ state: "visible", timeout: 15_000 });
  await page.locator(".user-menu").hover();
  await sleep(400);
  const signOutBtn = page.getByRole("button", { name: /sign out/i });
  if (!(await signOutBtn.isVisible().catch(() => false))) {
    await page.locator(".user-menu-trigger").click();
    await sleep(300);
  }
  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL(/\/login/, { timeout: 20_000 });
  await sleep(800);
}

async function waitForOpenIntent(page, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await page.evaluate(async () => {
      const res = await fetch("/api/v1/solver/intents", { credentials: "include" });
      if (!res.ok) return false;
      const data = await res.json();
      const intents = data.intents ?? data ?? [];
      return Array.isArray(intents) && intents.some((i) => i.status === "LOCKED" || !i.status);
    });
    if (ok) return true;
    await sleep(2000);
  }
  return false;
}

/** Poll maker intents until the given intent reaches SETTLED (fail fast on FAILED). */
async function waitForSettledIntent(makerParty, intentId, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch("http://127.0.0.1:8080/v1/intents", {
      headers: { "x-account-party": makerParty },
    });
    const data = await res.json().catch(() => ({}));
    const intent = (data.intents ?? []).find((i) => i.intentId === intentId);
    if (intent) {
      if (intent.status === "SETTLED") return intent;
      if (intent.status === "FAILED") {
        throw new Error(
          `Settlement FAILED for ${intentId}: ${intent.failureReason ?? "unknown reason"}`,
        );
      }
      console.log(`Intent ${intentId.slice(0, 8)}… status=${intent.status}`);
    }
    await sleep(2000);
  }
  throw new Error(`Timed out waiting for SETTLED on ${intentId}`);
}

async function cancelOpenLockedIntents(page) {
  const lockedIds = await page.evaluate(async () => {
    const res = await fetch("/api/v1/intents", { credentials: "include" });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.intents ?? [])
      .filter((i) => i.status === "LOCKED")
      .map((i) => i.intentId);
  });
  for (const id of lockedIds) {
    console.log("Preflight cancel LOCKED", id.slice(0, 8));
    await page.evaluate(async (intentId) => {
      await fetch(`/api/v1/intents/${intentId}/cancel`, {
        method: "POST",
        credentials: "include",
      });
    }, id);
    await sleep(2000);
  }
}

async function waitForUserIntentVisible(page, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await page
      .locator(".intent-list .status-badge, .intent-row, .intent-card")
      .first()
      .textContent()
      .catch(() => null);
    if (status && /locked|open|active/i.test(status)) return true;
    // Also accept any non-empty intent list with LOCKED label anywhere
    const body = await page.locator("body").innerText();
    if (/\bLOCKED\b/i.test(body) && !/no intents|empty/i.test(body.split("\n").slice(0, 40).join(" "))) {
      // Prefer explicit LOCKED in intents panel
      if (await page.locator("text=/LOCKED/i").count()) return true;
    }
    await sleep(2000);
    await page.reload({ waitUntil: "networkidle" }).catch(() => {});
  }
  return false;
}

async function run() {
  mkdirSync(outDir, { recursive: true });
  mkdirSync(videoRawDir, { recursive: true });

  const health = await fetch("http://127.0.0.1:8080/health").then((r) => r.json()).catch(() => null);
  if (!health || health.status !== "ok") {
    throw new Error("API not healthy on :8080 — run `pnpm all` in backend first");
  }
  const fe = await fetch(BASE).catch(() => null);
  if (!fe) throw new Error(`Frontend not reachable at ${BASE}`);

  // Preflight quote (ensures CC price + notional OK before recording)
  const quoteUrl = `http://127.0.0.1:8080/v1/quote?pair=${encodeURIComponent(PAIR)}&amount=${encodeURIComponent(SELL_AMOUNT)}`;
  const quoteRes = await fetch(quoteUrl);
  const quoteBody = await quoteRes.json().catch(() => ({}));
  if (!quoteRes.ok) {
    throw new Error(`Preflight quote failed for ${PAIR} ${SELL_AMOUNT}: ${JSON.stringify(quoteBody)}`);
  }
  console.log("Preflight quote OK", {
    pair: PAIR,
    sellAmount: SELL_AMOUNT,
    notionalUsd: quoteBody.notionalUsd,
    minReceive: quoteBody.minReceive,
  });
  if (quoteBody.withinLimits === false) {
    throw new Error(
      `Sell amount ${SELL_AMOUNT} out of notional limits (≈ $${quoteBody.notionalUsd}). Raise DEMO_SELL_AMOUNT.`,
    );
  }

  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: videoRawDir, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  let createdIntentId = null;
  let createdMakerParty = null;
  page.on("response", async (res) => {
    try {
      if (
        res.request().method() === "POST" &&
        res.url().includes("/v1/intents") &&
        !res.url().includes("/cancel") &&
        !res.url().includes("/fill") &&
        res.status() === 201
      ) {
        const body = await res.json();
        createdIntentId = body.intent?.intentId ?? body.intentId ?? null;
        createdMakerParty = body.intent?.makerParty ?? null;
        console.log("Captured created intent", createdIntentId?.slice(0, 8));
      }
    } catch {
      /* ignore parse errors */
    }
  });

  try {
    await showCaption(
      page,
      "Helvex walkthrough",
      "Account · Create intent · Solver fill — Canton MainNet",
      3200,
    );

    // —— User login (credentials masked on-screen; not a demo scene) ——
    await login(page, USER_EMAIL, USER_PASSWORD);
    // Free any leftover LOCKED sell from a prior failed recording
    await cancelOpenLockedIntents(page);

    // —— Account (USER / Loop-linked only — never solver) ——
    await showCaption(
      page,
      "1 · Account",
      "Balances, deposit, and withdraw",
      2200,
    );
    await showLoopFundOps(page);

    // —— Create intent ——
    await showCaption(page, "2 · Create intent", `Pair ${PAIR.replace(/_/g, " → ")} · expiry ${TTL_LABEL}`, 2200);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await sleep(2000);
    // Hide wallet-connect hints — demo is account / create / solve only.
    await page.evaluate(() => {
      document.querySelectorAll(".loop-wallet-banner").forEach((el) => el.remove());
    });

    const activate = page.getByRole("button", { name: /activate now/i });
    if (await activate.isVisible().catch(() => false)) {
      await activate.click();
      await sleep(5000);
    }

    await page.selectOption("#pair", PAIR).catch(async () => {
      const value = await page.locator("#pair option").first().getAttribute("value");
      if (value) await page.selectOption("#pair", value);
    });
    await sleep(800);
    await page.fill('input[aria-label="Sell amount"]', SELL_AMOUNT);
    await sleep(2000);

    // Wait for a live quote within limits (hint shows "Trade size ≈ $…")
    await page.waitForFunction(
      () => {
        const text = document.body.innerText;
        if (text.includes("Quote unavailable")) return false;
        if (text.includes("out of range")) return false;
        return /Trade size ≈ \$/.test(text);
      },
      { timeout: 45_000 },
    );
    await sleep(1000);

    const ttlSelect = page.locator("#ttl");
    if (await ttlSelect.count()) {
      const fifteen = await ttlSelect.locator('option:text-is("15 minutes")').count();
      if (fifteen) await ttlSelect.selectOption({ label: "15 minutes" });
      else {
        const byLabel = await ttlSelect.locator("option", { hasText: TTL_LABEL }).count();
        if (byLabel) await ttlSelect.selectOption({ label: TTL_LABEL });
      }
    }
    await sleep(1000);

    // Clear any leftover banners before submit so the camera stays clean.
    await clearAlerts(page);
    const submitBtn = page.getByRole("button", { name: /submit signed intent/i });
    await submitBtn.click();

    // Prefer success; if an error flashes, fail the recording (do not keep going).
    const submitOutcome = await Promise.race([
      page.locator(".alert-success, .alert.alert-success").waitFor({ timeout: 90_000 }).then(() => "ok"),
      page.locator(".alert-error, .alert.alert-error").waitFor({ timeout: 90_000 }).then(() => "err"),
    ]).catch(() => "timeout");

    if (submitOutcome !== "ok") {
      const errText = await page.locator(".alert-error, .alert.alert-error").textContent().catch(() => "");
      throw new Error(`Intent submit failed (${submitOutcome}): ${errText || "no success alert"}`);
    }
    // Hide success toast after a beat so later frames stay clean.
    await sleep(1800);
    await clearAlerts(page);

    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      document.querySelectorAll(".loop-wallet-banner").forEach((el) => el.remove());
    });
    const lockedVisible = await waitForUserIntentVisible(page, 60_000);
    if (!lockedVisible) {
      throw new Error("Locked intent not visible on user desk after submit");
    }
    await page.locator(".intent-list, text=/LOCKED/i").first().scrollIntoViewIfNeeded().catch(() => {});
    await sleep(3000);

    // —— Solver ——
    await signOut(page);
    await showCaption(page, "3 · Solve", "Solver fills the open intent", 2200);
    await login(page, SOLVER_EMAIL, SOLVER_PASSWORD);
    await page.goto(`${BASE}/solver`, { waitUntil: "networkidle" });

    const open = await waitForOpenIntent(page, 90_000);
    if (!open) {
      throw new Error("No LOCKED intent in solver queue after wait — create/lock path failed");
    }
    await page.reload({ waitUntil: "networkidle" });
    await sleep(1500);

    const fillBtn = page.getByRole("button", { name: /accept fill|^fill$/i }).first();
    await fillBtn.waitFor({ state: "visible", timeout: 30_000 });
    await fillBtn.click();

    if (!createdIntentId || !createdMakerParty) {
      throw new Error("Missing captured intent id/maker party after create — cannot verify settlement");
    }
    // Fill is MATCHED immediately; worker settles async. Require SETTLED (not merely empty queue).
    const settledIntent = await waitForSettledIntent(createdMakerParty, createdIntentId, 150_000);
    console.log("Settlement OK", {
      intentId: settledIntent.intentId.slice(0, 8),
      status: settledIntent.status,
      ledgerSettleTx: settledIntent.ledgerSettleTx,
    });
    await sleep(2500);

    await clearAlerts(page);
    await page.locator(".solver-queue, .empty-state, .alert").first().scrollIntoViewIfNeeded();
    await sleep(2500);

    await showCaption(
      page,
      "Thanks for watching",
      "Helvex · Account · Create · Solve on Canton Network",
      3200,
    );
  } finally {
    await context.close();
    await browser.close();
  }

  const rawFiles = readdirSync(videoRawDir).filter((f) => f.endsWith(".webm"));
  if (rawFiles.length === 0) throw new Error("No Playwright video produced");
  const webm = join(videoRawDir, rawFiles[0]);
  const mp4 = join(outDir, "helvex-mainnet-demo.mp4");
  const mp4Alias = join(outDir, "helvex-testnet-demo.mp4");

  const ff = spawnSync(
    "ffmpeg",
    ["-y", "-i", webm, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4],
    { encoding: "utf8" },
  );
  if (ff.status !== 0) {
    console.error(ff.stderr);
    const fallback = join(outDir, "helvex-mainnet-demo.webm");
    copyFileSync(webm, fallback);
    console.log(`ffmpeg failed; wrote ${fallback}`);
    process.exit(1);
  }

  copyFileSync(mp4, mp4Alias);
  console.log(`Wrote ${mp4}`);
  writeFileSync(
    join(outDir, "last-run.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        user: "(masked)",
        solver: "(masked)",
        pair: PAIR,
        sellAmount: SELL_AMOUNT,
        output: mp4,
        loopAccount: "DEMO_USER_EMAIL (Loop-linked)",
      },
      null,
      2,
    ),
  );
  try {
    rmSync(workDir, { recursive: true, force: true });
  } catch {
    /* best-effort cleanup of temp recording dir */
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
