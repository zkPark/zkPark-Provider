const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

// Get the default Expo Metro config
const config = getDefaultConfig(__dirname);

// Add node-libs-expo for MetaMask compatibility
config.resolver.extraNodeModules = {
  ...require("node-libs-expo"),
};

// Add transformer options for performance
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

// Apply NativeWind configuration
module.exports = withNativeWind(config, { input: "./global.css" });
