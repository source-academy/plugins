module.exports = {
  preset: "ts-jest/presets/js-with-ts-esm",
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "src/tsconfig.json",
      },
    ],
  },
  testPathIgnorePatterns: [".*?dist/"],
  coverageReporters: ["lcov"],
};