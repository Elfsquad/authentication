/** @type {import('@ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  globals: {
    window: {
      localStorage: {
        getItem: () => null,
      },
    },
    localStorage: {
      getItem: () => null,
      setItem: () => null,
      removeItem: () => null,
    },
    location: {},
  },
};
