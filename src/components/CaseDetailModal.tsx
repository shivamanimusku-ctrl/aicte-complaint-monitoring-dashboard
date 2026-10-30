import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GitCompare,
  Lock,
  Paperclip,
  Send,
  ShieldAlert,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import {
  BureauCode,
  CaseAction,
  CaseDocument,
  CaseRecord,
  CaseStatus,
  DraftCaseBrief,
  Institution,
  OverlapAlert,
  SLAPolicyConfig,
  UserProfile,
} from '../types/domain';
import {
  checkPermission,
  evaluateCaseSLA,
  generateDeterministicCaseBrief,
} from '../utils/engine';
import { PriorityLabel, RiskBadge, StatusBadge } from './BadgeHelpers';

interface CaseDetailModalProps {
  caseRecord: CaseRecord;
  institution?: Institution;
  allCases: CaseRecord[];
  actions: CaseAction[];
  overlapAlerts: OverlapAlert[];
  users: UserProfile[];
  currentUser: UserProfile;
  slaPolicy: SLAPolicyConfig;
  referenceDate: Date;
  onClose: () => void;
  onSelectCase: (caseId: string) => void;
  onOpenInstitution: (institutionId: string) => void;
  onOpenOverlapScreen: () => void;
  onChangeStatus: (caseId: string, newStatus: CaseStatus, remarks: string) => void;
  onRecordAction: (
    caseId: string,
    remarks: string,
    nextAction: string,
    confidential: boolean
  ) => void;
  onReassignOfficer: (caseId: string, newOfficerId: string, remarks: string) => void;
  onInitiateTransfer: (
    caseId: string,
    targetBureau: BureauCode,
    targetOfficerId: string,
    reason: string
  ) => void;
  onAcceptTransfer: (caseId: string, remarks: string) => void;
  onUpdateDeadline: (caseId: string, newDueDate: string, reason: string) => void;
  onEscalateCase: (caseId: string, authority: string, remarks: string) => void;
  onAddDocument: (caseId: string, title: string, fileType: CaseDocument['fileType']) => void;
}

const BUREAUS: BureauCode[] = ['RB', 'PGRC', 'AB', 'VIG', 'RO-SC', 'RO-N', 'RO-W', 'RO-S'];

