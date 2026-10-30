import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  FolderKanban,
  GitCompare,
  Info,
  Link2,
  ShieldCheck,
  Sliders,
  XCircle,
} from 'lucide-react';
import {
  CaseRecord,
  FalsePositivePreventionLog,
  Institution,
  OverlapAlert,
  OverlapEngineConfig,
  OverlapReviewOutcome,
  UserProfile,
} from '../types/domain';
import { checkPermission } from '../utils/engine';
import { PriorityLabel, RiskBadge, StatusBadge } from './BadgeHelpers';

interface OverlapIntelligenceViewProps {
  overlapAlerts: OverlapAlert[];
  preventedFalsePositives: FalsePositivePreventionLog[];
  cases: CaseRecord[];
  institutions: Institution[];
  users: UserProfile[];
  currentUser: UserProfile;
  overlapConfig: OverlapEngineConfig;
  onReviewOverlap: (
    alertId: string,
    outcome: OverlapReviewOutcome,
    remarks: string,
    dismiss?: boolean
  ) => void;
  onLinkCasesFromOverlap: (caseIds: [string, string]) => void;
  onCreateOrOpenWorkspace: (alert: OverlapAlert) => void;
  onOpenCase: (caseId: string) => void;
  onOpenInstitution: (institutionId: string) => void;
  onNavigateToSettings: () => void;
}

