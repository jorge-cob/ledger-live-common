// @flow

import { log } from "@ledgerhq/logs";
import type { DeviceInfo } from "../types/manager";
import type { ListAppsResult } from "./types";
import { listCryptoCurrencies } from "../currencies";
import ManagerAPI from "../api/Manager";
import { getEnv } from "../env";
import { currenciesByMarketcap } from "../currencies";
import Transport from "@ledgerhq/hw-transport";

export const listInstalledApps = (
  transport: Transport<*>,
  deviceInfo: DeviceInfo
): Promise<Array<{ name: string, hash: string }>> =>
  ManagerAPI.listInstalledApps(transport, {
    targetId: deviceInfo.targetId,
    perso: "perso_11"
  }).toPromise();

const listApps = async (
  transport: Transport<*>,
  deviceInfo: DeviceInfo,
  _sortBy?: "marketcap" | "name" // TODO use
): Promise<ListAppsResult> => {
  if (deviceInfo.isOSU || deviceInfo.isBootloader) {
    return Promise.resolve({
      appByName: {},
      apps: [],
      installed: [],
      deviceInfo
    });
  }

  const installedP = listInstalledApps(transport, deviceInfo).catch(e => {
    log("hw", "failed to get installed apps: " + String(e) + "\n" + e.stack);
    return [];
    // FIXME should we show to user the error
    // firmware 1.2 works with listing apps?
  });

  const deviceVersionP = ManagerAPI.getDeviceVersion(
    deviceInfo.targetId,
    deviceInfo.providerId
  );

  const firmwareDataP = deviceVersionP.then(deviceVersion =>
    ManagerAPI.getCurrentFirmware({
      deviceId: deviceVersion.id,
      version: deviceInfo.version,
      provider: deviceInfo.providerId
    })
  );

  const applicationsByDeviceP = Promise.all([
    deviceVersionP,
    firmwareDataP
  ]).then(([deviceVersion, firmwareData]) =>
    ManagerAPI.applicationsByDevice({
      provider: deviceInfo.providerId,
      current_se_firmware_final_version: firmwareData.id,
      device_version: deviceVersion.id
    })
  );

  const [
    installedList,
    applicationsList,
    compatibleAppVersionsList,
    sortedCryptoCurrencies
  ] = await Promise.all([
    installedP,
    ManagerAPI.listApps(),
    applicationsByDeviceP,
    currenciesByMarketcap(
      listCryptoCurrencies(getEnv("MANAGER_DEV_MODE"), true)
    )
  ]);

  log(
    "list-apps",
    `${installedList.length} apps installed. ${applicationsList.length} available.`,
    { installedList }
  );

  const filtered = getEnv("MANAGER_DEV_MODE")
    ? compatibleAppVersionsList.slice(0)
    : compatibleAppVersionsList.filter(version => {
        const app = applicationsList.find(e => e.id === version.app);
        if (app) {
          return app.category !== 2;
        }
        return false;
      });

  const sortedCryptoApps = [];
  // sort by crypto first
  sortedCryptoCurrencies.forEach(crypto => {
    const app = filtered.find(
      item => item.name.toLowerCase() === crypto.managerAppName.toLowerCase()
    );
    if (app) {
      filtered.splice(filtered.indexOf(app), 1);
      sortedCryptoApps.push({ ...app, currency: crypto });
    }
  });

  const apps = sortedCryptoApps.concat(filtered);

  const installed = installedList.map(({ name, hash }) => {
    const ins = apps.find(i => name === i.name);
    return {
      name,
      updated: ins ? ins.hash === hash : false
    };
  });

  const appByName = {};
  compatibleAppVersionsList.concat(apps).forEach(app => {
    appByName[app.name] = app;
  });

  return { appByName, apps, installed, deviceInfo };
};

export default listApps;
