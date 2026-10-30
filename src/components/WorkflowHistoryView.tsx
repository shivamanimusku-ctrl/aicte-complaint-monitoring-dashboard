import React, { useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Calendar,
  CheckCircle2,
  FileText,
  Filter,
  Lock,
  Search,
} from 'lucide-react';
import {
  ActionType,
  BureauCode,
  CaseAction,
  CaseRecord,
  Institution,
  UserProfile,
} from '../types/domain';
import { checkPermission } from '../utils/engine';

interface WorkflowHistoryViewProps {
  actions: CaseAction[];
  cases: CaseRecord[];
  institutions: Institution[];
  users: UserProfile[];
  currentUser: UserProfile;
  onAcceptTransfer: (caseId: string, remarks: string) => void;
  onOpenCase: (caseId: string) => void;
}

const ACTION_TYPES: ActionType[] = [
  'Complaint Received',
  'Case Assigned',
  'Action Recorded',
  'Status Changed',
  'Officer Reassigned',
  'Bureau Transfer Initiated',
  'Bureau Transfer Accepted',
  'Deadline Updated',
  'Escalation Initiated',
  'Escalation Resolved',
  'Cases Linked',
  'Cases Unlinked',
  'Disposal Proposed',
  'Disposal Approved',
  'Disposal Rejected',
];

