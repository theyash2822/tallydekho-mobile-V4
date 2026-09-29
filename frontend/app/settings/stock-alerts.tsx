/**
 * Legacy route — Low Stock & Expiry Alerts now live under Stocks → Settings → Alerts.
 * Keep this file so old deep links / bookmarks do not 404.
 */
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../src/constants/colors';

export default function StockAlertsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/stocks/settings?section=alerts');
  }, [router]);

  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={COLORS.brandPrimary} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.pageBg },
});
