import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Eye,
  FileText,
  GitCompare,
  Layers,
  MapPin,
  Paperclip,
  Search,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CaseAction,
  CaseRecord,
  CoordinationWorkspace,
  Institution,
  OverlapAlert,
  RiskLevel,
  SLAPolicyConfig,
  UserProfile,
} from '../types/domain';
import { evaluateCaseSLA } from '../utils/engine';
import { PriorityLabel, RiskBadge, StatusBadge } from './BadgeHelpers';

interface Institution360ViewProps {
  institutions: Institution[];
  selectedInstitutionId: string;
  cases: CaseRecord[];
  actions: CaseAction[];
  overlapAlerts: OverlapAlert[];
  workspaces: CoordinationWorkspace[];
  users: UserProfile[];
  slaPolicy: SLAPolicyConfig;
  referenceDate: Date;
  onSelectInstitution: (institutionId: string) => void;
  onOpenCase: (caseId: string) => void;
  onOpenWorkspace: (workspaceId: string) => void;
}

export const Institution360View: React.FC<Institution360ViewProps> = ({
  institutions,
  selectedInstitutionId,
  cases,
  actions,
  overlapAlerts,
  workspaces,
  users,
  slaPolicy,
  referenceDate,
  onSelectInstitution,
  onOpenCase,
  onOpenWorkspace,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<
    'overview' | 'complaints' | 'cross-bureau' | 'timeline' | 'documents' | 'analytics'
  >('overview');

  const filteredInstitutions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return institutions;
    return institutions.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.permanentId.toLowerCase().includes(q) ||
        i.state.toLowerCase().includes(q) ||
        i.region.toLowerCase().includes(q)
    );
  }, [institutions, searchTerm]);

  const currentInst = useMemo(
    () =>
      institutions.find((i) => i.institutionId === selectedInstitutionId) ||
      institutions[0],
    [institutions, selectedInstitutionId]
  );

  const instCases = useMemo(
    () =>
      cases
        .filter((c) => c.institutionId === currentInst.institutionId)
        .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()),
    [cases, currentInst.institutionId]
  );

  const instCaseIds = useMemo(() => new Set(instCases.map((c) => c.caseId)), [instCases]);

  const instActions = useMemo(
    () =>
      actions
        .filter((a) => instCaseIds.has(a.caseId))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [actions, instCaseIds]
  );

  const instOverlaps = useMemo(
    () => overlapAlerts.filter((o) => o.institutionId === currentInst.institutionId),
    [overlapAlerts, currentInst.institutionId]
  );

  const instWorkspaces = useMemo(
    () => workspaces.filter((w) => w.institutionId === currentInst.institutionId),
    [workspaces, currentInst.institutionId]
  );

  const userMap = useMemo(() => new Map(users.map((u) => [u.userId, u])), [users]);

  const stats = useMemo(() => {
    let active = 0;
    let disposed = 0;
    let overdue = 0;
    const bureausSet = new Set<string>();

    for (const c of instCases) {
      bureausSet.add(c.currentBureau);
      if (c.status === 'Disposed') {
        disposed++;
      } else {
        active++;
        const ev = evaluateCaseSLA(c, referenceDate, slaPolicy);
        if (ev.isOverdue) overdue++;
      }
    }

    let overallRisk: RiskLevel = 'Low';
    if (overdue > 0 || instOverlaps.some((o) => o.riskLevel === 'High')) {
      overallRisk = 'High';
    } else if (active >= 2 || instOverlaps.length > 0) {
      overallRisk = 'Medium';
    }

    return {
      total: instCases.length,
      active,
      disposed,
      overdue,
      bureausCount: bureausSet.size,
      overallRisk,
    };
  }, [instCases, instOverlaps, referenceDate, slaPolicy]);

  const allDocuments = useMemo(() => {
    return instCases.flatMap((c) =>
      c.documents.map((d) => ({
        ...d,
        caseId: c.caseId,
        category: c.category,
      }))
    );
  }, [instCases]);

  const categoryChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of instCases) {
      counts[c.category] = (counts[c.category] || 0) + 1;
    }
    return Object.entries(counts).map(([cat, count]) => ({
      category: cat.length > 26 ? cat.slice(0, 26) + '...' : cat,
      cases: count,
    }));
  }, [instCases]);

  return (
    <div className="space-y-5">
      {/* Institution Selector Bar */}
      <div className="bg-white border border-[#DFEADF] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#718173] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter institution directory by name, AICTE Permanent ID, or state..."
            aria-label="Search institution directory"
            className="w-full pl-9 pr-3 py-2 text-xs border border-[#DFEADF] rounded-lg bg-[#F7FBF7] focus:bg-white focus:outline-none focus:border-[#398653]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
          <span className="text-xs font-semibold text-[#718173] whitespace-nowrap">
            Select Institution:
          </span>
          <select
            value={currentInst.institutionId}
            onChange={(e) => onSelectInstitution(e.target.value)}
            aria-label="Select Institution Profile"
            className="px-3 py-2 text-xs font-semibold border border-[#B7E4B1] rounded-lg bg-[#EAF7E9] text-[#203528] focus:outline-none focus:border-[#398653]"
          >
            {filteredInstitutions.map((inst) => (
              <option key={inst.institutionId} value={inst.institutionId}>
                {inst.name} ({inst.permanentId}) — {inst.state}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Polished Administrative Record Header (Pale-Green Background #EAF7E9) */}
      <div className="bg-[#EAF7E9] border border-[#B7E4B1] rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-md bg-white border border-[#B7E4B1] font-mono text-xs font-bold text-[#398653]">
                AICTE Permanent ID: {currentInst.permanentId}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-white border border-[#DFEADF] text-xs font-semibold text-[#203528]">
                {currentInst.institutionType}
              </span>
              <RiskBadge level={stats.overallRisk} />
            </div>

            <h2 className="text-xl font-bold text-[#203528]">{currentInst.name}</h2>

            <div className="flex flex-wrap items-center gap-3 text-xs text-[#203528]/80">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#398653]" />
                <span>{currentInst.address}</span>
              </span>
              <span>·</span>
              <span className="font-semibold">
                State: {currentInst.state} ({currentInst.region} Region)
              </span>
              <span>·</span>
              <span className="font-mono text-[#718173]">
                Normalized Key: "{currentInst.normalizedName}"
              </span>
            </div>
          </div>

          {/* Key Statistics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
            <div className="bg-white border border-[#DFEADF] rounded-lg px-4 py-2.5 text-center">
              <div className="text-xl font-bold text-[#203528] font-mono tabular-nums">
                {stats.total}
              </div>
              <div className="text-[11px] font-semibold text-[#718173]">Total Complaints</div>
            </div>
            <div className="bg-white border border-[#DFEADF] rounded-lg px-4 py-2.5 text-center">
              <div className="text-xl font-bold text-[#398653] font-mono tabular-nums">
                {stats.active}
              </div>
              <div className="text-[11px] font-semibold text-[#718173]">Active Cases</div>
            </div>
            <div className="bg-white border border-[#DFEADF] rounded-lg px-4 py-2.5 text-center">
              <div className="text-xl font-bold text-[#2E8B57] font-mono tabular-nums">
                {stats.disposed}
              </div>
              <div className="text-[11px] font-semibold text-[#718173]">Disposed</div>
            </div>
            <div className="bg-white border border-[#DFEADF] rounded-lg px-4 py-2.5 text-center">
              <div
                className={`text-xl font-bold font-mono tabular-nums ${
                  stats.overdue > 0 ? 'text-[#D9534F]' : 'text-[#203528]'
                }`}
              >
                {stats.overdue}
              </div>
              <div className="text-[11px] font-semibold text-[#718173]">Overdue</div>
            </div>
          </div>
        </div>

        {/* Transparent, Non-Punitive Risk Indicator Explanation */}
        <div className="bg-white/90 border border-[#DFEADF] rounded-lg px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-[#203528]">
            <TrendingUp className="w-4 h-4 text-[#398653] shrink-0" />
            <span>
              <strong>Transparent Risk Basis:</strong> Indicator is derived strictly from active case volume ({stats.active}), overdue SLA count ({stats.overdue}), and cross-bureau overlap flags ({instOverlaps.length}). It serves purely for internal coordination prioritization and is not a punitive statutory rating.
            </span>
          </div>
          <span className="font-mono text-[11px] text-[#718173] whitespace-nowrap">
            Active across {stats.bureausCount} Bureau(s)
          </span>
        </div>
      </div>

      {/* 6 Profile Tabs */}
      <div className="bg-white border border-[#DFEADF] rounded-xl overflow-hidden">
        <div className="flex items-center gap-1 px-4 pt-2 border-b border-[#DFEADF] overflow-x-auto bg-[#F7FBF7]">
          {[
            { id: 'overview', label: 'Overview (Multi-Bureau Active)' },
            { id: 'complaints', label: `All Complaints (${instCases.length})` },
            { id: 'cross-bureau', label: `Cross-Bureau Activity (${instWorkspaces.length})` },
            { id: 'timeline', label: `Action Timeline (${instActions.length})` },
            { id: 'documents', label: `Documents (${allDocuments.length})` },
            { id: 'analytics', label: 'Analytics & Risk Trends' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-[#398653] text-[#398653] bg-white rounded-t-lg'
                    : 'border-transparent text-[#718173] hover:text-[#203528]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-[#203528] mb-1">
                  Consolidated Active Cases Across All Bureaus (RB, PGRC, AB, VIG, Regional Offices)
                </h3>
                <p className="text-xs text-[#718173] mb-4">
                  Unified view enabling officers to see every active complaint concerning {currentInst.name} before issuing notices.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {instCases.filter((c) => c.status !== 'Disposed').length === 0 ? (
                    <div className="col-span-2 p-6 rounded-xl bg-[#F7FBF7] border border-[#DFEADF] text-center text-xs text-[#718173]">
                      No active pending or under-process complaints for this institution. All historical complaints are disposed.
                    </div>
                  ) : (
                    instCases
                      .filter((c) => c.status !== 'Disposed')
                      .map((c) => {
                        const ev = evaluateCaseSLA(c, referenceDate, slaPolicy);
                        const officer = userMap.get(c.assignedOfficerId);
                        return (
                          <div
                            key={c.caseId}
                            className="bg-white border border-[#DFEADF] rounded-xl p-4 space-y-3 hover:border-[#398653] transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => onOpenCase(c.caseId)}
                                    className="font-mono text-sm font-bold text-[#398653] hover:underline cursor-pointer"
                                  >
                                    {c.caseId}
                                  </button>
                                  <span className="px-2 py-0.5 rounded bg-[#EAF7E9] text-[#203528] font-mono text-xs font-semibold">
                                    {c.currentBureau}
                                  </span>
                                  <PriorityLabel priority={c.priority} />
                                </div>
                                <div className="text-sm font-bold text-[#203528] mt-1">
                                  {c.category}
                                </div>
                              </div>
                              <StatusBadge status={c.status} isOverdue={ev.isOverdue} />
                            </div>

                            <p className="text-xs text-[#203528] leading-relaxed">
                              {c.description}
                            </p>

                            <div className="pt-2 border-t border-[#DFEADF] flex flex-wrap items-center justify-between gap-2 text-xs text-[#718173]">
                              <span>
                                Officer: <strong className="text-[#203528]">{officer?.displayName}</strong>
                              </span>
                              <span className="font-mono">
                                SLA Due: {c.dueAt.slice(0, 10)} (
                                {ev.isOverdue
                                  ? `${Math.abs(ev.daysRemaining)}d overdue`
                                  : `${ev.daysRemaining}d left`}
                                )
                              </span>
                            </div>

                            {c.relatedCaseIds.length > 0 && (
                              <div className="flex items-center gap-2 pt-1 text-xs">
                                <span className="text-[#718173] font-medium">Linked Cases:</span>
                                {c.relatedCaseIds.map((rcId) => (
                                  <button
                                    key={rcId}
                                    type="button"
                                    onClick={() => onOpenCase(rcId)}
                                    className="px-2 py-0.5 rounded bg-[#EAF7E9] text-[#398653] font-mono font-semibold hover:underline cursor-pointer"
                                  >
                                    {rcId}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Active Overlap Alerts for this institution */}
              {instOverlaps.length > 0 && (
                <div className="bg-[#FEF0E6]/60 border border-[#F7C6A3] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#B35012]">
                      <GitCompare className="w-4 h-4" />
                      <span>
                        Active Cross-Bureau Overlap Alerts for {currentInst.name}
                      </span>
                    </div>
                  </div>
                  {instOverlaps.map((ov) => (
                    <div
                      key={ov.alertId}
                      className="bg-white border border-[#DFEADF] rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-mono font-bold text-[#398653]">
                          {ov.caseIds[0]} ↔ {ov.caseIds[1]} (Score: {ov.riskScore}/100 · {ov.riskLevel} Risk)
                        </div>
                        <div className="text-[#718173] mt-0.5">
                          Signals: {ov.matchReasons.join(' · ')}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded bg-[#EAF7E9] text-[#203528] font-semibold whitespace-nowrap">
                        Outcome: {ov.reviewOutcome}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ALL COMPLAINTS */}
          {activeTab === 'complaints' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#EAF7E9] text-[#203528] text-xs font-semibold border-b border-[#DFEADF]">
                    <th className="py-3 px-4">Case ID</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Source → Current Bureau</th>
                    <th className="py-3 px-4">Assigned Officer</th>
                    <th className="py-3 px-4">Received</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Next Action</th>
                    <th className="py-3 px-4 text-right">Dossier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DFEADF] text-xs">
                  {instCases.map((c) => {
                    const ev = evaluateCaseSLA(c, referenceDate, slaPolicy);
                    const off = userMap.get(c.assignedOfficerId);
                    return (
                      <tr key={c.caseId} className="hover:bg-[#F7FBF7]">
                        <td className="py-3 px-4 font-mono font-bold text-[#398653]">{c.caseId}</td>
                        <td className="py-3 px-4 font-medium text-[#203528]">{c.category}</td>
                        <td className="py-3 px-4 font-mono">
                          {c.sourceBureau} → <strong>{c.currentBureau}</strong>
                        </td>
                        <td className="py-3 px-4">{off?.displayName || c.assignedOfficerId}</td>
                        <td className="py-3 px-4 font-mono">{c.receivedAt.slice(0, 10)}</td>
                        <td className="py-3 px-4">
                          <StatusBadge status={c.status} isOverdue={ev.isOverdue} />
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate">{c.nextAction}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => onOpenCase(c.caseId)}
                            className="px-2.5 py-1 rounded bg-[#398653] text-white font-semibold hover:bg-[#2F7446] cursor-pointer"
                          >
                            Open Case
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: CROSS-BUREAU ACTIVITY */}
          {activeTab === 'cross-bureau' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['RB', 'PGRC', 'AB', 'VIG', 'RO-SC', 'RO-N'].map((bCode) => {
                  const bCases = instCases.filter(
                    (c) => c.currentBureau === bCode || c.sourceBureau === bCode
                  );
                  if (bCases.length === 0) return null;
                  return (
                    <div
                      key={bCode}
                      className="bg-[#F7FBF7] border border-[#DFEADF] rounded-xl p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-bold text-[#398653]">{bCode}</span>
                        <span className="text-xs font-semibold text-[#203528]">
                          {bCases.length} case(s)
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {bCases.map((bc) => (
                          <button
                            key={bc.caseId}
                            type="button"
                            onClick={() => onOpenCase(bc.caseId)}
                            className="w-full text-left p-2 rounded bg-white border border-[#DFEADF] hover:border-[#398653] text-xs flex items-center justify-between cursor-pointer"
                          >
                            <span className="font-mono font-semibold text-[#398653]">
                              {bc.caseId}
                            </span>
                            <span className="text-[#718173] truncate ml-2">{bc.status}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2">
                <h4 className="text-sm font-bold text-[#203528] mb-3">
                  Active Inter-Bureau Coordination Workspaces
                </h4>
                {instWorkspaces.length === 0 ? (
                  <div className="p-6 rounded-xl bg-[#F7FBF7] border border-[#DFEADF] text-xs text-[#718173]">
                    No shared Coordination Workspaces currently linked to this institution.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {instWorkspaces.map((ws) => (
                      <div
                        key={ws.workspaceId}
                        className="bg-white border border-[#DFEADF] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[#398653]">
                              {ws.workspaceId}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-[#EAF7E9] text-[#203528] text-xs font-semibold">
                              Lead: {ws.leadBureau}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-[#F7FBF7] border border-[#DFEADF] text-xs">
                              Status: {ws.status}
                            </span>
                          </div>
                          <div className="text-sm font-bold text-[#203528] mt-1">{ws.title}</div>
                          <div className="text-xs text-[#718173] mt-0.5">
                            Linked Cases: {ws.relatedCaseIds.join(', ')} · {ws.actionItems.length}{' '}
                            Action Items
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenWorkspace(ws.workspaceId)}
                          className="px-3.5 py-2 rounded-lg bg-[#398653] text-white text-xs font-semibold hover:bg-[#2F7446] whitespace-nowrap cursor-pointer"
                        >
                          Open Workspace
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ACTION TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="relative pl-6 border-l-2 border-[#B7E4B1] space-y-4">
              {instActions.map((act) => {
                const actor = userMap.get(act.actorId);
                return (
                  <div key={act.actionId} className="relative">
                    <div className="w-3.5 h-3.5 rounded-full bg-[#398653] border-2 border-white absolute -left-[31px] top-1" />
                    <div className="bg-[#F7FBF7] border border-[#DFEADF] rounded-lg p-3.5 text-xs space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenCase(act.caseId)}
                            className="font-mono font-bold text-[#398653] hover:underline cursor-pointer"
                          >
                            {act.caseId}
                          </button>
                          <span className="font-bold text-[#203528]">{act.actionType}</span>
                          <span className="px-2 py-0.5 rounded bg-[#EAF7E9] text-[#398653] font-mono">
                            {act.bureau}
                          </span>
                        </div>
                        <span className="font-mono text-[#718173]">
                          {act.timestamp.slice(0, 10)}
                        </span>
                      </div>
                      <p className="text-[#203528]">{act.remarks}</p>
                      <div className="text-[11px] text-[#718173]">
                        By {actor?.displayName || act.actorId}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 5: DOCUMENTS */}
          {activeTab === 'documents' && (
            <div className="space-y-3">
              {allDocuments.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#718173]">
                  No documents uploaded across complaints for this institution.
                </div>
              ) : (
                allDocuments.map((doc) => (
                  <div
                    key={doc.docId}
                    className="p-3.5 rounded-lg border border-[#DFEADF] bg-[#F7FBF7] flex items-center justify-between gap-4 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#EAF7E9] flex items-center justify-center text-[#398653]">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-[#203528]">{doc.title}</div>
                        <div className="text-[11px] text-[#718173] font-mono">
                          Case: {doc.caseId} · Bureau: {doc.bureau} · {doc.sizeKb} KB · Uploaded{' '}
                          {doc.uploadedAt.slice(0, 10)}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenCase(doc.caseId)}
                      className="text-xs font-semibold text-[#398653] hover:underline cursor-pointer"
                    >
                      View Case Docket →
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 6: ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#F7FBF7] border border-[#DFEADF] rounded-xl p-4">
                <h4 className="text-xs font-bold text-[#203528] mb-3">
                  Complaints by Category for {currentInst.name}
                </h4>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#DFEADF" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="category"
                        width={150}
                        tick={{ fontSize: 11, fill: '#203528' }}
                      />
                      <Tooltip />
                      <Bar dataKey="cases" fill="#398653" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-[#F7FBF7] border border-[#DFEADF] rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-[#203528]">
                  Institutional Compliance & Resolution Summary
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-2 border-b border-[#DFEADF]">
                    <span className="text-[#718173]">Disposal Rate:</span>
                    <span className="font-mono font-bold text-[#2E8B57]">
                      {Math.round((stats.disposed / Math.max(1, stats.total)) * 100)}% (
                      {stats.disposed}/{stats.total})
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[#DFEADF]">
                    <span className="text-[#718173]">Bureaus Involved:</span>
                    <span className="font-mono font-bold text-[#203528]">
                      {stats.bureausCount} Bureau(s)
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[#DFEADF]">
                    <span className="text-[#718173]">Active Overlap Alerts:</span>
                    <span className="font-mono font-bold text-[#B35012]">
                      {instOverlaps.length}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-[#718173]">Active Coordination Workspaces:</span>
                    <span className="font-mono font-bold text-[#398653]">
                      {instWorkspaces.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
