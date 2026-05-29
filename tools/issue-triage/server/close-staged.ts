import { getAndValidateConfig } from './config';
import { GithubService } from './github-service';
import { Octokit } from '@octokit/rest';

const DEFAULT_CLOSURE_MESSAGE = `Hello!

This issue has been identified as a candidate for closure due to inactivity or target major version focus, and has been labeled with the target close action tag. 

As we focus active maintenance on recent LTS releases, we are closing this report out programmatically. If you are still encountering this problem on a recent supported version of Angular (v18+), please file a new issue with a minimal, runnable reproduction link.

Thank you for your contributions and for helping keep our queue clean!`;

async function main() {
  console.log('\n================================================================');
  console.log('🔒 ANGULAR COMPONENTS BULK STAGED CANDIDATES CLOSURE UTILITY');
  console.log('================================================================');

  // 1. Load configuration credentials
  const config = getAndValidateConfig();
  const github = new GithubService(config);
  const octokit = new Octokit({ auth: config.githubToken });

  // 2. Parse CLI Arguments to retrieve custom message
  const args = process.argv.slice(2);
  const msgIdx = args.findIndex(a => a === '--message' || a === '-m');
  let closureMessage = DEFAULT_CLOSURE_MESSAGE;

  if (msgIdx !== -1 && args[msgIdx + 1]) {
    closureMessage = args[msgIdx + 1];
    console.log('[Config] Custom closure message body loaded successfully.');
  } else {
    console.log('[Config] No custom message provided. Utilizing default professional template.');
  }

  const limitIdx = args.findIndex(a => a === '--limit');
  const maxCloseCount = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined;

  try {
    // 3. Search GitHub for active open issues containing our target action label
    const searchQuery = `repo:${config.repoOwner}/${config.repoName} is:issue is:open label:"${config.triageLabel}"`;
    console.log(`[Search] Querying issues: "${searchQuery}"...`);

    const searchResults = await octokit.search.issuesAndPullRequests({
      q: searchQuery,
      sort: 'created',
      order: 'asc', // Process oldest first
      per_page: 100
    });

    const totalCandidates = searchResults.data.total_count;
    console.log(`[Search] Identified ${totalCandidates} open issues carrying label: "${config.triageLabel}"`);

    let targetList = searchResults.data.items;
    if (maxCloseCount && maxCloseCount < targetList.length) {
      targetList = targetList.slice(0, maxCloseCount);
      console.log(`[Search] Scoping sweep to top ${maxCloseCount} candidate targets.`);
    }

    if (targetList.length === 0) {
      console.log('\n🏁 No candidate issues carrying the action label are open. Loop terminated.');
      console.log('================================================================\n');
      return;
    }

    const confirmMsg = `\n⚠️ BULK CLOSURE EXECUTION WARNING\n\nAre you sure you want to comment and CLOSE all ${targetList.length} issues currently open on GitHub carrying label: "${config.triageLabel}"?\n\nThis operation will modify public issue states on GitHub. Type "yes" to proceed: `;
    
    // For CLI scripting, check if --yes flag is supplied, otherwise fail or prompt
    const bypassPrompt = args.includes('--yes') || args.includes('-y');
    if (!bypassPrompt) {
      console.log('\n[Prompt] To run this command in production automation, please supply the -y or --yes flag.');
      console.log('   Example: pnpm close-staged --yes');
      console.log('================================================================\n');
      process.exit(1);
    }

    console.log('\n🚀 Starting bulk closure queue...');
    let successes = 0;
    let failures = 0;

    for (let i = 0; i < targetList.length; i++) {
      const item = targetList[i];
      console.log(`\n[${i + 1}/${targetList.length}] Processing issue #${item.number}: "${item.title}"`);

      try {
        // Stage A: Post closure comment
        console.log(`  💬  Posting closure explanation comment...`);
        await github.postComment(item.number, closureMessage);

        // Stage B: Close the issue on GitHub
        console.log(`  🔒  Closing issue...`);
        await github.closeIssue(item.number);

        successes++;
        
        // Sequential pacing delay to defend against secondary rates limits abuse triggers
        if (i < targetList.length - 1) {
          await github.paceDelay(1000);
        }
      } catch (err) {
        failures++;
        console.error(`  ❌  Failed to process issue #${item.number}:`, (err as Error).message);
      }
    }

    console.log('\n================================================================');
    console.log('🏁 BULK CLOSURE EXECUTION COMPLETED');
    console.log('================================================================');
    console.log(`- Total Targets Processed: ${targetList.length}`);
    console.log(`- Successful Closures: ${successes}`);
    console.log(`- Failures: ${failures}`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ CRITICAL EXCEPTION: Staged closure task failed:', (err as Error).message);
    process.exit(1);
  }
}

main();
