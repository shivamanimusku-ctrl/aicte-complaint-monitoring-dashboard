export type BureauCode =
  | 'RB'       // Regulation Bureau
  | 'PGRC'     // Public Grievance Redressal Cell
  | 'AB'       // Approval Bureau
  | 'VIG'      // Vigilance & Monitoring Cell
  | 'RO-SC'    // Regional Office - South Central (Hyderabad)
  | 'RO-N'     // Regional Office - Northern (Kanpur)
  | 'RO-W'     // Regional Office - Western (Mumbai)
  | 'RO-S';    // Regional Office - Southern (Chennai)

export type RegionCode =
  | 'South-Central'
  | 'Northern'
  | 'Western'
  | 'Southern'
  | 'Eastern'
  | 'Central';

export type ComplaintCategory =
  | 'Faculty Norms & Cadre Ratio'
  | 'Original Certificate Retention'
  | 'Unapproved Intake / Excess Admission'
  | 'Fee Refund & Capitation Fee'
  | 'Infrastructure & Lab Deficiency'
  | 'Salary Non-Payment / Withholding'
  | 'Fake / Duplicate Faculty Records'
  | 'Hostel & Student Welfare Grievance';

export type CaseStatus =
  | 'Pending'
  | 'Under Process'
  | 'Transferred'
  | 'Disposed';

export type CasePriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type RiskLevel = 'Low' | 'Medium' | 'High';

export type UserRole =
  | 'Senior Management'
  | 'Bureau Administrator'
  | 'Case Officer'
  | 'Regional Officer'
  | 'System Administrator';

export type NavigationTab =
  | 'command-center'
  | 'complaint-registry'
  | 'institution-360'
  | 'overlap-intelligence'
  | 'coordination-workspace'
  | 'workflow-history'
  | 'reports-analytics'
  | 'alerts-notifications'
  | 'admin-settings';

export interface Institution {
  institutionId: string;
  permanentId: string; // e.g., 1-428192011 (or empty string if missing in legacy record)
  name: string;
  normalizedName: string;
  address: string;
  region: RegionCode;
  state: string;
  institutionType: 'Private Engineering' | 'Deemed University' | 'Autonomous Institute' | 'Polytechnic' | 'Management Institute';
  createdAt: string;
  updatedAt: string;
}

export interface CaseDocument {
  docId: string;
  title: string;
  fileType: 'PDF' | 'DOCX' | 'XLSX' | 'IMAGE';
  uploadedBy: string;
  uploadedAt: string;
  sizeKb: number;
  bureau: BureauCode;
}

export interface CaseRecord {
  caseId: string;
  institutionId: string;
  reportedInstitutionName?: string; // Used when testing inconsistent name or missing permanent ID
  reportedPermanentId?: string;
  sourceBureau: BureauCode;
  currentBureau: BureauCode;
  assignedOfficerId: string;
  category: ComplaintCategory;
  priority: CasePriority;
  description: string;
  receivedAt: string;
  status: CaseStatus;
  dueAt: string;
  lastActionAt: string;
  nextAction: string;
  relatedCaseIds: string[];
  pendingTransferToBureau?: BureauCode;
  pendingTransferOfficerId?: string;
  pendingTransferReason?: string;
  complainantMasked: string;
  documents: CaseDocument[];
  createdAt: string;
  updatedAt: string;
}

export type ActionType =
  | 'Complaint Received'
  | 'Case Assigned'
  | 'Action Recorded'
  | 'Status Changed'
  | 'Officer Reassigned'
  | 'Bureau Transfer Initiated'
  | 'Bureau Transfer Accepted'
  | 'Deadline Updated'
  | 'Escalation Initiated'
  | 'Escalation Resolved'
  | 'Cases Linked'
  | 'Cases Unlinked'
  | 'Disposal Proposed'
  | 'Disposal Approved'
  | 'Disposal Rejected';

export interface CaseAction {
  actionId: string;
  caseId: string;
  actionType: ActionType;
  actorId: string;
  bureau: BureauCode;
  timestamp: string;
  previousValue?: string;
  newValue?: string;
  remarks: string;
  confidential?: boolean;
  documentReferences: string[];
}

