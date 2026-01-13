import { execFile } from "child_process";
import { promisify } from "util";
import { remote } from "webdriverio";

import { ADBService } from "../infra/adb/adb.service.js";
import { PortManager } from "../core/port/port-manager.js";
import { AppiumService } from "../infra/appium/appium.service.js";

import { TaskPool } from "../core/utils/task-pool.js";
import { SessionService } from "../core/session/session.service.js";
import { buildAndroidUia2Caps } from "../core/capabilities/android.uia2.js";

const execFileAsync = promisify(execFile);

// ===== Config =====
const APPIUM_HOST = "127.0.0.1";
const APPIUM_PORT = 4723;

const PORT_ARGS = {
  maxSlots: 500,
  bases: {
    systemPort: 20000,
    chromedriverPort: 21000, // nếu hybrid
    mjpegServerPort: 22000,  // nếu dùng
  },
};

// Concurrency cho “test steps” (tức là số device chạy actions song song)
const ACTION_CONCURRENCY = 5;

// Concurrency cho “create session” (bên trong SessionService)
const CREATE_CONCURRENCY = 15;

async function cleanupDeviceForwards(deviceId) {
  try {
    await execFileAsync("adb", ["-s", deviceId, "forward", "--remove-all"]);
  } catch {
    // ignore
  }
}

function makeWdioClient() {
  return {
    async createDriver(endpoint, caps) {
      return remote({
        protocol: endpoint.protocol ?? "http",
        hostname: endpoint.hostname,
        port: endpoint.port,
        path: endpoint.path ?? "/",
        capabilities: caps,
      });
    },
  };
}

async function main() {
  // ===== infra =====
  const appiumService = new AppiumService(APPIUM_HOST, APPIUM_PORT);
  const adbService = new ADBService();
  const portManager = new PortManager(PORT_ARGS);

  // start appium
  const ok = await appiumService.startServer();
  if (!ok) throw new Error("Cannot start Appium server");

  // ensure adb
  await adbService.ensureReady();

  // list devices
  const rawDevices = await adbService.listDevices();
  const devices = rawDevices.filter((d) => d.type === "device"); // chỉ device ready

  console.log(`Found ${devices.length} ready devices`);
  console.log("PortManager stats:", portManager.stats());

  // ===== SessionService wiring =====
  const wdioClient = makeWdioClient();

  const sessionService = new SessionService({
    portManager,
    wdioClient,
    buildCaps: ({ deviceId, ports }) =>
      buildAndroidUia2Caps({
        deviceId: deviceId, // tuỳ SessionService truyền gì
        ports,
        appPath: null,
        extraCaps: {
          "appium:noReset": true,
          // "appium:skipServerInstallation": true, // chỉ bật nếu chắc môi trường đã chuẩn hoá
        },
      }),
    endpointResolver: async () => ({
      hostname: APPIUM_HOST,
      port: APPIUM_PORT,
      path: "/",
      protocol: "http",
    }),
    options: {
      createConcurrency: CREATE_CONCURRENCY,
      maxRetries: 1,
    },
  });

  const pool = new TaskPool(ACTION_CONCURRENCY);

  async function runOnDevice(deviceId) {
    // optional cleanup
    await cleanupDeviceForwards(deviceId);

    let session;
    try {
      // connect via SessionService (auto allocate ports + create driver)
      session = await sessionService.connect({ id: deviceId });

      const driver = session.driver ?? session; // tuỳ implement của bạn return gì
      const systemPort = session?.ports?.systemPort;

      console.log(`[${deviceId}] ✅ session ready (systemPort=${systemPort ?? "?"})`);

      // ===== Demo actions =====
      const el = await driver.$('//*[@text="Lite"]');
      await el.waitForDisplayed({ timeout: 15000 });
      await el.click();
      console.log(`[${deviceId}] ✅ click ok`);

      await driver.pause(1000);

      return { deviceId, ok: true };
    } catch (e) {
      console.error(`[${deviceId}] ❌ ${e?.message || e}`);
      return { deviceId, ok: false, error: e?.message || String(e) };
    } finally {
      // ALWAYS disconnect via service (auto deleteSession + release ports)
      try {
        await sessionService.disconnect(deviceId);
      } catch {}
    }
  }

  try {
    const jobs = devices.map(({ id }) => pool.run(() => runOnDevice(id)));
    const results = await Promise.all(jobs);

    const okCount = results.filter((r) => r.ok).length;
    const failCount = results.length - okCount;

    console.log(`Done. OK=${okCount}, FAIL=${failCount}`);
    console.log("PortManager stats end:", portManager.stats());
  } finally {
    try {
      await sessionService.disconnectAll?.();
    } catch {}
    await appiumService.stopServer();
  }
}

await main();
