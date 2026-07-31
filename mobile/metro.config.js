const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const WEB_SHIMS = {
  'expo-location': 'shims/expo-location.web.js',
  'expo-haptics': 'shims/expo-haptics.web.js',
  'expo-sensors': 'shims/expo-sensors.web.js',
  'expo-local-authentication': 'shims/expo-local-authentication.web.js',
  'expo-battery': 'shims/expo-battery.web.js',
  'expo-task-manager': 'shims/expo-task-manager.web.js',
  'expo-notifications': 'shims/expo-notifications.web.js',
  'expo-camera': 'shims/expo-camera.web.js',
  'react-native-maps': 'shims/react-native-maps.web.js',
};

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_SHIMS[moduleName]) {
    return {
      filePath: path.resolve(__dirname, WEB_SHIMS[moduleName]),
      type: 'sourceFile',
    };
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
