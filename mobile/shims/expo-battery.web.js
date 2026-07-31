let level = 0.78;

export async function getBatteryLevelAsync() {
  if (typeof navigator !== 'undefined' && navigator.getBattery) {
    try {
      const battery = await navigator.getBattery();
      level = battery.level;
      return battery.level;
    } catch {
      return level;
    }
  }
  return level;
}

export async function getBatteryStateAsync() {
  return 2;
}

export async function isAvailableAsync() {
  return true;
}

export const BatteryState = {
  UNKNOWN: 0,
  UNPLUGGED: 1,
  CHARGING: 2,
  FULL: 3,
};
