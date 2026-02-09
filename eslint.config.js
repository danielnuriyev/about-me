import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';

export default [
	js.configs.recommended,
	...svelte.configs.recommended,
	{
		files: ['backend/**/*.js'],
		languageOptions: {
			globals: {
				console: 'readonly',
				process: 'readonly',
				require: 'readonly',
				exports: 'writable',
				TextDecoder: 'readonly'
			}
		}
	},
	{
		files: ['src/**/*.svelte'],
		languageOptions: {
			globals: {
				fetch: 'readonly',
				setTimeout: 'readonly',
				document: 'readonly'
			}
		}
	},
	{
		ignores: [
			'node_modules/',
			'.svelte-kit/',
			'build/',
			'dist/',
			'backend/lambda/node_modules/',
			'backend/lambda-chat/node_modules/',
			'infrastructure/bin/',
			'infrastructure/.pulumi/',
			'backend/lambda/lambda-function.zip',
			'backend/lambda-chat/chat-lambda-function.zip'
		]
	}
];