const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 모노레포: 루트의 node_modules도 탐색 대상에 포함
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];
// node_modules 내부 파일에서 require할 때도 nodeModulesPaths를 사용하도록 강제
// (기본값 false: 파일 위치 기준 디렉토리 탐색 → 모노레포에서 누락 발생)
config.resolver.disableHierarchicalLookup = true;

module.exports = withNativeWind(config, { input: "./global.css" });
