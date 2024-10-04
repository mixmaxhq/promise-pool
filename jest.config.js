module.exports = {
  preset: 'ts-jest',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.js'],
  coverageDirectory: 'coverage',
  testRegex: '/((test|spec)s?|src)/.*([Tt]est|[Ss]pec)\\.(ts|js)$',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^mongodbMapped$': `mongodb${process.env.DRIVER_VERSION || ''}`,
  },
  testTimeout: 15000,
};
