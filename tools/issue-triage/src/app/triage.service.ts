import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Strict model parameters mapping backend payloads
export interface IssueComment {
  id: number;
  author: string;
  body: string;
  created_at: string;
}

export type TriageCategory = 'valid-bug' | 'duplicate' | 'no-longer-relevant' | 'support-question' | 'needs-repro' | 'feature-request' | 'stale-p4-p5' | 'stale-feature' | 'stale-repro' | 'stale-release';
export type TriageStatus = 'pending' | 'approved' | 'skipped' | 'applied';
export type ObsolescenceReason = 'outdated-version' | 'api-rewritten' | 'none' | 'other';

export interface TriageVerdict {
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

export interface CacheMergedIssue {
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
  comments?: IssueComment[];
  verdict: TriageVerdict;
}

export interface IssuesResponse {
  last_sync_timestamp: string | null;
  issues: CacheMergedIssue[];
}

export interface BatchActionResponse {
  successCount: number;
  failureCount: number;
  successes: number[];
  failures: { number: number; error: string }[];
}

@Injectable({
  providedIn: 'root'
})
export class TriageService {
  private basePrefix = '/api';

  constructor(private http: HttpClient) {}

  /**
   * GET /api/issues
   * Fetches the dynamic list of merged cache records.
   */
  getIssues(): Observable<IssuesResponse> {
    return this.http.get<IssuesResponse>(`${this.basePrefix}/issues`);
  }

  /**
   * POST /api/triage/:number/action
   * Triggers a triage review command: either skipping the candidate or applying a label target tag.
   */
  submitTriageAction(
    issueNumber: number, 
    action: TriageStatus, 
    userCategory?: TriageCategory
  ): Observable<{ success: boolean; verdict: TriageVerdict }> {
    return this.http.post<{ success: boolean; verdict: TriageVerdict }>(
      `${this.basePrefix}/triage/${issueNumber}/action`,
      { action, userCategory }
    );
  }

  /**
   * POST /api/triage/:number/override
   * Commits a manual category selection override.
   */
  submitCategoryOverride(
    issueNumber: number, 
    category: TriageCategory
  ): Observable<{ success: boolean; verdict: TriageVerdict }> {
    return this.http.post<{ success: boolean; verdict: TriageVerdict }>(
      `${this.basePrefix}/triage/${issueNumber}/override`,
      { category }
    );
  }

  /**
   * POST /api/triage/batch-action
   * Dispatches a multi-target labeling action queue sequence.
   */
  submitBatchLabel(issueNumbers: number[]): Observable<BatchActionResponse> {
    return this.http.post<BatchActionResponse>(
      `${this.basePrefix}/triage/batch-action`,
      { issueNumbers }
    );
  }

  /**
   * POST /api/triage/:number/shield-override
   * Toggles the programmatic Community Shield active bypass lock flag.
   */
  submitShieldOverride(issueNumber: number, overridden: boolean): Observable<{ success: boolean; verdict: TriageVerdict }> {
    return this.http.post<{ success: boolean; verdict: TriageVerdict }>(
      `${this.basePrefix}/triage/${issueNumber}/shield-override`,
      { overridden }
    );
  }
}
