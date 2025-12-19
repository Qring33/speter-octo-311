const { chromium } = require("playwright-extra");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Paths
const accountsDir = path.join(__dirname, "neobux_accounts");
if (!fs.existsSync(accountsDir)) fs.mkdirSync(accountsDir);
const accountsFile = path.join(accountsDir, "neobux_accounts.json");

// Load existing accounts to check used emails and User-Agents
function loadExistingAccounts() {
  if (!fs.existsSync(accountsFile)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(accountsFile, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error("Error reading accounts file:", e.message);
    return [];
  }
}

const existingAccounts = loadExistingAccounts();

// Get used User-Agents
const usedUAs = existingAccounts.map(a => a.user_agent).filter(Boolean);

// Get used emails (to avoid reusing the same email)
const usedEmails = existingAccounts.map(a => a.email.toLowerCase()).filter(Boolean);

// Load valid + unused User-Agents
const allUAs = fs.readFileSync("user_agents.txt", "utf8")
  .split("\n")
  .map(l => l.trim())
  .filter(Boolean);

const validUAs = allUAs
  .filter(ua => {
    const clean = ua.replace(/^(Chrome|Edge|Firefox):/i, "").trim();
    return !/android/i.test(clean) && !/(Windows NT [56]\.|rv:1[11]\.|Firefox\/[1-4]\d|Chrome\/[1-4]\d)/i.test(clean);
  })
  .filter(ua => !usedUAs.includes(ua));

if (validUAs.length === 0) throw new Error("No unused valid User-Agent left!");

const selectedUA = validUAs[Math.floor(Math.random() * validUAs.length)];

// Load emails from email.txt
const allEmails = fs.readFileSync("email.txt", "utf8")
  .split("\n")
  .map(l => l.trim().toLowerCase())
  .filter(Boolean);

if (allEmails.length === 0) throw new Error("No emails found in email.txt!");

// Filter out already used emails
const availableEmails = allEmails.filter(email => !usedEmails.includes(email));

if (availableEmails.length === 0) {
  throw new Error("No unused emails left in email.txt! All emails have already been registered.");
}

// Randomly select one unused email
const email = availableEmails[Math.floor(Math.random() * availableEmails.length)];

// Generate random password (10 characters: letters + numbers)
function generatePassword(length = 10) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let pass = "";
  for (let i = 0; i < length; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}
const password = generatePassword();

console.log("Selected UA :", selectedUA);
console.log("Email       :", email);
console.log("Password    :", password);

const names = fs.readFileSync("name.txt", "utf8")
  .split("\n")
  .map(l => l.trim().toLowerCase())
  .filter(Boolean);

function getUsername() {
  const s = [...names].sort(() => Math.random() - 0.5);
  return (s[0] + s[1]).slice(0, 14);
}
function getBirthYear() { return String(1990 + Math.floor(Math.random() * 19)); }

// Robust CAPTCHA solver
async function solveCaptchaRobust(page, username, email, password, birthYear) {
  for (let i = 1; i <= 3; i++) {
    console.log(`Solving CAPTCHA (attempt ${i}/3)...`);
    await page.waitForSelector('td[align="right"] > img[width="91"][height="24"]', { timeout: 30000 });
    const src = await page.$eval('td[align="right"] > img[width="91"][height="24"]', el => el.src);

    let buffer;
    if (src.startsWith("data:image")) {
      buffer = Buffer.from(src.split(",")[1], "base64");
    } else {
      const url = src.startsWith("http") ? src : `https://www.neobux.com${src}`;
      buffer = await (await page.request.get(url)).body();
    }
    fs.writeFileSync("cap.png", buffer);

    const solved = execSync("node image_solver.js", { encoding: "utf8" }).trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 5);

    if (solved.length === 5) {
      await page.fill('input#codigo[name="codigo"]', solved);
      console.log("CAPTCHA solved:", solved);
      return solved;
    }

    console.log(`Bad CAPTCHA result: "${solved}" refreshing page (retry ${i + 1})`);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });

    // Re-fill everything after refresh
    await page.fill('input#nomedeutilizador', username);
    await page.fill('input[name="palavrapasse"]', password);
    await page.fill('input#palavrapasseconfirmacao', password);
    await page.fill('input#emailprincipal', email);
    await page.fill('input#anonascimento', birthYear);
    await page.check('input#tosagree');
    await page.check('input#ppagree');
  }
  throw new Error("CAPTCHA solver failed after 3 attempts");
}

