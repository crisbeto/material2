import { GoogleGenAI, Type, Schema } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import { AppConfig } from './config';
import { CachedIssue, IssueComment, TriageResult, TriageCategory, ObsolescenceReason } from './data-service';

export class GeminiService {
  private ai: GoogleGenAI;
  private modelName: string;

  constructor(config: AppConfig) {
    // Instantiate standard client using process API Key
    this.ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    this.modelName = config.geminiModel;
  }

  /**
   * Constructs the structured prompt context for the active issue, executes the Gemini API request
   * enforcing a strict JSON output schema, parses the response, and returns the finished TriageResult.
   */
  async analyzeIssue(issue: CachedIssue, comments: IssueComment[] = []): Promise<Partial<TriageResult>> {
    const commentsSegment = comments.length > 0
      ? comments.map(c => `[Comment by @${c.author} on ${c.created_at}]:\n${c.body}`).join('\n\n')
      : 'No comments yet.';

    // Load dynamic learned rules from disk if present to achieve self-learning adaptive prompting
    const learnedRulesPath = path.resolve(__dirname, '../data/crisbeto_prompt_rules.json');
    let learnedRulesSegment = '';
    if (fs.existsSync(learnedRulesPath)) {
      try {
        const rules = JSON.parse(fs.readFileSync(learnedRulesPath, 'utf-8')) as string[];
        if (rules.length > 0) {
          learnedRulesSegment = '\n\nAdditional learned triage rules synthesized from @crisbeto\'s actual past closures:\n' + 
            rules.map((r, index) => `- **Learned Rule ${index + 1}**: ${r}`).join('\n');
        }
      } catch (err) {
        console.warn('[Gemini] Failed to load dynamic learned rules:', err);
      }
    }

    const promptText = `
You are a highly experienced compiler and UI engineer on the Angular Core Components team. Your job is to perform a technical triage of an open issue report from our GitHub queue. We want to identify whether this issue is a valid active defect/proposal, a duplicate, a support question, missing reproducible details, or no longer relevant due to architectural evolution.

Apply the following 12 strict domain-specific rules to your evaluation:

- **Rule 1: Legacy MDC-based Refactoring & Deletions**: In Angular Material v15, all components were rewritten to use standard MDC-based web markup structures. The older pre-MDC components (renamed to "legacy" components: e.g., mat-legacy-table, mat-legacy-button, mat-legacy-select) were fully deprecated and then deleted in Angular v17. Any open issue complaining about styling, class configurations, or bugs in the legacy packages is NO-LONGER-RELEVANT (obsolescence: api-rewritten).
- **Rule 2: Browser Lifecycles & Deprecations**: Angular dropped support for Internet Explorer 11 in Angular v13, and legacy non-Chromium Edge in subsequent cycles. Any layout, accessibility, or JS bug specific to IE11, non-Chromium Edge, or old mobile engines (iOS < 12, Android < 5) is NO-LONGER-RELEVANT (obsolescence: outdated-version).
- **Rule 3: Undocumented Internal Styling & Private Overrides**: We do not support or guarantee DOM stability for undocumented, internal DOM structures or classes (like selectors with structural prefixes: e.g., mat-mdc-* or private wrapper nodes). Styling breakages following library upgrades due to developers target-hacking internal classes (e.g. using ::ng-deep or deep overrides instead of official design tokens or custom CSS variables) are SUPPORT-QUESTION or NO-LONGER-RELEVANT.
- **Rule 4: Environment Mismatches & Peer Dependencies**: Version mismatches across workspace libraries are user configuration errors. If logs or diagnostics show mismatched main package versions (e.g., trying to run Angular Material v19 packages on an Angular Core v21 application, or mixing different core package versions), classify it as a SUPPORT-QUESTION.
- **Rule 5: Material Design Specification Adherence**: We strictly implement Google's official Material Design guidelines (Material 2/3). Issues requesting changes in component paddings, colors, animations, or layouts that directly violate these official design specifications are SUPPORT-QUESTION or NO-LONGER-RELEVANT.
- **Rule 6: Deprecated Flex Layout Library**: The @angular/flex-layout package is dead and support has ended. Visual issues occurring only when combining components with the legacy @angular/flex-layout package are NO-LONGER-RELEVANT (obsolescence: legacy framework dependency; users should migrate to CSS layout grids/flexbox).
- **Rule 7: Global Style & CSS resets conflicts**: Layout breakages due to global stylesheets/resets from other frameworks (e.g., Tailwind CSS button resets overriding default padding, or global box-sizing rules like content-box overrides) are SUPPORT-QUESTION (third-party style sheet conflict).
- **Rule 8: Accessibility Standards (WCAG Compliance)**: Focus outlines, accessible keyboard traps, visual focus indicators, and screen reader announcements are non-optional a11y requirements. Issues requesting deletion or disabling of standard accessible structures (e.g., "disable outline focus rings because they look ugly") are SUPPORT-QUESTION (explaining standard WCAG compliance rules).
- **Rule 9: Stale Reproduction (StackBlitz) Requests**: We require a minimal, runnable code example to reproduce bug claims. If the comment history shows a team member requested a reproduction StackBlitz or repo link, AND the reporter has been idle (no replies or repository updates) for more than 3 months, classify the issue as NEEDS-REPRO.
- **Rule 10: Stale Ancient Major Versions (Older than Angular v14)**: We limit active maintenance to recent LTS targets. Open issues reporting bugs on Angular versions older than v14 (Angular v13 or older) with absolutely no activity for more than 6 months are NO-LONGER-RELEVANT (obsolescence: outdated-version).
- **Rule 11: Feature Requests vs. Defect Identification**: If the report describes expected, spec-compliant component behavior but asks for a new configuration flag, layout variable option, or dynamic callback parameter, classify the issue as a FEATURE-REQUEST.
- **Rule 12: Community Engagement & Interaction Shield Safeguard**: High upvote or comment counts indicate severe pain points. Highly commented or upvoted issues should **NEVER** be recommended for closure or marked as no-longer-relevant/support-question; they must be identified as valid-bug or feature-request for developer manual audit.
- **Rule 13: Stale Low Priority Heuristics**: Issues labeled with low priority/severity tags (such as 'P4', 'P5', 'priority: p4', 'priority: p5', 'severity: p4', 'severity: p5') that have absolutely no update or comment activity in the past 5 years are close candidates. If so, classify the issue as STALE-P4-P5 (obsolescence reason: outdated-version) with 1.0 confidence, and set suggested action to 'Apply target close-candidate label.'
- **Rule 14: Stale Low-Engagement Features**: Feature requests or proposals (tags like 'feature', 'type: feature', 'proposal') older than 3 years with less than 3 comments and less than 3 upvotes are close candidates. If so, classify the issue as STALE-FEATURE (obsolescence reason: none) with 1.0 confidence, and set suggested action to 'Apply target close-candidate label.'
- **Rule 15: Stale Unresolved Repros**: Issues with reproduction-needed tags (such as 'repro', 'reproduction', 'needs repro', 'needs reproduction', 'repro-needed') that have been stale with no updates for more than 1 year are close candidates. If so, classify the issue as STALE-REPRO (obsolescence reason: none) with 1.0 confidence, and set suggested action to 'Apply target close-candidate label.'
- **Rule 16: Stale Legacy Releases**: Bug reports complaining about old Angular/Material releases v15 or older, where the issue is older than 3 years and has low community engagement (comments <= 2, upvotes <= 2) are close candidates. If so, classify the issue as STALE-RELEASE (obsolescence reason: outdated-version) with 1.0 confidence, and set suggested action to 'Apply target close-candidate label.'
${learnedRulesSegment}

---
ISSUE METADATA:
- Issue Number: #${issue.number}
- Title: "${issue.title}"
- Author: @${issue.author}
- Created At: ${issue.created_at} | Updated At: ${issue.updated_at}
- Comments Count: ${issue.comments_count}
- Thumbs Up (+1) Upvotes Count: ${issue.upvotes_count}

---
ISSUE DESCRIPTION:
${issue.body}

---
RECENT COMMENT CHRONOLOGY:
${commentsSegment}
`;

    // Define strict response output validation schema
    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        category: {
          type: Type.STRING,
          enum: ["valid-bug", "duplicate", "no-longer-relevant", "support-question", "needs-repro", "feature-request", "stale-p4-p5"]
        },
        confidence: { type: Type.NUMBER },
        reasoning: { type: Type.STRING },
        suggested_action: { type: Type.STRING },
        duplicate_of_issue_number: { type: Type.INTEGER, nullable: true },
        obsolescence_reason: {
          type: Type.STRING,
          enum: ["outdated-version", "api-rewritten", "none", "other"]
        }
      },
      required: ["category", "confidence", "reasoning", "suggested_action", "duplicate_of_issue_number", "obsolescence_reason"]
    };

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: promptText,
        config: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
          temperature: 0.1, // Set low temperature for highly stable deterministic triage results
          systemInstruction: 'You are a technical triaging agent for the Angular Components team. Respond strictly in the JSON format requested, analyzing the input text accurately.'
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error('Gemini API returned an empty output stream.');
      }

      const parsed = JSON.parse(text);

      return {
        category: parsed.category as TriageCategory,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        suggested_action: parsed.suggested_action,
        duplicate_of_issue_number: parsed.duplicate_of_issue_number,
        obsolescence_reason: parsed.obsolescence_reason as ObsolescenceReason,
        analysis_timestamp: Date.now()
      };
    } catch (err) {
      console.error(`[Gemini] Error evaluating issue #${issue.number}:`, (err as Error).message);
      return {
        category: 'valid-bug', // Fallback to safe valid-bug to prevent erroneous auto-closes
        confidence: 0.0,
        reasoning: `Analysis failed due to API execution error: ${(err as Error).message}`,
        suggested_action: 'Perform a manual triage pass.',
        duplicate_of_issue_number: null,
        obsolescence_reason: 'none',
        error_message: (err as Error).message,
        analysis_timestamp: Date.now()
      };
    }
  }
}
