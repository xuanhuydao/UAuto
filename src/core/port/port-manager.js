class PortError extends Error {
    constructor(message, { key, deviceId, range, cause } = {}) {
        super(message)
        this.name = 'Port Error'
        this.key = key
        this.deviceId = deviceId
        this.range = range
        this.cause = cause
    }
}

/*
maxSlots: 500,
  bases: {
    systemPort: 20000,
    chromedriverPort: 21000,   // nếu hybrid
    mjpegServerPort: 22000     // nếu dùng
  }
 */
export class PortManager {
    constructor({ maxSlots, bases }) {
        if (!Number.isInteger(maxSlots) || maxSlots <= 0) {
            throw new PortError('PortManager: maxSlots must be a positive integer')
        }
        if (!bases || typeof bases !== 'object' || Object.keys(bases).length === 0) {
            throw new PortError('PortManager: bases is required, e.g. { systemPort: 20000 }')
        }
        this.maxSlots = maxSlots
        this.bases = { ...bases }

        this.slotByDevice = new Map()
        this.freeSlots = []

        for (let i = 0; i < maxSlots; i++) {
            this.freeSlots.push(i)
        }
    }

    /*
    slotByDevice = {'deviceId' => 'port'}
     */
    allocate(deviceId) {
        if (!deviceId) throw new PortError('PortManager.allocate: deviceId là bắt buộc')

        // Nếu device đã có slot => trả lại (giữ ổn định port)
        if (this.slotByDevice.has(deviceId)) {
            const slot = this.slotByDevice.get(deviceId)

            return { slot, ports: this._portsFromSlot(slot) }
        }

        // Hết slot => không support thêm device
        if (this.freeSlots.length === 0) throw new Error(`Port Manager: Hết slot (maxSlots=${this.maxSlots})`)

        // Lấy 1 slot rảnh
        const slot = this.freeSlots.pop()
        this.slotByDevice.set(deviceId, slot)

        return { slot, ports: this._portsFromSlot(slot) }
    }

    /**
   * Xem device đang dùng slot/ports nào (không cấp mới)
   */
    get(deviceId) {
        if (!this.slotByDevice.has(deviceId)) return null
        const slot = this.slotByDevice.get(deviceId)
        return { slot, ports: this._portsFromSlot(slot) }
    }

    /**
     * Trả slot về pool.
     * Idempotent: nếu device chưa allocate thì return false.
     */
    release(deviceId) {
        if(!this.slotByDevice.has(deviceId)) return false

        const slot = this.slotByDevice.get(deviceId)
        this.slotByDevice.delete(deviceId)

        this.freeSlots.push(slot)
        return true
    }

    stats() {
        return {
            maxSlots: this.maxSlots,
            allocated: this.slotByDevice.size,
            free: this.freeSlots.length,
            keys: Object.keys(this.bases)
        }
    }

    _portsFromSlot(slot) {
        const ports = {}
        for (const [key, base] of Object.entries(this.bases)) {
            ports[key] = base + slot
        }

        return ports //{ systemPort: 20002, chromedriverPort: 21002, mjpegServerPort: 22002 }
    }
}

