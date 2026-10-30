import {
  BureauCode,
  CaseAction,
  CaseFilterState,
  CaseRecord,
  ComplaintCategory,
  DraftCaseBrief,
  FalsePositivePreventionLog,
  Institution,
  OverlapAlert,
  OverlapEngineConfig,
  OverlapSignalDetail,
  RegionCode,
  RiskLevel,
  SLAPolicyConfig,
  UserProfile,
} from '../types/domain';

const ABBREVIATION_MAP: Record<string, string> = {
  inst: 'institute',
  instt: 'institute',
  tech: 'technology',
  engg: 'engineering',
  eng: 'engineering',
  coll: 'college',
  univ: 'university',
  mgmt: 'management',
  sci: 'science',
  res: 'research',
  natl: 'national',
  intl: 'international',
  dr: 'doctor',
  st: 'saint',
};

const STOP_WORDS = new Set([
  'of',
  'and',
  'the',
  'for',
  'in',
  'at',
  'to',
  'a',
  'an',
  'by',
  'on',
  'with',
  'from',
  'is',
  'are',
  'was',
  'were',
  'has',
  'have',
  'had',
  'that',
  'this',
]);

/**
 * Normalizes an institution name by trimming whitespace, standardizing case and punctuation,
 * expanding common academic abbreviations, and removing noise tokens.
 */
export function normalizeInstitutionName(raw: string): string {
  if (!raw) return '';
  const cleaned = raw
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()'"[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';

  const tokens = cleaned.split(' ').map((token) => ABBREVIATION_MAP[token] || token);
  const meaningful = tokens.filter((t) => t.length > 1 && !STOP_WORDS.has(t));
  return meaningful.join(' ');
}

/**
 * Computes token Jaccard + bigram overlap similarity between two strings (0 to 1).
 */
