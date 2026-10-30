import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  Download,
  Printer,
  RotateCcw,
  Scale,
  Users,
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
  CaseRecord,
  CaseStatus,
  ComplaintCategory,
  Institution,
  OverlapAlert,
  RegionCode,
  SLAPolicyConfig,
  UserProfile,
} from '../types/domain';
import { checkPermission, evaluateCaseSLA, exportCasesToCsv } from '../utils/engine';

interface ReportsAnalyticsViewProps {
  cases: CaseRecord[];
  institutions: Institution[];
  overlapAlerts: OverlapAlert[];
  users: UserProfile[];
  currentUser: UserProfile;
  slaPolicy: SLAPolicyConfig;
  referenceDate: Date;
  onReassignOfficer: (caseId: string, newOfficerId: string, remarks: string) => void;
  onOpenCase: (caseId: string) => void;
  onOpenInstitution: (institutionId: string) => void;
}

const BUREAUS: BureauCode[] = ['RB', 'PGRC', 'AB', 'VIG', 'RO-SC', 'RO-N', 'RO-W', 'RO-S'];
const REGIONS: RegionCode[] = [
  'South-Central',
  'Northern',
  'Western',
  'Southern',
  'Eastern',
  'Central',
];
const CATEGORIES: ComplaintCategory[] = [
  'Faculty Norms & Cadre Ratio',
  'Original Certificate Retention',
  'Unapproved Intake / Excess Admission',
  'Fee Refund & Capitation Fee',
  'Infrastructure & Lab Deficiency',
  'Salary Non-Payment / Withholding',
  'Fake / Duplicate Faculty Records',
  'Hostel & Student Welfare Grievance',
];

