import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  CheckSquare,
  FileText,
  FolderKanban,
  MessageSquarePlus,
  Plus,
  ShieldAlert,
  Square,
  Users,
} from 'lucide-react';
import {
  BureauCode,
  CasePriority,
  CaseRecord,
  CoordinationStatus,
  CoordinationWorkspace,
  Institution,
  UserProfile,
} from '../types/domain';
import { checkPermission } from '../utils/engine';
import { PriorityLabel, StatusBadge } from './BadgeHelpers';

interface CoordinationWorkspaceViewProps {
  workspaces: CoordinationWorkspace[];
  selectedWorkspaceId: string;
  cases: CaseRecord[];
  institutions: Institution[];
  users: UserProfile[];
  currentUser: UserProfile;
  onSelectWorkspace: (workspaceId: string) => void;
  onUpdateWorkspaceStatus: (workspaceId: string, newStatus: CoordinationStatus) => void;
  onToggleActionItem: (workspaceId: string, itemId: string) => void;
  onAddActionItem: (
    workspaceId: string,
    title: string,
    assignedBureau: BureauCode,
    assignedOfficerId: string,
    dueDate: string
  ) => void;
  onAddWorkspaceNote: (workspaceId: string, content: string) => void;
  onEscalateWorkspace: (workspaceId: string, authority: string, note: string) => void;
  onCreateWorkspace: (payload: {
    title: string;
    institutionId: string;
    relatedCaseIds: string[];
    leadBureau: BureauCode;
    coordinatorId: string;
    priority: CasePriority;
    reviewDeadline: string;
  }) => void;
  onOpenCase: (caseId: string) => void;
  onOpenInstitution: (institutionId: string) => void;
}

const BUREAUS: BureauCode[] = ['RB', 'PGRC', 'AB', 'VIG', 'RO-SC', 'RO-N', 'RO-W', 'RO-S'];

