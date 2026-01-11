import { remote } from "webdriverio"
import { execFile } from "child_process"
import { promisify } from "util"

import { ADBService } from "./src/infra/adb/adb.service.js"
import { PortManager } from "./src/core/port/port-manager.js"
import { TaskPool } from "./src/core/utils/task-pool.js"
import { AppiumService } from "./src/infra/appium/appium.service.js"


const execFileAsync = promisify(execFile)

const PORT_ARGS = {
  maxSlots: 500,
  bases: {
    systemPort: 20000,
    chromedriverPort: 21000,
    mjpegServerPort: 22000,
  },
}

const APPIUM_ENDPOINT = {
  protocol: "http",
  hostname: "127.0.0.1",
  port: 4723,
  path: "/",
}

// Giới hạn số session tạo song song (bạn chỉnh 10~20 tuỳ máy)
const CONCURRENCY = 5

const appiumService = new AppiumService('127.0.0.1', 4723)
const adbService = new ADBService()
const portManager = new PortManager(PORT_ARGS)
const pool = new TaskPool(CONCURRENCY)

await appiumService.startServer()
// (Tuỳ chọn) nếu bạn muốn tự start appium trong code
// const appiumService = new AppiumService("127.0.0.1", 4723)

async function cleanupDeviceForwards(deviceId) {
  try {
    await execFileAsync("adb", ["-s", deviceId, "forward", "--remove-all"])
  } catch {
    // ignore
  }
}

async function runOnDevice(deviceId) {
  // 1) dọn forward cũ (tuỳ chọn)
  await cleanupDeviceForwards(deviceId)

  // 2) cấp systemPort riêng cho uia2
  const { ports: { systemPort } } = portManager.allocate(deviceId)

  let session
  try {
    session = await remote({
      ...APPIUM_ENDPOINT,
      capabilities: {
        platformName: "Android",
        "appium:automationName": "UiAutomator2",
        "appium:udid": deviceId,
        "appium:deviceName": deviceId,
        "appium:systemPort": systemPort,

        // tuỳ bạn
        "appium:noReset": true,
        // "appium:skipServerInstallation": true, // cân nhắc khi device mới
      },
    })

    console.log(`[${deviceId}] ✅ session ok (systemPort=${systemPort})`)

    // Demo action của bạn
    let el = await session.$('//*[@text="System Apps"]')
    await el.waitForDisplayed({ timeout: 15000 })
    await el.click()
    console.log(`[${deviceId}] ✅ click ok`)
    await session.pause(1000)

    el = await session.$('//*[@text="System Apps"]')
    await el.waitForDisplayed({ timeout: 15000 })
    await el.click()
    console.log(`[${deviceId}] ✅ click ok`)
    await session.pause(3000)

    el = await session.$('//*[@text="Chrome"]')
    await el.waitForDisplayed({ timeout: 15000 })
    await el.click()
    console.log(`[${deviceId}] ✅ click ok`)
    await session.pause(3000)

    return { deviceId, ok: true }
  } catch (e) {
    console.error(`[${deviceId}] ❌ ${e?.message || e}`)
    return { deviceId, ok: false, error: e?.message || String(e) }
  } finally {
    // luôn cleanup
    try { if (session) await session.deleteSession() } catch { }
    portManager.release(deviceId)
  }
}

async function main() {
  // (Tuỳ chọn) start Appium server
  // await appiumService.startServer()

  await adbService.ensureReady()

  const rawDevices = await adbService.listDevices()
  const devices = rawDevices.filter(d => d.type === "device") // chỉ lấy device ready

  console.log(`Found ${devices.length} ready devices. Concurrency=${CONCURRENCY}`)
  console.log("PortManager stats:", portManager.stats())

  const jobs = devices.map(({ id }) => pool.run(() => runOnDevice(id)))
  const results = await Promise.all(jobs)

  const okCount = results.filter(r => r.ok).length
  const failCount = results.length - okCount
  console.log(`Done. OK=${okCount}, FAIL=${failCount}`)

  console.log(appiumService.getConnections())
  await appiumService.stopServer()
  // (Tuỳ chọn) stop Appium server
  // await appiumService.stopServer()
}

await main()
