import type { Config } from "jest";

const config: Config = {
  collectCoverageFrom: ["src/**/*.ts"],
  coverageDirectory: "./coverage",
  moduleFileExtensions: ["js", "ts"],
  rootDir: ".",
  testEnvironment: "node",
  testMatch: ["**/test/*.spec.ts", "**/test/**/*.spec.ts"],
  transform: {
    "^.+\\.(t|j)s$": [
      "ts-jest",
      {
        "ts-jest": {
          tsconfig: "./tsconfig.test.json",
        },
      },
    ],
  },
  verbose: true,
};

export default config;
