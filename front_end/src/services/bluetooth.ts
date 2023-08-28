import {Buffer} from "buffer";

export const CHARACTERISTIC_IDS = {
  REPL: 0xff01,
  ONETIME: 0xff02,
  CLEAR: 0xff03,
  NOTIFICATION: 0xff03
}

const SERVICE_UUID = 0x00ff

export default class Bluetooth {
  private serviceUUID: number;
  private device: BluetoothDevice | undefined = undefined;
  private service: BluetoothRemoteGATTService | undefined = undefined;

  constructor() {
    this.serviceUUID = SERVICE_UUID;
  }

  public async sendMachineCode(cid: number, exe: string) {
    await this.init();
    const characteristic = await this.service?.getCharacteristic(cid);
    await characteristic?.writeValue(Buffer.from(exe, "hex"));
  }

  public async startNotifications(notificationHandler: (event:Event) => void) {
    await this.init();
    let char03 = await this.service?.getCharacteristic(0xff03);
    if (char03) {

      char03 = await char03?.startNotifications();
      char03.addEventListener("characteristicvaluechanged",notificationHandler);
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