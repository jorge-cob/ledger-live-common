// @flow
/* eslint-disable camelcase */

import { log } from "@ledgerhq/logs";
import URL from "url";
import {
  DeviceOnDashboardExpected,
  LatestMCUInstalledError,
  ManagerAppAlreadyInstalledError,
  ManagerAppRelyOnBTCError,
  ManagerDeviceLockedError,
  ManagerNotEnoughSpaceError,
  ManagerUninstallBTCDep,
  UserRefusedAllowManager,
  UserRefusedFirmwareUpdate
} from "@ledgerhq/errors";
import type Transport from "@ledgerhq/hw-transport";
import { throwError, Observable } from "rxjs";
import { catchError } from "rxjs/operators";
import { version as livecommonversion } from "../../package.json";
import { createDeviceSocket } from "./socket";
import network from "../network";
import { getEnv } from "../env";
import type {
  OsuFirmware,
  DeviceVersion,
  FinalFirmware,
  ApplicationVersion,
  Application,
  Category,
  Id,
  McuVersion,
  GenuineCheckEvent
} from "../types/manager";
import { makeLRUCache } from "../cache";

const ALLOW_MANAGER_APDU_DEBOUNCE = 500;

const remapSocketError = (context?: string) =>
  catchError((e: Error) => {
    if (!e || !e.message) return throwError(e);
    if (e.message.startsWith("invalid literal")) {
      // hack to detect the case you're not in good condition (not in dashboard)
      return throwError(new DeviceOnDashboardExpected());
    }
    const status = e.message.slice(e.message.length - 4);
    switch (status) {
      case "6a80":
      case "6a81":
        return throwError(new ManagerAppAlreadyInstalledError());
      case "6982":
        return throwError(new ManagerDeviceLockedError());
      case "6a83":
        if (context === "uninstall-app") {
          return throwError(new ManagerUninstallBTCDep());
        }
        return throwError(new ManagerAppRelyOnBTCError());
      case "6a84":
        return throwError(new ManagerNotEnoughSpaceError());
      case "6a85":
        if (context === "firmware" || context === "mcu") {
          return throwError(new UserRefusedFirmwareUpdate());
        }
        return throwError(new ManagerNotEnoughSpaceError());
      case "6985":
        if (context === "firmware" || context === "mcu") {
          return throwError(new UserRefusedFirmwareUpdate());
        }
        return throwError(new ManagerNotEnoughSpaceError());
      default:
        return throwError(e);
    }
  });

const applicationsByDevice: (params: {
  provider: number,
  current_se_firmware_final_version: Id,
  device_version: Id
}) => Promise<Array<ApplicationVersion>> = makeLRUCache(
  async params => {
    const r = await network({
      method: "POST",
      url: URL.format({
        pathname: `${getEnv("MANAGER_API_BASE")}/get_apps`,
        query: { livecommonversion }
      }),
      data: params
    });
    return r.data.application_versions;
  },
  p =>
    `${p.provider}_${p.current_se_firmware_final_version}_${p.device_version}`
);

const listApps: () => Promise<Array<Application>> = makeLRUCache(
  async () => {
    const r = await network({
      method: "GET",
      url: URL.format({
        pathname: `${getEnv("MANAGER_API_BASE")}/applications`,
        query: { livecommonversion }
      })
    });
    return r.data;
  },
  () => ""
);

const listCategories = async (): Promise<Array<Category>> => {
  const r = await network({
    method: "GET",
    url: URL.format({
      pathname: `${getEnv("MANAGER_API_BASE")}/categories`,
      query: { livecommonversion }
    })
  });
  return r.data;
};

const getMcus: () => Promise<*> = makeLRUCache(
  async () => {
    const { data } = await network({
      method: "GET",
      url: URL.format({
        pathname: `${getEnv("MANAGER_API_BASE")}/mcu_versions`,
        query: { livecommonversion }
      })
    });
    return data;
  },
  () => ""
);

