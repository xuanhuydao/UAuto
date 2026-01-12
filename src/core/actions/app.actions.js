import { wrapError } from "./_helper.js";

export function createAppActions(ctx) {
    const driver = ctx.driver
    if (!driver) throw new Error('app.actions:: require ctx.driver')

    const adb = ctx.adb
    const defaultPkg = ctx.config?.app?.package

    function pkg(p) {
        const out = p ?? defaultPkg
        if (!out) throw new Error('app.actions:: Missing app package (ctx.config.app.package or pass appId)')
        return out
    }

    async function launch(appId) {
        const id = pkg(appId)
        return ctx.step(`app.launch ${id}`, async () => {
            try {
                await driver.activateApp(id)
            } catch (error) {
                throw wrapError(error, `app.actions:: activateApp failed (${id})`)
            }
            return true
        })
    }

    async function terminate(appId) {
        const id = pkg(appId)
        return ctx.step(`app.terminate ${id}`, async () => {
            try {
                await driver.terminateApp(id)
            } catch (error) {
                throw wrapError(error, `app.actions:: terminateApp failed (${id})`)
            }

            return true
        })
    }

    async function clearData(appId) {
        const id = pkg(appId)
        if (!adb.shell) throw new Error('app.actions:: clearData requires ctx.adb.shell(deviceId, cmd)')

        return ctx.step(`app.clearData ${id}`, async () => {
            await adb.shell(ctx.deviceId, `pm clear ${id}`)
            return true
        })
    }

    async function startActivity({ appId, activity, wait = true }) {
        const id = pkg(appId)
        if (!adb.shell) throw new Error('app.actions:: startActivity requires ctx.adb.shell(deviceId, cmd)')
        if (!activity) throw new Error('app.actions:: missing activity')

        return ctx.step(`app.startActivity ${id}/${activity}`, async () => {
            await adb.shell(ctx.deviceId, `am start ${wait ? "-W " : ""}-n ${id}/${activity}`)
            return true
        })
    }

    async function deepLink({ appId, url }) {
        const id = pkg(appId)
        if (!adb.shell) throw new Error('app.actions:: deepLink requires ctx.adb.shell(deviceId, cmd)')
        if (!url) throw new Error('app.actions:: missing url')

        return ctx.step(`app.deepLink ${url}`, async () => {
            await adb.shell(ctx.deviceId, `am start -a android.intent.action.VIEW -d "${url}" ${id}`)
            return true
        })
    }

    return { launch, terminate, clearData, startActivity, deepLink }
}