import 'react-native';

declare module 'react-native' {
  namespace StyleSheet {
    // Runtime API exists; some Expo RN typings omit it.
    export const absoluteFillObject: AbsoluteFillStyle;
  }
}
