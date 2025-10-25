/** Jest config for the CPS package (TypeScript via ts-jest) */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.test.tsx', '**/tests/**/*.test.cjs', '**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/dist/'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  verbose: true,
};
