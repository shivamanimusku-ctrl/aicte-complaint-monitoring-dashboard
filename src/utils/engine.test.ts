import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeInstitutionName,
  calculateTextSimilarity,
  runOverlapDetectionEngine,
  evaluateCaseSLA,
  parseNaturalLanguageQuery,
  checkPermission,
  escapeCsvField,
} from './engine';
import {
  CaseRecord,
  Institution,
  OverlapEngineConfig,
  SLAPolicyConfig,
  UserProfile,
} from '../types/domain';

const defaultOverlapConfig: OverlapEngineConfig = {
  weights: {
    institutionMatch: 30,
    crossBureauActive: 25,
    categorySimilarity: 20,
    descriptionSimilarity: 15,
    temporalOverlap: 10,
  },
  highRiskThreshold: 75,
  mediumRiskThreshold: 50,
};

const defaultSLAPolicy: SLAPolicyConfig = {
  timezone: 'Asia/Kolkata',
  categorySLADays: {
    'Faculty Norms & Cadre Ratio': 21,
    'Original Certificate Retention': 10,
    'Unapproved Intake / Excess Admission': 15,
    'Fee Refund & Capitation Fee': 14,
    'Infrastructure & Lab Deficiency': 21,
    'Salary Non-Payment / Withholding': 15,
    'Fake / Duplicate Faculty Records': 15,
    'Hostel & Student Welfare Grievance': 10,
  },
  ageingBuckets: [3, 7, 15],
  approachingDeadlineDays: 3,
  inactivityThresholdDays: 7,
};

test('normalizeInstitutionName standardizes abbreviations, case, and punctuation', () => {
  const n1 = normalizeInstitutionName('  Deccan Inst. of Engg. & Tech., Hyderabad! ');
  const n2 = normalizeInstitutionName('Deccan Institute of Engineering and Technology Hyderabad');
  assert.equal(n1, n2);
  assert.equal(n1, 'deccan institute engineering technology hyderabad');
});

