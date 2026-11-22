import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
// Optional verification dependencies only. No server or browser download.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const pageUrl = new URL("dist/index.html", import.meta.url).href;
const output = process.argv[2];
const browser = await chromium.launch({ chromiumSandbox: true, headless: true, executablePath: process.env.CHROME_PATH });
try {
    const viewports = [];
    for (const size of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
        const context = await browser.newContext({ viewport: size, offline: true, serviceWorkers: "block" });
        const page = await context.newPage(), external = [], errors = [];
        page.on("request", r => { if (!/^(file:|data:)/.test(r.url()))
            external.push(r.resourceType()); });
        page.on("pageerror", e => errors.push(e.message));
        await page.goto(pageUrl);
        assert.equal(await page.locator("#folio").textContent(), "01");
        await page.keyboard.press("Tab");
        assert.equal(await page.evaluate(() => document.activeElement.id), "storyTab");
        await page.keyboard.press("Tab");
        await page.keyboard.press("Enter");
        assert.equal(await page.locator("#archive").isVisible(), true);
        for (const i of [0, 2, 4]) {
            await page.selectOption("#archiveStage", String(i));
            await page.waitForFunction(() => document.querySelector("#legacyImage").naturalWidth === 1672);
        }
        await page.click("#storyTab");
        await page.click("#evidence summary");
        await page.click("#history summary");
        await page.selectOption("#phase", "pending");
        assert.equal(await page.locator("#visualBox").getAttribute("data-state"), "pending-review");
        await page.click("#toggle");
        await page.click("#next");
        assert.ok(await page.locator("#sample").isHidden());
        await page.click("#toggle");
        await page.selectOption("#placeFilter", "reed");
        assert.equal(await page.locator("#folio").textContent(), "04");
        await page.click("#reset");
        const states = ["accepted", "reuse", "unknown", "unscheduled", "hidden", "hidden", "reuse", "unknown", "unknown", "reuse", "unscheduled", "waiting", "unknown", "rejected", "unscheduled", "unscheduled", "unscheduled", "hidden", "hidden", "unscheduled"];
        for (const [i, state] of states.entries()) {
            if (i)
                await page.click("#next");
            assert.equal(await page.locator("#visualBox").getAttribute("data-state"), state);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        }
        await page.click("#reset");
        await page.waitForFunction(() => document.querySelector("#sample").naturalWidth === 1536);
        if (output) {
            await mkdir(output, { recursive: true });
            await page.screenshot({ path: join(output, "preview-" + size.width + ".png"), fullPage: true });
        }
        assert.deepEqual(external, []);
        assert.deepEqual(errors, []);
        viewports.push({ ...size, turns: 20, keyboard: true, overflow: false, externalRequests: external.length });
        await context.close();
    }
    console.log(JSON.stringify({ browser: browser.version(), scheme: new URL(pageUrl).protocol, viewports }));
}
finally {
    await browser.close();
}
