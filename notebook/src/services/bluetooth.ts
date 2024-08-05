import {Buffer} from "buffer";

const SERVICE_UUID = 0x00ff;
const CHAR_UUID = 0xFF01;
export const MAX_MTU = 495;

export default class Bluetooth {
  private device: BluetoothDevice | undefined = undefined;
  private characteristic: BluetoothRemoteGATTCharacteristic | undefined = undefined;
  private notificationHandler:((event: Event)=>void) | undefined = undefined;

  public async sendBuffers(buffs: Buffer[]) {
    await this.init();
    let start = performance.now();
    for (const buff of buffs) {
      await this.characteristic?.writeValueWithResponse(buff);
    }
    let end = performance.now();
    console.log("bluetooth dulation: ", end - start, "ms");
  }

  public async readBuffer() {
    await this.init();
    return await this.characteristic?.readValue();
  }

  public setNotificationHandler(handler: (event: Event) => void) {
    this.notificationHandler = handler;
  }

  private async init() {
    if (this.device !== undefined && this.characteristic !== undefined && this.device.gatt?.connected) return;

    await navigator.bluetooth.requestDevice({
      filters: [
        {services: [SERVICE_UUID]},
      ],
    }).then(device => {
      this.device = device;
      return device.gatt?.connect();
    }).then(server=> {
      return server?.getPrimaryService(SERVICE_UUID)
    }).then(service => {
      return service?.getCharacteristic(CHAR_UUID);
    }).then(characteristic => {
      this.characteristic = characteristic;
    }).catch(error => {
      console.log(error);
    });

    if (this.notificationHandler !== undefined) {
      await this.characteristic?.startNotifications();
      this.characteristic?.addEventListener("characteristicvaluechanged", this.notificationHandler);
      console.log("notification started.");
    }
  }
}