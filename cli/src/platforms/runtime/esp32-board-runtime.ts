import { BleConnection, DeviceService } from "../../services/ble";
import { MemoryImage } from "@bscript/lang";
import { ProgramOutput } from "../../core/logging/program-output";
import { BoardRuntime } from "./board-runtime";
import { CompileContext } from "../compiler/compiler-adapter";


export class Esp32BoardRuntime implements BoardRuntime<MemoryImage> {
    private ble: BleConnection | null = null;
    private deviceService: DeviceService | null = null;
    private programOutput: ProgramOutput;

    constructor(
        private deviceName: string,
        programOutput: ProgramOutput,
        private onUnexpectedDisconnect?: () => void,
    ) {
        this.programOutput = programOutput;
    }

    async connect(): Promise<void> {
        this.ble = new BleConnection(this.deviceName);
        await this.ble.connect();

        this.ble.on('disconnected', () => {
            if (this.ble?.status !== 'disconnecting') {
                if (this.onUnexpectedDisconnect) {
                    this.onUnexpectedDisconnect();
                } else {
                    process.exit(1);
                }
            }
            this.ble = null;
            this.deviceService = null;
        });

        this.deviceService = this.ble.getService('device');
        this.deviceService.on('log', (message) => this.programOutput.write(message));
        this.deviceService.on('error', (message) => this.programOutput.writeError(message));
    }

    async disconnect(): Promise<void> {
        if (this.ble) {
            await this.ble.disconnect();
        }
    }

    async prepare(): Promise<CompileContext> {
        if (!this.ble || !this.deviceService) {
            throw new Error('Failed to initialize device. BLE is not connected.');
        }
        const memoryLayout = await this.deviceService.init();
        return { memoryLayout };
    }

    async load(output: MemoryImage): Promise<void> {
        if (!this.ble || !this.deviceService) {
            throw new Error('Failed to load binary. BLE is not connected.');
        }
        await this.deviceService.load(output);
    }

    async execute(output: MemoryImage): Promise<void> {
        if (!this.ble || !this.deviceService) {
            throw new Error('Failed to execute binary. BLE is not connected.');
        }
        await this.deviceService.execute(output);
    }

    setOutput(output: ProgramOutput): void {
        this.programOutput = output;
    }
}