export function calculateTextSimilarity(a: string, b: string): number {
  const normA = normalizeInstitutionName(a);
  const normB = normalizeInstitutionName(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  const setA = new Set(normA.split(' '));
  const setB = new Set(normB.split(' '));

  let intersection = 0;
  for (const tok of setA) {
    if (setB.has(tok)) {
      intersection++;
    } else {
      // Prefix/stem match for words >= 5 chars
      for (const tokB of setB) {
        if (tok.length >= 5 && tokB.length >= 5 && tok.slice(0, 5) === tokB.slice(0, 5)) {
          intersection += 0.75;
          break;
        }
      }
    }
  }

  const union = setA.size + setB.size - intersection;
  return union <= 0 ? 0 : Math.min(1, Math.max(0, intersection / union));
}

const RELATED_CATEGORY_CLUSTERS: Record<ComplaintCategory, ComplaintCategory[]> = {
  'Faculty Norms & Cadre Ratio': [
    'Fake / Duplicate Faculty Records',
    'Salary Non-Payment / Withholding',
    'Infrastructure & Lab Deficiency',
  ],
  'Fake / Duplicate Faculty Records': [
    'Faculty Norms & Cadre Ratio',
    'Unapproved Intake / Excess Admission',
  ],
  'Salary Non-Payment / Withholding': [
    'Faculty Norms & Cadre Ratio',
    'Original Certificate Retention',
  ],
  'Original Certificate Retention': [
    'Fee Refund & Capitation Fee',
    'Salary Non-Payment / Withholding',
    'Hostel & Student Welfare Grievance',
  ],
  'Fee Refund & Capitation Fee': [
    'Original Certificate Retention',
    'Unapproved Intake / Excess Admission',
    'Hostel & Student Welfare Grievance',
  ],
  'Unapproved Intake / Excess Admission': [
    'Infrastructure & Lab Deficiency',
    'Fee Refund & Capitation Fee',
    'Fake / Duplicate Faculty Records',
  ],
  'Infrastructure & Lab Deficiency': [
    'Unapproved Intake / Excess Admission',
    'Faculty Norms & Cadre Ratio',
    'Hostel & Student Welfare Grievance',
  ],
  'Hostel & Student Welfare Grievance': [
    'Fee Refund & Capitation Fee',
    'Infrastructure & Lab Deficiency',
    'Original Certificate Retention',
  ],
};

export interface OverlapDetectionResult {
  alerts: OverlapAlert[];
  preventedFalsePositives: FalsePositivePreventionLog[];
}

/**
 * Explainable rules-based Overlap Intelligence Engine.
 * Evaluates pairs of cases using configurable weighted signals and prevents false positives
 * when similar-named institutions have distinct verified AICTE Permanent IDs.
 */
export function runOverlapDetectionEngine(
  cases: CaseRecord[],
  institutions: Institution[],
  existingReviews: Record<
    string,
    Pick<OverlapAlert, 'reviewStatus' | 'reviewOutcome' | 'reviewedBy' | 'reviewedAt' | 'reviewRemarks'>
  >,
  config: OverlapEngineConfig
): OverlapDetectionResult {
  const instMap = new Map<string, Institution>();
  for (const inst of institutions) {
    instMap.set(inst.institutionId, inst);
  }

  const alerts: OverlapAlert[] = [];
  const preventedFalsePositives: FalsePositivePreventionLog[] = [];

  const totalWeights =
    config.weights.institutionMatch +
    config.weights.crossBureauActive +
    config.weights.categorySimilarity +
    config.weights.descriptionSimilarity +
    config.weights.temporalOverlap || 100;

  const scale = (raw: number) => Math.round((raw / totalWeights) * 100);

  for (let i = 0; i < cases.length; i++) {
    for (let j = i + 1; j < cases.length; j++) {
      const cA = cases[i];
      const cB = cases[j];

      const instA = instMap.get(cA.institutionId);
      const instB = instMap.get(cB.institutionId);

      const permA = (cA.reportedPermanentId ?? instA?.permanentId ?? '').trim();
      const permB = (cB.reportedPermanentId ?? instB?.permanentId ?? '').trim();

      const nameA = cA.reportedInstitutionName || instA?.name || '';
      const nameB = cB.reportedInstitutionName || instB?.name || '';
      const nameSim = calculateTextSimilarity(nameA, nameB);

      // False-positive guard: If both cases have explicit, valid AICTE Permanent IDs and they differ,
      // do not flag them as an institutional overlap even if their names look similar.
      if (permA && permB && permA !== permB) {
        if (nameSim >= 0.45) {
          preventedFalsePositives.push({
            id: `FP-${cA.caseId}-${cB.caseId}`,
            caseIds: [cA.caseId, cB.caseId],
            institutionNames: [nameA, nameB],
            permanentIds: [permA, permB],
            nameSimilarityScore: Math.round(nameSim * 100),
            reasonPrevented: `High name similarity (${Math.round(
              nameSim * 100
            )}%), but verified AICTE Permanent IDs differ (${permA} vs ${permB}). Excluded from overlap alerts.`,
          });
        }
        continue;
      }

      // Check institution match signal
      let instFraction = 0;
      let instReason = '';
      if (permA && permB && permA === permB) {
        instFraction = 1.0;
        instReason = `Exact AICTE Permanent ID match (${permA})`;
      } else if (cA.institutionId === cB.institutionId) {
        instFraction = 0.92;
        instReason = `Matched to same institution record (${instA?.name || cA.institutionId}); one record missing Permanent ID`;
      } else if (nameSim >= 0.65) {
        instFraction = nameSim;
        instReason = `Fuzzy institution name/address match (${Math.round(nameSim * 100)}% normalized similarity)`;
      } else {
        continue; // Unrelated institutions
      }

      // Do not automatically declare two complaints duplicates merely because they concern the same institution.
      // Evaluate the remaining 4 signals and require meaningful substantive/operational overlap.
      const breakdown: OverlapSignalDetail[] = [];
      const matchReasons: string[] = [instReason];

      const instContribution = Math.round(instFraction * config.weights.institutionMatch);
      breakdown.push({
        signal: 'Institution Identity Match',
        scoreContribution: instContribution,
        maxWeight: config.weights.institutionMatch,
        explanation: instReason,
      });

      // Signal 2: Cross-Bureau Active Handling
      const bothActive = cA.status !== 'Disposed' && cB.status !== 'Disposed';
      const diffCurrentBureau = cA.currentBureau !== cB.currentBureau;
      const diffSourceBureau = cA.sourceBureau !== cB.sourceBureau;
      let bureauFraction = 0;
      let bureauExplanation = 'Same Bureau handling both cases';

      if (bothActive && diffCurrentBureau) {
        bureauFraction = 1.0;
        bureauExplanation = `Active parallel processing across ${cA.currentBureau} and ${cB.currentBureau}`;
        matchReasons.push(`Parallel active cases in ${cA.currentBureau} & ${cB.currentBureau}`);
      } else if (diffCurrentBureau || diffSourceBureau) {
        bureauFraction = 0.65;
        bureauExplanation = `Involved across ${cA.sourceBureau}/${cA.currentBureau} and ${cB.sourceBureau}/${cB.currentBureau}`;
        matchReasons.push(`Cross-Bureau involvement (${cA.currentBureau} / ${cB.currentBureau})`);
      } else if (bothActive) {
        bureauFraction = 0.35;
        bureauExplanation = `Both active within ${cA.currentBureau}`;
      }

      const bureauContribution = Math.round(bureauFraction * config.weights.crossBureauActive);
      breakdown.push({
        signal: 'Cross-Bureau Handling',
        scoreContribution: bureauContribution,
        maxWeight: config.weights.crossBureauActive,
        explanation: bureauExplanation,
      });

      // Signal 3: Complaint Category Similarity
      let catFraction = 0;
      let catExplanation = `Distinct complaint categories (${cA.category} vs ${cB.category})`;
      if (cA.category === cB.category) {
        catFraction = 1.0;
        catExplanation = `Identical complaint category: ${cA.category}`;
        matchReasons.push(`Same category (${cA.category})`);
      } else if (RELATED_CATEGORY_CLUSTERS[cA.category]?.includes(cB.category)) {
        catFraction = 0.65;
        catExplanation = `Correlated regulatory categories (${cA.category} & ${cB.category})`;
        matchReasons.push(`Correlated categories (${cA.category} / ${cB.category})`);
      }

      const catContribution = Math.round(catFraction * config.weights.categorySimilarity);
      breakdown.push({
        signal: 'Complaint Category Similarity',
        scoreContribution: catContribution,
        maxWeight: config.weights.categorySimilarity,
        explanation: catExplanation,
      });

      // Signal 4: Description Similarity
      const descSim = calculateTextSimilarity(cA.description, cB.description);
      // Boost slightly because realistic descriptions share domain keywords
      const adjustedDescFraction = Math.min(1, descSim * 1.65);
      const descContribution = Math.round(adjustedDescFraction * config.weights.descriptionSimilarity);
      const descExplanation =
        adjustedDescFraction >= 0.5
          ? `High textual/subject overlap (${Math.round(adjustedDescFraction * 100)}% keyword similarity)`
          : adjustedDescFraction >= 0.25
          ? `Moderate subject matter similarity (${Math.round(adjustedDescFraction * 100)}%)`
          : `Distinct factual allegations (${Math.round(adjustedDescFraction * 100)}% lexical overlap)`;

      if (adjustedDescFraction >= 0.35) {
        matchReasons.push(`Subject similarity (${Math.round(adjustedDescFraction * 100)}%)`);
      }

      breakdown.push({
        signal: 'Description & Subject Similarity',
        scoreContribution: descContribution,
        maxWeight: config.weights.descriptionSimilarity,
        explanation: descExplanation,
      });

      // Signal 5: Temporal / Active Period Overlap
      const recA = new Date(cA.receivedAt).getTime();
      const recB = new Date(cB.receivedAt).getTime();
      const daysApart = Math.abs(recA - recB) / (1000 * 60 * 60 * 24);
      let tempFraction = 0;
      let tempExplanation = `Received ${Math.round(daysApart)} days apart`;

      if (bothActive && daysApart <= 20) {
        tempFraction = 1.0;
        tempExplanation = `Concurrent active window (received ${Math.round(daysApart)} days apart)`;
        matchReasons.push(`Concurrent active period (${Math.round(daysApart)}d gap)`);
      } else if (bothActive || daysApart <= 35) {
        tempFraction = 0.7;
        tempExplanation = `Overlapping review period (${Math.round(daysApart)} days apart)`;
      } else if (daysApart <= 60) {
        tempFraction = 0.35;
      }

      const tempContribution = Math.round(tempFraction * config.weights.temporalOverlap);
      breakdown.push({
        signal: 'Active Period Overlap',
        scoreContribution: tempContribution,
        maxWeight: config.weights.temporalOverlap,
        explanation: tempExplanation,
      });

      const rawTotal =
        instContribution + bureauContribution + catContribution + descContribution + tempContribution;
      const riskScore = Math.min(100, Math.max(0, scale(rawTotal)));

      // Require substantive non-institution signal so we don't flag every two unrelated cases at the same college
      const nonInstScore = bureauContribution + catContribution + descContribution + tempContribution;
      if (riskScore < 42 || (catFraction === 0 && adjustedDescFraction < 0.22)) {
        continue;
      }

      const riskLevel: RiskLevel =
        riskScore >= config.highRiskThreshold
          ? 'High'
          : riskScore >= config.mediumRiskThreshold
          ? 'Medium'
          : 'Low';

      const pairKey = [cA.caseId, cB.caseId].sort().join('__');
      const alertId = `OVL-${pairKey}`;
      const existing = existingReviews[alertId];

      alerts.push({
        alertId,
        caseIds: [cA.caseId, cB.caseId],
        institutionId: cA.institutionId,
        riskScore,
        riskLevel,
        matchReasons,
        signalBreakdown: breakdown,
        reviewStatus: existing?.reviewStatus || 'Unreviewed',
        reviewOutcome: existing?.reviewOutcome || 'Pending Review',
        reviewedBy: existing?.reviewedBy,
        reviewedAt: existing?.reviewedAt,
        reviewRemarks: existing?.reviewRemarks,
      });
    }
  }

  alerts.sort((a, b) => b.riskScore - a.riskScore);
  return { alerts, preventedFalsePositives };
}

export interface CaseSLAEvaluation {
  isOverdue: boolean;
  isApproachingDeadline: boolean;
  daysRemaining: number;
  ageDays: number;
  ageBucketLabel: string;
  daysSinceLastAction: number;
  isInactive: boolean;
}

/**
 * Evaluates SLA deadline status, ageing bucket, and inactivity indicator for a case
 * relative to a given reference date and SLA policy configuration.
 */
export function evaluateCaseSLA(
  caseRecord: CaseRecord,
  referenceDate: Date,
  policy: SLAPolicyConfig
): CaseSLAEvaluation {
  const nowMs = referenceDate.getTime();
  const receivedMs = new Date(caseRecord.receivedAt).getTime();
  const dueMs = new Date(caseRecord.dueAt).getTime();
  const lastActionMs = new Date(caseRecord.lastActionAt).getTime();

  const msPerDay = 1000 * 60 * 60 * 24;
  const ageDays = Math.max(0, Math.floor((nowMs - receivedMs) / msPerDay));
  const daysRemaining = Math.ceil((dueMs - nowMs) / msPerDay);
  const daysSinceLastAction = Math.max(0, Math.floor((nowMs - lastActionMs) / msPerDay));

  const isDisposed = caseRecord.status === 'Disposed';
  const isOverdue = !isDisposed && daysRemaining < 0;
  const isApproachingDeadline =
    !isDisposed && daysRemaining >= 0 && daysRemaining <= policy.approachingDeadlineDays;
  const isInactive = !isDisposed && daysSinceLastAction >= policy.inactivityThresholdDays;

  const [b1, b2, b3] = policy.ageingBuckets;
  let ageBucketLabel = `Over ${b3} days`;
  if (ageDays <= b1) {
    ageBucketLabel = `0–${b1} days`;
  } else if (ageDays <= b2) {
    ageBucketLabel = `${b1 + 1}–${b2} days`;
  } else if (ageDays <= b3) {
    ageBucketLabel = `${b2 + 1}–${b3} days`;
  }

  return {
    isOverdue,
    isApproachingDeadline,
    daysRemaining,
    ageDays,
    ageBucketLabel,
    daysSinceLastAction,
    isInactive,
  };
}

/**
 * Parses a natural-language search query such as "show overdue PGRC cases in Telangana"
 * or "high risk faculty complaints in RB" into structured filter criteria.
 */
export function parseNaturalLanguageQuery(
  rawQuery: string,
  institutions: Institution[]
): { appliedFilters: Partial<CaseFilterState>; explanation: string[] } {
  const q = rawQuery.toLowerCase().trim();
  const appliedFilters: Partial<CaseFilterState> = {};
  const explanation: string[] = [];

  if (!q) return { appliedFilters, explanation };

  if (q.includes('overdue') || q.includes('late') || q.includes('breach') || q.includes('past due')) {
    appliedFilters.overdueOnly = true;
    explanation.push('Overdue Only: Yes');
  }

  if (q.includes('overlap') || q.includes('duplicate') || q.includes('parallel')) {
    appliedFilters.potentialOverlapOnly = true;
    explanation.push('Potential Overlap Only: Yes');
  }

  // Bureau matching
  const bureauTokens: Array<{ match: RegExp; code: BureauCode }> = [
    { match: /\bpgrc\b|public grievance/i, code: 'PGRC' },
    { match: /\brb\b|regulation bureau/i, code: 'RB' },
    { match: /\bab\b|approval bureau/i, code: 'AB' },
    { match: /\bvig\b|vigilance/i, code: 'VIG' },
    { match: /\bro-sc\b|hyderabad/i, code: 'RO-SC' },
    { match: /\bro-n\b|kanpur/i, code: 'RO-N' },
    { match: /\bro-w\b|mumbai/i, code: 'RO-W' },
    { match: /\bro-s\b|chennai/i, code: 'RO-S' },
  ];
  for (const b of bureauTokens) {
    if (b.match.test(q)) {
      appliedFilters.bureau = b.code;
      explanation.push(`Bureau: ${b.code}`);
      break;
    }
  }

  // Status matching
  if (/\bdisposed\b|\bresolved\b|\bclosed\b/i.test(q)) {
    appliedFilters.status = 'Disposed';
    explanation.push('Status: Disposed');
  } else if (/\bunder[\s-]?process\b|\bin[\s-]?progress\b/i.test(q)) {
    appliedFilters.status = 'Under Process';
    explanation.push('Status: Under Process');
  } else if (/\btransferred\b/i.test(q)) {
    appliedFilters.status = 'Transferred';
    explanation.push('Status: Transferred');
  } else if (/\bpending\b/i.test(q)) {
    appliedFilters.status = 'Pending';
    explanation.push('Status: Pending');
  }

  // Risk level matching
  if (/\bhigh[\s-]?risk\b|\bcritical\b/i.test(q)) {
    appliedFilters.riskLevel = 'High';
    explanation.push('Risk Level: High');
  } else if (/\bmedium[\s-]?risk\b/i.test(q)) {
    appliedFilters.riskLevel = 'Medium';
    explanation.push('Risk Level: Medium');
  } else if (/\blow[\s-]?risk\b/i.test(q)) {
    appliedFilters.riskLevel = 'Low';
    explanation.push('Risk Level: Low');
  }

  // Region or State matching
  const stateToRegion: Record<string, RegionCode> = {
    telangana: 'South-Central',
    'andhra pradesh': 'South-Central',
    'uttar pradesh': 'Northern',
    delhi: 'Northern',
    maharashtra: 'Western',
    gujarat: 'Western',
    'tamil nadu': 'Southern',
    karnataka: 'Southern',
    'west bengal': 'Eastern',
    odisha: 'Eastern',
    'madhya pradesh': 'Central',
  };

  for (const [stateName, regCode] of Object.entries(stateToRegion)) {
    if (q.includes(stateName)) {
      appliedFilters.region = regCode;
      explanation.push(`Region: ${regCode} (${stateName})`);
      break;
    }
  }

  if (!appliedFilters.region) {
    const regions: RegionCode[] = [
      'South-Central',
      'Northern',
      'Western',
      'Southern',
      'Eastern',
      'Central',
    ];
    for (const r of regions) {
      if (q.includes(r.toLowerCase())) {
        appliedFilters.region = r;
        explanation.push(`Region: ${r}`);
        break;
      }
    }
  }

  // Category matching
  const categoryKeywords: Array<{ kw: RegExp; cat: ComplaintCategory }> = [
    { kw: /\bfaculty\b|\bcadre\b/i, cat: 'Faculty Norms & Cadre Ratio' },
    { kw: /\bcertificate\b|\boriginal\b/i, cat: 'Original Certificate Retention' },
    { kw: /\bintake\b|\bexcess admission\b|\bunapproved\b/i, cat: 'Unapproved Intake / Excess Admission' },
    { kw: /\bfee\b|\brefund\b|\bcapitation\b/i, cat: 'Fee Refund & Capitation Fee' },
    { kw: /\binfrastructure\b|\blab\b/i, cat: 'Infrastructure & Lab Deficiency' },
    { kw: /\bsalary\b|\bwithholding\b/i, cat: 'Salary Non-Payment / Withholding' },
    { kw: /\bfake\b|\bduplicate faculty\b/i, cat: 'Fake / Duplicate Faculty Records' },
    { kw: /\bhostel\b|\bwelfare\b|\bragging\b/i, cat: 'Hostel & Student Welfare Grievance' },
  ];

  for (const item of categoryKeywords) {
    if (item.kw.test(q)) {
      appliedFilters.category = item.cat;
      explanation.push(`Category: ${item.cat}`);
      break;
    }
  }

  // If no structured token matched, fallback to searchQuery
  if (explanation.length === 0 && institutions.length >= 0) {
    appliedFilters.searchQuery = rawQuery.trim();
    explanation.push(`Keyword Search: "${rawQuery.trim()}"`);
  }

  return { appliedFilters, explanation };
}

export type PermissionOperation =
  | 'CREATE_CASE'
  | 'UPDATE_CASE_STATUS'
  | 'ASSIGN_OFFICER'
  | 'INITIATE_TRANSFER'
  | 'ACCEPT_TRANSFER'
  | 'REVIEW_OVERLAP'
  | 'CREATE_WORKSPACE'
  | 'ESCALATE_CASE'
  | 'MANAGE_SETTINGS'
  | 'VIEW_CONFIDENTIAL_REMARKS';

/**
 * Enforces Role-Based Access Control (RBAC) across roles, bureaus, and regions.
 */
export function checkPermission(
  user: UserProfile,
  operation: PermissionOperation,
  targetCase?: CaseRecord,
  targetInstitution?: Institution
): { allowed: boolean; reason?: string } {
  if (!user.active) {
    return { allowed: false, reason: 'User account is inactive.' };
  }

  // Senior Management has read-only organization-wide oversight, plus escalation review
  if (user.role === 'Senior Management') {
    if (operation === 'ESCALATE_CASE' || operation === 'VIEW_CONFIDENTIAL_REMARKS') {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Senior Management role provides read-only organization-wide oversight. Switch to an operational Bureau or System Administrator role to modify records.',
    };
  }

  if (user.role === 'System Administrator') {
    return { allowed: true };
  }

  if (operation === 'MANAGE_SETTINGS') {
    return {
      allowed: false,
      reason: 'Only System Administrators are authorized to modify SLA policies and engine configuration.',
    };
  }

  if (user.role === 'Regional Officer') {
    if (targetInstitution && targetInstitution.region !== user.region) {
      return {
        allowed: false,
        reason: `Regional Officer access is restricted to ${user.region} region (${targetInstitution.name} is in ${targetInstitution.region}).`,
      };
    }
    if (operation === 'INITIATE_TRANSFER' || operation === 'ASSIGN_OFFICER') {
      return {
        allowed: false,
        reason: 'Regional Officers cannot reassign HQ bureau officers or initiate inter-bureau transfers without Bureau Administrator authorization.',
      };
    }
    return { allowed: true };
  }

  if (user.role === 'Case Officer') {
    if (operation === 'ASSIGN_OFFICER') {
      return {
        allowed: false,
        reason: 'Only Bureau Administrators or System Administrators can reassign officers.',
      };
    }
    if (
      targetCase &&
      targetCase.currentBureau !== user.bureau &&
      targetCase.assignedOfficerId !== user.userId
    ) {
      return {
        allowed: false,
        reason: `Case ${targetCase.caseId} is currently assigned to ${targetCase.currentBureau}. Case Officers may only modify cases within their own Bureau (${user.bureau}) or assigned directly to them.`,
      };
    }
    return { allowed: true };
  }

  if (user.role === 'Bureau Administrator') {
    if (
      targetCase &&
      operation !== 'ACCEPT_TRANSFER' &&
      operation !== 'REVIEW_OVERLAP' &&
      operation !== 'CREATE_WORKSPACE' &&
      targetCase.currentBureau !== user.bureau &&
      targetCase.sourceBureau !== user.bureau
    ) {
      return {
        allowed: false,
        reason: `Bureau Administrator (${user.bureau}) cannot directly alter status of a case owned by ${targetCase.currentBureau} without an active transfer or coordination workspace.`,
      };
    }
    return { allowed: true };
  }

  return { allowed: true };
}

/**
 * Properly escapes a CSV field according to RFC 4180.
 */
export function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates an RFC 4180 compliant CSV string for a list of cases.
 */
export function exportCasesToCsv(
  cases: CaseRecord[],
  instMap: Map<string, Institution>,
  userMap: Map<string, UserProfile>
): string {
  const headers = [
    'Case ID',
    'AICTE Permanent ID',
    'Institution Name',
    'Region',
    'State',
    'Complaint Category',
    'Source Bureau',
    'Current Bureau',
    'Responsible Officer',
    'Priority',
    'Status',
    'Date Received',
    'SLA Deadline',
    'Last Action Date',
    'Next Action',
    'Description',
  ];

  const rows = cases.map((c) => {
    const inst = instMap.get(c.institutionId);
    const officer = userMap.get(c.assignedOfficerId);
    return [
      c.caseId,
      c.reportedPermanentId ?? inst?.permanentId ?? '',
      c.reportedInstitutionName ?? inst?.name ?? '',
      inst?.region ?? '',
      inst?.state ?? '',
      c.category,
      c.sourceBureau,
      c.currentBureau,
      officer?.displayName ?? c.assignedOfficerId,
      c.priority,
      c.status,
      c.receivedAt.slice(0, 10),
      c.dueAt.slice(0, 10),
      c.lastActionAt.slice(0, 10),
      c.nextAction,
      c.description,
    ]
      .map(escapeCsvField)
      .join(',');
  });

  return [headers.map(escapeCsvField).join(','), ...rows].join('\n');
}

/**
 * Generates a deterministic, record-linked Draft Case Brief when external AI is not configured.
 */
export function generateDeterministicCaseBrief(
  caseRecord: CaseRecord,
  institution: Institution | undefined,
  actions: CaseAction[],
  relatedCases: CaseRecord[],
  overlaps: OverlapAlert[]
): DraftCaseBrief {
  const sortedActions = [...actions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const latestAction = sortedActions[sortedActions.length - 1];

  const instLabel = institution
    ? `${institution.name} (Permanent ID: ${institution.permanentId || 'Unverified'}, ${institution.state})`
    : caseRecord.reportedInstitutionName || caseRecord.institutionId;

  const summary = `[DRAFT BRIEF — REF: ${caseRecord.caseId}] Complaint received via ${caseRecord.sourceBureau} on ${caseRecord.receivedAt.slice(
    0,
    10
  )} concerning "${caseRecord.category}" at ${instLabel}. Currently assigned to ${
    caseRecord.currentBureau
  } under status "${caseRecord.status}" with ${caseRecord.priority} priority. Core allegation: ${
    caseRecord.description
  }`;

  const keyDatesAndActions = sortedActions.map(
    (a) =>
      `${a.timestamp.slice(0, 10)} [${a.actionId} · ${a.bureau}]: ${a.actionType} — ${a.remarks}`
  );

  let overlapEvidence = `No active high-risk cross-bureau overlap flags found for ${caseRecord.caseId}.`;
  if (overlaps.length > 0) {
    const top = overlaps[0];
    const otherCaseId = top.caseIds[0] === caseRecord.caseId ? top.caseIds[1] : top.caseIds[0];
    overlapEvidence = `Alert ${top.alertId} (${top.riskScore}/100 ${top.riskLevel} Risk) links ${
      caseRecord.caseId
    } with ${otherCaseId}. Contributing signals: ${top.matchReasons.join('; ')}. Review status: ${
      top.reviewOutcome
    }.`;
  } else if (relatedCases.length > 0) {
    overlapEvidence = `Linked institutional history includes ${relatedCases
      .map((rc) => `${rc.caseId} (${rc.currentBureau} - ${rc.status})`)
      .join(', ')}.`;
  }

  const missingInformation: string[] = [];
  if (!institution?.permanentId && !caseRecord.reportedPermanentId) {
    missingInformation.push(
      'Verified AICTE Permanent ID is missing on the complaint intake record; cross-check against Approval Bureau master directory.'
    );
  }
  if (caseRecord.documents.length === 0) {
    missingInformation.push(
      'No supporting documentary evidence or notarized affidavit uploaded to the case docket yet.'
    );
  }
  if (
    caseRecord.category === 'Faculty Norms & Cadre Ratio' ||
    caseRecord.category === 'Fake / Duplicate Faculty Records'
  ) {
    missingInformation.push(
      'Aadhaar-linked faculty biometric/PAN attendance verification sheet from the institution is pending verification.'
    );
  }
  if (missingInformation.length === 0) {
    missingInformation.push(
      'Primary intake documentation and Permanent ID are present; await formal institutional compliance reply.'
    );
  }

  const suggestedNextAction =
    caseRecord.pendingTransferToBureau
      ? `Follow up with ${caseRecord.pendingTransferToBureau} to complete pending transfer acceptance for ${caseRecord.caseId}.`
      : overlaps.some((o) => o.reviewStatus === 'Unreviewed')
      ? `Review Overlap Alert ${overlaps[0].alertId} and open a joint Coordination Workspace between ${caseRecord.currentBureau} and the parallel Bureau before issuing separate show-cause notices.`
      : `${caseRecord.nextAction} (Scheduled SLA due date: ${caseRecord.dueAt.slice(0, 10)}; last action ${
          latestAction ? latestAction.timestamp.slice(0, 10) : caseRecord.receivedAt.slice(0, 10)
        }).`;

  const draftCoordinationNote = `Subject: Inter-Bureau Coordination Request — ${caseRecord.caseId} (${
    institution?.name || 'Institution'
  }, PID: ${institution?.permanentId || 'Pending'})\n\n1. ${
    caseRecord.currentBureau
  } is currently examining Case ${caseRecord.caseId} regarding ${
    caseRecord.category
  } (received ${caseRecord.receivedAt.slice(0, 10)}).\n2. ${
    overlaps.length > 0
      ? `Overlap Engine flagged potential concurrency with Case ${
          overlaps[0].caseIds.find((id) => id !== caseRecord.caseId) || ''
        } (Risk Score: ${overlaps[0].riskScore}/100).`
      : 'Institutional history indicates cross-bureau touchpoints.'
  }\n3. Proposed Action: Designate a lead coordinating officer to consolidate documentary requisitions from the institution and prevent duplicate compliance notices. Please review and confirm.`;

  return {
    summary,
    keyDatesAndActions,
    overlapEvidence,
    missingInformation,
    suggestedNextAction,
    draftCoordinationNote,
    sourceMode: 'deterministic_fallback',
    generatedAt: new Date().toISOString(),
  };
}
