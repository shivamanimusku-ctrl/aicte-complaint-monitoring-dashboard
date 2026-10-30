import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FolderPlus,
  Upload,
  X,
} from 'lucide-react';
import {
  BureauCode,
  CasePriority,
  CaseRecord,
  ComplaintCategory,
  Institution,
  SLAPolicyConfig,
  UserProfile,
} from '../types/domain';
import { checkPermission } from '../utils/engine';

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

interface RegisterComplaintModalProps {
  institutions: Institution[];
  users: UserProfile[];
  currentUser: UserProfile;
  existingCases: CaseRecord[];
  slaPolicy: SLAPolicyConfig;
  referenceDate: Date;
  onClose: () => void;
  onRegisterCase: (newCase: CaseRecord) => void;
}

export const RegisterComplaintModal: React.FC<RegisterComplaintModalProps> = ({
  institutions,
  users,
  currentUser,
  existingCases,
  slaPolicy,
  referenceDate,
  onClose,
  onRegisterCase,
}) => {
  const [institutionId, setInstitutionId] = useState(institutions[0]?.institutionId || 'INST-1001');
  const [category, setCategory] = useState<ComplaintCategory>('Faculty Norms & Cadre Ratio');
  const [priority, setPriority] = useState<CasePriority>('High');
  const [sourceBureau, setSourceBureau] = useState<BureauCode>(currentUser.bureau);
  const [currentBureau, setCurrentBureau] = useState<BureauCode>(currentUser.bureau);
  const [assignedOfficerId, setAssignedOfficerId] = useState(currentUser.userId);
  const [complainantMasked, setComplainantMasked] = useState('');
  const [description, setDescription] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-generate next sequential Case ID
  const nextNumber = 801 + existingCases.length;
  const generatedCaseId = `AICTE-2026-0${nextNumber}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const perm = checkPermission(currentUser, 'CREATE_CASE');
    if (!perm.allowed) {
      setErrorMsg(perm.reason || 'Your current role is not authorized to register new complaints.');
      return;
    }

    if (!complainantMasked.trim()) {
      setErrorMsg('Complainant masked reference (e.g., "Student Petition / Faculty Group") is required.');
      return;
    }
    if (!description.trim() || description.trim().length < 15) {
      setErrorMsg('Please enter a factual complaint description of at least 15 characters.');
      return;
    }

    const slaDays = slaPolicy.categorySLADays[category] || 15;
    const recDate = new Date(referenceDate);
    const dueDate = new Date(recDate.getTime() + slaDays * 24 * 60 * 60 * 1000);

    const newCase: CaseRecord = {
      caseId: generatedCaseId,
      institutionId,
      sourceBureau,
      currentBureau,
      assignedOfficerId,
      category,
      priority,
      description: description.trim(),
      receivedAt: recDate.toISOString(),
      status: 'Pending',
      dueAt: dueDate.toISOString(),
      lastActionAt: recDate.toISOString(),
      nextAction:
        nextAction.trim() ||
        `Initial scrutiny and notice generation by ${currentBureau} within ${slaDays} days`,
      relatedCaseIds: [],
      complainantMasked: complainantMasked.trim(),
      documents: [],
      createdAt: recDate.toISOString(),
      updatedAt: recDate.toISOString(),
    };

    onRegisterCase(newCase);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#203528]/40 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="register-complaint-title"
    >
      <div className="bg-white border border-[#DFEADF] rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
        <div className="bg-[#EAF7E9] border-b border-[#DFEADF] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FolderPlus className="w-5 h-5 text-[#398653]" />
            <div>
              <h2 id="register-complaint-title" className="text-base font-bold text-[#203528]">
                Register New Institutional Complaint
              </h2>
              <p className="text-xs text-[#718173]">
                Auto-Generated Docket ID: <strong className="font-mono text-[#398653]">{generatedCaseId}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Register Complaint Modal"
            className="p-1.5 rounded-lg bg-white border border-[#DFEADF] text-[#203528] hover:bg-[#FDEDEC] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-[#FDEDEC] border border-[#F5B7B1] text-[#B8322E] font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-[#203528] mb-1">
              Target AICTE Institution (Permanent ID) *
            </label>
            <select
              value={institutionId}
              onChange={(e) => setInstitutionId(e.target.value)}
              className="w-full px-3 py-2 border border-[#DFEADF] rounded-lg bg-white text-[#203528] focus:outline-none focus:border-[#398653]"
            >
              {institutions.map((inst) => (
                <option key={inst.institutionId} value={inst.institutionId}>
                  {inst.name} — PID: {inst.permanentId} ({inst.state})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-[#203528] mb-1">
                Complaint Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                className="w-full px-3 py-2 border border-[#DFEADF] rounded-lg bg-white text-[#203528]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c} (SLA: {slaPolicy.categorySLADays[c]}d)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#203528] mb-1">Priority Level *</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as CasePriority)}
                className="w-full px-3 py-2 border border-[#DFEADF] rounded-lg bg-white text-[#203528]"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#203528] mb-1">Source Bureau *</label>
              <select
                value={sourceBureau}
                onChange={(e) => setSourceBureau(e.target.value as BureauCode)}
                className="w-full px-3 py-2 border border-[#DFEADF] rounded-lg bg-white text-[#203528]"
              >
                {BUREAUS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#203528] mb-1">
                Currently Assigned Bureau *
              </label>
              <select
                value={currentBureau}
                onChange={(e) => setCurrentBureau(e.target.value as BureauCode)}
                className="w-full px-3 py-2 border border-[#DFEADF] rounded-lg bg-white text-[#203528]"
              >
                {BUREAUS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#203528] mb-1">
                Responsible Case Officer *
              </label>
              <select
                value={assignedOfficerId}
                onChange={(e) => setAssignedOfficerId(e.target.value)}
                className="w-full px-3 py-2 border border-[#DFEADF] rounded-lg bg-white text-[#203528]"
              >
                {users.map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.displayName} ({u.bureau})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#203528] mb-1">
                Masked Complainant Identity *
              </label>
              <input
                type="text"
                value={complainantMasked}
                onChange={(e) => setComplainantMasked(e.target.value)}
                placeholder="e.g., Dr. S*** K*** (Faculty) or Student Batch 2026"
                className="w-full px-3 py-2 border border-[#DFEADF] rounded-lg bg-white text-[#203528]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#203528] mb-1">
              Factual Complaint Description (Minimum 15 characters) *
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Summarize the specific regulatory violation or student/faculty grievance..."
              className="w-full px-3 py-2 border border-[#DFEADF] rounded-lg bg-white text-[#203528]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#203528] mb-1">
              Initial Scheduled Action
            </label>
            <input
              type="text"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="e.g., Issue show-cause requisition to Principal within 7 working days"
              className="w-full px-3 py-2 border border-[#DFEADF] rounded-lg bg-white text-[#203528]"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#DFEADF]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#DFEADF] bg-white text-[#203528] font-semibold hover:bg-[#F7FBF7] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#398653] text-white font-semibold hover:bg-[#2F7446] cursor-pointer"
            >
              Submit & Register Docket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface BulkCsvImportModalProps {
  institutions: Institution[];
  existingCases: CaseRecord[];
  currentUser: UserProfile;
  slaPolicy: SLAPolicyConfig;
  referenceDate: Date;
  onClose: () => void;
  onImportCases: (imported: CaseRecord[]) => void;
}

const SAMPLE_CSV = `permanentId,institutionName,category,sourceBureau,currentBureau,priority,complainantMasked,description
1-309481722,Deccan Institute of Engineering & Management,Salary Non-Payment / Withholding,PGRC,PGRC,High,ECE Faculty Petition,Non-disbursement of 3 months salary to 8 ECE laboratory instructors and assistant professors.
1-619283745,Northern India Technical Campus Kanpur,Original Certificate Retention,RO-N,PGRC,Critical,R*** T*** (B.Tech Student),Refusal to return original 12th marksheet after admission cancellation within counseling window.`;

export const BulkCsvImportModal: React.FC<BulkCsvImportModalProps> = ({
  institutions,
  existingCases,
  currentUser,
  slaPolicy,
  referenceDate,
  onClose,
  onImportCases,
}) => {
  const [csvText, setCsvText] = useState(SAMPLE_CSV);

  const parsePreview = () => {
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      return { validRows: [] as CaseRecord[], errors: ['CSV must include a header row and at least 1 data row.'] };
    }

    const validRows: CaseRecord[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      if (cols.length < 8) {
        errors.push(`Row ${i + 1}: Expected 8 columns, found ${cols.length}.`);
        continue;
      }

      const [pid, instName, cat, srcBureau, curBureau, prio, comp, desc] = cols;
      const matchedInst =
        institutions.find((inst) => inst.permanentId === pid) || institutions[0];

      if (!CATEGORIES.includes(cat as ComplaintCategory)) {
        errors.push(`Row ${i + 1}: Unrecognized category "${cat}".`);
        continue;
      }
      if (!BUREAUS.includes(srcBureau as BureauCode) || !BUREAUS.includes(curBureau as BureauCode)) {
        errors.push(`Row ${i + 1}: Invalid Bureau code (${srcBureau} / ${curBureau}).`);
        continue;
      }
      if (desc.length < 10) {
        errors.push(`Row ${i + 1}: Description is too short.`);
        continue;
      }

      // Duplicate check against existing cases
      const isExactDup = existingCases.some(
        (ec) =>
          ec.institutionId === matchedInst.institutionId &&
          ec.description.toLowerCase() === desc.toLowerCase()
      );
      if (isExactDup) {
        errors.push(`Row ${i + 1}: Exact duplicate complaint description already exists in registry.`);
        continue;
      }

      const caseNum = 801 + existingCases.length + validRows.length;
      const slaDays = slaPolicy.categorySLADays[cat as ComplaintCategory] || 15;
      const rec = new Date(referenceDate);
      const due = new Date(rec.getTime() + slaDays * 24 * 60 * 60 * 1000);

      validRows.push({
        caseId: `AICTE-2026-0${caseNum}`,
        institutionId: matchedInst.institutionId,
        reportedInstitutionName: instName,
        reportedPermanentId: pid,
        sourceBureau: srcBureau as BureauCode,
        currentBureau: curBureau as BureauCode,
        assignedOfficerId: currentUser.userId,
        category: cat as ComplaintCategory,
        priority: (['Low', 'Medium', 'High', 'Critical'].includes(prio) ? prio : 'Medium') as CasePriority,
        description: desc,
        receivedAt: rec.toISOString(),
        status: 'Pending',
        dueAt: due.toISOString(),
        lastActionAt: rec.toISOString(),
        nextAction: `Imported via Bulk CSV — Initial review by ${curBureau}`,
        relatedCaseIds: [],
        complainantMasked: comp,
        documents: [],
        createdAt: rec.toISOString(),
        updatedAt: rec.toISOString(),
      });
    }

    return { validRows, errors };
  };

  const { validRows, errors } = parsePreview();

  return (
    <div
      className="fixed inset-0 z-50 bg-[#203528]/40 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-csv-modal-title"
    >
      <div className="bg-white border border-[#DFEADF] rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden">
        <div className="bg-[#EAF7E9] border-b border-[#DFEADF] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-[#398653]" />
            <div>
              <h2 id="bulk-csv-modal-title" className="text-base font-bold text-[#203528]">
                Bulk CSV Complaint Import & Validation Preview
              </h2>
              <p className="text-xs text-[#718173]">
                Includes automatic AICTE Permanent ID mapping, row-level validation, and duplicate detection
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Bulk CSV Import Modal"
            className="p-1.5 rounded-lg bg-white border border-[#DFEADF] text-[#203528] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-[#203528] mb-1">
              Paste CSV Content (Format: permanentId,institutionName,category,sourceBureau,currentBureau,priority,complainantMasked,description)
            </label>
            <textarea
              rows={5}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full p-3 font-mono text-xs border border-[#DFEADF] rounded-lg bg-[#F7FBF7] focus:bg-white focus:outline-none focus:border-[#398653]"
            />
          </div>

          {errors.length > 0 && (
            <div className="p-3 rounded-lg bg-[#FDEDEC] border border-[#F5B7B1] text-[#B8322E] space-y-1">
              <div className="font-bold">Row Validation Errors ({errors.length}):</div>
              {errors.map((err, i) => (
                <div key={i}>• {err}</div>
              ))}
            </div>
          )}

          <div className="bg-[#F7FBF7] border border-[#DFEADF] rounded-xl p-4 space-y-2">
            <div className="font-bold text-[#203528]">
              Validated Rows Ready for Import ({validRows.length}):
            </div>
            {validRows.map((r) => (
              <div
                key={r.caseId}
                className="p-2.5 rounded bg-white border border-[#DFEADF] flex items-center justify-between gap-3"
              >
                <div>
                  <span className="font-mono font-bold text-[#398653]">{r.caseId}</span> ·{' '}
                  <strong>{r.reportedInstitutionName}</strong> ({r.reportedPermanentId}) —{' '}
                  {r.category} [{r.currentBureau}]
                </div>
                <span className="px-2 py-0.5 rounded bg-[#EAF7E9] text-[#2E8B57] font-semibold">
                  Valid
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#DFEADF]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#DFEADF] bg-white text-[#203528] font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={validRows.length === 0}
              onClick={() => {
                onImportCases(validRows);
                onClose();
              }}
              className="px-5 py-2 rounded-lg bg-[#398653] text-white font-semibold hover:bg-[#2F7446] disabled:opacity-40 cursor-pointer"
            >
              Import {validRows.length} Validated Record(s)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
