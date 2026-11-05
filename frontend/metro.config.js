// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");
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

// Web: tslib 1.x's "import" entry (modules/index.js) default-imports its CommonJS build, which arrives without a
// default export in the web bundle and crashes at start-up. Its ES module build (tslib.es6.js) has the same named
// exports. tslib 2.x ships tslib.es6.mjs for that entry and is left alone.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "tslib") {
    const dir = path.dirname(require.resolve("tslib", { paths: [path.dirname(context.originModulePath)] }));
    const es6 = path.join(dir, "tslib.es6.js");
    if (fs.existsSync(es6) && !fs.existsSync(path.join(dir, "tslib.es6.mjs"))) return { type: "sourceFile", filePath: es6 };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
