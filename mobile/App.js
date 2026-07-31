import React from 'react';
import { Platform } from 'react-native';
import NativeApp from './NativeApp';
import WebApp from './web/WebApp';

export default function App() {
  if (Platform.OS === 'web') {
    return <WebApp />;
  }
  return <NativeApp />;
}
