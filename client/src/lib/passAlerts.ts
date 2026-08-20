export const PASS_ALERT_WINDOW_MS = 10 * 60_000;
const FAVORABLE_PASS_DISTANCE_KM = 2500;

type PassAlertEligibilityInput = {
  enabled: boolean;
  permission: NotificationPermission | "unsupported";
  timestampSeconds: number;
  distanceKm: number;
  nowMs: number;
  alreadyAlerted: boolean;
};

export function isFavorablePass(distanceKm: number) {
  return distanceKm < FAVORABLE_PASS_DISTANCE_KM;
}

export function shouldSendPassAlert({ enabled, permission, timestampSeconds, distanceKm, nowMs, alreadyAlerted }: PassAlertEligibilityInput) {
  const millisecondsUntilPass = timestampSeconds * 1000 - nowMs;
  return enabled && permission === "granted" && !alreadyAlerted && isFavorablePass(distanceKm) && millisecondsUntilPass >= 0 && millisecondsUntilPass <= PASS_ALERT_WINDOW_MS;
}

export function createPassAlertKey(timestampSeconds: number, latitude: number, longitude: number) {
  return `orbita-pass-alert:${timestampSeconds}:${Math.round(latitude * 10)}:${Math.round(longitude * 10)}`;
}
