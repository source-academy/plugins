module.exports = {
  rootDir: ".",
  preset: "ts-jest/presets/js-with-ts-esm",
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "<rootDir>/tsconfig.json",
      },
    ],
  },
  transformIgnorePatterns: [
    "node_modules/(?!(py-slang)/)"
  ],
  testPathIgnorePatterns: ["/dist/"],
  coverageReporters: ["lcov"],
};