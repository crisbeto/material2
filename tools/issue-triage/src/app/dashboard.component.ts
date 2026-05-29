import {Component, OnInit, HostListener, signal, computed} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {
  TriageService,
  CacheMergedIssue,
  TriageVerdict,
  TriageCategory,
  TriageStatus,
} from './triage.service';
import {SafeMarkdownPipe} from './safe-markdown.pipe';

@Component({
  selector: 'app-triage-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, SafeMarkdownPipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class TriageDashboardComponent implements OnInit {
  // --- SIGNAL STATES ---
  issuesList = signal<CacheMergedIssue[]>([]);
  selectedIssueId = signal<number | null>(null);
  searchQuery = signal<string>('');
  activeCategoryFilter = signal<string>('all');
  activeStatusFilter = signal<string>('pending');

  isSystemLoading = signal<boolean>(true);
  isBatchProcessing = signal<boolean>(false);
  lastSyncTime = signal<string | null>(null);

  // Batch progress values
  batchProgressCurrent = signal<number>(0);
  batchProgressTotal = signal<number>(0);
  batchProgressFailures = signal<number>(0);

  // Expose local configuration mapping for template bindings
  config = {triageLabel: 'action: close-candidate'};

  // --- COMPUTED STATES ---
  selectedIssue = computed(() => {
    const id = this.selectedIssueId();
    return id ? this.issuesList().find(i => i.number === id) || null : null;
  });

  selectedVerdict = computed(() => {
    return this.selectedIssue()?.verdict || null;
  });

  isCommunityShielded = computed(() => {
    const issue = this.selectedIssue();
    if (!issue) return false;
    const v = issue.verdict;
    const hasActiveShield = issue.comments_count > 8 || issue.upvotes_count > 8;
    return hasActiveShield && (!v || !v.is_shield_overridden);
  });

  stats = computed(() => {
    const list = this.issuesList();
    const triage = list.map(i => i.verdict);

    let total = list.length;
    let shielded = 0;
    let approved = 0;
    let skipped = 0;
    let applied = 0;
    let pendingClose = 0;

    const categories: Record<string, number> = {
      'valid-bug': 0,
      'duplicate': 0,
      'no-longer-relevant': 0,
      'support-question': 0,
      'needs-repro': 0,
      'feature-request': 0,
      'stale-p4-p5': 0,
      'stale-feature': 0,
      'stale-repro': 0,
      'stale-release': 0,
    };

    list.forEach(item => {
      const v = item.verdict;

      // Count interaction shielded elements
      if (item.comments_count > 8 || item.upvotes_count > 8) {
        shielded++;
      }

      // Triage status categorizations
      if (v.triage_status === 'approved') approved++;
      else if (v.triage_status === 'skipped') skipped++;
      else if (v.triage_status === 'applied') applied++;

      // Distribute categories
      if (v.category in categories) {
        categories[v.category]++;
      }

      // Check if it represents a pending auto-close candidate
      const isCloseCandidate =
        v.category === 'no-longer-relevant' ||
        v.category === 'needs-repro' ||
        v.category === 'support-question' ||
        v.category === 'stale-p4-p5' ||
        v.category === 'stale-feature' ||
        v.category === 'stale-repro' ||
        v.category === 'stale-release';

      const isShielded = item.comments_count > 8 || item.upvotes_count > 8;

      if (isCloseCandidate && v.triage_status === 'pending' && !isShielded) {
        pendingClose++;
      }
    });

    return {
      total,
      shielded,
      approved,
      skipped,
      applied,
      pendingClose,
      categories,
    };
  });

  // Filters loop logic applying search + category tabs + status views
  filteredIssues = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const catFilter = this.activeCategoryFilter();
    const statusFilter = this.activeStatusFilter();

    return this.issuesList().filter(item => {
      const v = item.verdict;

      // Keyword search matches on number or title
      const matchesSearch =
        !query ||
        item.number.toString().includes(query) ||
        item.title.toLowerCase().includes(query) ||
        item.author.toLowerCase().includes(query);

      // Category filters matches
      const matchesCategory = catFilter === 'all' || v.category === catFilter;

      // Status filters matches
      let matchesStatus = true;
      if (statusFilter !== 'all') {
        matchesStatus = v.triage_status === statusFilter;
      }

      return matchesSearch && matchesCategory && matchesStatus;
    });
  });

  // Make global Math utility accessible in the template
  Math = Math;

  constructor(private triageService: TriageService) {}

  ngOnInit(): void {
    this.loadData();
  }

  /**
   * Safe string formatter utility for dynamic category elements presentation.
   */
  formatCategory(cat: string | null | undefined): string {
    if (!cat) return '';
    return cat.replace(/-/g, ' ');
  }

  /**
   * Pulls the cached database records and classifications results from our local BFF Express server.
   */
  loadData(): void {
    this.isSystemLoading.set(true);
    this.triageService.getIssues().subscribe({
      next: res => {
        // Sort: Process issues by creation date (oldest first)
        const sorted = res.issues.sort((a, b) => a.created_at.localeCompare(b.created_at));
        this.issuesList.set(sorted);
        this.lastSyncTime.set(res.last_sync_timestamp);

        // Select first active issue if none is active or selected is invalid
        const currentSelected = this.selectedIssueId();
        if (
          sorted.length > 0 &&
          (!currentSelected || !sorted.some(i => i.number === currentSelected))
        ) {
          // Select first filtered item as default
          const filtered = this.filteredIssues();
          if (filtered.length > 0) {
            this.selectedIssueId.set(filtered[0].number);
          } else {
            this.selectedIssueId.set(sorted[0].number);
          }
        }
        this.isSystemLoading.set(false);
      },
      error: err => {
        console.error('[Dashboard] Failed to fetch cache files from BFF:', err);
        alert(
          'CRITICAL ERROR: Failed to connect to local Express BFF API. Please ensure your backend server is running (pnpm dev:server).',
        );
        this.isSystemLoading.set(false);
      },
    });
  }

  /**
   * Sets active category filter tabs.
   */
  filterByCategory(cat: string): void {
    this.activeCategoryFilter.set(cat);
    this.autoSelectFirstFiltered();
  }

  /**
   * Sets active triage status filter views (Pending, Labeled, Skipped).
   */
  filterByStatus(status: string): void {
    this.activeStatusFilter.set(status);
    this.autoSelectFirstFiltered();
  }

  /**
   * Helper to select first filtered issue on filter transitions.
   */
  public autoSelectFirstFiltered(): void {
    const filtered = this.filteredIssues();
    if (filtered.length > 0) {
      this.selectedIssueId.set(filtered[0].number);
    } else {
      this.selectedIssueId.set(null);
    }
  }

  /**
   * Selects an individual issue from the list panel.
   */
  selectIssue(num: number): void {
    this.selectedIssueId.set(num);
  }

  /**
   * KEY ACTION: Approve candidate for closure.
   * Dispatches command to apply the close candidate label on GitHub and skips to next entry.
   */
  approveTriage(): void {
    const issue = this.selectedIssue();
    if (!issue || this.isCommunityShielded()) return; // Block protected entities

    const num = issue.number;
    const activeCategory = issue.verdict.category;

    // Optimistic UI updates state locally
    this.updateIssueStatusLocally(num, 'approved', true);
    this.advanceToNextIssue();

    // Trigger backend API call to execute labeling proxied via BFF
    this.triageService.submitTriageAction(num, 'approved', activeCategory).subscribe({
      error: err => {
        console.error(`[BFF] Action failed for issue #${num}:`, err);
        // Rollback state and log error local status
        this.updateIssueStatusLocally(
          num,
          'pending',
          false,
          err.error || 'Labeling action failed.',
        );
        alert(
          `❌ Failed to apply label to issue #${num}: ${err.error || err.message || 'Network error'}`,
        );
      },
    });
  }

  /**
   * KEY ACTION: Keep active / Skip close proposal.
   * Marks status skipped locally and shifts active focus to next item.
   */
  skipIssue(): void {
    const issue = this.selectedIssue();
    if (!issue) return;

    const num = issue.number;

    // Optimistic local transitions
    this.updateIssueStatusLocally(num, 'skipped', true);
    this.advanceToNextIssue();

    // Commit local state adjustment to persistent file cache
    this.triageService.submitTriageAction(num, 'skipped').subscribe({
      error: err => {
        console.error(`[BFF] Action failed for issue #${num}:`, err);
        this.updateIssueStatusLocally(num, 'pending', false, err.error);
      },
    });
  }

  /**
   * KEY ACTION: Apply a manual category selection override.
   */
  overrideCategory(category: TriageCategory): void {
    const issue = this.selectedIssue();
    if (!issue) return;

    const num = issue.number;

    // Update in-memory signals state optimistically
    this.issuesList.update(list => {
      return list.map(item => {
        if (item.number === num) {
          const updatedVerdict = {...item.verdict, user_category: category, is_reviewed: true};
          return {...item, verdict: updatedVerdict};
        }
        return item;
      });
    });

    // Pushes override update back to server JSON database
    this.triageService.submitCategoryOverride(num, category).subscribe({
      error: err => {
        console.error(`[BFF] Override failed for issue #${num}:`, err);
        alert('Failed to save manual category override.');
      },
    });
  }

  /**
   * BATCH ACTION: Automatically processes all current close candidates in the viewport list!
   */
  runBatchLabeling(): void {
    const activeViewCandidates = this.issuesList().filter(item => {
      const v = item.verdict;
      return v.triage_status === 'approved';
    });

    if (activeViewCandidates.length === 0) {
      alert('No approved close candidates exist in the current list to execute batch operations.');
      return;
    }

    const confirmRun = confirm(
      `⚠️ BATCH ACTION WARNING\n\nAre you sure you want to apply the target close label to all ${activeViewCandidates.length} issues currently marked as "Approved for close" on GitHub?\n\nThis script will process issues sequentially with standard pacing intervals.`,
    );
    if (!confirmRun) return;

    const numbers = activeViewCandidates.map(i => i.number);

    // Open loading progress card and set states
    this.isBatchProcessing.set(true);
    this.batchProgressTotal.set(numbers.length);
    this.batchProgressCurrent.set(0);
    this.batchProgressFailures.set(0);

    // Optimistically update all in-memory statuses to applied to provide fast feedback
    numbers.forEach(num => this.updateIssueStatusLocally(num, 'applied', true));

    this.triageService.submitBatchLabel(numbers).subscribe({
      next: res => {
        this.isBatchProcessing.set(false);
        this.loadData(); // Re-sync local state models directly from disk cache outputs

        const summary = `Batch complete!\n\nSuccesses: ${res.successCount}\nFailures: ${res.failureCount}`;
        if (res.failureCount > 0) {
          const detail = res.failures.map(f => `  - #${f.number}: ${f.error}`).join('\n');
          alert(`${summary}\n\nError details:\n${detail}`);
        } else {
          alert(summary);
        }
      },
      error: err => {
        console.error('[BFF] Batch action failed:', err);
        alert('Batch labeling operation encountered a critical exception.');
        this.isBatchProcessing.set(false);
        this.loadData();
      },
    });
  }

  // --- KEYBOARD LISTENER ACCELERATORS ROUTINGS ---
  @HostListener('window:keydown', ['$event'])
  handleKeyboardAccelerators(event: KeyboardEvent): void {
    // 1. Focus block safety: verify the user is not keying inside an input, textarea or select dropdown
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
      return;
    }

    const key = event.key.toLowerCase();

    switch (key) {
      case 'j':
      case 'arrowdown':
        event.preventDefault();
        this.navigateSelection('down');
        break;
      case 'k':
      case 'arrowup':
        event.preventDefault();
        this.navigateSelection('up');
        break;
      case 'c':
        // Approve closure (Applies target label)
        if (this.selectedIssue() && !this.isCommunityShielded()) {
          event.preventDefault();
          this.approveTriage();
        } else if (this.isCommunityShielded()) {
          console.warn('[Shield Alert] Approve action blocked due to active community safeguard.');
        }
        break;
      case 's':
        // Skip current candidate (Keeps active)
        if (this.selectedIssue()) {
          event.preventDefault();
          this.skipIssue();
        }
        break;
      case 'o':
        // Focus the override select dropdown element if exists
        event.preventDefault();
        const dropdown = document.getElementById('category-override-select') as HTMLSelectElement;
        if (dropdown) {
          dropdown.focus();
        }
        break;
      case 'v':
      case 'enter':
        // Open issue in a new tab
        const issue = this.selectedIssue();
        if (issue && issue.html_url) {
          event.preventDefault();
          window.open(issue.html_url, '_blank');
        }
        break;
    }
  }

  /**
   * Handles keyboard focus navigational loops.
   */
  private navigateSelection(direction: 'up' | 'down'): void {
    const list = this.filteredIssues();
    if (list.length === 0) return;

    const currentId = this.selectedIssueId();
    const idx = list.findIndex(i => i.number === currentId);

    let nextIdx = 0;
    if (direction === 'down') {
      nextIdx = idx === -1 || idx === list.length - 1 ? 0 : idx + 1;
    } else {
      nextIdx = idx === -1 || idx === 0 ? list.length - 1 : idx - 1;
    }

    const targetNum = list[nextIdx].number;
    this.selectedIssueId.set(targetNum);

    // Auto scroll list panel viewport if target element is hidden
    setTimeout(() => {
      const activeEl = document.getElementById(`issue-card-${targetNum}`);
      if (activeEl) {
        activeEl.scrollIntoView({block: 'nearest', behavior: 'smooth'});
      }
    }, 50);
  }

  /**
   * Automatically shifts active list focus down to the next candidate item in viewport
   * following key decisions triggers.
   */
  private advanceToNextIssue(): void {
    const list = this.filteredIssues();
    const currentId = this.selectedIssueId();
    const idx = list.findIndex(i => i.number === currentId);

    // If there is an item after the current one, select it
    if (idx !== -1 && idx < list.length - 1) {
      this.selectedIssueId.set(list[idx + 1].number);
    } else if (list.length > 1) {
      // Loop back to first item remaining in index list
      this.selectedIssueId.set(list[0].number);
    } else {
      this.selectedIssueId.set(null);
    }
  }

  /**
   * Helper to update in-memory state models for optimistic transitions.
   */
  private updateIssueStatusLocally(
    num: number,
    status: TriageStatus,
    reviewed: boolean,
    errorMsg: string | null = null,
  ): void {
    this.issuesList.update(list => {
      return list.map(item => {
        if (item.number === num) {
          const updatedVerdict = {
            ...item.verdict,
            triage_status: status,
            is_reviewed: reviewed,
            error_message: errorMsg,
          };
          return {...item, verdict: updatedVerdict};
        }
        return item;
      });
    });
  }

  /**
   * Generates display percentage classes.
   */
  getConfidenceColor(score: number): string {
    if (score >= 0.85) return 'var(--color-valid)';
    if (score >= 0.6) return 'var(--color-repro)';
    return 'var(--color-text-muted)';
  }

  /**
   * KEY ACTION: Override the Community Shield active bypass lock.
   */
  toggleShieldOverride(): void {
    const issue = this.selectedIssue();
    if (!issue) return;

    const num = issue.number;
    const currentOverride = !!issue.verdict.is_shield_overridden;
    const newOverride = !currentOverride;

    // Update in-memory signal state optimistically
    this.issuesList.update(list => {
      return list.map(item => {
        if (item.number === num) {
          return {
            ...item,
            verdict: {
              ...item.verdict,
              is_shield_overridden: newOverride
            }
          };
        }
        return item;
      });
    });

    // Persist override setting to database via BFF API
    this.triageService.submitShieldOverride(num, newOverride).subscribe({
      error: (err) => {
        console.error(`[BFF] Shield override failed for issue #${num}:`, err);
        alert('Failed to override Community Shield state.');
        
        // Rollback state
        this.issuesList.update(list => {
          return list.map(item => {
            if (item.number === num) {
              return {
                ...item,
                verdict: {
                  ...item.verdict,
                  is_shield_overridden: currentOverride
                }
              };
            }
            return item;
          });
        });
      }
    });
  }
}
