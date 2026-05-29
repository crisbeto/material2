import {getAndValidateConfig} from './config';
import {
  initDatabase,
  readIssuesCache,
  writeIssuesCache,
  readTriageResults,
  updateTriageResult,
  CachedIssue,
  TriageResult,
  TriageCategory,
} from './data-service';
import {GithubService} from './github-service';
import {GeminiService} from './gemini-service';

/**
 * Main execution program for the standalone batch-first sweep CLI.
 */
async function main() {
  console.log('\n================================================================');
  console.log('🚀 ANGULAR COMPONENTS ISSUE TRIAGE SWEEP CLIENT');
  console.log('================================================================');

  // 1. Load configuration variables and validate target credentials
  const config = getAndValidateConfig();

  // 2. Initialize dynamic database caches on disk
  initDatabase();

  // 3. Instantiate integrations services
  const github = new GithubService(config);
  const gemini = new GeminiService(config);

  // 4. Parse CLI command line utility filters
  const args = process.argv.slice(2);
  const forceReRun = args.includes('--force') || args.includes('-f');
  const skipLlm = args.includes('--skip-llm');
  const forceSync = args.includes('--force-sync');

  const limitIdx = args.indexOf('--limit');
  const batchLimit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined;

  const issueIdx = args.indexOf('--issue');
  const targetSingleIssue = issueIdx !== -1 ? parseInt(args[issueIdx + 1], 10) : undefined;

  // Print run parameters
  console.log(`[Config] Target Repository: ${config.repoOwner}/${config.repoName}`);
  console.log(`[Config] Target Action Label: '${config.triageLabel}'`);
  if (forceReRun)
    console.log('[Config] Run Flag: --force (Re-running LLM on already triaged targets)');
  if (skipLlm)
    console.log(
      '[Config] Run Flag: --skip-llm (Bypassing LLM API and processing only programmatic rules)',
    );
  if (forceSync)
    console.log(
      '[Config] Run Flag: --force-sync (Forcing complete raw open issues headers database sync)',
    );
  if (batchLimit) console.log(`[Config] Sweep Limit: Up to ${batchLimit} issues`);
  if (targetSingleIssue)
    console.log(`[Config] Single Target: Focus strictly on issue #${targetSingleIssue}`);

  try {
    // 5. Fetch newer issues (Sync Delta Pass)
    const cache = readIssuesCache();
    const lastSync = forceSync ? undefined : cache.last_sync_timestamp || undefined;

    console.log(`[Sync] Last database sync: ${lastSync || 'Never'}`);
    const newIssues = await github.fetchOpenIssuesSince(lastSync);

    // Merge new updates back to local on-disk cache
    if (newIssues.length > 0) {
      newIssues.forEach(issue => {
        // Carry forward existing comment tree if already downloaded
        const existing = cache.issues[issue.number];
        if (existing && existing.comments && !issue.comments) {
          issue.comments = existing.comments;
        }
        cache.issues[issue.number] = issue;
      });
      cache.last_sync_timestamp = new Date().toISOString();
      writeIssuesCache(cache);
      console.log(
        `[Sync] Merged and updated ${newIssues.length} issues to on-disk persistent cache.`,
      );
    } else {
      console.log('[Sync] On-disk issues database is already up to date.');
    }

    // Load active issue collections
    const activeCache = readIssuesCache();
    const triageResults = readTriageResults();

    // Determine open issues to evaluate
    let targetIssues = Object.values(activeCache.issues).filter(issue => issue.state === 'open');

    // Apply strict CLI parameters filters
    if (targetSingleIssue) {
      targetIssues = targetIssues.filter(i => i.number === targetSingleIssue);
      if (targetIssues.length === 0) {
        console.error(
          `❌ Issue #${targetSingleIssue} is not found in local cache (or it is closed). Please verify state.`,
        );
        process.exit(1);
      }
    }

    // Filter down to unanalyzed issues (unless --force override is on)
    let queue = forceReRun
      ? targetIssues
      : targetIssues.filter(
          issue =>
            !triageResults[issue.number] || triageResults[issue.number].error_message !== null,
        );

    console.log(`[Queue] Total open issues in cache: ${targetIssues.length}`);
    console.log(`[Queue] Pending analysis queue size: ${queue.length}`);

    if (queue.length === 0) {
      console.log('🎉 All open issues have already been triaged! Sweep is complete.');
      printTriageSummary(Object.values(triageResults));
      process.exit(0);
    }

    // Apply execution limits
    if (batchLimit && queue.length > batchLimit) {
      console.log(
        `[Queue] Truncating queue sweep list to first ${batchLimit} items due to --limit filter.`,
      );
      queue = queue.slice(0, batchLimit);
    }

    console.log('\n================================================================');
    console.log(`⚡ STARTING TRIAGE PROCESSING QUEUE (${queue.length} targets)`);
    console.log('================================================================\n');

    let processed = 0;
    let shieldedCount = 0;
    let staleLowPriorityCount = 0;
    let staleFeatureCount = 0;
    let staleReproCount = 0;
    let staleReleaseCount = 0;

    for (let i = 0; i < queue.length; i++) {
      const issue = queue[i];
      const percent = Math.round(((i + 1) / queue.length) * 100);
      console.log(
        `[${i + 1}/${queue.length} - ${percent}%] Processing issue #${issue.number}: "${issue.title}"`,
      );

      // 6. PROGRAMMATIC SAFETY GATE: Community Interaction Shield
      const isHighlyDiscussed = issue.comments_count > 8;
      const isHighlyUpvoted = issue.upvotes_count > 8;

      if (isHighlyDiscussed || isHighlyUpvoted) {
        shieldedCount++;
        console.log(
          `  🛡️  [Shield Active] High engagement detected (${issue.comments_count} comments, ${issue.upvotes_count} upvotes). Programmatically protecting...`,
        );

        // Save default protective triage record and bypass Gemini API costs
        updateTriageResult(issue.number, {
          category: 'valid-bug',
          confidence: 1.0,
          reasoning: `Programmatic Community Shield Safeguard: Issue has active community footprint (${issue.comments_count} comments, ${issue.upvotes_count} upvotes) which indicates stable user engagement. Protected from automated close recommendations.`,
          suggested_action: 'Perform a manual developer review pass.',
          duplicate_of_issue_number: null,
          obsolescence_reason: 'none',
          is_reviewed: false,
          user_category: null,
          triage_status: 'skipped', // Automatically skipped/shielded from direct candidate labeling
          error_message: null,
          analysis_timestamp: Date.now(),
        });

        processed++;
        await github.paceDelay(100); // Quick brief sleep
        continue;
      }

      // 6.5. PROGRAMMATIC TRIAGE GATE: Stale Low Priority Heuristics
      if (isStaleLowPriority(issue)) {
        staleLowPriorityCount++;
        console.log(
          `  🗑️  [Low Priority Stale Gate Active] Stale P4/P5 issue detected (no updates for >5 years). Programmatically marking for close...`,
        );

        updateTriageResult(issue.number, {
          category: 'stale-p4-p5',
          confidence: 1.0,
          reasoning: `Programmatic Triage Gate: Issue is a low priority bug (P4/P5) with absolutely no activity or updates in the past 5 years (last update: ${issue.updated_at}). Evaluated as safe for closure.`,
          suggested_action: 'Apply target close-candidate label.',
          duplicate_of_issue_number: null,
          obsolescence_reason: 'outdated-version',
          is_reviewed: false,
          user_category: null,
          triage_status: 'pending', // Awaiting developer review in Web UI
          error_message: null,
          analysis_timestamp: Date.now(),
        });

        processed++;
        await github.paceDelay(100); // Quick sleep pacing
        continue;
      }

      // 6.6. PROGRAMMATIC TRIAGE GATE: Stale Low-Engagement Features
      if (isStaleFeature(issue)) {
        staleFeatureCount++;
        console.log(`  🗑️  [Stale Feature Gate Active] Stale low-engagement feature request detected (>3 years, low backing). Programmatically marking for close...`);

        updateTriageResult(issue.number, {
          category: 'stale-feature',
          confidence: 1.0,
          reasoning: `Programmatic Triage Gate: Issue is a stale feature request (>3 years old) with low community interest (<3 upvotes/comments). Safe for close according to standard open-source policy.`,
          suggested_action: 'Apply target close-candidate label.',
          duplicate_of_issue_number: null,
          obsolescence_reason: 'none',
          is_reviewed: false,
          user_category: null,
          triage_status: 'pending', // Awaiting developer review in Web UI
          error_message: null,
          analysis_timestamp: Date.now()
        });

        processed++;
        await github.paceDelay(100); // Quick sleep pacing
        continue;
      }

      // 6.7. PROGRAMMATIC TRIAGE GATE: Stale Unresolved Repro Requests
      if (isStaleRepro(issue)) {
        staleReproCount++;
        console.log(`  🗑️  [Stale Repro Gate Active] Stale unresolved reproduction request detected (>1 year old). Programmatically marking for close...`);

        updateTriageResult(issue.number, {
          category: 'stale-repro',
          confidence: 1.0,
          reasoning: `Programmatic Triage Gate: Issue is a stale unresolved reproduction request (>1 year old with Needs Repro label). Safe to close due to lifecycle stale policy.`,
          suggested_action: 'Apply target close-candidate label.',
          duplicate_of_issue_number: null,
          obsolescence_reason: 'none',
          is_reviewed: false,
          user_category: null,
          triage_status: 'pending', // Awaiting developer review in Web UI
          error_message: null,
          analysis_timestamp: Date.now()
        });

        processed++;
        await github.paceDelay(100); // Quick sleep pacing
        continue;
      }

      // 6.8. PROGRAMMATIC TRIAGE GATE: Stale Legacy Release Gate
      if (isStaleRelease(issue)) {
        staleReleaseCount++;
        console.log(`  🗑️  [Stale Release Gate Active] Stale bug report on unsupported release detected (v15 or older, >3 years, low footprint). Programmatically marking for close...`);

        updateTriageResult(issue.number, {
          category: 'stale-release',
          confidence: 1.0,
          reasoning: `Programmatic Triage Gate: Issue reports a bug on a legacy unsupported release (Angular/Material v15 or older) and has been stale for >3 years with a low community footprint (comments <= 2, upvotes <= 2). Safe to close.`,
          suggested_action: 'Apply target close-candidate label.',
          duplicate_of_issue_number: null,
          obsolescence_reason: 'outdated-version',
          is_reviewed: false,
          user_category: null,
          triage_status: 'pending', // Awaiting developer review in Web UI
          error_message: null,
          analysis_timestamp: Date.now()
        });

        processed++;
        await github.paceDelay(100); // Quick sleep pacing
        continue;
      }

      // 6.8. PROGRAMMATIC GATE CHECK: Skip LLM Queue Target Checks
      if (skipLlm) {
        console.log(
          `  🤖  [Skip LLM Mode] Bypassing comments download and Gemini API for issue #${issue.number}.`,
        );
        processed++;
        continue;
      }

      // 7. Deferred load comments on demand if comments exist and are missing
      let comments = issue.comments || [];
      if (issue.comments_count > 0 && comments.length === 0) {
        console.log(
          `  💬  Downloading comment thread history (${issue.comments_count} comments)...`,
        );
        try {
          comments = await github.fetchCommentsForIssue(issue.number);

          // Save loaded comments back to issues disk cache
          issue.comments = comments;
          activeCache.issues[issue.number] = issue;
          writeIssuesCache(activeCache);

          await github.paceDelay(300); // Rate limit breathing room
        } catch (err) {
          console.warn(
            `  ⚠️  Failed to fetch comments for issue #${issue.number}. Triage will proceed with description only.`,
          );
        }
      }

      // 8. Trigger Google Gemini AI generation structured evaluation
      console.log(
        `  🤖  Invoking Google Gemini AI Analysis (${process.env['GEMINI_MODEL'] || 'gemini-1.5-flash'})...`,
      );
      const verdict = await gemini.analyzeIssue(issue, comments);

      // Save classification results back to disk atomically
      updateTriageResult(issue.number, {
        ...verdict,
        is_reviewed: false,
        user_category: null,
        triage_status: 'pending', // Awaiting developer action in the Web UI
        error_message: verdict.error_message || null,
      } as Partial<TriageResult>);

      if (verdict.error_message) {
        console.log(`  ❌  Evaluation failed: ${verdict.error_message}`);
      } else {
        console.log(
          `  ✨  Verdict: [${verdict.category?.toUpperCase()}] (Confidence: ${Math.round((verdict.confidence || 0) * 100)}%)`,
        );
        console.log(`      Reason: ${verdict.reasoning}`);
      }

      processed++;

      // 9. Static cooldown pace delay to respect safety parameters
      if (i < queue.length - 1) {
        await github.paceDelay(500);
      }
    }

    console.log('\n================================================================');
    console.log('🏁 SWEEP RUN COMPLETED SUCCESSFULLY');
    console.log('================================================================');
    console.log(`- Total Checked Queue Targets: ${queue.length}`);
    console.log(`- Successfully Processed / Analyzed: ${processed}`);
    console.log(`- Shielded from Auto-Close: ${shieldedCount}`);
    console.log(`- Programmatically Marked Stale Low Priority (P4/P5): ${staleLowPriorityCount}`);
    console.log(`- Programmatically Marked Stale Features (type:feature): ${staleFeatureCount}`);
    console.log(`- Programmatically Marked Stale Unresolved Repros (needs-repro): ${staleReproCount}`);
    console.log(`- Programmatically Marked Stale Legacy Releases (v15 or older): ${staleReleaseCount}`);

    // Print summary metrics
    const finalTriage = Object.values(readTriageResults());
    printTriageSummary(finalTriage);
  } catch (err) {
    console.error(
      '\n❌ CRITICAL CRASH: Triage sweep was terminated due to exception:',
      (err as Error).message,
    );
    process.exit(1);
  }
}

