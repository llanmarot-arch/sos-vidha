export async function hasHardwareAsync() {
  return false;
}

export async function isEnrolledAsync() {
  return false;
}

export async function authenticateAsync() {
  return { success: false, error: 'not_available' };
}

export const AuthenticationType = {
  FINGERPRINT: 1,
  FACIAL_RECOGNITION: 2,
};
