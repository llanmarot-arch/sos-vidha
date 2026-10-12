class SimpleEmitter {
  constructor() {
    this.listeners = new Set();
  }

  addListener(_event, callback) {
    this.listeners.add(callback);
    return { remove: () => this.listeners.delete(callback) };
  }

  emit(_event, payload) {
    this.listeners.forEach((cb) => cb(payload));
  }
}

class UnavailableSensor extends SimpleEmitter {
  setUpdateInterval() {}

  async isAvailableAsync() {
    return false;
  }

  async start() {}

  stop() {}

  addListener() {
    return { remove() {} };
  }
}

export const Accelerometer = new UnavailableSensor();
export const Gyroscope = new UnavailableSensor();

export async function isAccelerometerAvailableAsync() {
  return false;
}

export async function isGyroscopeAvailableAsync() {
  return false;
}