function getOTP(email) {
  for (let i = 0; i < 3; i++) {
    try {
      console.log(`Fetching OTP (major attempt ${i + 1}/3) - launching outlook.js...`);

      // Modified: capture both stdout and stderr to show full logs from outlook.js
      const output = execSync(`node outlook.js "${email}"`, { 
        encoding: "utf8",
        stdio: ['inherit', 'pipe', 'pipe']  // inherit stdin, capture stdout + stderr
      });

      // Print everything outlook.js outputs (both stdout and stderr combined in this setup)
      console.log("=== outlook.js full output start ===");
      console.log(output);
      console.log("=== outlook.js full output end ===");

      const m = output.match(/3\/5 - OTP::\s*([A-Z0-9]{12})/i);
      if (m && m[1]) {
        console.log("OTP successfully received:", m[1]);
        return m[1].trim();
      } else {
        console.log("No OTP found in outlook.js output. Retrying with new outlook.js instance...");
      }
    } catch (e) {
      // When outlook.js throws an error or exits with non-zero code, show the error and any partial output
      console.log("outlook.js failed or crashed:");
      if (e.stdout) {
        console.log("=== Partial stdout from outlook.js ===");
        console.log(e.stdout.toString());
        console.log("=== End partial stdout ===");
      }
      if (e.stderr) {
        console.log("=== stderr from outlook.js ===");
        console.log(e.stderr.toString());
        console.log("=== End stderr ===");
      }
      console.log("Full error:", e.message);
    }
    // Wait before retrying a full new outlook.js run
    console.log("Waiting 15 seconds before next outlook.js attempt...");
    execSync("sleep 15");
  }
  throw new Error("Failed to receive OTP after 3 full attempts with outlook.js");
}

async function hasCaptchaError(page) {
  return await page.$('div.f_r > ul > li:has-text("Enter the text shown on the image.")') !== null;
}

(async () => {
  const browser = await chromium.launchPersistentContext("./browser_profile", {
    headless: false,
    locale: "en-US",
    userAgent: selectedUA,
    timezoneId: "America/New_York",
    viewport: null,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
      "--window-size=1280,900"
    ],
  });

  const page = await browser.newPage();
  await page.goto("https://www.neobux.com/m/r/", { waitUntil: "domcontentloaded", timeout: 60000 });

  const username = getUsername();
  const birthYear = getBirthYear();

  // Initial fill
  await page.fill('input#nomedeutilizador', username);
  await page.fill('input[name="palavrapasse"]', password);
  await page.fill('input#palavrapasseconfirmacao', password);
  await page.fill('input#emailprincipal', email);
  await page.fill('input#anonascimento', birthYear);
  await page.check('input#tosagree');
  await page.check('input#ppagree');

  // First step
  await solveCaptchaRobust(page, username, email, password, birthYear);
  await page.click('a.button.medium.green#botao_registo');

  let step1Ok = false;
  for (let a = 1; a <= 5; a++) {
    try {
      await page.waitForSelector('input#val_em_1[name="val_em_1"]', { state: "visible", timeout: 12000 });
      step1Ok = true;
      break;
    } catch {
      if (await hasCaptchaError(page)) {
        console.log("Wrong CAPTCHA (step 1) refreshing & retrying");
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.fill('input#nomedeutilizador', username);
        await page.fill('input[name="palavrapasse"]', password);
        await page.fill('input#palavrapasseconfirmacao', password);
        await page.fill('input#emailprincipal', email);
        await page.fill('input#anonascimento', birthYear);
        await page.check('input#tosagree');
        await page.check('input#ppagree');
        await solveCaptchaRobust(page, username, email, password, birthYear);
        await page.click('a.button.medium.green#botao_registo');
      }
    }
  }
  if (!step1Ok) throw new Error("Failed step 1");

  const otp = getOTP(email);
  await page.fill('input#val_em_1[name="val_em_1"]', otp);

  // Optional final CAPTCHA
  try {
    await page.waitForSelector('td[align="right"] > img[width="91"][height="24"]', { timeout: 8000 });
    await solveCaptchaRobust(page, username, email, password, birthYear);
  } catch {}

  // Final registration
  let success = false;
  for (let a = 1; a <= 5; a++) {
    await page.click('a.button.medium.blue#botao_registo');
    try {
      await page.waitForURL("https://www.neobux.com/m/r1/", { timeout: 12000 });
      success = true;
      console.log("REGISTRATION SUCCESS!");
      break;
    } catch {
      if (await hasCaptchaError(page)) {
        console.log("Final step failed refresh + re-enter OTP + new CAPTCHA");
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.fill('input#val_em_1[name="val_em_1"]', otp);
        await solveCaptchaRobust(page, username, email, password, birthYear);
      }
    }
  }
  if (!success) throw new Error("Registration failed");

  // Save new account (append safely)
  const newAcc = { user_agent: selectedUA, username, email, password };
  const updatedList = [...existingAccounts, newAcc];
  fs.writeFileSync(accountsFile, JSON.stringify(updatedList, null, 2));

  console.log("\nACCOUNT SAVED to neobux_accounts/neobux_accounts.json");
  console.log(`UA      : ${selectedUA}`);
  console.log(`Username: ${username}`);
  console.log(`Email   : ${email}`);
  console.log(`Password: ${password}\n`);

  console.log("Closing browser in 2s...");
  await page.waitForTimeout(2000);
  await browser.close();
  console.log("Done.");
})();