const getLatestFirmware: ({
  current_se_firmware_final_version: Id,
  device_version: Id,
  provider: number
}) => Promise<?OsuFirmware> = makeLRUCache(
  async ({ current_se_firmware_final_version, device_version, provider }) => {
    const nonce = ?hashfunction?(getEnv("USER_ID")

    const {
      data
    }: {
      data: {
        result: string,
        se_firmware_osu_version: OsuFirmware
      }
    } = await network({
      method: "POST",
      url: URL.format({
        pathname: `${getEnv("MANAGER_API_BASE")}/get_latest_firmware`,
        query: { livecommonversion, nonce }
      }),
      data: {
        current_se_firmware_final_version,
        device_version,
        provider
      }
    });
    if (data.result === "null") {
      return null;
    }
    return data.se_firmware_osu_version;
  },
  a =>
    `${a.current_se_firmware_final_version}_${a.device_version}_${a.provider}`
);

const getCurrentOSU: (input: {
  version: string,
  deviceId: string | number,
  provider: number
}) => Promise<OsuFirmware> = makeLRUCache(
  async input => {
    const { data } = await network({
      method: "POST",
      url: URL.format({
        pathname: `${getEnv("MANAGER_API_BASE")}/get_osu_version`,
        query: { livecommonversion }
      }),
      data: {
        device_version: input.deviceId,
        version_name: `${input.version}-osu`,
        provider: input.provider
      }
    });
    return data;
  },
  a => `${a.version}_${a.deviceId}_${a.provider}`
);

const getNextBLVersion = async (
  mcuversion: string | number
): Promise<McuVersion> => {
  const { data }: { data: McuVersion | "default" } = await network({
    method: "GET",
    url: URL.format({
      pathname: `${getEnv("MANAGER_API_BASE")}/mcu_versions/${mcuversion}`,
      query: { livecommonversion }
    })
  });

  if (data === "default" || !data.name) {
    throw new LatestMCUInstalledError(
      "there is no next mcu version to install"
    );
  }
  return data;
};

const getCurrentFirmware: (input: {
  version: string,
  deviceId: string | number,
  provider: number
}) => Promise<FinalFirmware> = makeLRUCache(
  async input => {
    const { data }: { data: FinalFirmware } = await network({
      method: "POST",
      url: URL.format({
        pathname: `${getEnv("MANAGER_API_BASE")}/get_firmware_version`,
        query: { livecommonversion }
      }),
      data: {
        device_version: input.deviceId,
        version_name: input.version,
        provider: input.provider
      }
    });
    return data;
  },
  a => `${a.version}_${a.deviceId}_${a.provider}`
);

const getFinalFirmwareById: (
  id: number
) => Promise<FinalFirmware> = makeLRUCache(
  async id => {
    const { data }: { data: FinalFirmware } = await network({
      method: "GET",
      url: URL.format({
        pathname: `${getEnv("MANAGER_API_BASE")}/firmware_final_versions/${id}`,
        query: { livecommonversion }
      })
    });
    return data;
  },
  id => String(id)
);

const getDeviceVersion: (
  targetId: string | number,
  provider: number
) => Promise<DeviceVersion> = makeLRUCache(
  async (targetId, provider) => {
    const { data }: { data: DeviceVersion } = await network({
      method: "POST",
      url: URL.format({
        pathname: `${getEnv("MANAGER_API_BASE")}/get_device_version`,
        query: { livecommonversion }
      }),
      data: {
        provider,
        target_id: targetId
      }
    });
    return data;
  },
  (targetId, provider) => `${targetId}_${provider}`
);

const install = (
  transport: Transport<*>,
  context: string,
  params: *
): Observable<*> => {
  log("manager", "install " + context, params);
  return createDeviceSocket(transport, {
    url: URL.format({
      pathname: `${getEnv("BASE_SOCKET_URL")}/install`,
      query: { ...params, livecommonversion }
    }),
    ignoreWebsocketErrorDuringBulk: true
  }).pipe(remapSocketError(context));
};

const genuineCheck = (
  transport: Transport<*>,
  { targetId, perso }: { targetId: *, perso: * }
): Observable<GenuineCheckEvent> => {
  log("manager", "genuineCheck", { targetId, perso });
  return createDeviceSocket(transport, {
    url: URL.format({
      pathname: `${getEnv("BASE_SOCKET_URL")}/genuine`,
      query: { targetId, perso, livecommonversion }
    })
    // $FlowFixMe
  }).pipe(input =>
    Observable.create(o => {
      let timeout;
      let requested;
      const sub = input.subscribe({
        complete: () => {
          o.complete();
        },
        error: e => {
          o.error(e);
        },
        next: e => {
          if (timeout) {
            clearTimeout(timeout);
            timeout = null;
          }
          if (e.type === "result") {
            o.next(e);
          } else if (e.nonce === 3) {
            if (e.type === "exchange-before") {
              timeout = setTimeout(() => {
                o.next({ type: "allow-manager-requested" });
                requested = true;
              }, ALLOW_MANAGER_APDU_DEBOUNCE);
            } else if (e.type === "exchange") {
              if (e.status.toString("hex") === "6985") {
                o.error(new UserRefusedAllowManager());
                return;
              }
              if (requested) {
                o.next({ type: "allow-manager-accepted" });
              }
            }
          }
        }
      });
      return sub;
    })
  );
};

const installMcu = (
  transport: Transport<*>,
  context: string,
  { targetId, version }: { targetId: *, version: * }
): Observable<*> => {
  log("manager", "installMCU " + context, { targetId, version });
  return createDeviceSocket(transport, {
    url: URL.format({
      pathname: `${getEnv("BASE_SOCKET_URL")}/mcu`,
      query: { targetId, version, livecommonversion }
    }),
    ignoreWebsocketErrorDuringBulk: true
  }).pipe(remapSocketError(context));
};

const API = {
  applicationsByDevice,
  listApps,
  listCategories,
  getMcus,
  getLatestFirmware,
  getCurrentOSU,
  getNextBLVersion,
  getCurrentFirmware,
  getFinalFirmwareById,
  getDeviceVersion,
  install,
  genuineCheck,
  installMcu
};

export default API;
