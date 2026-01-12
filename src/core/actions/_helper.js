export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function retry(fn, { times = 1, delayMs = 250, shouldRetry } = {}) {
    let lastErr

    for (let i = 0; i <= times; i++) {
        try {
            return await fn(i)
        } catch (e) {
            lastErr = e
            const ok = shouldRetry ? shouldRetry(e, i) : true
            if (!ok || i > times) break
            if (delayMs) await sleep(delayMs)
        }
    }

    throw lastErr
}

export function makeStepRunner({ deviceId, logger }) {
    const log = logger ?? console;
    return async (name, fn) => {
        const start = Date.now();
        (log.info ?? log.log).call(log, `[${deviceId}] ▶ ${name}`);
        try {
            const out = await fn();
            const dur = Date.now() - start;
            (log.info ?? log.log).call(log, `[${deviceId}] ✓ ${name} (${dur}ms)`);
            return out;
        } catch (e) {
            const dur = Date.now() - start;
            (log.error ?? log.log).call(log, `[${deviceId}] ✗ ${name} (${dur}ms)\n${e?.stack || e?.message || e}`);
            throw e;
        }
    };
}

export function wrapError(err, prefix) {
    const e = err instanceof Error ? err : new Error(String(err))
    e.message = `${prefix} : ${e.message}`

    return e
}