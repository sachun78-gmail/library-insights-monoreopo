/**
 * 모노레포 환경에서 Gradle 빌드 시 Expo CLI가 모노레포 루트를
 * project root로 잘못 감지하는 문제를 해결하기 위한 래퍼.
 * CWD를 apps/mobile 로 변경한 뒤 실제 Expo CLI를 실행한다.
 */
const path = require('path');
process.chdir(path.resolve(__dirname, '..'));
require(require.resolve('@expo/cli'));
