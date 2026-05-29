import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

@Pipe({
  name: 'safeMarkdown',
  standalone: true
})
export class SafeMarkdownPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  /**
   * Safe markdown compilation transform. Formats issue body blocks via marked and purifies
   * elements via DOMPurify before bypassing Angular security systems.
   */
  transform(value: string | null | undefined): SafeHtml {
    if (!value) return '';
    
    try {
      // 1. Compile raw markdown text into standard HTML string representation
      const rawHtml = marked.parse(value) as string;
      
      // 2. Sanitize compiled blocks via strict element/attribute allowlists
      const cleanHtml = DOMPurify.sanitize(rawHtml, {
        ALLOWED_TAGS: [
          'p', 'b', 'i', 'em', 'strong', 'a', 'code', 'pre', 'ul', 'ol', 'li', 
          'h1', 'h2', 'h3', 'h4', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'br', 'span'
        ],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
      });
      
      // 3. Mark the safe, purified content for browser template assignments
      return this.sanitizer.bypassSecurityTrustHtml(cleanHtml);
    } catch (err) {
      console.error('[Pipe] SafeMarkdown compilation failed:', err);
      return this.sanitizer.bypassSecurityTrustHtml(
        `<p style="color: var(--color-close); font-weight: 500;">⚠️ SafeMarkdown Error: Failed to render layout block securely.</p>`
      );
    }
  }
}
