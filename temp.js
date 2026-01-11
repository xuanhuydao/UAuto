import { SessionService } from "./src/core/session/session.service.js";
import { buildAndroidUia2Caps } from "./src/core/capabilities/android.uia2.js";
import { remote } from "webdriverio"


const sessionService = new SessionService({
  portManager,
  wdioClient,
  buildCaps: ({ deviceId, ports }) =>
    buildAndroidUia2Caps({
      deviceId,
      ports,
      appPath: null,
      extraCaps: {
        "appium:noReset": true,
      },
    }),
  endpointResolver: async () => ({
    hostname: "127.0.0.1",
    port: 4723,
    path: "/",
  }),
  options: {
    createConcurrency: 15,
    maxRetries: 1,
  },
});