test('runOverlapDetectionEngine flags genuine cross-bureau overlaps and prevents false positives on distinct Permanent IDs', () => {
  const institutions: Institution[] = [
    {
      institutionId: 'INST-1',
      permanentId: '1-309481722',
      name: 'Deccan Institute of Engineering & Management',
      normalizedName: normalizeInstitutionName('Deccan Institute of Engineering & Management'),
      address: 'Banjara Hills, Hyderabad',
      region: 'South-Central',
      state: 'Telangana',
      institutionType: 'Private Engineering',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      institutionId: 'INST-2',
      permanentId: '1-410928371',
      name: 'Sri Venkateswara Institute of Technology, Hyderabad',
      normalizedName: normalizeInstitutionName('Sri Venkateswara Institute of Technology, Hyderabad'),
      address: 'Secunderabad, Telangana',
      region: 'South-Central',
      state: 'Telangana',
      institutionType: 'Private Engineering',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      institutionId: 'INST-3',
      permanentId: '1-883920144',
      name: 'Sri Venkateswara Inst. of Tech., Tirupati',
      normalizedName: normalizeInstitutionName('Sri Venkateswara Inst. of Tech., Tirupati'),
      address: 'Tirupati, Andhra Pradesh',
      region: 'South-Central',
      state: 'Andhra Pradesh',
      institutionType: 'Private Engineering',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];

  const cases: CaseRecord[] = [
    {
      caseId: 'AICTE-2026-101',
      institutionId: 'INST-1',
      sourceBureau: 'RB',
      currentBureau: 'RB',
      assignedOfficerId: 'USR-1',
      category: 'Faculty Norms & Cadre Ratio',
      priority: 'High',
      description: 'Severe shortage of regular CSE professors and withheld salary for 14 faculty members.',
      receivedAt: '2026-10-15T10:00:00Z',
      status: 'Under Process',
      dueAt: '2026-11-05T10:00:00Z',
      lastActionAt: '2026-10-20T10:00:00Z',
      nextAction: 'Verify faculty payroll records',
      relatedCaseIds: [],
      complainantMasked: 'Dr. R*** K*** (Faculty)',
      documents: [],
      createdAt: '2026-10-15T10:00:00Z',
      updatedAt: '2026-10-20T10:00:00Z',
    },
    {
      caseId: 'AICTE-2026-102',
      institutionId: 'INST-1',
      sourceBureau: 'PGRC',
      currentBureau: 'PGRC',
      assignedOfficerId: 'USR-2',
      category: 'Salary Non-Payment / Withholding',
      priority: 'High',
      description: 'Joint petition regarding withheld salary for CSE faculty members and inadequate cadre ratio.',
      receivedAt: '2026-10-18T10:00:00Z',
      status: 'Pending',
      dueAt: '2026-11-02T10:00:00Z',
      lastActionAt: '2026-10-18T10:00:00Z',
      nextAction: 'Issue notice to Principal',
      relatedCaseIds: [],
      complainantMasked: 'Faculty Grievance Group',
      documents: [],
      createdAt: '2026-10-18T10:00:00Z',
      updatedAt: '2026-10-18T10:00:00Z',
    },
    // Similar institution names with DIFFERENT Permanent IDs (should be prevented from false positive)
    {
      caseId: 'AICTE-2026-201',
      institutionId: 'INST-2',
      sourceBureau: 'PGRC',
      currentBureau: 'PGRC',
      assignedOfficerId: 'USR-2',
      category: 'Fee Refund & Capitation Fee',
      priority: 'Medium',
      description: 'Refusal to refund tuition fee after admission cancellation within AICTE deadline.',
      receivedAt: '2026-10-10T10:00:00Z',
      status: 'Under Process',
      dueAt: '2026-10-25T10:00:00Z',
      lastActionAt: '2026-10-15T10:00:00Z',
      nextAction: 'Await refund receipt',
      relatedCaseIds: [],
      complainantMasked: 'S*** M*** (Student)',
      documents: [],
      createdAt: '2026-10-10T10:00:00Z',
      updatedAt: '2026-10-15T10:00:00Z',
    },
    {
      caseId: 'AICTE-2026-202',
      institutionId: 'INST-3',
      sourceBureau: 'RO-SC',
      currentBureau: 'RO-SC',
      assignedOfficerId: 'USR-3',
      category: 'Fee Refund & Capitation Fee',
      priority: 'Medium',
      description: 'Refusal to refund tuition fee after admission withdrawal before cut-off date.',
      receivedAt: '2026-10-12T10:00:00Z',
      status: 'Pending',
      dueAt: '2026-10-26T10:00:00Z',
      lastActionAt: '2026-10-12T10:00:00Z',
      nextAction: 'Review student application',
      relatedCaseIds: [],
      complainantMasked: 'A*** P*** (Student)',
      documents: [],
      createdAt: '2026-10-12T10:00:00Z',
      updatedAt: '2026-10-12T10:00:00Z',
    },
  ];

  const result = runOverlapDetectionEngine(cases, institutions, {}, defaultOverlapConfig);
  assert.equal(result.alerts.length, 1);
  assert.deepEqual(result.alerts[0].caseIds, ['AICTE-2026-101', 'AICTE-2026-102']);
  assert.ok(result.alerts[0].riskScore >= 75);
  assert.equal(result.alerts[0].riskLevel, 'High');
  assert.equal(result.preventedFalsePositives.length, 1);
  assert.deepEqual(result.preventedFalsePositives[0].caseIds, ['AICTE-2026-201', 'AICTE-2026-202']);
});

test('evaluateCaseSLA accurately calculates overdue, approaching deadline, and ageing buckets', () => {
  const refDate = new Date('2026-10-28T10:00:00Z');
  const overdueCase: CaseRecord = {
    caseId: 'AICTE-2026-999',
    institutionId: 'INST-1',
    sourceBureau: 'PGRC',
    currentBureau: 'PGRC',
    assignedOfficerId: 'USR-1',
    category: 'Original Certificate Retention',
    priority: 'Critical',
    description: 'Withholding original B.Tech certificates',
    receivedAt: '2026-10-08T10:00:00Z', // 20 days ago
    status: 'Pending',
    dueAt: '2026-10-20T10:00:00Z', // 8 days overdue
    lastActionAt: '2026-10-15T10:00:00Z', // 13 days inactive
    nextAction: 'Immediate directive',
    relatedCaseIds: [],
    complainantMasked: 'Student',
    documents: [],
    createdAt: '2026-10-08T10:00:00Z',
    updatedAt: '2026-10-15T10:00:00Z',
  };

  const evalResult = evaluateCaseSLA(overdueCase, refDate, defaultSLAPolicy);
  assert.equal(evalResult.isOverdue, true);
  assert.equal(evalResult.daysRemaining, -8);
  assert.equal(evalResult.ageDays, 20);
  assert.equal(evalResult.ageBucketLabel, 'Over 15 days');
  assert.equal(evalResult.isInactive, true);
});

test('parseNaturalLanguageQuery translates natural phrases into safe filters', () => {
  const parsed = parseNaturalLanguageQuery('show overdue PGRC cases in Telangana', []);
  assert.equal(parsed.appliedFilters.overdueOnly, true);
  assert.equal(parsed.appliedFilters.bureau, 'PGRC');
  assert.equal(parsed.appliedFilters.region, 'South-Central');
});

test('checkPermission enforces Senior Management read-only and Bureau isolation', () => {
  const seniorUser: UserProfile = {
    userId: 'USR-SM',
    displayName: 'Prof. A. K. Verma',
    designation: 'Member Secretary',
    role: 'Senior Management',
    bureau: 'RB',
    region: 'Northern',
    active: true,
  };
  const createPerm = checkPermission(seniorUser, 'CREATE_CASE');
  assert.equal(createPerm.allowed, false);

  const escalatePerm = checkPermission(seniorUser, 'ESCALATE_CASE');
  assert.equal(escalatePerm.allowed, true);
});

test('escapeCsvField properly escapes commas, quotes, and newlines', () => {
  assert.equal(escapeCsvField('Simple text'), 'Simple text');
  assert.equal(escapeCsvField('College, Hyderabad'), '"College, Hyderabad"');
  assert.equal(escapeCsvField('Said "Urgent"'), '"Said ""Urgent"""');
});