export const CoordinationWorkspaceView: React.FC<CoordinationWorkspaceViewProps> = ({
  workspaces,
  selectedWorkspaceId,
  cases,
  institutions,
  users,
  currentUser,
  onSelectWorkspace,
  onUpdateWorkspaceStatus,
  onToggleActionItem,
  onAddActionItem,
  onAddWorkspaceNote,
  onEscalateWorkspace,
  onCreateWorkspace,
  onOpenCase,
  onOpenInstitution,
}) => {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskBureau, setNewTaskBureau] = useState<BureauCode>('RB');
  const [newTaskOfficer, setNewTaskOfficer] = useState('USR-CO-RB1');
  const [newTaskDue, setNewTaskDue] = useState('2026-11-04');

  const [noteInput, setNoteInput] = useState('');
  const [escalateTarget, setEscalateTarget] = useState(
    'Chairman / Standing Hearing Committee (SHC)'
  );
  const [escalateReason, setEscalateReason] = useState('');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [wsTitle, setWsTitle] = useState('');
  const [wsInstId, setWsInstId] = useState(institutions[0]?.institutionId || 'INST-1001');
  const [wsLeadBureau, setWsLeadBureau] = useState<BureauCode>('RB');
  const [wsCoordinatorId, setWsCoordinatorId] = useState('USR-BA-RB');
  const [wsPriority, setWsPriority] = useState<CasePriority>('High');
  const [wsDeadline, setWsDeadline] = useState('2026-11-05');
  const [wsSelectedCases, setWsSelectedCases] = useState<string[]>([
    'AICTE-2026-0805',
    'AICTE-2026-0806',
  ]);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const currentWs = useMemo(
    () =>
      workspaces.find((w) => w.workspaceId === selectedWorkspaceId) || workspaces[0],
    [workspaces, selectedWorkspaceId]
  );

  const caseMap = useMemo(() => new Map(cases.map((c) => [c.caseId, c])), [cases]);
  const instMap = useMemo(() => new Map(institutions.map((i) => [i.institutionId, i])), [institutions]);
  const userMap = useMemo(() => new Map(users.map((u) => [u.userId, u])), [users]);

  if (!currentWs) {
    return (
      <div className="p-8 bg-white border border-[#DFEADF] rounded-xl text-center text-sm text-[#718173]">
        No Coordination Workspaces found.
      </div>
    );
  }

  const inst = instMap.get(currentWs.institutionId);
  const coordinator = userMap.get(currentWs.coordinatorId);
  const linkedCases = currentWs.relatedCaseIds
    .map((id) => caseMap.get(id))
    .filter((c): c is CaseRecord => Boolean(c));

  return (
    <div className="space-y-6">
      {/* Top Workspace Selector & Create Button */}
      <div className="bg-white border border-[#DFEADF] rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#203528]">
            Inter-Bureau Coordination Workspace ({workspaces.length} Active)
          </h2>
          <p className="text-xs text-[#718173]">
            Shared operational space for parallel complaints. Each linked case retains independent Bureau ownership and status history; completing a workspace never auto-disposes individual complaints.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={currentWs.workspaceId}
            onChange={(e) => onSelectWorkspace(e.target.value)}
            aria-label="Select Coordination Workspace"
            className="px-3 py-2 text-xs font-semibold bg-[#EAF7E9] border border-[#B7E4B1] rounded-lg text-[#203528]"
          >
            {workspaces.map((w) => (
              <option key={w.workspaceId} value={w.workspaceId}>
                {w.workspaceId}: {w.title.slice(0, 58)} ({w.status})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowCreateForm((v) => !v)}
            className="px-4 py-2 rounded-lg bg-[#398653] text-white text-xs font-semibold hover:bg-[#2F7446] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Coordination Workspace</span>
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

      {/* Create New Coordination Workspace Form */}
      {showCreateForm && (
        <div className="bg-[#EAF7E9] border border-[#B7E4B1] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#203528]">
              Create New Inter-Bureau Coordination Workspace
            </h3>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="text-xs text-[#718173] hover:text-[#203528] cursor-pointer"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#203528] mb-1">
                Workspace Title
              </label>
              <input
                type="text"
                value={wsTitle}
                onChange={(e) => setWsTitle(e.target.value)}
                placeholder="e.g., Sahyadri College Pune — Joint AB & RB Unapproved Intake Inquiry"
                className="w-full px-3 py-1.5 text-xs bg-white border border-[#DFEADF] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#203528] mb-1">
                Target Institution
              </label>
              <select
                value={wsInstId}
                onChange={(e) => setWsInstId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-[#DFEADF] rounded-lg"
              >
                {institutions.map((i) => (
                  <option key={i.institutionId} value={i.institutionId}>
                    {i.name} ({i.permanentId})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#203528] mb-1">
                Designated Lead Bureau
              </label>
              <select
                value={wsLeadBureau}
                onChange={(e) => setWsLeadBureau(e.target.value as BureauCode)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-[#DFEADF] rounded-lg"
              >
                {BUREAUS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#203528] mb-1">
                Coordinating Officer
              </label>
              <select
                value={wsCoordinatorId}
                onChange={(e) => setWsCoordinatorId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-[#DFEADF] rounded-lg"
              >
                {users.map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.displayName} ({u.bureau})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#203528] mb-1">
                Review Deadline
              </label>
              <input
                type="date"
                value={wsDeadline}
                onChange={(e) => setWsDeadline(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-[#DFEADF] rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#203528] mb-1">
              Select Cases to Link (Choose 2 or more)
            </label>
            <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto p-2 bg-white border border-[#DFEADF] rounded-lg">
              {cases.map((c) => {
                const checked = wsSelectedCases.includes(c.caseId);
                return (
                  <label
                    key={c.caseId}
                    className={`px-2.5 py-1 rounded text-xs font-mono cursor-pointer border ${
                      checked
                        ? 'bg-[#EAF7E9] border-[#398653] text-[#203528] font-bold'
                        : 'bg-[#F7FBF7] border-[#DFEADF] text-[#718173]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setWsSelectedCases((prev) => [...prev, c.caseId]);
                        } else {
                          setWsSelectedCases((prev) => prev.filter((id) => id !== c.caseId));
                        }
                      }}
                      className="mr-1.5 accent-[#398653]"
                    />
                    {c.caseId} ({c.currentBureau})
                  </label>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!wsTitle.trim() || wsSelectedCases.length < 2) {
                setFeedback({
                  type: 'error',
                  text: 'Please provide a workspace title and select at least 2 cases to coordinate.',
                });
                return;
              }
              onCreateWorkspace({
                title: wsTitle.trim(),
                institutionId: wsInstId,
                relatedCaseIds: wsSelectedCases,
                leadBureau: wsLeadBureau,
                coordinatorId: wsCoordinatorId,
                priority: wsPriority,
                reviewDeadline: `${wsDeadline}T17:00:00Z`,
              });
              setShowCreateForm(false);
              setWsTitle('');
              setFeedback({
                type: 'success',
                text: 'Created new Inter-Bureau Coordination Workspace.',
              });
            }}
            className="px-4 py-2 rounded-lg bg-[#398653] text-white text-xs font-semibold hover:bg-[#2F7446] cursor-pointer"
          >
            Create Workspace
          </button>
        </div>
      )}

      {/* Active Workspace Header */}
      <div className="bg-[#EAF7E9] border border-[#B7E4B1] rounded-xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-sm font-bold text-[#398653]">
                {currentWs.workspaceId}
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-white border border-[#B7E4B1] text-xs font-bold text-[#203528]">
                Lead Bureau: {currentWs.leadBureau}
              </span>
              <PriorityLabel priority={currentWs.priority} />
              {currentWs.escalatedTo && (
                <span className="px-2.5 py-0.5 rounded-md bg-[#FDEDEC] text-[#B8322E] border border-[#F5B7B1] text-xs font-semibold">
                  Escalated to: {currentWs.escalatedTo}
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-[#203528]">{currentWs.title}</h3>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#203528]/80">
              <button
                type="button"
                onClick={() => inst && onOpenInstitution(inst.institutionId)}
                className="font-semibold hover:text-[#398653] underline cursor-pointer"
              >
                {inst?.name} (PID: {inst?.permanentId})
              </button>
              <span>·</span>
              <span>
                Coordinating Officer: <strong>{coordinator?.displayName}</strong>
              </span>
              <span>·</span>
              <span className="font-mono">
                Review Due: {currentWs.reviewDeadline.slice(0, 10)}
              </span>
            </div>
          </div>

          {/* Coordination Status Control */}
          <div className="flex flex-wrap items-center gap-2 bg-white border border-[#DFEADF] rounded-xl p-2.5">
            <span className="text-xs font-semibold text-[#718173] px-1">Workspace Status:</span>
            {(['Open', 'In Review', 'Action Agreed', 'Completed'] as CoordinationStatus[]).map(
              (st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    onUpdateWorkspaceStatus(currentWs.workspaceId, st);
                    setFeedback({
                      type: 'success',
                      text: `Updated workspace ${currentWs.workspaceId} status to "${st}". Linked cases remain independently traceable.`,
                    });
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    currentWs.status === st
                      ? 'bg-[#398653] text-white'
                      : 'bg-[#F7FBF7] text-[#203528] hover:bg-[#EAF7E9]'
                  }`}
                >
                  {st}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Linked Cases with Independent Status Histories */}
      <div className="bg-white border border-[#DFEADF] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-[#203528]">
              Linked Complaints (Independent Bureau Ownership & Status Histories)
            </h4>
            <p className="text-xs text-[#718173]">
              Records are never merged or overwritten; each Bureau maintains statutory custody of its docket.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {linkedCases.map((c) => {
            const off = userMap.get(c.assignedOfficerId);
            return (
              <div
                key={c.caseId}
                className="bg-[#F7FBF7] border border-[#DFEADF] rounded-xl p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenCase(c.caseId)}
                      className="font-mono text-sm font-bold text-[#398653] hover:underline cursor-pointer"
                    >
                      {c.caseId}
                    </button>
                    <span className="px-2 py-0.5 rounded bg-[#EAF7E9] text-[#203528] font-mono text-xs font-bold">
                      Owner: {c.currentBureau}
                    </span>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                <div className="text-xs font-bold text-[#203528]">{c.category}</div>
                <p className="text-xs text-[#203528]">{c.description}</p>
                <div className="pt-2 border-t border-[#DFEADF] flex items-center justify-between text-xs text-[#718173]">
                  <span>Officer: {off?.displayName}</span>
                  <span className="font-mono">SLA Due: {c.dueAt.slice(0, 10)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Items & Coordination Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Joint Action-Item Checklist */}
        <div className="bg-white border border-[#DFEADF] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#203528]">
              Joint Inter-Bureau Action Items ({currentWs.actionItems.length})
            </h4>
            <span className="text-xs font-mono text-[#398653]">
              {currentWs.actionItems.filter((i) => i.completed).length}/
              {currentWs.actionItems.length} Completed
            </span>
          </div>

          <div className="space-y-2.5">
            {currentWs.actionItems.map((item) => {
              const off = userMap.get(item.assignedOfficerId);
              return (
                <div
                  key={item.itemId}
                  onClick={() => onToggleActionItem(currentWs.workspaceId, item.itemId)}
                  className={`p-3 rounded-lg border flex items-start gap-3 cursor-pointer transition-colors ${
                    item.completed
                      ? 'bg-[#EAF7E9]/40 border-[#B7E4B1]'
                      : 'bg-[#F7FBF7] border-[#DFEADF] hover:border-[#398653]'
                  }`}
                >
                  <button
                    type="button"
                    aria-label={`Toggle action item ${item.title}`}
                    className="mt-0.5 text-[#398653]"
                  >
                    {item.completed ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                  <div className="flex-1 text-xs">
                    <div
                      className={`font-semibold ${
                        item.completed ? 'line-through text-[#718173]' : 'text-[#203528]'
                      }`}
                    >
                      {item.title}
                    </div>
                    <div className="text-[11px] text-[#718173] font-mono mt-1">
                      Bureau: {item.assignedBureau} · Officer: {off?.displayName} · Due:{' '}
                      {item.dueDate}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Action Item Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newTaskTitle.trim()) return;
              onAddActionItem(
                currentWs.workspaceId,
                newTaskTitle.trim(),
                newTaskBureau,
                newTaskOfficer,
                newTaskDue
              );
              setNewTaskTitle('');
            }}
            className="pt-3 border-t border-[#DFEADF] space-y-2.5"
          >
            <div className="text-xs font-bold text-[#203528]">Assign New Action Item</div>
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Action item description..."
              className="w-full px-3 py-1.5 text-xs border border-[#DFEADF] rounded-lg"
            />
            <div className="grid grid-cols-3 gap-2">
              <select
                value={newTaskBureau}
                onChange={(e) => setNewTaskBureau(e.target.value as BureauCode)}
                className="px-2 py-1.5 text-xs border border-[#DFEADF] rounded-lg bg-white"
              >
                {BUREAUS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <select
                value={newTaskOfficer}
                onChange={(e) => setNewTaskOfficer(e.target.value)}
                className="px-2 py-1.5 text-xs border border-[#DFEADF] rounded-lg bg-white"
              >
                {users.map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.displayName}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={newTaskDue}
                onChange={(e) => setNewTaskDue(e.target.value)}
                className="px-2 py-1.5 text-xs border border-[#DFEADF] rounded-lg"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-[#398653] text-white text-xs font-semibold hover:bg-[#2F7446] cursor-pointer"
            >
              Add Action Item
            </button>
          </form>
        </div>

        {/* Right: Coordination Notes, Supporting Docs & Escalation */}
        <div className="space-y-5">
          <div className="bg-white border border-[#DFEADF] rounded-xl p-5 space-y-4">
            <h4 className="text-sm font-bold text-[#203528]">
              Internal Inter-Bureau Coordination Notes & Activity Log
            </h4>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {currentWs.notes.map((n) => {
                const author = userMap.get(n.authorId);
                return (
                  <div
                    key={n.noteId}
                    className="bg-[#F7FBF7] border border-[#DFEADF] rounded-lg p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#203528]">
                        {author?.displayName || n.authorId}{' '}
                        <span className="font-mono text-[#398653]">({n.bureau})</span>
                      </span>
                      <span className="font-mono text-[11px] text-[#718173]">
                        {n.timestamp.slice(0, 16).replace('T', ' ')}
                      </span>
                    </div>
                    <p className="text-[#203528] leading-relaxed">{n.content}</p>
                  </div>
                );
              })}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!noteInput.trim()) return;
                onAddWorkspaceNote(currentWs.workspaceId, noteInput.trim());
                setNoteInput('');
              }}
              className="flex gap-2 pt-2 border-t border-[#DFEADF]"
            >
              <input
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Post coordination remark to linked Bureaus..."
                className="flex-1 px-3 py-1.5 text-xs border border-[#DFEADF] rounded-lg"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-[#398653] text-white text-xs font-semibold hover:bg-[#2F7446] whitespace-nowrap cursor-pointer"
              >
                Post Note
              </button>
            </form>
          </div>

          {/* Supporting Docs & Competent Authority Escalation */}
          <div className="bg-white border border-[#DFEADF] rounded-xl p-5 space-y-4">
            <div>
              <h4 className="text-xs font-bold text-[#203528] mb-2">
                Shared Supporting Document References
              </h4>
              <div className="space-y-1.5">
                {currentWs.supportingDocs.map((doc, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-1.5 rounded bg-[#F7FBF7] border border-[#DFEADF] text-xs font-mono text-[#203528] flex items-center gap-2"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#398653] shrink-0" />
                    <span>{doc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-[#DFEADF] space-y-2">
              <div className="text-xs font-bold text-[#B8322E]">
                Escalate Workspace to Competent Authority
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={escalateTarget}
                  onChange={(e) => setEscalateTarget(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-xs border border-[#DFEADF] rounded-lg"
                />
                <input
                  type="text"
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                  placeholder="Escalation brief..."
                  className="flex-1 px-2.5 py-1.5 text-xs border border-[#DFEADF] rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    const perm = checkPermission(currentUser, 'ESCALATE_CASE');
                    if (!perm.allowed) {
                      setFeedback({ type: 'error', text: perm.reason || 'Permission denied.' });
                      return;
                    }
                    onEscalateWorkspace(
                      currentWs.workspaceId,
                      escalateTarget,
                      escalateReason.trim() || 'Referred for joint statutory hearing'
                    );
                    setEscalateReason('');
                    setFeedback({
                      type: 'success',
                      text: `Workspace ${currentWs.workspaceId} escalated to ${escalateTarget}.`,
                    });
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-[#FDEDEC] text-[#B8322E] border border-[#F5B7B1] text-xs font-semibold hover:bg-[#fadbd8] whitespace-nowrap cursor-pointer"
                >
                  Escalate
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
