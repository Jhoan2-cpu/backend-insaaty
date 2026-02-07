// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
  rules: {
      // --- REGLAS CRÍTICAS PARA NESTJS ---
      
      // Evita que olvides poner 'await' en base de datos o llamadas externas
      '@typescript-eslint/no-floating-promises': 'warn', 
      
      // Permite usar 'any' pero te avisa (ideal para desarrollo rápido)
      '@typescript-eslint/no-explicit-any': 'warn',

      // --- REGLAS DE SEGURIDAD (Las marcas rojas) ---
      // Las bajamos a 'warn' para que no bloqueen tu compilación, 
      // pero sigas viendo dónde hay peligro.
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',

      // --- REGLAS DE ESTILO NESTJS ---
      // A veces en NestJS necesitamos interfaces vacías o nombres específicos
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      // Configuración de Prettier para evitar conflictos de línea (Windows/Mac)
      'prettier/prettier': ['error', { endOfLine: 'off' }],
      
      // Permite definir variables que no usas si empiezan con guion bajo (ej: _req)
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
);