export interface OverlapSignalDetail {
  signal: string;
  scoreContribution: number;
  maxWeight: number;
  explanation: string;
}

export type OverlapReviewStatus = 'Unreviewed' | 'Reviewed' | 'Dismissed';
export type OverlapReviewOutcome =
  | 'Pending Review'
  | 'Confirmed Duplicate'
  | 'Related — Separate Issues'
  | 'No Overlap';

export interface OverlapAlert {
  alertId: string;
  caseIds: [string, string];
  institutionId: string;
  riskScore: number; // 0 to 100
  riskLevel: RiskLevel;
  matchReasons: string[];
  signalBreakdown: OverlapSignalDetail[];
  reviewStatus: OverlapReviewStatus;
  reviewOutcome: OverlapReviewOutcome;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewRemarks?: string;
}

export interface FalsePositivePreventionLog {
  id: string;
  caseIds: [string, string];
  institutionNames: [string, string];
  permanentIds: [string, string];
  nameSimilarityScore: number;
  reasonPrevented: string;
}

export interface CoordinationActionItem {
  itemId: string;
  title: string;
  assignedBureau: BureauCode;
  assignedOfficerId: string;
  dueDate: string;
  completed: boolean;
}

export interface CoordinationNote {
  noteId: string;
  authorId: string;
  bureau: BureauCode;
  timestamp: string;
  content: string;
}

export type CoordinationStatus = 'Open' | 'In Review' | 'Action Agreed' | 'Completed';

export interface CoordinationWorkspace {
  workspaceId: string;
  title: string;
  relatedCaseIds: string[];
  institutionId: string;
  leadBureau: BureauCode;
  coordinatorId: string;
  status: CoordinationStatus;
  priority: CasePriority;
  actionItems: CoordinationActionItem[];
  notes: CoordinationNote[];
  supportingDocs: string[];
  reviewDeadline: string;
  escalatedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  userId: string;
  displayName: string;
  designation: string;
  role: UserRole;
  bureau: BureauCode;
  region: RegionCode;
  active: boolean;
}

export type NotificationType =
  | 'Upcoming Deadline'
  | 'Overdue Alert'
  | 'Inactivity Alert'
  | 'Pending Transfer'
  | 'High-Risk Overlap'
  | 'Escalation Alert'
  | 'Assignment Update';

export interface NotificationItem {
  notificationId: string;
  recipientId: string;
  caseId: string;
  type: NotificationType;
  priority: CasePriority;
  message: string;
  createdAt: string;
  readAt?: string;
}

export interface SLAPolicyConfig {
  timezone: string;
  categorySLADays: Record<ComplaintCategory, number>;
  ageingBuckets: [number, number, number]; // e.g., [3, 7, 15] -> 0-3, 4-7, 8-15, >15
  approachingDeadlineDays: number;
  inactivityThresholdDays: number;
}

export interface OverlapEngineConfig {
  weights: {
    institutionMatch: number;      // default 30
    crossBureauActive: number;     // default 25
    categorySimilarity: number;    // default 20
    descriptionSimilarity: number; // default 15
    temporalOverlap: number;       // default 10
  };
  highRiskThreshold: number;       // default 75
  mediumRiskThreshold: number;     // default 50
}

export interface CaseFilterState {
  searchQuery: string;
  caseIdQuery: string;
  bureau: string;
  region: string;
  category: string;
  status: string;
  riskLevel: string;
  assignedOfficerId: string;
  dateFrom: string;
  dateTo: string;
  overdueOnly: boolean;
  potentialOverlapOnly: boolean;
}

export interface SavedFilterView {
  viewId: string;
  name: string;
  userId: string;
  filters: CaseFilterState;
}

export interface DraftCaseBrief {
  summary: string;
  keyDatesAndActions: string[];
  overlapEvidence: string;
  missingInformation: string[];
  suggestedNextAction: string;
  draftCoordinationNote: string;
  sourceMode: 'gemini_live' | 'deterministic_fallback';
  generatedAt: string;
}
