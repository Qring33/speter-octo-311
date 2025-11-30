const { chromium } = require("playwright-extra");
const fs = require("fs");
const path = require("path");
const { solveAudioCaptcha } = require("./solver.js");

// ============ UTIL RANDOM ============
function randomNum(min = 0, max = 9) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function randomDelay(min = 250, max = 1200) {
  return new Promise(res =>
    setTimeout(res, Math.floor(Math.random() * (max - min + 1) + min))
  );
}

function randomPassword(len = 12) {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "!@#$%^&*";
  const all = upper + lower + numbers + special;

  function pick(str) {
    return str[Math.floor(Math.random() * str.length)];
  }

  let pass = "";
  pass += pick(upper);
  pass += pick(lower);
  pass += pick(numbers);
  pass += pick(special);

  while (pass.length < len) {
    pass += pick(all);
  }

  return pass.split("").sort(() => Math.random() - 0.5).join("");
}

function loadNames() {
  return fs
    .readFileSync("./name.txt", "utf8")
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
}

function loadURL() {
  return fs.readFileSync("./url.txt", "utf8").trim();
}

async function saveAccount(username, password) {
  const dir = "./account";
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  const file = path.join(dir, "keystone_accounts.json");

  let data = [];
  if (fs.existsSync(file)) {
    data = JSON.parse(fs.readFileSync(file));
  }

  data.push({
    username,
    password,
    created_at: new Date().toISOString(),
  });

  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log("✔️ Account saved:", username);
}

// ================== HUMAN-LIKE INPUT ==================
async function humanType(page, selector, text) {
  await page.click(selector);
  for (const char of text) {
    await page.keyboard.type(char, { delay: randomNum(70, 180) });
  }
}

// small mouse movement
async function microMouse(page) {
  const x = Math.floor(Math.random() * 150 + 30);
  const y = Math.floor(Math.random() * 150 + 30);
  await page.mouse.move(x, y, { steps: 15 });
}

(async () => {
  // Browser fingerprint — stable and human
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  ];
  const ua = userAgents[Math.floor(Math.random() * userAgents.length)];

  // ================== PERSISTENT PROFILE ==================
  const browser = await chromium.launchPersistentContext("./browser_profile", {
    headless: false,
    locale: "en-US",
    userAgent: ua,
    timezoneId: "America/New_York",
    acceptDownloads: true,

    // GPU + touch = reduces automation flags
    args: [
      "--disable-blink-features=AutomationControlled",
      "--enable-webgl",
      "--use-gl=desktop",
      "--disable-dev-shm-usage",
      "--disable-setuid-sandbox",
      "--no-sandbox",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-infobars",
      "--window-size=1280,900"
    ],

    viewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();
  const SIGNUP_URL = loadURL();

  console.log("Opening signup page...");
  await page.goto(SIGNUP_URL, { waitUntil: "networkidle" });
  await randomDelay(2800, 6200);

  // simulate reading
  await page.mouse.wheel(0, randomNum(200, 450));
  await randomDelay(1500, 3200);

  // ===== USERNAME =====
  const rawNames = loadNames();
  const names = rawNames.filter(n => n.length >= 4);

  if (names.length < 2) {
    console.log("❌ ERROR: name.txt must contain at least 2 names with >= 4 characters.");
    process.exit(1);
  }

  const usernameSelector = 'input[placeholder="INLEO Username"]';
  await page.waitForSelector(usernameSelector);

  let username = "";
  let ok = false;

  while (!ok) {
    await microMouse(page);

    const baseName = names[Math.floor(Math.random() * names.length)];
    let extraName = names[Math.floor(Math.random() * names.length)];
    if (extraName === baseName) extraName = names[Math.floor(Math.random() * names.length)];

    const candidates = [
      baseName,
      `${baseName}${randomNum()}`,
      `${baseName}${extraName}`
    ];

    for (const candidate of candidates) {
      console.log("Trying:", candidate);
      
      await page.click(usernameSelector);
      await page.keyboard.press("Control+A");
      await page.keyboard.press("Backspace");

      await humanType(page, usernameSelector, candidate);
      await randomDelay(1200, 2400);

      const exists = await page.locator("text=This username already taken.").count();
      if (exists === 0) {
        username = candidate;
        ok = true;
        console.log("✔️ Username available:", username);
        break;
      }
    }
  }

  // ===== PASSWORD =====
  const password = randomPassword(12);
  console.log("Generated password:", password);
  
  await microMouse(page);
  await humanType(page, 'input[type="password"]', password);
  await saveAccount(username, password);

  await randomDelay(3000, 6500);

  // ===== CAPTCHA =====
  let captchaResult = "ERROR";
  try {
    captchaResult = await solveAudioCaptcha(page);
  } catch (e) {
    console.log("⚠️ Captcha FAILED:", e.message);
    process.exit(1);
  }

  if (captchaResult === "BLOCKED") {
    console.log("❌ STOP: Captcha blocked.");
    process.exit(1);
  }
  if (captchaResult !== "OK") {
    console.log("⚠️ Captcha not OK:", captchaResult);
    process.exit(1);
  }

  console.log("Captcha passed — Clicking Continue...");

  const continueXPath =
    "/html/body/div[1]/div[2]/div/div/div[1]/div/div[4]/button";

  await page.waitForSelector(`xpath=${continueXPath}`, { timeout: 30000 });
  await microMouse(page);
  await page.locator(`xpath=${continueXPath}`).click();

  await randomDelay(2800, 4500);

  // ===== KEYS JSON =====
  const keysSpanSelector =
    "div.whitespace-nowrap.overflow-auto.pr-4.scrollbar-none > span.leading-none.font-mono.text-sm.whitespace-nowrap";

  await page.waitForSelector(keysSpanSelector, { timeout: 20000 });
  const jsonKeys = await page.locator(keysSpanSelector).innerText();

  const hiveDir = "./hive_accounts";
  if (!fs.existsSync(hiveDir)) fs.mkdirSync(hiveDir);

  const hiveFile = path.join(hiveDir, `${username}.txt`);
  fs.writeFileSync(hiveFile, jsonKeys);
  console.log(`✔️ Account keys saved → ${hiveFile}`);

  // ===== DOWNLOAD KEYSTORE =====
  const downloadButtonSelector = 'button:has(svg.fa-key)';
  const downloadPath = path.resolve("./keystone_phase");
  if (!fs.existsSync(downloadPath)) fs.mkdirSync(downloadPath);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator(downloadButtonSelector).click(),
  ]);

  const suggestedName = `inleo-${username}.json`;
  await download.saveAs(path.join(downloadPath, suggestedName));
  console.log(`✔️ Keystore downloaded: ${suggestedName}`);

  // ===== NAVIGATION =====
  const firstNextSelector = 'button:has(span:text("Next"))';
  await page.waitForSelector(firstNextSelector, { timeout: 15000 });
  await page.locator(firstNextSelector).click();
  await randomDelay(800, 1800);

  const secondNextSelector =
    'div.flex.flex-1.items-stretch.gap-x-2.justify-end button:has(span:text("Next"))';

  await page.waitForSelector(secondNextSelector, { timeout: 30000, state: "visible" });
  await page.locator(secondNextSelector).click();
  await randomDelay(3500, 6000);

  await browser.close();
  console.log("🎉 Browser closed. Process complete.");
})();