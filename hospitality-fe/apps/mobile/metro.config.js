const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
// The workspace root is two directories up (hospitality-fe)
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Tell Metro to watch all files in the monorepo workspace
config.watchFolders = [workspaceRoot];

// Tell Metro to resolve dependencies from both the local and workspace root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = withNativeWind(config, { input: "./globals.css" });