export const ReportsAnalyticsView: React.FC<ReportsAnalyticsViewProps> = ({
  cases,
  institutions,
  overlapAlerts,
  users,
  currentUser,
  slaPolicy,
  referenceDate,
  onReassignOfficer,
  onOpenCase,
  onOpenInstitution,
}) => {
  const [regionFilter, setRegionFilter] = useState<string>('ALL');
  const [bureauFilter, setBureauFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [balanceFeedback, setBalanceFeedback] = useState<string | null>(null);

  const instMap = useMemo(() => new Map(institutions.map((i) => [i.institutionId, i])), [institutions]);
  const userMap = useMemo(() => new Map(users.map((u) => [u.userId, u])), [users]);

  // Consistent filter logic shared across all charts and summary tables
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const inst = instMap.get(c.institutionId);
      if (regionFilter !== 'ALL' && inst?.region !== regionFilter) return false;
      if (
        bureauFilter !== 'ALL' &&
        c.currentBureau !== bureauFilter &&
        c.sourceBureau !== bureauFilter
      )
        return false;
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && c.category !== categoryFilter) return false;
      if (dateFrom && c.receivedAt.slice(0, 10) < dateFrom) return false;
      if (dateTo && c.receivedAt.slice(0, 10) > dateTo) return false;
      return true;
    });
  }, [cases, instMap, regionFilter, bureauFilter, statusFilter, categoryFilter, dateFrom, dateTo]);

  const kpiStats = useMemo(() => {
    let disposed = 0;
    let withinSla = 0;
    let overdue = 0;
    let transferred = 0;

    for (const c of filteredCases) {
      const ev = evaluateCaseSLA(c, referenceDate, slaPolicy);
      if (c.status === 'Disposed') {
        disposed++;
        withinSla++;
      } else if (ev.isOverdue) {
        overdue++;
      } else {
        withinSla++;
      }
      if (c.status === 'Transferred' || c.sourceBureau !== c.currentBureau) {
        transferred++;
      }
    }

    const total = filteredCases.length;
    return {
      total,
      disposed,
      disposalRate: total > 0 ? Math.round((disposed / total) * 100) : 0,
      slaComplianceRate: total > 0 ? Math.round((withinSla / total) * 100) : 0,
      overdue,
      transferred,
    };
  }, [filteredCases, referenceDate, slaPolicy]);

  // Regional Complaint Distribution
  const regionChartData = useMemo(() => {
    return REGIONS.map((reg) => {
      const regCases = filteredCases.filter((c) => instMap.get(c.institutionId)?.region === reg);
      return {
        region: reg,
        Active: regCases.filter((c) => c.status !== 'Disposed').length,
        Disposed: regCases.filter((c) => c.status === 'Disposed').length,
      };
    });
  }, [filteredCases, instMap]);

  // Bureau Workload & SLA Breakdown
  const bureauReportData = useMemo(() => {
    return BUREAUS.map((b) => {
      const bCases = filteredCases.filter((c) => c.currentBureau === b);
      const overdue = bCases.filter(
        (c) => evaluateCaseSLA(c, referenceDate, slaPolicy).isOverdue
      ).length;
      return {
        bureau: b,
        Total: bCases.length,
        Active: bCases.filter((c) => c.status !== 'Disposed').length,
        Disposed: bCases.filter((c) => c.status === 'Disposed').length,
        Overdue: overdue,
      };
    }).filter((row) => row.Total > 0);
  }, [filteredCases, referenceDate, slaPolicy]);

  // Overlap Review Outcomes Chart
  const overlapOutcomeData = useMemo(() => {
    const counts: Record<string, number> = {
      'Pending Review': 0,
      'Confirmed Duplicate': 0,
      'Related — Separate Issues': 0,
      'No Overlap': 0,
    };
    for (const o of overlapAlerts) {
      counts[o.reviewOutcome] = (counts[o.reviewOutcome] || 0) + 1;
    }
    return [
      { name: 'Pending Review', value: counts['Pending Review'], color: '#D99A25' },
      { name: 'Related — Separate', value: counts['Related — Separate Issues'], color: '#398653' },
      { name: 'Confirmed Duplicate', value: counts['Confirmed Duplicate'], color: '#D9534F' },
      { name: 'No Overlap', value: counts['No Overlap'], color: '#82C881' },
    ];
  }, [overlapAlerts]);

  // Workload Balancing Suggestions (Algorithmic non-binding suggestions)
  const workloadSuggestions = useMemo(() => {
    const caseOfficers = users.filter((u) => u.role === 'Case Officer' || u.role === 'Regional Officer');
    const loadByOfficer = new Map<string, { active: number; overdue: number; cases: CaseRecord[] }>();

    for (const u of caseOfficers) {
      loadByOfficer.set(u.userId, { active: 0, overdue: 0, cases: [] });
    }

    for (const c of cases) {
      if (c.status === 'Disposed') continue;
      const bucket = loadByOfficer.get(c.assignedOfficerId);
      if (bucket) {
        bucket.active++;
        const ev = evaluateCaseSLA(c, referenceDate, slaPolicy);
        if (ev.isOverdue) bucket.overdue++;
        bucket.cases.push(c);
      }
    }

    // Identify overloaded officers (active >= 4) and lighter-loaded officers
    const suggestions: Array<{
      caseRecord: CaseRecord;
      fromOfficer: UserProfile;
      toOfficer: UserProfile;
      reason: string;
    }> = [];

    const sortedOfficers = [...caseOfficers].sort(
      (a, b) =>
        (loadByOfficer.get(b.userId)?.active || 0) -
        (loadByOfficer.get(a.userId)?.active || 0)
    );

    if (sortedOfficers.length >= 2) {
      const heaviest = sortedOfficers[0];
      const lightest = sortedOfficers[sortedOfficers.length - 1];
      const heavyBucket = loadByOfficer.get(heaviest.userId);
      const lightBucket = loadByOfficer.get(lightest.userId);

      if (heavyBucket && lightBucket && heavyBucket.active > lightBucket.active + 1) {
        const candidateCase = heavyBucket.cases[0];
        if (candidateCase) {
          suggestions.push({
            caseRecord: candidateCase,
            fromOfficer: heaviest,
            toOfficer: lightest,
            reason: `${heaviest.displayName} holds ${heavyBucket.active} active cases (${heavyBucket.overdue} overdue) vs ${lightest.displayName} with ${lightBucket.active} active case(s).`,
          });
        }
      }
    }
    return suggestions;
  }, [cases, users, referenceDate, slaPolicy]);

  // Data-Quality & Integrity Audit
  const dataQualityFlags = useMemo(() => {
    const flags: Array<{
      caseId: string;
      institutionId: string;
      issueType: string;
      detail: string;
    }> = [];

    for (const c of cases) {
      const inst = instMap.get(c.institutionId);
      if (c.reportedPermanentId === '') {
        flags.push({
          caseId: c.caseId,
          institutionId: c.institutionId,
          issueType: 'Missing AICTE Permanent ID on Intake',
          detail: `Case ${c.caseId} was submitted without a Permanent ID (matched via normalized name to ${inst?.permanentId}).`,
        });
      }
      if (c.reportedInstitutionName && inst && c.reportedInstitutionName !== inst.name) {
        flags.push({
          caseId: c.caseId,
          institutionId: c.institutionId,
          issueType: 'Non-Standard Institution Name Variant',
          detail: `Intake states "${c.reportedInstitutionName}" vs master directory "${inst.name}".`,
        });
      }
      if (c.status !== 'Disposed' && c.documents.length === 0) {
        flags.push({
          caseId: c.caseId,
          institutionId: c.institutionId,
          issueType: 'Incomplete Evidence Docket',
          detail: `Active case (${c.status}) has 0 uploaded documentary attachments.`,
        });
      }
    }
    return flags;
  }, [cases, instMap]);

  const handleExportReportCsv = () => {
    const csv = exportCasesToCsv(filteredCases, instMap, userMap);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AICTE_Analytics_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Report Filter & Export Toolbar */}
      <div className="bg-white border border-[#DFEADF] rounded-xl p-5 space-y-4 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#203528]">
              Reports, SLA Compliance & Operational Analytics
            </h2>
            <p className="text-xs text-[#718173]">
              All charts, KPIs, and exports dynamically reflect the filter criteria below ({filteredCases.length} matching records)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportReportCsv}
              className="px-3.5 py-2 rounded-lg bg-[#EAF7E9] text-[#203528] border border-[#B7E4B1] text-xs font-semibold hover:bg-[#d8f0d6] flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#398653]" />
              <span>Export Report CSV</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-lg bg-[#398653] text-white text-xs font-semibold hover:bg-[#2F7446] flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Official Report</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t border-[#DFEADF]">
          <div>
            <label className="block text-[11px] font-semibold text-[#203528] mb-1">Region</label>
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-[#DFEADF] rounded-lg bg-white"
            >
              <option value="ALL">All Regions</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#203528] mb-1">Bureau</label>
            <select
              value={bureauFilter}
              onChange={(e) => setBureauFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-[#DFEADF] rounded-lg bg-white"
            >
              <option value="ALL">All Bureaus</option>
              {BUREAUS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#203528] mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-[#DFEADF] rounded-lg bg-white"
            >
              <option value="ALL">All Statuses</option>
              {(['Pending', 'Under Process', 'Transferred', 'Disposed'] as CaseStatus[]).map(
                (s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#203528] mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-[#DFEADF] rounded-lg bg-white"
            >
              <option value="ALL">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setRegionFilter('ALL');
                setBureauFilter('ALL');
                setStatusFilter('ALL');
                setCategoryFilter('ALL');
                setDateFrom('');
                setDateTo('');
              }}
              className="w-full px-3 py-1.5 rounded-lg bg-[#F7FBF7] border border-[#DFEADF] text-xs font-semibold text-[#203528] hover:bg-[#EAF7E9] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#398653]" />
              <span>Reset Report Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white border border-[#DFEADF] rounded-xl p-4">
          <div className="text-xs text-[#718173] font-medium">Filtered Total Cases</div>
          <div className="text-2xl font-bold text-[#203528] font-mono tabular-nums mt-1">
            {kpiStats.total}
          </div>
        </div>
        <div className="bg-white border border-[#DFEADF] rounded-xl p-4">
          <div className="text-xs text-[#718173] font-medium">SLA Compliance Rate</div>
          <div className="text-2xl font-bold text-[#2E8B57] font-mono tabular-nums mt-1">
            {kpiStats.slaComplianceRate}%
          </div>
        </div>
        <div className="bg-white border border-[#DFEADF] rounded-xl p-4">
          <div className="text-xs text-[#718173] font-medium">Overall Disposal Rate</div>
          <div className="text-2xl font-bold text-[#398653] font-mono tabular-nums mt-1">
            {kpiStats.disposalRate}%
          </div>
        </div>
        <div className="bg-white border border-[#DFEADF] rounded-xl p-4">
          <div className="text-xs text-[#718173] font-medium">Inter-Bureau Transfers</div>
          <div className="text-2xl font-bold text-[#203528] font-mono tabular-nums mt-1">
            {kpiStats.transferred}
          </div>
        </div>
        <div className="bg-white border border-[#DFEADF] rounded-xl p-4">
          <div className="text-xs text-[#718173] font-medium">Overdue Breaches</div>
          <div className="text-2xl font-bold text-[#D9534F] font-mono tabular-nums mt-1">
            {kpiStats.overdue}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#DFEADF] rounded-xl p-5">
          <h3 className="text-base font-bold text-[#203528] mb-1">
            Regional Complaint Distribution (Active vs Disposed)
          </h3>
          <p className="text-xs text-[#718173] mb-4">
            Volume of institutional complaints across AICTE Regional jurisdictions
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAF7E9" />
                <XAxis dataKey="region" tick={{ fontSize: 11, fill: '#203528' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#718173' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Active" fill="#398653" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Disposed" fill="#82C881" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-[#DFEADF] rounded-xl p-5">
          <h3 className="text-base font-bold text-[#203528] mb-1">
            Overlap Intelligence Alerts & Review Outcomes
          </h3>
          <p className="text-xs text-[#718173] mb-4">
            Breakdown of cross-bureau overlap flags by officer review decision
          </p>
          <div className="min-h-64 w-full flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="w-full sm:w-1/2 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={overlapOutcomeData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    isAnimationActive={false}
                  >
                    {overlapOutcomeData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full sm:w-1/2 space-y-2 text-xs">
              {overlapOutcomeData.map((o) => (
                <div
                  key={o.name}
                  className="flex items-center justify-between p-2 rounded-lg bg-[#F7FBF7] border border-[#DFEADF]"
                >
                  <span className="font-semibold text-[#203528]">{o.name}</span>
                  <span className="font-mono font-bold text-[#398653]">{o.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Workload Balancing Suggestions & Data-Quality Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workload Balancing Suggestions */}
        <div className="bg-white border border-[#DFEADF] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EAF7E9] flex items-center justify-center text-[#398653]">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#203528]">
                Officer Workload Balancing Suggestions (Requires Human Approval)
              </h3>
              <p className="text-xs text-[#718173]">
                Advisory reallocation proposals based on active docket counts and upcoming deadlines
              </p>
            </div>
          </div>

          {balanceFeedback && (
            <div className="p-3 rounded-lg bg-[#EAF7E9] border border-[#B7E4B1] text-xs font-semibold text-[#203528]">
              {balanceFeedback}
            </div>
          )}

          {workloadSuggestions.length === 0 ? (
            <div className="p-4 rounded-lg bg-[#F7FBF7] border border-[#DFEADF] text-xs text-[#718173]">
              Officer workloads are currently balanced within threshold.
            </div>
          ) : (
            <div className="space-y-3">
              {workloadSuggestions.map((sug, idx) => (
                <div
                  key={idx}
                  className="bg-[#F7FBF7] border border-[#DFEADF] rounded-xl p-4 space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-[#398653]">
                      Candidate Docket: {sug.caseRecord.caseId} ({sug.caseRecord.category})
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#EAF7E9] text-[#203528] font-semibold">
                      Advisory Proposal
                    </span>
                  </div>
                  <p className="text-[#203528]">{sug.reason}</p>
                  <div className="flex items-center justify-between pt-2 border-t border-[#DFEADF]">
                    <span className="text-[#718173]">
                      Suggested Reassignment: <strong>{sug.fromOfficer.displayName}</strong> →{' '}
                      <strong>{sug.toOfficer.displayName}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const perm = checkPermission(
                          currentUser,
                          'ASSIGN_OFFICER',
                          sug.caseRecord
                        );
                        if (!perm.allowed) {
                          setBalanceFeedback(perm.reason || 'Role not authorized to reassign.');
                          return;
                        }
                        onReassignOfficer(
                          sug.caseRecord.caseId,
                          sug.toOfficer.userId,
                          `Approved workload balancing recommendation from ${sug.fromOfficer.displayName} to ${sug.toOfficer.displayName}.`
                        );
                        setBalanceFeedback(
                          `Approved reassignment of ${sug.caseRecord.caseId} to ${sug.toOfficer.displayName}.`
                        );
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#398653] text-white font-semibold hover:bg-[#2F7446] cursor-pointer"
                    >
                      Approve Reassignment
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Data-Quality & Record Integrity Panel */}
        <div className="bg-white border border-[#DFEADF] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EAF7E9] flex items-center justify-center text-[#398653]">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#203528]">
                Data-Quality & Record Integrity Monitor ({dataQualityFlags.length} Flags)
              </h3>
              <p className="text-xs text-[#718173]">
                Identifies missing AICTE Permanent IDs, non-standard institution names, and incomplete dockets
              </p>
            </div>
          </div>

          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {dataQualityFlags.slice(0, 6).map((flag, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-[#F7FBF7] border border-[#DFEADF] text-xs flex items-start justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-[#203528]">
                    <span className="font-mono text-[#398653]">{flag.caseId}</span> ·{' '}
                    {flag.issueType}
                  </div>
                  <p className="text-[#718173]">{flag.detail}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenCase(flag.caseId)}
                  className="text-xs font-semibold text-[#398653] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Remediate →
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
