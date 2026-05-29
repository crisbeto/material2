# 🛡️ Angular Components Issue Triage Desk

A high-performance, local, **offline-first developer dashboard** and self-learning AI engine designed to manage, evaluate, and triage the massive open issues queue inside the `angular/components` repository using Google Gemini 2.0/2.5.

The application operates as a standalone package inside your workspace, completely isolated from the main components compilation rules to prevent build or dependency conflicts.

---

## 1. System Architecture & Tech Stack

The workspace is structured around a secure **Backend-for-Frontend (BFF)** architecture pattern:
*   **Frontend SPA**: A modern **Angular v21** dashboard leveraging standalone components, reactive **Angular Signals**, custom safe HTML filters, and a premium glassmorphic dark theme.
*   **Local BFF Express Server**: A lightweight Node API utility strictly locked to the local loopback host interface (`127.0.0.1`) to secure your system from external network queries. Handles private credentials, proxies GitHub label updates, and serves built assets.
*   **Database Cache**: A zero-dependency, highly portable **flat-file JSON database** (`data/issues_cache.json` and `data/triage_results.json`) utilizing file-locking and atomic temporary file-swaps to guarantee write safety.
*   **Integrations Clients**: Integrates the unified `@google/genai` client SDK for fast structured JSON Gemini generations and `@octokit/rest` for paginated GitHub Rest calls.

---

## 2. Environment Variables Configuration

To run commands, you must provide your private credentials and configuration parameters. The tool implements a **Hybrid Priority Credential Model**:
*   High-security keys/tokens are read from your active shell environment variables first, falling back to a local Git-ignored `.env` file if not exported.
*   Non-secret parameters (such as models, repo settings, ports, and labels) can be managed inside the local `.env` file for ease of use.

Create a local `.env` file inside `tools/issue-triage/` (template copy from `.env.example`):
```env
# 1. GitHub Personal Access Token (Requires 'repo' scope write permissions for labels)
GITHUB_TOKEN=your_github_token_here

# 2. Google Gemini API Key (Get a free key at Google AI Studio)
GEMINI_API_KEY=your_gemini_api_key_here

# 3. Target Gemini Model (MANDATORY, e.g., gemini-2.0-flash or gemini-2.5-flash-lite)
GEMINI_MODEL=gemini-2.0-flash

# 4. Target Repository Setup (Optional, defaults to angular/components)
REPO_OWNER=angular
REPO_NAME=components

# 5. Default Applied Label (Optional, defaults to triage: close-candidate)
DEFAULT_TRIAGE_LABEL=triage: close-candidate

# 6. BFF Local API Port (Optional, defaults to 3000)
PORT=3000
```

---

## 3. CLI Command Reference

Execute all commands within the `tools/issue-triage/` directory:

| Command | Action / Description | Key Command Flags |
| :--- | :--- | :--- |
| **`pnpm install`** | Installs all package dependencies in a standalone workspace environment. | *None* |
| **`pnpm sweep`** | Runs the batch-first incremental open issues sync, checks the Community Shield, downloads comments, and runs Gemini AI structured classifications. | `--limit <n>`: Sweeps top `n` issues.<br>`--issue <num>`: Focuses strictly on issue `#num`.<br>`--force` or `-f`: Re-runs AI on already triaged targets. |
| **`pnpm learn`** | Syncs closed issues where you (`@crisbeto`) commented in the past 5 years and uses Gemini Pro to qualitatively study your closing methodology, saving rules. | `--limit <n>`: Studies up to `n` closed issues.<br>`--synthesize-only` or `-s`: Skips new GitHub queries, running the AI synthesis purely off pre-cached raw files. |
| **`pnpm close-staged`** | Scans GitHub for open issues labeled with the action close label, posts a comment, and closes them sequentially. | `--message "<text>"` or `-m "<text>"`: Custom closure comment body.<br>`--limit <n>`: Closes up to `n` issues.<br>`--yes` or `-y`: Bypasses the confirmation warning prompt. |
| **`pnpm dev`** | Boots both the Express BFF API Server (Port 3000) and the browser Angular Dev Server (Port 4200) concurrently with active HMR and proxy redirects. | *None* |
| **`pnpm build`** | Runs production browser bundle compiler (ESBuild-based application builder) and compiles the TypeScript Node backend files. | *None* |
| **`pnpm start`** | Boots the local Express server in production standalone mode, serving the pre-compiled production browser assets. | *None* |

---

## 4. Operation Workflows Guide

### Step 1: Bootstrap Standalone Packages
```bash
cd tools/issue-triage
pnpm install
```

### Step 2: Study Your Closing Methodology (Self-Learning)
Study the first 10 closed issues to generate your custom guidelines:
```bash
# Export your GITHUB_TOKEN and GEMINI_API_KEY in the shell, or keep them in .env
pnpm learn --limit 10
```
This writes your custom report to [data/crisbeto_learned_methodology.md](file:///Users/kkostadinov/Projects/material2/tools/issue-triage/data/crisbeto_learned_methodology.md) and the rule guidelines to [data/crisbeto_prompt_rules.json](file:///Users/kkostadinov/Projects/material2/tools/issue-triage/data/crisbeto_prompt_rules.json).

### Step 3: Run Open Queue Sweeps
The next time you run the sweep queue, your learned rules are automatically read from the disk and injected into the Gemini prompt:
```bash
# Run a quick connection test on the first 5 issues in the queue
pnpm sweep --limit 5
```

### Step 4: Open the Triage Desk Dashboard
```bash
pnpm dev
```
Open your browser to [http://127.0.0.1:4200](http://127.0.0.1:4200) to view, filter, override, or batch-label candidate issues!

---

## 5. Operating the Keyboard Triage Desk

The Angular interface listens to key actions (blocked when typing inside inputs):

*   <kbd>J</kbd> or <kbd>↓</kbd> : Select and focus the **next** filtered issue in the scroll grid.
*   <kbd>K</kbd> or <kbd>↑</kbd> : Select and focus the **previous** filtered issue in the scroll grid.
*   <kbd>C</kbd> : **Confirm & Approve Triage Close**. Sequentially posts a proxy request to the BFF to apply your `'triage: close-candidate'` tag on GitHub. The element transitions out of your filtered queue, and focus shifts down.
*   <kbd>S</kbd> : **Skip / Keep Active**. Marks the issue as reviewed but skips labeling on GitHub, keeping the target active and shifting list selection focus down.
*   <kbd>O</kbd> : Focus the **Manual Category Override** dropdown. Use Arrow Keys and Enter to manually assign a different category (Valid Bug, Duplicate, Support Question, Needs Repro, Feature Request).
*   <kbd>V</kbd> or <kbd>Enter</kbd> : **Open in New Tab**. Instantly opens the selected GitHub issue page in a new browser tab for deeper inspection.

---

## 6. Programmatic Community Interaction Shield Safeguard

To prevent accidental automated label actions on highly-discussed or popular community issues:
*   **The Guard**: Any issue with **more than 4 upvotes** (👍 thumbs-up reaction count > 4) OR **more than 4 comments** (comment count > 4) is classified as a high-engagement topic and programmatically shielded.
*   **Bypassing costs**: The CLI sweep script skips the Gemini API call entirely, saving costs, auto-populates the cache with a category of `valid-bug` or `community-interest` (100% confidence), and locks the triage status to `skipped`.
*   **Action Lock**: The Express BFF server and Angular client **block any close label attempts** on shielded issues, disabling the button in the UI and rendering a glowing blue alert: `🛡️ Community Shield Active: Protected from automated close recommendations`. Key accelerators like <kbd>C</kbd> are also ignored.
