const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
const fs = require("fs");
const path = require("path");
const { solveAudioCaptcha } = require("./solver.js");

chromium.use(stealth);

// ===== UTIL RANDOM =====
function randomNum(min = 10, max = 99) {
  return Math.floor(Math.random() * (max - min + 1) + min);
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

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    locale: "en-US",
    timezoneId: "America/New_York",
    acceptDownloads: true, // enable downloads
  });
  const page = await context.newPage();

  const SIGNUP_URL = loadURL();

  console.log("Opening signup page...");
  await page.goto(SIGNUP_URL, { waitUntil: "networkidle" });

  // ===== WAIT 5 SECONDS BEFORE CONTINUING =====
  console.log("Waiting 5s before starting username/password flow...");
  await page.waitForTimeout(5000);

  // ===== USERNAME =====
  const names = loadNames();
  const usernameSelector = 'input[placeholder="INLEO Username"]';

  await page.waitForSelector(usernameSelector);

  let username = "";
  let ok = false;

  while (!ok) {
    const base = names[Math.floor(Math.random() * names.length)];
    username = `${base}${randomNum()}`;

    await page.fill(usernameSelector, username);
    await page.waitForTimeout(1800);

    const exists = await page.locator(
      "text=This username already taken."
    ).count();

    if (exists === 0) {
      ok = true;
      console.log("✔️ Username available:", username);
    } else {
      console.log("⚠️ Username taken:", username);
    }
  }

  // ===== PASSWORD =====
  console.log("Generating password...");
  const password = randomPassword(12);
  console.log("Generated password:", password);

  await page.fill('input[type="password"]', password);

  // Save account locally
  await saveAccount(username, password);

  console.log("Wait 5s before captcha...");
  await page.waitForTimeout(5000);

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

  console.log("Captcha passed ? Clicking Continue button...");

  // ===== CLICK CONTINUE BUTTON =====
  const continueXPath =
    "/html/body/div[1]/div[2]/div/div/div[1]/div/div[4]/button";

  await page.waitForSelector(`xpath=${continueXPath}`, { timeout: 30000 });
  await page.locator(`xpath=${continueXPath}`).click();

  console.log("✅ Continue button clicked. Waiting 5s...");
  await page.waitForTimeout(5000);

  // ===== EXTRACT KEYS JSON =====
  const keysSpanSelector =
    "div.whitespace-nowrap.overflow-auto.pr-4.scrollbar-none > span.leading-none.font-mono.text-sm.whitespace-nowrap";

  await page.waitForSelector(keysSpanSelector, { timeout: 20000 });
  const jsonKeys = await page.locator(keysSpanSelector).innerText();

  const hiveDir = "./hive_accounts";
  if (!fs.existsSync(hiveDir)) fs.mkdirSync(hiveDir);

  const hiveFile = path.join(hiveDir, `${username}.txt`);
  fs.writeFileSync(hiveFile, jsonKeys);
  console.log(`✔️ Account keys saved → ${hiveFile}`);

  // ===== CLICK DOWNLOAD KEYSTORE BUTTON =====
  const downloadButtonSelector =
    'button:has(svg.fa-key)';

  const downloadPath = path.resolve("./keystone_phase");
  if (!fs.existsSync(downloadPath)) fs.mkdirSync(downloadPath);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator(downloadButtonSelector).click(),
  ]);

  const suggestedName = `inleo-${username}.json`;
  await download.saveAs(path.join(downloadPath, suggestedName));
  console.log(`✔️ Keystore file downloaded: ${suggestedName}`);

  // ===== CLICK FIRST NEXT BUTTON =====
  const firstNextSelector =
    'button:has(span:text("Next"))';
  await page.waitForSelector(firstNextSelector, { timeout: 15000 });
  await page.locator(firstNextSelector).click();
  console.log("✅ First Next button clicked.");
  await page.waitForTimeout(1000);

  // ===== CLICK SECOND NEXT BUTTON =====
  const secondNextSelector =
    'div.flex.flex-1.items-stretch.gap-x-2.justify-end button:has(span:text("Next"))';

  await page.waitForSelector(secondNextSelector, { timeout: 30000, state: "visible" });
  await page.locator(secondNextSelector).click();
  console.log("✅ Second Next button clicked. Waiting 5s before closing...");

  await page.waitForTimeout(5000);
  await browser.close();
  console.log("🎉 Browser closed. Process complete.");
})();