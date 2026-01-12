import type {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  Characteristic,
  CharacteristicValue,
  Logging,
  Service,
} from 'homebridge';
import {
  buildQueryPayload,
  buildSetPowerPayload,
  mapQueryToOnState,
} from './protocol.js';
import { sendUdpRequest } from './udp.js';

export default (api: API): void => {
  api.registerAccessory('DoHomeSwitch', DoHomeSwitchAccessory);
};

class DoHomeSwitchAccessory implements AccessoryPlugin {
  private readonly log: Logging;
  private readonly name: string;
  private readonly prodname: string;
  private readonly destination: string;
  private readonly port: number;
  private readonly deviceId: string;
  private readonly Service: typeof Service;
  private readonly Characteristic: typeof Characteristic;
  private readonly infoService: Service;
  private readonly switchService: Service;
  private lastKnownState: boolean | undefined = undefined;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.name = config.name ?? 'DoHome Switch';
    this.prodname = config.prodname;
    this.destination = (config as Record<string, string | undefined>).host ?? config.subnet ?? '192.168.0.255';
    this.port = typeof config.port === 'number' ? config.port : 6091;
    this.deviceId =
      typeof config.deviceid === 'string'
        ? config.deviceid
        : `${this.prodname}_DT-PLUG_HOMEKIT`;

    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    this.infoService = new this.Service.AccessoryInformation()
      .setCharacteristic(this.Characteristic.Manufacturer, 'www.doiting.com')
      .setCharacteristic(this.Characteristic.Model, 'DoHome-PA')
      .setCharacteristic(this.Characteristic.SerialNumber, this.deviceId);

    this.switchService = new this.Service.Switch(this.name);
    this.switchService
      .getCharacteristic(this.Characteristic.On)
      .onSet(this.handleSet.bind(this));

    void this.initializeState();
  }

  getServices(): Service[] {
    return [this.infoService, this.switchService];
  }

  private async initializeState(): Promise<void> {
    if (!this.prodname) {
      this.log.warn('No device specified (prodname missing). Skipping initial query.');
      return;
    }

    const payload = buildQueryPayload(this.prodname);
    const result = await sendUdpRequest({
      host: this.destination,
      port: this.port,
      payload,
      deviceId: this.deviceId,
      mode: 'query',
      mapQueryToState: (op) => mapQueryToOnState(op, this.lastKnownState),
    });

    if (!result.ok) {
      if (result.error.message === 'timeout') {
        this.log.warn('Initial state query timed out; retaining last known state.');
      } else {
        this.log.error(`Initial state query failed: ${result.error.message}`);
      }
      return;
    }

    if (typeof result.state === 'boolean') {
      this.lastKnownState = result.state;
      this.switchService.updateCharacteristic(this.Characteristic.On, result.state);
    }
  }

  private async handleSet(value: CharacteristicValue): Promise<void> {
    if (!this.prodname) {
      this.log.warn('No device specified');
      return;
    }

    const on = Boolean(value);
    const payload = buildSetPowerPayload(this.prodname, on);
    const result = await sendUdpRequest({
      host: this.destination,
      port: this.port,
      payload,
      deviceId: this.deviceId,
      mode: 'set',
    });

    if (!result.ok) {
      if (result.error.message === 'timeout') {
        throw new Error('timeout');
      }
      throw result.error;
    }

    this.lastKnownState = on;
    this.log.info(`==> ${on ? 'On' : 'Off'}`);
  }
}
