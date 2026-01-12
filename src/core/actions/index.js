import { makeStepRunner } from "./_helper.js";
import { normalizeAdb } from "./adb.adapter.js";
import { createAppActions } from "./app.actions.js";
import { createUiActions } from "./ui.actions.js";
import { createExpectActions } from "./expect.actions.js";

export function createActions(baseCtx) {
    const ctx = {
        logger: console,
        config: {},
        ...baseCtx
    }

    ctx.adb = normalizeAdb(ctx.adb)
    ctx.step = makeStepRunner({ deviceId: ctx.deviceId ?? "unknow", logger: ctx.logger })

    ctx.ui = createUiActions(ctx)
    ctx.expect = createExpectActions(ctx)

    ctx.app = createAppActions(ctx)


    //ctx.device ctx.net
    return { ctx, ctx, ui: ctx.ui, expect: ctx.expect, app: ctx.app }
}