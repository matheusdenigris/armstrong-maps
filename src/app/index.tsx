import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/logo';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Logo size={112} />
        <View style={styles.wordmark}>
          <Text style={styles.name}>ARMSTRONG</Text>
          <Text style={styles.sub}>MAPS</Text>
        </View>
        <Text style={styles.tagline}>
          A layered map of Mars for planning and following walks on the surface.
        </Text>
      </View>
      <Text style={styles.footer}>NASA SPACE APPS CHALLENGE 2026</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.four,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
  },
  wordmark: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  name: {
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 4,
  },
  sub: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 18,
    letterSpacing: 12,
    // Letter spacing trails the last glyph; this keeps the word optically centred.
    marginRight: -12,
  },
  tagline: {
    color: Colors.textMuted,
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
  },
  footer: {
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    paddingBottom: Spacing.four,
  },
});
