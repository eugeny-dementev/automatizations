/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
export default {
  transform: {
    '\\.[jt]sx?$': 'ts-jest'
  },
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  moduleNameMapper: {
    '(.+)\\.js': '$1'
  },
  extensionsToTreatAsEsm: ['.ts']
};
