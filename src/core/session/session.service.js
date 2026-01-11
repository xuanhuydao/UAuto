import { EventEmitter } from "events"
import { TaskPool } from "../utils/task-pool.js"

export class SessionService extends EventEmitter {
  constructor({
    portManager,
    wdioClient,
    buildCaps,
    endpointResolver,
    logger = console,
    options = {},
  }) {
    super()

    if (!portManager) throw new Error("SessionService: portManager is required")
    if (!wdioClient) throw new Error("SessionService: wdioClient is required")
    if (typeof buildCaps !== "function") throw new Error("SessionService: buildCaps is required")
    if (typeof endpointResolver !== "function") throw new Error("SessionService: endpointResolver is required")

    this.portManager = portManager
    this.wdioClient = wdioClient
    this.buildCaps = buildCaps
    this.endpointResolver = endpointResolver
    this.logger = logger

    this.options = {
      createConcurrency: options.createConcurrency ?? 15,
      maxRetries: options.maxRetries ?? 1,
      retryDelayMs: options.retryDelayMs ?? 1500,
      retryJitterMs: options.retryJitterMs ?? 500,
    }

    this.sessions = new Map()

    // ✅ thống nhất tên: _locks
    this._locks = new Map()

    this._createPool = new TaskPool(this.options.createConcurrency)
  }

  has(deviceId) {
    return this.sessions.has(deviceId)
  }

  get(deviceId) {
    return this.sessions.get(deviceId)
  }

  list() {
    return Array.from(this.sessions.values())
  }

  stats() {
    return {
      active: this.sessions.size,
      createConcurrency: this.options.createConcurrency,
      lockedDevices: this._locks.size,
    }
  }

  connect(deviceOrId) {
    const deviceInfo = typeof deviceOrId === "string" ? { id: deviceOrId } : deviceOrId
    const deviceId = deviceInfo?.id
    if (!deviceId) throw new Error("SessionService.connect: deviceInfo.id is required")

    return this._createPool.run(() =>
      this._withDeviceLock(deviceId, () => this._connectNow(deviceInfo))
    )
  }

  disconnect(deviceId) {
    if (!deviceId) throw new Error("SessionService.disconnect: deviceId is required")
    return this._withDeviceLock(deviceId, () => this._disconnectNow(deviceId))
  }

  async disconnectAll() {
    for (const id of Array.from(this.sessions.keys())) {
      await this.disconnect(id)
    }
  }

  async _connectNow(deviceInfo) {
    const deviceId = deviceInfo.id

    // idempotent
    const existing = this.sessions.get(deviceId)
    if (existing) return existing

    // allocate ports
    const alloc = this.portManager.allocate(deviceId)
    const ports = alloc?.ports ?? alloc

    try {
      const endpoint = await this.endpointResolver({ deviceInfo, ports, alloc })
      const caps = this.buildCaps({ deviceInfo, deviceId, ports })
      const driver = await this._retryCreateDriver(deviceId, endpoint, caps)

      const session = {
        driver,
        ports,
        endpoint,
        deviceInfo,
        createdAt: Date.now(),
      }

      this.sessions.set(deviceId, session)
      this.emit("sessionCreated", { deviceId, session })
      this.logger.info?.(`[${deviceId}] session created`)
      return session
    } catch (err) {
      // ✅ quan trọng: bất kỳ lỗi nào cũng release để không leak slot
      try { this.portManager.release(deviceId) } catch {}
      this.emit("sessionCreateFailed", { deviceId, error: err })
      throw err
    }
  }

  async _retryCreateDriver(deviceId, endpoint, caps) {
    const { maxRetries, retryDelayMs, retryJitterMs } = this.options

    let lastErr
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.wdioClient.createDriver(endpoint, caps)
      } catch (err) {
        lastErr = err
        const transient = this._isTransientError(err)

        this.logger.warn?.(
          `[${deviceId}] createDriver failed (attempt ${attempt + 1}/${maxRetries + 1}) transient=${transient}: ${err?.message || err}`
        )

        if (!transient || attempt === maxRetries) break

        const jitter = Math.floor(Math.random() * retryJitterMs)
        await this._sleep(retryDelayMs + jitter)
      }
    }

    throw lastErr
  }

  async _disconnectNow(deviceId) {
    const session = this.sessions.get(deviceId)
    if (!session) {
      // nếu chưa có session nhưng có thể đã allocate trước đó
      try { this.portManager.release(deviceId) } catch {}
      return
    }

    try {
      await session.driver.deleteSession()
      this.logger.info?.(`[${deviceId}] session deleted`)
    } catch (err) {
      this.logger.warn?.(`[${deviceId}] deleteSession failed: ${err?.message || err}`)
    } finally {
      this.sessions.delete(deviceId)
      try { this.portManager.release(deviceId) } catch {}
      this.emit("sessionDestroyed", { deviceId })
    }
  }

  async _withDeviceLock(deviceId, task) {
    // ✅ lock chain theo deviceId
    const prev = this._locks.get(deviceId) ?? Promise.resolve()

    const current = prev
      .catch(() => {})       // tránh “kẹt lock” nếu prev reject
      .then(task)

    // store chain
    this._locks.set(deviceId, current.finally(() => {
      // cleanup lock khi xong
      if (this._locks.get(deviceId) === current) this._locks.delete(deviceId)
    }))

    return current
  }

  _isTransientError(err) {
    const msg = (err?.message || "").toLowerCase()
    return (
      msg.includes("timeout") ||
      msg.includes("socket hang up") ||
      msg.includes("econnreset") ||
      msg.includes("econnrefused") ||
      msg.includes("502") ||
      msg.includes("503")
    )
  }

  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms))
  }
}
