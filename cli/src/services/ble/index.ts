import { Buffer } from "node:buffer";
import { MemoryImage, MemoryLayout } from "@bscript/lang";
import { logger } from "../../core/logger";
import { Connection, ConnectionMessage, Service } from "../common";
import { Protocol, ProtocolPacketBuilder, ProtocolParser } from "../device-protocol";
import { BleTransport, createBleTransport } from "./transport";

const MTU = 495;

export type DeviceServiceEvents = {
    log: (message: string) => void;
    error: (message: string) => void;
    profile: (fid: number, paramtypes: string[]) => void;
    exectime: (id: number, time: number) => void;
    memory: (layout: MemoryLayout) => void;
};

export class DeviceService extends Service<DeviceServiceEvents, Buffer> {
    constructor(connection: BleConnection) {
        super("device", connection);
        this.connection.on("receiveData", (data) => {
            this.handleReceivedData(data);
        });
    }

    public async load(bin: MemoryImage, onPacketSent?: (percent: number) => void): Promise<number> {
        const builder = new ProtocolPacketBuilder(MTU);
        if (bin.iram) builder.load(bin.iram.address, bin.iram.data);
        if (bin.dram) builder.load(bin.dram.address, bin.dram.data);
        if (bin.iflash) builder.load(bin.iflash.address, bin.iflash.data);
        if (bin.dflash) builder.load(bin.dflash.address, bin.dflash.data);
        const startLoading = performance.now();
        await this.send("load", builder.build(), onPacketSent);
        return performance.now() - startLoading;
    }

    public async execute(bin: MemoryImage): Promise<number> {
        const builder = new ProtocolPacketBuilder(MTU);
        const isMain = 1;
        for (const entryPoint of bin.entryPoints) {
            builder.jump(entryPoint.isMain ? isMain : 0, entryPoint.address);
        }
        let executionTime = 0;
        const p = new Promise<number>((resolve) => {
            this.on("exectime", (id, time) => {
                executionTime += time;
                if (id === isMain) {
                    resolve(executionTime);
                    this.off("exectime");
                }
            });
        });
        await this.send("execute", builder.build());
        return p;
    }

    public async init(): Promise<MemoryLayout> {
        const builder = new ProtocolPacketBuilder(MTU).reset();
        const p = new Promise<MemoryLayout>((resolve) => {
            this.once("memory", (layout) => {
                resolve(layout);
            });
        });
        await this.send("init", builder.build());
        return p;
    }

    private handleReceivedData(data: Buffer) {
        const parseResult = new ProtocolParser().parse(data);
        switch (parseResult.protocol) {
            case Protocol.Log:
                this.handleMessage("log", [parseResult.log]);
                break;
            case Protocol.Error:
                this.handleMessage("error", [parseResult.error]);
                break;
            case Protocol.Profile:
                this.handleMessage("profile", [parseResult.fid, parseResult.paramtypes]);
                break;
            case Protocol.Exectime:
                this.handleMessage("exectime", [parseResult.id, parseResult.time]);
                break;
            case Protocol.Memory:
                this.handleMessage("memory", [parseResult.layout]);
        }
    }
}

/**
 * Cross-platform BLE connection.
 * Uses @abandonware/noble on macOS/Windows and node-ble on Linux.
 */
export class BleConnection extends Connection<Buffer> {
    public status: "connected" | "connecting" | "disconnected" | "disconnecting" = "disconnected";
    private deviceName: string;
    private transport: BleTransport;
    private services: Map<string, Service<any, Buffer>> = new Map();

    constructor(deviceName: string) {
        super();
        this.deviceName = deviceName;
        this.transport = createBleTransport();
        this.transport.on("connected", () => {
            this.status = "connected";
            this.emit("connected");
        });
        this.transport.on("disconnected", (event) => {
            // Emit before clearing `disconnecting` so intentional disconnect
            // handlers can distinguish unexpected drops (see Esp32BoardRuntime).
            this.emit("disconnected", event);
            this.status = "disconnected";
        });
        this.transport.on("data", (data) => {
            this.emit("receiveData", data);
        });
    }

    public async connect(timeoutMs: number = 5000): Promise<void> {
        let timeoutHandle: NodeJS.Timeout | undefined;
        this.status = "connecting";
        const connectPromise = this.transport.connect(this.deviceName);
        // Mark handled up front: when the timeout wins the race below, this
        // promise rejects later with nobody awaiting it.
        connectPromise.catch(() => {});
        try {
            const timeoutPromise = new Promise<never>((_, reject) => {
                timeoutHandle = setTimeout(
                    () => reject(this.buildConnectionTimeoutError()),
                    timeoutMs,
                );
            });
            await Promise.race([connectPromise, timeoutPromise]);
        } catch (error) {
            await this.abortConnect();
            throw error;
        } finally {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
        }
    }

    private buildConnectionTimeoutError(): Error {
        const scannedNames = [...new Set(
            this.transport.scannedDeviceNames.filter((name) => name !== ""),
        )];
        const scanResult = scannedNames.length > 0
            ? scannedNames.map((name) => `  - "${name}"`).join("\n")
            : "  (none)";

        return new Error(
            `BLE connection timed out while looking for device "${this.deviceName}".\n\n` +
            `Nearby devices found during scan:\n${scanResult}\n\n` +
            `Please check the following:\n` +
            `  1. Is the device powered on?\n` +
            `  2. Does the device name match between flash and connect?\n` +
            `     Connect is looking for: "${this.deviceName}"\n` +
            `     Flash sets the name via \`bscript board flash-runtime <board> -d <name>\`.\n` +
            `     Connect uses \`deviceName\` in bsconfig.json (or \`-d\` for REPL).\n` +
            `     If the names differ, re-flash or update the connect name to match.`,
        );
    }

    /** Only reached when a connection attempt failed, so the link is always down afterwards. */
    private async abortConnect(): Promise<void> {
        await this.transport.abortConnect();
        this.status = "disconnected";
    }

    public async disconnect(): Promise<void> {
        this.status = "disconnecting";
        try {
            await this.transport.disconnect();
        } finally {
            this.status = "disconnected";
        }
    }

    public async send(message: ConnectionMessage<Buffer>, onPacketSent?: (percent: number) => void): Promise<void> {
        if (!this.transport.isReady()) {
            logger.error("BLE is not connected.");
            return;
        }
        const totalSize = message.payload.reduce((acc, curr) => acc + curr.length, 0);
        let sentSize = 0;
        for (const buff of message.payload) {
            await this.transport.write(buff);
            sentSize += buff.length;
            onPacketSent?.(Math.floor(sentSize / totalSize * 100));
        }
    }

    public getService(serviceName: "device"): DeviceService;
    public getService<T extends Service<any, Buffer>>(serviceName: string): T;
    public getService(serviceName: string): Service<any, Buffer> {
        if (this.services.has(serviceName)) {
            return this.services.get(serviceName)!;
        }

        let service: Service<any, Buffer>;
        switch (serviceName) {
            case "device":
                service = new DeviceService(this);
                break;
            default:
                throw new Error(`Unknown service: ${serviceName}`);
        }

        this.services.set(serviceName, service);
        return service;
    }
}