export const WorkflowHistoryView: React.FC<WorkflowHistoryViewProps> = ({
  actions,
  cases,
  institutions,
  users,
  currentUser,
  onAcceptTransfer,
  onOpenCase,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActionType, setSelectedActionType] = useState<string>('ALL');
  const [selectedBureau, setSelectedBureau] = useState<string>('ALL');
  const [feedback, setFeedback] = useState<string | null>(null);

  const userMap = useMemo(() => new Map(users.map((u) => [u.userId, u])), [users]);
  const caseMap = useMemo(() => new Map(cases.map((c) => [c.caseId, c])), [cases]);
  const instMap = useMemo(() => new Map(institutions.map((i) => [i.institutionId, i])), [institutions]);

  const pendingTransfers = useMemo(
    () => cases.filter((c) => Boolean(c.pendingTransferToBureau)),
    [cases]
  );

  const filteredActions = useMemo(() => {
    return [...actions]
      .filter((a) => {
        if (selectedActionType !== 'ALL' && a.actionType !== selectedActionType) return false;
        if (selectedBureau !== 'ALL' && a.bureau !== selectedBureau) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          if (
            !a.caseId.toLowerCase().includes(q) &&
            !a.remarks.toLowerCase().includes(q) &&
            !a.actionType.toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [actions, selectedActionType, selectedBureau, searchQuery]);

  const canViewConfidential = checkPermission(currentUser, 'VIEW_CONFIDENTIAL_REMARKS').allowed;

  return (
    <div className="space-y-6">
      {/* Pending Inter-Bureau Transfers Queue */}
      <div className="bg-white border border-[#DFEADF] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EAF7E9] flex items-center justify-center text-[#398653]">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#203528]">
                Pending Inter-Bureau Transfers Awaiting Acceptance ({pendingTransfers.length})
              </h2>
              <p className="text-xs text-[#718173]">
                Transfers record sending Bureau, receiving Bureau, assigned officer, reason, and acceptance timestamp in the immutable case timeline.
              </p>
            </div>
          </div>
        </div>

        {feedback && (
          <div className="p-3 rounded-lg bg-[#EAF7E9] border border-[#B7E4B1] text-xs font-semibold text-[#203528]">
            {feedback}
          </div>
        )}

        {pendingTransfers.length === 0 ? (
          <div className="p-4 rounded-lg bg-[#F7FBF7] border border-[#DFEADF] text-xs text-[#718173]">
            All initiated inter-bureau transfers have been accepted.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingTransfers.map((c) => {
              const inst = instMap.get(c.institutionId);
              const targetOfficer = userMap.get(c.pendingTransferOfficerId || '');
              return (
                <div
                  key={c.caseId}
                  className="bg-[#F7FBF7] border border-[#DFEADF] rounded-xl p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => onOpenCase(c.caseId)}
                        className="font-mono text-sm font-bold text-[#398653] hover:underline cursor-pointer"
                      >
                        {c.caseId}
                      </button>
                      <span className="px-2.5 py-0.5 rounded bg-[#F3EEFA] text-[#5E3A8C] border border-[#D8C7F0] text-xs font-mono font-semibold">
                        {c.currentBureau} → {c.pendingTransferToBureau}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-[#203528]">
                      {c.reportedInstitutionName || inst?.name} ({c.category})
                    </div>
                    <p className="text-xs text-[#718173]">
                      Transfer Reason: {c.pendingTransferReason}
                    </p>
                    <div className="text-[11px] text-[#203528]">
                      Designated Receiving Officer:{' '}
                      <strong>{targetOfficer?.displayName || c.pendingTransferOfficerId}</strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DFEADF]">
                    <button
                      type="button"
                      onClick={() => onOpenCase(c.caseId)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-[#DFEADF] text-xs font-semibold text-[#203528] cursor-pointer"
                    >
                      Inspect Docket
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const perm = checkPermission(currentUser, 'ACCEPT_TRANSFER', c);
                        if (!perm.allowed) {
                          setFeedback(perm.reason || 'Role not permitted to accept transfers.');
                          return;
                        }
                        onAcceptTransfer(
                          c.caseId,
                          `Inter-Bureau transfer formally accepted by ${currentUser.displayName} (${c.pendingTransferToBureau}).`
                        );
                        setFeedback(
                          `Accepted transfer of ${c.caseId} to ${c.pendingTransferToBureau}.`
                        );
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-[#398653] text-white text-xs font-semibold hover:bg-[#2F7446] cursor-pointer"
                    >
                      Accept Transfer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Append-Only Global Audit & Action History */}
      <div className="bg-white border border-[#DFEADF] rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-[#203528]">
              Master Chronological Workflow & Action History ({filteredActions.length} entries)
            </h3>
            <p className="text-xs text-[#718173]">
              Append-only audit log capturing acting officer, Bureau, timestamp, state transition, and document references
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#718173] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Case ID or remarks..."
                className="pl-8 pr-3 py-1.5 text-xs border border-[#DFEADF] rounded-lg"
              />
            </div>

            <select
              value={selectedActionType}
              onChange={(e) => setSelectedActionType(e.target.value)}
              aria-label="Filter by Action Type"
              className="px-2.5 py-1.5 text-xs border border-[#DFEADF] rounded-lg bg-white"
            >
              <option value="ALL">All Action Types</option>
              {ACTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <select
              value={selectedBureau}
              onChange={(e) => setSelectedBureau(e.target.value)}
              aria-label="Filter Audit Log by Bureau"
              className="px-2.5 py-1.5 text-xs border border-[#DFEADF] rounded-lg bg-white"
            >
              <option value="ALL">All Bureaus</option>
              {(['RB', 'PGRC', 'AB', 'VIG', 'RO-SC', 'RO-N', 'RO-W', 'RO-S'] as BureauCode[]).map(
                (b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        <div className="relative pl-6 border-l-2 border-[#B7E4B1] space-y-4 pt-2">
          {filteredActions.map((act) => {
            const actor = userMap.get(act.actorId);
            const c = caseMap.get(act.caseId);
            const inst = c ? instMap.get(c.institutionId) : undefined;
            const isMasked = act.confidential && !canViewConfidential;

            return (
              <div key={act.actionId} className="relative">
                <div className="w-3.5 h-3.5 rounded-full bg-[#398653] border-2 border-white absolute -left-[31px] top-1.5" />
                <div className="bg-[#F7FBF7] border border-[#DFEADF] rounded-xl p-4 text-xs space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenCase(act.caseId)}
                        className="font-mono font-bold text-[#398653] hover:underline cursor-pointer"
                      >
                        {act.caseId}
                      </button>
                      <span className="px-2 py-0.5 rounded bg-[#EAF7E9] text-[#203528] font-semibold">
                        {act.actionType}
                      </span>
                      <span className="font-mono text-[#398653] font-semibold">
                        [{act.bureau}]
                      </span>
                      {inst && <span className="text-[#718173]">· {inst.name}</span>}
                    </div>
                    <span className="font-mono text-[#718173]">
                      {act.timestamp.replace('T', ' ').slice(0, 16)} UTC · {act.actionId}
                    </span>
                  </div>

                  {(act.previousValue || act.newValue) && (
                    <div className="font-mono text-xs text-[#398653]">
                      Transition: {act.previousValue ? `${act.previousValue} → ` : ''}
                      <strong>{act.newValue}</strong>
                    </div>
                  )}

                  {isMasked ? (
                    <div className="text-[#718173] italic flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-[#D99A25]" />
                      <span>[Confidential remark masked for current role]</span>
                    </div>
                  ) : (
                    <p className="text-[#203528]">{act.remarks}</p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[#718173]">
                    <span>
                      Recorded by: <strong className="text-[#203528]">{actor?.displayName || act.actorId}</strong> ({actor?.designation || 'Official'})
                    </span>
                    {act.documentReferences.length > 0 && (
                      <span className="font-mono text-[#398653]">
                        Documents: {act.documentReferences.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
