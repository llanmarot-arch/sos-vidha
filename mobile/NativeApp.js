import React from 'react';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './screens/HomeScreen';
import { useTheme } from './theme/useTheme';

export default function NativeApp() {
  const theme = useTheme();
  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <HomeScreen />
    </>
  );
}
