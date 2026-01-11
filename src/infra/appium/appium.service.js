import appium from "appium"

const { main } = appium

export class AppiumService {
    constructor(host, port) {
        this.server = null
        this.address = host ?? '127.0.0.1'
        this.port = port ?? 4723
    }

    async startServer() {
        if (this.server) {
            console.log('Appium server is running !!! ')
            return true
        }
        try {
            const args = {
                address: this.address,
                port: this.port,
                appiumHome: `C:\\Users\\huy10\\.appium`
            }
            this.server = await main(args)
            console.log(`Appium server is running at http://${this.address}:${this.port}/`)
            
            return true
        } catch (error) {
            console.log('Failed to start appium server: ', error)
            return false
        }
    }

    async stopServer() {
        if (this.server) {
            console.log('Stopping appium server')
            try {
                await this.server.close()
                console.log('Appium server stopped')
                return true
            } catch (error) {
                console.log('Error stopping appium server:: ', error)
                return false
            } finally {
                this.server = null
            }
        }
    }

    getConnections() {
        return this.server.getConnections((err, count) => console.log(count))
    }


}

