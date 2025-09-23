const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("cjs");

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  stream: path.resolve(__dirname, "mock-stream.js"),
  net: path.resolve(__dirname, "mock-net.js"),
  zlib: path.resolve(__dirname, "mock-zlib.js"),
  '@supabase/realtime-js': path.resolve(__dirname, "empty.js"),
  tls: path.resolve(__dirname, "mock-tls.js"),
  http: require.resolve("stream-http"),
  https: require.resolve("https-browserify"),
  buffer: require.resolve("buffer/"),
  events: require.resolve("events/"),
  process: require.resolve("process/browser"),
  crypto: require.resolve("crypto-browserify"),
};

module.exports = config;
