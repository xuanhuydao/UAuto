import { wrapError } from "./_helper.js";
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

export function createExpectActions(ctx) {
    const ui = ctx.ui
    if(!ui) throw new Error('expect.actions require ctx.ui')

    async function visible(selector, opts) {
        try {
            await ui.waitVisible(selector, opts)
            return true
        } catch (error) {
            throw wrapError(error, `Expect.visible failed ${selector}`)
        }
    }

    async function notVisible(selector, { timeoutMs = 300 } = {}) {
        try {
            await ui.waitGone(selector, { timeoutMs })
            return true
        } catch (error) {
            throw wrapError(error, `expect.notVisible failed (${selector})`);
        }
    }

    async function textContains(selector, expected, opts) {
        return ctx.step(`expect.textContains ${selector}`, async () => {
            const actual = await ui.text(selector, opts)
            if (!String(actual).includes(String(expected))) {
                throw wrapError(`Text not contains.\nExpected: ${expected}\nActual: ${actual}`)
            }

            return true
        })
    }

    return { visible, notVisible, textContains }
}

