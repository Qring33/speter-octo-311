const fs = require("fs");
const path = require("path");
const { SpeechClient } = require("@google-cloud/speech");

class SimpleRecaptchaSolver {
    constructor(page) {
        this.page = page;
    }

    // === iframe detection ===
    findAnchorIframe() {
        return this.page.frames().find(f =>
            f.url().includes("/recaptcha/api2/anchor")
        );
    }

    findChallengeIframe() {
        return this.page.frames().find(f =>
            f.url().includes("/recaptcha/api2/bframe")
        );
    }

    // === Step 1 checkbox ===
    async clickCheckboxLabel(anchor) {
        const label = anchor.locator("#recaptcha-anchor-label");
        await label.waitFor({ timeout: 6000 });
        await label.click();
        await this.page.waitForTimeout(1200);
    }

    // === Step 2 wait until image/audio dialog appears ===
    async waitForChallengeDialog() {
        const challengeFrame = this.findChallengeIframe();
        if (!challengeFrame) throw new Error("bframe iframe not found");
        await challengeFrame.waitForSelector("#rc-imageselect", { timeout: 8000 }).catch(() => {});
        return challengeFrame;
    }

    // === Step 3 click audio button ===
    async clickAudioButton(challengeFrame) {
        let btn = challengeFrame.locator("#recaptcha-audio-button");
        if (!(await btn.isVisible())) {
            btn = challengeFrame.locator(".button-holder.reload-button-holder button");
        }
        if (!(await btn.isVisible())) {
            btn = challengeFrame.locator("//html/body/div/div/div[3]/div[2]/div[1]/div[1]/div[2]/button");
        }
        if (!(await btn.isVisible())) throw new Error("Audio button not found");

        await btn.click();
        await this.page.waitForTimeout(1200);
    }

    // === Step 4 check audio UI shown ===
    async checkAudioUI(challengeFrame) {
        const input = challengeFrame.locator("input#audio-response");
        const instructions = challengeFrame.locator(".rc-audiochallenge-instructions");
        return (await input.count()) > 0 || (await instructions.count()) > 0;
    }

    // === Step 5 detect anti-bot ===
    async detectAutomatedError(challengeFrame) {
        const block = challengeFrame.locator(".rc-doscaptcha-body-text");
        return (await block.count()) > 0;
    }

    // === Step 6 get audio URL (just grab src, no visibility check) ===
    async getAudioUrl(challengeFrame) {
        const audioEl = challengeFrame.locator("audio#audio-source");
        const src = await audioEl.getAttribute("src");
        if (!src) throw new Error("Audio src not found");
        return src;
    }

    // === Step 7 download audio to file ===
    async downloadAudio(url, destPath) {
        const resp = await this.page.request.get(url);
        const buffer = await resp.body(); // <-- await here
        fs.writeFileSync(destPath, buffer);
    }

    // === Step 8 transcribe with Google Speech ===
    async transcribeAudio(filePath) {
        const client = new SpeechClient({
            keyFilename: path.join(__dirname, "key.json"),
        });

        const audioBytes = fs.readFileSync(filePath).toString("base64");

        const request = {
            audio: { content: audioBytes },
            config: {
                encoding: "MP3",
                sampleRateHertz: 16000,
                languageCode: "en-US",
                enableAutomaticPunctuation: false,
            },
        };

        const [response] = await client.recognize(request);
        if (!response.results.length) return "";

        const transcript = response.results
            .map(r => r.alternatives[0]?.transcript || "")
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();

        return transcript;
    }

    // === Step 9 submit audio answer ===
    async submitAudioAnswer(challengeFrame, text) {
        const input = challengeFrame.locator("input#audio-response");
        await input.fill(text);

        const verifyBtn = challengeFrame.locator("#recaptcha-verify-button");
        await verifyBtn.click();

        await this.page.waitForTimeout(1500);
    }

    // ==============================
    // FINAL SOLVE
    // ==============================
    async solve() {
        try {
            console.log("[+] Searching reCAPTCHA iframe...");
            const anchor = this.findAnchorIframe();

            // ⛔ return detection if no recaptcha is found
            if (!anchor) {
                console.log("[X] No reCAPTCHA visible on page");
                return "NO_RECAPTCHA";
            }

            console.log("[+] Anchor iframe DETECTED");
            await this.clickCheckboxLabel(anchor);

            const challengeFrame = await this.waitForChallengeDialog();
            console.log("[+] Challenge dialog detected");

            // Try switching to audio up to 3 times
            for (let attempt = 1; attempt <= 3; attempt++) {
                console.log(`[*] Trying audio button (attempt ${attempt}/3)`);
                await this.clickAudioButton(challengeFrame);
                await this.page.waitForTimeout(1500);

                // Anti-bot
                if (await this.detectAutomatedError(challengeFrame)) {
                    console.log("[!] BLOCKED: automated traffic detected");
                    return "BLOCKED";
                }

                // UI detected
                if (await this.checkAudioUI(challengeFrame)) {
                    console.log("[✔] Audio challenge ACTIVE");

                    const url = await this.getAudioUrl(challengeFrame);
                    const filePath = "audio.mp3";

                    await this.downloadAudio(url, filePath);

                    const transcript = await this.transcribeAudio(filePath);
                    console.log("[*] Transcription result:", transcript);

                    await this.submitAudioAnswer(challengeFrame, transcript);

                    console.log("[✔] Captcha solved.");
                    return "OK";
                }

                console.log("[!] Audio UI not detected → retry");
            }

            console.log("[X] Failed to activate audio challenge");
            return "FAILED";

        } catch (err) {
            console.log("[ERROR]:", err.message);
            return "ERROR";
        }
    }
}

// Export a helper function to match main.js
async function solveAudioCaptcha(page) {
    const solver = new SimpleRecaptchaSolver(page);
    return solver.solve();
}

module.exports = { solveAudioCaptcha };