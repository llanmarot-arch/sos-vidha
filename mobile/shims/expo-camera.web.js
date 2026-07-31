import { useState } from 'react';

export const CameraType = { back: 'back', front: 'front' };
export const FlashMode = { off: 'off', on: 'on' };

export function useCameraPermissions() {
  const [permission] = useState({ granted: true, status: 'granted' });
  const requestPermission = async () => ({ granted: true, status: 'granted' });
  return [permission, requestPermission];
}

export function CameraView() {
  return null;
}

export default { CameraView, useCameraPermissions, CameraType, FlashMode };
