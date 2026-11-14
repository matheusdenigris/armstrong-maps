import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { Colors } from '@/constants/theme';
import { MISSION_STORAGE_KEY, useMission } from '@/state/mission';

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
    if (Platform.OS !== 'web') return;
    // The ship console and the astronaut's visor run in two tabs. When one saves the mission,
    // the browser tells the other, and it reads the saved state again.
    const follow = (event: StorageEvent) => {
      if (event.key === MISSION_STORAGE_KEY) void useMission.persist.rehydrate();
    };
    window.addEventListener('storage', follow);
    return () => window.removeEventListener('storage', follow);
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
