import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  BookmarkPlus,
  Building2,
  Download,
  Eye,
  Filter,
  FolderPlus,
  GitCompare,
  RotateCcw,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import {
  BureauCode,
  CaseFilterState,
  CaseRecord,
  CaseStatus,
  ComplaintCategory,
  Institution,
  OverlapAlert,
  RegionCode,
  RiskLevel,
  SavedFilterView,
  SLAPolicyConfig,
  UserProfile,
} from '../types/domain';
import {
  evaluateCaseSLA,
  exportCasesToCsv,
  parseNaturalLanguageQuery,
} from '../utils/engine';
import { PriorityLabel, RiskBadge, StatusBadge } from './BadgeHelpers';

interface ComplaintRegistryViewProps {
  cases: CaseRecord[];
  institutions: Institution[];
  users: UserProfile[];
  overlapAlerts: OverlapAlert[];
  slaPolicy: SLAPolicyConfig;
  referenceDate: Date;
  filters: CaseFilterState;
  savedViews: SavedFilterView[];
  onUpdateFilters: (next: CaseFilterState) => void;
  onResetFilters: () => void;
  onSaveFilterView: (name: string, filters: CaseFilterState) => void;
  onOpenCase: (caseId: string) => void;
  onOpenInstitution: (institutionId: string) => void;
  onOpenRegisterModal: () => void;
  onOpenCsvImportModal: () => void;
}

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

const BUREAUS: BureauCode[] = ['RB', 'PGRC', 'AB', 'VIG', 'RO-SC', 'RO-N', 'RO-W', 'RO-S'];
const REGIONS: RegionCode[] = [
  'South-Central',
  'Northern',
  'Western',
  'Southern',
  'Eastern',
  'Central',
];
const STATUSES: CaseStatus[] = ['Pending', 'Under Process', 'Transferred', 'Disposed'];

