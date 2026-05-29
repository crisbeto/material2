import * as fs from 'fs';
import * as path from 'path';
import {GoogleGenAI} from '@google/genai';
import {getAndValidateConfig} from './config';
import {GithubService} from './github-service';
import {Octokit} from '@octokit/rest';

// Define strict data types for the closed issues archive
interface ClosedIssueSummary {
  number: number;
  title: string;
  body: string;
  author: string;
  labels: string[];
  created_at: string;
  closed_at: string;
  closed_by: string;
  closure_comments: {
    author: string;
    body: string;
    created_at: string;
  }[];
}

const DATA_DIR = path.resolve(__dirname, '../data');
const CLOSED_ISSUES_CACHE = path.join(DATA_DIR, 'closed_issues_crisbeto.json');
const LEARNED_METHODOLOGY_REPORT = path.join(DATA_DIR, 'crisbeto_learned_methodology.md');
const PROMPT_RULES_JSON = path.join(DATA_DIR, 'crisbeto_prompt_rules.json');

/**
 * Main execution block for the KKostadinov (crisbeto) Triage Triage Learning Engine.
 */
async function main() {
  console.log('\n================================================================');
  console.log('🤖 CRISBETO TRIAGE METHODOLOGY LEARNING ENGINE');
  console.log('================================================================');

  const config = getAndValidateConfig();
  const github = new GithubService(config);

  // Parse command line arguments
  const args = process.argv.slice(2);
  const synthesizeOnly = args.includes('--synthesize-only') || args.includes('-s');

  const limitIdx = args.indexOf('--limit');
  const maxIssues = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 100;

  // Instantiate Google Gen AI client using our configuration key
  const ai = new GoogleGenAI({apiKey: config.geminiApiKey});
  const synthesisModel = config.geminiModel;

  try {
    let closedDataset: ClosedIssueSummary[] = [];

    // Stage 1: Check cache files or fetch raw closed data from GitHub
    if (synthesizeOnly && fs.existsSync(CLOSED_ISSUES_CACHE)) {
      console.log('[Cache] Loading pre-cached closed issues dataset from disk...');
      closedDataset = JSON.parse(
        fs.readFileSync(CLOSED_ISSUES_CACHE, 'utf-8'),
      ) as ClosedIssueSummary[];
      console.log(`[Cache] Successfully loaded ${closedDataset.length} closed issues details.`);
    } else {
      console.log(
        '[GitHub] Syncing closed issues lists closed by developer @crisbeto in the past 5 years...',
      );

      // Initialize Octokit client direct access for complex search queries
      const octokit = new Octokit({auth: config.githubToken});

      // Calculate historical threshold timeline (5 years ago from current local time context)
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      const sinceDateIso = fiveYearsAgo.toISOString().split('T')[0]; // Format: YYYY-MM-DD

      // Search syntax: repo targets, is closed issues, involves developer, past 5 years dates range, excluding reports they authored
      const searchQuery = `repo:${config.repoOwner}/${config.repoName} is:issue is:closed involves:crisbeto -author:crisbeto closed:>=${sinceDateIso}`;
      console.log(`[GitHub] Executing Search Query: "${searchQuery}"`);

      // Fetch up to a larger pool of 100 search candidate targets to find active conversation examples
      const searchResults = await octokit.search.issuesAndPullRequests({
        q: searchQuery,
        sort: 'updated',
        order: 'desc',
        per_page: 100,
      });

      const totalFound = searchResults.data.total_count;
      console.log(`[GitHub] Search identified ${totalFound} closed issues meeting criteria.`);

      const targetList = searchResults.data.items;
      console.log(
        `[GitHub] Preparing to process and filter search targets list for up to ${maxIssues} active @crisbeto interaction cases...`,
      );

      for (let i = 0; i < targetList.length; i++) {
        if (closedDataset.length >= maxIssues) {
          console.log(
            `[GitHub] Successfully collected target study size of ${maxIssues} active interaction cases. Halting fetch loop.`,
          );
          break;
        }

        const item = targetList[i];
        console.log(
          `[${i + 1}/${targetList.length}] Loading comment thread history for issue #${item.number}...`,
        );

        try {
          // Fetch raw comment history
          const rawComments = await github.fetchCommentsForIssue(item.number);

          // CRITICAL REQUIREMENT: Verify developer @crisbeto has actual written comments in this discussion thread
          const hasCrisbetoComment = rawComments.some(c => c.author === 'crisbeto');
          if (!hasCrisbetoComment) {
            console.log(
              `  🔍  Skipping issue #${item.number} (Involved but @crisbeto has no active verbal comments in this thread)`,
            );
            continue;
          }

          // Identify comments authored by crisbeto, or general final comment sequences leading to closure
          // Pull up to final 5 comments to capture direct closure conversations context
          const finalComments = rawComments.slice(-5).map(c => ({
            author: c.author,
            body: c.body,
            created_at: c.created_at,
          }));

          closedDataset.push({
            number: item.number,
            title: item.title,
            body: item.body || '',
            author: item.user?.login || 'unknown',
            labels: item.labels.map((l: any) => l.name),
            created_at: item.created_at,
            closed_at: item.closed_at || '',
            closed_by: 'crisbeto', // Safe search assumption
            closure_comments: finalComments,
          });

          // Write incrementally to prevent data loss on internet failures
          if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, {recursive: true});
          }
          fs.writeFileSync(CLOSED_ISSUES_CACHE, JSON.stringify(closedDataset, null, 2), 'utf-8');

          // Sequential pacing delay to prevent abuse rate limit triggers
          await github.paceDelay(300);
        } catch (err) {
          console.warn(
            `[GitHub] Skipped comment analysis for issue #${item.number} due to exception:`,
            (err as Error).message,
          );
        }
      }
      console.log(
        `[GitHub] Closed issues sync completed. Raw dataset written to disk: ${CLOSED_ISSUES_CACHE}`,
      );
    }

    // Enforce the active limit constraint on the final dataset
    const studyDataset = closedDataset.slice(0, maxIssues);

    if (studyDataset.length === 0) {
      console.error(
        '❌ Error: No closed issues dataset available to analyze. Verify target parameters.',
      );
      process.exit(1);
    }

    // Stage 2: Compress dataset into a high-density, low-token layout to support full synthesis context
    console.log(`\n[Compression] Formatting ${studyDataset.length} raw issues into high-density qualitative nodes...`);
    const compactNodes = studyDataset
      .map(item => {
        const closingDirectComments = item.closure_comments
          .map(
            c =>
              `  * @${c.author} (${c.created_at}): "${c.body.substring(0, 300)}${c.body.length > 300 ? '...' : ''}"`,
          )
          .join('\n');

        return `
================================================================
ISSUE #${item.number}: "${item.title}"
Labels: [${item.labels.join(', ')}]
Created: ${item.created_at} | Closed: ${item.closed_at}
Original description: "${item.body.substring(0, 400)}${item.body.length > 400 ? '...' : ''}"
Closure timeline comments:
${closingDirectComments}
`;
      })
      .join('\n');

    // Stage 3: Call Gemini Pro to perform qualitative synthesis analysis
    console.log(
      `\n[AI] Invoking Google Gemini AI Triage Triage Synthesizer (${synthesisModel})...`,
    );
    console.log("[AI] Running qualitative evaluation to learn @crisbeto's triage logic rules...");

    const promptText = `
You are an expert systems research analyst studying senior maintainer behaviors and engineering workflows in massive open source repos.
We have collected a high-density dataset of ${studyDataset.length} issue reports in the 'angular/components' repository that were triaged and closed by the core contributor '@crisbeto' (KKostadinov) in the past 5 years.

Your task is to analyze these cases, look through their descriptions, target styles, labels, and the timeline conversation comments immediately preceding the closure, and synthesize a concrete, programmatic 'Triage and Closure Rubric' that perfectly replicates '@crisbeto's decision-making methodology.

Specifically, look for patterns to answer:
1. What templates, specific language phrasing, or standard messages does '@crisbeto' use when closing issues? Does he refer users to other locations (e.g. issues templates, stack overflow, general forms instructions)?
2. What concrete signs (e.g., lack of reproduction stackblitz links, target package incompatibilities, global style resets, component API limitations, specific CSS deep target overrides) does he use to declare an issue as a Support Question, Invalid, Duplicate, or No Longer Relevant?
3. How does he verify duplicates? When does he link multiple issue numbers together?
4. What rules does he apply regarding accessible component contracts (WCAG focus indicators, accessible dialog states, active element traps)?

---
HIGH-DENSITY CLOSED ISSUES DATASET:
${compactNodes}

---
OUTPUT TARGET STRUCTURE REQUIREMENTS:
We need you to generate two distinct blocks in your single JSON output structure:

1. **"markdownReport"**: A comprehensive, publication-grade developer document containing:
   - Executive Summary of '@crisbeto's triage methodology and general closing templates.
   - Categorized rubrics: Dupes logic, support vs bug logic, styling hacks guidelines, stale gates.
   - Specific quotes/explanations from real issues in the dataset.
   - Programmatic recommendations for our triage automations.

2. **"promptRules"**: A flat array of highly specific, standalone string statements (similar to Rule 1 to Rule 12 style rules) that we can feed back to our triage AI to make it think, classify, and suggest actions exactly like '@crisbeto'.

Return a single JSON block strictly conforming to this schema:
{
  "markdownReport": "string (formatted in rich github-style markdown)",
  "promptRules": ["string", "string", ...]
}
`;

    const response = await ai.models.generateContent({
      model: synthesisModel,
      contents: promptText,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            markdownReport: {type: 'STRING'},
            promptRules: {
              type: 'ARRAY',
              items: {type: 'STRING'},
            },
          },
          required: ['markdownReport', 'promptRules'],
        },
        temperature: 0.2, // Low temperature for high logical structure consistency
        systemInstruction:
          'You are a senior workflow analyzer for the Angular Components team. Generate highly accurate, data-backed qualitative analysis reports.',
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Gemini API returned an empty output stream.');
    }

    const parsed = JSON.parse(text);

    // Stage 4: Write the synthesized report and rules back to disk physical files
    fs.writeFileSync(LEARNED_METHODOLOGY_REPORT, parsed.markdownReport, 'utf-8');
    fs.writeFileSync(PROMPT_RULES_JSON, JSON.stringify(parsed.promptRules, null, 2), 'utf-8');

    console.log('\n================================================================');
    console.log('🏁 ANALYSIS SUCCESSFUL: CRISBETO METHODOLOGY SYNTHESIS COMPLETED');
    console.log('================================================================');
    console.log(`- Synthesized Triage Rules Count: ${parsed.promptRules.length}`);
    console.log(`- Markdown report written to: ${LEARNED_METHODOLOGY_REPORT}`);
    console.log(`- Structured prompt rules written to: ${PROMPT_RULES_JSON}`);
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n❌ CRITICAL EXCEPTION: Methodology learning failed:', (err as Error).message);
    process.exit(1);
  }
}

// Start CLI process execution
main();