export const CaseDetailModal: React.FC<CaseDetailModalProps> = ({
  caseRecord,
  institution,
  allCases,
  actions,
  overlapAlerts,
  users,
  currentUser,
  slaPolicy,
  referenceDate,
  onClose,
  onSelectCase,
  onOpenInstitution,
  onOpenOverlapScreen,
  onChangeStatus,
  onRecordAction,
  onReassignOfficer,
  onInitiateTransfer,
  onAcceptTransfer,
  onUpdateDeadline,
  onEscalateCase,
  onAddDocument,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'actions' | 'ai-brief' | 'timeline' | 'docs'>(
    'actions'
  );

  // Action forms state
  const [newStatus, setNewStatus] = useState<CaseStatus>(caseRecord.status);
  const [statusRemarks, setStatusRemarks] = useState('');
  const [actionRemarks, setActionRemarks] = useState('');
  const [nextActionInput, setNextActionInput] = useState(caseRecord.nextAction);
  const [confidentialRemark, setConfidentialRemark] = useState(false);

  const [selectedOfficerId, setSelectedOfficerId] = useState(caseRecord.assignedOfficerId);
  const [reassignRemarks, setReassignRemarks] = useState('');

  const [transferBureau, setTransferBureau] = useState<BureauCode>('VIG');
  const [transferOfficerId, setTransferOfficerId] = useState('USR-CO-VIG1');
  const [transferReason, setTransferReason] = useState('');
  const [acceptRemarks, setAcceptRemarks] = useState('');

  const [newDeadline, setNewDeadline] = useState(caseRecord.dueAt.slice(0, 10));
  const [deadlineReason, setDeadlineReason] = useState('');

  const [escalationAuthority, setEscalationAuthority] = useState(
    'Standing Hearing Committee (SHC) / Member Secretary'
  );
  const [escalationRemarks, setEscalationRemarks] = useState('');

  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState<CaseDocument['fileType']>('PDF');

  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // AI Brief state
  const [brief, setBrief] = useState<DraftCaseBrief | null>(null);
  const [loadingBrief, setLoadingBrief] = useState(false);

  useEffect(() => {
    setNewStatus(caseRecord.status);
    setNextActionInput(caseRecord.nextAction);
    setSelectedOfficerId(caseRecord.assignedOfficerId);
    setNewDeadline(caseRecord.dueAt.slice(0, 10));
    setFeedbackBanner(null);
  }, [caseRecord]);

  const caseActions = useMemo(
    () =>
      actions
        .filter((a) => a.caseId === caseRecord.caseId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [actions, caseRecord.caseId]
  );

  const caseOverlaps = useMemo(
    () => overlapAlerts.filter((o) => o.caseIds.includes(caseRecord.caseId)),
    [overlapAlerts, caseRecord.caseId]
  );

  const relatedCases = useMemo(() => {
    const ids = new Set<string>(caseRecord.relatedCaseIds);
    for (const o of caseOverlaps) {
      for (const cid of o.caseIds) {
        if (cid !== caseRecord.caseId) ids.add(cid);
      }
    }
    return allCases.filter((c) => ids.has(c.caseId));
  }, [allCases, caseRecord, caseOverlaps]);

  const sla = useMemo(
    () => evaluateCaseSLA(caseRecord, referenceDate, slaPolicy),
    [caseRecord, referenceDate, slaPolicy]
  );

  const userMap = useMemo(() => new Map(users.map((u) => [u.userId, u])), [users]);
  const canViewConfidential = checkPermission(
    currentUser,
    'VIEW_CONFIDENTIAL_REMARKS',
    caseRecord,
    institution
  ).allowed;

  const generateBrief = async () => {
    setLoadingBrief(true);
    const fallbackBrief = generateDeterministicCaseBrief(
      caseRecord,
      institution,
      caseActions,
      relatedCases,
      caseOverlaps
    );
    try {
      const resp = await fetch('/api/ai/case-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseRecord,
          institution,
          actions: caseActions,
          relatedCases,
          overlapAlerts: caseOverlaps,
        }),
      });
      const data = await resp.json();
      if (data?.mode === 'gemini_live' && data?.brief) {
        setBrief({
          ...data.brief,
          sourceMode: 'gemini_live',
          generatedAt: data.generatedAt || new Date().toISOString(),
        });
      } else {
        setBrief(fallbackBrief);
      }
    } catch {
      setBrief(fallbackBrief);
    } finally {
      setLoadingBrief(false);
    }
  };

  useEffect(() => {
    // Pre-populate deterministic brief immediately so officer has zero-latency draft
    setBrief(
      generateDeterministicCaseBrief(
        caseRecord,
        institution,
        caseActions,
        relatedCases,
        caseOverlaps
      )
    );
  }, [caseRecord, institution, caseActions, relatedCases, caseOverlaps]);

  const runProtectedAction = (
    op: Parameters<typeof checkPermission>[1],
    callback: () => void,
    successMsg: string
  ) => {
    const check = checkPermission(currentUser, op, caseRecord, institution);
    if (!check.allowed) {
      setFeedbackBanner({
        type: 'error',
        message: check.reason || 'Role permission denied for this operation.',
      });
      return;
    }
    callback();
    setFeedbackBanner({ type: 'success', message: successMsg });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#203528]/40 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="case-detail-modal-title"
    >
      <div className="bg-white border border-[#DFEADF] rounded-2xl shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Pale-Green Administrative Header */}
        <div className="bg-[#EAF7E9] border-b border-[#DFEADF] px-6 py-4 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-base font-bold text-[#398653]">
                {caseRecord.caseId}
              </span>
              <StatusBadge status={caseRecord.status} isOverdue={sla.isOverdue} />
              <PriorityLabel priority={caseRecord.priority} />
              {caseOverlaps.length > 0 && (
                <RiskBadge
                  level={caseOverlaps[0].riskLevel}
                  score={caseOverlaps[0].riskScore}
                  isOverlap
                />
              )}
            </div>
            <h2 id="case-detail-modal-title" className="text-lg font-bold text-[#203528]">
              {caseRecord.category} — {caseRecord.reportedInstitutionName || institution?.name}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#718173]">
              <span className="font-mono">
                AICTE PID: {caseRecord.reportedPermanentId ?? institution?.permanentId ?? 'Missing'}
              </span>
              <span>·</span>
              <span>Source: {caseRecord.sourceBureau}</span>
              <span>·</span>
              <span className="font-semibold text-[#203528]">
                Current Bureau: {caseRecord.currentBureau}
              </span>
              <span>·</span>
              <span>Complainant: {caseRecord.complainantMasked}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {institution && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenInstitution(institution.institutionId);
                }}
                className="px-3 py-1.5 rounded-lg bg-white border border-[#B7E4B1] text-xs font-semibold text-[#203528] hover:bg-[#F7FBF7] flex items-center gap-1.5 cursor-pointer"
              >
                <Building2 className="w-3.5 h-3.5 text-[#398653]" />
                <span>Institution 360°</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Case Details Modal"
              className="p-1.5 rounded-lg bg-white border border-[#DFEADF] text-[#203528] hover:bg-[#FDEDEC] hover:text-[#D9534F] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {feedbackBanner && (
            <div
              className={`p-3.5 rounded-lg border text-xs font-medium flex items-center justify-between ${
                feedbackBanner.type === 'success'
                  ? 'bg-[#EAF7E9] border-[#B7E4B1] text-[#203528]'
                  : 'bg-[#FDEDEC] border-[#F5B7B1] text-[#B8322E]'
              }`}
            >
              <span>{feedbackBanner.message}</span>
              <button
                type="button"
                onClick={() => setFeedbackBanner(null)}
                className="text-xs underline ml-4 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Top Summary Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-[#F7FBF7] border border-[#DFEADF] rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold text-[#398653]">Complaint Factual Summary</div>
              <p className="text-sm text-[#203528] leading-relaxed">{caseRecord.description}</p>
              <div className="pt-2 border-t border-[#DFEADF] flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-[#718173]">Next Scheduled Action: </span>
                  <span className="font-semibold text-[#203528]">{caseRecord.nextAction}</span>
                </div>
                <div className="font-mono text-[#718173]">
                  Received: {caseRecord.receivedAt.slice(0, 10)} · Due: {caseRecord.dueAt.slice(0, 10)}
                </div>
              </div>
            </div>

            {/* Linked / Overlapping Cases Panel */}
            <div className="bg-[#F7FBF7] border border-[#DFEADF] rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#203528]">
                    Linked & Overlapping Cases ({relatedCases.length})
                  </span>
                  {caseOverlaps.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenOverlapScreen();
                      }}
                      className="text-[11px] font-semibold text-[#398653] hover:underline cursor-pointer"
                    >
                      Overlap Engine →
                    </button>
                  )}
                </div>
                {relatedCases.length === 0 ? (
                  <p className="text-xs text-[#718173]">
                    No linked or parallel cases registered for this docket.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {relatedCases.map((rc) => (
                      <button
                        key={rc.caseId}
                        type="button"
                        onClick={() => onSelectCase(rc.caseId)}
                        className="w-full text-left p-2 rounded-lg bg-white border border-[#DFEADF] hover:border-[#398653] transition-colors text-xs cursor-pointer"
                      >
                        <div className="flex items-center justify-between font-mono font-bold text-[#398653]">
                          <span>{rc.caseId}</span>
                          <span>{rc.currentBureau}</span>
                        </div>
                        <div className="text-[#203528] truncate mt-0.5">{rc.category}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pending Inter-Bureau Transfer Alert Banner if present */}
          {caseRecord.pendingTransferToBureau && (
            <div className="bg-[#F3EEFA] border border-[#D8C7F0] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-bold text-[#5E3A8C] flex items-center gap-1.5">
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>
                    Pending Inter-Bureau Transfer: {caseRecord.currentBureau} →{' '}
                    {caseRecord.pendingTransferToBureau}
                  </span>
                </div>
                <p className="text-xs text-[#203528]">
                  Reason: {caseRecord.pendingTransferReason || 'Inter-bureau jurisdiction alignment'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  value={acceptRemarks}
                  onChange={(e) => setAcceptRemarks(e.target.value)}
                  placeholder="Acceptance remarks..."
                  className="px-2.5 py-1.5 text-xs bg-white border border-[#D8C7F0] rounded-lg"
                />
                <button
                  type="button"
                  onClick={() =>
                    runProtectedAction(
                      'ACCEPT_TRANSFER',
                      () => {
                        onAcceptTransfer(
                          caseRecord.caseId,
                          acceptRemarks.trim() ||
                            `Transfer accepted by ${caseRecord.pendingTransferToBureau}`
                        );
                        setAcceptRemarks('');
                      },
                      `Transfer of ${caseRecord.caseId} to ${caseRecord.pendingTransferToBureau} accepted.`
                    )
                  }
                  className="px-3.5 py-1.5 rounded-lg bg-[#398653] text-white text-xs font-semibold hover:bg-[#2F7446] whitespace-nowrap cursor-pointer"
                >
                  Accept Transfer
                </button>
              </div>
            </div>
          )}

          {/* Navigation Sub-Tabs */}
          <div className="flex items-center gap-2 border-b border-[#DFEADF]">
            {[
              {
                id: 'actions',
                label: 'Workflow Actions & Transfers',
                icon: ClipboardCheck,
              },
              {
                id: 'ai-brief',
                label: 'AI Case Brief & Next-Action Assistant',
                icon: Sparkles,
              },
              {
                id: 'timeline',
                label: `Audit & Action History (${caseActions.length})`,
                icon: Calendar,
              },
              {
                id: 'docs',
                label: `Documents (${caseRecord.documents.length})`,
                icon: Paperclip,
              },
            ].map((t) => {
              const IconComp = t.icon;
              const isActive = activeSubTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveSubTab(t.id as any)}
                  className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'border-[#398653] text-[#398653] bg-[#EAF7E9]/40 rounded-t-lg'
                      : 'border-transparent text-[#718173] hover:text-[#203528]'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Sub-Tab 1: Workflow Actions & Transfers */}
          {activeSubTab === 'actions' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Record Action & Status Change */}
              <div className="bg-white border border-[#DFEADF] rounded-xl p-4 space-y-3">
                <div className="bg-[#EAF7E9] -mx-4 -mt-4 px-4 py-2.5 rounded-t-xl border-b border-[#DFEADF] text-xs font-bold text-[#203528]">
                  1. Update Case Status or Record Official Action
                </div>

                <div className="space-y-2.5 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-[#203528] mb-1">
                      Lifecycle Status
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as CaseStatus)}
                      className="w-full px-3 py-1.5 text-xs border border-[#DFEADF] rounded-lg bg-white text-[#203528]"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Under Process">Under Process</option>
                      <option value="Transferred">Transferred</option>
                      <option value="Disposed">Disposed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#203528] mb-1">
                      Updated Next Action Step
                    </label>
                    <input
                      type="text"
                      value={nextActionInput}
                      onChange={(e) => setNextActionInput(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-[#DFEADF] rounded-lg bg-white text-[#203528]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#203528] mb-1">
                      Official Remarks / Compliance Note (Required)
                    </label>
                    <textarea
                      rows={2}
                      value={actionRemarks}
                      onChange={(e) => setActionRemarks(e.target.value)}
                      placeholder="Enter verified findings, notice reference number, or disposal justification..."
                      className="w-full px-3 py-1.5 text-xs border border-[#DFEADF] rounded-lg bg-white text-[#203528]"
                    />
                  </div>

                  <label className="inline-flex items-center gap-2 text-xs text-[#718173] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confidentialRemark}
                      onChange={(e) => setConfidentialRemark(e.target.checked)}
                      className="accent-[#398653]"
                    />
                    <span>Mark remark as confidential vigilance/internal note</span>
                  </label>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!actionRemarks.trim()) {
                          setFeedbackBanner({
                            type: 'error',
                            message: 'Please enter official remarks before recording an action.',
                          });
                          return;
                        }
                        runProtectedAction(
                          'UPDATE_CASE_STATUS',
                          () => {
                            if (newStatus !== caseRecord.status) {
                              onChangeStatus(caseRecord.caseId, newStatus, actionRemarks.trim());
                            }
                            onRecordAction(
                              caseRecord.caseId,
                              actionRemarks.trim(),
                              nextActionInput.trim() || caseRecord.nextAction,
                              confidentialRemark
                            );
                            setActionRemarks('');
                          },
                          `Recorded official action and status (${newStatus}) on ${caseRecord.caseId}.`
                        );
                      }}
                      className="px-4 py-2 rounded-lg bg-[#398653] text-white text-xs font-semibold hover:bg-[#2F7446] transition-colors cursor-pointer"
                    >
                      Save Action & Status
                    </button>
                  </div>
                </div>
              </div>

              {/* Initiate Inter-Bureau Transfer */}
              <div className="bg-white border border-[#DFEADF] rounded-xl p-4 space-y-3">
                <div className="bg-[#EAF7E9] -mx-4 -mt-4 px-4 py-2.5 rounded-t-xl border-b border-[#DFEADF] text-xs font-bold text-[#203528]">
                  2. Initiate Inter-Bureau Transfer
                </div>

                <div className="space-y-2.5 pt-1">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-[#203528] mb-1">
                        Receiving Bureau
                      </label>
                      <select
                        value={transferBureau}
                        onChange={(e) => setTransferBureau(e.target.value as BureauCode)}
                        className="w-full px-2.5 py-1.5 text-xs border border-[#DFEADF] rounded-lg bg-white"
                      >
                        {BUREAUS.filter((b) => b !== caseRecord.currentBureau).map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#203528] mb-1">
                        Receiving Officer
                      </label>
                      <select
                        value={transferOfficerId}
                        onChange={(e) => setTransferOfficerId(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-[#DFEADF] rounded-lg bg-white"
                      >
                        {users.map((u) => (
                          <option key={u.userId} value={u.userId}>
                            {u.displayName} ({u.bureau})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#203528] mb-1">
                      Reason for Inter-Bureau Transfer (Required)
                    </label>
                    <textarea
                      rows={2}
                      value={transferReason}
                      onChange={(e) => setTransferReason(e.target.value)}
                      placeholder="Specify statutory purview or active parallel investigation in receiving Bureau..."
                      className="w-full px-3 py-1.5 text-xs border border-[#DFEADF] rounded-lg bg-white"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!transferReason.trim()) {
                        setFeedbackBanner({
                          type: 'error',
                          message: 'Please provide a reason for initiating the Bureau transfer.',
                        });
                        return;
                      }
                      runProtectedAction(
                        'INITIATE_TRANSFER',
                        () => {
                          onInitiateTransfer(
                            caseRecord.caseId,
                            transferBureau,
                            transferOfficerId,
                            transferReason.trim()
                          );
                          setTransferReason('');
                        },
                        `Transfer initiated from ${caseRecord.currentBureau} to ${transferBureau}.`
                      );
                    }}
                    className="px-4 py-2 rounded-lg bg-[#398653] text-white text-xs font-semibold hover:bg-[#2F7446] transition-colors cursor-pointer"
                  >
                    Initiate Bureau Transfer
                  </button>
                </div>
              </div>

              {/* Officer Reassignment & SLA Deadline Update */}
              <div className="bg-white border border-[#DFEADF] rounded-xl p-4 space-y-3">
                <div className="bg-[#EAF7E9] -mx-4 -mt-4 px-4 py-2.5 rounded-t-xl border-b border-[#DFEADF] text-xs font-bold text-[#203528]">
                  3. Reassign Responsible Officer
                </div>
                <div className="space-y-2.5 pt-1">
                  <select
                    value={selectedOfficerId}
                    onChange={(e) => setSelectedOfficerId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-[#DFEADF] rounded-lg bg-white"
                  >
                    {users.map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {u.displayName} — {u.designation} ({u.bureau})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={reassignRemarks}
                    onChange={(e) => setReassignRemarks(e.target.value)}
                    placeholder="Reason for officer reassignment..."
                    className="w-full px-3 py-1.5 text-xs border border-[#DFEADF] rounded-lg bg-white"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      runProtectedAction(
                        'ASSIGN_OFFICER',
                        () => {
                          onReassignOfficer(
                            caseRecord.caseId,
                            selectedOfficerId,
                            reassignRemarks.trim() || 'Administrative workload reallocation'
                          );
                          setReassignRemarks('');
                        },
                        'Responsible officer updated and recorded in audit trail.'
                      )
                    }
                    className="px-3.5 py-1.5 rounded-lg bg-[#EAF7E9] text-[#203528] border border-[#B7E4B1] hover:bg-[#d8f0d6] text-xs font-semibold cursor-pointer"
                  >
                    Confirm Reassignment
                  </button>
                </div>
              </div>

              {/* SLA Deadline Extension & Escalation */}
              <div className="bg-white border border-[#DFEADF] rounded-xl p-4 space-y-3">
                <div className="bg-[#EAF7E9] -mx-4 -mt-4 px-4 py-2.5 rounded-t-xl border-b border-[#DFEADF] text-xs font-bold text-[#203528]">
                  4. SLA Deadline Update & Competent Authority Escalation
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-[#203528]">
                      Revised SLA Deadline
                    </label>
                    <input
                      type="date"
                      value={newDeadline}
                      onChange={(e) => setNewDeadline(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-[#DFEADF] rounded-lg"
                    />
                    <input
                      type="text"
                      value={deadlineReason}
                      onChange={(e) => setDeadlineReason(e.target.value)}
                      placeholder="Reason for deadline change..."
                      className="w-full px-2.5 py-1.5 text-xs border border-[#DFEADF] rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!deadlineReason.trim()) {
                          setFeedbackBanner({
                            type: 'error',
                            message: 'Reason is mandatory when updating an SLA deadline.',
                          });
                          return;
                        }
                        runProtectedAction(
                          'UPDATE_CASE_STATUS',
                          () => {
                            onUpdateDeadline(caseRecord.caseId, newDeadline, deadlineReason.trim());
                            setDeadlineReason('');
                          },
                          `SLA deadline updated to ${newDeadline}.`
                        );
                      }}
                      className="w-full px-3 py-1.5 rounded-lg bg-[#EAF7E9] text-[#203528] border border-[#B7E4B1] text-xs font-semibold cursor-pointer"
                    >
                      Update Deadline
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-[#203528]">
                      Escalate to Competent Authority
                    </label>
                    <input
                      type="text"
                      value={escalationAuthority}
                      onChange={(e) => setEscalationAuthority(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-[#DFEADF] rounded-lg"
                    />
                    <input
                      type="text"
                      value={escalationRemarks}
                      onChange={(e) => setEscalationRemarks(e.target.value)}
                      placeholder="Escalation justification..."
                      className="w-full px-2.5 py-1.5 text-xs border border-[#DFEADF] rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!escalationRemarks.trim()) {
                          setFeedbackBanner({
                            type: 'error',
                            message: 'Please enter justification remarks for escalation.',
                          });
                          return;
                        }
                        runProtectedAction(
                          'ESCALATE_CASE',
                          () => {
                            onEscalateCase(
                              caseRecord.caseId,
                              escalationAuthority,
                              escalationRemarks.trim()
                            );
                            setEscalationRemarks('');
                          },
                          `Case escalated to ${escalationAuthority}.`
                        );
                      }}
                      className="w-full px-3 py-1.5 rounded-lg bg-[#FDEDEC] text-[#B8322E] border border-[#F5B7B1] hover:bg-[#fadbd8] text-xs font-semibold cursor-pointer"
                    >
                      Escalate Case
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sub-Tab 2: AI Case Brief & Next-Action Assistant */}
          {activeSubTab === 'ai-brief' && brief && (
            <div className="space-y-4">
              <div className="bg-[#EAF7E9] border border-[#B7E4B1] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#398653]" />
                    <span className="text-xs font-bold text-[#203528]">
                      DRAFT CASE BRIEF — FOR OFFICIAL REVIEW ONLY
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white border border-[#B7E4B1] text-[11px] font-mono text-[#398653]">
                      {brief.sourceMode === 'gemini_live'
                        ? 'Server Gemini AI'
                        : 'Deterministic Rule-Linked Engine'}
                    </span>
                  </div>
                  <p className="text-xs text-[#718173]">
                    This assistant synthesizes linked docket records and does not make legal findings or automatically close complaints. Officers must verify and approve any proposed action.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={generateBrief}
                  disabled={loadingBrief}
                  className="px-3.5 py-2 rounded-lg bg-[#398653] text-white text-xs font-semibold hover:bg-[#2F7446] disabled:opacity-50 whitespace-nowrap cursor-pointer"
                >
                  {loadingBrief ? 'Refreshing Brief...' : 'Regenerate Draft Brief'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-[#DFEADF] rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-[#398653]">1. Concise Complaint Summary</h4>
                  <p className="text-xs text-[#203528] leading-relaxed">{brief.summary}</p>
                </div>

                <div className="bg-white border border-[#DFEADF] rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-[#398653]">
                    2. Related Cases & Overlap Evidence
                  </h4>
                  <p className="text-xs text-[#203528] leading-relaxed">{brief.overlapEvidence}</p>
                </div>

                <div className="bg-white border border-[#DFEADF] rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-[#398653]">
                    3. Key Dates & Recorded Actions
                  </h4>
                  <ul className="space-y-1.5 text-xs text-[#203528]">
                    {brief.keyDatesAndActions.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#398653] mt-1.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white border border-[#DFEADF] rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-[#B35012]">
                    4. Missing Information / Documentary Gaps
                  </h4>
                  <ul className="space-y-1.5 text-xs text-[#203528]">
                    {brief.missingInformation.map((gap, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#D99A25] mt-0.5 shrink-0" />
                        <span>{gap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="bg-[#F7FBF7] border border-[#DFEADF] rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-[#203528]">
                      5. Suggested Next Action (Requires Officer Approval)
                    </h4>
                    <p className="text-xs text-[#398653] font-medium mt-0.5">
                      {brief.suggestedNextAction}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      runProtectedAction(
                        'UPDATE_CASE_STATUS',
                        () => {
                          onRecordAction(
                            caseRecord.caseId,
                            `Officer reviewed and adopted draft next-action recommendation: ${brief.suggestedNextAction}`,
                            brief.suggestedNextAction,
                            false
                          );
                        },
                        'Approved and recorded suggested next action on case timeline.'
                      )
                    }
                    className="px-3.5 py-1.5 rounded-lg bg-[#398653] text-white text-xs font-semibold hover:bg-[#2F7446] whitespace-nowrap cursor-pointer"
                  >
                    Approve & Adopt Next Action
                  </button>
                </div>

                <div className="pt-3 border-t border-[#DFEADF]">
                  <h4 className="text-xs font-bold text-[#203528] mb-1.5">
                    6. Draft Inter-Bureau Coordination / Escalation Brief
                  </h4>
                  <pre className="text-xs font-mono bg-white border border-[#DFEADF] rounded-lg p-3 whitespace-pre-wrap text-[#203528]">
                    {brief.draftCoordinationNote}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Sub-Tab 3: Append-Only Chronological Timeline */}
          {activeSubTab === 'timeline' && (
            <div className="bg-white border border-[#DFEADF] rounded-xl p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-[#203528]">
                    Immutable Case Action & Audit History
                  </h4>
                  <p className="text-xs text-[#718173]">
                    Append-only chronological record of all status changes, assignments, transfers, and remarks
                  </p>
                </div>
                <span className="text-xs font-mono text-[#718173]">
                  {caseActions.length} entries
                </span>
              </div>

              <div className="relative pl-6 border-l-2 border-[#B7E4B1] space-y-5">
                {caseActions.map((act) => {
                  const actor = userMap.get(act.actorId);
                  const isMaskedConfidential = act.confidential && !canViewConfidential;

                  return (
                    <div key={act.actionId} className="relative">
                      <div className="w-3.5 h-3.5 rounded-full bg-[#398653] border-2 border-white absolute -left-[31px] top-1" />
                      <div className="bg-[#F7FBF7] border border-[#DFEADF] rounded-lg p-3.5 space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#203528]">
                              {act.actionType}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-[#EAF7E9] text-[#398653] font-mono text-[11px] font-semibold">
                              {act.bureau}
                            </span>
                            <span className="text-[11px] font-mono text-[#718173]">
                              [{act.actionId}]
                            </span>
                          </div>
                          <span className="text-xs font-mono text-[#718173]">
                            {act.timestamp.replace('T', ' ').slice(0, 16)} UTC
                          </span>
                        </div>

                        {(act.previousValue || act.newValue) && (
                          <div className="text-xs font-mono text-[#398653]">
                            {act.previousValue ? `${act.previousValue} → ` : ''}
                            <span className="font-bold">{act.newValue}</span>
                          </div>
                        )}

                        {isMaskedConfidential ? (
                          <div className="text-xs text-[#718173] italic flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-[#D99A25]" />
                            <span>
                              [Confidential Vigilance/Officer Remark masked for current role]
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-[#203528]">
                            {act.confidential && (
                              <span className="font-semibold text-[#B35012] mr-1.5">
                                [CONFIDENTIAL]
                              </span>
                            )}
                            {act.remarks}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[#718173]">
                          <span>
                            Acting Official: {actor?.displayName || act.actorId} (
                            {actor?.role || 'Official'})
                          </span>
                          {act.documentReferences.length > 0 && (
                            <span className="font-mono text-[#398653]">
                              Linked Docs: {act.documentReferences.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sub-Tab 4: Supporting Documents */}
          {activeSubTab === 'docs' && (
            <div className="space-y-4">
              <div className="bg-white border border-[#DFEADF] rounded-xl p-4">
                <h4 className="text-xs font-bold text-[#203528] mb-3">
                  Attach Supporting Evidence / Compliance Document
                </h4>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!docTitle.trim()) return;
                    runProtectedAction(
                      'UPDATE_CASE_STATUS',
                      () => {
                        onAddDocument(caseRecord.caseId, docTitle.trim(), docType);
                        setDocTitle('');
                      },
                      `Attached document "${docTitle.trim()}" to ${caseRecord.caseId}.`
                    );
                  }}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
                >
                  <input
                    type="text"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder="Document filename (e.g. EVC_Compliance_Verification_Oct2026.pdf)"
                    className="flex-1 px-3 py-1.5 text-xs border border-[#DFEADF] rounded-lg"
                  />
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as any)}
                    className="px-3 py-1.5 text-xs border border-[#DFEADF] rounded-lg bg-white"
                  >
                    <option value="PDF">PDF Document</option>
                    <option value="XLSX">Excel Sheet (XLSX)</option>
                    <option value="DOCX">Word Notice (DOCX)</option>
                    <option value="IMAGE">Geo-Tagged Photo</option>
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-[#398653] text-white text-xs font-semibold hover:bg-[#2F7446] cursor-pointer"
                  >
                    Attach to Docket
                  </button>
                </form>
              </div>

              <div className="bg-white border border-[#DFEADF] rounded-xl divide-y divide-[#DFEADF]">
                {caseRecord.documents.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#718173]">
                    No documentary attachments uploaded for this case yet.
                  </div>
                ) : (
                  caseRecord.documents.map((doc) => (
                    <div
                      key={doc.docId}
                      className="p-3.5 flex items-center justify-between gap-4 hover:bg-[#F7FBF7]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#EAF7E9] flex items-center justify-center text-[#398653]">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-[#203528]">{doc.title}</div>
                          <div className="text-[11px] text-[#718173] font-mono">
                            {doc.docId} · {doc.fileType} · {doc.sizeKb} KB · Uploaded by{' '}
                            {doc.uploadedBy} ({doc.bureau}) on {doc.uploadedAt.slice(0, 10)}
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded bg-[#EAF7E9] text-[#398653] text-xs font-semibold">
                        Verified Record
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