/**
 * Summarizes current database metrics into a terminal distribution matrix block.
 */
function printTriageSummary(results: TriageResult[]): void {
  const openCount = results.length;
  const categories: Record<string, number> = {};
  let pendingClose = 0;

  results.forEach(r => {
    categories[r.category] = (categories[r.category] || 0) + 1;
    if (
      (r.category === 'no-longer-relevant' ||
        r.category === 'needs-repro' ||
        r.category === 'support-question' ||
        r.category === 'stale-p4-p5') &&
      r.triage_status === 'pending'
    ) {
      pendingClose++;
    }
  });

  console.log('\n📊 CURRENT TRIAGE METRICS DISTRIBUTION SUMMARY:');
  console.log('----------------------------------------------------------------');
  console.log(`Total Local Classifications: ${openCount}`);
  Object.entries(categories).forEach(([cat, count]) => {
    const pad = cat.padEnd(22, ' ');
    const percent = Math.round((count / openCount) * 100);
    console.log(`  - ${pad}: ${count.toString().padStart(4, ' ')} (${percent}%)`);
  });
  console.log(`\n👉 Pending Close Candidates Awaiting Review: ${pendingClose}`);
  console.log('================================================================\n');
}

/**
 * Programmatic check to evaluate if an issue is a low-priority P4/P5 bug with no activity for more than 5 years.
 */
