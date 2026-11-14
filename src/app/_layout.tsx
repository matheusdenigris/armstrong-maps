import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Colors } from '@/constants/theme';
import { useMission } from '@/state/mission';

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.background,
    card: Colors.surface,
    border: Colors.border,
    text: Colors.text,
    primary: Colors.nav,
  },
};

export default function RootLayout() {
  // Bring back the plan saved on this device.
  useEffect(() => {
    void useMission.persist.rehydrate();
  }, []);

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          title: 'Armstrong Maps',
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      />
    </ThemeProvider>
  );
}
