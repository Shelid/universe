export interface FlightControlPrefs {
  /** true = Seta ↓ sobe / Seta ↑ desce; false = Seta ↑ sobe / Seta ↓ desce */
  invertPitchArrows: boolean;
  /** false = Seta ← inclina esquerda (CCW) / Seta → inclina direita (CW); true = invertido */
  invertRollArrows: boolean;
}

const STORAGE_KEY = 'universe_explorer_flight_ctrl_prefs_v1';

export const DEFAULT_FLIGHT_CONTROL_PREFS: FlightControlPrefs = {
  invertPitchArrows: true,
  invertRollArrows: false,
};

export function loadSavedFlightControlPrefs(): FlightControlPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FLIGHT_CONTROL_PREFS };
    const parsed = JSON.parse(raw) as Partial<FlightControlPrefs>;
    return {
      invertPitchArrows:
        typeof parsed.invertPitchArrows === 'boolean'
          ? parsed.invertPitchArrows
          : DEFAULT_FLIGHT_CONTROL_PREFS.invertPitchArrows,
      invertRollArrows:
        typeof parsed.invertRollArrows === 'boolean'
          ? parsed.invertRollArrows
          : DEFAULT_FLIGHT_CONTROL_PREFS.invertRollArrows,
    };
  } catch {
    return { ...DEFAULT_FLIGHT_CONTROL_PREFS };
  }
}

export function saveFlightControlPrefs(prefs: FlightControlPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage errors
  }
}
