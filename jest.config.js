const jestCoverageConfig = require('@mixmaxhq/jest-coverage-config/typescript');
const jestJunitConfig = process.env.CI && require('@mixmaxhq/jest-junit-config');

module.exports = {
  clearMocks: true,
  ...jestJunitConfig,
  ...jestCoverageConfig,
  collectCoverageFrom: ['src/**/*.[tj]s', '!src/**/*.fixtures.[tj]s', '!**/src/**/*.test.[tj]s'],
};
