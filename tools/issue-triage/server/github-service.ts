import { Octokit } from '@octokit/rest';
import { AppConfig } from './config';
import { CachedIssue, IssueComment } from './data-service';

export class GithubService {
  private octokit: Octokit;
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
    this.octokit = new Octokit({
      auth: config.githubToken
    });
  }

  /**
   * Fetches open issues from the repository. Uses dynamic delta syncing (since timestamp)
   * if provided, and filters out standard Pull Requests (GitHub represents PRs as issues internally).
   */
  async fetchOpenIssuesSince(sinceIsoString?: string): Promise<CachedIssue[]> {
    const { repoOwner, repoName } = this.config;
    console.log(`[GitHub] Querying issues in ${repoOwner}/${repoName}... ${sinceIsoString ? `(Modified since: ${sinceIsoString})` : '(Full download sweep)'}`);
    
    try {
      const rawIssues = await this.octokit.paginate(this.octokit.issues.listForRepo, {
        owner: repoOwner,
        repo: repoName,
        state: 'open',
        per_page: 100,
        direction: 'asc', // Process oldest first
        ...(sinceIsoString ? { since: sinceIsoString } : {})
      });

      // Filter out standard PR links and map raw REST items to our clean database entities
      const mapped: CachedIssue[] = rawIssues
        .filter(issue => !issue.pull_request)
        .map(issue => ({
          number: issue.number,
          title: issue.title,
          body: issue.body || '',
          state: issue.state,
          html_url: issue.html_url,
          author: issue.user?.login || 'unknown',
          created_at: issue.created_at,
          updated_at: issue.updated_at,
          comments_count: issue.comments || 0,
          // Extract 👍 reactions as standard upvote values for Community Shield
          upvotes_count: (issue.reactions as any)?.['+1'] || 0,
          labels: issue.labels.map((l: any) => typeof l === 'string' ? l : l.name || '')
        }));

      console.log(`[GitHub] Successfully indexed ${mapped.length} open issue targets.`);
      return mapped;
    } catch (err) {
      console.error('[GitHub] Error fetching issues from repository:', (err as Error).message);
      throw err;
    }
  }

  /**
   * Fetches comment chains for a single issue. Restricts fetch limits to top 50 comments
   * to conserve resources and avoid secondary rate limits.
   */
  async fetchCommentsForIssue(issueNumber: number): Promise<IssueComment[]> {
    const { repoOwner, repoName } = this.config;
    try {
      const response = await this.octokit.issues.listComments({
        owner: repoOwner,
        repo: repoName,
        issue_number: issueNumber,
        per_page: 50
      });

      return response.data.map(c => ({
        id: c.id,
        author: c.user?.login || 'unknown',
        body: c.body || '',
        created_at: c.created_at
      }));
    } catch (err) {
      console.error(`[GitHub] Error fetching comments for issue #${issueNumber}:`, (err as Error).message);
      throw err;
    }
  }

  /**
   * Applies the target candidate label to the selected issue on GitHub.
   */
  async applyTriageLabel(issueNumber: number): Promise<void> {
    const { repoOwner, repoName, triageLabel } = this.config;
    console.log(`[GitHub] Applying label '${triageLabel}' to issue #${issueNumber}...`);
    
    try {
      await this.octokit.issues.addLabels({
        owner: repoOwner,
        repo: repoName,
        issue_number: issueNumber,
        labels: [triageLabel]
      });
      console.log(`[GitHub] Label '${triageLabel}' applied successfully to issue #${issueNumber}.`);
    } catch (err) {
      console.error(`[GitHub] Failed to apply label to issue #${issueNumber}:`, (err as Error).message);
      throw err;
    }
  }

  /**
   * Posts a triage/closure comment on the selected issue.
   */
  async postComment(issueNumber: number, body: string): Promise<void> {
    const { repoOwner, repoName } = this.config;
    try {
      await this.octokit.issues.createComment({
        owner: repoOwner,
        repo: repoName,
        issue_number: issueNumber,
        body
      });
      console.log(`[GitHub] Comment posted successfully on issue #${issueNumber}.`);
    } catch (err) {
      console.error(`[GitHub] Failed to post comment on issue #${issueNumber}:`, (err as Error).message);
      throw err;
    }
  }

  /**
   * Closes the target issue on GitHub.
   */
  async closeIssue(issueNumber: number): Promise<void> {
    const { repoOwner, repoName } = this.config;
    try {
      await this.octokit.issues.update({
        owner: repoOwner,
        repo: repoName,
        issue_number: issueNumber,
        state: 'closed'
      });
      console.log(`[GitHub] Issue #${issueNumber} successfully marked as CLOSED.`);
    } catch (err) {
      console.error(`[GitHub] Failed to close issue #${issueNumber}:`, (err as Error).message);
      throw err;
    }
  }

  /**
   * Helper to sleep execution (used to prevent exceeding rate limits).
   */
  async paceDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
