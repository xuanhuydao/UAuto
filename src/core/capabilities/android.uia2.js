export function buildAndroidUia2Caps({
    deviceId,
    ports,
    appPath = null,
    extraCaps = {}
}) {
    if(!deviceId) throw new Error('buildAndroidUia2Caps: deviceId (udid) is required')
    if(!ports.systemPort) throw new Error('buildAndroidUia2Caps: systemPort must be a number')

    const caps = {
        platformName: "Android",
        "appium:automationName": "UiAutomator2",
        "appium:udid": deviceId,
        "appium:deviceName": deviceId,
        "appium:systemPort": ports.systemPort,
    }

    if(appPath) caps["appium:app"] = appPath

    return { ...caps, ...extraCaps}
}