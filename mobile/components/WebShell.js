import React, { useEffect } from 'react';
import { View, Platform, useWindowDimensions } from 'react-native';
import { useThemedStyles } from '../theme/useTheme';
import { applyLiveAppearance } from '../theme/appearance';

function createStyles(theme) {
  return {
    desktopRoot: {
      flex: 1,
      minHeight: '100vh',
      backgroundColor: theme.color.canvas,
      alignItems: 'center',
    },
    column: {
      flex: 1,
      width: '100%',
      maxWidth: 560,
      backgroundColor: theme.color.bg0,
      shadowColor: '#14213D',
      shadowOpacity: 0.12,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 0 },
    },
    fluidRoot: { flex: 1, backgroundColor: theme.color.bg0 },
  };
}

export default function WebShell({ children }) {
  const { width } = useWindowDimensions();
  const { theme, styles } = useThemedStyles(createStyles);
  const isDesktop = width >= 768;

  useEffect(() => {
    applyLiveAppearance(theme);
  }, [theme]);

  if (Platform.OS !== 'web' || !isDesktop) {
    return <View style={styles.fluidRoot}>{children}</View>;
  }

  return (
    <View style={styles.desktopRoot}>
      <View style={styles.column}>{children}</View>
    </View>
  );
}
