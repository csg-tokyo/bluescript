import {Buffer} from "buffer";

export default class Bluetooth {
  private serviceUUID: number;
  private device: BluetoothDevice | undefined = undefined;
  private service: BluetoothRemoteGATTService | undefined = undefined;

  constructor(serviceUUID: number) {
    this.serviceUUID = serviceUUID;
  }

  public async sendMachineCode(text: string, literal: string, data: string, rodata: string, bss: string, mainFuncOffset: number) {
    await this.init();
    const char02 = await this.service?.getCharacteristic(0xff02);
    const textBuf = Buffer.from(text, "hex");
    const literalBuf = Buffer.from(literal, "hex");
    const dataBuf = Buffer.from(data, "hex");
    const rodataBuf = Buffer.from(rodata, "hex");
    const bssBuf = Buffer.from(bss, "hex");
    const machineCodeBuf = Buffer.concat([
      Buffer.from([textBuf.length, literalBuf.length, dataBuf.length, rodataBuf.length, bssBuf.length, mainFuncOffset]),
      textBuf,
      literalBuf,
      dataBuf,
      rodataBuf,
      bssBuf
    ]);
    await char02?.writeValue(machineCodeBuf);
  }

  public async addMachineCode(text: string, literal: string, data: string, rodata: string, bss: string, execFuncOffset: number[]) {
    await this.init();
    const char01 = await this.service?.getCharacteristic(0xff01);
    const textBuf = Buffer.from(text, "hex");
    const literalBuf = Buffer.from(literal, "hex");
    const dataBuf = Buffer.from(data, "hex");
    const rodataBuf = Buffer.from(rodata, "hex");
    const bssBuf = Buffer.from(bss, "hex");
    const machineCodeBuf = Buffer.concat([
      Buffer.from([textBuf.length, literalBuf.length, dataBuf.length, rodataBuf.length, bssBuf.length, execFuncOffset.length]),
      Buffer.from(execFuncOffset),
      textBuf,
      literalBuf,
      dataBuf,
      rodataBuf,
      bssBuf
    ]);
    await char01?.writeValue(machineCodeBuf);
  }

  public async clearMachineCode() {
    await this.init();
    const char03 = await this.service?.getCharacteristic(0xff03);
    await char03?.writeValue(Buffer.from([]));
  }

  public async startNotifications(notificationHandler: (event:Event) => void) {
    await this.init();
    let char03 = await this.service?.getCharacteristic(0xff03);
    if (char03) {

      char03 = await char03?.startNotifications();
      char03.addEventListener("characteristicvaluechanged",notificationHandler);
      console.log(char03.properties.notify);
      console.log("notification started.");
    }
  }

  public async stopLogNotification() {
    await this.init();
    let char03 = await this.service?.getCharacteristic(0xff03);
    if (char03) {
      (await char03)?.stopNotifications();
    }
  }

  public async init() {
    if (this.device === undefined) {
      await navigator.bluetooth.requestDevice({
        filters: [
          {services: [this.serviceUUID]},
        ],
      }).then(device => {
        this.device = device;
      })
    }

    if (this.device !== undefined && (!this.device.gatt?.connected || this.service === undefined)) {
      await this.device.gatt?.connect()
        .then(server => server.getPrimaryService(this.serviceUUID))
        .then(service => {
          this.service = service;
        });
    }
  }
}