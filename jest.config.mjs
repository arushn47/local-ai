export default {
    testEnvironment: 'node',
    transform: {},
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1'
    },
    testMatch: ['**/__tests__/**/*.test.js'],
    collectCoverageFrom: [
        'lib/**/*.js',
        '!lib/**/*.test.js'
    ]
};