function isStaleLowPriority(issue: CachedIssue): boolean {
  if (!issue.labels || !Array.isArray(issue.labels)) return false;

  // Custom lower priority labels list keys (handles formats: P4, P5, priority: p4, severity-p5, etc.)
  const hasLowPriority = issue.labels.some(l => {
    const clean = l.toLowerCase().replace(/\s/g, '');
    return (
      clean === 'p4' ||
      clean === 'p5' ||
      clean.endsWith(':p4') ||
      clean.endsWith(':p5') ||
      clean.endsWith('-p4') ||
      clean.endsWith('-p5')
    );
  });

  if (!hasLowPriority) return false;

  const lastUpdate = new Date(issue.updated_at).getTime();
  // 5 years in milliseconds: 5 * 365.25 * 24 * 3600 * 1000
  const fiveYearsInMs = 5 * 365.25 * 24 * 60 * 60 * 1000;
  const isStale = Date.now() - lastUpdate > fiveYearsInMs;

  return isStale;
}

// Helpers and Gates Utilities definitions below

/**
 * Programmatic check to identify stale feature requests with no community interest (>3 years old, <3 comments/upvotes).
 */
function isStaleFeature(issue: CachedIssue): boolean {
  if (!issue.labels || !Array.isArray(issue.labels)) return false;
  
  const featureTags = ['feature', 'type: feature', 'proposal'];
  const isFeature = issue.labels.some(l => 
    featureTags.includes(l.toLowerCase().trim())
  );
  if (!isFeature) return false;

  const lastUpdate = new Date(issue.updated_at).getTime();
  const threeYearsInMs = 3 * 365.25 * 24 * 60 * 60 * 1000;
  const isStale = (Date.now() - lastUpdate) > threeYearsInMs;

  return isStale && issue.comments_count < 3 && issue.upvotes_count < 3;
}