export const OverlapIntelligenceView: React.FC<OverlapIntelligenceViewProps> = ({
  overlapAlerts,
  preventedFalsePositives,
  cases,
  institutions,
  users,
  currentUser,
  overlapConfig,
  onReviewOverlap,
  onLinkCasesFromOverlap,
  onCreateOrOpenWorkspace,
  onOpenCase,
  onOpenInstitution,
  onNavigateToSettings,
}) => {
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'High' | 'Medium' | 'Low'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Unreviewed' | 'Reviewed' | 'Dismissed'>(
    'ALL'
  );
  const [expandedSignalAlertId, setExpandedSignalAlertId] = useState<string | null>(null);
  const [reviewingAlertId, setReviewingAlertId] = useState<string | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<OverlapReviewOutcome>(
    'Related — Separate Issues'
  );
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const caseMap = useMemo(() => new Map(cases.map((c) => [c.caseId, c])), [cases]);
  const instMap = useMemo(() => new Map(institutions.map((i) => [i.institutionId, i])), [institutions]);
  const userMap = useMemo(() => new Map(users.map((u) => [u.userId, u])), [users]);

  const filteredAlerts = useMemo(() => {
    return overlapAlerts.filter((a) => {
      if (riskFilter !== 'ALL' && a.riskLevel !== riskFilter) return false;
      if (statusFilter !== 'ALL' && a.reviewStatus !== statusFilter) return false;
      return true;
    });
  }, [overlapAlerts, riskFilter, statusFilter]);

  const handleConfirmReview = (alertId: string) => {
    const perm = checkPermission(currentUser, 'REVIEW_OVERLAP');
    if (!perm.allowed) {
      setFeedback({ type: 'error', text: perm.reason || 'Unauthorized role for overlap review.' });
      return;
    }
    if (!reviewRemarks.trim()) {
      setFeedback({
        type: 'error',
        text: 'Please provide an official justification remark before recording an overlap decision.',
      });
      return;
    }
    onReviewOverlap(alertId, selectedOutcome, reviewRemarks.trim(), false);
    setReviewingAlertId(null);
    setReviewRemarks('');
    setFeedback({
      type: 'success',
      text: `Recorded officer decision "${selectedOutcome}" for Alert ${alertId}.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* High-Impact Pale-Green Header */}
      <div className="bg-[#EAF7E9] border border-[#B7E4B1] rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-[#398653] uppercase tracking-wider">
            <GitCompare className="w-4 h-4" />
            <span>Explainable Multi-Signal Detection Engine</span>
          </div>
          <h2 className="text-xl font-bold text-[#203528]">
            Overlap Intelligence — Potential Overlapping Cases Requiring Coordination
          </h2>
          <p className="text-xs text-[#203528]/80 max-w-3xl leading-relaxed">
            Evaluates institution identity (exact AICTE Permanent ID or normalized name/address fuzzy match), parallel active Bureaus, complaint category correlation, description similarity, and concurrent review windows. Scores are indicative (0–100) for coordination prioritization—never an automatic legal or duplicate determination.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onNavigateToSettings}
            className="px-3.5 py-2 rounded-lg bg-white border border-[#B7E4B1] text-xs font-semibold text-[#203528] hover:bg-[#F7FBF7] flex items-center gap-1.5 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-[#398653]" />
            <span>
              Signal Weights ({overlapConfig.weights.institutionMatch}/
              {overlapConfig.weights.crossBureauActive}/
              {overlapConfig.weights.categorySimilarity}/
              {overlapConfig.weights.descriptionSimilarity}/
              {overlapConfig.weights.temporalOverlap})
            </span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-[#EAF7E9] border-[#B7E4B1] text-[#203528]'
              : 'bg-[#FDEDEC] border-[#F5B7B1] text-[#B8322E]'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="underline ml-3 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white border border-[#DFEADF] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#718173]">Risk Classification:</span>
          {(['ALL', 'High', 'Medium', 'Low'] as const).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setRiskFilter(level)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                riskFilter === level
                  ? 'bg-[#398653] text-white'
                  : 'bg-[#F7FBF7] text-[#203528] border border-[#DFEADF] hover:bg-[#EAF7E9]'
              }`}
            >
              {level === 'ALL' ? 'All Risk Levels' : `${level} Risk`}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#718173]">Review Status:</span>
          {(['ALL', 'Unreviewed', 'Reviewed', 'Dismissed'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-[#398653] text-white'
                  : 'bg-[#F7FBF7] text-[#203528] border border-[#DFEADF] hover:bg-[#EAF7E9]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Side-by-Side Overlap Comparison Cards */}
      <div className="space-y-5">
        {filteredAlerts.map((alert) => {
          const cA = caseMap.get(alert.caseIds[0]);
          const cB = caseMap.get(alert.caseIds[1]);
          const inst = instMap.get(alert.institutionId);
          if (!cA || !cB) return null;

          const offA = userMap.get(cA.assignedOfficerId);
          const offB = userMap.get(cB.assignedOfficerId);
          const isHigh = alert.riskLevel === 'High';
          const isExpanded = expandedSignalAlertId === alert.alertId;
          const isReviewing = reviewingAlertId === alert.alertId;

          return (
            <div
              key={alert.alertId}
              className={`rounded-2xl border overflow-hidden shadow-xs ${
                isHigh
                  ? 'bg-[#FDEDEC]/25 border-[#F5B7B1]'
                  : 'bg-[#FEF0E6]/30 border-[#F7C6A3]'
              }`}
            >
              {/* Alert Banner Header */}
              <div
                className={`px-6 py-4 border-b flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                  isHigh
                    ? 'bg-[#FDEDEC]/70 border-[#F5B7B1]'
                    : 'bg-[#FEF0E6]/80 border-[#F7C6A3]'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-[#203528]">
                      Alert ID: {alert.alertId}
                    </span>
                    <RiskBadge level={alert.riskLevel} score={alert.riskScore} isOverlap />
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                        alert.reviewStatus === 'Reviewed'
                          ? 'bg-[#EAF7E9] text-[#2E8B57] border-[#B7E4B1]'
                          : alert.reviewStatus === 'Dismissed'
                          ? 'bg-white text-[#718173] border-[#DFEADF]'
                          : 'bg-white text-[#B35012] border-[#F7C6A3]'
                      }`}
                    >
                      {alert.reviewStatus} · {alert.reviewOutcome}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => inst && onOpenInstitution(inst.institutionId)}
                      className="text-base font-bold text-[#203528] hover:text-[#398653] flex items-center gap-1.5 cursor-pointer"
                    >
                      <Building2 className="w-4 h-4 text-[#398653]" />
                      <span>{inst?.name}</span>
                    </button>
                    <span className="font-mono text-xs text-[#718173]">
                      (AICTE PID: {inst?.permanentId || 'Fuzzy Matched'} · {inst?.state})
                    </span>
                  </div>
                </div>

                {/* Accessible Risk Score Progress Bar */}
                <div className="w-full lg:w-72 bg-white border border-[#DFEADF] rounded-xl p-3">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-[#203528]">Indicative Overlap Score</span>
                    <span className="font-mono font-bold text-[#203528] tabular-nums">
                      {alert.riskScore} / 100 ({alert.riskLevel})
                    </span>
                  </div>
                  <div
                    className="w-full h-2.5 bg-[#EAF7E9] rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={alert.riskScore}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className={`h-full rounded-full ${
                        isHigh ? 'bg-[#D9534F]' : 'bg-[#D99A25]'
                      }`}
                      style={{ width: `${alert.riskScore}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Side-by-Side Comparison Panels with Central Linking Indicator */}
              <div className="p-6 bg-white space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 items-stretch">
                  {/* Case A Panel (5 cols) */}
                  <div className="lg:col-span-5 bg-[#F7FBF7] border border-[#DFEADF] rounded-xl p-4 flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => onOpenCase(cA.caseId)}
                          className="font-mono text-sm font-bold text-[#398653] hover:underline cursor-pointer"
                        >
                          {cA.caseId}
                        </button>
                        <StatusBadge status={cA.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 rounded bg-[#EAF7E9] text-[#203528] font-mono font-semibold">
                          Source: {cA.sourceBureau} → Current: {cA.currentBureau}
                        </span>
                        <PriorityLabel priority={cA.priority} />
                      </div>
                      <div className="text-sm font-bold text-[#203528]">{cA.category}</div>
                      <p className="text-xs text-[#203528] leading-relaxed">{cA.description}</p>
                    </div>

                    <div className="pt-2.5 border-t border-[#DFEADF] text-xs text-[#718173] flex flex-wrap items-center justify-between gap-2">
                      <span>Officer: {offA?.displayName || cA.assignedOfficerId}</span>
                      <span className="font-mono">
                        Rec: {cA.receivedAt.slice(0, 10)} · Due: {cA.dueAt.slice(0, 10)}
                      </span>
                    </div>
                  </div>

                  {/* Central Linking Indicator (1 col) */}
                  <div className="lg:col-span-1 flex flex-row lg:flex-col items-center justify-center gap-2 py-2">
                    <div className="h-px lg:h-full w-full lg:w-px bg-[#B7E4B1]" />
                    <div className="w-10 h-10 rounded-full bg-[#EAF7E9] border-2 border-[#398653] flex items-center justify-center text-[#398653] shrink-0 shadow-xs">
                      <Link2 className="w-4 h-4" />
                    </div>
                    <div className="h-px lg:h-full w-full lg:w-px bg-[#B7E4B1]" />
                  </div>

                  {/* Case B Panel (5 cols) */}
                  <div className="lg:col-span-5 bg-[#F7FBF7] border border-[#DFEADF] rounded-xl p-4 flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => onOpenCase(cB.caseId)}
                          className="font-mono text-sm font-bold text-[#398653] hover:underline cursor-pointer"
                        >
                          {cB.caseId}
                        </button>
                        <StatusBadge status={cB.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 rounded bg-[#EAF7E9] text-[#203528] font-mono font-semibold">
                          Source: {cB.sourceBureau} → Current: {cB.currentBureau}
                        </span>
                        <PriorityLabel priority={cB.priority} />
                      </div>
                      <div className="text-sm font-bold text-[#203528]">{cB.category}</div>
                      <p className="text-xs text-[#203528] leading-relaxed">{cB.description}</p>
                    </div>

                    <div className="pt-2.5 border-t border-[#DFEADF] text-xs text-[#718173] flex flex-wrap items-center justify-between gap-2">
                      <span>Officer: {offB?.displayName || cB.assignedOfficerId}</span>
                      <span className="font-mono">
                        Rec: {cB.receivedAt.slice(0, 10)} · Due: {cB.dueAt.slice(0, 10)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Matching Reasons Presented as Small Readable Tags */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-[#203528]">Matching Signals:</span>
                    {alert.matchReasons.map((reason, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-md text-xs font-medium bg-[#EAF7E9] text-[#203528] border border-[#B7E4B1]"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setExpandedSignalAlertId(isExpanded ? null : alert.alertId)
                    }
                    className="text-xs font-semibold text-[#398653] hover:underline cursor-pointer"
                  >
                    {isExpanded ? 'Hide Score Breakdown' : 'Explain Score Calculation →'}
                  </button>
                </div>

                {/* Expandable Signal Breakdown */}
                {isExpanded && (
                  <div className="bg-[#F7FBF7] border border-[#DFEADF] rounded-xl p-4 space-y-2">
                    <div className="text-xs font-bold text-[#203528]">
                      Weighted Signal Contribution Breakdown
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                      {alert.signalBreakdown.map((sig, idx) => (
                        <div
                          key={idx}
                          className="bg-white border border-[#DFEADF] rounded-lg p-2.5 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between font-semibold text-[#203528]">
                            <span>{sig.signal}</span>
                            <span className="font-mono text-[#398653]">
                              +{sig.scoreContribution}/{sig.maxWeight}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#718173]">{sig.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Previous Review Audit Info if Reviewed */}
                {alert.reviewedBy && (
                  <div className="bg-[#EAF7E9]/60 border border-[#B7E4B1] rounded-lg p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-[#203528]">
                        Officer Decision: {alert.reviewOutcome}
                      </span>{' '}
                      — {alert.reviewRemarks}
                    </div>
                    <span className="font-mono text-[11px] text-[#718173]">
                      Reviewed by {alert.reviewedBy} on {alert.reviewedAt?.slice(0, 10)}
                    </span>
                  </div>
                )}

                {/* Officer Action Bar */}
                <div className="pt-3 border-t border-[#DFEADF] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onCreateOrOpenWorkspace(alert)}
                      className="px-4 py-2 rounded-lg bg-[#398653] text-white text-xs font-semibold hover:bg-[#2F7446] transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <FolderKanban className="w-3.5 h-3.5" />
                      <span>Create / Open Coordination Workspace</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setReviewingAlertId(isReviewing ? null : alert.alertId)
                      }
                      className="px-3.5 py-2 rounded-lg bg-[#EAF7E9] text-[#203528] border border-[#B7E4B1] hover:bg-[#d8f0d6] text-xs font-semibold cursor-pointer"
                    >
                      Record Review Decision
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onLinkCasesFromOverlap(alert.caseIds);
                        setFeedback({
                          type: 'success',
                          text: `Cases ${alert.caseIds[0]} and ${alert.caseIds[1]} cross-linked in Case Registry.`,
                        });
                      }}
                      className="px-3 py-2 rounded-lg bg-white border border-[#DFEADF] hover:bg-[#F7FBF7] text-xs font-semibold text-[#203528] cursor-pointer"
                    >
                      Link Cases
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenCase(cA.caseId)}
                      className="text-xs font-semibold text-[#398653] hover:underline cursor-pointer"
                    >
                      Inspect {cA.caseId}
                    </button>
                    <span className="text-[#DFEADF]">|</span>
                    <button
                      type="button"
                      onClick={() => onOpenCase(cB.caseId)}
                      className="text-xs font-semibold text-[#398653] hover:underline cursor-pointer"
                    >
                      Inspect {cB.caseId}
                    </button>
                    <span className="text-[#DFEADF]">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        onReviewOverlap(
                          alert.alertId,
                          'No Overlap',
                          'Alert dismissed after comparative scrutiny.',
                          true
                        );
                      }}
                      className="text-xs font-medium text-[#718173] hover:text-[#D9534F] cursor-pointer"
                    >
                      Dismiss Alert
                    </button>
                  </div>
                </div>

                {/* Explicit Officer Review Decision Panel */}
                {isReviewing && (
                  <div className="bg-[#EAF7E9] border border-[#B7E4B1] rounded-xl p-4 space-y-3">
                    <div className="text-xs font-bold text-[#203528]">
                      Record Official Overlap Determination (Logged with Officer Name & Timestamp)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {(
                        [
                          'Confirmed Duplicate',
                          'Related — Separate Issues',
                          'No Overlap',
                        ] as OverlapReviewOutcome[]
                      ).map((outcome) => (
                        <button
                          key={outcome}
                          type="button"
                          onClick={() => setSelectedOutcome(outcome)}
                          className={`p-2.5 rounded-lg border text-left text-xs font-semibold transition-colors cursor-pointer ${
                            selectedOutcome === outcome
                              ? 'bg-[#398653] text-white border-[#398653]'
                              : 'bg-white text-[#203528] border-[#DFEADF] hover:border-[#398653]'
                          }`}
                        >
                          {outcome}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={reviewRemarks}
                        onChange={(e) => setReviewRemarks(e.target.value)}
                        placeholder="Enter rationale for determination (e.g., RB examining cadre ratio while PGRC tracks individual salary arrears)..."
                        className="flex-1 px-3 py-2 text-xs bg-white border border-[#DFEADF] rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => handleConfirmReview(alert.alertId)}
                        className="px-4 py-2 rounded-lg bg-[#398653] text-white text-xs font-semibold hover:bg-[#2F7446] whitespace-nowrap cursor-pointer"
                      >
                        Save Review Outcome
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* False-Positive Prevention Guard Log */}
      <div className="bg-white border border-[#DFEADF] rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#EAF7E9] flex items-center justify-center text-[#398653]">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#203528]">
              False-Positive Prevention Log (Verified Distinct AICTE Permanent IDs)
            </h3>
            <p className="text-xs text-[#718173]">
              Cases involving similarly named institutions that were automatically excluded because their verified AICTE Permanent IDs differ
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {preventedFalsePositives.map((fp) => (
            <div
              key={fp.id}
              className="bg-[#F7FBF7] border border-[#DFEADF] rounded-lg p-3.5 text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-[#203528]">
                  {fp.caseIds[0]} vs {fp.caseIds[1]}
                </span>
                <span className="px-2 py-0.5 rounded bg-[#EAF7E9] text-[#2E8B57] font-semibold">
                  False Positive Prevented ({fp.nameSimilarityScore}% Name Sim)
                </span>
              </div>
              <div className="text-[#203528] font-medium">
                1. {fp.institutionNames[0]} (<span className="font-mono">{fp.permanentIds[0]}</span>)
              </div>
              <div className="text-[#203528] font-medium">
                2. {fp.institutionNames[1]} (<span className="font-mono">{fp.permanentIds[1]}</span>)
              </div>
              <p className="text-[11px] text-[#718173]">{fp.reasonPrevented}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
