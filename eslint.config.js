import js from '@eslint/js';
import globals from 'globals';
import { readdirSync, readFileSync } from 'node:fs';

const DASHBOARDS = ['online-retailer', 'auto-parts-supplier', 'supplement-cmo', 'device-quality'];
const TOP_LEVEL_NAME = /^(?:async\s+)?(function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;

// Classic scripts on one page share their top-level names. Each file is told about the names
// its sibling scripts declare, so cross-file references are not reported as undefined.
function dashboardConfigs(dir) {
  const files = readdirSync(`docs/${dir}`).filter(name => name.endsWith('.js'));
  const declared = Object.fromEntries(
    files.map(name => [
      name,
      [...readFileSync(`docs/${dir}/${name}`, 'utf8').matchAll(TOP_LEVEL_NAME)].map(([, kind, global]) => [
        global,
        kind === 'let' || kind === 'var' ? 'writable' : 'readonly'
      ])
    ])
  );
  return files.map(name => {
    const siblings = files.filter(other => other !== name).flatMap(other => declared[other]);
    return {
      files: [`docs/${dir}/${name}`],
      languageOptions: { globals: Object.fromEntries(siblings) }
    };
  });
}

export default [
  { ignores: ['node_modules/', 'docs/charts.js'] },
  js.configs.recommended,
  {
    files: ['docs/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, echarts: 'readonly' }
    },
    // Top-level declarations in a classic script are globals used by sibling scripts.
    rules: { 'no-unused-vars': ['error', { vars: 'local' }] }
  },
  ...DASHBOARDS.flatMap(dashboardConfigs),
  {
    files: ['*.js', 'tests/**/*.mjs', 'tools/**/*.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.node }
  }
];
