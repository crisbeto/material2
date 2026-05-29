# Getting Started: Local Issue Triage Desk

This guide walks you through setting up, configuring, and running the standalone issue triage dashboard on your local machine.

---

## 1. Quick Environment Setup

To secure your private access credentials, keys are managed using a Git-ignored local configuration file:

1. In the `tools/issue-triage/` directory, copy the template file to create your active `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open the new `.env` file in your text editor and supply your secure tokens:
   * **`GITHUB_TOKEN`**: A GitHub Personal Access Token (classic) with `repo` scope permissions (required to fetch issues/comments and write labels).
   * **`GEMINI_API_KEY`**: A Google Gemini API key. You can generate a free API key in seconds using [Google AI Studio](https://aistudio.google.com/).
   * **`GEMINI_MODEL`** (Optional): Defaults to `gemini-1.5-flash` for high-speed, cost-efficient sweeps. You can change this to `gemini-1.5-pro` for deep-reasoning evaluations if desired.

---

## 2. Standalone Installation & Bootstrapping

To keep this tool isolated from the main repository's complex corporate build environments and standard catalog rules, install its dependencies independently:

```bash
# 1. Navigate to the tool directory
cd tools/issue-triage

# 2. Run a standalone installation of package dependencies
pnpm install
```

---

## 3. Running the Standalone CLI Triage Sweep

Before launching the web application, you must run the **Batch-First Sweep Script** to sync open issues and populate the local database cache:

```bash
# --- RECOMMENDED INITIAL TEST ---
# Run a quick, limited trial sweep of the first 5 issues to check connections and LLM configurations
pnpm sweep --limit 5

# --- SINGLE TARGET FOCUS ---
# Target a specific open issue number directly to audit the prompt response and structured payload
pnpm sweep --issue 18234

# --- FULL PRODUCTION QUEUE SWEEP ---
# Run a full queue evaluation sweep (skips already triaged issues automatically to preserve tokens)
pnpm sweep

# --- FORCE RE-EVALUATION SWEEP ---
# Force Gemini to re-analyze all active open issues, overwriting existing local results
pnpm sweep --force
```

### Script Tasks Completed:
* Syncs open issue headers from the repository and caches raw data physically to disk (`data/issues_cache.json`).
* Automatically triggers the **Community Interaction Shield** (bypasses Gemini costs and locks issues against automated closures if an issue has `comments_count > 4` or `upvotes_count > 4`).
* Sequentially loads comment threads on-demand, formats the 12 custom prompt context rules, calls the Gemini API, and saves evaluations to disk (`data/triage_results.json`).

---

## 4. Launching the Interactive Web Dashboard

Once your database is populated, launch the modern local dashboard:

```bash
# Start the local Express BFF server and the dynamic Angular client dev server concurrently
pnpm dev
```

### Network Bindings & Services:
* **Express BFF API Port**: `http://127.0.0.1:3000` (locked strictly to loopback host for safety).
* **Angular Client Dashboard Port**: [http://127.0.0.1:4200](http://127.0.0.1:4200) (auto-proxies all data traffic to Port 3000).

Open your browser and navigate to [http://127.0.0.1:4200](http://127.0.0.1:4200) to begin the interactive triage!

---

## 5. Operating the Keyboard Triage Desk

The dashboard supports a high-performance keyboard interface to let you move through the triage queue at maximum efficiency:

*   <kbd>J</kbd> or <kbd>↓</kbd> : Select and focus the **next** filtered issue in the scroll grid.
*   <kbd>K</kbd> or <kbd>↑</kbd> : Select and focus the **previous** filtered issue in the scroll grid.
*   <kbd>C</kbd> : **Confirm Triage Close Action**. Programmatically applies the `'triage: close-candidate'` label on GitHub via safe Octokit endpoints. Optimistically transitions the element out of the current filter list and advances selections down automatically. *(Note: Disabled on high-engagement topics locked by the Community Shield).*
*   <kbd>S</kbd> : **Skip / Keep Active**. Marks the issue as reviewed but skips labeling actions, keeping the item active on GitHub and advancing focus down automatically.
*   <kbd>O</kbd> : Focus the **Manual Category Override** dropdown. Use arrow keys and enter to select a different classification on-the-fly.

---

## 6. Offline Working (Offline-First Mode)

This tool is engineered to support complete offline operations:
* If you have no active network connection or active API keys, you can still launch `pnpm dev` and perform complete searches, text filters, view cached comments, read LLM reasoning reports, and make manual category selections.
* When your network connection resumes, click the status button in the top bar or trigger the sync CLI to publish queued actions and update caches.
