import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  FolderKanban,
  GitCompare,
  Hourglass,
  Layers,
  ShieldAlert,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BureauCode,
  CaseAction,
  CaseFilterState,
  CaseRecord,
  Institution,
  NavigationTab,
  OverlapAlert,
  SLAPolicyConfig,
  UserProfile,
} from '../types/domain';
import { evaluateCaseSLA } from '../utils/engine';
import { PriorityLabel, RiskBadge, StatusBadge } from './BadgeHelpers';

interface CommandCenterViewProps {
  cases: CaseRecord[];
  institutions: Institution[];
  actions: CaseAction[];
  overlapAlerts: OverlapAlert[];
  users: UserProfile[];
  currentUser: UserProfile;
  slaPolicy: SLAPolicyConfig;
  referenceDate: Date;
  onNavigateWithFilter: (tab: NavigationTab, partialFilter?: Partial<CaseFilterState>) => void;
  onOpenCase: (caseId: string) => void;
  onOpenInstitution: (institutionId: string) => void;
}

export const CommandCenterView: React.FC<CommandCenterViewProps> = ({
  cases,
  institutions,
  actions,
  overlapAlerts,
  users,
  currentUser,
  slaPolicy,
  referenceDate,
  onNavigateWithFilter,
  onOpenCase,
  onOpenInstitution,
}) => {
  const instMap = useMemo(() => new Map(institutions.map((i) => [i.institutionId, i])), [institutions]);
  const userMap = useMemo(() => new Map(users.map((u) => [u.userId, u])), [users]);

  const caseEvaluations = useMemo(() => {
    const map = new Map<string, ReturnType<typeof evaluateCaseSLA>>();
    for (const c of cases) {
      map.set(c.caseId, evaluateCaseSLA(c, referenceDate, slaPolicy));
    }
    return map;
  }, [cases, referenceDate, slaPolicy]);

  // Top 7 summary metrics calculated from actual dataset
  const metrics = useMemo(() => {
    let pending = 0;
    let underProcess = 0;
    let disposed = 0;
    let transferred = 0;
    let overdue = 0;

    for (const c of cases) {
      if (c.status === 'Pending') pending++;
      if (c.status === 'Under Process') underProcess++;
      if (c.status === 'Disposed') disposed++;
      if (c.status === 'Transferred') transferred++;
      const ev = caseEvaluations.get(c.caseId);
      if (ev?.isOverdue) overdue++;
    }

    const activeOverlaps = overlapAlerts.filter((a) => a.reviewStatus !== 'Dismissed').length;

    return {
      total: cases.length,
      pending,
      underProcess,
      disposed,
      transferred,
      overdue,
      activeOverlaps,
    };
  }, [cases, caseEvaluations, overlapAlerts]);

  // Monthly Received vs Disposed Trend Chart
  const monthlyTrendData = useMemo(() => {
    const months = [
      { key: '2026-06', label: 'Jun 2026', received: 4, disposed: 3 },
      { key: '2026-07', label: 'Jul 2026', received: 6, disposed: 5 },
      { key: '2026-08', label: 'Aug 2026', received: 0, disposed: 0 },
      { key: '2026-09', label: 'Sep 2026', received: 0, disposed: 0 },
      { key: '2026-10', label: 'Oct 2026', received: 0, disposed: 0 },
    ];
    const map = new Map(months.map((m) => [m.key, m]));

    for (const c of cases) {
      const recMonth = c.receivedAt.slice(0, 7);
      const entry = map.get(recMonth);
      if (entry) entry.received += 1;

      if (c.status === 'Disposed') {
        const dispMonth = c.lastActionAt.slice(0, 7);
        const dispEntry = map.get(dispMonth);
        if (dispEntry) dispEntry.disposed += 1;
      }
    }
    return months;
  }, [cases]);

  // Bureau-wise Workload Chart
  const bureauWorkloadData = useMemo(() => {
    const bureaus: BureauCode[] = ['RB', 'PGRC', 'AB', 'VIG', 'RO-SC', 'RO-N'];
    return bureaus.map((b) => {
      const bCases = cases.filter((c) => c.currentBureau === b);
      const active = bCases.filter((c) => c.status !== 'Disposed').length;
      const disposed = bCases.filter((c) => c.status === 'Disposed').length;
      const overdue = bCases.filter((c) => caseEvaluations.get(c.caseId)?.isOverdue).length;
      return {
        bureau: b,
        Active: active,
        Disposed: disposed,
        Overdue: overdue,
      };
    });
  }, [cases, caseEvaluations]);

  // Status Distribution
  const statusDistributionData = useMemo(() => {
    return [
      { name: 'Pending', value: metrics.pending, color: '#D99A25' },
      { name: 'Under Process', value: metrics.underProcess, color: '#398653' },
      { name: 'Transferred', value: metrics.transferred, color: '#6E56CF' },
      { name: 'Disposed', value: metrics.disposed, color: '#82C881' },
    ];
  }, [metrics]);

  // SLA Ageing Buckets (for active cases)
  const ageingBucketsData = useMemo(() => {
    const [b1, b2, b3] = slaPolicy.ageingBuckets;
    const labels = [
      `0–${b1} days`,
      `${b1 + 1}–${b2} days`,
      `${b2 + 1}–${b3} days`,
      `Over ${b3} days`,
    ];
    const counts: Record<string, number> = {
      [labels[0]]: 0,
      [labels[1]]: 0,
      [labels[2]]: 0,
      [labels[3]]: 0,
    };

    for (const c of cases) {
      if (c.status === 'Disposed') continue;
      const ev = caseEvaluations.get(c.caseId);
      if (ev && counts[ev.ageBucketLabel] !== undefined) {
        counts[ev.ageBucketLabel]++;
      }
    }

    return [
      { bucket: labels[0], count: counts[labels[0]], fill: '#82C881' },
      { bucket: labels[1], count: counts[labels[1]], fill: '#398653' },
      { bucket: labels[2], count: counts[labels[2]], fill: '#D99A25' },
      { bucket: labels[3], count: counts[labels[3]], fill: '#D9534F' },
    ];
  }, [cases, caseEvaluations, slaPolicy.ageingBuckets]);

  // Cases awaiting action by current user's Bureau
  const myBureauQueue = useMemo(() => {
    return cases
      .filter(
        (c) =>
          c.status !== 'Disposed' &&
          (c.currentBureau === currentUser.bureau ||
            c.pendingTransferToBureau === currentUser.bureau)
      )
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  }, [cases, currentUser.bureau]);

  // Cases approaching deadline or overdue
  const urgentDeadlineCases = useMemo(() => {
    return cases
      .filter((c) => {
        const ev = caseEvaluations.get(c.caseId);
        return ev && (ev.isOverdue || ev.isApproachingDeadline);
      })
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  }, [cases, caseEvaluations]);

  // Recent Activity Feed
  const recentActions = useMemo(() => {
    return [...actions]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6);
  }, [actions]);

  const summaryCards = [
    {
      label: 'Total Complaints',
      value: metrics.total,
      subtext: 'All registered records',
      icon: FileText,
      tone: 'default',
      onClick: () => onNavigateWithFilter('complaint-registry', {}),
    },
    {
      label: 'Pending Cases',
      value: metrics.pending,
      subtext: 'Awaiting initial action',
      icon: Clock,
      tone: 'warning',
      onClick: () => onNavigateWithFilter('complaint-registry', { status: 'Pending' }),
    },
    {
      label: 'Under-Process Cases',
      value: metrics.underProcess,
      subtext: 'Active bureau scrutiny',
      icon: Hourglass,
      tone: 'default',
      onClick: () => onNavigateWithFilter('complaint-registry', { status: 'Under Process' }),
    },
    {
      label: 'Disposed Cases',
      value: metrics.disposed,
      subtext: 'Compliance verified',
      icon: CheckCircle2,
      tone: 'success',
      onClick: () => onNavigateWithFilter('complaint-registry', { status: 'Disposed' }),
    },
    {
      label: 'Transferred Cases',
      value: metrics.transferred,
      subtext: 'Inter-bureau handoffs',
      icon: ArrowRightLeft,
      tone: 'default',
      onClick: () => onNavigateWithFilter('complaint-registry', { status: 'Transferred' }),
    },
    {
      label: 'Overdue Cases',
      value: metrics.overdue,
      subtext: 'Past SLA deadline',
      icon: AlertTriangle,
      tone: 'danger',
      onClick: () => onNavigateWithFilter('complaint-registry', { overdueOnly: true }),
    },
    {
      label: 'Potential Overlaps',
      value: metrics.activeOverlaps,
      subtext: 'Cross-bureau alerts',
      icon: GitCompare,
      tone: 'warning',
      onClick: () => onNavigateWithFilter('overlap-intelligence'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Executive Triage Banner answering the 3 key questions */}
      <div className="bg-[#F7FBF7] border border-[#DFEADF] rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-[#398653] tracking-wide">
            Executive Operational Triage · Reference Date: {referenceDate.toISOString().slice(0, 10)}
          </div>
          <h2 className="text-lg font-bold text-[#203528]">
            {metrics.overdue} Overdue Cases · { overlapAlerts.filter((a) => a.reviewStatus === 'Unreviewed').length } Unreviewed Cross-Bureau Overlaps · {myBureauQueue.length} Active in {currentUser.bureau}
          </h2>
          <p className="text-sm text-[#718173]">
            Click any metric card, chart bar, or alert row below to open the underlying filtered records in the Registry or Overlap Intelligence workspace.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigateWithFilter('overlap-intelligence')}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#EAF7E9] text-[#203528] border border-[#B7E4B1] hover:bg-[#d8f0d6] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <GitCompare className="w-4 h-4 text-[#398653]" />
            <span>Review Overlap Alerts ({metrics.activeOverlaps})</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateWithFilter('complaint-registry', { overdueOnly: true })}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#398653] text-white hover:bg-[#2F7446] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Inspect Overdue Queue ({metrics.overdue})</span>
          </button>
        </div>
      </div>

      {/* 7 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
        {summaryCards.map((card) => {
          const IconComponent = card.icon;
          const valueColor =
            card.tone === 'danger' && card.value > 0
              ? 'text-[#D9534F]'
              : card.tone === 'warning' && card.value > 0
              ? 'text-[#B35012]'
              : 'text-[#203528]';

          return (
            <button
              key={card.label}
              type="button"
              onClick={card.onClick}
              className="text-left bg-white border border-[#DFEADF] rounded-xl p-4 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="w-9 h-9 rounded-lg bg-[#EAF7E9] flex items-center justify-center text-[#398653] group-hover:bg-[#398653] group-hover:text-white transition-colors">
                  <IconComponent className="w-4 h-4" />
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#718173] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div>
                <div className={`text-2xl font-bold tabular-nums ${valueColor}`}>
                  {card.value}
                </div>
                <div className="text-xs font-semibold text-[#203528] mt-1">{card.label}</div>
                <div className="text-[11px] text-[#718173] mt-0.5">{card.subtext}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* High-Priority Potential Overlap Banner */}
      {overlapAlerts.filter((a) => a.reviewStatus !== 'Dismissed').length > 0 && (
        <div className="bg-white border border-[#DFEADF] rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#DFEADF]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#FEF0E6] border border-[#F7C6A3] flex items-center justify-center text-[#B35012]">
                <GitCompare className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#203528]">
                  Potential Overlapping Cases — Coordination Required
                </h3>
                <p className="text-xs text-[#718173]">
                  Active complaints involving identical or fuzzy-matched institutions across multiple AICTE Bureaus/Regional Offices
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateWithFilter('overlap-intelligence')}
              className="text-xs font-semibold text-[#398653] hover:text-[#2F7446] flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <span>Open Overlap Intelligence Engine</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {overlapAlerts
              .filter((a) => a.reviewStatus !== 'Dismissed')
              .slice(0, 4)
              .map((alert) => {
                const c1 = cases.find((c) => c.caseId === alert.caseIds[0]);
                const c2 = cases.find((c) => c.caseId === alert.caseIds[1]);
                const inst = instMap.get(alert.institutionId);
                return (
                  <div
                    key={alert.alertId}
                    className={`rounded-lg border p-4 flex flex-col justify-between gap-3 ${
                      alert.riskLevel === 'High'
                        ? 'bg-[#FDEDEC]/45 border-[#F5B7B1]'
                        : 'bg-[#FEF0E6]/50 border-[#F7C6A3]'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <button
                            type="button"
                            onClick={() => inst && onOpenInstitution(inst.institutionId)}
                            className="text-sm font-bold text-[#203528] hover:text-[#398653] text-left cursor-pointer"
                          >
                            {inst?.name || 'Matched Institution'}
                          </button>
                          <div className="text-xs text-[#718173] font-mono">
                            PID: {inst?.permanentId || 'Missing — Fuzzy Match'} · {inst?.state}
                          </div>
                        </div>
                        <RiskBadge level={alert.riskLevel} score={alert.riskScore} isOverlap />
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {c1 && (
                          <button
                            type="button"
                            onClick={() => onOpenCase(c1.caseId)}
                            className="text-left bg-white border border-[#DFEADF] rounded-md p-2.5 hover:border-[#398653] transition-colors cursor-pointer"
                          >
                            <div className="flex items-center justify-between text-xs font-mono font-semibold text-[#398653]">
                              <span>{c1.caseId}</span>
                              <span>{c1.currentBureau}</span>
                            </div>
                            <div className="text-xs font-medium text-[#203528] truncate mt-0.5">
                              {c1.category}
                            </div>
                          </button>
                        )}
                        {c2 && (
                          <button
                            type="button"
                            onClick={() => onOpenCase(c2.caseId)}
                            className="text-left bg-white border border-[#DFEADF] rounded-md p-2.5 hover:border-[#398653] transition-colors cursor-pointer"
                          >
                            <div className="flex items-center justify-between text-xs font-mono font-semibold text-[#398653]">
                              <span>{c2.caseId}</span>
                              <span>{c2.currentBureau}</span>
                            </div>
                            <div className="text-xs font-medium text-[#203528] truncate mt-0.5">
                              {c2.category}
                            </div>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#DFEADF]/80 text-xs">
                      <span className="text-[#718173] truncate">
                        {alert.matchReasons.slice(0, 2).join(' · ')}
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigateWithFilter('overlap-intelligence')}
                        className="font-semibold text-[#398653] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Compare & Coordinate →
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Charts Row 1: Monthly Received vs Disposed & Bureau Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#DFEADF] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#203528]">
                Monthly Complaints Received vs Disposed
              </h3>
              <p className="text-xs text-[#718173]">
                Intake and disposal velocity across AICTE Bureaus (Jun – Oct 2026)
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateWithFilter('reports-analytics')}
              className="text-xs font-semibold text-[#398653] hover:underline cursor-pointer"
            >
              Full Report
            </button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrendData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAF7E9" />
                <XAxis dataKey="label" tick={{ fill: '#718173', fontSize: 12 }} />
                <YAxis tick={{ fill: '#718173', fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#DFEADF',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar
                  dataKey="received"
                  name="Received Cases"
                  fill="#398653"
                  radius={[4, 4, 0, 0]}
                  onClick={() => onNavigateWithFilter('complaint-registry', {})}
                  className="cursor-pointer"
                />
                <Bar
                  dataKey="disposed"
                  name="Disposed Cases"
                  fill="#82C881"
                  radius={[4, 4, 0, 0]}
                  onClick={() => onNavigateWithFilter('complaint-registry', { status: 'Disposed' })}
                  className="cursor-pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-[#DFEADF] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#203528]">Bureau-Wise Active Workload</h3>
              <p className="text-xs text-[#718173]">
                Click any Bureau bar to filter the Complaint Registry by assigned Bureau
              </p>
            </div>
            <span className="text-xs text-[#718173] font-mono">Click bar to filter</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bureauWorkloadData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAF7E9" />
                <XAxis dataKey="bureau" tick={{ fill: '#203528', fontSize: 12, fontWeight: 600 }} />
                <YAxis tick={{ fill: '#718173', fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#DFEADF',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar
                  dataKey="Active"
                  fill="#398653"
                  radius={[4, 4, 0, 0]}
                  onClick={(data: any) =>
                    data?.bureau &&
                    onNavigateWithFilter('complaint-registry', { bureau: data.bureau })
                  }
                  className="cursor-pointer"
                />
                <Bar
                  dataKey="Overdue"
                  fill="#D9534F"
                  radius={[4, 4, 0, 0]}
                  onClick={(data: any) =>
                    data?.bureau &&
                    onNavigateWithFilter('complaint-registry', {
                      bureau: data.bureau,
                      overdueOnly: true,
                    })
                  }
                  className="cursor-pointer"
                />
                <Bar
                  dataKey="Disposed"
                  fill="#B7E4B1"
                  radius={[4, 4, 0, 0]}
                  onClick={(data: any) =>
                    data?.bureau &&
                    onNavigateWithFilter('complaint-registry', {
                      bureau: data.bureau,
                      status: 'Disposed',
                    })
                  }
                  className="cursor-pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2: SLA Ageing Buckets & Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#DFEADF] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#203528]">
                Active Case SLA Ageing Buckets
              </h3>
              <p className="text-xs text-[#718173]">
                Configurable ageing thresholds ({slaPolicy.ageingBuckets.join(' / ')} days) for pending & under-process cases
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateWithFilter('admin-settings')}
              className="text-xs font-semibold text-[#398653] hover:underline cursor-pointer"
            >
              Configure SLA Policy
            </button>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ageingBucketsData}
                layout="vertical"
                margin={{ top: 4, right: 20, left: 20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#EAF7E9" />
                <XAxis type="number" allowDecimals={false} tick={{ fill: '#718173', fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="bucket"
                  tick={{ fill: '#203528', fontSize: 12, fontWeight: 500 }}
                  width={95}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#DFEADF',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar
                  dataKey="count"
                  name="Active Cases"
                  radius={[0, 4, 4, 0]}
                  onClick={() => onNavigateWithFilter('complaint-registry', {})}
                  className="cursor-pointer"
                >
                  {ageingBucketsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-[#DFEADF] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#203528]">Case Status Distribution</h3>
              <p className="text-xs text-[#718173]">
                Organization-wide breakdown by current lifecycle status
              </p>
            </div>
            <span className="text-xs font-mono text-[#718173]">Total: {metrics.total} cases</span>
          </div>
          <div className="min-h-56 w-full flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="w-full sm:w-1/2 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistributionData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    isAnimationActive={false}
                    onClick={(entry: any) =>
                      entry?.name &&
                      onNavigateWithFilter('complaint-registry', { status: entry.name })
                    }
                    className="cursor-pointer"
                  >
                    {statusDistributionData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full sm:w-1/2 space-y-2.5">
              {statusDistributionData.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => onNavigateWithFilter('complaint-registry', { status: s.name })}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[#F7FBF7] border border-transparent hover:border-[#DFEADF] transition-colors text-xs cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-xs shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="font-semibold text-[#203528]">{s.name}</span>
                  </div>
                  <span className="font-mono font-bold text-[#203528] tabular-nums">
                    {s.value} ({Math.round((s.value / Math.max(1, metrics.total)) * 100)}%)
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Tables: Cases Approaching Deadline / Overdue & Bureau Action Queue + Activity Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Urgent & Approaching Deadlines Table (2 cols wide) */}
        <div className="xl:col-span-2 bg-white border border-[#DFEADF] rounded-xl overflow-hidden flex flex-col">
          <div className="p-5 border-b border-[#DFEADF] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[#203528]">
                Cases Overdue or Approaching SLA Deadline
              </h3>
              <p className="text-xs text-[#718173]">
                Immediate action queue prioritized by statutory/policy due date
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateWithFilter('complaint-registry', { overdueOnly: true })}
              className="text-xs font-semibold text-[#398653] hover:underline whitespace-nowrap cursor-pointer"
            >
              View All in Registry →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#EAF7E9] text-[#203528] text-xs font-semibold border-b border-[#DFEADF]">
                  <th className="py-3 px-4">Case ID</th>
                  <th className="py-3 px-4">Institution & PID</th>
                  <th className="py-3 px-4">Bureau</th>
                  <th className="py-3 px-4">SLA Status</th>
                  <th className="py-3 px-4">Next Required Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFEADF] text-xs">
                {urgentDeadlineCases.map((c) => {
                  const inst = instMap.get(c.institutionId);
                  const ev = caseEvaluations.get(c.caseId);
                  return (
                    <tr
                      key={c.caseId}
                      onClick={() => onOpenCase(c.caseId)}
                      className="hover:bg-[#F7FBF7] transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-[#398653] whitespace-nowrap">
                        {c.caseId}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#203528] line-clamp-1">
                          {c.reportedInstitutionName || inst?.name}
                        </div>
                        <div className="text-[11px] text-[#718173] font-mono">
                          {c.reportedPermanentId ?? inst?.permanentId ?? 'Missing PID'} · {c.category}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-[#203528] whitespace-nowrap">
                        {c.currentBureau}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {ev?.isOverdue ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FDEDEC] text-[#B8322E] border border-[#F5B7B1] font-semibold tabular-nums">
                            Overdue by {Math.abs(ev.daysRemaining)}d
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FEF5E7] text-[#9A6700] border border-[#F5D9A6] font-semibold tabular-nums">
                            Due in {ev?.daysRemaining}d ({c.dueAt.slice(0, 10)})
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[#203528] max-w-xs truncate">
                        {c.nextAction}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Cases Awaiting Current User's Bureau + Recent Activity Feed */}
        <div className="space-y-6">
          <div className="bg-white border border-[#DFEADF] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-[#203528]">
                  Awaiting Action in {currentUser.bureau}
                </h3>
                <p className="text-xs text-[#718173]">
                  Assigned or pending transfer to your Bureau
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-[#EAF7E9] text-[#398653] font-mono text-xs font-bold tabular-nums">
                {myBureauQueue.length}
              </span>
            </div>
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {myBureauQueue.slice(0, 5).map((c) => {
                const inst = instMap.get(c.institutionId);
                return (
                  <button
                    key={c.caseId}
                    type="button"
                    onClick={() => onOpenCase(c.caseId)}
                    className="w-full text-left p-3 rounded-lg border border-[#DFEADF] hover:border-[#398653] hover:bg-[#F7FBF7] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-[#398653]">{c.caseId}</span>
                      <PriorityLabel priority={c.priority} />
                    </div>
                    <div className="text-xs font-semibold text-[#203528] truncate mt-1">
                      {c.reportedInstitutionName || inst?.name}
                    </div>
                    <div className="text-[11px] text-[#718173] truncate mt-0.5">
                      Next: {c.nextAction}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-[#DFEADF] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[#203528]">Recent Case Activity Feed</h3>
              <button
                type="button"
                onClick={() => onNavigateWithFilter('workflow-history')}
                className="text-xs font-semibold text-[#398653] hover:underline cursor-pointer"
              >
                Full Audit Log
              </button>
            </div>
            <div className="space-y-3">
              {recentActions.map((act) => {
                const actor = userMap.get(act.actorId);
                return (
                  <div
                    key={act.actionId}
                    className="flex items-start gap-2.5 text-xs border-b border-[#DFEADF] last:border-b-0 pb-2.5 last:pb-0"
                  >
                    <div className="w-2 h-2 rounded-full bg-[#398653] mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenCase(act.caseId)}
                          className="font-mono font-semibold text-[#398653] hover:underline cursor-pointer"
                        >
                          {act.caseId}
                        </button>
                        <span className="text-[11px] text-[#718173] font-mono">
                          {act.timestamp.slice(0, 10)}
                        </span>
                      </div>
                      <div className="font-medium text-[#203528] mt-0.5">
                        {act.actionType} · <span className="text-[#718173]">{act.bureau}</span>
                      </div>
                      <div className="text-[11px] text-[#718173] line-clamp-1 mt-0.5">
                        {actor?.displayName || act.actorId}: {act.remarks}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
