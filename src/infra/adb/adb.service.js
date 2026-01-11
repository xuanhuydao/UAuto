import adbkit from "@devicefarmer/adbkit"
import { execFile } from "child_process"
import { promisify } from "util"

const { Adb } = adbkit
const execFileAsync = promisify(execFile)

class ADBError extends Error {
    constructor(message, { deviceId, command, cause } = {}) {
        super(message)
        this.name = 'ADB Error'
        this.deviceId = deviceId
        this.command = command
        this.cause = cause
    }
}

export class ADBService {
    constructor(options = {}) {
        this.options = {
            bin: 'adb',
            host: '127.0.0.1',
            port: 5037,
            ...options
        }
        this.client = Adb.createClient({ host: this.options.host, port: this.options.port })
    }

    async isADBAvailable() {
        try {
            const { stdout } = await execFileAsync(this.options.bin, ['version'])
            return stdout.includes('Android Debug Bridge')
        } catch (error) {
            return false
        }
    }

    async isADBReachable() {
        try {
            await this.client.version()
            return true
        } catch (error) {
            return false
        }
    }

    async startServer() {
        try {
            await execFileAsync(this.options.bin, ['start-server'])
            console.log('ADB Server is running')
            return true
        } catch (error) {
            throw new ADBError('Không start được ADB server :: ', { cause: error })
        }
    }

    async ensureReady() {
        const hasBin = await this.isADBAvailable()
        if (!hasBin) {
            throw new ADBError(
                `Không tìm thấy adb binary. Hãy cài platform-tools hoặc truyền options.bin (đường dẫn adb).`
            )
        }
        if (this.options.host === '127.0.0.1' || this.options.host === 'localhost') {
            await this.startServer()
        }

        const ok = await this.isADBReachable()
        if (!ok) {
            // host remote: phải tự start-server :contentReference[oaicite:6]{index=6}
            throw new ADBError(
                `Không kết nối được ADB server (${this.options.host}:${this.options.port}). ` +
                `Nếu host remote, hãy đảm bảo adb server đang chạy.`
            )
        }
    }

    async listDevices() {
        return this.client.listDevices()
    }

    async trackDevices() {
        return this.client.trackDevices()
    }

    async executeShellCommand(deviceId, command) {
        try {
            const device = this.client.getDevice(deviceId)

            const stream = await device.shell(command)
            const buffer = await Adb.util.readAll(stream)

            return buffer.toString().trim()
        } catch (error) {
            throw new ADBError("ADB shell failed", { deviceId, command, cause: error })
        }
    }
}