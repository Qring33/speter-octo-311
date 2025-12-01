const { chromium } = require("playwright-extra");
const fs = require("fs");
const path = require("path");
const https = require("https");

// --- Load URL ---
function loadURL() {
  return fs.readFileSync("./url.txt", "utf8").trim();
}

// --- Get random Hive account and delete file to avoid duplicates ---
function getRandomAccount() {
  const folderPath = path.join(__dirname, "hive_accounts");
  const files = fs.readdirSync(folderPath).filter(f => f.endsWith(".txt"));
  if (files.length === 0) throw new Error("No account files found");

  const file = files[Math.floor(Math.random() * files.length)];
  const filePath = path.join(folderPath, file);

  const content = fs.readFileSync(filePath, "utf8");
  const username = path.basename(file, ".txt");

  let postingKey;
  try {
    const data = JSON.parse(content);
    if (data.private && typeof data.private.posting === "string" && data.private.posting.startsWith("5")) {
      postingKey = data.private.posting;
    } else {
      throw new Error(`Posting key does not start with '5' in ${file}`);
    }
  } catch (err) {
    throw new Error(`Failed to parse ${file}: ${err.message}`);
  }

  // Delete the account file immediately after selection
  fs.unlinkSync(filePath);
  console.log(`Deleted account file: ${file}`);

  return { username, postingKey };
}

// --- Gemini API request using https ---
function generateGeminiContent(prompt) {
  const apiKey = fs.readFileSync("./gemini_api.txt", "utf8").trim();
  const postData = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }]
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": postData.length
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          const text = result.candidates[0]?.content?.parts[0]?.text?.trim();
          if (text) resolve(text);
          else reject("Empty response from Gemini");
        } catch (err) {
          reject("Failed to parse Gemini response: " + err);
        }
      });
    });

    req.on("error", (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

// --- Main async function ---
(async () => {
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  ];
  const ua = userAgents[Math.floor(Math.random() * userAgents.length)];

  const browser = await chromium.launchPersistentContext("./browser_profile", {
    headless: false,
    locale: "en-US",
    userAgent: ua,
    timezoneId: "America/New_York",
    acceptDownloads: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--enable-webgl=desktop",
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
  await page.goto(SIGNUP_URL, { waitUntil: "domcontentloaded" });

  // Wait for network idle to ensure page is fully loaded
  await page.waitForLoadState('networkidle');
  console.log("Page fully loaded, no more network activity.");

  // Select account and delete file immediately
  const { username, postingKey } = getRandomAccount();
  console.log(`Using account: ${username}`);
  console.log(`Posting key: ${postingKey}`);

  // Fill username & posting key
  await page.fill('input[placeholder="Enter your hive username"]', username);
  await page.fill('input[placeholder="Enter your private Posting Key"]', postingKey);

  // Wait 2 seconds before clicking Sign in with LeoAuth
  await page.waitForTimeout(2000);
  await page.click('button:has-text("Sign in with LeoAuth")');
  console.log("Submitted login form.");

  // Wait for OTP input and fill it
  const otpContainerSelector = 'div.relative.flex.flex-col.size-full.bg-pri';
  await page.waitForSelector(`${otpContainerSelector} input[data-input-otp="true"]`, { timeout: 10000 });
  const otpInputSelector = `${otpContainerSelector} input[data-input-otp="true"]`;
  await page.fill(otpInputSelector, "091350");
  console.log("OTP code filled: 091350");

  // Wait for the Slate editor
  const editorSelector = 'div.markdown-editor[contenteditable="true"]';
  await page.waitForSelector(editorSelector);

  // Clear existing content in the editor before typing
  await page.focus(editorSelector);
  await page.evaluate((selector) => {
    const editor = document.querySelector(selector);
    if (editor) editor.innerHTML = '';
  }, editorSelector);
  console.log("Slate editor cleared.");

  // Generate thread content from Gemini
  console.log("Generating thread content from Gemini...");
  const prompt = "Write a short, engaging 100-character thread for the InLeo platform to spark engagement.";
  let threadContent;
  try {
    threadContent = await generateGeminiContent(prompt);
    console.log("Thread content generated:", threadContent);
  } catch (err) {
    console.error("Failed to generate content:", err);
    threadContent = "Here's a fun engaging post for InLeo!"; // fallback
  }

  // Paste content into editor
  await page.focus(editorSelector);
  await page.keyboard.type(threadContent);
  console.log("Thread content pasted into editor.");

  // Click Thread button with 2s delay before
  await page.waitForTimeout(2000);
  const threadButtonSelector = 'button[title="CTRL + ENTER"]:has-text("Thread")';
  await page.click(threadButtonSelector);
  console.log("Thread button clicked. Process complete, browser remains open.");

  // --- NEW: Click sequence for 3 items with delays ---
  const clickPaths = [
    ['/html/body/div[1]/main/main/div[4]/div/div/div[1]/div[1]/div/div/div[2]/div[3]/div/div[2]',
     '/html/body/div[1]/main/main/div[4]/div/div/div[1]/div[1]/div/div/div[2]/div[3]/div/div[5]/div[2]/button[2]'],
    ['/html/body/div[1]/main/main/div[4]/div/div/div[1]/div[2]/div/div/div[2]/div[3]/div/div[2]',
     '/html/body/div[1]/main/main/div[4]/div/div/div[1]/div[2]/div/div/div[2]/div[3]/div/div[5]/div[2]/button[2]'],
    ['/html/body/div[1]/main/main/div[4]/div/div/div[1]/div[3]/div/div/div[2]/div[3]/div/div[2]',
     '/html/body/div[1]/main/main/div[4]/div/div/div[1]/div[3]/div/div/div[2]/div[3]/div/div[5]/div[2]/button[2]']
  ];

  for (let i = 0; i < clickPaths.length; i++) {
    const [divPath, buttonPath] = clickPaths[i];

    // Wait 2s before clicking the div
    await page.waitForTimeout(2000);
    await page.waitForSelector(`xpath=${divPath}`);
    await page.click(`xpath=${divPath}`);
    console.log(`Clicked div ${i + 1}`);

    // Wait 1s after clicking div
    await page.waitForTimeout(1000);

    // Wait 2s before clicking the button
    await page.waitForTimeout(2000);
    await page.waitForSelector(`xpath=${buttonPath}`);
    await page.click(`xpath=${buttonPath}`);
    console.log(`Clicked button ${i + 1}`);

    // Wait 1s after clicking button
    await page.waitForTimeout(1000);
  }

  console.log("All 3 items processed with new function.");

  // --- Close browser automatically ---
  await browser.close();
  console.log("Browser closed. Script completed.");
})();