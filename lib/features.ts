/** Organization feature flags stored under organizations.settings.features. */

type SettingsShape = { features?: { register_reading?: boolean } };

/** Register (X/Z) Reading is shown by default; hidden only when explicitly off. */
export function isRegisterReadingEnabled(settings: unknown): boolean {
  const s = (settings ?? {}) as SettingsShape;
  return s.features?.register_reading !== false;
}
