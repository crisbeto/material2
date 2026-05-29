import * as fs from 'fs';
import * as path from 'path';

// Define TS models for strict data contracts
export interface IssueComment {
  id: number;
  author: string;
  body: string;
  created_at: string;
}

export interface CachedIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  html_url: string;
  author: string;
  created_at: string;
  updated_at: string;
  comments_count: number;
  upvotes_count: number;
  labels: string[];
  comments?: IssueComment[];
}

export interface IssuesCache {
  last_sync_timestamp: string | null;
  issues: Record<number, CachedIssue>;
}

export type TriageCategory = 'valid-bug' | 'duplicate' | 'no-longer-relevant' | 'support-question' | 'needs-repro' | 'feature-request' | 'stale-p4-p5' | 'stale-feature' | 'stale-repro' | 'stale-release';
export type TriageStatus = 'pending' | 'approved' | 'skipped' | 'applied';
export type ObsolescenceReason = 'outdated-version' | 'api-rewritten' | 'none' | 'other';

export interface TriageResult {
  issue_number: number;
  category: TriageCategory;
  confidence: number;
  reasoning: string;
  suggested_action: string;
  duplicate_of_issue_number: number | null;
  obsolescence_reason: ObsolescenceReason;
  is_reviewed: boolean;
  user_category: TriageCategory | null;
  triage_status: TriageStatus;
  error_message: string | null;
  analysis_timestamp: number;
  is_shield_overridden?: boolean;
}

// Set target base directory references
const DATA_DIR = path.resolve(__dirname, '../data');
const ISSUES_CACHE_PATH = path.join(DATA_DIR, 'issues_cache.json');
const TRIAGE_RESULTS_PATH = path.join(DATA_DIR, 'triage_results.json');

/**
 * Ensures the 'data/' folder and basic JSON file templates exist on startup.
 */
export function initDatabase(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`[Database] Created dynamic local data folder at: ${DATA_DIR}`);
  }

  // Set up default issues cache file template if missing
  if (!fs.existsSync(ISSUES_CACHE_PATH)) {
    const defaultIssues: IssuesCache = {
      last_sync_timestamp: null,
      issues: {}
    };
    writeJsonAtomic(ISSUES_CACHE_PATH, defaultIssues);
    console.log('[Database] Initialized empty issues_cache.json template.');
  }

  // Set up default triage results template if missing
  if (!fs.existsSync(TRIAGE_RESULTS_PATH)) {
    const defaultTriage: Record<number, TriageResult> = {};
    writeJsonAtomic(TRIAGE_RESULTS_PATH, defaultTriage);
    console.log('[Database] Initialized empty triage_results.json template.');
  }
}

/**
 * Reads and parses the issues cache file on-disk.
 */
export function readIssuesCache(): IssuesCache {
  try {
    const raw = fs.readFileSync(ISSUES_CACHE_PATH, 'utf-8');
    return JSON.parse(raw) as IssuesCache;
  } catch (err) {
    console.error('[Database] Failed to read issues_cache.json. Returning empty container.', err);
    return { last_sync_timestamp: null, issues: {} };
  }
}

/**
 * Writes dynamic updates back to issues_cache.json.
 */
export function writeIssuesCache(data: IssuesCache): void {
  writeJsonAtomic(ISSUES_CACHE_PATH, data);
}

/**
 * Reads and parses all local triage evaluation records on-disk.
 */
export function readTriageResults(): Record<number, TriageResult> {
  try {
    const raw = fs.readFileSync(TRIAGE_RESULTS_PATH, 'utf-8');
    return JSON.parse(raw) as Record<number, TriageResult>;
  } catch (err) {
    console.error('[Database] Failed to read triage_results.json. Returning empty container.', err);
    return {};
  }
}

/**
 * Writes all triage evaluations back to triage_results.json.
 */
export function writeTriageResults(data: Record<number, TriageResult>): void {
  writeJsonAtomic(TRIAGE_RESULTS_PATH, data);
}

/**
 * Retrieves specific issue and its triage verdict.
 */
export function getIssueWithVerdict(issueNumber: number): { issue: CachedIssue | null; verdict: TriageResult | null } {
  const cache = readIssuesCache();
  const triage = readTriageResults();

  const issue = cache.issues[issueNumber] || null;
  const verdict = triage[issueNumber] || null;

  return { issue, verdict };
}

/**
 * Updates properties of a single triage report record atomically.
 */
export function updateTriageResult(issueNumber: number, patches: Partial<TriageResult>): TriageResult {
  const triage = readTriageResults();
  const existing = triage[issueNumber];

  const updatedRecord: TriageResult = existing
    ? { ...existing, ...patches, issue_number: issueNumber }
    : {
        issue_number: issueNumber,
        category: patches.category || 'valid-bug',
        confidence: patches.confidence ?? 1.0,
        reasoning: patches.reasoning || 'Manually declared / updated.',
        suggested_action: patches.suggested_action || '',
        duplicate_of_issue_number: patches.duplicate_of_issue_number ?? null,
        obsolescence_reason: patches.obsolescence_reason || 'none',
        is_reviewed: patches.is_reviewed ?? true,
        user_category: patches.user_category ?? null,
        triage_status: patches.triage_status || 'pending',
        error_message: patches.error_message ?? null,
        analysis_timestamp: patches.analysis_timestamp || Date.now(),
        is_shield_overridden: patches.is_shield_overridden ?? false,
        ...patches
      };

  triage[issueNumber] = updatedRecord;
  writeTriageResults(triage);
  return updatedRecord;
}

/**
 * Helper to execute a write operation safely using atomic temporary swaps.
 * Saves modern JSON data to targetPath safely.
 */
function writeJsonAtomic(targetPath: string, data: any): void {
  const tmpPath = `${targetPath}.tmp`;
  try {
    // 1. Write structured JSON safely to a temporary disk location
    const payload = JSON.stringify(data, null, 2);
    fs.writeFileSync(tmpPath, payload, 'utf-8');

    // 2. Safely swap temporary file into primary destination location
    fs.renameSync(tmpPath, targetPath);
  } catch (err) {
    // Cleanup temporary file if left behind
    if (fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch (_) {}
    }
    throw new Error(`[Database] Atomic save transaction failed for ${targetPath}: ${(err as Error).message}`);
  }
}
