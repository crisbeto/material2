import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Resolve target project directory and search for local .env path
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');

// Parse .env configurations into process.env if present (does not override shell variables)
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

export interface AppConfig {
  githubToken: string;
  geminiApiKey: string;
  port: number;
  host: string;
  repoOwner: string;
  repoName: string;
  triageLabel: string;
  geminiModel: string;
}

/**
 * Validates environmental states at boot. If mandatory credentials are not present,
 * prints setup instructions and halts the thread to prevent failures down the line.
 */
export function getAndValidateConfig(): AppConfig {
  const githubToken = process.env['GITHUB_TOKEN'] || '';
  const geminiApiKey = process.env['GEMINI_API_KEY'] || '';
  const port = parseInt(process.env['PORT'] || '3000', 10);

  // Strict Host boundary security target: lock host to local loopback interface ONLY
  const host = '127.0.0.1';

  const repoOwner = process.env['REPO_OWNER'] || 'angular';
  const repoName = process.env['REPO_NAME'] || 'components';
  const triageLabel = process.env['DEFAULT_TRIAGE_LABEL'] || 'action: close-candidate';
  const geminiModel = process.env['GEMINI_MODEL'] || '';

  const missing: string[] = [];
  if (!githubToken) missing.push('GITHUB_TOKEN');
  if (!geminiApiKey) missing.push('GEMINI_API_KEY');
  if (!geminiModel) missing.push('GEMINI_MODEL');

  if (missing.length > 0) {
    console.error('\n================================================================');
    console.error('❌ CONFIGURATION ERROR: MISSING REQUIRED ENVIRONMENT VARIABLES');
    console.error('================================================================');
    console.error(`The following environment variables must be defined in your active process:`);
    missing.forEach(v => console.error(`  - ${v}`));
    console.error('\nTo configure these in your active shell, please run:');
    console.error('   export GITHUB_TOKEN="your_github_personal_access_token_here"');
    console.error('   export GEMINI_API_KEY="your_gemini_api_key_here"');
    console.error('   export GEMINI_MODEL="gemini-2.0-flash"');
    console.error('\nOr supply them inline when running scripts:');
    console.error('   GITHUB_TOKEN=... GEMINI_API_KEY=... pnpm sweep');
    console.error('   GITHUB_TOKEN=... GEMINI_API_KEY=... pnpm dev');
    console.error('\nNote: Your GITHUB_TOKEN needs basic write permissions for labels.');
    console.error('================================================================\n');
    process.exit(1);
  }

  return {
    githubToken,
    geminiApiKey,
    port,
    host,
    repoOwner,
    repoName,
    triageLabel,
    geminiModel
  };
}
