import { FlatCompat } from '@eslint/eslintrc';

// eslint-config-next 15 всё ещё в старом формате (extends), ESLint 9 читает
// только flat config — мостим через FlatCompat. next lint снят с поддержки
// и без конфига падает в интерактивный вопрос, поэтому конфиг явный.
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'scripts/.cache/**', 'public/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Фото идут с krisha/korter напрямую: next/image гнал бы их через
      // оптимизатор Vercel — на Hobby это лимит и лишняя задержка на каждую
      // картинку в списке из тысяч квартир. <img> с loading="lazy" — решение.
      '@next/next/no-img-element': 'off',
      // maplibre отдаёт свойства фич и выражения стилей нетипизированными;
      // типизировать каждую — работа без изменения поведения. Предупреждение,
      // чтобы новые any было видно, но сборку они не валят.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];

export default config;
