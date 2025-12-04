#!/usr/bin/env node

/**
 * Create a new Narrative app
 *
 * Usage: npm run create-app <app-name> [options]
 *
 * Options:
 *   --port <number>  Development server port (auto-assigned if not specified)
 *   --title <string> App title for HTML (defaults to formatted app name)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

// Parse arguments
const args = process.argv.slice(2);
if (args.length === 0 || args[0].startsWith('-')) {
  console.error('Usage: npm run create-app <app-name> [--port <number>] [--title <string>]');
  console.error('');
  console.error('Examples:');
  console.error('  npm run create-app voting-app');
  console.error('  npm run create-app voting-app --port 3005 --title "Voting App"');
  process.exit(1);
}

const appName = args[0];
const appDir = path.join(ROOT_DIR, appName);

// Parse options
let port = null;
let title = null;
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) {
    port = parseInt(args[++i], 10);
  } else if (args[i] === '--title' && args[i + 1]) {
    title = args[++i];
  }
}

// Validate app name
if (!/^[a-z][a-z0-9-]*$/.test(appName)) {
  console.error('Error: App name must start with a letter and contain only lowercase letters, numbers, and hyphens.');
  process.exit(1);
}

if (appName === 'lib' || appName === 'shared-config' || appName === 'scripts' || appName === 'node_modules') {
  console.error(`Error: "${appName}" is a reserved name.`);
  process.exit(1);
}

// Check if directory already exists
if (fs.existsSync(appDir)) {
  console.error(`Error: Directory "${appName}" already exists.`);
  process.exit(1);
}

// Auto-assign port if not specified
if (!port) {
  const existingApps = fs.readdirSync(ROOT_DIR).filter(dir => {
    const pkgPath = path.join(ROOT_DIR, dir, 'package.json');
    return fs.existsSync(pkgPath) && dir !== 'lib' && dir !== 'node_modules';
  });

  const usedPorts = new Set();
  for (const app of existingApps) {
    const viteConfigPath = path.join(ROOT_DIR, app, 'vite.config.ts');
    if (fs.existsSync(viteConfigPath)) {
      const content = fs.readFileSync(viteConfigPath, 'utf-8');
      const match = content.match(/port:\s*(\d+)/);
      if (match) {
        usedPorts.add(parseInt(match[1], 10));
      }
    }
  }

  port = 3000;
  while (usedPorts.has(port)) {
    port++;
  }
}

// Default title from app name
if (!title) {
  title = appName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

console.log(`Creating new app: ${appName}`);
console.log(`  Port: ${port}`);
console.log(`  Title: ${title}`);
console.log('');

// Create directory structure
fs.mkdirSync(appDir);
fs.mkdirSync(path.join(appDir, 'src'));
fs.mkdirSync(path.join(appDir, 'src', 'components'));
fs.mkdirSync(path.join(appDir, 'src', 'schema'));
fs.mkdirSync(path.join(appDir, 'src', 'hooks'));

// Create package.json
const packageJson = {
  name: appName,
  version: '0.1.0',
  private: true,
  type: 'module',
  scripts: {
    dev: 'vite --host',
    build: 'tsc && vite build',
    preview: 'vite preview --host',
    lint: 'eslint .',
  },
  dependencies: {
    '@automerge/automerge': '^2.2.8',
    '@automerge/automerge-repo': '^1.2.1',
    '@automerge/automerge-repo-network-websocket': '^1.2.1',
    '@automerge/automerge-repo-react-hooks': '^1.2.1',
    '@automerge/automerge-repo-storage-indexeddb': '^1.2.1',
    'narrative-ui': '*',
    react: '^18.3.0',
    'react-dom': '^18.3.0',
  },
  devDependencies: {
    '@types/react': '^18.3.0',
    '@types/react-dom': '^18.3.0',
    '@vitejs/plugin-react': '^4.3.0',
    autoprefixer: '^10.4.14',
    daisyui: '^4.12.0',
    postcss: '^8.4.24',
    tailwindcss: '^3.4.0',
    typescript: '^5.6.0',
    vite: '^7.0.0',
    'vite-plugin-top-level-await': '^1.6.0',
    'vite-plugin-wasm': '^3.5.0',
  },
};

fs.writeFileSync(
  path.join(appDir, 'package.json'),
  JSON.stringify(packageJson, null, 2) + '\n'
);

// Create vite.config.ts
const viteConfig = `import { createViteConfig } from '../shared-config/vite.base';

export default createViteConfig({
  appName: '${appName}',
  port: ${port},
});
`;
fs.writeFileSync(path.join(appDir, 'vite.config.ts'), viteConfig);

// Create tailwind.config.js
const tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../lib/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: ['light', 'dark'],
    darkTheme: 'dark',
    base: true,
    styled: true,
    utils: true,
  },
};
`;
fs.writeFileSync(path.join(appDir, 'tailwind.config.js'), tailwindConfig);

// Create postcss.config.js
const postcssConfig = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
fs.writeFileSync(path.join(appDir, 'postcss.config.js'), postcssConfig);

// Create tsconfig.json
const tsconfig = {
  extends: '../shared-config/tsconfig.app.json',
  include: ['src'],
};
fs.writeFileSync(
  path.join(appDir, 'tsconfig.json'),
  JSON.stringify(tsconfig, null, 2) + '\n'
);

// Create index.html
const indexHtml = `<!doctype html>
<html lang="en" data-theme="light">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/logo.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
fs.writeFileSync(path.join(appDir, 'index.html'), indexHtml);

// Create src/main.tsx
const mainTsx = `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
`;
fs.writeFileSync(path.join(appDir, 'src', 'main.tsx'), mainTsx);

// Create src/index.css
const indexCss = `@tailwind base;
@tailwind components;
@tailwind utilities;
`;
fs.writeFileSync(path.join(appDir, 'src', 'index.css'), indexCss);

// Create schema name from app name (e.g., "voting-app" -> "VotingApp")
const pascalName = appName
  .split('-')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join('');

const camelName = pascalName.charAt(0).toLowerCase() + pascalName.slice(1);

// Create src/schema/index.ts
const schemaTs = `import type { BaseDocument, UserIdentity } from 'narrative-ui';
import { createBaseDocument } from 'narrative-ui';

/**
 * ${title} app-specific data
 *
 * Add your app-specific types and data structures here.
 */
