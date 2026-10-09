// EventBus ultra-liviano nativo para navegador sin dependencias de Node
class SimpleEventEmitter {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error en evento ${event}:`, err);
        }
      });
    }
  }
}

export const gameEvents = new SimpleEventEmitter();

export const EVENTS = {
  AGENT_SELECTED: 'AGENT_SELECTED',
  AGENT_DESELECTED: 'AGENT_DESELECTED',
  OFFICE_RESET: 'OFFICE_RESET',
  NEW_TELEMETRY: 'NEW_TELEMETRY'
};