export const ComplaintRegistryView: React.FC<ComplaintRegistryViewProps> = ({
  cases,
  institutions,
  users,
  overlapAlerts,
  slaPolicy,
  referenceDate,
  filters,
  savedViews,
  onUpdateFilters,
  onResetFilters,
  onSaveFilterView,
  onOpenCase,
  onOpenInstitution,
  onOpenRegisterModal,
  onOpenCsvImportModal,
}) => {
  const [nlQuery, setNlQuery] = useState('');
  const [nlExplanation, setNlExplanation] = useState<string[]>([]);
  const [sortField, setSortField] = useState<'receivedAt' | 'dueAt' | 'caseId' | 'status'>('receivedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [saveViewName, setSaveViewName] = useState('');
  const [showSaveViewInput, setShowSaveViewInput] = useState(false);
  const pageSize = 10;

  const instMap = useMemo(() => new Map(institutions.map((i) => [i.institutionId, i])), [institutions]);
  const userMap = useMemo(() => new Map(users.map((u) => [u.userId, u])), [users]);

  const caseOverlapMap = useMemo(() => {
    const map = new Map<string, OverlapAlert>();
    for (const alert of overlapAlerts) {
      if (alert.reviewStatus === 'Dismissed') continue;
      for (const cid of alert.caseIds) {
        const existing = map.get(cid);
        if (!existing || alert.riskScore > existing.riskScore) {
          map.set(cid, alert);
        }
      }
    }
    return map;
  }, [overlapAlerts]);

  const caseSLAMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof evaluateCaseSLA>>();
    for (const c of cases) {
      map.set(c.caseId, evaluateCaseSLA(c, referenceDate, slaPolicy));
    }
    return map;
  }, [cases, referenceDate, slaPolicy]);

  const getCaseRiskLevel = (c: CaseRecord): RiskLevel => {
    const ov = caseOverlapMap.get(c.caseId);
    const sla = caseSLAMap.get(c.caseId);
    if (ov?.riskLevel === 'High' || c.priority === 'Critical' || sla?.isOverdue) return 'High';
    if (ov?.riskLevel === 'Medium' || c.priority === 'High' || sla?.isApproachingDeadline) return 'Medium';
    return 'Low';
  };

  const filteredCases = useMemo(() => {
    return cases
      .filter((c) => {
        const inst = instMap.get(c.institutionId);
        const sla = caseSLAMap.get(c.caseId);
        const ov = caseOverlapMap.get(c.caseId);
        const risk = getCaseRiskLevel(c);

        if (filters.caseIdQuery.trim()) {
          if (!c.caseId.toLowerCase().includes(filters.caseIdQuery.trim().toLowerCase())) {
            return false;
          }
        }

        if (filters.searchQuery.trim()) {
          const q = filters.searchQuery.trim().toLowerCase();
          const instName = (c.reportedInstitutionName || inst?.name || '').toLowerCase();
          const pid = (c.reportedPermanentId ?? inst?.permanentId ?? '').toLowerCase();
          const desc = c.description.toLowerCase();
          if (
            !instName.includes(q) &&
            !pid.includes(q) &&
            !c.caseId.toLowerCase().includes(q) &&
            !desc.includes(q)
          ) {
            return false;
          }
        }

        if (filters.bureau !== 'ALL') {
          if (
            c.currentBureau !== filters.bureau &&
            c.sourceBureau !== filters.bureau &&
            c.pendingTransferToBureau !== filters.bureau
          ) {
            return false;
          }
        }

        if (filters.region !== 'ALL') {
          if (inst?.region !== filters.region) return false;
        }

        if (filters.category !== 'ALL') {
          if (c.category !== filters.category) return false;
        }

        if (filters.status !== 'ALL') {
          if (c.status !== filters.status) return false;
        }

        if (filters.riskLevel !== 'ALL') {
          if (risk !== filters.riskLevel) return false;
        }

        if (filters.assignedOfficerId !== 'ALL') {
          if (c.assignedOfficerId !== filters.assignedOfficerId) return false;
        }

        if (filters.dateFrom) {
          if (c.receivedAt.slice(0, 10) < filters.dateFrom) return false;
        }

        if (filters.dateTo) {
          if (c.receivedAt.slice(0, 10) > filters.dateTo) return false;
        }

        if (filters.overdueOnly && !sla?.isOverdue) {
          return false;
        }

        if (filters.potentialOverlapOnly && !ov) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === 'receivedAt') {
          cmp = new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime();
        } else if (sortField === 'dueAt') {
          cmp = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
        } else if (sortField === 'caseId') {
          cmp = a.caseId.localeCompare(b.caseId);
        } else if (sortField === 'status') {
          cmp = a.status.localeCompare(b.status);
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [cases, instMap, caseSLAMap, caseOverlapMap, filters, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedCases = filteredCases.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleApplyNaturalLanguage = (queryText?: string) => {
    const targetQuery = queryText !== undefined ? queryText : nlQuery;
    if (queryText !== undefined) setNlQuery(queryText);
    const { appliedFilters, explanation } = parseNaturalLanguageQuery(targetQuery, institutions);
    setNlExplanation(explanation);
    onUpdateFilters({
      searchQuery: appliedFilters.searchQuery || '',
      caseIdQuery: appliedFilters.caseIdQuery || '',
      bureau: appliedFilters.bureau || 'ALL',
      region: appliedFilters.region || 'ALL',
      category: appliedFilters.category || 'ALL',
      status: appliedFilters.status || 'ALL',
      riskLevel: appliedFilters.riskLevel || 'ALL',
      assignedOfficerId: appliedFilters.assignedOfficerId || 'ALL',
      dateFrom: '',
      dateTo: '',
      overdueOnly: Boolean(appliedFilters.overdueOnly),
      potentialOverlapOnly: Boolean(appliedFilters.potentialOverlapOnly),
    });
    setPage(1);
  };

  const handleExportCsv = () => {
    const csvContent = exportCasesToCsv(filteredCases, instMap, userMap);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `AICTE_Complaints_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const activeFilterChips: Array<{ label: string; onClear: () => void }> = [];
  if (filters.searchQuery) {
    activeFilterChips.push({
      label: `Institution/Keyword: "${filters.searchQuery}"`,
      onClear: () => onUpdateFilters({ ...filters, searchQuery: '' }),
    });
  }
  if (filters.caseIdQuery) {
    activeFilterChips.push({
      label: `Case ID: "${filters.caseIdQuery}"`,
      onClear: () => onUpdateFilters({ ...filters, caseIdQuery: '' }),
    });
  }
  if (filters.bureau !== 'ALL') {
    activeFilterChips.push({
      label: `Bureau: ${filters.bureau}`,
      onClear: () => onUpdateFilters({ ...filters, bureau: 'ALL' }),
    });
  }
  if (filters.region !== 'ALL') {
    activeFilterChips.push({
      label: `Region: ${filters.region}`,
      onClear: () => onUpdateFilters({ ...filters, region: 'ALL' }),
    });
  }
  if (filters.category !== 'ALL') {
    activeFilterChips.push({
      label: `Category: ${filters.category}`,
      onClear: () => onUpdateFilters({ ...filters, category: 'ALL' }),
    });
  }
  if (filters.status !== 'ALL') {
    activeFilterChips.push({
      label: `Status: ${filters.status}`,
      onClear: () => onUpdateFilters({ ...filters, status: 'ALL' }),
    });
  }
  if (filters.riskLevel !== 'ALL') {
    activeFilterChips.push({
      label: `Risk: ${filters.riskLevel}`,
      onClear: () => onUpdateFilters({ ...filters, riskLevel: 'ALL' }),
    });
  }
  if (filters.assignedOfficerId !== 'ALL') {
    const off = userMap.get(filters.assignedOfficerId);
    activeFilterChips.push({
      label: `Officer: ${off?.displayName || filters.assignedOfficerId}`,
      onClear: () => onUpdateFilters({ ...filters, assignedOfficerId: 'ALL' }),
    });
  }
  if (filters.overdueOnly) {
    activeFilterChips.push({
      label: 'Overdue Only',
      onClear: () => onUpdateFilters({ ...filters, overdueOnly: false }),
    });
  }
  if (filters.potentialOverlapOnly) {
    activeFilterChips.push({
      label: 'Potential Overlap Only',
      onClear: () => onUpdateFilters({ ...filters, potentialOverlapOnly: false }),
    });
  }

  return (
    <div className="space-y-5">
      {/* Top Action Bar & Natural Language Query */}
      <div className="bg-white border border-[#DFEADF] rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#203528]">
              Master Complaint Registry ({filteredCases.length} of {cases.length} records)
            </h2>
            <p className="text-xs text-[#718173]">
              Unified multi-bureau registry across Regulation Bureau (RB), PGRC, Approval Bureau, Vigilance, and Regional Offices
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#EAF7E9] text-[#203528] border border-[#B7E4B1] hover:bg-[#d9f0d7] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#398653]" />
              <span>Export Filtered CSV ({filteredCases.length})</span>
            </button>
            <button
              type="button"
              onClick={onOpenCsvImportModal}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#EAF7E9] text-[#203528] border border-[#B7E4B1] hover:bg-[#d9f0d7] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Upload className="w-4 h-4 text-[#398653]" />
              <span>Bulk CSV Import</span>
            </button>
            <button
              type="button"
              onClick={onOpenRegisterModal}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#398653] text-white hover:bg-[#2F7446] transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-xs cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Register Complaint</span>
            </button>
          </div>
        </div>

        {/* Natural-Language Search Translator */}
        <div className="bg-[#F7FBF7] border border-[#DFEADF] rounded-lg p-3.5 space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleApplyNaturalLanguage();
            }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
          >
            <div className="relative flex-1">
              <Sparkles className="w-4 h-4 text-[#398653] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={nlQuery}
                onChange={(e) => setNlQuery(e.target.value)}
                placeholder='Natural-language filter: e.g. "show overdue PGRC cases in Telangana" or "high risk faculty complaints in RB"'
                aria-label="Natural language search query"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#DFEADF] rounded-lg text-[#203528] focus:outline-none focus:border-[#398653]"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#398653] text-white hover:bg-[#2F7446] transition-colors whitespace-nowrap cursor-pointer"
            >
              Translate to Filters
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#718173]">
            <span className="font-semibold text-[#203528]">Try phrase:</span>
            {[
              'show overdue PGRC cases in Telangana',
              'high risk faculty complaints in RB',
              'overlap fee refund cases',
              'pending certificate cases in Northern',
            ].map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => handleApplyNaturalLanguage(sample)}
                className="px-2 py-0.5 rounded bg-white border border-[#DFEADF] text-[#398653] hover:bg-[#EAF7E9] transition-colors cursor-pointer"
              >
                “{sample}”
              </button>
            ))}
            {nlExplanation.length > 0 && (
              <span className="ml-auto text-[#2E8B57] font-medium">
                Parsed: {nlExplanation.join(' · ')}
              </span>
            )}
          </div>
        </div>

        {/* Multi-Filter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-semibold text-[#203528] mb-1">
              Institution Name or AICTE PID
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#718173] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filters.searchQuery}
                onChange={(e) => {
                  onUpdateFilters({ ...filters, searchQuery: e.target.value });
                  setPage(1);
                }}
                placeholder="e.g. Deccan or 1-309481722"
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-[#DFEADF] rounded-lg text-[#203528] focus:outline-none focus:border-[#398653]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#203528] mb-1">Case ID</label>
            <input
              type="text"
              value={filters.caseIdQuery}
              onChange={(e) => {
                onUpdateFilters({ ...filters, caseIdQuery: e.target.value });
                setPage(1);
              }}
              placeholder="e.g. AICTE-2026-0801"
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#DFEADF] rounded-lg text-[#203528] font-mono focus:outline-none focus:border-[#398653]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#203528] mb-1">
              Bureau / Cell
            </label>
            <select
              value={filters.bureau}
              onChange={(e) => {
                onUpdateFilters({ ...filters, bureau: e.target.value });
                setPage(1);
              }}
              aria-label="Filter by Bureau"
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#DFEADF] rounded-lg text-[#203528] focus:outline-none focus:border-[#398653]"
            >
              <option value="ALL">All Bureaus & Cells</option>
              {BUREAUS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#203528] mb-1">Region</label>
            <select
              value={filters.region}
              onChange={(e) => {
                onUpdateFilters({ ...filters, region: e.target.value });
                setPage(1);
              }}
              aria-label="Filter by Region"
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#DFEADF] rounded-lg text-[#203528] focus:outline-none focus:border-[#398653]"
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
            <label className="block text-[11px] font-semibold text-[#203528] mb-1">
              Complaint Category
            </label>
            <select
              value={filters.category}
              onChange={(e) => {
                onUpdateFilters({ ...filters, category: e.target.value });
                setPage(1);
              }}
              aria-label="Filter by Category"
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#DFEADF] rounded-lg text-[#203528] focus:outline-none focus:border-[#398653]"
            >
              <option value="ALL">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#203528] mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => {
                onUpdateFilters({ ...filters, status: e.target.value });
                setPage(1);
              }}
              aria-label="Filter by Status"
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#DFEADF] rounded-lg text-[#203528] focus:outline-none focus:border-[#398653]"
            >
              <option value="ALL">All Statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#203528] mb-1">
              Risk Level
            </label>
            <select
              value={filters.riskLevel}
              onChange={(e) => {
                onUpdateFilters({ ...filters, riskLevel: e.target.value });
                setPage(1);
              }}
              aria-label="Filter by Risk Level"
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#DFEADF] rounded-lg text-[#203528] focus:outline-none focus:border-[#398653]"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="High">High Risk</option>
              <option value="Medium">Medium Risk</option>
              <option value="Low">Low Risk</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#203528] mb-1">
              Assigned Officer
            </label>
            <select
              value={filters.assignedOfficerId}
              onChange={(e) => {
                onUpdateFilters({ ...filters, assignedOfficerId: e.target.value });
                setPage(1);
              }}
              aria-label="Filter by Assigned Officer"
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#DFEADF] rounded-lg text-[#203528] focus:outline-none focus:border-[#398653]"
            >
              <option value="ALL">All Officers</option>
              {users.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.displayName} ({u.bureau})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#203528] mb-1">
              Date Received (From – To)
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => {
                  onUpdateFilters({ ...filters, dateFrom: e.target.value });
                  setPage(1);
                }}
                aria-label="Received Date From"
                className="w-full px-1.5 py-1.5 text-[11px] bg-white border border-[#DFEADF] rounded-lg text-[#203528]"
              />
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => {
                  onUpdateFilters({ ...filters, dateTo: e.target.value });
                  setPage(1);
                }}
                aria-label="Received Date To"
                className="w-full px-1.5 py-1.5 text-[11px] bg-white border border-[#DFEADF] rounded-lg text-[#203528]"
              />
            </div>
          </div>

          <div className="flex flex-col justify-end gap-1.5 pb-0.5">
            <label className="inline-flex items-center gap-2 text-xs text-[#203528] font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={filters.overdueOnly}
                onChange={(e) => {
                  onUpdateFilters({ ...filters, overdueOnly: e.target.checked });
                  setPage(1);
                }}
                className="accent-[#398653] rounded"
              />
              <span>Overdue Cases Only</span>
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-[#203528] font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={filters.potentialOverlapOnly}
                onChange={(e) => {
                  onUpdateFilters({ ...filters, potentialOverlapOnly: e.target.checked });
                  setPage(1);
                }}
                className="accent-[#398653] rounded"
              />
              <span>Potential Overlap Only</span>
            </label>
          </div>
        </div>

        {/* Saved Filter Views + Active Filter Chips */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#DFEADF]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#718173] flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-[#398653]" />
              <span>Saved Views:</span>
            </span>
            {savedViews.map((sv) => (
              <button
                key={sv.viewId}
                type="button"
                onClick={() => {
                  onUpdateFilters(sv.filters);
                  setPage(1);
                }}
                className="px-2.5 py-1 rounded-md text-xs font-medium bg-[#F7FBF7] hover:bg-[#EAF7E9] text-[#203528] border border-[#DFEADF] transition-colors cursor-pointer"
              >
                {sv.name}
              </button>
            ))}

            {!showSaveViewInput ? (
              <button
                type="button"
                onClick={() => setShowSaveViewInput(true)}
                className="px-2.5 py-1 rounded-md text-xs font-semibold text-[#398653] hover:bg-[#EAF7E9] flex items-center gap-1 cursor-pointer"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                <span>Save Current Filter</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5">
                <input
                  type="text"
                  value={saveViewName}
                  onChange={(e) => setSaveViewName(e.target.value)}
                  placeholder="Preset name..."
                  className="px-2 py-1 text-xs border border-[#398653] rounded-md"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (saveViewName.trim()) {
                      onSaveFilterView(saveViewName.trim(), filters);
                      setSaveViewName('');
                      setShowSaveViewInput(false);
                    }
                  }}
                  className="px-2.5 py-1 text-xs font-semibold bg-[#398653] text-white rounded-md cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowSaveViewInput(false)}
                  className="text-xs text-[#718173] px-1 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {activeFilterChips.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onResetFilters();
                setNlQuery('');
                setNlExplanation([]);
                setPage(1);
              }}
              className="text-xs font-semibold text-[#D9534F] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear All Filters ({activeFilterChips.length})</span>
            </button>
          )}
        </div>

        {activeFilterChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {activeFilterChips.map((chip, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[#EAF7E9] text-[#203528] border border-[#B7E4B1]"
              >
                <span>{chip.label}</span>
                <button
                  type="button"
                  onClick={chip.onClear}
                  aria-label={`Remove filter ${chip.label}`}
                  className="text-[#398653] hover:text-[#203528] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Registry Data Table */}
      <div className="bg-white border border-[#DFEADF] rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#EAF7E9] text-[#203528] text-xs font-semibold border-b border-[#DFEADF]">
                <th className="py-3 px-3.5 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('caseId')}
                    className="inline-flex items-center gap-1 hover:text-[#398653] cursor-pointer"
                  >
                    <span>Case ID</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3.5">Institution Name & AICTE PID</th>
                <th className="py-3 px-3.5">Complaint Category</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Source → Assigned</th>
                <th className="py-3 px-3.5">Responsible Officer</th>
                <th className="py-3 px-3.5 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('receivedAt')}
                    className="inline-flex items-center gap-1 hover:text-[#398653] cursor-pointer"
                  >
                    <span>Received</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3.5 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('status')}
                    className="inline-flex items-center gap-1 hover:text-[#398653] cursor-pointer"
                  >
                    <span>Current Status</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3.5 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('dueAt')}
                    className="inline-flex items-center gap-1 hover:text-[#398653] cursor-pointer"
                  >
                    <span>SLA Deadline</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3.5">Last Action</th>
                <th className="py-3 px-3.5">Overlap / Risk</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFEADF] text-xs">
              {paginatedCases.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-[#718173]">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="w-8 h-8 text-[#398653]" />
                      <div className="text-sm font-semibold text-[#203528]">
                        No complaint records match the active filters
                      </div>
                      <p className="text-xs text-[#718173]">
                        Try clearing one or more filter chips or registering a new complaint.
                      </p>
                      <button
                        type="button"
                        onClick={onResetFilters}
                        className="mt-1 px-3 py-1.5 rounded-lg bg-[#398653] text-white text-xs font-semibold cursor-pointer"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCases.map((c) => {
                  const inst = instMap.get(c.institutionId);
                  const officer = userMap.get(c.assignedOfficerId);
                  const sla = caseSLAMap.get(c.caseId);
                  const ov = caseOverlapMap.get(c.caseId);
                  const risk = getCaseRiskLevel(c);
                  const pid = c.reportedPermanentId ?? inst?.permanentId ?? '';

                  return (
                    <tr
                      key={c.caseId}
                      className="hover:bg-[#EAF7E9]/45 transition-colors group"
                    >
                      <td className="py-3 px-3.5 font-mono font-bold text-[#398653] whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onOpenCase(c.caseId)}
                          className="hover:underline cursor-pointer"
                        >
                          {c.caseId}
                        </button>
                        <div className="mt-0.5">
                          <PriorityLabel priority={c.priority} />
                        </div>
                      </td>

                      <td className="py-3 px-3.5 max-w-[230px]">
                        <button
                          type="button"
                          onClick={() => onOpenInstitution(c.institutionId)}
                          className="font-semibold text-[#203528] hover:text-[#398653] text-left line-clamp-1 cursor-pointer"
                        >
                          {c.reportedInstitutionName || inst?.name}
                        </button>
                        <div className="text-[11px] text-[#718173] font-mono mt-0.5 flex items-center gap-1.5">
                          <span>{pid ? `PID: ${pid}` : 'PID: Missing'}</span>
                          <span>·</span>
                          <span>{inst?.state}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3.5 max-w-[180px]">
                        <div className="font-medium text-[#203528] line-clamp-2">{c.category}</div>
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap font-mono">
                        <span className="text-[#718173]">{c.sourceBureau}</span>
                        <span className="mx-1 text-[#718173]">→</span>
                        <span className="font-bold text-[#203528]">{c.currentBureau}</span>
                        {c.pendingTransferToBureau && (
                          <div className="text-[10px] text-[#5E3A8C] font-sans font-semibold mt-0.5">
                            Pending → {c.pendingTransferToBureau}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3.5">
                        <div className="font-medium text-[#203528]">
                          {officer?.displayName || c.assignedOfficerId}
                        </div>
                        <div className="text-[11px] text-[#718173]">
                          {officer?.designation.split(',')[0]}
                        </div>
                      </td>

                      <td className="py-3 px-3.5 font-mono text-[#203528] whitespace-nowrap tabular-nums">
                        {c.receivedAt.slice(0, 10)}
                        <div className="text-[10px] text-[#718173]">{sla?.ageBucketLabel}</div>
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <StatusBadge status={c.status} isOverdue={sla?.isOverdue} />
                      </td>

                      <td className="py-3 px-3.5 font-mono whitespace-nowrap tabular-nums">
                        <div className="font-medium text-[#203528]">{c.dueAt.slice(0, 10)}</div>
                        {c.status === 'Disposed' ? (
                          <div className="text-[11px] text-[#2E8B57] font-sans">Completed</div>
                        ) : sla?.isOverdue ? (
                          <div className="text-[11px] text-[#D9534F] font-semibold">
                            {Math.abs(sla.daysRemaining)}d overdue
                          </div>
                        ) : (
                          <div
                            className={`text-[11px] ${
                              sla?.isApproachingDeadline
                                ? 'text-[#D99A25] font-semibold'
                                : 'text-[#718173]'
                            }`}
                          >
                            {sla?.daysRemaining}d remaining
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-mono text-[#203528]">{c.lastActionAt.slice(0, 10)}</div>
                        {sla?.isInactive && (
                          <div className="text-[10px] text-[#B35012] font-semibold">
                            Inactive ({sla.daysSinceLastAction}d)
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {ov ? (
                          <RiskBadge level={ov.riskLevel} score={ov.riskScore} isOverlap />
                        ) : (
                          <RiskBadge level={risk} />
                        )}
                      </td>

                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenCase(c.caseId)}
                            className="px-2.5 py-1 rounded-md bg-[#398653] text-white font-semibold hover:bg-[#2F7446] transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Case Details</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenInstitution(c.institutionId)}
                            title="Open Institution 360° Profile"
                            aria-label={`Open Institution 360 profile for ${c.caseId}`}
                            className="p-1.5 rounded-md bg-[#EAF7E9] text-[#398653] hover:bg-[#d8f0d6] border border-[#B7E4B1] transition-colors cursor-pointer"
                          >
                            <Building2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-5 py-3.5 bg-[#F7FBF7] border-t border-[#DFEADF] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-[#718173] tabular-nums">
            Showing{' '}
            <span className="font-semibold text-[#203528]">
              {filteredCases.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-[#203528]">
              {Math.min(currentPage * pageSize, filteredCases.length)}
            </span>{' '}
            of <span className="font-semibold text-[#203528]">{filteredCases.length}</span> cases
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded-md border border-[#DFEADF] bg-white text-[#203528] disabled:opacity-40 hover:bg-[#EAF7E9] cursor-pointer disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => setPage(pageNum)}
                className={`w-7 h-7 rounded-md font-mono font-semibold cursor-pointer ${
                  pageNum === currentPage
                    ? 'bg-[#398653] text-white'
                    : 'bg-white border border-[#DFEADF] text-[#203528] hover:bg-[#EAF7E9]'
                }`}
              >
                {pageNum}
              </button>
            ))}
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 rounded-md border border-[#DFEADF] bg-white text-[#203528] disabled:opacity-40 hover:bg-[#EAF7E9] cursor-pointer disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
