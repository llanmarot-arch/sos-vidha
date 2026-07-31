import React from 'react';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './screens/HomeScreen';

export default function NativeApp() {
  return (
    <>
      <StatusBar style="light" />
      <HomeScreen />
    </>
  );
}
