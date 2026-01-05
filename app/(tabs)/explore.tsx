import { Platform, StyleSheet } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Collapsible } from '@/components/ui/collapsible';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';

export default function TabTwoScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#808080"
          name="chevron.left.forwardslash.chevron.right"
          style={styles.headerImage}
        />
      }
    >
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title" style={{ fontFamily: Fonts.rounded }}>
          Explore
        </ThemedText>
      </ThemedView>

      <ThemedText>This screen is intentionally minimal.</ThemedText>

      <Collapsible title="Links">
        <ExternalLink href="https://docs.expo.dev/router/introduction">
          <ThemedText type="link">Expo Router docs</ThemedText>
        </ExternalLink>

        <ExternalLink href="https://reactnative.dev/docs/images">
          <ThemedText type="link">React Native images docs</ThemedText>
        </ExternalLink>
      </Collapsible>

      <Collapsible title="Platform note">
        <ThemedText>
          {Platform.OS === 'ios'
            ? 'iOS is supported.'
            : 'Android and web are supported.'}
        </ThemedText>
      </Collapsible>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
});
