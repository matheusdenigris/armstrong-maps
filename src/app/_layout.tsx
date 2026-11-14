import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import { Michroma_400Regular } from '@expo-google-fonts/michroma';
import { SpaceGrotesk_400Regular } from '@expo-google-fonts/space-grotesk';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { Colors } from '@/constants/theme';
import { MISSION_STORAGE_KEY, useMission } from '@/state/mission';

// Keep native's launch screen up until the mission-control type system is available.
void SplashScreen.preventAutoHideAsync();

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
  const [fontsLoaded, fontError] = useFonts({
    Michroma: Michroma_400Regular,
    SpaceGrotesk: SpaceGrotesk_400Regular,
    JetBrainsMono: JetBrainsMono_400Regular,
  });

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

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontError, fontsLoaded]);

  // Web is rendered ahead of time. It must keep its meaningful HTML while the browser adds the
  // font faces, while native can keep its launch screen until the same faces are ready.
  if (Platform.OS !== 'web' && !fontsLoaded && !fontError) {
    return null;
  }

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
