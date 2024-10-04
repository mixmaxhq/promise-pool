const jestJunitConfig = process.env.CI && require('@mixmaxhq/jest-junit-config');

const jestCoverageConfig = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  testRegex: '/((test|spec)s?|src)/.*([Tt]est|[Ss]pec)\\.(ts|js)$',
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.{ts,js}', '!src/**/*.d.ts'],
  preset: 'ts-jest',
};

module.exports = {
  clearMocks: true,
  ...jestJunitConfig,
  ...jestCoverageConfig,
  collectCoverageFrom: ['src/**/*.[tj]s', '!src/**/*.fixtures.[tj]s', '!**/src/**/*.test.[tj]s'],
};
