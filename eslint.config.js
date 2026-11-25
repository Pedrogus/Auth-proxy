import js from '@eslint/js';
import globals from 'globals';

export default [{
    ignores: ['node_modules/**', 'coverage/', 'data/', 'logs/'],
}, 
js.configs.recommended, 
{
    files: ['**/*.js'],
    languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        globals: {
            ...globals.node},
    },
    rules: {
        'prefer-const': 'error',
        eqeqeq: ['error', 'always'],
        'no-var': 'error',
        'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        'no-console': 'warn',


        'no-eval': 'error',
        'no-implied-eval': 'error',
        'no-new-func': 'error',
        },
    },
];