import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import { getAndValidateConfig } from './config';
import { initDatabase, readIssuesCache, readTriageResults, updateTriageResult, TriageCategory, TriageStatus } from './data-service';
import { GithubService } from './github-service';

// Initialize core server attributes
const config = getAndValidateConfig();
initDatabase();

const app = express();
const github = new GithubService(config);

// Equip JSON parser and safe basic CORS configuration
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:4200', 'http://127.0.0.1:4200', 'http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// API Routes definitions

/**
 * GET /api/issues
 * Returns unified lists containing both raw cached headers and LLM classifications results.
 */
app.get('/api/issues', (req: Request, res: Response) => {
  try {
    const cache = readIssuesCache();
    const triage = readTriageResults();

    const merged = Object.values(cache.issues).map(issue => {
      const verdict = triage[issue.number] || {
        issue_number: issue.number,
        category: 'valid-bug',
        confidence: 0.0,
        reasoning: 'Not triaged yet. Run the CLI sweep or manual refresh.',
        suggested_action: 'Run triage sweep.',
        duplicate_of_issue_number: null,
        obsolescence_reason: 'none',
        is_reviewed: false,
        user_category: null,
        triage_status: 'pending',
        error_message: null,
        analysis_timestamp: 0
      };

      return {
        ...issue,
        verdict
      };
    });

    res.json({
      last_sync_timestamp: cache.last_sync_timestamp,
      issues: merged
    });
  } catch (err) {
    console.error('[BFF API] GET /api/issues failed:', (err as Error).message);
    res.status(500).json({ error: 'Failed to read local cache database.' });
  }
});

/**
 * POST /api/triage/:number/action
 * Triggers a triage review command: either skipping the candidate or applying a GitHub label candidate tag.
 */
app.post('/api/triage/:number/action', async (req: Request, res: Response) => {
  const issueNumber = parseInt(req.params['number'], 10);
  const { action, userCategory } = req.body as { action: TriageStatus; userCategory?: TriageCategory };

  if (isNaN(issueNumber) || !['approved', 'skipped', 'pending', 'applied'].includes(action)) {
    res.status(400).json({ error: 'Invalid issue parameters or status action.' });
    return;
  }

  try {
    const triage = readTriageResults();
    const existing = triage[issueNumber];

    // 3. Commit state changes back to atomic cache
    const updated = updateTriageResult(issueNumber, {
      triage_status: action,
      is_reviewed: true,
      ...(userCategory ? { user_category: userCategory } : {})
    });

    res.json({ success: true, verdict: updated });
  } catch (err) {
    console.error(`[BFF API] Action callback failed for issue #${issueNumber}:`, (err as Error).message);
    
    // Save transaction error state locally for recovery troubleshooting
    const updated = updateTriageResult(issueNumber, {
      error_message: `Label application failed: ${(err as Error).message}`
    });
    
    res.status(500).json({ 
      error: `Failed to execute triage label on GitHub: ${(err as Error).message}`,
      verdict: updated
    });
  }
});

/**
 * POST /api/triage/:number/override
 * Allows the developer to manually select a different category classification.
 */
app.post('/api/triage/:number/override', (req: Request, res: Response) => {
  const issueNumber = parseInt(req.params['number'], 10);
  const { category } = req.body as { category: TriageCategory };

  if (isNaN(issueNumber) || !category) {
    res.status(400).json({ error: 'Invalid issue parameters or target override category.' });
    return;
  }

  try {
    const updated = updateTriageResult(issueNumber, {
      user_category: category,
      is_reviewed: true
    });
    res.json({ success: true, verdict: updated });
  } catch (err) {
    console.error(`[BFF API] Override failed for issue #${issueNumber}:`, (err as Error).message);
    res.status(500).json({ error: 'Failed to update user category override.' });
  }
});

/**
 * POST /api/triage/:number/shield-override
 * Toggles the programmatic Community Shield bypass override flag for an issue.
 */
app.post('/api/triage/:number/shield-override', (req: Request, res: Response) => {
  const issueNumber = parseInt(req.params['number'], 10);
  const { overridden } = req.body as { overridden: boolean };

  if (isNaN(issueNumber)) {
    res.status(400).json({ error: 'Invalid issue number.' });
    return;
  }

  try {
    const updated = updateTriageResult(issueNumber, {
      is_shield_overridden: overridden
    });
    res.json({ success: true, verdict: updated });
  } catch (err) {
    console.error(`[BFF API] Shield override failed for issue #${issueNumber}:`, (err as Error).message);
    res.status(500).json({ error: 'Failed to update shield override state.' });
  }
});

/**
 * POST /api/triage/batch-action
 * Executes sequential, safe target labeling operations across multiple issue numbers in a single block call.
 */
app.post('/api/triage/batch-action', async (req: Request, res: Response) => {
  const { issueNumbers } = req.body as { issueNumbers: number[] };

  if (!Array.isArray(issueNumbers) || issueNumbers.length === 0) {
    res.status(400).json({ error: 'Invalid or empty batch numbers list.' });
    return;
  }

  console.log(`[BFF API] Launching batch labels queue for ${issueNumbers.length} targets...`);
  
  const cache = readIssuesCache();
  const successes: number[] = [];
  const failures: { number: number; error: string }[] = [];

  for (let i = 0; i < issueNumbers.length; i++) {
    const num = issueNumbers[i];
    const issue = cache.issues[num];

    // Check Community Shield
    if (issue && (issue.comments_count > 8 || issue.upvotes_count > 8)) {
      const triage = readTriageResults();
      const verdict = triage[num];
      if (!verdict || !verdict.is_shield_overridden) {
        failures.push({ number: num, error: 'Protected by the Community Interaction Shield.' });
        continue;
      }
    }

    try {
      // Execute the call on GitHub
      await github.applyTriageLabel(num);
      
      // Save state change locally
      updateTriageResult(num, {
        triage_status: 'applied',
        is_reviewed: true
      });

      successes.push(num);
      
      // Pace calls sequential interval to avoid rates abuse trigger
      if (i < issueNumbers.length - 1) {
        await github.paceDelay(500);
      }
    } catch (err) {
      failures.push({ number: num, error: (err as Error).message });
    }
  }

  res.json({
    successCount: successes.length,
    failureCount: failures.length,
    successes,
    failures
  });
});

// Configure production Angular static file serving if built assets exist
const clientBuildPath = path.resolve(__dirname, '../dist/browser');
if (fs.existsSync(clientBuildPath)) {
  console.log(`[BFF API] Serving client assets from static build: ${clientBuildPath}`);
  app.use(express.static(clientBuildPath));
  
  // Direct direct asset links back to index.html supporting client routing
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.url.startsWith('/api')) return next();
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
} else {
  console.log('[BFF API] Production static client build folder not found. Operating in developer API standalone server mode.');
  app.get('/', (req: Request, res: Response) => {
    res.send('🏠 Triage BFF is active! Launch the Angular client in local dev mode (pnpm dev:client) to open the UI.');
  });
}

// BIND SERVER STRICTLY TO LOCALHOST / LOOPBACK ADDRESS ONLY
app.listen(config.port, config.host, () => {
  console.log('\n================================================================');
  console.log(`📡 LOCAL BFF SERVER IS ONLINE AND LISTENING`);
  console.log(`👉 Address: http://${config.host}:${config.port}`);
  console.log('================================================================\n');
});
