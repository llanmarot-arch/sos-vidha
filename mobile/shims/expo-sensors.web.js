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

class SimulatedSensor extends SimpleEmitter {
  constructor(name) {
    super();
    this.name = name;
    this.interval = null;
    this.updateInterval = 500;
  }

  async isAvailableAsync() {
    return true;
  }

  setUpdateInterval(ms) {
    this.updateInterval = ms;
  }

  async start() {
    if (this.interval) return;
    this.interval = setInterval(() => {
      const t = Date.now() / 1000;
      const payload =
        this.name === 'accelerometer'
          ? {
              x: Math.sin(t) * 0.2,
              y: Math.cos(t) * 0.15,
              z: 9.8 + Math.sin(t * 2) * 0.05,
              timestamp: Date.now(),
            }
          : { x: 0.01, y: 0.02, z: Math.sin(t) * 0.4, timestamp: Date.now() };
      this.emit('update', payload);
    }, this.updateInterval);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

export const Accelerometer = new SimulatedSensor('accelerometer');
export const Gyroscope = new SimulatedSensor('gyroscope');

export async function isAccelerometerAvailableAsync() {
  return true;
}

export async function isGyroscopeAvailableAsync() {
  return true;
}
