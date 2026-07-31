export async function requestPermissionsAsync() {
  return { status: 'granted', granted: true };
}

export async function getPermissionsAsync() {
  return { status: 'granted', granted: true };
}

export async function scheduleNotificationAsync() {
  return 'mock-notification-id';
}

export async function cancelAllScheduledNotificationsAsync() {
  return true;
}

export const AndroidImportance = { MAX: 5 };

export default {
  requestPermissionsAsync,
  getPermissionsAsync,
  scheduleNotificationAsync,
  cancelAllScheduledNotificationsAsync,
};
