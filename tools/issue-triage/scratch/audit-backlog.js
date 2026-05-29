const fs = require('fs');
const path = require('path');

const cachePath = path.resolve(__dirname, '../data/issues_cache.json');
if (!fs.existsSync(cachePath)) {
  console.error('Cache database not found at:', cachePath);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
const issues = Object.values(data.issues).filter(i => i.state === 'open');

// 1. Shield boundaries comparisons
let shieldedOld = 0;
let shieldedNew = 0;
issues.forEach(i => {
  if (i.comments_count > 4 || i.upvotes_count > 4) shieldedOld++;
  if (i.comments_count > 10 || i.upvotes_count > 10) shieldedNew++;
});

// Helper for years stale checks
const isYearsStale = (dateStr, years) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff > years * 365.25 * 24 * 3600 * 1000;
};

// Helper for label searches
const hasLabel = (issue, term) => {
  return issue.labels && issue.labels.some(l => l.toLowerCase().includes(term));
};

// 2. New Gates audits (applying the new shield boundary of >10 to allow triage)
let staleFeatures = 0;
let staleRepros = 0;
let staleReleases = 0;

issues.forEach(i => {
  const isShielded = i.comments_count > 10 || i.upvotes_count > 10;
  if (isShielded) return;

  // Stale Feature requests (>3 years, low backing)
  const isFeature = hasLabel(i, 'feature') || hasLabel(i, 'type: feature') || hasLabel(i, 'proposal');
  if (isFeature && isYearsStale(i.updated_at, 3) && i.comments_count < 3 && i.upvotes_count < 3) {
    staleFeatures++;
    return;
  }

  // Stale Repro needed (>1 year, has needs repro tag)
  const needsRepro = hasLabel(i, 'repro') || hasLabel(i, 'clarification') || hasLabel(i, 'reproduction');
  if (needsRepro && isYearsStale(i.updated_at, 1)) {
    staleRepros++;
    return;
  }

  // Stale old releases (Angular v15 or older, >3 years stale, low engagement)
  const bodyText = (i.body || '').toLowerCase();
  const mentionsOldVersion = /angular\s*(version\s*)?[:\s-]*([5-9]|1[0-5])\b/.test(bodyText) || 
                             /angular\s*core\s*[:\s-]*([5-9]|1[0-5])\b/.test(bodyText) ||
                             /material\s*(version\s*)?[:\s-]*([5-9]|1[0-5])\b/.test(bodyText);
  if (mentionsOldVersion && isYearsStale(i.updated_at, 3) && i.comments_count <= 2 && i.upvotes_count <= 2) {
    staleReleases++;
    return;
  }
});

console.log('\n================================================================');
console.log('📊 BACKLOG CRITERIA AUDIT STATS REPORT');
console.log('================================================================');
console.log('Total Open Issues in Cache:', issues.length);
console.log('----------------------------------------------------------------');
console.log('1. COMMUNITY SHIELD ADJUSTMENT METRICS:');
console.log(`   - Shielded at >4 count bounds (current): ${shieldedOld} (${Math.round(shieldedOld/issues.length*100)}% of backlog)`);
console.log(`   - Shielded at >10 count bounds (proposed): ${shieldedNew} (${Math.round(shieldedNew/issues.length*100)}% of backlog)`);
console.log(`   👉 RELEASES FOR TRIAGE: +${shieldedOld - shieldedNew} issues!`);
console.log('----------------------------------------------------------------');
console.log('2. NEW STALE TRIAGE GATES CANDIDATES DETECTED:');
console.log(`   - Stale Low-Engagement Feature Requests (>3 years, <3 upvotes/comments): ${staleFeatures}`);
console.log(`   - Stale Unresolved Repro Requests (>1 year with Needs Repro label): ${staleRepros}`);
console.log(`   - Stale Inactive Old Releases (Angular v15 or older, >3 years, low footprint): ${staleReleases}`);
console.log(`   👉 COMBINED NEW AUTOMATED CLOSURE CANDIDATES: +${staleFeatures + staleRepros + staleReleases} issues!`);
console.log('================================================================\n');