/**
 * Programmatic check to identify stale unresolved reproduction requests (>1 year old with Needs Repro label).
 */
function isStaleRepro(issue: CachedIssue): boolean {
  if (!issue.labels || !Array.isArray(issue.labels)) return false;
  
  const hasReproLabel = issue.labels.some(l => {
    const clean = l.toLowerCase().replace(/\s/g, '');
    return clean.includes('repro') || clean.includes('clarification');
  });
  if (!hasReproLabel) return false;

  const lastUpdate = new Date(issue.updated_at).getTime();
  const oneYearInMs = 365.25 * 24 * 60 * 60 * 1000;
  const isStale = (Date.now() - lastUpdate) > oneYearInMs;

  return isStale;
}

/**
 * Programmatic check to identify stale bug reports on legacy releases (Angular v15 or older, >3 years, low footprint).
 */
function isStaleRelease(issue: CachedIssue): boolean {
  const lastUpdate = new Date(issue.updated_at).getTime();
  const threeYearsInMs = 3 * 365.25 * 24 * 60 * 60 * 1000;
  const isStale = (Date.now() - lastUpdate) > threeYearsInMs;
  if (!isStale) return false;

  // Check low footprint
  if (issue.comments_count > 2 || issue.upvotes_count > 2) return false;

  // Detect versions <= 15 in description body text
  const bodyText = (issue.body || '').toLowerCase();
  const mentionsOldVersion = /angular\s*(version\s*)?[:\s-]*([5-9]|1[0-5])\b/.test(bodyText) || 
                             /angular\s*core\s*[:\s-]*([5-9]|1[0-5])\b/.test(bodyText) ||
                             /material\s*(version\s*)?[:\s-]*([5-9]|1[0-5])\b/.test(bodyText);
  return mentionsOldVersion;
}

// Kickstart script execution
main();
