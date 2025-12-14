const { chromium, firefox } = require("playwright-extra");  
const fs = require("fs");  
const path = require("path");  
const { execSync } = require("child_process");  
  
(async () => {  
  // Load accounts  
  const accountsPath = path.join(__dirname, "neobux_accounts", "neobux_accounts.json");  
  const accounts = JSON.parse(fs.readFileSync(accountsPath, "utf8"));  
  
  // ----------------------------------------  
  // SELECT ACCOUNT (supports argument)  
  // ----------------------------------------  
  const argUsername = process.argv[2];  
  let acc;  
  
  if (argUsername) {  
    acc = accounts.find(a => a.username === argUsername);  
  
    if (!acc) {  
      console.log("\n❌ ERROR: Username not found in accounts list:", argUsername);  
      process.exit(2); // signal "other failure"  
    }  
  
    console.log("\n🔐 Login.js using specified account:", acc.username);  
  } else {  
    acc = accounts[Math.floor(Math.random() * accounts.length)];  
    console.log("\n🎯 Login.js using random account:", acc.username);  
  }  
  
  console.log("user_agent:", `'${acc.user_agent}'`);  
  console.log("username:", `'${acc.username}'`);  
  console.log("password:", `'${acc.password}'`);  
  
  // ----------------------------------------  
  // FIREFOX PERSISTENT CONTEXT  
  // ----------------------------------------  
  const browser = await firefox.launchPersistentContext("./browser_profile", {  
    headless: false,  
    userAgent: acc.user_agent,  
    locale: "en-US",  
    timezoneId: "America/New_York",  
    viewport: null  
  });  
  
  let page = browser.pages()[0];  
  if (!page) {  
    page = await browser.newPage();  
  }  
  
  let loginSuccess = false;  
  let attempts = 0;  
  const maxAttempts = 15;  
  
  while (!loginSuccess && attempts < maxAttempts) {  
    attempts++;  
    console.log(`\n=== Login Attempt ${attempts} ===`);  
  
    try {  
      console.log("Opening login page...");  
      await page.goto("https://www.neobux.com/m/l/", { waitUntil: "domcontentloaded", timeout: 30000 });  
  
      console.log("Entering username...");  
      await page.fill("#Kf1", acc.username);  
      await page.fill("#Kf2", acc.password);  
  
      // CAPTCHA CHECK  
      const captchaImgSelector = 'td[align="right"] > img[width="91"][height="24"]';  
      const captchaExists = await page.$(captchaImgSelector);  
      let solved = "";  
  
      if (captchaExists) {  
        console.log("CAPTCHA detected.");  
        const src = await page.$eval(captchaImgSelector, el => el.src);  
        let imageBuffer;  
        if (src.startsWith("data:image")) {  
          imageBuffer = Buffer.from(src.split(",")[1], "base64");  
        } else {  
          const url = src.startsWith("http") ? src : `https://www.neobux.com${src}`;  
          const response = await page.request.get(url);  
          imageBuffer = await response.body();  
        }  
        fs.writeFileSync("cap.png", imageBuffer);  
        console.log("CAPTCHA image saved as cap.png");  
  
        console.log("Solving CAPTCHA...");  
        solved = execSync("node image_solver.js", { encoding: "utf8" })  
          .trim()  
          .toUpperCase()  
          .replace(/[^A-Z]/g, "")  
          .slice(0, 5);  
  
        console.log("Raw solved text:", solved);  
        if (solved.length !== 5) {  
          console.log(`Invalid captcha length (${solved.length} chars), retrying...`);  
          await page.reload({ waitUntil: "domcontentloaded" });  
          continue;  
        }  
      }  
  
      if (solved) {  
        await page.fill("#Kf3", "");  
        await page.type("#Kf3", solved, { delay: 120 });  
        console.log(`Entered CAPTCHA: ${solved}`);  
      }  
  
      console.log("Clicking login button...");  
      await page.click("#botao_login");  
  
      console.log("Waiting up to 12s for result...");  
      const waitForDashboard = page.waitForURL(url => url.href.includes("https://www.neobux.com/c/"), { timeout: 12000 }).then(() => "dashboard");  
      const waitForCaptchaError = page.waitForSelector('div.f_r span.t_vermelho:has-text("The verification code is incorrect")', { timeout: 12000 }).then(() => "captcha_error");  
      const waitForAccountError = page.waitForSelector('div.f_r span.t_vermelho:has-text("Error:")', { timeout: 12000 }).then(() => "account_not_found");  
  
      const result = await Promise.race([waitForDashboard, waitForCaptchaError, waitForAccountError]).catch(() => "timeout");  
  
      if (result === "dashboard") {  
        console.log("LOGIN SUCCESSFUL – Dashboard reached!");  
        loginSuccess = true;  
        break;  
      }  
  
      if (result === "account_not_found") {  
        console.log("Account doesn't exist.");  
        await browser.close();  
        process.exit(1); // signal "account does not exist" to main.js  
      }  
  
      if (result === "captcha_error") {  
        console.log("Wrong CAPTCHA error → retrying...");  
        await page.reload({ waitUntil: "domcontentloaded" });  
        continue;  
      }  
  
      console.log("Timeout → retrying...");  
      await page.reload({ waitUntil: "domcontentloaded" });  
    } catch (err) {  
      console.log("Exception:", err.message);  
      try {  
        await page.reload({ waitUntil: "domcontentloaded" });  
      } catch {}  
    }  
  }  
  
  if (!loginSuccess) {  
    console.log(`Failed after ${attempts} attempts. Closing browser.`);  
    await browser.close();  
    process.exit(2); // signal "other failure"  
  }  
  
  // -----------------------------  
  // SAVE COOKIES (REAL SESSION)  
  // -----------------------------  
  console.log("Saving cookies...");  
  const allCookies = await browser.cookies();  
  const cleanCookies = allCookies.map(c => {  
    delete c.sameParty;  
    delete c.priority;  
    delete c.sourceScheme;  
    delete c.sourcePort;  
    delete c.partitionKey;  
    return c;  
  });  
  
  const sessionFolder = path.join(__dirname, "session");  
  if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder);  
  const sessionPath = path.join(sessionFolder, `${acc.username}.json`);  
  fs.writeFileSync(sessionPath, JSON.stringify(cleanCookies, null, 2));  
  console.log(`Cookies saved → session/${acc.username}.json`);  
  
  console.log("Everything done! Closing browser in 2 seconds...");  
  await new Promise(r => setTimeout(r, 2000));  
  await browser.close();  
  process.exit(0); // signal success  
})();