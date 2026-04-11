import { Stack } from 'expo-router';
import { COLORS } from '../../src/constants/colors';

export default function LedgerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.pageBg },
        animation: 'slide_from_right',
      }}
    />
  );
}