export interface ${pascalName}Data {
  // Add your app-specific fields here
  // Example:
  // items: Record<string, Item>;
}

/**
 * Full ${title} Document
 */
export type ${pascalName}Doc = BaseDocument<${pascalName}Data>;

/**
 * Creates an empty ${title} document
 *
 * @param creatorIdentity - Identity of the user creating the document
 */
export function createEmpty${pascalName}Doc(
  creatorIdentity: UserIdentity
): ${pascalName}Doc {
  return createBaseDocument<${pascalName}Data>(
    {
      // Initialize your app-specific fields here
    },
    creatorIdentity
  );
}
`;
fs.writeFileSync(path.join(appDir, 'src', 'schema', 'index.ts'), schemaTs);

// Create src/App.tsx
const appTsx = `import { useRepository, AppShell } from 'narrative-ui';
import { createEmpty${pascalName}Doc } from './schema';
import { MainView } from './components/MainView';

function App() {
  const repo = useRepository({
    syncServer: 'wss://sync.automerge.org',
  });

  return (
    <AppShell
      repo={repo}
      createEmptyDocument={createEmpty${pascalName}Doc}
      storagePrefix="${camelName}"
    >
      {(props) => <MainView {...props} />}
    </AppShell>
  );
}

export default App;
`;
fs.writeFileSync(path.join(appDir, 'src', 'App.tsx'), appTsx);

// Create src/components/MainView.tsx
const mainViewTsx = `import type { DocumentId } from '@automerge/automerge-repo';

interface MainViewProps {
  documentId: DocumentId;
  currentUserDid: string;
  privateKey?: string;
  publicKey?: string;
  displayName?: string;
  onResetIdentity: () => void;
  onNewDocument: () => void;
}

export function MainView({
  documentId,
  currentUserDid,
  displayName,
}: MainViewProps) {
  return (
    <div className="min-h-screen bg-base-200">
      <div className="navbar bg-base-100 shadow-lg">
        <div className="flex-1">
          <span className="text-xl font-bold px-4">${title}</span>
        </div>
      </div>

      <div className="container mx-auto p-4">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Welcome to ${title}!</h2>
            <p>
              Your new Narrative app is ready. Edit{' '}
              <code className="bg-base-200 px-1 rounded">src/components/MainView.tsx</code>{' '}
              to get started.
            </p>
            <p className="text-sm opacity-70">
              Document: {documentId.slice(0, 20)}...
            </p>
            <p className="text-sm opacity-70">
              Connected as: {displayName || currentUserDid.slice(0, 20) + '...'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync(path.join(appDir, 'src', 'components', 'MainView.tsx'), mainViewTsx);

// Create src/vite-env.d.ts
const viteEnvDts = `/// <reference types="vite/client" />
`;
fs.writeFileSync(path.join(appDir, 'src', 'vite-env.d.ts'), viteEnvDts);

// Update root package.json
const rootPkgPath = path.join(ROOT_DIR, 'package.json');
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));

// Add to workspaces if not present
if (!rootPkg.workspaces.includes(appName)) {
  rootPkg.workspaces.push(appName);
  // Sort workspaces but keep lib last
  rootPkg.workspaces.sort((a, b) => {
    if (a === 'lib') return 1;
    if (b === 'lib') return -1;
    return a.localeCompare(b);
  });
}

// Add convenience scripts
const scriptKey = appName.replace('-app', '').replace(/-/g, ':');
rootPkg.scripts[`dev:${scriptKey}`] = `npm run dev --workspace=${appName}`;
rootPkg.scripts[`build:${scriptKey}`] = `npm run build --workspace=${appName}`;

// Update build script to include new app
const buildParts = rootPkg.scripts.build.split(' && ');
const newBuildPart = `npm run build --workspace=${appName}`;
if (!buildParts.includes(newBuildPart)) {
  // Insert before lib (which should be first)
  buildParts.push(newBuildPart);
  rootPkg.scripts.build = buildParts.join(' && ');
}

fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + '\n');

console.log('✓ Created app structure');
console.log('✓ Updated root package.json');
console.log('');
console.log('Next steps:');
console.log(`  1. Run: npm install`);
console.log(`  2. Run: npm run dev:${scriptKey}`);
console.log(`  3. Edit src/schema/index.ts to define your data model`);
console.log(`  4. Edit src/components/MainView.tsx to build your UI`);
console.log('');
console.log(`Your app will be available at: http://localhost:${port}`);
