// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const os = require("os");
const { FileStore } = require("metro-cache");

const config = getDefaultConfig(__dirname);

// Use a stable on-disk store (shared across web/android)
const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, ".metro-cache");
config.cacheStores = [
  new FileStore({ root: path.join(root, "cache") }),
];

// Previously hard-capped at 2 workers (very slow Android JS reload).
// Use most CPUs but leave headroom for Gradle / Metro / device bridge.
const cpus = Math.max(1, os.cpus()?.length || 4);
config.maxWorkers = Math.max(2, Math.min(6, cpus - 1));

module.exports = config;
