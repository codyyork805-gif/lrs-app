import { StyleSheet } from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts } from '@/constants/theme';

export default function ExploreScreen() {
  return (
    <ParallaxScrollView headerBackgroundColor={{ light: '#0B0D0F', dark: '#0B0D0F' }}>
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={{ fontFamily: Fonts.rounded }}>
          Explore
        </ThemedText>

        <ThemedText style={styles.spacer}>
          LRS helps you find calm, locals-first restaurant picks near you.
        </ThemedText>

        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold">How it works</ThemedText>
          <ThemedText style={styles.smallSpacer}>
            Pick a mode, then search. We prefer independent places with real local love.
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold">Modes</ThemedText>
          <ThemedText style={styles.smallSpacer}>
            Top Local Picks: closest and strict.{"\n"}
            Best Available: wider net.{"\n"}
            Hype: farther is allowed when it’s worth it.
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold">Note</ThemedText>
          <ThemedText style={styles.smallSpacer}>
            Results can vary based on location accuracy and available place data.
          </ThemedText>
        </ThemedView>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  spacer: {
    marginTop: 10,
    marginBottom: 14,
  },
  smallSpacer: {
    marginTop: 8,
  },
  card: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
});
