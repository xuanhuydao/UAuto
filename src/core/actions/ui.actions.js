import { retry, wrapError } from "./_helper.js"

// const ctx = {
//     deviceId: "R58N123ABC",
//     driver,          // WDIO session
//     adb,             // { shell(deviceId, cmd), ... }
//     config: {
//         app: { package: "com.example.app" },
//         timeouts: { ui: 15000 }
//     },
//     logger: console,
//     step: async (name, fn) => { /* log + timing + error wrap */ }
//     ports: session.ports,
//     runId: "dev-run",
// };

export function createUiActions(ctx) {
    const driver = ctx.driver
    if (!driver) throw new Error('ui.actions:: ui actions require ctx.driver')

    const defaultTimeoutMs = Number(ctx.config?.timeouts?.ui ?? 5000)

    const $ = async (selector) => await driver.$(selector)
    const $$ = async (selector) => await driver.$$(selector)

    async function waitVisible(selector, { timeoutMs = defaultTimeoutMs, intervalMs = 500 }) {
        return ctx.step(`ui.waitVisible ${selector}`, async () => {
            const el = await $(selector)
            await el.waitForDisplayed({ timeout: timeoutMs, interval: intervalMs })

            return el
        })
    }

    async function waitGone(selector, { timeoutMs = defaultTimeoutMs, intervalMs = 500 } = {}) {
        return ctx.step(`ui.waitGone ${selector}`, async () => {
            const el = await $(selector);
            await el.waitForDisplayed({ timeout: timeoutMs, interval: intervalMs, reverse: true });
            return true;
        });
    }

    async function tap(selector, opts = {}) {
        return ctx.step(`ui.tap ${selector}`, async () => {
            const el = await waitVisible(selector, opts)
            await el.click()
            return true
        })
    }

    async function type(selector, text, { clear = true, clickFirst = true, timeoutMs = defaultTimeoutMs } = {}) {
        return ctx.step(`ui.type ${selector}`, async () => {
            const el = await waitVisible(selector, { timeoutMs });
            if (clickFirst) await el.click();
            if (clear) {
                try { await el.clearValue(); } catch { }
            }

            await el.setValue(String(text))
            return true
        })
    }

    async function text(selector, { timeoutMs = defaultTimeoutMs } = {}) {
        return ctx.step(`ui.text ${selector}`, async () => {
            const el = await waitVisible(selector, { timeoutMs })
            return el.getText()
        })
    }

    async function back() {
        return ctx.step('ui back', async () => {
            await driver.back()
        })
    }

    async function swipe(direction, { percent = 0.7, durationMs = 280 } = {}) {
        return ctx.step(`ui.swipe ${direction}`, async () => {
            const rect = await driver.getWindowRect();
            const w = rect.width, h = rect.height
            const p = Math.max(0.1, Math.min(0.95, Number(percent)))

            const cx = Math.floor(rect.x + w / 2);
            const cy = Math.floor(rect.y + h / 2);
            const dx = Math.floor((w * p) / 2);
            const dy = Math.floor((h * p) / 2);

            let x1 = cx, y1 = cy, x2 = cx, y2 = cy;
            if (direction === "up") { y1 = cy + dy; y2 = cy - dy; }
            else if (direction === "down") { y1 = cy - dy; y2 = cy + dy; }
            else if (direction === "left") { x1 = cx + dx; x2 = cx - dx; }
            else if (direction === "right") { x1 = cx - dx; x2 = cx + dx; }
            else throw new Error(`ui.actions:: Unknown direction: ${direction}`);

            await driver.performActions([{
                type: "pointer",
                id: "finger1",
                parameters: { pointerType: "touch" },
                actions: [
                    { type: "pointerMove", duration: 0, x: x1, y: y1 },
                    { type: "pointerDown", button: 0 },
                    { type: "pause", duration: 80 },
                    { type: "pointerMove", duration: durationMs, x: x2, y: y2 },
                    { type: "pointerUp", button: 0 }
                ]
            }])

            try { await driver.releaseActions() } catch { }
            return true
        })
    }

    async function scrollTo(selector, { maxSwipes = 8, direction = "up" } = {}) {
        return ctx.step(`ui.scrollTo ${selector}`, async () => {
            for (let i = 0; i < maxSwipes; i++) {
                const el = await $(selector)
                if (await el.isDisplayed().catch(() => false)) return el
                await swipe(direction)
            }

            throw new Error(`ui.actions:: scrollTo failed: ${selector}`)
        })
    }

    async function tapWithRetry(selector, { times = 2, delayMs = 500, timeoutMs = defaultTimeoutMs }) {
        return ctx.step(`ui.tapWithRetry ${selector}`, async () => {
            try {
                return await retry(() => tap(selector, { timeoutMs }), { times, delayMs })
            } catch (error) {
                throw wrapError(error, `ui.actions:: apWithRetry failed (${selector})`)
            }
        })
    }

    return { $, $$, waitVisible, waitGone, tap, type, text, back, swipe, scrollTo, tapWithRetry }
}
