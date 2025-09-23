import 'react-native-url-polyfill/auto';
import { Buffer } from 'buffer';
import process from 'process';

global.Buffer = Buffer;
global.process = process;

import { registerRootComponent } from "expo";
import { ExpoRoot } from "expo-router";
import 'react-native-gesture-handler';
import 'react-native-reanimated';

export default function App(props) {
  const ctx = require.context("./app");
  return <ExpoRoot context={ctx} {...props} />;
}

registerRootComponent(App);
