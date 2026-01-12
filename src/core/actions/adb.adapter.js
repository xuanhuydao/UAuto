export function normalizeAdb(adbService) {
    if(!adbService) return null

    if( typeof adbService.executeShellCommand === 'function') {
        return {
            ...adbService,
            shell: (deviceId, cmd) => adbService.excuteShellCommand(deviceId, cmd)
        }
    }

    throw new Error('ADB Adapter: missing excuteShellCommnad()')
}