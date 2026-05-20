import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Archive,
  Award,
  BarChart3,
  Book,
  BookOpen,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Clock,
  ClipboardList,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Files,
  Filter,
  Gavel,
  Grid,
  Hash,
  History,
  Image,
  Info,
  LayoutDashboard,
  LineChart,
  List,
  Lock,
  MapPin,
  Maximize2,
  MessageSquare,
  Minimize2,
  MoreVertical,
  Package,
  Paperclip,
  Pencil,
  PieChart,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Star,
  Table,
  Trash2,
  TrendingUp,
  Unlock,
  User,
  Users,
  X,
  Loader2,
} from "lucide-react";
// `useNavigate` removed (not needed after module button removal)
import { useToast } from "../../context/useToast";
import { FetchDataError, fetchData } from "../../api/fetchData";
import type { ApiResponse } from "../../types/api";
import {
  readEnvelopeAllowedActions,
  readEnvelopeData,
  readEnvelopeErrorMessages,
  readEnvelopeMessage,
  readEnvelopeSuccess,
  readEnvelopeWarningMessages,
  readEnvelopeTotalCount,
} from "../../utils/api-envelope";
import {
  extractDefensePeriodId,
  getActiveDefensePeriodId,
  normalizeDefensePeriodId,
  setActiveDefensePeriodId,
} from "../../utils/defensePeriod";
type RevisionStatus = "all" | "pending" | "approved" | "rejected";
type LifecycleAction = "PUBLISH" | "ROLLBACK" | "ARCHIVE" | "REOPEN";
type ReportType = "council-summary" | "scoreboard" | "minutes" | "review" | "form-1" | "final-term" | "sync-errors";
type ReportFormat = "csv" | "pdf" | "excel" | "word" | "zip";
type OperationsPanelKey =
  | "snapshot"
  | "lifecycle"
  | "scoring"
  | "post-defense"
  | "audit-report";

type PreviewModalType = "meeting" | "scoreSheet" | "reviewer";

type PipelineOverview = {
  defenseTermId?: number;
  overallCompletionPercent?: number;
  totalTopics?: number;
  eligibleTopics?: number;
  assignedTopics?: number;
  scoredTopics?: number;
  pendingRevisionCount?: number;
  approvedRevisionCount?: number;
  rejectedRevisionCount?: number;
};

type AnalyticsOverview = {
  totalStudents?: number;
  totalRecords?: number;
  average?: number;
  passRate?: number;
  maxVariance?: number;
};

type DistributionOverview = {
  excellent?: number;
  good?: number;
  fair?: number;
  weak?: number;
  series?: Array<{ label: string; count: number }>;
};

type DistributionViewMode = "grade" | "score";

type MonitoringSnapshot = {
  pipeline?: PipelineOverview & { waitingPublicTopics?: number };
  period?: Record<string, unknown>;
  analytics?: {
    overview?: AnalyticsOverview;
    byCouncil?: Array<Record<string, unknown>>;
    distribution?: DistributionOverview;
  };
  scoring?: {
    progress?: Array<{
      committeeId: number;
      committeeCode: string;
      totalAssignments: number;
      completedAssignments: number;
      waitingPublicAssignments: number;
      progressPercent: number;
    }>;
    alerts?: Array<Record<string, unknown>>;
  };
  tags?: Record<string, unknown>;
};

type ScoringMatrixRow = {
  committeeId?: number;
  committeeCode?: string;
  committeeName?: string;
  scheduledAt?: string;
  assignmentId?: number;
  assignmentCode?: string;
  topicCode?: string;
  topicTitle?: string;
  studentCode?: string;
  studentName?: string;
  className?: string;
  cohortCode?: string;
  startTime?: string;
  endTime?: string;
  submittedCount?: number;
  requiredCount?: number;
  isLocked?: boolean;
  room?: string;
  supervisorName?: string;
  supervisorLecturerName?: string;
  chair?: string;
  chairName?: string;
  committeeChair?: string;
  committeeChairName?: string;
  committeeChairCode?: string;
  secretary?: string;
  secretaryName?: string;
  committeeSecretary?: string;
  committeeSecretaryName?: string;
  committeeSecretaryCode?: string;
  reviewer?: string;
  reviewerName?: string;
  committeeReviewer?: string;
  committeeReviewerName?: string;
  committeeReviewerCode?: string;
  currentScore?: number;
  progressPercent?: number;
  scoreGvhd?: number;
  scoreCt?: number;
  scoreTk?: number;
  scorePb?: number;
  finalScore?: number;
  finalGrade?: string;
  variance?: number;
  status?: string;
  commentGvhd?: string | null;
  commentCt?: string | null;
  commentTk?: string | null;
  commentPb?: string | null;
  topicSupervisorScore?: number;
  defenseDocuments?: Array<Record<string, unknown>>;
  revisionReason?: string;
  submissionDeadline?: string;
  secretaryComment?: string;
  documentCount?: number;
  supervisorLecturerCode?: string;
  supervisorOrganization?: string;
  sessionCode?: string;
  isPassed?: boolean;
  revisionFileUrl?: string;
};

type PostDefenseItem = {
  revisionId?: number;
  assignmentId?: number;
  committeeCode?: string;
  studentCode?: string;
  studentName?: string;
  proposerStudentName?: string;
  proposerStudentCode?: string;
  topicCode?: string;
  topicTitle?: string;
  status?: string;
  revisionStatus?: string;
  finalStatus?: string;
  submittedAt?: string;
  reviewedAt?: string;
  note?: string;
  revisionReason?: string;
  submissionDeadline?: string;
  reviewerName?: string;
  reviewer?: string;
  revisionFileUrl?: string;
  isPassed?: boolean;
};

type PostDefenseOverview = {
  defenseTermId?: number;
  totalRevisions?: number;
  pendingRevisions?: number;
  approvedRevisions?: number;
  rejectedRevisions?: number;
  publishedScores?: number;
  lockedScores?: number;
  items?: PostDefenseItem[];
};

type AuditOverview = {
  syncHistory?: Array<Record<string, unknown>>;
  publishHistory?: Array<Record<string, unknown>>;
  councilAuditHistory?: Array<Record<string, unknown>>;
  revisionAuditTrail?: Array<Record<string, unknown>>;
};

type ReportingOverview = {
  supportedReportTypes?: string[];
  defaultFormat?: string;
  recentExports?: Array<Record<string, unknown>>;
};

type NavigatorFilter = "all" | "active" | "delayed" | "warning" | "completed";
type ProgressFilter = "all" | "under-50" | "50-80" | "80-100";
type AuditActionFilter = "all" | "open" | "submit" | "reopen" | "lock" | "publish" | "sync";
type CommitteeExportType = "scoreboard" | "minutes" | "review";
// PreviewModalType is already defined above at line 94.

type ExportScopeMode = "per-period" | "per-council" | "per-topic" | "free-config";
type ExportTemplateMode = "dashboard" | "scoring" | "post-defense" | "councils" | "topics" | "official-transcript" | "council-minutes" | "statistics" | "custom";

type ExportFieldOption = {
  key: string;
  label: string;
};

type ExportFieldGroup = {
  key: string;
  label: string;
  fields: ExportFieldOption[];
};

type DashboardAlertSeverity = "critical" | "warning" | "info";

type DashboardAlert = {
  severity: DashboardAlertSeverity;
  title: string;
  detail: string;
  committeeCode: string;
  focusKey: string;
  priority: number;
};

type CommitteeSummary = {
  key: string;
  code: string;
  name: string;
  room: string;
  chair: string;
  chairCode?: string;
  secretary: string;
  secretaryCode?: string;
  reviewer: string;
  reviewerCode?: string;
  totalTopics: number;
  scoredTopics: number;
  lockedTopics: number;
  status: string;
  currentTopic: string;
  currentStudent: string;
  progressPercent: number;
  estimatedCompletion: string;
  delayLabel: string;
  avgScore?: number;
  defenseDate?: string;
};

type LeaderboardEntry = {
  label: string;
  title: string;
  score: string;
  committee: string;
  detail: string;
};

type OperationsSnapshotData = {
  defenseTermId?: number;
  state?: Record<string, unknown>;
  monitoring?: MonitoringSnapshot;
  committees?: CommitteeSummary[];
  councils?: {
    items?: Array<Record<string, unknown>>;
    totalCount?: number;
    page?: number;
    pageSize?: number;
  };
  scoringMatrix?: ScoringMatrixRow[];
  progressTracking?: Record<string, unknown>;
  postDefense?: PostDefenseOverview;
  audit?: AuditOverview;
  reporting?: ReportingOverview;
};


const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "16px",
  padding: "24px",
  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
  transition: "transform 0.2s ease, box-shadow 0.2s ease",
};

const selectControlStyle: React.CSSProperties = {
  minHeight: 42,
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "0 36px 0 16px",
  backgroundColor: "#ffffff",
  color: "#1e293b",
  fontSize: 14,
  fontWeight: 600,
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  backgroundImage:
    "linear-gradient(45deg, transparent 50%, #64748b 50%), linear-gradient(135deg, #64748b 50%, transparent 50%)",
  backgroundPosition:
    "calc(100% - 20px) calc(50% - 2px), calc(100% - 15px) calc(50% - 2px)",
  backgroundSize: "5px 5px, 5px 5px",
  backgroundRepeat: "no-repeat",
  outline: "none",
  transition: "border-color 0.2s",
};

const tableHeadCellStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "16px",
  borderBottom: "1px solid #e2e8f0",
  color: "#64748b",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  background: "#f8fafc",
};

const tableCellStyle: React.CSSProperties = {
  padding: "16px",
  borderBottom: "1px solid #f1f5f9",
  color: "#1e293b",
  fontSize: 14,
};

const actionIconButtonStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  color: "#64748b",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const dangerActionIconButtonStyle: React.CSSProperties = {
  ...actionIconButtonStyle,
  border: "1px solid #fee2e2",
  color: "#ef4444",
};

const emptyStateCardStyle: React.CSSProperties = {
  ...cardStyle,
  borderStyle: "dashed",
  borderWidth: "2px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 200,
  color: "#94a3b8",
  gap: "16px",
};

const panelTabs: Array<{
  key: OperationsPanelKey;
  label: string;
  icon: React.ReactNode;
}> = [
  { key: "snapshot", label: "Tổng quan", icon: <Search size={15} /> },
  { key: "lifecycle", label: "Vòng đời", icon: <Activity size={15} /> },
  { key: "scoring", label: "Chấm điểm", icon: <BarChart3 size={15} /> },
  {
    key: "post-defense",
    label: "Hậu bảo vệ",
    icon: <FileSpreadsheet size={15} />,
  },
  {
    key: "audit-report",
    label: "Kiểm toán & báo cáo",
    icon: <Download size={15} />,
  },
];

type ToneStyle = {
  bg: string;
  border: string;
  text: string;
};

const normalizeStatusKey = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

// Deep Blue Primary Palette
const DEEP_BLUE_PRIMARY = "#1e3a5f";
const DEEP_BLUE_HOVER = "#0f1e36";
const LIGHT_BLUE_BG = "#e0f2fe";
const LIGHT_BLUE_SOFTEN = "#f0f4f8";

const statusToneMap: Record<string, ToneStyle> = {
  // Semantic Success states - Green
  APPROVED: { bg: "#f0fdf4", border: "none", text: "#15803d" },
  SUBMITTED: { bg: "#f0f9ff", border: "none", text: "#0369a1" },
  REOPENED: { bg: "#fef2f2", border: "none", text: "#991b1b" },
  COMPLETED: { bg: "#f0fdf4", border: "none", text: "#15803d" },
  PUBLISHED: { bg: "#f0fdf4", border: "none", text: "#15803d" },
  // Semantic Alert/Warning states - Red
  REJECTED: { bg: "#fef2f2", border: "none", text: "#991b1b" },
  DELAYED: { bg: "#fef2f2", border: "none", text: "#991b1b" },
  // Operations states - Deep Blue harmony
  PENDING: { bg: "#f1f5f9", border: "none", text: "#475569" },
  LOCKED: { bg: "#fee2e2", border: "none", text: "#991b1b" },
  IN_PROGRESS: { bg: "#eff6ff", border: "none", text: "#1d4ed8" },
  ONGOING: { bg: "#eff6ff", border: "none", text: "#1d4ed8" },
  FINALIZED: { bg: "#f5f3ff", border: "none", text: "#6d28d9" },
  // Active primary state
  READY: { bg: DEEP_BLUE_PRIMARY, border: "none", text: "#ffffff" },
  // Neutral states
  DRAFT: { bg: "#f8fafc", border: "none", text: "#64748b" },
  ARCHIVED: { bg: "#f8fafc", border: "none", text: "#64748b" },
  WARNING: { bg: "#fffbeb", border: "none", text: "#b45309" },
  WAITING_PUBLIC: { bg: "#fffbeb", border: "none", text: "#b45309" },
  STUDENT_SUBMITTED: { bg: "#f0f9ff", border: "none", text: "#0369a1" },
  WAITING_STUDENT: { bg: "#fff7ed", border: "none", text: "#ea580c" },
  EXPIRED: { bg: "#f1f5f9", border: "none", text: "#64748b" },
  "2": { bg: "#f0f9ff", border: "none", text: "#0369a1" },
  "1": { bg: "#fff7ed", border: "none", text: "#ea580c" },
};

const statusLabelMap: Record<string, string> = {
  APPROVED: "Đã duyệt",
  SUBMITTED: "Đã nộp",
  REOPENED: "Đã mở lại",
  PENDING: "Chờ xử lý",
  REJECTED: "Từ chối",
  LOCKED: "Đã khóa",
  IN_PROGRESS: "Đang xử lý",
  ONGOING: "Đang diễn ra",
  COMPLETED: "Đã hoàn thành",
  DELAYED: "Đang trễ",
  DRAFT: "Nháp",
  READY: "Ready",
  FINALIZED: "Đã chốt",
  PUBLISHED: "Đã công bố",
  ARCHIVED: "Đã lưu trữ",
  WARNING: "Cảnh báo",
  WAITING_PUBLIC: "Chờ công bố",
  STUDENT_SUBMITTED: "Đã nộp lại",
  WAITING_STUDENT: "Chờ sinh viên",
  EXPIRED: "Quá hạn",
  "2": "Đã nộp lại",
  "1": "Chờ sinh viên",
  "3": "Đã duyệt",
  "4": "Từ chối",
  "5": "Quá hạn",
};

const getStatusTone = (value: string | null | undefined): ToneStyle => {
  const normalized = normalizeStatusKey(value);
  return statusToneMap[normalized] ?? statusToneMap.DRAFT;
};

const getStatusLabel = (value: string | null | undefined) => {
  const normalized = normalizeStatusKey(value);
  return statusLabelMap[normalized] ?? (String(value ?? "-").trim() || "-");
};

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const normalizeLookupKey = (value: string | null | undefined) => String(value ?? "").trim().toLowerCase();

const getRecordValue = (record: Record<string, unknown> | null | undefined, key: string) => {
  if (!record) {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(record, key)) {
    return record[key];
  }

  const normalizedKey = normalizeLookupKey(key);
  if (!normalizedKey) {
    return undefined;
  }

  for (const [candidateKey, candidateValue] of Object.entries(record)) {
    if (normalizeLookupKey(candidateKey) === normalizedKey) {
      return candidateValue;
    }
  }

  return undefined;
};

const toText = (value: unknown, fallback = "-") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const pickText = (record: Record<string, unknown> | null | undefined, keys: string[], fallback = "-") => {
  if (!record) {
    return fallback;
  }

  for (const key of keys) {
    const value = getRecordValue(record, key);
    const text = String(value ?? "").trim();
    if (text) {
      return text;
    }
  }

  return fallback;
};

const pickNumber = (record: Record<string, unknown> | null | undefined, keys: string[], fallback = 0) => {
  if (!record) {
    return fallback;
  }

  for (const key of keys) {
    const value = Number(getRecordValue(record, key));
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return fallback;
};

const pickRowText = (rows: ScoringMatrixRow[], keys: string[], fallback = "-") => {
  for (const row of rows) {
    for (const key of keys) {
      const value = getRecordValue(row as Record<string, unknown>, key);
      const text = String(value ?? "").trim();
      if (text) {
        return text;
      }
    }
  }
  return fallback;
};

const reportTypeOptions: Array<{ value: ReportType; label: string; description: string }> = [
  {
    value: "council-summary",
    label: "Tổng hợp hội đồng",
    description: "Danh sách hội đồng, phòng, trạng thái và tiến độ tổng hợp.",
  },
  {
    value: "scoreboard",
    label: "Bảng điểm hội đồng",
    description: "Template bảng điểm riêng cho từng hội đồng.",
  },
  {
    value: "minutes",
    label: "Biên bản hội đồng",
    description: "Template biên bản phiên bảo vệ theo hội đồng.",
  },
  {
    value: "review",
    label: "Nhận xét hội đồng",
    description: "Template nhận xét tổng hợp theo đề tài.",
  },
  {
    value: "form-1",
    label: "Form-1 (tương thích cũ)",
    description: "Giữ tương thích API cũ, map về bảng điểm hội đồng.",
  },
  {
    value: "final-term",
    label: "Kết quả cuối kỳ",
    description: "Bộ dữ liệu kết quả, điểm và trạng thái sau chốt.",
  },
  {
    value: "sync-errors",
    label: "Lỗi đồng bộ",
    description: "Danh sách các bản ghi cần rà soát hoặc đồng bộ lại.",
  },
];

const reportFormatOptions: Array<{ value: ReportFormat; label: string; description: string }> = [
  { value: "pdf", label: "PDF", description: "Biên bản, phiếu chấm, tổng hợp kết quả" },
  { value: "excel", label: "Excel", description: "Bảng điểm, tiến độ, thống kê" },
  { value: "csv", label: "CSV", description: "Điểm thô / dữ liệu phẳng" },
  { value: "word", label: "Word", description: "Biên bản họp / văn bản xuất" },
  { value: "zip", label: "ZIP", description: "Toàn bộ hồ sơ hội đồng" },
];

const navigatorFilterOptions: Array<{ value: NavigatorFilter; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "active", label: "Hoạt động" },
  { value: "delayed", label: "Trễ" },
  { value: "warning", label: "Cảnh báo" },
  { value: "completed", label: "Hoàn thành" },
];

const progressFilterOptions: Array<{ value: ProgressFilter; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "under-50", label: "< 50%" },
  { value: "50-80", label: "50% - 80%" },
  { value: "80-100", label: ">= 80%" },
];

const auditActionOptions: Array<{ value: AuditActionFilter; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "open", label: "Mở ca" },
  { value: "submit", label: "Submit" },
  { value: "reopen", label: "Mở lại" },
  { value: "lock", label: "Khóa" },
  { value: "publish", label: "Công bố" },
  { value: "sync", label: "Đồng bộ" },
];

const committeeExportOptions = [
  { value: "scoreboard", label: "Bảng điểm hội đồng" },
  { value: "minutes", label: "Biên bản hội đồng" },
  { value: "review", label: "Nhận xét từng đề tài" },
];

const exportScopeOptions: Array<{ value: ExportScopeMode; label: string }> = [
  { value: "per-period", label: "Toàn đợt đồ án tốt nghiệp" },
  { value: "per-council", label: "Theo hội đồng" },
  { value: "per-topic", label: "Theo đề tài" },
  { value: "free-config", label: "Theo sinh viên" },
];



const exportTemplateOptions: Array<{ value: ExportTemplateMode; label: string; description: string; icon: React.ReactNode }> = [
  {
    value: "dashboard",
    label: "Dashboard",
    description: "Báo cáo tổng hợp điều hành",
    icon: <BarChart3 size={16} />,
  },
  {
    value: "scoring",
    label: "Scoring Matrix",
    description: "Bảng điểm chi tiết bảo vệ",
    icon: <FileSpreadsheet size={16} />,
  },
  {
    value: "post-defense",
    label: "Post Defense",
    description: "Danh sách hậu bảo vệ",
    icon: <Archive size={16} />,
  },
  {
    value: "councils",
    label: "Council List",
    description: "Danh sách hội đồng bảo vệ",
    icon: <Users size={16} />,
  },
  {
    value: "topics",
    label: "Topic List",
    description: "Danh sách đề tài bảo vệ",
    icon: <Table size={16} />,
  },
  {
    value: "custom",
    label: "Xuất bảng điểm tùy chọn",
    description: "Tự cấu hình các trường cần xuất",
    icon: <Settings size={16} />,
  },
];

const exportFieldGroups: ExportFieldGroup[] = [
  {
    key: "student",
    label: "Sinh viên",
    fields: [
      { key: "StudentCode", label: "MSSV" },
      { key: "StudentName", label: "Họ tên" },
      { key: "ClassName", label: "Lớp" },
      { key: "CohortCode", label: "Khóa" },
    ],
  },
  {
    key: "topic",
    label: "Đề tài",
    fields: [
      { key: "TopicCode", label: "Mã đề tài" },
      { key: "TopicTitle", label: "Tên đề tài" },
      { key: "TopicTags", label: "Tag chuyên môn" },
      { key: "AssignmentCode", label: "Mã phân công" },
      { key: "AssignmentId", label: "ID Phân công" },
    ],
  },
  {
    key: "supervisor",
    label: "GVHD",
    fields: [
      { key: "SupervisorLecturerName", label: "Tên GVHD" },
      { key: "SupervisorLecturerCode", label: "Mã GVHD" },
      { key: "SupervisorOrganization", label: "Đơn vị GVHD" },
      { key: "ScoreGvhd", label: "Điểm GVHD" },
      { key: "CommentGvhd", label: "Nhận xét GVHD" },
    ],
  },
  {
    key: "committee",
    label: "Hội đồng",
    fields: [
      { key: "CommitteeCode", label: "Mã hội đồng" },
      { key: "CommitteeId", label: "ID Hội đồng" },
      { key: "CommitteeName", label: "Tên hội đồng" },
      { key: "CommitteeChairName", label: "Chủ tịch" },
      { key: "CommitteeChairCode", label: "Mã Chủ tịch" },
      { key: "CommitteeSecretaryName", label: "Thư ký" },
      { key: "CommitteeSecretaryCode", label: "Mã Thư ký" },
      { key: "CommitteeReviewerName", label: "Phản biện" },
      { key: "CommitteeReviewerCode", label: "Mã Phản biện" },
      { key: "Room", label: "Phòng" },
    ],
  },
  {
    key: "score",
    label: "Điểm",
    fields: [
      { key: "ScoreCt", label: "Điểm CT" },
      { key: "ScoreTk", label: "Điểm TK" },
      { key: "ScorePb", label: "Điểm PB" },
      { key: "ScoreGvhd", label: "Điểm GVHD" },
      { key: "Score", label: "Điểm tổng" },
      { key: "Grade", label: "Xếp loại" },
      { key: "Variance", label: "Độ lệch (Variance)" },
      { key: "CommentCt", label: "Nhận xét CT" },
      { key: "CommentTk", label: "Nhận xét TK" },
      { key: "CommentPb", label: "Nhận xét PB" },
      { key: "IsPassed", label: "Kết quả (Đạt/Không)" },
      { key: "FinalGrade", label: "Xếp loại (Text)" },
      { key: "FinalScore", label: "Điểm tổng (Text)" },
      { key: "TopicSupervisorScore", label: "Điểm HD nguyên bản" },
      { key: "VarianceStatus", label: "Trạng thái lệch điểm" },
      { key: "ResultStatus", label: "Trạng thái kết quả" },
    ],
  },
  {
    key: "time",
    label: "Thời gian",
    fields: [
      { key: "DefenseDate", label: "Ngày bảo vệ" },
      { key: "Session", label: "Buổi" },
      { key: "StartTime", label: "Giờ bắt đầu" },
      { key: "EndTime", label: "Giờ kết thúc" },
    ],
  },
  {
    key: "audit",
    label: "Audit / Trạng thái",
    fields: [
      { key: "Status", label: "Trạng thái" },
      { key: "IsLocked", label: "Đã khóa" },
      { key: "SubmittedCount", label: "Số đã nộp" },
      { key: "RequiredCount", label: "Số cần nộp" },
      { key: "RevisionReason", label: "Lý do nộp hậu" },
      { key: "SubmissionDeadline", label: "Hạn nộp hậu" },
      { key: "SecretaryComment", label: "Nhận xét thư ký" },
    ],
  },
  {
    key: "document",
    label: "Tài liệu",
    fields: [{ key: "DocumentCount", label: "Số tài liệu" }],
  },
  {
    key: "system",
    label: "Hệ thống",
    fields: [
      { key: "TopicId", label: "ID Đề tài" },
      { key: "SupervisorLecturerId", label: "ID GVHD" },
      { key: "IsOnline", label: "Trực tuyến" },
      { key: "MeetingUrl", label: "Link họp" },
      { key: "DefenseSessionCode", label: "Mã ca" },
    ],
  },
];

const exportTemplateFieldPresets: Record<ExportTemplateMode, string[]> = {
  dashboard: ["StudentCode", "StudentName", "TopicTitle", "CommitteeCode", "Status", "Score"],
  scoring: ["StudentCode", "StudentName", "TopicTitle", "CommitteeCode", "ScoreCt", "ScoreTk", "ScorePb", "ScoreGvhd", "Score", "Grade", "Variance"],
  "post-defense": [
    "StudentCode",
    "StudentName",
    "TopicTitle",
    "CommitteeCode",
    "RevisionReason",
    "SubmissionDeadline",
    "Status",
    "IsLocked",
  ],
  councils: ["CommitteeCode", "CommitteeChairName", "CommitteeSecretaryName", "CommitteeReviewerName", "Room"],
  topics: ["TopicCode", "TopicTitle", "StudentName", "CommitteeCode", "Status"],
  "official-transcript": [
    "StudentCode",
    "StudentName",
    "TopicTitle",
    "CommitteeCode",
    "ScoreCt",
    "ScoreTk",
    "ScorePb",
    "ScoreGvhd",
    "Score",
    "Grade",
  ],
  "council-minutes": [
    "StudentCode",
    "StudentName",
    "TopicTitle",
    "CommitteeChairName",
    "CommitteeSecretaryName",
    "CommitteeReviewerName",
    "ScoreCt",
    "ScoreTk",
    "ScorePb",
    "ScoreGvhd",
    "Grade",
    "Status",
  ],
  statistics: [
    "CommitteeCode",
    "StudentCode",
    "StudentName",
    "Score",
    "Grade",
    "Variance",
    "Status",
    "IsLocked",
  ],
  custom: ["StudentCode", "StudentName", "TopicTitle", "Score", "Grade"],
};

const formatCompactDuration = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "0m";
  }

  const totalMinutes = Math.round(minutes);
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${remainingMinutes}m`;
  }

  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

const parseDateValue = (value: string | null | undefined) => {
  const text = String(value ?? "").trim();
  if (!text || text === "-") {
    return null;
  }

  // Handle D/M/YYYY or DD/MM/YYYY format
  if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}/.test(text)) {
    const parts = text.split(/[\/-]/);
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (!Number.isNaN(d.getTime())) {
      return d;
    }
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildSparklinePoints = (values: number[], width = 88, height = 26) => {
  if (values.length === 0) {
    return `0,${height}`;
  }

  const maxValue = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : 0;

  return values
    .map((value, index) => {
      const x = Math.round(index * step);
      const y = Math.round(height - (value / maxValue) * (height - 2));
      return `${x},${y}`;
    })
    .join(" ");
};

const normalizeCommitteeStatus = (value: string | null | undefined) => {
  const normalized = normalizeStatusKey(value);
  if (normalized.includes("PUBLISHED") || normalized === "PUBLISHED") {
    return "PUBLISHED";
  }
  if (normalized.includes("LOCKED") || normalized === "LOCKED" || normalized.includes("CHOT")) {
    return "LOCKED";
  }
  if (normalized.includes("READY") || normalized === "READY") {
    return "READY";
  }
  if (normalized.includes("DELAY")) {
    return "DELAYED";
  }
  return "ONGOING";
};

const getCommitteeCompletionLabel = (scoredTopics: number, totalTopics: number) => {
  if (totalTopics <= 0) {
    return "0%";
  }

  return `${Math.min(100, Math.round((scoredTopics / totalTopics) * 100))}%`;
};

const distributionPalette: Record<string, string> = {
  "A+": "#16a34a",
  "A": "#22c55e",
  "B+": "#84cc16",
  "B": "#0ea5e9",
  "C+": "#f59e0b",
  "C": "#f97316",
  "D+": "#ef4444",
  "D": "#dc2626",
  "F": "#991b1b",
  "9.0 - 10": "#16a34a",
  "8.0 - < 9.0": "#0ea5e9",
  "7.0 - < 8.0": "#f59e0b",
  "5.0 - < 7.0": "#f97316",
  "< 5.0": "#ef4444",
};

const GRADE_BANDS = [
  { label: "A+", min: 9.0, max: 10.0 },
  { label: "A", min: 8.5, max: 9.0 },
  { label: "B+", min: 8.0, max: 8.5 },
  { label: "B", min: 7.0, max: 8.0 },
  { label: "C+", min: 6.5, max: 7.0 },
  { label: "C", min: 5.5, max: 6.5 },
  { label: "D+", min: 5.0, max: 5.5 },
  { label: "D", min: 4.0, max: 5.0 },
  { label: "F", min: 0.0, max: 4.0 },
] as const;

const SCORE_BANDS = [
  { label: "9.0 - 10", min: 9.0, max: 10.0, inclusiveMax: true },
  { label: "8.0 - < 9.0", min: 8.0, max: 9.0 },
  { label: "7.0 - < 8.0", min: 7.0, max: 8.0 },
  { label: "5.0 - < 7.0", min: 5.0, max: 7.0 },
  { label: "< 5.0", min: 0.0, max: 5.0 },
] as const;

const getGradeFromScore = (score: number) => {
  if (!Number.isFinite(score)) {
    return "-";
  }
  if (score >= 9.0) return "A+";
  if (score >= 8.5) return "A";
  if (score >= 8.0) return "B+";
  if (score >= 7.0) return "B";
  if (score >= 6.5) return "C+";
  if (score >= 5.5) return "C";
  if (score >= 5.0) return "D+";
  if (score >= 4.0) return "D";
  return "F";
};

const getScoreBandLabel = (score: number): string => {
  if (!Number.isFinite(score)) {
    return "-";
  }

  if (score >= 9) return "9.0 - 10";
  if (score >= 8) return "8.0 - < 9.0";
  if (score >= 7) return "7.0 - < 8.0";
  if (score >= 5) return "5.0 - < 7.0";
  return "< 5.0";
};

const sortStudentRows = (
  rows: ScoringMatrixRow[],
  sortField: "studentCode" | "studentName" | "topicTitle" | "finalScore" | "committeeCode",
  sortDir: "asc" | "desc"
): ScoringMatrixRow[] => {
  const sorted = [...rows].sort((a, b) => {
    let aVal: any, bVal: any;
    
    if (sortField === "studentCode") {
      aVal = (a.studentCode || "").toLowerCase();
      bVal = (b.studentCode || "").toLowerCase();
    } else if (sortField === "studentName") {
      aVal = (a.studentName || "").toLowerCase();
      bVal = (b.studentName || "").toLowerCase();
    } else if (sortField === "topicTitle") {
      aVal = (a.topicTitle || "").toLowerCase();
      bVal = (b.topicTitle || "").toLowerCase();
    } else if (sortField === "finalScore") {
      aVal = Number(a.finalScore ?? a.currentScore ?? 0);
      bVal = Number(b.finalScore ?? b.currentScore ?? 0);
    } else if (sortField === "committeeCode") {
      aVal = (a.committeeCode || "").toLowerCase();
      bVal = (b.committeeCode || "").toLowerCase();
    }
    
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
  
  return sorted;
};

const buildDistributionRows = (
  rows: ScoringMatrixRow[],
  mode: DistributionViewMode,
) => {
  const buckets = mode === "grade" ? GRADE_BANDS.map((band) => ({ label: band.label, value: 0 })) : SCORE_BANDS.map((band) => ({ label: band.label, value: 0 }));

  rows.forEach((row) => {
    const score = Number(row.finalScore ?? row.currentScore ?? NaN);
    if (!Number.isFinite(score)) {
      return;
    }

    const label = mode === "grade" ? getGradeFromScore(score) : getScoreBandLabel(score);
    const bucket = buckets.find((item) => item.label === label);
    if (bucket) {
      bucket.value += 1;
    }
  });

  return buckets;
};

const toApiExportFormat = (format: ReportFormat | "word" | "pdf") => {
  if (format === "excel") return "xlsx";
  if (format === "word") return "docx";
  return format;
};

// --- GLOBAL UTILITY COMPONENTS ---

const ModalOverlay: React.FC<{ onClose: () => void; children: React.ReactNode; width?: number | string }> = ({ onClose, children, width = 800 }) => {
  return ReactDOM.createPortal(
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(15, 23, 42, 0.7)",
      backdropFilter: "blur(8px)",
      zIndex: 999999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      animation: "fadeIn 0.3s ease"
    }} onClick={onClose}>
      <div style={{
        background: "white",
        width: "100%",
        maxWidth: width,
        maxHeight: "90vh",
        borderRadius: 32,
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        animation: "modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)"
      }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
};

const CommitteeOperationsManagement: React.FC = () => {
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const queryPeriodId = normalizeDefensePeriodId(searchParams.get("periodId"));
  const [periodId, setPeriodId] = useState<number | null>(
    () => queryPeriodId ?? getActiveDefensePeriodId(),
  );
  const defensePeriodBase = periodId ? `/defense-periods/${periodId}` : "";
  const missingPeriodWarningRef = useRef(false);
  const commandBarRef = useRef<HTMLDivElement | null>(null);
  const committeeSearchInputRef = useRef<HTMLInputElement | null>(null);


  const [snapshot, setSnapshot] = useState<OperationsSnapshotData | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);
  const [backendAllowedActions, setBackendAllowedActions] = useState<string[]>(
    [],
  );
  const [lastLoadedAt, setLastLoadedAt] = useState<string>("");

  const [committeeIdFilter, setCommitteeIdFilter] = useState("");
  const [navigatorFilter, setNavigatorFilter] = useState<NavigatorFilter>("all");
  const [committeeRoomFilter, setCommitteeRoomFilter] = useState("");
  const [committeeChairFilter, setCommitteeChairFilter] = useState("");
  const [revisionStatus, setRevisionStatus] = useState<RevisionStatus>("all");
  const [isPassedFilter, setIsPassedFilter] = useState<string>("all");
  const [revisionKeyword, setRevisionKeyword] = useState("");
  const [revisionPage, setRevisionPage] = useState(1);
  const [revisionSize, setRevisionSize] = useState(20);

  // Preview Modal States
  const [previewModalType, setPreviewModalType] = useState<PreviewModalType | null>(null);
  const [selectedMatrixRow, setSelectedMatrixRow] = useState<ScoringMatrixRow | null>(null);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const [isDownloadingPreviewFile, setIsDownloadingPreviewFile] = useState(false);

  const [review, setReview] = useState("");
  const [questions, setQuestions] = useState("");
  const [answers, setAnswers] = useState("");
  const [questionAnswers, setQuestionAnswers] = useState<any[]>([]);
  const [strengths, setStrengths] = useState("");
  const [weaknesses, setWeaknesses] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [chapterContents, setChapterContents] = useState<any[]>([]);
  const [reviewerSections, setReviewerSections] = useState<any>({
    necessity: "",
    novelty: "",
    methodologyReliability: "",
    resultsContent: "",
    limitations: "",
    suggestions: "",
    overallConclusion: "",
  });
  const [auditSize, setAuditSize] = useState(50);
  const [auditKeyword, setAuditKeyword] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState<AuditActionFilter>("all");
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [commandBarHeight, setCommandBarHeight] = useState(0);
  const [committeeStatusOverrides, setCommitteeStatusOverrides] = useState<Record<string, string>>({});
  const [showScoringMatrix, setShowScoringMatrix] = useState(false);
  const [analyticsTopics, setAnalyticsTopics] = useState<ScoringMatrixRow[]>([]);
  const [analyticsDistribution, setAnalyticsDistribution] = useState<DistributionOverview | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [distributionViewMode, setDistributionViewMode] = useState<DistributionViewMode>("grade");
  const [distributionChartType, setDistributionChartType] = useState<"pie" | "bar" | "line">("pie");
  const [distributionChartMenuOpen, setDistributionChartMenuOpen] = useState(false);
  const [committeeStatsPage, setCommitteeStatsPage] = useState(1);
  const committeeStatsPageSize = 5;
  const distributionChartMenuRef = useRef<HTMLDivElement | null>(null);
  const exportDownloadMenuRef = useRef<HTMLDivElement | null>(null);

  // Council / scoring UI state
  const [scoringModalOpen, setScoringModalOpen] = useState(false);
  const [selectedCouncilCode, setSelectedCouncilCode] = useState<string | null>(null);
  const [selectedCouncilNumericId, setSelectedCouncilNumericId] = useState<number | null>(null);
  const [selectedCouncilRow, setSelectedCouncilRow] = useState<Record<string, unknown> | null>(null);
  const [topicDetailModalOpen, setTopicDetailModalOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<ScoringMatrixRow | null>(null);
  const [studentTablePage, setStudentTablePage] = useState(1);
  const studentTablePageSize = 10;
  const [studentTableIsPassedFilter, setStudentTableIsPassedFilter] = useState<boolean | "all">("all");
  const [studentTableStatusFilter, setStudentTableStatusFilter] = useState<"all" | "post-defense" | "locked" | "scoring">("all");
  const [studentTableSortField, setStudentTableSortField] = useState<"studentCode" | "studentName" | "topicTitle" | "finalScore" | "committeeCode">("finalScore");
  const [studentTableSortDir, setStudentTableSortDir] = useState<"asc" | "desc">("desc");
  const [hoveredDistributionLabel, setHoveredDistributionLabel] = useState<string | null>(null);
  const [reportType, setReportType] = useState<ReportType>("council-summary");
  const [committeeExportType, setCommitteeExportType] = useState<CommitteeExportType>("scoreboard");

  const [reportFormat, setReportFormat] = useState<ReportFormat>("csv");
  const [reportCouncilId, setReportCouncilId] = useState("");
  const [exportScopeMode, setExportScopeMode] = useState<ExportScopeMode>("per-period");
  const [exportTemplateMode, setExportTemplateMode] = useState<ExportTemplateMode>("dashboard");
  const [exportFieldSearch, setExportFieldSearch] = useState("");
  const [exportIsPassed, setExportIsPassed] = useState<boolean | null>(null);
  const [exportTopicKeyword, setExportTopicKeyword] = useState("");
  const [exportOnlyLocked, setExportOnlyLocked] = useState(true);
  const [exportOnlyPublished, setExportOnlyPublished] = useState(true);
  const [exportSelectedFields, setExportSelectedFields] = useState<string[]>(() => exportTemplateFieldPresets["dashboard"]);
  const [exportExpandedGroups, setExportExpandedGroups] = useState<string[]>(() => exportFieldGroups.map((group) => group.key));
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportIncludeLogo, setExportIncludeLogo] = useState(true);
  const [exportIncludeSignature, setExportIncludeSignature] = useState(true);
  const [exportPasswordProtect, setExportPasswordProtect] = useState(false);
  const [exportDownloadMenuOpen, setExportDownloadMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportPreviewModalOpen, setExportPreviewModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "analytics" | "committee" | "post-defense" | "export" | "audit">("overview");
  
  // System logs state
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [logsTotalCount, setLogsTotalCount] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPageSize, setLogsPageSize] = useState(10);
  const [logsSearch, setLogsSearch] = useState("");
  const [logsActionFilter, setLogsActionFilter] = useState("all");
  const [logsModuleFilter, setLogsModuleFilter] = useState("all");
  const [logsImportantOnly, setLogsImportantOnly] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedLogDetail, setSelectedLogDetail] = useState<any | null>(null);
  // System logs export state
  const [logExportModalOpen, setLogExportModalOpen] = useState(false);
  const [logExportSelectedFields, setLogExportSelectedFields] = useState<string[]>([
    "PerformedAt",
    "UserCode",
    "Module",
    "ActionType",
    "ActionDescription",
    "Status",
  ]);
  const [logExportFormat, setLogExportFormat] = useState<ReportFormat>("excel");
  const [logIsExporting, setLogIsExporting] = useState(false);

  const [loadingProgress, setLoadingProgress] = useState(0);
  const [activeRowActionId, setActiveRowActionId] = useState<string | null>(null);

  useEffect(() => {
    const handleClick = () => setActiveRowActionId(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDownloadMenuRef.current && !exportDownloadMenuRef.current.contains(event.target as Node)) {
        setExportDownloadMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if ((loadingSnapshot || analyticsLoading) && !snapshot) {
      setLoadingProgress(0);
      const interval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 95) return prev;
          const remaining = 100 - prev;
          return prev + remaining * 0.1;
        });
      }, 200);
      return () => clearInterval(interval);
    } else {
      setLoadingProgress(0);
    }
  }, [loadingSnapshot, analyticsLoading, snapshot]);

  const renderLoading = () => {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
        background: "#ffffff",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Be Vietnam Pro', sans-serif"
      }}>
        {/* Animated Background Elements */}
        <div style={{
          position: "absolute",
          top: "-10%",
          left: "-5%",
          width: "40%",
          height: "40%",
          background: "radial-gradient(circle, rgba(30, 58, 95, 0.06) 0%, transparent 70%)",
          filter: "blur(40px)",
          animation: "float 15s infinite ease-in-out"
        }} />
        <div style={{
          position: "absolute",
          bottom: "-10%",
          right: "-5%",
          width: "50%",
          height: "50%",
          background: "radial-gradient(circle, rgba(243, 112, 33, 0.06) 0%, transparent 70%)",
          filter: "blur(60px)",
          animation: "float 20s infinite ease-in-out reverse"
        }} />

        <div style={{
          position: "relative",
          width: "100%",
          maxWidth: 480,
          animation: "slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1)"
        }}>
          {/* Glass Card */}
          <div style={{
            position: "relative",
            background: "#ffffff",
            backdropFilter: "none",
            WebkitBackdropFilter: "none",
            border: "1px solid #f1f5f9",
            borderRadius: 32,
            padding: "48px 40px",
            boxShadow: "0 8px 20px rgba(16,24,40,0.06)",
            textAlign: "center"
          }}>
            {/* Logo Section */}
            <div style={{
              display: "inline-flex",
              padding: 20,
              background: "white",
              borderRadius: 24,
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
              marginBottom: 32,
              animation: "pulse 3s infinite ease-in-out"
            }}>
              <img src="/dnu_logo.png" alt="DNU" style={{ width: 64, height: 64, objectFit: "contain" }} />
            </div>

            <div style={{ marginBottom: 32 }}>
              <div style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#f37021",
                textTransform: "uppercase",
                letterSpacing: "0.16em",
                marginBottom: 6
              }}>
                Đang kết nối dữ liệu
              </div>
              <h2 style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#0f172a",
                margin: 0,
                letterSpacing: "-0.01em"
              }}>
                Điều hành hội đồng
              </h2>
            </div>

            <div style={{
              fontSize: 15,
              color: "#64748b",
              lineHeight: 1.6,
              marginBottom: 40,
              padding: "0 10px"
            }}>
              Vui lòng đợi trong giây lát, chúng tôi đang chuẩn bị dữ liệu hội đồng và kết quả bảo vệ.
            </div>

            {/* Premium Progress Bar */}
            <div style={{ position: "relative", marginBottom: 20 }}>
              <div style={{
                width: "100%",
                height: 10,
                background: "rgba(0, 0, 0, 0.05)",
                borderRadius: 99,
                overflow: "hidden"
              }}>
                <div style={{
                  width: `${loadingProgress}%`,
                  height: "100%",
                  borderRadius: 99,
                  background: "linear-gradient(90deg, #1e3a5f 0%, #3b82f6 50%, #f37021 100%)",
                  backgroundSize: "200% 100%",
                  transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                  position: "relative"
                }}>
                  {/* Shimmer Effect */}
                  <div style={{
                    position: "absolute",
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
                    animation: "shimmer 2s infinite"
                  }} />
                </div>
              </div>

              {/* Floating Percentage */}
              <div style={{
                position: "absolute",
                top: -28,
                left: `${loadingProgress}%`,
                transform: "translateX(-50%)",
                background: "#1e293b",
                color: "white",
                padding: "4px 8px",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                transition: "left 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
              }}>
                {Math.round(loadingProgress)}%
                <div style={{
                  position: "absolute",
                  bottom: -4,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 0, height: 0,
                  borderLeft: "4px solid transparent",
                  borderRight: "4px solid transparent",
                  borderTop: "4px solid #1e293b"
                }} />
              </div>
            </div>

            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#475569",
              minHeight: 20
            }}>
              {loadingProgress < 30
                ? "Đang kết nối API..."
                : loadingProgress < 60
                  ? "Tải cấu hình hội đồng..."
                  : loadingProgress < 85
                    ? "Đồng bộ hóa kết quả..."
                    : "Sắp hoàn tất..."}
            </div>

            <div style={{
              marginTop: 48,
              fontSize: 11,
              color: "#94a3b8",
              fontWeight: 500,
              letterSpacing: "0.05em",
              textTransform: "uppercase"
            }}>
              Powered by DNU FIT • 2025
            </div>
          </div>
        </div>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap');

          :host, :root, .committee-ops-root {
            font-family: 'Be Vietnam Pro', sans-serif !important;
          }

          @keyframes slideUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          @keyframes float {
            0%, 100% { transform: translate(0, 0); }
            50% { transform: translate(20px, 20px); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .animate-spin {
            animation: spin 1s linear infinite;
          }
        `}</style>
      </div>
    );
  };

  const isNoDataMessage = (message: string) => {
    const normalized = message
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return (
      normalized.includes("khong co du lieu") ||
      normalized.includes("chua co du lieu") ||
      normalized.includes("no data") ||
      normalized.includes("not found") ||
      normalized.includes("khong tim thay")
    );
  };

  const isNoDataEnvelope = (response: ApiResponse<unknown> | null | undefined) => {
    const status = Number(response?.httpStatusCode ?? response?.HttpStatusCode ?? 0);
    const message = String(readEnvelopeMessage(response) ?? "");
    return status === 204 || status === 404 || isNoDataMessage(message);
  };

  const notifyError = useCallback(
    (message: string) => addToast(message, "error"),
    [addToast],
  );
  const notifySuccess = useCallback(
    (message: string) => addToast(message, "success"),
    [addToast],
  );
  const notifyWarning = useCallback(
    (message: string) => addToast(message, "warning"),
    [addToast],
  );
  const notifyInfo = useCallback(
    (message: string) => addToast(message, "info"),
    [addToast],
  );

  useEffect(() => {
    if (queryPeriodId && queryPeriodId !== periodId) {
      setPeriodId(queryPeriodId);
    }
  }, [periodId, queryPeriodId]);

  useEffect(() => {
    setActiveDefensePeriodId(periodId);
  }, [periodId]);

  useEffect(() => {
    if (periodId != null) {
      return;
    }

    let cancelled = false;

    const resolvePeriod = async () => {
      try {
        const response = await fetchData<ApiResponse<unknown>>("/defense-periods", {
          method: "GET",
        });
        const payload = readEnvelopeData<unknown>(response);
        const fallbackPeriodId = extractDefensePeriodId(payload);
        if (!cancelled && fallbackPeriodId != null) {
          setPeriodId(fallbackPeriodId);
          setActiveDefensePeriodId(fallbackPeriodId);
        }
      } catch {
        // Keep explicit warning state when no period can be resolved.
      }
    };

    void resolvePeriod();

    return () => {
      cancelled = true;
    };
  }, [periodId]);

  const buildIdempotencyKey = (prefix: string) =>
    `${prefix}-${periodId ?? "NA"}-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

  const parseEnvelope = useCallback(
    <T,>(
      response: ApiResponse<T> | null | undefined,
      fallback: string,
      options?: { silentNoData?: boolean },
    ) => {
      if (!response) {
        notifyError(fallback);
        return { ok: false, data: null as T | null };
      }

      const allowedActions = readEnvelopeAllowedActions(response);
      if (allowedActions.length > 0) {
        setBackendAllowedActions(allowedActions);
      }

      const warningMessages = readEnvelopeWarningMessages(response);
      if (warningMessages.length > 0) {
        notifyWarning(warningMessages.join(" | "));
      }

      const success = readEnvelopeSuccess(response);
      const message = readEnvelopeMessage(response);
      if (!success) {
        if (options?.silentNoData && isNoDataEnvelope(response)) {
          return { ok: true, data: null as T | null };
        }
        const errors = readEnvelopeErrorMessages(response);
        notifyError(errors[0] || message || fallback);
        return { ok: false, data: null as T | null };
      }

      if (message) {
        notifyInfo(message);
      }

      return {
        ok: true,
        data: readEnvelopeData<T>(response),
      };
    },
    [notifyError, notifyInfo, notifyWarning],
  );

  const hasAllowedAction = (...actions: string[]) =>
    backendAllowedActions.length === 0 ||
    actions.some((action) => backendAllowedActions.includes(action));

  const canPublish = hasAllowedAction("PUBLISH", "UC2.PUBLISH", "UC2.5.PUBLISH");
  const canRollback = hasAllowedAction("ROLLBACK", "UC2.6.ROLLBACK");
  const canArchive = hasAllowedAction("ARCHIVE", "UC2.7.ARCHIVE");
  const canReopen = hasAllowedAction("REOPEN", "UC2.8.REOPEN");

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTimestamp(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        distributionChartMenuRef.current &&
        !distributionChartMenuRef.current.contains(event.target as Node)
      ) {
        setDistributionChartMenuOpen(false);
      }
    };

    if (distributionChartMenuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
    }

    return undefined;
  }, [distributionChartMenuOpen]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        exportDownloadMenuRef.current &&
        !exportDownloadMenuRef.current.contains(event.target as Node)
      ) {
        setExportDownloadMenuOpen(false);
      }
    };

    if (exportDownloadMenuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
    }

    return undefined;
  }, [exportDownloadMenuOpen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const updateHeight = () => {
      const nextHeight = commandBarRef.current?.offsetHeight ?? 0;
      setCommandBarHeight(nextHeight);
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [isFullscreen, lastLoadedAt]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      await document.documentElement.requestFullscreen();
    } catch {
      setIsFullscreen((value) => !value);
    }
  };

  const loadOperationsSnapshot = useCallback(async () => {
    if (!periodId) {
      setSnapshot({});
      if (!missingPeriodWarningRef.current) {
        notifyWarning("Chua chon dot bao ve. Vui long chon dot tai module Quan ly dot truoc khi thao tac.");
        missingPeriodWarningRef.current = true;
      }
      return;
    }

    missingPeriodWarningRef.current = false;

    const params = new URLSearchParams();
    if (committeeIdFilter.trim()) {
      const numericValue = Number(committeeIdFilter.trim());
      if (Number.isFinite(numericValue) && numericValue > 0) {
        params.set("committeeId", String(Math.floor(numericValue)));
      }
    }
    params.set("revisionStatus", revisionStatus);
    if (revisionKeyword.trim()) {
      params.set("revisionKeyword", revisionKeyword.trim());
    }
    params.set("revisionPage", String(Math.max(1, revisionPage)));
    params.set("revisionSize", String(Math.min(200, Math.max(1, revisionSize))));
    params.set("auditSize", String(Math.min(500, Math.max(1, auditSize))));

    setLoadingSnapshot(true);
    try {
      const response = await fetchData<ApiResponse<OperationsSnapshotData>>(
        `${defensePeriodBase}/operations/snapshot?${params.toString()}`,
        { method: "GET" },
      );
      const parsed = parseEnvelope(
        response,
        "Không tải được snapshot điều hành chấm điểm.",
        { silentNoData: true },
      );
      if (!parsed.ok) {
        return;
      }

      if (!parsed.data) {
        setSnapshot({});
        setLastLoadedAt(new Date().toLocaleString("vi-VN"));
        return;
      }

      setSnapshot(parsed.data);
      setLastLoadedAt(new Date().toLocaleString("vi-VN"));

      const reporting = parsed.data.reporting;
      const supported = Array.isArray(reporting?.supportedReportTypes)
        ? reporting.supportedReportTypes
        : [];
      if (supported.length > 0 && !supported.includes(reportType)) {
        setReportType(supported[0] as ReportType);
      }
      if (reporting?.defaultFormat && reporting.defaultFormat !== reportFormat) {
        setReportFormat(reporting.defaultFormat as ReportFormat);
      }
    } catch (error) {
      if (error instanceof FetchDataError && (error.status === 404 || error.status === 204)) {
        setSnapshot({});
        setLastLoadedAt(new Date().toLocaleString("vi-VN"));
        return;
      }
      console.error("Snapshot error:", error);
      notifyError("Lỗi đồng bộ dữ liệu điều hành.");
    } finally {
      setLoadingSnapshot(false);
    }
  }, [
    auditSize,
    committeeIdFilter,
    defensePeriodBase,
    periodId,
    notifyError,
    notifyWarning,
    parseEnvelope,
    reportFormat,
    reportType,
    revisionKeyword,
    revisionPage,
    revisionSize,
  ]);
  const hydrateMinutes = useCallback(async (assignmentId: number, committeeId?: number) => {
    let target = null;
    if (snapshot) {
      const rawSnapshot = (snapshot as any)._raw || snapshot;
      const minutesRows = rawSnapshot.minutes || (snapshot as any).Minutes || [];
      target = (Array.isArray(minutesRows) ? minutesRows : []).find(
        (item: any) => Number(item.assignmentId ?? item.AssignmentId ?? 0) === assignmentId
      );
    }

    if (!target && committeeId && periodId) {
      try {
        const res = await fetchData<ApiResponse<any[]>>(
          `${defensePeriodBase}/lecturer/minutes/committee-detail?committeeId=${committeeId}`,
          { method: "GET" }
        );
        if (res && res.data && Array.isArray(res.data)) {
          target = res.data.find(
            (item: any) => Number(item.assignmentId ?? item.AssignmentId ?? 0) === assignmentId
          );
        }
      } catch (err) {
        console.error("Fetch minutes error:", err);
      }
    }

    if (!target) {
      setReview(""); setQuestions(""); setAnswers(""); setQuestionAnswers([]);
      setStrengths(""); setWeaknesses(""); setRecommendations(""); setChapterContents([]);
      setReviewerSections({ necessity: "", novelty: "", methodologyReliability: "", resultsContent: "", limitations: "", suggestions: "", overallConclusion: "" });
      return;
    }

    const toText = (v: any) => String(v ?? "");
    setReview(toText(target.reviewerComments));
    setQuestions(toText(target.committeeMemberComments));
    setAnswers(toText(target.qnaDetails));
    setStrengths(toText(target.strengths));
    setWeaknesses(toText(target.weaknesses));
    setRecommendations(toText(target.recommendations));
    setChapterContents(Array.isArray(target.chapterContents) ? target.chapterContents : []);
    setQuestionAnswers(Array.isArray(target.questionAnswers) ? target.questionAnswers : []);
    const rs = target.reviewerSections || {};
    setReviewerSections({
      necessity: toText(rs.necessity),
      novelty: toText(rs.novelty),
      methodologyReliability: toText(rs.methodologyReliability),
      resultsContent: toText(rs.resultsContent),
      limitations: toText(rs.limitations),
      suggestions: toText(rs.suggestions),
      overallConclusion: toText(rs.overallConclusion),
    });
  }, [snapshot, periodId, defensePeriodBase]);

  const downloadPreviewDocument = async (template: PreviewModalType, format: "word" | "pdf") => {
    if (!selectedMatrixRow || !periodId) return;
    try {
      setIsDownloadingPreviewFile(true);
      const assignmentId = selectedMatrixRow.assignmentId;
      const committeeId = selectedMatrixRow.committeeId;
      const endpoint = template === "scoreSheet"
        ? `/api/defense-periods/${periodId}/lecturer/reports/export-form-1?committeeId=${committeeId}&format=${format}`
        : `/api/defense-periods/${periodId}/lecturer/minutes/export-document?committeeId=${committeeId}&assignmentId=${assignmentId}&template=${template}&format=${format}`;
      const { getAccessToken } = await import("../../services/auth-session.service");
      const { normalizeUrl } = await import("../../api/fetchData");
      const token = getAccessToken();
      const url = normalizeUrl(endpoint);
      const rawResponse = await fetch(url, { method: "GET", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      if (!rawResponse.ok) throw new Error("Không thể tải tài liệu.");
      const blob = await rawResponse.blob();
      const contentDisposition = rawResponse.headers.get("content-disposition") || "";
      const fileNameMatch = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(contentDisposition);
      const serverFileName = decodeURIComponent((fileNameMatch?.[1] || fileNameMatch?.[2] || "").trim());
      const fileName = serverFileName || `document.${format === "pdf" ? "pdf" : "docx"}`;
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = blobUrl; anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click(); anchor.remove();
      URL.revokeObjectURL(blobUrl);
      notifySuccess("Đã tải tài liệu thành công.");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Không thể tải tài liệu.");
    } finally {
      setIsDownloadingPreviewFile(false);
      setShowDownloadDropdown(false);
    }
  };

  const fetchSystemLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(logsPage));
      params.set("pageSize", String(logsPageSize));
      params.set("ImportantOnly", "true");
      if (logsSearch.trim()) {
        params.set("search", logsSearch.trim());
      }
      if (logsActionFilter !== "all") {
        params.set("actionType", logsActionFilter);
      }
      if (logsModuleFilter !== "all") {
        params.set("module", logsModuleFilter);
      }
      
      const response = await fetchData<ApiResponse<any[]>>(
        `/SystemActivityLogs/get-list?${params.toString()}`,
        { method: "GET" }
      );
      
      const parsed = parseEnvelope(response, "Không tải được nhật ký hoạt động hệ thống.");
      if (parsed.ok && parsed.data) {
        setSystemLogs(parsed.data);
        const total = readEnvelopeTotalCount(response);
        setLogsTotalCount(total || parsed.data.length);
      }
    } catch (error) {
      console.error("System logs error:", error);
      notifyError("Lỗi đồng bộ dữ liệu nhật ký hoạt động.");
    } finally {
      setLogsLoading(false);
    }
  }, [
    logsPage,
    logsPageSize,
    logsSearch,
    logsActionFilter,
    logsModuleFilter,
    parseEnvelope,
    notifyError
  ]);

  const exportSystemLogs = useCallback(async () => {
    setLogIsExporting(true);
    try {
      const payload = {
        fields: logExportSelectedFields,
        format: toApiExportFormat(logExportFormat),
        filters: {
          search: logsSearch || undefined,
          module: logsModuleFilter !== "all" ? logsModuleFilter : undefined,
          actionType: logsActionFilter !== "all" ? logsActionFilter : undefined,
          importantOnly: true,
        },
      };

      const arrayBuffer = await fetchData<ArrayBuffer>(`/SystemActivityLogs/export`, {
        method: "POST",
        body: payload,
        timeoutMs: 300000,
        headers: { Accept: logExportFormat === "pdf" ? "application/pdf" : logExportFormat === "excel" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv" },
      });

      if (!arrayBuffer) {
        throw new Error("Không nhận được dữ liệu file từ server.");
      }

      const mime = logExportFormat === "pdf" ? "application/pdf" : logExportFormat === "excel" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv";
      const ext = logExportFormat === "pdf" ? "pdf" : logExportFormat === "excel" ? "xlsx" : "csv";
      const blob = new Blob([arrayBuffer as ArrayBuffer], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `system-activity-logs.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      notifySuccess("Đã xuất nhật ký hoạt động.");
      setLogExportModalOpen(false);
    } catch (error) {
      console.error("Export system logs error:", error);
      notifyError(error instanceof Error ? error.message : "Không thể xuất nhật ký hoạt động.");
    } finally {
      setLogIsExporting(false);
    }
  }, [logExportFormat, logExportSelectedFields, logsSearch, logsModuleFilter, logsActionFilter, notifyError, notifySuccess]);

  useEffect(() => {
    void loadOperationsSnapshot();
  }, [loadOperationsSnapshot]);

  useEffect(() => {
    if (activeTab === "audit") {
      void fetchSystemLogs();
    }
  }, [activeTab, fetchSystemLogs]);

  useEffect(() => {
    if (activeTab !== "analytics" || !periodId) return;
    
    let cancelled = false;
    const fetchAnalytics = async () => {
      setAnalyticsLoading(true);
      try {
        const [progressRes, distRes] = await Promise.all([
          fetchData<ApiResponse<ScoringMatrixRow[]>>(`${defensePeriodBase}/scoring/progress-topic-final`, { method: "GET" }),
          fetchData<ApiResponse<DistributionOverview>>(`${defensePeriodBase}/scoring/distribution`, { method: "GET" })
        ]);
        
        if (cancelled) return;
        
        const progressParsed = parseEnvelope(progressRes, "Không tải được progress-topic-final", { silentNoData: true });
        const distParsed = parseEnvelope(distRes, "Không tải được distribution", { silentNoData: true });

        if (progressParsed.ok && progressParsed.data) {
          setAnalyticsTopics(progressParsed.data);
        }
        if (distParsed.ok && distParsed.data) {
          setAnalyticsDistribution(distParsed.data);
        }
      } catch (err) {
        if (!cancelled) notifyError("Lỗi tải API analytics mới.");
      } finally {
        if (!cancelled) setAnalyticsLoading(false);
      }
    };
    
    void fetchAnalytics();
    return () => { cancelled = true; };
  }, [activeTab, periodId, defensePeriodBase, parseEnvelope, notifyError]);


  const triggerLifecycle = async (action: LifecycleAction) => {
    if (!periodId) {
      notifyWarning("Chua chon dot bao ve. Vui long chon dot tai module Quan ly dot.");
      return;
    }

    if (
      action === "PUBLISH" &&
      !hasAllowedAction("PUBLISH", "UC2.PUBLISH", "UC2.5.PUBLISH")
    ) {
      notifyWarning("Backend chưa cho phép công bố điểm ở trạng thái hiện tại.");
      return;
    }
    if (
      action === "ROLLBACK" &&
      !hasAllowedAction("ROLLBACK", "UC2.6.ROLLBACK")
    ) {
      notifyWarning("Backend chưa cho phép rollback ở trạng thái hiện tại.");
      return;
    }
    if (
      action === "ARCHIVE" &&
      !hasAllowedAction("ARCHIVE", "UC2.7.ARCHIVE")
    ) {
      notifyWarning("Backend chưa cho phép lưu trữ đợt ở trạng thái hiện tại.");
      return;
    }
    if (
      action === "REOPEN" &&
      !hasAllowedAction("REOPEN", "UC2.8.REOPEN")
    ) {
      notifyWarning("Backend chưa cho phép mở lại đợt ở trạng thái hiện tại.");
      return;
    }

    const idempotencyKey = buildIdempotencyKey(action);
    const payload: Record<string, unknown> = {
      action,
      idempotencyKey,
    };

    if (action === "ROLLBACK") {
      const target = window.prompt(
        "Nhập target rollback: PUBLISH | FINALIZE | ALL",
        "PUBLISH",
      );
      if (!target) {
        return;
      }
      const normalizedTarget = target.trim().toUpperCase();
      if (!["PUBLISH", "FINALIZE", "ALL"].includes(normalizedTarget)) {
        notifyError("Target rollback không hợp lệ.");
        return;
      }
      const reason = window.prompt("Nhập lý do rollback", "Điều chỉnh điểm");
      if (!reason || !reason.trim()) {
        notifyError("Rollback bắt buộc nhập lý do.");
        return;
      }
      payload.rollback = {
        target: normalizedTarget,
        reason: reason.trim(),
        forceUnlockScores: true,
      };
    }

    try {
      setActionInFlight(`Lifecycle ${action}`);
      const response = await fetchData<ApiResponse<Record<string, unknown>>>(
        `${defensePeriodBase}/lifecycle`,
        {
          method: "POST",
          body: payload,
          headers: { "Idempotency-Key": idempotencyKey },
        },
      );
      const parsed = parseEnvelope(
        response,
        `Lifecycle ${action} thất bại. Vui lòng thử lại.`,
      );
      if (!parsed.ok) {
        return;
      }

      if (response.idempotencyReplay ?? response.IdempotencyReplay) {
        notifyInfo(`Yêu cầu ${action} đã được xử lý trước đó.`);
      } else {
        notifySuccess(`Đã thực thi ${action} thành công.`);
      }
      await loadOperationsSnapshot();
    } catch {
      notifyError(`Không thể thực thi ${action}.`);
    } finally {
      setActionInFlight(null);
    }
  };

  const exportReport = (overrides?: { reportType?: ReportType; format?: ReportFormat; councilId?: string; template?: string }) => {
    if (!periodId) {
      notifyWarning("Chua chon dot bao ve. Vui long chon dot tai module Quan ly dot.");
      return;
    }

    let effectiveReportType: ReportType = overrides?.reportType ?? reportType;
    let effectiveCouncilId = (overrides?.councilId ?? reportCouncilId).trim();
    const effectiveFormat = overrides?.format ?? reportFormat;
    const effectiveTemplate = overrides?.template ?? exportTemplateMode;

    if (activeTab === "committee" && selectedCommittee) {
      effectiveReportType = committeeExportType;
      if (!effectiveCouncilId) {
        const councilIdFromRows = selectedCommitteeRows.find((row) => Number.isFinite(Number(row.committeeId)))?.committeeId;
        if (councilIdFromRows != null) {
          effectiveCouncilId = String(councilIdFromRows);
        } else {
          const numericMatch = String(selectedCommittee.code ?? "").match(/\d+/);
          if (numericMatch) {
            effectiveCouncilId = numericMatch[0];
          }
        }
      }
    }

    const apiFormat = toApiExportFormat(effectiveFormat);
    const extension = effectiveFormat === "pdf" ? "pdf" : effectiveFormat === "word" ? "docx" : effectiveFormat === "excel" ? "xlsx" : effectiveFormat === "zip" ? "zip" : "csv";
    const mimeType =
      effectiveFormat === "pdf"
        ? "application/pdf"
        : effectiveFormat === "word"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : effectiveFormat === "excel"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : effectiveFormat === "zip"
              ? "application/zip"
              : "text/csv;charset=utf-8";

    void (async () => {
      setIsExporting(true);
      try {
        let data: ArrayBuffer;
        let fileName: string;

        const isModularTemplate = ["dashboard", "scoring", "post-defense", "councils", "topics", "custom"].includes(effectiveTemplate);

        if (activeTab === "export" || (isModularTemplate && ["pdf", "excel", "xlsx", "csv"].includes(apiFormat))) {
          // Use the new modular export endpoint
          const params = new URLSearchParams();
          params.set("format", apiFormat);
          params.set("template", effectiveTemplate);
          if (exportIsPassed !== null) {
            params.set("isPassed", String(exportIsPassed));
          }
          if (effectiveCouncilId) {
            params.set("committeeId", effectiveCouncilId);
          }
          if (exportTopicKeyword) {
            params.set("revisionKeyword", exportTopicKeyword);
          }
          if (exportSelectedFields.length > 0) {
            exportSelectedFields.forEach(field => params.append("selectedFields", field));
          }

          const endpoint = `${defensePeriodBase}/operations/export?${params.toString()}`;
          data = await fetchData<ArrayBuffer>(endpoint, {
            method: "GET",
            skipAuthRedirect: true,
          });
          fileName = `${effectiveTemplate}_${Date.now()}.${extension}`;
        } else {
          // Use legacy report endpoint for Docx or specific forms
          if (["form-1", "scoreboard", "minutes", "review", "council-summary"].includes(effectiveReportType) && !effectiveCouncilId) {
            notifyError("Báo cáo hội đồng bắt buộc có councilId.");
            setIsExporting(false);
            return;
          }

          const endpoint = `${defensePeriodBase}/reports/export`;
          data = await fetchData<ArrayBuffer>(endpoint, {
            method: "POST",
            skipAuthRedirect: true,
            body: {
              reportType: effectiveReportType,
              format: apiFormat,
              ...(effectiveCouncilId ? { councilId: Number(effectiveCouncilId) } : {}),
              ...(exportSelectedFields.length > 0 ? { selectedFields: exportSelectedFields } : {}),
            },
          });
          fileName = `${effectiveReportType}_${Date.now()}.${extension}`;
        }

        if (!data || data.byteLength === 0) {
          throw new Error("File export rỗng hoặc không hợp lệ.");
        }

        const blob = new Blob([data], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        notifySuccess("Tải file báo cáo thành công.");
        setExportModalOpen(false);
      } catch (error) {
        console.error("Export Error:", error);
        if (error instanceof FetchDataError && error.status === 401) {
          notifyError("Bạn chưa có quyền tải báo cáo hoặc phiên đăng nhập đã hết hạn.");
        } else {
          notifyError("Không thể tải file báo cáo. Vui lòng thử lại sau.");
        }
      } finally {
        setIsExporting(false);
      }
    })();
  };

  const downloadCommitteeReport = async (committeeRow: CommitteeSummary, reportTypeValue: CommitteeExportType, format: ReportFormat) => {
    if (!periodId) {
      notifyWarning("Chua chon dot bao ve. Vui long chon dot tai module Quan ly dot.");
      return;
    }

    const councilId = selectedCommitteeRows.find((row) => row.committeeId != null)?.committeeId;
    if (councilId == null) {
      notifyError("Không tìm thấy councilId cho hội đồng hiện tại.");
      return;
    }

    const apiFormat = toApiExportFormat(format);
    const params = new URLSearchParams({
      reportType: reportTypeValue,
      format: apiFormat,
      councilId: String(councilId),
    });

    try {
      const endpoint = `${defensePeriodBase}/reports/export?${params.toString()}`;
      const data = await fetchData<ArrayBuffer>(endpoint, { method: "GET", skipAuthRedirect: true });
      
      if (!data || data.byteLength < 100) {
          throw new Error("Dữ liệu file không hợp lệ hoặc quá nhỏ.");
      }

      const blob = new Blob([data], { 
        type: format === "pdf" ? "application/pdf" : 
              format === "word" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" :
              format === "excel" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : 
              format === "zip" ? "application/zip" : "text/csv"
      });
      
      const extension = format === "pdf" ? "pdf" : format === "word" ? "docx" : format === "excel" ? "xlsx" : format === "zip" ? "zip" : "csv";
      const fileName = `${reportTypeValue}_${committeeRow.code}_${Date.now()}.${extension}`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      notifySuccess(`Tải file ${reportTypeValue} thành công.`);
    } catch (err: unknown) {
      console.error("Download error:", err);
      if (err instanceof FetchDataError && err.status === 401) {
        notifyError("Bạn chưa có quyền tải file hoặc phiên đăng nhập đã hết hạn. Vui lòng kiểm tra phân quyền.");
        return;
      }
      notifyError(`Không thể tải file ${reportTypeValue}. Vui lòng kiểm tra lại quyền truy cập hoặc kết nối mạng.`);
    }
  };

  const submitCommitteeAction = useCallback(
    async (action: "OPEN_SESSION" | "CLOSE_SESSION" | "LOCK_SESSION" | "ADMIN_REOPEN", committee: CommitteeSummary | null) => {
      if (!periodId) {
        notifyWarning("Chưa chọn đợt bảo vệ. Vui lòng chọn đợt tại module Quản lý đợt.");
        return;
      }
      if (!committee) {
        notifyWarning("Chưa chọn hội đồng để thao tác.");
        return;
      }

      const actionKey = `COMMITTEE-${committee.code}-${action}`;
      setActionInFlight(actionKey);

      try {
        let response: ApiResponse<Record<string, unknown>>;

        if (action === "ADMIN_REOPEN") {
          // Admin reopen endpoint
          const committeeId = committee.key ? Number(committee.key) : null;
          if (!committeeId) {
            notifyError("Không thể lấy ID hội đồng.");
            return;
          }
          response = await fetchData<ApiResponse<Record<string, unknown>>>(
            `/api/LecturerDefense/admin/reopen-session?committeeId=${committeeId}`,
            { method: "POST" }
          );
        } else {
          // Standard lecturer scoring actions (OPEN_SESSION, CLOSE_SESSION, LOCK_SESSION)
          response = await fetchData<ApiResponse<Record<string, unknown>>>(
            `/api/defense-periods/${periodId}/lecturer/scoring/actions`,
            {
              method: "POST",
              body: {
                action,
                committeeId: committee.key ? Number(committee.key) : null,
              },
            }
          );
        }

        const parsed = parseEnvelope(response, `Không thể thực hiện ${action}.`);
        if (!parsed.ok) {
          throw new Error("Committee action failed");
        }

        const actionLabel = 
          action === "OPEN_SESSION" ? "Mở phiên" :
          action === "CLOSE_SESSION" ? "Đóng phiên" :
          action === "LOCK_SESSION" ? "Khóa phiên" :
          "Mở lại phiên";
        
        notifySuccess(`${actionLabel} hội đồng ${committee.code} thành công.`);
        await loadOperationsSnapshot();
      } catch (error) {
        const errorMessage = error instanceof FetchDataError ? error.message : "Không thể cập nhật trạng thái hội đồng.";
        notifyError(errorMessage);
      } finally {
        setActionInFlight(null);
      }
    },
    [defensePeriodBase, loadOperationsSnapshot, notifyError, notifySuccess, notifyWarning, parseEnvelope, periodId],
  );

  const handleTopicExport = (format: ReportFormat, row: ScoringMatrixRow) => {
    setReportFormat(format);
    setReportType("form-1");
    if (row.committeeId != null) {
      setReportCouncilId(String(row.committeeId));
    }
    notifyInfo(`San sang xuat ${format.toUpperCase()} cho de tai ${row.topicCode ?? "-"}.`);
    setExportModalOpen(true);
  };

  const pipeline = snapshot?.monitoring?.pipeline;
  const rawAnalytics = snapshot?.monitoring?.analytics;
  const scoringMatrix = snapshot?.scoringMatrix ?? [];
  const postDefense = snapshot?.postDefense;
  const audit = snapshot?.audit;
  const periodState = toRecord(snapshot?.state ?? null);
  const scoresPublished = Boolean(getRecordValue(periodState, "ScoresPublished") ?? getRecordValue(periodState, "scoresPublished"));
  const councilSourceRecords = snapshot?.councils?.items ?? [];

  const analytics = useMemo(() => {
    if ((rawAnalytics?.overview?.totalRecords ?? 0) > 0) return rawAnalytics;

    // Calculate fallback analytics from scoringMatrix
    const scores = scoringMatrix
      .map(r => Number(r.finalScore ?? r.currentScore ?? NaN))
      .filter(s => !isNaN(s));
    
    const variances = scoringMatrix
      .map(r => Number(r.variance ?? 0))
      .filter(v => !isNaN(v));

    const passCount = scores.filter(s => s >= 4.0).length; // Traditional 4.0 threshold

    return {
      ...rawAnalytics,
      overview: {
        average: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
        passRate: scores.length > 0 ? (passCount / scores.length) * 100 : 0,
        maxVariance: variances.length > 0 ? Math.max(...variances) : 0,
        totalRecords: scores.length
      }
    };
  }, [rawAnalytics, scoringMatrix]);

  const scoredRowsForDistribution = useMemo(
    () => scoringMatrix.filter((row) => Number.isFinite(Number(row.finalScore ?? row.currentScore ?? NaN))),
    [scoringMatrix],
  );

  const distributionRows = useMemo(
    () => buildDistributionRows(scoredRowsForDistribution, distributionViewMode),
    [distributionViewMode, scoredRowsForDistribution],
  );

  const postDefenseStudentCodes = useMemo(() => 
    new Set((postDefense?.items ?? []).map(i => i.studentCode)), 
    [postDefense?.items]
  );

  const distributionTotal = useMemo(
    () => distributionRows.reduce((sum, item) => sum + item.value, 0),
    [distributionRows],
  );

  const handleStudentTableSort = (field: typeof studentTableSortField) => {
    if (studentTableSortField === field) {
      setStudentTableSortDir(studentTableSortDir === "asc" ? "desc" : "asc");
    } else {
      setStudentTableSortField(field);
      setStudentTableSortDir("asc");
    }
  };

  const studentTableSortedData = useMemo(
    () => {
      let filtered = scoredRowsForDistribution;

      // 1. Filter by Result (Đạt/Trượt)
      if (studentTableIsPassedFilter !== "all") {
        filtered = filtered.filter(row => {
          const effectivePassed = row.isPassed ?? (row.finalScore != null && Number(row.finalScore) >= 5.0);
          return effectivePassed === studentTableIsPassedFilter;
        });
      }

      // 2. Filter by Topic Status
      if (studentTableStatusFilter !== "all") {
        filtered = filtered.filter(row => {
          const isPostDefense = postDefenseStudentCodes.has(row.studentCode);
          if (studentTableStatusFilter === "post-defense") return isPostDefense;
          if (studentTableStatusFilter === "locked") return !isPostDefense && row.isLocked;
          if (studentTableStatusFilter === "scoring") return !isPostDefense && !row.isLocked;
          return true;
        });
      }

      return sortStudentRows(filtered, studentTableSortField, studentTableSortDir);
    },
    [scoredRowsForDistribution, studentTableIsPassedFilter, studentTableStatusFilter, postDefenseStudentCodes, studentTableSortField, studentTableSortDir],
  );

  const distributionStops = useMemo(() => {
    let cursor = 0;
    return distributionRows.map((item) => {
      const percent = distributionTotal > 0 ? (item.value / distributionTotal) * 100 : 0;
      const start = cursor;
      const end = cursor + percent;
      cursor = end;
      return {
        label: item.label,
        color: distributionPalette[item.label] ?? "#cbd5e1",
        start,
        end,
      };
    });
  }, [distributionRows, distributionTotal]);

  const distributionPeak = useMemo(
    () => Math.max(1, ...distributionRows.map((item) => item.value)),
    [distributionRows],
  );

  const committeeOperationalRows = useMemo<CommitteeSummary[]>(() => {
    const councilByRoom = new Map<string, Record<string, unknown>>();
    const councilByCode = new Map<string, Record<string, unknown>>();

    (Array.isArray(analytics?.byCouncil) ? analytics.byCouncil : []).forEach((item) => {
      const record = toRecord(item);
      if (!record) {
        return;
      }

      const roomKey = normalizeLookupKey(pickText(record, ["room", "Room"], ""));
      const codeKey = normalizeLookupKey(pickText(record, ["councilCode", "CouncilCode", "committeeCode", "CommitteeCode", "code", "id"], ""));

      if (roomKey) {
        councilByRoom.set(roomKey, record);
      }
      if (codeKey) {
        councilByCode.set(codeKey, record);
      }
    });

    const rowsByCommittee = new Map<string, ScoringMatrixRow[]>();
    scoringMatrix.forEach((row) => {
      const code = normalizeLookupKey(row.committeeCode);
      if (!code) {
        return;
      }
      const current = rowsByCommittee.get(code) ?? [];
      current.push(row);
      rowsByCommittee.set(code, current);
    });

    const buildSummary = (committeeCode: string, topicRows: ScoringMatrixRow[], index: number): CommitteeSummary => {
      const firstRow = topicRows[0] ?? null;
      const analyticsRecord = councilByCode.get(committeeCode) ?? councilByRoom.get(normalizeLookupKey(firstRow?.room));
      const totalTopics = topicRows.length || pickNumber(analyticsRecord, ["count", "Count", "totalTopics", "topicCount"], 0);
      const waitingPublicTopics = topicRows.filter((row) => !row.isLocked && (row.submittedCount != null && row.requiredCount != null && row.submittedCount >= row.requiredCount && row.requiredCount > 0)).length;
      const lockedTopics = topicRows.filter((row) => row.isLocked).length;
      const scoredTopics = lockedTopics + waitingPublicTopics;
      const fallbackName = firstRow?.committeeName ?? `Hội đồng ${index + 1}`;
      const statusValue = normalizeCommitteeStatus(
        firstRow?.status ?? (scoresPublished ? "PUBLISHED" : scoredTopics > 0 ? "ONGOING" : "READY")
      );
      const overrideStatus = committeeStatusOverrides[firstRow?.committeeCode ?? committeeCode];
      const activeTopic = topicRows.find((row) => !row.isLocked && (row.finalScore == null || Number(row.finalScore) <= 0)) ?? topicRows[0] ?? null;
      const lastPlannedEnd = topicRows
        .map((row) => parseDateValue(row.endTime ?? null))
        .filter((value): value is Date => Boolean(value))
        .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
      const avgScore = pickNumber(analyticsRecord, ["avg", "Avg", "average", "Average"], 0) || (scoredTopics > 0 ? Number((topicRows.reduce((sum, row) => sum + Number(row.finalScore ?? row.currentScore ?? 0), 0) / scoredTopics).toFixed(1)) : 0);
      const finalLabel = scoresPublished || firstRow?.isLocked ? "Đã chốt" : scoredTopics > 0 ? "Đang xử lý" : "Sẵn sàng";

      return {
        key: firstRow?.assignmentId != null ? `${committeeCode}-${firstRow.assignmentId}` : committeeCode,
        code: firstRow?.committeeCode ?? committeeCode,
        name: firstRow?.committeeName ?? fallbackName,
        room: firstRow?.room ?? pickText(analyticsRecord, ["room", "Room"], "-"),
        chair: pickRowText(topicRows, ["chairName", "committeeChairName", "chair", "committeeChair"], "") || pickText(analyticsRecord, ["chair", "chairName", "Chair", "chairman", "committeeChair", "committeeChairName"], "-"),
        chairCode: pickRowText(topicRows, ["committeeChairCode"], "") || pickText(analyticsRecord, ["committeeChairCode", "chairCode"], ""),
        secretary: pickRowText(topicRows, ["secretaryName", "committeeSecretaryName", "secretary", "committeeSecretary"], "") || pickText(analyticsRecord, ["secretary", "secretaryName", "Secretary", "clerk", "committeeSecretary", "committeeSecretaryName"], "-"),
        secretaryCode: pickRowText(topicRows, ["committeeSecretaryCode"], "") || pickText(analyticsRecord, ["committeeSecretaryCode", "secretaryCode"], ""),
        reviewer: pickRowText(topicRows, ["reviewerName", "committeeReviewerName", "reviewer", "committeeReviewer"], "") || pickText(analyticsRecord, ["reviewer", "reviewerName", "Reviewer", "critic", "committeeReviewer", "committeeReviewerName"], "-"),
        reviewerCode: pickRowText(topicRows, ["committeeReviewerCode"], "") || pickText(analyticsRecord, ["committeeReviewerCode", "reviewerCode"], ""),
        totalTopics,
        scoredTopics,
        lockedTopics,
        status: overrideStatus ?? statusValue,
        currentTopic: toText(activeTopic?.topicTitle ?? activeTopic?.topicCode, finalLabel),
        currentStudent: toText(activeTopic?.studentName ?? activeTopic?.studentCode, "-"),
        progressPercent: totalTopics > 0 ? Math.min(100, Math.round((scoredTopics / totalTopics) * 100)) : 0,
        estimatedCompletion: lastPlannedEnd
          ? lastPlannedEnd.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
          : formatCompactDuration(Math.max(1, totalTopics - scoredTopics) * 12),
        delayLabel: totalTopics > 0 && scoredTopics < totalTopics ? `+${formatCompactDuration(Math.max(1, totalTopics - scoredTopics) * 12)}` : "On time",
        avgScore,
        defenseDate: (() => {
          const raw = firstRow?.scheduledAt || firstRow?.startTime || pickText(analyticsRecord, ["startTime", "StartTime", "date", "DefenseDate", "defenseDate", "ngay", "ngayBaoVe"], "");
          const d = parseDateValue(raw);
          return d ? d.toLocaleDateString("vi-VN") : "-";
        })(),
      };
    };

    return Array.from(rowsByCommittee.entries())
      .map(([committeeCode, topicRows], index) => buildSummary(committeeCode, topicRows, index))
      .sort((left, right) => left.code.localeCompare(right.code));
  }, [analytics?.byCouncil, committeeStatusOverrides, scoringMatrix, scoresPublished]);

  // 1. Đề tài đã đóng hội đồng không có đủ điểm
  const topicsClosedNoScoreAlerts = useMemo(() => {
    return scoringMatrix.filter((row) => {
      const isClosed = row.isLocked === true || row.status === "LOCKED" || row.status === "FINALIZED" || row.status === "COMPLETED" || scoresPublished;
      const isMissingScores = row.finalScore == null || Number(row.finalScore) <= 0 || 
        (row.submittedCount != null && row.requiredCount != null && row.submittedCount < row.requiredCount);
      return isClosed && isMissingScores;
    });
  }, [scoringMatrix, scoresPublished]);

  // 2. Hội đồng quá hạn (hết ngày) chưa chốt điểm và đóng phiên hội đồng
  const overdueCommitteesAlerts = useMemo(() => {
    return committeeOperationalRows.filter((row) => {
      const isNotClosed = row.status !== "LOCKED" && row.status !== "COMPLETED" && row.status !== "FINALIZED" && row.status !== "PUBLISHED" && !scoresPublished;
      if (!isNotClosed) return false;
      
      const dateStr = row.defenseDate;
      if (!dateStr || dateStr === "-") return false;
      
      const parts = dateStr.split("/");
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        d.setHours(23, 59, 59, 999);
        return d.getTime() < Date.now();
      }
      return false;
    });
  }, [committeeOperationalRows, scoresPublished]);

  const dashboardMetrics = useMemo(() => {
    const totalTopics = pipeline?.totalTopics ?? scoringMatrix.length;
    const lockedTopics = scoringMatrix.filter(row => row.isLocked).length;
    const waitingPublicTopics = pipeline?.waitingPublicTopics ?? scoringMatrix.filter((row) => !row.isLocked && (row.submittedCount != null && row.requiredCount != null && row.submittedCount >= row.requiredCount && row.requiredCount > 0)).length;
    const scoredTopics = lockedTopics + waitingPublicTopics;
    
    const activeCouncils = committeeOperationalRows.filter((row) => ["ONGOING", "READY", "DELAYED", "WAITING_PUBLIC"].includes(row.status)).length;
    const pendingTopics = Math.max(0, totalTopics - scoredTopics);
    const waitingTopics = scoringMatrix.filter((row) => !row.submittedCount || Number(row.submittedCount) === 0).length;
    const liveTopics = scoringMatrix.filter((row) => Number(row.submittedCount ?? 0) > 0 && !(row.submittedCount != null && row.requiredCount != null && row.submittedCount >= row.requiredCount)).length;
    const warnings = (postDefense?.items ?? []).filter((item) => String(item.status ?? "").toLowerCase() !== "approved").length;
    const completionRate = totalTopics > 0 ? Math.round((scoredTopics / totalTopics) * 100) : 0;

    return {
      totalCouncils: committeeOperationalRows.length,
      totalTopics,
      scoredTopics,
      lockedTopics,
      waitingPublicTopics,
      pendingTopics,
      waitingTopics,
      liveTopics,
      activeCouncils,
      warnings,
      completionRate,
    };
  }, [committeeOperationalRows, pipeline?.scoredTopics, pipeline?.totalTopics, pipeline?.waitingPublicTopics, postDefense?.items, scoringMatrix, scoresPublished]);

  const topTopic = useMemo(
    () => (scoringMatrix.filter((row) => row.finalScore != null && Number(row.finalScore) > 0).sort((left, right) => Number(right.finalScore) - Number(left.finalScore))[0] ?? null),
    [scoringMatrix],
  );

  const lowTopic = useMemo(
    () => (scoringMatrix.filter((row) => row.finalScore != null && Number(row.finalScore) > 0).sort((left, right) => Number(left.finalScore) - Number(right.finalScore))[0] ?? null),
    [scoringMatrix],
  );

  const selectedCommittee = useMemo(() => {
    if (selectedCouncilCode) {
      const code = selectedCouncilCode.trim().toUpperCase();
      const numeric = selectedCouncilNumericId != null ? String(selectedCouncilNumericId) : "";
      const directMatch = committeeOperationalRows.find((row) => row.code.toUpperCase() === code || row.key.toUpperCase() === code);
      if (directMatch) {
        return directMatch;
      }

      if (numeric) {
        const numericMatch = committeeOperationalRows.find((row) => row.code.replace(/[^\d]/g, "") === numeric || row.key.replace(/[^\d]/g, "") === numeric);
        if (numericMatch) {
          return numericMatch;
        }
      }
    }

    return committeeOperationalRows[0] ?? null;
  }, [committeeOperationalRows, selectedCouncilCode, selectedCouncilNumericId]);

  const selectedCommitteeRows = useMemo(() => {
    if (!selectedCommittee) {
      return scoringMatrix;
    }

    const code = selectedCommittee.code.trim().toUpperCase();
    return scoringMatrix
      .filter((row) => String(row.committeeCode ?? "").trim().toUpperCase() === code || String(row.committeeId ?? "").trim().toUpperCase() === code)
      .sort((left, right) => String(left.topicCode ?? "").localeCompare(String(right.topicCode ?? "")));
  }, [scoringMatrix, selectedCommittee]);

  const selectedCommitteeSupervisor = useMemo(() => {
    const row = selectedCommitteeRows.find((row) => row.supervisorLecturerName || row.supervisorName);
    return row?.supervisorLecturerName ?? row?.supervisorName ?? "-";
  }, [selectedCommitteeRows]);

  const selectedCommitteeSupervisorCode = useMemo(() => {
    const row = selectedCommitteeRows.find((row) => row.supervisorLecturerCode);
    return row?.supervisorLecturerCode ?? "";
  }, [selectedCommitteeRows]);

  const selectedCommitteeFinalized = useMemo(() => {
    if (!selectedCommittee) {
      return false;
    }
    const normalized = normalizeStatusKey(selectedCommittee.status);
    const allRowsFinalized = selectedCommitteeRows.length > 0 && selectedCommitteeRows.every((row) => row.isLocked || row.finalScore != null || Number(row.finalScore ?? 0) > 0);
    return ["LOCKED", "COMPLETED", "PUBLISHED", "FINALIZED"].includes(normalized) || scoresPublished || allRowsFinalized;
  }, [scoresPublished, selectedCommittee, selectedCommitteeRows]);

  const visibleCommitteeRows = useMemo(() => {
    const query = committeeIdFilter.trim().toUpperCase();
    const roomQuery = committeeRoomFilter.trim().toUpperCase();
    const chairQuery = committeeChairFilter.trim().toUpperCase();

    return committeeOperationalRows.filter((row) => {
      const haystack = `${row.code} ${row.name} ${row.room} ${row.chair} ${row.secretary} ${row.reviewer} ${row.currentTopic} ${row.currentStudent}`.toUpperCase();
      if (query && !haystack.includes(query)) {
        return false;
      }

      if (roomQuery && !row.room.toUpperCase().includes(roomQuery)) {
        return false;
      }

      if (chairQuery && !row.chair.toUpperCase().includes(chairQuery)) {
        return false;
      }

      switch (navigatorFilter) {
        case "active":
          return ["READY", "ONGOING", "DELAYED"].includes(row.status) && row.progressPercent < 100;
        case "delayed":
          return row.delayLabel !== "On time";
        case "warning":
          return row.delayLabel !== "On time" || row.scoredTopics < row.totalTopics;
        case "completed":
          return row.progressPercent >= 100 || ["COMPLETED", "PUBLISHED", "LOCKED", "FINALIZED"].includes(row.status);
        case "all":
        default:
          return true;
      }
    });
  }, [committeeChairFilter, committeeIdFilter, committeeOperationalRows, committeeRoomFilter, navigatorFilter]);

  const keyAlerts = useMemo<DashboardAlert[]>(() => {
    const alertItems: DashboardAlert[] = [
      ...topicsClosedNoScoreAlerts.map((row) => ({
        severity: "critical" as DashboardAlertSeverity,
        title: `Đóng hội đồng thiếu điểm: ${row.topicTitle ?? "-"}`,
        detail: `Hội đồng ${row.committeeCode} · SV: ${row.studentName} (${row.studentCode}) · Nhập: ${row.submittedCount}/${row.requiredCount} cột điểm`,
        committeeCode: row.committeeCode ?? "-",
        focusKey: row.committeeCode ?? "-",
        priority: 1,
      })),
      ...overdueCommitteesAlerts.map((row) => ({
        severity: "critical" as DashboardAlertSeverity,
        title: `Hội đồng quá hạn chưa đóng phiên: ${row.code}`,
        detail: `Ngày bảo vệ: ${row.defenseDate} · Phòng: ${row.room} · Chưa khóa chốt điểm`,
        committeeCode: row.code,
        focusKey: row.code,
        priority: 1,
      })),
      ...scoringMatrix
        .filter((row) => row.finalScore == null || Number(row.finalScore) <= 0)
        .slice(0, 4)
        .map((row) => ({
          severity: "critical" as DashboardAlertSeverity,
          title: row.topicTitle ?? "-",
          detail: `${row.studentName ?? "-"} · ${row.studentCode ?? "-"}`,
          committeeCode: row.committeeCode ?? "-",
          focusKey: row.committeeCode ?? "-",
          priority: 1,
        })),
      ...scoringMatrix
        .filter((row) => row.isLocked !== true && Number(row.submittedCount ?? 0) >= Number(row.requiredCount ?? 0) && Number(row.requiredCount ?? 0) > 0)
        .slice(0, 4)
        .map((row) => ({
          severity: "warning" as DashboardAlertSeverity,
          title: row.topicTitle ?? "-",
          detail: `${row.committeeCode ?? "-"} · chờ khóa ca`,
          committeeCode: row.committeeCode ?? "-",
          focusKey: row.committeeCode ?? "-",
          priority: 2,
        })),
      ...committeeOperationalRows
        .filter((row) => row.delayLabel !== "On time")
        .slice(0, 3)
        .map((row) => ({
          severity: "warning" as DashboardAlertSeverity,
          title: row.code,
          detail: `${row.delayLabel} · ${row.currentTopic}`,
          committeeCode: row.code,
          focusKey: row.code,
          priority: 2,
        })),
      ...scoringMatrix
        .filter((row) => row.variance != null && Math.abs(Number(row.variance)) >= 2)
        .slice(0, 3)
        .map((row) => ({
          severity: "critical" as DashboardAlertSeverity,
          title: row.topicTitle ?? "-",
          detail: `Variance ${row.variance}`,
          committeeCode: row.committeeCode ?? "-",
          focusKey: row.committeeCode ?? "-",
          priority: 1,
        })),
    ];

    return alertItems
      .sort((left, right) => left.priority - right.priority)
      .slice(0, 10);
  }, [committeeOperationalRows, scoringMatrix, committeeStatusOverrides, topicsClosedNoScoreAlerts, overdueCommitteesAlerts]);

  const leaderboardEntries = useMemo(() => {
    if (!snapshot) return { highest: null, lowest: null, strictest: null, lenient: null, fastest: null, delayed: null };
    const completionSorted = [...committeeOperationalRows].sort((left, right) => right.progressPercent - left.progressPercent);
    const delaySorted = [...committeeOperationalRows].sort((left, right) => {
      const leftValue = Number(left.delayLabel.replace(/[^\d.]/g, "")) || 0;
      const rightValue = Number(right.delayLabel.replace(/[^\d.]/g, "")) || 0;
      return rightValue - leftValue;
    });

    return {
      highest: topTopic
        ? { label: "Điểm cao nhất", title: topTopic.studentName ?? "-", score: String(topTopic.finalScore ?? "-"), committee: `${topTopic.committeeCode ?? "-"} · Phòng ${topTopic.room ?? "-"}`, detail: `${topTopic.scheduledAt ? new Date(topTopic.scheduledAt).toLocaleDateString("vi-VN") : "-"} · ${topTopic.topicTitle ?? "-"}` }
        : null,
      lowest: lowTopic
        ? { label: "Điểm thấp nhất", title: lowTopic.studentName ?? "-", score: String(lowTopic.finalScore ?? "-"), committee: `${lowTopic.committeeCode ?? "-"} · Phòng ${lowTopic.room ?? "-"}`, detail: `${lowTopic.scheduledAt ? new Date(lowTopic.scheduledAt).toLocaleDateString("vi-VN") : "-"} · ${lowTopic.topicTitle ?? "-"}` }
        : null,
      strictest: completionSorted[completionSorted.length - 1]
        ? { label: "Hội đồng chặt chẽ nhất", title: completionSorted[completionSorted.length - 1].name, score: `${completionSorted[completionSorted.length - 1].progressPercent}%`, committee: completionSorted[completionSorted.length - 1].code, detail: completionSorted[completionSorted.length - 1].currentTopic }
        : null,
      lenient: completionSorted[0]
        ? { label: "Hội đồng lỏng lẻo nhất", title: completionSorted[0].name, score: `${completionSorted[0].progressPercent}%`, committee: completionSorted[0].code, detail: completionSorted[0].currentTopic }
        : null,
      fastest: completionSorted[0]
        ? { label: "Hội đồng nhanh nhất", title: completionSorted[0].code, score: completionSorted[0].estimatedCompletion, committee: completionSorted[0].room, detail: completionSorted[0].currentStudent }
        : null,
      delayed: delaySorted[0]
        ? { label: "Hội đồng trễ nhất", title: delaySorted[0].code, score: delaySorted[0].delayLabel, committee: delaySorted[0].room, detail: delaySorted[0].currentTopic }
        : null,
    };
  }, [committeeOperationalRows, lowTopic, scoresPublished, topTopic, snapshot]);

  const committeeScoreStats = useMemo(() => {
    if (scoringMatrix.length === 0) {
      return [];
    }

    const map = new Map<string, { code: string; total: number; count: number; varianceTotal: number; varianceCount: number }>();
    scoringMatrix.forEach((row) => {
      const code = String(row.committeeCode ?? row.committeeId ?? "").trim();
      if (!code) {
        return;
      }
      const current = map.get(code) ?? { code, total: 0, count: 0, varianceTotal: 0, varianceCount: 0 };
      const score = Number(row.finalScore ?? row.currentScore ?? 0);
      if (Number.isFinite(score) && score > 0) {
        current.total += score;
        current.count += 1;
      }
      const variance = Number(row.variance ?? 0);
      if (Number.isFinite(variance) && variance !== 0) {
        current.varianceTotal += Math.abs(variance);
        current.varianceCount += 1;
      }
      map.set(code, current);
    });

    const results = Array.from(map.values())
      .map((item) => ({
        code: item.code,
        avgScore: item.count > 0 ? item.total / item.count : 0,
        avgVariance: item.varianceCount > 0 ? item.varianceTotal / item.varianceCount : 0,
        sample: item.count,
      }))
      .sort((left, right) => right.avgScore - left.avgScore);

    return results;
  }, [scoringMatrix, scoresPublished]);

  const scorePeak = useMemo(
    () => Math.max(1, ...committeeScoreStats.map((item) => item.avgScore)),
    [committeeScoreStats],
  );

  const variancePeak = useMemo(
    () => Math.max(1, ...committeeScoreStats.map((item) => item.avgVariance)),
    [committeeScoreStats],
  );

  const progressSeries = useMemo(() => committeeOperationalRows.slice(0, 8).map((row) => row.progressPercent), [committeeOperationalRows]);
  const varianceSeries = useMemo(() => scoringMatrix.filter((row) => row.variance != null).slice(0, 8).map((row) => Math.abs(Number(row.variance ?? 0)) * 10), [scoringMatrix]);
  const completionTrend = useMemo(() => committeeOperationalRows.slice(0, 8).map((row) => row.progressPercent), [committeeOperationalRows]);

  const [scoreSort, setScoreSort] = React.useState<"score" | "name" | "topic">("score");
  const publishedAnalyticsTopics = useMemo(() => analyticsTopics, [analyticsTopics]);
  const publishedScoringRows = useMemo(() => scoringMatrix.filter((row) => (row.finalScore != null && Number(row.finalScore) > 0) || (row.currentScore != null && Number(row.currentScore) > 0)), [scoringMatrix]);

  const sortedScores = useMemo(() => {
    const arr = (publishedAnalyticsTopics.length > 0 ? publishedAnalyticsTopics : publishedScoringRows).slice();
    if (scoreSort === "score") {
      arr.sort((a, b) => Number(b.finalScore ?? b.currentScore ?? 0) - Number(a.finalScore ?? a.currentScore ?? 0));
    } else if (scoreSort === "name") {
      arr.sort((a, b) => String(a.studentName ?? "").localeCompare(String(b.studentName ?? "")));
    } else {
      arr.sort((a, b) => String(a.topicTitle ?? "").localeCompare(String(b.topicTitle ?? "")));
    }
    return arr;
  }, [publishedAnalyticsTopics, publishedScoringRows, scoreSort]);

  const topHigh10 = useMemo(() => {
    const source = publishedAnalyticsTopics.length > 0 ? publishedAnalyticsTopics : publishedScoringRows;
    return source.slice().sort((a, b) => Number(b.finalScore ?? b.currentScore ?? 0) - Number(a.finalScore ?? a.currentScore ?? 0)).slice(0, 10);
  }, [publishedAnalyticsTopics, publishedScoringRows]);

  const topStudents = useMemo(() => {
    const source = publishedAnalyticsTopics.length > 0 ? publishedAnalyticsTopics : publishedScoringRows;
    return source.slice().sort((a, b) => Number(b.finalScore ?? b.currentScore ?? 0) - Number(a.finalScore ?? a.currentScore ?? 0)).slice(0, 5);
  }, [publishedAnalyticsTopics, publishedScoringRows]);

  const topLow10 = useMemo(() => {
    const source = publishedAnalyticsTopics.length > 0 ? publishedAnalyticsTopics : publishedScoringRows;
    return source.slice().sort((a, b) => Number(a.finalScore ?? a.currentScore ?? 0) - Number(b.finalScore ?? b.currentScore ?? 0)).slice(0, 10);
  }, [publishedAnalyticsTopics, publishedScoringRows]);

  const getTopicScoreDisplay = (row: ScoringMatrixRow) => {
    const hasAnyScore = row.finalScore != null || row.currentScore != null;
    const normalizedStatus = normalizeStatusKey(row.status ?? "");
    
    if (normalizedStatus === "WAITING_PUBLIC") {
      return "Chờ công bố";
    }
    
    if (!row.isLocked) {
      return hasAnyScore ? "Đang chấm..." : "Chưa chấm";
    }
    
    if (row.finalScore != null) {
      return String(row.finalScore);
    }
    if (row.currentScore != null) {
      return String(row.currentScore);
    }
    return "-";
  };

  const getTopicGradeDisplay = (row: ScoringMatrixRow) => {
    const hasAnyScore = row.finalScore != null || row.currentScore != null;
    const normalizedStatus = normalizeStatusKey(row.status ?? "");
    
    if (normalizedStatus === "WAITING_PUBLIC") {
      return "Chờ công bố";
    }
    
    if (!row.isLocked) {
      return hasAnyScore ? "Đang chấm..." : "Chưa chấm";
    }
    
    const score = Number(row.finalScore ?? row.currentScore ?? NaN);
    return score > 0 ? getGradeFromScore(score) : "-";
  };

  const getLockedScoreValue = (row: ScoringMatrixRow, value: number | string | undefined | null) => {
    const hasAnyScore = row.finalScore != null || row.currentScore != null;
    const normalizedStatus = normalizeStatusKey(row.status ?? "");
    
    if (normalizedStatus === "WAITING_PUBLIC") {
      return "Chờ công bố";
    }
    
    if (!row.isLocked) {
      return hasAnyScore ? "Đang chấm..." : "Chưa chấm";
    }
    if (value == null || value === "") {
      return "-";
    }
    return String(value);
  };

  const periodInfo = useMemo(() => {
    const record = toRecord(snapshot?.monitoring?.period ?? snapshot?.monitoring?.tags ?? null);
    const startDateText = pickText(record, ["startDate", "StartDate", "startedAt", "StartedAt"], "-");
    const endDateText = pickText(record, ["endDate", "EndDate", "endedAt", "EndedAt"], "-");
    const statusValue = pickText(record, ["status", "Status", "state", "State"], pipeline?.overallCompletionPercent && pipeline.overallCompletionPercent >= 100 ? "Published" : "In progress");
    const startDate = parseDateValue(startDateText);
    const endDate = parseDateValue(endDateText);

    const daysRemaining = (() => {
      if (!endDate) {
        return null;
      }
      return Math.ceil((endDate.getTime() - currentTimestamp) / 86400000);
    })();

    const elapsedMinutes = startDate ? Math.max(0, (currentTimestamp - startDate.getTime()) / 60000) : 0;
    const countdownLabel = daysRemaining == null ? "-" : `${Math.max(0, daysRemaining)} ngày`;

    return {
      name: pickText(record, ["termCode","TermCode","term_code","Term_Code","termName","TermName","term_name","Term_Name","periodName","PeriodName","period_name","Period_Name","code","Code","name","Name","title","Title"], periodId ? `Đợt ${periodId}` : "Chưa xác định"),
      status: statusValue,
      startDate: startDateText,
      endDate: endDateText,
      daysRemaining,
      elapsedLabel: formatCompactDuration(elapsedMinutes),
      countdownLabel,
    };
  }, [currentTimestamp, periodId, pipeline?.overallCompletionPercent, snapshot?.monitoring?.period, snapshot?.monitoring?.tags]);

  const dashboardHasSnapshotContent = useMemo(
    () =>
      Boolean(
        pipeline ||
          analytics?.overview ||
          scoringMatrix.length > 0 ||
          (postDefense?.items?.length ?? 0) > 0 ||
          (audit?.syncHistory?.length ?? 0) > 0 ||
          (audit?.publishHistory?.length ?? 0) > 0 ||
          (audit?.councilAuditHistory?.length ?? 0) > 0 ||
          (audit?.revisionAuditTrail?.length ?? 0) > 0,
      ),
    [analytics?.overview, audit?.councilAuditHistory?.length, audit?.publishHistory?.length, audit?.revisionAuditTrail?.length, audit?.syncHistory?.length, pipeline, postDefense?.items?.length, scoringMatrix.length],
  );

  const auditTimelineItems = useMemo(() => {
    const keyword = auditKeyword.trim().toUpperCase();
    const filter = auditActionFilter;
    const rows = [
      ...(audit?.councilAuditHistory ?? []).map((row, index) => ({
        key: `council-${index}`,
        action: pickText(row, ["action", "event", "type"], "Open"),
        actor: pickText(row, ["actor", "user", "createdBy", "name"], "System"),
        timestamp: pickText(row, ["timestamp", "createdAt", "time"], "-"),
        detail: pickText(row, ["detail", "note", "description"], "-"),
      })),
      ...(audit?.revisionAuditTrail ?? []).map((row, index) => ({
        key: `revision-${index}`,
        action: pickText(row, ["action", "event", "type"], "Reopen"),
        actor: pickText(row, ["actor", "user", "createdBy", "name"], "System"),
        timestamp: pickText(row, ["timestamp", "createdAt", "time"], "-"),
        detail: pickText(row, ["detail", "note", "description"], "-"),
      })),
      ...(audit?.publishHistory ?? []).map((row, index) => ({
        key: `publish-${index}`,
        action: pickText(row, ["action", "event", "type"], "Publish"),
        actor: pickText(row, ["actor", "user", "createdBy", "name"], "Publisher"),
        timestamp: pickText(row, ["publishedAt", "timestamp", "createdAt"], "-"),
        detail: pickText(row, ["detail", "note", "description"], "-"),
      })),
      ...(audit?.syncHistory ?? []).map((row, index) => ({
        key: `sync-${index}`,
        action: pickText(row, ["action", "event", "type"], "Sync"),
        actor: pickText(row, ["actor", "user", "createdBy", "name"], "System"),
        timestamp: pickText(row, ["timestamp", "createdAt", "time"], "-"),
        detail: pickText(row, ["detail", "note", "description"], "-"),
      })),
    ];

    const actionMatches = (actionText: string) => {
      if (filter === "all") {
        return true;
      }
      const normalized = actionText.toLowerCase();
      const tokens: Record<AuditActionFilter, string[]> = {
        all: [],
        open: ["open", "mo"],
        submit: ["submit", "nop"],
        reopen: ["reopen", "mo lai", "rollback"],
        lock: ["lock", "khoa"],
        publish: ["publish", "cong bo"],
        sync: ["sync", "dong bo"],
      };
      return tokens[filter].some((token) => normalized.includes(token));
    };

    return rows
      .filter((item) => actionMatches(item.action))
      .filter((item) => {
        if (!keyword) {
          return true;
        }
        const haystack = `${item.actor} ${item.action} ${item.detail}`.toUpperCase();
        return haystack.includes(keyword);
      })
      .slice(0, Math.max(1, auditSize));
  }, [audit, auditActionFilter, auditKeyword, auditSize]);

  const revisionRows = useMemo(() => {
    const items = postDefense?.items ?? [];
    const keyword = revisionKeyword.trim().toLowerCase();
    const status = revisionStatus;

    return items
      .filter((item) => {
        if (status === "all") return true;
        return String(item.status ?? "").toLowerCase() === status;
      })
      .filter((item) => {
        if (!keyword) return true;
        const haystack = `${item.studentCode} ${item.studentName} ${item.topicTitle}`.toLowerCase();
        return haystack.includes(keyword);
      })
      .map((item) => {
        const matrixRow = scoringMatrix.find(m => m.studentCode === item.studentCode);
        return {
          ...item,
          committeeCode: item.committeeCode || matrixRow?.committeeCode,
          committeeSecretaryName: matrixRow?.committeeSecretaryName,
          statusLabel: item.status === "APPROVED" ? "Đã duyệt" : item.status === "PENDING" ? "Chờ duyệt" : "Yêu cầu sửa",
          deadlineDate: item.submissionDeadline ? new Date(item.submissionDeadline).toLocaleDateString("vi-VN") : "-",
        };
      });
  }, [postDefense?.items, revisionKeyword, revisionStatus]);

  const recentExports = useMemo(

    () => snapshot?.reporting?.recentExports ?? [],
    [snapshot?.reporting?.recentExports],
  );

  const exportAllFields = useMemo(
    () => exportFieldGroups.flatMap((group) => group.fields),
    [],
  );

  const exportFieldLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    exportAllFields.forEach((field) => {
      map.set(field.key, field.label);
    });
    return map;
  }, [exportAllFields]);

  const exportResolvedReportType = useMemo<ReportType>(() => {
    if (exportTemplateMode === "council-minutes") {
      return "minutes";
    }
    if (exportTemplateMode === "statistics") {
      return exportScopeMode === "per-council" ? "scoreboard" : "final-term";
    }
    if (exportScopeMode === "per-council") {
      return "council-summary";
    }
    return "final-term";
  }, [exportScopeMode, exportTemplateMode]);

  const exportCouncilOptions = useMemo(() => {
    const rows = scoringMatrix.filter((row) => row.committeeId != null || row.committeeCode);
    const map = new Map<string, string>();
    rows.forEach((row) => {
      const key = row.committeeId != null ? String(row.committeeId) : String(row.committeeCode ?? "").trim();
      if (!key || map.has(key)) {
        return;
      }
      const label = row.committeeCode ? `${row.committeeCode}${row.committeeName ? ` - ${row.committeeName}` : ""}` : `Hội đồng ${key}`;
      map.set(key, label);
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [scoringMatrix]);

  const exportFilteredGroups = useMemo(() => {
    const keyword = exportFieldSearch.trim().toLowerCase();
    if (!keyword) {
      return exportFieldGroups;
    }
    return exportFieldGroups
      .map((group) => ({
        ...group,
        fields: group.fields.filter((field) => field.label.toLowerCase().includes(keyword) || field.key.toLowerCase().includes(keyword)),
      }))
      .filter((group) => group.fields.length > 0);
  }, [exportFieldSearch]);

  const getExportFieldValue = useCallback(
    (row: ScoringMatrixRow, fieldKey: string, rowNumber: number) => {
      const scoreValue = Number(row.finalScore ?? row.currentScore ?? 0);
      const scoreText = Number.isFinite(scoreValue) && scoreValue > 0 ? scoreValue.toFixed(1) : "-";
      const startDate = parseDateValue(row.startTime);

      switch (fieldKey) {
        case "RowNumber":
          return rowNumber;
        case "StudentCode":
          return row.studentCode ?? "-";
        case "StudentName":
          return row.studentName ?? "-";
        case "ClassName":
          return row.className ?? "-";
        case "CohortCode":
          return row.cohortCode ?? "-";
        case "TopicCode":
          return row.topicCode ?? "-";
        case "TopicTitle":
          return row.topicTitle ?? "-";
        case "TopicTags":
          return "-";
        case "AssignmentCode":
          return row.assignmentCode ?? "-";
        case "SupervisorLecturerName":
          return row.supervisorLecturerName ?? row.supervisorName ?? "-";
        case "CommitteeCode":
          return row.committeeCode ?? "-";
        case "CommitteeChairName":
          return row.committeeChairName ?? row.chairName ?? row.chair ?? "-";
        case "CommitteeSecretaryName":
          return row.committeeSecretaryName ?? row.secretaryName ?? row.secretary ?? "-";
        case "CommitteeReviewerName":
          return row.committeeReviewerName ?? row.reviewerName ?? row.reviewer ?? "-";
        case "Room":
          return row.room ?? "-";
        case "ScoreCt":
          return row.scoreCt != null ? Number(row.scoreCt).toFixed(1) : "-";
        case "ScoreTk":
          return row.scoreTk != null ? Number(row.scoreTk).toFixed(1) : "-";
        case "ScorePb":
          return row.scorePb != null ? Number(row.scorePb).toFixed(1) : "-";
        case "ScoreGvhd":
          return row.scoreGvhd != null ? Number(row.scoreGvhd).toFixed(1) : "-";
        case "Score":
          return scoreText;
        case "Grade":
          return scoreText === "-" ? "-" : getGradeFromScore(scoreValue);
        case "Variance":
          return row.variance != null ? Number(row.variance).toFixed(1) : "-";
        case "DefenseDate":
          return startDate ? startDate.toLocaleDateString("vi-VN") : "-";
        case "Session":
          return startDate ? (startDate.getHours() < 12 ? "Sáng" : "Chiều") : "-";
        case "StartTime":
          return row.startTime ?? "-";
        case "EndTime":
          return row.endTime ?? "-";
        case "Status":
          return row.status ?? "-";
        case "IsLocked":
          return row.isLocked ? "Có" : "Không";
        case "SubmittedCount":
          return row.submittedCount ?? "-";
        case "RequiredCount":
          return row.requiredCount ?? "-";
        case "CommentGvhd":
          return row.commentGvhd ?? "-";
        case "DocumentCount":
          return row.defenseDocuments?.length ?? 0;
        case "RevisionReason":
          return row.revisionReason ?? "-";
        case "SubmissionDeadline":
          return row.submissionDeadline ? new Date(row.submissionDeadline).toLocaleDateString("vi-VN") : "-";
        case "SecretaryComment":
          return row.secretaryComment ?? "-";
        case "CommitteeId":
          return row.committeeId ?? "-";
        case "CommitteeName":
          return row.committeeName ?? "-";
        case "SupervisorLecturerCode":
          return row.supervisorLecturerCode ?? "-";
        case "SupervisorOrganization":
          return row.supervisorOrganization ?? "-";
        case "CommentCt":
          return row.commentCt ?? "-";
        case "CommentTk":
          return row.commentTk ?? "-";
        case "CommentPb":
          return row.commentPb ?? "-";
        case "AssignmentId":
          return row.assignmentId ?? "-";
        case "IsPassed":
          return scoreValue >= 5 ? "Đạt" : "Không đạt";
        case "FinalGrade":
          return row.finalGrade ?? "-";
        case "FinalScore":
          return row.finalScore != null ? Number(row.finalScore).toFixed(1) : "-";
        case "CommitteeChairCode":
          return row.committeeChairCode ?? "-";
        case "CommitteeSecretaryCode":
          return row.committeeSecretaryCode ?? "-";
        case "CommitteeReviewerCode":
          return row.committeeReviewerCode ?? "-";
        case "TopicSupervisorScore":
          return row.topicSupervisorScore != null ? Number(row.topicSupervisorScore).toFixed(1) : "-";
        case "VarianceStatus":
          return row.variance != null && row.variance >= 2 ? "Lệch cao" : "Bình thường";
        case "ResultStatus":
          return scoreValue >= 5 ? "PASSED" : "FAILED";
        case "TopicId":
          return row.topicCode ?? "-";
        case "SupervisorLecturerId":
          return row.supervisorLecturerCode ?? "-";
        case "IsOnline":
          return "Không";
        case "MeetingUrl":
          return "-";
        case "DefenseSessionCode":
          return row.sessionCode ?? "-";
        default:
          return "-";
      }
    },
    [],
  );

  const exportPreviewColumns = useMemo(() => {
    const selected = exportSelectedFields.slice(0, 3);
    if (selected.length > 0) {
      return selected;
    }
    return ["StudentCode", "StudentName", "Score"];
  }, [exportSelectedFields]);

  const exportPreviewRows = useMemo(() => {
    const topicKeyword = exportTopicKeyword.trim().toLowerCase();
    const rows = scoringMatrix
      .filter((row) => (exportOnlyLocked ? row.isLocked : true))
      .filter((row) => (exportOnlyPublished ? row.finalScore != null : true))
      .filter((row) => {
        if (exportScopeMode !== "per-council") {
          return true;
        }
        if (!reportCouncilId.trim()) {
          return true;
        }
        const councilId = String(row.committeeId ?? "").trim();
        const councilCode = String(row.committeeCode ?? "").trim().toLowerCase();
        const keyword = reportCouncilId.trim().toLowerCase();
        return councilId === reportCouncilId.trim() || councilCode.includes(keyword);
      })
      .filter((row) => {
        if (exportScopeMode !== "per-topic" || !topicKeyword) {
          return true;
        }
        const haystack = `${row.topicCode ?? ""} ${row.topicTitle ?? ""} ${row.studentCode ?? ""} ${row.studentName ?? ""}`.toLowerCase();
        return haystack.includes(topicKeyword);
      })
      .slice(0, 6);

    return rows.map((row, index) => ({
      key: `${row.assignmentId ?? row.studentCode ?? index}`,
      values: exportPreviewColumns.map((columnKey) => getExportFieldValue(row, columnKey, index + 1)),
    }));
  }, [
    exportOnlyLocked,
    exportOnlyPublished,
    exportPreviewColumns,
    exportScopeMode,
    exportTopicKeyword,
    getExportFieldValue,
    reportCouncilId,
    scoringMatrix,
  ]);

  const exportPreviewModalColumns = useMemo(() => {
    if (exportSelectedFields.length > 0) {
      return exportSelectedFields;
    }
    return ["StudentCode", "StudentName", "Score"];
  }, [exportSelectedFields]);

  const exportPreviewModalRows = useMemo(() => {
    const topicKeyword = exportTopicKeyword.trim().toLowerCase();
    const rows = scoringMatrix
      .filter((row) => (exportOnlyLocked ? row.isLocked : true))
      .filter((row) => (exportOnlyPublished ? row.finalScore != null : true))
      .filter((row) => {
        if (exportScopeMode !== "per-council") {
          return true;
        }
        if (!reportCouncilId.trim()) {
          return true;
        }
        const councilId = String(row.committeeId ?? "").trim();
        const councilCode = String(row.committeeCode ?? "").trim().toLowerCase();
        const keyword = reportCouncilId.trim().toLowerCase();
        return councilId === reportCouncilId.trim() || councilCode.includes(keyword);
      })
      .filter((row) => {
        if (exportScopeMode !== "per-topic" || !topicKeyword) {
          return true;
        }
        const haystack = `${row.topicCode ?? ""} ${row.topicTitle ?? ""} ${row.studentCode ?? ""} ${row.studentName ?? ""}`.toLowerCase();
        return haystack.includes(topicKeyword);
      })
      .slice(0, 6);

    return rows.map((row, index) => ({
      key: `${row.assignmentId ?? row.studentCode ?? index}`,
      values: exportPreviewModalColumns.map((columnKey) => getExportFieldValue(row, columnKey, index + 1)),
    }));
  }, [
    exportOnlyLocked,
    exportOnlyPublished,
    exportPreviewModalColumns,
    exportScopeMode,
    exportTopicKeyword,
    getExportFieldValue,
    reportCouncilId,
    scoringMatrix,
  ]);

  useEffect(() => {
    if (exportTemplateMode !== "custom") {
      setExportSelectedFields([...exportTemplateFieldPresets[exportTemplateMode]]);
    }
  }, [exportTemplateMode]);

  const toggleExportField = useCallback((fieldKey: string) => {
    setExportSelectedFields((prev) => {
      if (prev.includes(fieldKey)) {
        return prev.filter((key) => key !== fieldKey);
      }
      return [...prev, fieldKey];
    });
  }, []);

  const toggleExportGroup = useCallback((group: ExportFieldGroup) => {
    const groupKeys = group.fields.map((field) => field.key);
    setExportSelectedFields((prev) => {
      const allSelected = groupKeys.every((key) => prev.includes(key));
      if (allSelected) {
        return prev.filter((key) => !groupKeys.includes(key));
      }
      const merged = [...prev];
      groupKeys.forEach((key) => {
        if (!merged.includes(key)) {
          merged.push(key);
        }
      });
      return merged;
    });
  }, []);

  const toggleExportGroupExpand = useCallback((groupKey: string) => {
    setExportExpandedGroups((prev) => (prev.includes(groupKey) ? prev.filter((key) => key !== groupKey) : [...prev, groupKey]));
  }, []);

  const selectAllExportFields = useCallback(() => {
    setExportSelectedFields(exportAllFields.map((field) => field.key));
  }, [exportAllFields]);

  const resetExportFields = useCallback(() => {
    setExportSelectedFields(exportTemplateFieldPresets[exportTemplateMode]);
  }, [exportTemplateMode]);

  const tabNavTop = commandBarHeight > 0 ? commandBarHeight + 24 : 12;

  const focusCommittee = useCallback(
    (committeeCode: string) => {
      const normalizedCode = String(committeeCode ?? "").trim();
      if (!normalizedCode) {
        return;
      }

      setCommitteeIdFilter(normalizedCode);
      const matchedRow = committeeOperationalRows.find(
        (row) => row.code.toUpperCase() === normalizedCode.toUpperCase() || row.key.toUpperCase() === normalizedCode.toUpperCase(),
      );
      if (matchedRow) {
        setSelectedCouncilCode(matchedRow.code);
        const numericMatch = matchedRow.code.match(/\d+/);
        setSelectedCouncilNumericId(numericMatch ? Number(numericMatch[0]) : null);
        setSelectedCouncilRow({
          code: matchedRow.code,
          name: matchedRow.name,
          room: matchedRow.room,
          chair: matchedRow.chair,
          secretary: matchedRow.secretary,
          reviewer: matchedRow.reviewer,
        });
      }

      setActiveTab("committee");
    },
    [committeeOperationalRows],
  );

  const openCommitteeScoring = useCallback(
    (committeeRow: CommitteeSummary) => {
      setSelectedCouncilCode(committeeRow.code);
      const numericMatch = committeeRow.code.match(/\d+/);
      setSelectedCouncilNumericId(numericMatch ? Number(numericMatch[0]) : null);
      setSelectedCouncilRow({
        code: committeeRow.code,
        name: committeeRow.name,
        room: committeeRow.room,
        chair: committeeRow.chair,
        secretary: committeeRow.secretary,
        reviewer: committeeRow.reviewer,
      });
      setScoringModalOpen(true);
    },
    [],
  );

  const setCommitteeSearchFocus = useCallback(() => {
    committeeSearchInputRef.current?.focus();
    committeeSearchInputRef.current?.select();
  }, []);

  const renderSkeletonBlock = (height: number, width = "100%") => (
    <div
      style={{
        height,
        width,
        borderRadius: 8,
        background: "#e2e8f0",
      }}
    />
  );

  const renderSparkline = (values: number[], stroke = DEEP_BLUE_PRIMARY) => (
    <svg viewBox="0 0 88 26" width="100%" height="26" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`spark-${stroke.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polyline
        fill={`url(#spark-${stroke.replace(/[^a-z0-9]/gi, "")})`}
        stroke={stroke}
        strokeWidth="2"
        points={buildSparklinePoints(values)}
      />
    </svg>
  );

  const renderLeaderboardCard = (entry: LeaderboardEntry | null) => {
    if (!entry) {
      return null;
    }

    return (
      <div
        style={{
          border: "1px solid #cbd5e1",
          borderRadius: 12,
          padding: 12,
          background: "#ffffff",
          display: "grid",
          gap: 6,
        }}
      >
        <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#0f172a" }}>{entry.label}</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{entry.title}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: DEEP_BLUE_PRIMARY }}>{entry.score}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>{entry.committee}</div>
        <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>{entry.detail}</div>
      </div>
    );
  };

  const hasSnapshotContent = useMemo(
    () =>
      Boolean(
        pipeline ||
          analytics?.overview ||
          scoringMatrix.length > 0 ||
          (postDefense?.items?.length ?? 0) > 0 ||
          (audit?.syncHistory?.length ?? 0) > 0 ||
          (audit?.publishHistory?.length ?? 0) > 0 ||
          (audit?.councilAuditHistory?.length ?? 0) > 0 ||
          (audit?.revisionAuditTrail?.length ?? 0) > 0,
      ),
    [
      analytics?.overview,
      audit?.councilAuditHistory?.length,
      audit?.publishHistory?.length,
      audit?.revisionAuditTrail?.length,
      audit?.syncHistory?.length,
      pipeline,
      postDefense?.items?.length,
      scoringMatrix.length,
    ],
  );

  const formatNumber = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value.toLocaleString("vi-VN");
    }
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed.toLocaleString("vi-VN");
    }
    return "0";
  };

  const getMatrixStatus = (row: ScoringMatrixRow) => {
    const normalized = normalizeStatusKey(row.status ?? "");
    if (normalized.includes("PUBLISHED")) {
      return "published";
    }
    if (row.isLocked) {
      return "locked";
    }
    if (row.finalScore != null && Number(row.finalScore) > 0) {
      return "submitted";
    }
    if (row.variance != null && Math.abs(Number(row.variance)) >= 2) {
      return "warning";
    }
    return "waiting";
  };

  const getMatrixTone = (status: string) => {
    switch (status) {
      case "published":
        return { border: "#16a34a", bg: "#ecfdf3", text: "#15803d" };
      case "locked":
        return { border: "#1d4ed8", bg: "#eff6ff", text: "#1d4ed8" };
      case "submitted":
        return { border: "#0ea5e9", bg: "#e0f2fe", text: "#0ea5e9" };
      case "warning":
        return { border: "#f59e0b", bg: "#fffbeb", text: "#b45309" };
      default:
return { border: "#cbd5e1", bg: "#f8fafc", text: "#475569" };
    }
  };

  const getMatrixLabel = (status: string) => {
    switch (status) {
      case "published":
        return "Công bộ";
      case "locked":
        return "Đã khóa";
      case "submitted":
        return "Đã nộp";
      case "warning":
        return "Cảnh báo";
      default:
        return "Chờ";
    }
  };

  const renderAuditRows = (
    title: string,
    rows: Array<Record<string, unknown>>,
    primaryField: string,
    secondaryField: string,
  ) => (
    <section style={cardStyle}>
      <h3 style={{ marginTop: 0, fontSize: 16, color: "#0f172a" }}>{title}</h3>
      {rows.length === 0 ? (
        <div style={{ fontSize: 13, color: "#0f172a" }}>
          Chưa có dữ liệu để hiển thị.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {rows.slice(0, Math.min(rows.length, auditSize)).map((row, idx) => (
            <div
              key={`${title}-${idx}`}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                padding: "8px 10px",
                background: "#ffffff",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                {String(row[primaryField] ?? "-")}
              </div>
              <div style={{ fontSize: 12, color: "#0f172a", marginTop: 3 }}>
                {String(row[secondaryField] ?? "-")}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const renderOverviewTab = () => (
    <section style={{ display: "grid", gap: 24 }}>
      {/* 1. Statistics Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 20
      }}>
        <section style={{ background: "white", borderRadius: 24, padding: 24, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 12 }}>Tổng số Đề tài</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#f37021" }}>{dashboardMetrics.totalTopics ?? 0}</div>
          <p style={{ margin: "8px 0 0 0", fontSize: 13, color: "#64748b" }}>Đã chấm: {dashboardMetrics.scoredTopics ?? 0} / Đã chốt: {dashboardMetrics.lockedTopics ?? 0}</p>
        </section>

        <section style={{ background: "white", borderRadius: 24, padding: 24, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 12 }}>Tổng số Hội đồng</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: DEEP_BLUE_PRIMARY }}>{dashboardMetrics.totalCouncils ?? 0}</div>
          <p style={{ margin: "8px 0 0 0", fontSize: 13, color: "#64748b" }}>{dashboardMetrics.activeCouncils ?? 0} hội đồng đang hoạt động</p>
        </section>

        <section style={{ background: "white", borderRadius: 24, padding: 24, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 12 }}>Tỷ lệ Hoàn thành</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#16a34a" }}>{dashboardMetrics.completionRate}%</div>
          <p style={{ margin: "8px 0 0 0", fontSize: 13, color: "#64748b" }}>Tiến độ tổng thể của đợt bảo vệ</p>
        </section>

        <section style={{ background: "white", borderRadius: 24, padding: 24, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 12 }}>Cảnh báo Hệ thống</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: keyAlerts.length > 0 ? "#ef4444" : "#16a34a" }}>{keyAlerts.length}</div>
          <p style={{ margin: "8px 0 0 0", fontSize: 13, color: "#64748b" }}>{keyAlerts.length > 0 ? "Cần kiểm tra các hội đồng bị trễ" : "Hệ thống hoạt động ổn định"}</p>
        </section>
      </div>

      {/* 1.5. Critical Operational Warnings */}
      {(overdueCommitteesAlerts.length > 0 || topicsClosedNoScoreAlerts.length > 0) && (
        <div style={{
          background: "linear-gradient(135deg, #fff1f2 0%, #fff5f5 100%)",
          border: "1px solid #fecaca",
          borderRadius: "24px",
          padding: "24px",
          boxShadow: "0 10px 25px -5px rgba(239, 68, 68, 0.05)",
          display: "grid",
          gap: 16
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ShieldAlert size={22} color="#ef4444" />
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#991b1b" }}>Cảnh Báo Vận Hành Quan Trọng</h4>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            {/* Overdue Committees */}
            {overdueCommitteesAlerts.length > 0 && (
              <div style={{ background: "white", padding: 16, borderRadius: 18, border: "1px solid #fee2e2", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <AlertCircle size={16} color="#ef4444" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#991b1b" }}>Hội đồng quá hạn chưa đóng phiên ({overdueCommitteesAlerts.length})</span>
                </div>
                <div style={{ display: "grid", gap: 8, maxHeight: "200px", overflowY: "auto", paddingRight: 4 }}>
                  {overdueCommitteesAlerts.map((row) => (
                    <div key={row.key} style={{ fontSize: 13, padding: 12, borderRadius: 12, background: "#fef2f2", color: "#991b1b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong>{row.code}</strong> - {row.name}
                        <div style={{ fontSize: 11, color: "#b91c1c", marginTop: 2 }}>Phòng: {row.room} • Ngày bảo vệ: {row.defenseDate}</div>
                      </div>
                      <span style={{ fontSize: 11, background: "#fecaca", padding: "2px 6px", borderRadius: 6, fontWeight: 700 }}>QUÁ HẠN</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Closed topics with missing scores */}
            {topicsClosedNoScoreAlerts.length > 0 && (
              <div style={{ background: "white", padding: 16, borderRadius: 18, border: "1px solid #fed7aa", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <AlertTriangle size={16} color="#ea580c" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#c2410c" }}>Đề tài đóng hội đồng thiếu điểm ({topicsClosedNoScoreAlerts.length})</span>
                </div>
                <div style={{ display: "grid", gap: 8, maxHeight: "200px", overflowY: "auto", paddingRight: 4 }}>
                  {topicsClosedNoScoreAlerts.map((row) => (
                    <div key={row.assignmentId} style={{ fontSize: 13, padding: 12, borderRadius: 12, background: "#fff7ed", color: "#c2410c" }}>
                      <strong>{row.studentName}</strong> ({row.studentCode})
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#9a3412", marginTop: 2 }}>{row.topicTitle}</div>
                      <div style={{ fontSize: 11, color: "#ea580c", marginTop: 2 }}>
                        Hội đồng: {row.committeeCode} • Nhập: {row.submittedCount}/{row.requiredCount} cột điểm • Tổng: {row.finalScore ?? "Chưa có"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Main Dashboard Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 24 }}>
        {/* Left Column: Active Committees & Insights */}
        <div style={{ display: "grid", gap: 24 }}>
          {/* Active Committees Card */}
          <section style={{
            background: "white",
            borderRadius: 28,
            padding: 28,
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1e293b" }}>Hội đồng Đang Hoạt động</h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#64748b" }}>Theo dõi tiến độ chấm điểm thời gian thực</p>
              </div>
              <button 
                onClick={() => setActiveTab("committee")}
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  padding: "8px 16px",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  color: DEEP_BLUE_PRIMARY,
                  cursor: "pointer"
                }}
              >
                Xem tất cả
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              {committeeOperationalRows.filter(r => ["ONGOING", "READY"].includes(r.status)).slice(0, 4).map((row) => {
                const statusTone = getStatusTone(row.status);
                return (
                  <div key={row.key} style={{
                    padding: 20,
                    borderRadius: 20,
                    border: "1px solid #f1f5f9",
                    background: "#f8fafc",
                    position: "relative",
                    transition: "transform 0.2s ease"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                      <span style={{ fontWeight: 800, color: "#1e293b", fontSize: 15 }}>{row.code}</span>
                      <span style={{
                        padding: "4px 10px",
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 700,
                        background: statusTone.bg,
                        color: statusTone.text,
                        border: `1px solid ${statusTone.border}`
                      }}>
                        {getStatusLabel(row.status)}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
                      Phòng {row.room} • {row.chair}
                    </div>
                    <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ fontWeight: 600, color: "#475569" }}>{row.scoredTopics}/{row.totalTopics} Hoàn thành</span>
                      <span style={{ fontWeight: 700, color: DEEP_BLUE_PRIMARY }}>{row.progressPercent}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: "#e2e8f0", overflow: "hidden" }}>
                      <div style={{
                        width: `${row.progressPercent}%`,
                        height: "100%",
                        background: DEEP_BLUE_PRIMARY,
                        borderRadius: 99,
                        transition: "width 0.6s ease"
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Highlights Section */}
          <section style={{
            background: "white",
            borderRadius: 28,
            padding: 28,
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)"
          }}>
            <h3 style={{ margin: "0 0 20px 0", fontSize: 18, fontWeight: 800, color: "#1e293b" }}>Điểm nổi bật & Kỷ lục</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              {[leaderboardEntries.highest, leaderboardEntries.lowest, leaderboardEntries.fastest, leaderboardEntries.delayed].map((entry, i) => {
                if (!entry) return null;
                return (
                  <div key={i} style={{
                    padding: 16,
                    borderRadius: 16,
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9"
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 8 }}>{entry.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: DEEP_BLUE_PRIMARY, marginBottom: 4 }}>{entry.score}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#1e293b" }}>{entry.title}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{entry.committee}</div>
                  </div>
                );
              })}
            </div>
          </section>

        </div>

        {/* Right Column: Alerts & Global Progress */}
        <div style={{ display: "grid", gap: 24, alignContent: "start" }}>
          {/* Global Progress Card */}
          <section style={{
            background: "linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)",
            borderRadius: 28,
            padding: 28,
            color: "white",
            position: "relative",
            overflow: "hidden"
          }}>
            <div style={{ position: "relative", zIndex: 2 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, opacity: 0.8 }}>Tiến độ Toàn đợt</h3>
              <div style={{ fontSize: 48, fontWeight: 900, margin: "16px 0", letterSpacing: "-0.02em" }}>
                {dashboardMetrics.completionRate}<span style={{ fontSize: 24, opacity: 0.6 }}>%</span>
              </div>
              <div style={{ height: 10, borderRadius: 99, background: "rgba(255, 255, 255, 0.1)", marginBottom: 16, overflow: "hidden" }}>
                <div style={{
                  width: `${dashboardMetrics.completionRate}%`,
                  height: "100%",
                  background: "#f37021",
                  borderRadius: 99,
                  boxShadow: "0 0 20px rgba(243, 112, 33, 0.4)"
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
                <span>{dashboardMetrics.scoredTopics} Đề tài hoàn tất</span>
                <span>{dashboardMetrics.totalTopics} Tổng</span>
              </div>
            </div>
            {/* Decorative background shape */}
            <div style={{
              position: "absolute",
              bottom: -20,
              right: -20,
              width: 120,
              height: 120,
              background: "rgba(243, 112, 33, 0.1)",
              borderRadius: "50%",
              filter: "blur(40px)"
            }} />
          </section>

          {/* Critical Alerts Card */}
          <section style={{
            background: "white",
            borderRadius: 28,
            padding: 28,
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1e293b" }}>Cảnh báo Cần xử lý</h3>
              <div style={{
                background: keyAlerts.length > 0 ? "#fee2e2" : "#dcfce7",
                color: keyAlerts.length > 0 ? "#ef4444" : "#16a34a",
                padding: "4px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 800
              }}>
                {keyAlerts.length}
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {keyAlerts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: "#64748b", fontSize: 14 }}>
                  <CheckCircle2 size={32} style={{ color: "#16a34a", marginBottom: 8, opacity: 0.5 }} />
                  <div>Không có cảnh báo hoạt động</div>
                </div>
              ) : (
                keyAlerts.slice(0, 5).map((alert, i) => (
                  <div key={i} style={{
                    padding: 16,
                    borderRadius: 16,
                    background: alert.severity === "critical" ? "#fff1f2" : "#f8fafc",
                    border: `1px solid ${alert.severity === "critical" ? "#fecaca" : "#f1f5f9"}`,
                    display: "flex",
                    gap: 12
                  }}>
                    <div style={{ color: alert.severity === "critical" ? "#ef4444" : "#f59e0b", marginTop: 2 }}>
                      <AlertTriangle size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#1e293b" }}>{alert.title}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{alert.committeeCode} • {alert.detail}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );

  const renderAnalyticsTab = () => (
    <section style={{ display: "grid", gap: 24 }}>
      {/* 1. Analytics Header Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
        <section style={{ background: "white", borderRadius: 24, padding: 24, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 12 }}>Điểm trung bình</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 42, fontWeight: 900, color: DEEP_BLUE_PRIMARY }}>{formatNumber(analytics?.overview?.average)}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#16a34a" }}>/ 10.0</div>
          </div>
          <p style={{ margin: "8px 0 0 0", fontSize: 13, color: "#64748b" }}>Dựa trên {analytics?.overview?.totalRecords} bản ghi điểm</p>
        </section>

        <section style={{ background: "white", borderRadius: 24, padding: 24, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 12 }}>Tỷ lệ Đạt/Trượt</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                <span style={{ color: "#16a34a" }}>Đạt: {formatNumber(analytics?.overview?.passRate)}%</span>
                <span style={{ color: "#ef4444" }}>{formatNumber(100 - (analytics?.overview?.passRate ?? 0))}%</span>
              </div>
              <div style={{ height: 12, borderRadius: 99, background: "#fee2e2", overflow: "hidden", display: "flex" }}>
                <div style={{ width: `${analytics?.overview?.passRate}%`, height: "100%", background: "#16a34a" }} />
              </div>
            </div>
          </div>
        </section>

        <section style={{ background: "white", borderRadius: 24, padding: 24, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 12 }}>Độ lệch điểm (Variance)</div>
          <div style={{ fontSize: 42, fontWeight: 900, color: (analytics?.overview?.maxVariance ?? 0) > 2 ? "#ef4444" : "#1e293b" }}>
            {formatNumber(analytics?.overview?.maxVariance)}
          </div>
          <p style={{ margin: "8px 0 0 0", fontSize: 13, color: "#64748b" }}>Mức chênh lệch lớn nhất giữa các thành viên</p>
        </section>
      </div>

      {/* 2. Charts Section */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 24 }}>
        <section style={{ background: "white", borderRadius: 28, padding: 28, border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Phân bổ Xếp loại</h3>
            <div style={{ display: "flex", gap: 16 }}>
              {/* Chart Type Selector */}
              <div style={{ display: "flex", gap: 4, background: "#f1f5f9", padding: 4, borderRadius: 12 }}>
                {[
                  { key: "bar", icon: <BarChart3 size={14} /> },
                  { key: "pie", icon: <PieChart size={14} /> },
                  { key: "line", icon: <TrendingUp size={14} /> },
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setDistributionChartType(t.key as any)}
                    style={{
                      width: 32,
                      height: 32,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 8,
                      border: "none",
                      background: distributionChartType === t.key ? "white" : "transparent",
                      color: distributionChartType === t.key ? DEEP_BLUE_PRIMARY : "#64748b",
                      boxShadow: distributionChartType === t.key ? "0 2px 4px rgba(0,0,0,0.1)" : "none",
                      cursor: "pointer"
                    }}
                  >
                    {t.icon}
                  </button>
                ))}
              </div>

              {/* Data Mode Selector */}
              <div style={{ display: "flex", gap: 4, background: "#f1f5f9", padding: 4, borderRadius: 12 }}>
                {["grade", "score"].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setDistributionViewMode(mode as any)}
                    style={{
                      padding: "6px 16px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      border: "none",
                      background: distributionViewMode === mode ? "white" : "transparent",
                      color: distributionViewMode === mode ? DEEP_BLUE_PRIMARY : "#64748b",
                      boxShadow: distributionViewMode === mode ? "0 2px 4px rgba(0,0,0,0.1)" : "none",
                      cursor: "pointer"
                    }}
                  >
                    {mode === "grade" ? "Điểm chữ" : "Điểm số"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div style={{ height: 400, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            {distributionChartType === "bar" && (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "flex-end", gap: 16, paddingBottom: 40 }}>
                {distributionRows.map((item, i) => {
                  const percentage = (item.value / Math.max(1, distributionTotal)) * 100;
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>{item.value}</div>
                      <div style={{
                        width: "100%",
                        height: `${Math.max(5, percentage * 3)}px`,
                        background: distributionPalette[item.label] || DEEP_BLUE_PRIMARY,
                        borderRadius: "8px 8px 4px 4px",
                        transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                        position: "relative",
                        cursor: "pointer",
                        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)"
                      }} onMouseEnter={() => setHoveredDistributionLabel(item.label)} onMouseLeave={() => setHoveredDistributionLabel(null)}>
                        {hoveredDistributionLabel === item.label && (
                          <div style={{
                            position: "absolute",
                            top: -40,
                            left: "50%",
                            transform: "translateX(-50%)",
                            background: "#1e293b",
                            color: "white",
                            padding: "6px 10px",
                            borderRadius: 8,
                            fontSize: 11,
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            zIndex: 10,
                            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)"
                          }}>
                            {item.label}: {percentage.toFixed(1)}%
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", textAlign: "center" }}>{item.label}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {distributionChartType === "pie" && (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 40 }}>
                <svg width="280" height="280" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
                  {(() => {
                    let cumulativePercent = 0;
                    return distributionRows.map((item, i) => {
                      const percentage = (item.value / Math.max(1, distributionTotal)) * 100;
                      if (percentage === 0) return null;
                      
                      const startX = Math.cos(2 * Math.PI * (cumulativePercent / 100));
                      const startY = Math.sin(2 * Math.PI * (cumulativePercent / 100));
                      cumulativePercent += percentage;
                      const endX = Math.cos(2 * Math.PI * (cumulativePercent / 100));
                      const endY = Math.sin(2 * Math.PI * (cumulativePercent / 100));
                      
                      const largeArcFlag = percentage > 50 ? 1 : 0;
                      const pathData = `M 50 50 L ${50 + 40 * startX} ${50 + 40 * startY} A 40 40 0 ${largeArcFlag} 1 ${50 + 40 * endX} ${50 + 40 * endY} Z`;
                      
                      return (
                        <path
                          key={i}
                          d={pathData}
                          fill={distributionPalette[item.label] || DEEP_BLUE_PRIMARY}
                          stroke="white"
                          strokeWidth="0.5"
                          onMouseEnter={() => setHoveredDistributionLabel(item.label)}
                          onMouseLeave={() => setHoveredDistributionLabel(null)}
                          style={{ transition: "all 0.3s ease", cursor: "pointer", opacity: hoveredDistributionLabel && hoveredDistributionLabel !== item.label ? 0.4 : 1 }}
                        />
                      );
                    });
                  })()}
                </svg>
                <div style={{ display: "grid", gap: 12 }}>
                  {distributionRows.map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, opacity: hoveredDistributionLabel && hoveredDistributionLabel !== item.label ? 0.4 : 1 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 4, background: distributionPalette[item.label] || DEEP_BLUE_PRIMARY }} />
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>{item.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#1e293b" }}>{((item.value / Math.max(1, distributionTotal)) * 100).toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {distributionChartType === "line" && (
              <div style={{ width: "100%", height: "100%", padding: "40px 20px 60px 20px", display: "flex", flexDirection: "column" }}>
                <svg width="100%" height="100%" viewBox="0 0 1000 400" preserveAspectRatio="none">
                  {/* Grid Lines */}
                  {[0, 25, 50, 75, 100].map((v) => (
                    <line key={v} x1="0" y1={400 - v * 4} x2="1000" y2={400 - v * 4} stroke="#f1f5f9" strokeWidth="1" />
                  ))}
                  
                  {/* Line Path */}
                  {(() => {
                    const maxVal = Math.max(1, ...distributionRows.map(d => d.value));
                    const points = distributionRows.map((item, i) => {
                      const x = (i / Math.max(1, distributionRows.length - 1)) * 1000;
                      const y = 400 - (item.value / maxVal) * 350;
                      return `${x},${y}`;
                    }).join(" ");
                    
                    return (
                      <>
                        <path
                          d={`M ${points}`}
                          fill="none"
                          stroke={DEEP_BLUE_PRIMARY}
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {distributionRows.map((item, i) => {
                          const x = (i / Math.max(1, distributionRows.length - 1)) * 1000;
                          const y = 400 - (item.value / maxVal) * 350;
                          return (
                            <circle
                              key={i}
                              cx={x}
                              cy={y}
                              r="6"
                              fill="white"
                              stroke={DEEP_BLUE_PRIMARY}
                              strokeWidth="3"
                              onMouseEnter={() => setHoveredDistributionLabel(item.label)}
                              onMouseLeave={() => setHoveredDistributionLabel(null)}
                              style={{ cursor: "pointer" }}
                            />
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
                  {distributionRows.map((item, i) => (
                    <div key={i} style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textAlign: "center", width: `${100 / distributionRows.length}%` }}>
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section style={{ background: "white", borderRadius: 28, padding: 28, border: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: "0 0 24px 0", fontSize: 18, fontWeight: 800 }}>Thống kê Trạng thái</h3>
          <div style={{ display: "grid", gap: 20 }}>
             {[
               { label: "Đã công bố", count: dashboardMetrics.waitingPublicTopics, total: dashboardMetrics.totalTopics, color: "#16a34a" },
               { label: "Đã khóa điểm", count: dashboardMetrics.lockedTopics, total: dashboardMetrics.totalTopics, color: "#0ea5e9" },
               { label: "Đang chấm", count: dashboardMetrics.liveTopics, total: dashboardMetrics.totalTopics, color: "#f59e0b" },
               { label: "Chưa bắt đầu", count: dashboardMetrics.waitingTopics, total: dashboardMetrics.totalTopics, color: "#64748b" },
             ].map((stat, i) => (
               <div key={i}>
                 <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                   <span style={{ color: "#475569" }}>{stat.label}</span>
                   <span style={{ color: stat.color }}>{stat.count} <span style={{ fontSize: 11, opacity: 0.6 }}>/ {stat.total}</span></span>
                 </div>
                 <div style={{ height: 8, borderRadius: 99, background: "#f1f5f9", overflow: "hidden" }}>
                   <div style={{
                     width: `${(stat.count / Math.max(1, stat.total)) * 100}%`,
                     height: "100%",
                     background: stat.color,
                     borderRadius: 99
                   }} />
                 </div>
               </div>
             ))}
          </div>
        </section>
      </div>

      {/* 3. Students List Section */}
      <section style={{ background: "white", borderRadius: 28, padding: 28, border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Bảng điểm chi tiết</h3>
          <div style={{ display: "flex", gap: 12 }}>
            <input 
              placeholder="Tìm theo tên, mã SV, đề tài..."
              style={{ padding: "10px 16px", borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 14, width: 300 }}
            />
            <select 
               style={{ 
                 padding: "10px 36px 10px 16px", borderRadius: 14, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 700, color: "#1e293b", background: "white",
                 backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' /%3E%3C/svg%3E\")",
                 backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", backgroundSize: "16px", appearance: "none", cursor: "pointer", transition: "all 0.2s", outline: "none"
               }}
               value={String(studentTableIsPassedFilter)}
               onChange={(e) => {
                 const val = e.target.value;
                 setStudentTableIsPassedFilter(val === "all" ? "all" : val === "true");
               }}
               onMouseEnter={(e) => { e.currentTarget.style.borderColor = DEEP_BLUE_PRIMARY; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.05)"; }}
               onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <option value="all">Tất cả kết quả</option>
              <option value="true">Đạt</option>
              <option value="false">Trượt</option>
            </select>
            <select 
               style={{ 
                 padding: "10px 36px 10px 16px", borderRadius: 14, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 700, color: "#1e293b", background: "white",
                 backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' /%3E%3C/svg%3E\")",
                 backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", backgroundSize: "16px", appearance: "none", cursor: "pointer", transition: "all 0.2s", outline: "none"
               }}
               value={studentTableStatusFilter}
               onChange={(e) => setStudentTableStatusFilter(e.target.value as any)}
               onMouseEnter={(e) => { e.currentTarget.style.borderColor = DEEP_BLUE_PRIMARY; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.05)"; }}
               onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="post-defense">Hậu bảo vệ</option>
              <option value="locked">Đã khóa điểm</option>
              <option value="scoring">Đang chấm</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" }}>
            <thead>
              <tr style={{ color: "#64748b", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <th 
                  onClick={() => handleStudentTableSort("studentName")}
                  style={{ padding: "12px 20px", textAlign: "left", cursor: "pointer", userSelect: "none" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    Sinh viên
                    {studentTableSortField === "studentName" && (studentTableSortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </div>
                </th>
                <th 
                  onClick={() => handleStudentTableSort("topicTitle")}
                  style={{ padding: "12px 20px", textAlign: "left", cursor: "pointer", userSelect: "none" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    Đề tài
                    {studentTableSortField === "topicTitle" && (studentTableSortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </div>
                </th>
                <th 
                  onClick={() => handleStudentTableSort("committeeCode")}
                  style={{ padding: "12px 20px", textAlign: "center", cursor: "pointer", userSelect: "none" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    Hội đồng
                    {studentTableSortField === "committeeCode" && (studentTableSortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </div>
                </th>
                <th 
                  onClick={() => handleStudentTableSort("finalScore")}
                  style={{ padding: "12px 20px", textAlign: "center", cursor: "pointer", userSelect: "none" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    Điểm
                    {studentTableSortField === "finalScore" && (studentTableSortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </div>
                </th>
                <th style={{ padding: "12px 20px", textAlign: "center" }}>Xếp loại</th>
                <th style={{ padding: "12px 20px", textAlign: "center" }}>Kết quả</th>
                <th style={{ padding: "12px 20px", textAlign: "center" }}>Trạng thái</th>
                <th style={{ padding: "12px 20px", textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {studentTableSortedData.slice((studentTablePage - 1) * studentTablePageSize, studentTablePage * studentTablePageSize).map((row, i) => {
                const score = Number(row.finalScore ?? row.currentScore ?? 0);
                const grade = getGradeFromScore(score);
                const isPassed = row.isPassed ?? (score >= 5.0);
                const isPostDefense = postDefenseStudentCodes.has(row.studentCode);
                const statusLabel = isPostDefense ? "Hậu bảo vệ" : (row.isLocked ? "Đã khóa điểm" : "Đang chấm");

                return (
                  <tr key={i} style={{ 
                    background: isPostDefense ? "#fffcf0" : "#f8fafc", 
                    transition: "transform 0.2s ease",
                    borderLeft: isPostDefense ? "4px solid #f59e0b" : "none"
                  }}>
                    <td style={{ padding: "16px 20px", borderRadius: isPostDefense ? "0" : "16px 0 0 16px", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ fontWeight: 800, color: "#1e293b" }}>{row.studentName}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{row.studentCode}</div>
                    </td>
                    <td style={{ padding: "16px 20px", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9", maxWidth: 300 }}>
                      <div style={{ fontSize: 14, color: "#1e293b", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.topicTitle}</div>
                    </td>
                    <td style={{ padding: "16px 20px", textAlign: "center", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>
                      <span style={{ fontWeight: 700, color: DEEP_BLUE_PRIMARY }}>{row.committeeCode}</span>
                    </td>
                    <td style={{ padding: "16px 20px", textAlign: "center", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: DEEP_BLUE_PRIMARY }}>{score > 0 ? score.toFixed(1) : "-"}</div>
                    </td>
                    <td style={{ padding: "16px 20px", textAlign: "center", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>
                      <span style={{
                        padding: "4px 10px",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 900,
                        color: distributionPalette[grade] || DEEP_BLUE_PRIMARY,
                        background: `${distributionPalette[grade]}15` || "#f1f5f9"
                      }}>{grade}</span>
                    </td>
                    <td style={{ padding: "16px 20px", textAlign: "center", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>
                      <span style={{
                        padding: "6px 12px",
                        borderRadius: 99,
                        fontSize: 11,
                        fontWeight: 800,
                        background: isPassed ? "#dcfce7" : "#fee2e2",
                        color: isPassed ? "#16a34a" : "#ef4444"
                      }}>{isPassed ? "ĐẠT" : "TRƯỢT"}</span>
                    </td>
                    <td style={{ padding: "16px 20px", textAlign: "center", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>
                      <span style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 800,
                        background: isPostDefense ? "#fef3c7" : (row.isLocked ? "#f0f9ff" : "#f1f5f9"),
                        color: isPostDefense ? "#b45309" : (row.isLocked ? "#0369a1" : "#475569"),
                        border: isPostDefense ? "1px solid #fbbf24" : "none"
                      }}>{statusLabel}</span>
                    </td>
                    <td style={{ padding: "16px 20px", textAlign: "right", borderRadius: "0 16px 16px 0", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center" }}>
                        {/* Dropdown for documents */}
                        <div style={{ position: "relative" }}>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation();
                              const rowId = `${row.studentCode}-${row.committeeCode}`;
                              setActiveRowActionId(activeRowActionId === rowId ? null : rowId);
                            }}
                            title="Tài liệu liên quan"
                            style={{ 
                              padding: "8px", 
                              borderRadius: 10, 
                              border: "1px solid #e2e8f0", 
                              background: activeRowActionId === `${row.studentCode}-${row.committeeCode}` ? "#f1f5f9" : "white", 
                              cursor: "pointer", 
                              color: DEEP_BLUE_PRIMARY, 
                              display: "flex", 
                              alignItems: "center", 
                              justifyContent: "center",
                              transition: "all 0.2s"
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = DEEP_BLUE_PRIMARY; }}
                            onMouseLeave={(e) => { if (activeRowActionId !== `${row.studentCode}-${row.committeeCode}`) e.currentTarget.style.borderColor = "#e2e8f0"; }}
                          >
                            <Files size={18} />
                          </button>

                          {activeRowActionId === `${row.studentCode}-${row.committeeCode}` && (
                            <div 
                              style={{ 
                                position: "absolute", 
                                right: 0, 
                                top: "calc(100% + 8px)", 
                                background: "white", 
                                borderRadius: 14, 
                                boxShadow: "0 10px 25px rgba(0,0,0,0.15)", 
                                border: "1px solid #f1f5f9",
                                minWidth: 180,
                                zIndex: 100,
                                padding: "6px",
                                animation: "fadeIn 0.2s ease"
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {[
                                { label: "Xem biên bản", icon: <FileText size={14} />, type: "meeting" },
                                { label: "Xem nhận xét", icon: <MessageSquare size={14} />, type: "reviewer" },
                              ].map((item) => (
                                <button
                                  key={item.type}
                                  onClick={() => {
                                    setSelectedMatrixRow(row); 
                                    hydrateMinutes(row.assignmentId as number, row.committeeId as number);
                                    setPreviewModalType(item.type as any);
                                    setActiveRowActionId(null);
                                  }}
                                  style={{
                                    width: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    padding: "10px 12px",
                                    borderRadius: 8,
                                    border: "none",
                                    background: "transparent",
                                    cursor: "pointer",
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: "#475569",
                                    textAlign: "left",
                                    transition: "all 0.2s"
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = DEEP_BLUE_PRIMARY; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#475569"; }}
                                >
                                  {item.icon}
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Detail Button */}
                        <button 
                          onClick={() => { setSelectedTopic(row); setTopicDetailModalOpen(true); }}
                          title="Xem chi tiết"
                          style={{ padding: "8px", borderRadius: 10, border: "1px solid #e2e8f0", background: "white", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = DEEP_BLUE_PRIMARY; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = "#64748b"; }}
                        >
                          <Search size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, padding: "0 8px" }}>
           <div style={{ fontSize: 14, color: "#64748b" }}>Hiển thị {studentTableSortedData.length} kết quả</div>
           <div style={{ display: "flex", gap: 8 }}>
             <button 
               onClick={() => setStudentTablePage(p => Math.max(1, p - 1))}
               style={{ padding: "10px 20px", borderRadius: 12, border: "1px solid #e2e8f0", background: "white", fontWeight: 700, cursor: "pointer" }}
             >Trước</button>
             <button 
               onClick={() => setStudentTablePage(p => p + 1)}
               style={{ padding: "10px 20px", borderRadius: 12, border: "1px solid #e2e8f0", background: "white", fontWeight: 700, cursor: "pointer" }}
             >Tiếp theo</button>
           </div>
        </div>
      </section>
    </section>
  );

  const renderCommitteeTab = () => (
    <section style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: 24 }}>
      {/* 1. Left Sidebar: Committee List */}
      <aside style={{
        background: "white",
        borderRadius: 28,
        padding: 24,
        border: "1px solid #e2e8f0",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        height: "calc(100vh - 180px)",
        position: "sticky",
        top: 96
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Danh sách Hội đồng</h3>
          <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#64748b" }}>{committeeOperationalRows.length} hội đồng đang quản lý</p>
        </div>

        <div style={{ position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input 
            value={committeeIdFilter}
            onChange={(e) => setCommitteeIdFilter(e.target.value)}
            placeholder="Tìm mã HĐ, phòng, chủ tịch..."
            style={{ width: "100%", padding: "12px 12px 12px 40px", borderRadius: 14, border: "1px solid #e2e8f0", fontSize: 14 }}
          />
        </div>

        <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 8, paddingRight: 4 }}>
          {visibleCommitteeRows.map((row) => {
            const isActive = selectedCommittee?.code === row.code;
            const statusTone = getStatusTone(row.status);
            return (
              <button
                key={row.key}
                onClick={() => focusCommittee(row.code)}
                style={{
                  textAlign: "left",
                  padding: 16,
                  borderRadius: 16,
                  border: `2px solid ${isActive ? DEEP_BLUE_PRIMARY : "#f1f5f9"}`,
                  background: isActive ? `${DEEP_BLUE_PRIMARY}05` : "white",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "grid",
                  gap: 8
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 800, color: "#1e293b" }}>{row.code}</span>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 800,
                    background: statusTone.bg,
                    color: statusTone.text
                  }}>{getStatusLabel(row.status)}</span>
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Phòng: {row.room} • {row.chair}
                </div>
                <div style={{ height: 4, borderRadius: 99, background: "#e2e8f0", marginTop: 4 }}>
                  <div style={{ width: `${row.progressPercent}%`, height: "100%", background: DEEP_BLUE_PRIMARY, borderRadius: 99 }} />
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* 2. Main Area: Committee Details */}
      <main style={{ display: "grid", gap: 24 }}>
        {!selectedCommittee ? (
          <div style={{
            background: "white",
            borderRadius: 28,
            padding: 80,
            border: "1px solid #e2e8f0",
            textAlign: "center",
            color: "#64748b"
          }}>
            <Users size={64} style={{ opacity: 0.1, marginBottom: 20 }} />
            <h3 style={{ fontSize: 20, fontWeight: 800, color: "#1e293b", margin: "0 0 8px 0" }}>Chọn một hội đồng</h3>
            <p>Vui lòng chọn hội đồng từ danh sách bên trái để xem chi tiết và quản lý điểm số.</p>
          </div>
        ) : (
          <>
            {/* Committee Info Header */}
            <section style={{ background: "white", borderRadius: 28, padding: 32, border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#1e293b" }}>{selectedCommittee.code}</h2>
                    <span style={{
                       padding: "6px 16px",
                       borderRadius: 99,
                       fontSize: 12,
                       fontWeight: 800,
                       background: getStatusTone(selectedCommittee.status).bg,
                       color: getStatusTone(selectedCommittee.status).text,
                       border: `1px solid ${getStatusTone(selectedCommittee.status).border}`
                    }}>{getStatusLabel(selectedCommittee.status)}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 16, color: "#64748b", fontWeight: 500 }}>
                    Phòng {selectedCommittee.room} • Ngày bảo vệ: {selectedCommittee.defenseDate}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button 
                    onClick={() => {
                      setPreviewModalType("scoreSheet");
                    }}
                    style={{
                      background: "white",
                      border: "1px solid #cbd5e1",
                      padding: "12px 24px",
                      borderRadius: 14,
                      fontSize: 14,
                      fontWeight: 700,
                      color: DEEP_BLUE_PRIMARY,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = DEEP_BLUE_PRIMARY}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = "#cbd5e1"}
                  >
                    <Download size={18} /> Xem bảng điểm HĐ
                  </button>
                  <button 
                    onClick={() => void submitCommitteeAction("OPEN_SESSION", selectedCommittee)}
                    style={{
                      background: DEEP_BLUE_PRIMARY,
                      color: "white",
                      border: "none",
                      padding: "12px 24px",
                      borderRadius: 14,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: "0 10px 15px -3px rgba(30, 58, 95, 0.2)"
                    }}
                  >Mở phiên làm việc</button>
                </div>
              </div>

              {/* Members Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                {[
                  { role: "Chủ tịch", name: selectedCommittee.chair, code: selectedCommittee.chairCode, icon: <User size={16} /> },
                  { role: "Thư ký", name: selectedCommittee.secretary, code: selectedCommittee.secretaryCode, icon: <MessageSquare size={16} /> },
                  { role: "Phản biện", name: selectedCommittee.reviewer, code: selectedCommittee.reviewerCode, icon: <Activity size={16} /> },
                  { role: "Hướng dẫn", name: selectedCommitteeSupervisor, code: selectedCommitteeSupervisorCode, icon: <Users size={16} /> },
                ].map((member, i) => (
                  <div key={i} style={{ padding: 20, borderRadius: 20, background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      {member.icon} {member.role}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#1e293b" }}>{member.name || "Chưa phân công"}</div>
                    {member.name && member.name !== "-" && member.code && (
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{member.code}</div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Topics List Table */}
            <section style={{ background: "white", borderRadius: 28, padding: 32, border: "1px solid #e2e8f0" }}>
              <h3 style={{ margin: "0 0 24px 0", fontSize: 20, fontWeight: 800 }}>Danh sách Đề tài</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 12px" }}>
                  <thead>
                    <tr style={{ color: "#64748b", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
                      <th style={{ padding: "0 16px", textAlign: "left" }}>Sinh viên</th>
                      <th style={{ padding: "0 16px", textAlign: "left" }}>Đề tài</th>
                      <th style={{ padding: "0 16px", textAlign: "center" }}>Điểm tổng</th>
                      <th style={{ padding: "0 16px", textAlign: "center" }}>Kết quả</th>
                      <th style={{ padding: "0 16px", textAlign: "right" }}>Tài liệu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCommitteeRows.map((row, i) => (
                      <tr key={i} style={{ background: "#f8fafc" }}>
                        <td style={{ padding: "20px 16px", borderRadius: "16px 0 0 16px" }}>
                          <div style={{ fontWeight: 800, color: "#1e293b" }}>{row.studentName}</div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>{row.studentCode}</div>
                        </td>
                        <td style={{ padding: "20px 16px" }}>
                          <div style={{ fontWeight: 600, color: "#1e293b" }}>{row.topicTitle}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{row.topicCode}</div>
                        </td>
                        <td style={{ padding: "20px 16px", textAlign: "center" }}>
                          <div style={{ fontSize: 20, fontWeight: 900, color: DEEP_BLUE_PRIMARY }}>{getTopicScoreDisplay(row)}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>{getTopicGradeDisplay(row)}</div>
                        </td>
                        <td style={{ padding: "20px 16px", textAlign: "center" }}>
                          <span style={{
                            padding: "6px 16px",
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 800,
                            background: row.isPassed ? "#dcfce7" : "#fee2e2",
                            color: row.isPassed ? "#16a34a" : "#ef4444"
                          }}>{row.isPassed ? "ĐẠT" : "TRƯỢT"}</span>
                        </td>
                        <td style={{ padding: "20px 16px", textAlign: "right", borderRadius: "0 16px 16px 0" }}>
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                            {/* Dropdown for documents */}
                            <div style={{ position: "relative" }}>
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation();
                                  const rowId = `${row.studentCode}-${row.committeeCode}-op`;
                                  setActiveRowActionId(activeRowActionId === rowId ? null : rowId);
                                }}
                                title="Tài liệu liên quan"
                                style={{ 
                                  padding: "8px", 
                                  borderRadius: 10, 
                                  border: "1px solid #e2e8f0", 
                                  background: activeRowActionId === `${row.studentCode}-${row.committeeCode}-op` ? "#f1f5f9" : "white", 
                                  cursor: "pointer", 
                                  color: DEEP_BLUE_PRIMARY, 
                                  display: "flex", 
                                  alignItems: "center", 
                                  justifyContent: "center",
                                  transition: "all 0.2s"
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = DEEP_BLUE_PRIMARY; }}
                                onMouseLeave={(e) => { if (activeRowActionId !== `${row.studentCode}-${row.committeeCode}-op`) e.currentTarget.style.borderColor = "#e2e8f0"; }}
                              >
                                <Files size={18} />
                              </button>

                              {activeRowActionId === `${row.studentCode}-${row.committeeCode}-op` && (
                                <div 
                                  style={{ 
                                    position: "absolute", 
                                    right: 0, 
                                    top: "calc(100% + 8px)", 
                                    background: "white", 
                                    borderRadius: 14, 
                                    boxShadow: "0 10px 25px rgba(0,0,0,0.15)", 
                                    border: "1px solid #f1f5f9",
                                    minWidth: 180,
                                    zIndex: 100,
                                    padding: "6px",
                                    animation: "fadeIn 0.2s ease"
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {[
                                    { label: "Xem biên bản", icon: <FileText size={14} />, type: "meeting" },
                                    { label: "Xem nhận xét", icon: <MessageSquare size={14} />, type: "reviewer" },
                                  ].map((item) => (
                                    <button
                                      key={item.type}
                                      onClick={() => {
                                        setSelectedMatrixRow(row); 
                                        hydrateMinutes(row.assignmentId as number, row.committeeId as number);
                                        setPreviewModalType(item.type as any);
                                        setActiveRowActionId(null);
                                      }}
                                      style={{
                                        width: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                        padding: "10px 12px",
                                        borderRadius: 8,
                                        border: "none",
                                        background: "transparent",
                                        cursor: "pointer",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: "#334155",
                                        textAlign: "left",
                                        transition: "all 0.15s"
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background = "#f1f5f9";
                                        e.currentTarget.style.color = DEEP_BLUE_PRIMARY;
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = "transparent";
                                        e.currentTarget.style.color = "#334155";
                                      }}
                                    >
                                      {item.icon}
                                      {item.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            <button onClick={() => { setSelectedTopic(row); setTopicDetailModalOpen(true); }} style={{ padding: "8px", borderRadius: 10, border: "1px solid #e2e8f0", background: "white", cursor: "pointer", color: "#64748b" }} title="Chi tiết"><Search size={18} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </section>
  );

  const renderPostDefenseTab = () => (
    <section style={{ display: "grid", gap: 24 }}>
      {/* 1. Header Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        <section style={{ background: "white", borderRadius: 24, padding: 24, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 12 }}>Đã duyệt sửa đổi</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#16a34a" }}>{postDefense?.approvedRevisions ?? 0}</div>
          <p style={{ margin: "8px 0 0 0", fontSize: 13, color: "#64748b" }}>Trên tổng số {postDefense?.totalRevisions ?? 0} đề tài</p>
        </section>

        <section style={{ background: "white", borderRadius: 24, padding: 24, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 12 }}>Chờ xác nhận</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#f59e0b" }}>{postDefense?.pendingRevisions ?? 0}</div>
          <p style={{ margin: "8px 0 0 0", fontSize: 13, color: "#64748b" }}>Cần giảng viên & thư ký kiểm tra</p>
        </section>
      </div>

      {/* 2. Revisions Table */}
      <section style={{ background: "white", borderRadius: 28, padding: 32, border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Dữ liệu Sửa đổi Đồ án</h3>
          <div style={{ display: "flex", gap: 12 }}>
             <input 
              placeholder="Mã SV, mã đề tài..."
              style={{ padding: "10px 16px", borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 14, width: 250 }}
              value={revisionKeyword}
              onChange={(e) => setRevisionKeyword(e.target.value)}
            />
            <select 
               style={{ 
                 padding: "10px 36px 10px 16px", borderRadius: 14, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 700, color: "#1e293b", background: "white",
                 backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' /%3E%3C/svg%3E\")",
                 backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", backgroundSize: "16px", appearance: "none", cursor: "pointer", transition: "all 0.2s", outline: "none"
               }}
               value={revisionStatus}
               onChange={(e) => setRevisionStatus(e.target.value as any)}
               onMouseEnter={(e) => { e.currentTarget.style.borderColor = DEEP_BLUE_PRIMARY; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.05)"; }}
               onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="approved">Đã duyệt</option>
              <option value="pending">Chờ duyệt</option>
              <option value="rejected">Yêu cầu sửa lại</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" }}>
            <thead>
              <tr style={{ color: "#64748b", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
                <th style={{ padding: "12px 20px", textAlign: "left" }}>Sinh viên</th>
                <th style={{ padding: "12px 20px", textAlign: "left" }}>Đề tài</th>
                <th style={{ padding: "12px 20px", textAlign: "center" }}>Hội đồng</th>
                <th style={{ padding: "12px 20px", textAlign: "center" }}>Người phụ trách</th>
                <th style={{ padding: "12px 20px", textAlign: "center" }}>Hạn chốt</th>
                <th style={{ padding: "12px 20px", textAlign: "center" }}>Trạng thái</th>
                <th style={{ padding: "12px 20px", textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {revisionRows.map((row, i) => (
                <tr key={i} style={{ background: "#f8fafc" }}>
                  <td style={{ padding: "16px 20px", borderRadius: "16px 0 0 16px" }}>
                    <div style={{ fontWeight: 800, color: "#1e293b" }}>{row.studentName}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{row.studentCode}</div>
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <div style={{ fontSize: 14, color: "#1e293b", fontWeight: 600 }}>{row.topicTitle}</div>
                  </td>
                  <td style={{ padding: "16px 20px", textAlign: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: DEEP_BLUE_PRIMARY }}>{row.committeeCode || "-"}</div>
                  </td>
                  <td style={{ padding: "16px 20px", textAlign: "center" }}>
                    <div style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>{row.committeeSecretaryName || "-"}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>Thư ký</div>
                  </td>
                  <td style={{ padding: "16px 20px", textAlign: "center" }}>
                    <div style={{ fontSize: 13, color: "#475569" }}>{row.deadlineDate}</div>
                  </td>
                  <td style={{ padding: "16px 20px", textAlign: "center" }}>
                    <span style={{
                      padding: "6px 12px",
                      borderRadius: 99,
                      fontSize: 11,
                      fontWeight: 800,
                      background: row.status === "APPROVED" ? "#dcfce7" : row.status === "PENDING" ? "#fef3c7" : "#fee2e2",
                      color: row.status === "APPROVED" ? "#16a34a" : row.status === "PENDING" ? "#b45309" : "#ef4444"
                    }}>{row.statusLabel}</span>
                  </td>
                  <td style={{ padding: "16px 20px", textAlign: "right", borderRadius: "0 16px 16px 0" }}>
                    <button 
                      onClick={() => { 
                        const matrixMatch = scoringMatrix.find(m => m.studentCode === row.studentCode);
                        setSelectedTopic({ ...matrixMatch, ...row }); 
                        setTopicDetailModalOpen(true); 
                      }}
                      style={{ background: "white", border: "1px solid #e2e8f0", padding: "8px 12px", borderRadius: 10, cursor: "pointer", color: DEEP_BLUE_PRIMARY, fontWeight: 700 }}
                    >Chi tiết</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
  
    const renderExportTab = () => {
      const currentTemplate = exportTemplateOptions.find(t => t.value === exportTemplateMode) || exportTemplateOptions[0];
      const filteredGroups = exportFieldGroups.map(group => ({
        ...group,
        fields: group.fields.filter(f => 
          f.label.toLowerCase().includes(exportFieldSearch.toLowerCase()) || 
          f.key.toLowerCase().includes(exportFieldSearch.toLowerCase())
        )
      })).filter(group => group.fields.length > 0);

      return (
        <section style={{ background: "white", borderRadius: 28, padding: 32, border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Trung tâm Xuất dữ liệu</h3>
              <p style={{ margin: "4px 0 0 0", fontSize: 14, color: "#64748b" }}>Cấu hình và trích xuất báo cáo vận hành hội đồng chuyên sâu</p>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button 
                onClick={() => loadOperationsSnapshot()}
                style={{ padding: "10px 16px", borderRadius: 12, border: "1px solid #e2e8f0", background: "white", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: "#64748b", fontWeight: 700 }}
              >
                <RefreshCw size={16} /> Làm mới dữ liệu
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 40, alignItems: "start" }}>
            <aside style={{ background: "#f8fafc", padding: 24, borderRadius: 24, border: "1px solid #f1f5f9", position: "sticky", top: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: DEEP_BLUE_PRIMARY, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>1</div>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Chọn mẫu báo cáo</h4>
              </div>
              
              <div style={{ display: "grid", gap: 10 }}>
                {exportTemplateOptions.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => {
                      setExportTemplateMode(item.value);
                      setExportSelectedFields(exportTemplateFieldPresets[item.value] || []);
                    }}
                    style={{
                      width: "100%", padding: "16px", borderRadius: 18, textAlign: "left",
                      border: `2px solid ${exportTemplateMode === item.value ? DEEP_BLUE_PRIMARY : "transparent"}`,
                      background: exportTemplateMode === item.value ? "white" : "transparent",
                      boxShadow: exportTemplateMode === item.value ? "0 10px 15px -3px rgba(0,0,0,0.05)" : "none",
                      cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 14
                    }}
                  >
                    <div style={{ 
                      padding: 10, borderRadius: 12, 
                      background: exportTemplateMode === item.value ? `${DEEP_BLUE_PRIMARY}10` : "#f1f5f9",
                      color: exportTemplateMode === item.value ? DEEP_BLUE_PRIMARY : "#94a3b8" 
                    }}>{item.icon}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: exportTemplateMode === item.value ? 900 : 700, color: exportTemplateMode === item.value ? "#0f172a" : "#64748b" }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{item.description}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 40, paddingTop: 32, borderTop: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: DEEP_BLUE_PRIMARY, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>2</div>
                  <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Phạm vi trích xuất</h4>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {exportScopeOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setExportScopeMode(opt.value as any)}
                      style={{
                        padding: "14px 16px", borderRadius: 14, fontSize: 13, fontWeight: 700, textAlign: "left",
                        border: "1px solid #e2e8f0",
                        background: exportScopeMode === opt.value ? DEEP_BLUE_PRIMARY : "white",
                        color: exportScopeMode === opt.value ? "white" : "#64748b",
                        cursor: "pointer", transition: "all 0.2s"
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            <main style={{ display: "flex", flexDirection: "column", gap: 40 }}>
              <div style={{ background: "white", padding: 32, borderRadius: 28, border: "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: DEEP_BLUE_PRIMARY, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>3</div>
                    <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cấu hình trường dữ liệu</h4>
                  </div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <div style={{ position: "relative" }}>
                      <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                      <input 
                        placeholder="Tìm trường..."
                        style={{ padding: "10px 16px 10px 38px", borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13, width: 200 }}
                        value={exportFieldSearch}
                        onChange={(e) => setExportFieldSearch(e.target.value)}
                      />
                    </div>
                    <button onClick={() => setExportSelectedFields(exportFieldGroups.flatMap(g => g.fields.map(f => f.key)))} style={{ background: "none", border: "none", color: DEEP_BLUE_PRIMARY, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Chọn tất cả</button>
                    <button onClick={() => setExportSelectedFields([])} style={{ background: "none", border: "none", color: "#ef4444", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Bỏ chọn</button>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 40, maxHeight: 500, overflowY: "auto", paddingRight: 12 }}>
                  {filteredGroups.map(group => (
                    <div key={group.key}>
                      <div style={{ fontSize: 11, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
                        {group.label} <div style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                        {group.fields.map(field => (
                          <label
                            key={field.key}
                            style={{
                              display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 14,
                              border: `1px solid ${exportSelectedFields.includes(field.key) ? DEEP_BLUE_PRIMARY : "#f1f5f9"}`,
                              background: exportSelectedFields.includes(field.key) ? `${DEEP_BLUE_PRIMARY}05` : "#fcfdfe",
                              cursor: "pointer", transition: "all 0.2s"
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={exportSelectedFields.includes(field.key)}
                              onChange={() => {
                                setExportSelectedFields(prev => 
                                  prev.includes(field.key) ? prev.filter(k => k !== field.key) : [...prev, field.key]
                                );
                              }}
                              style={{ width: 18, height: 18, accentColor: DEEP_BLUE_PRIMARY, cursor: "pointer" }}
                            />
                            <span style={{ fontSize: 13, fontWeight: exportSelectedFields.includes(field.key) ? 800 : 600, color: exportSelectedFields.includes(field.key) ? "#0f172a" : "#64748b" }}>{field.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ 
                background: "white", 
                padding: "24px 32px", 
                borderRadius: 24, 
                border: "1px solid #e2e8f0", 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                boxShadow: "0 10px 30px rgba(0,0,0,0.04)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ 
                    width: 48, height: 48, borderRadius: 14, 
                    background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    {isExporting ? <Loader2 size={24} className="animate-spin" color={DEEP_BLUE_PRIMARY} /> : <Download size={24} color={DEEP_BLUE_PRIMARY} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#1e293b" }}>{isExporting ? "Đang xử lý..." : "Sẵn sàng trích xuất"}</div>
                    <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600, marginTop: 2 }}>
                      Đã chọn <span style={{ color: DEEP_BLUE_PRIMARY }}>{exportSelectedFields.length}</span> trường dữ liệu
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, position: "relative" }}>
                  <button
                    onClick={() => setExportPreviewModalOpen(true)}
                    style={{
                      padding: "12px 24px", borderRadius: 12, border: "1px solid #e2e8f0",
                      background: "white", color: "#475569", fontSize: 14, fontWeight: 700, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = DEEP_BLUE_PRIMARY; e.currentTarget.style.color = DEEP_BLUE_PRIMARY; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#475569"; }}
                  >
                    <Eye size={18} /> Xem trước
                  </button>

                  <div style={{ position: "relative" }} ref={exportDownloadMenuRef}>
                    <button
                      onClick={() => setExportDownloadMenuOpen(!exportDownloadMenuOpen)}
                      disabled={isExporting}
                      style={{
                        padding: "12px 24px", borderRadius: 12, border: "none",
                        background: DEEP_BLUE_PRIMARY, color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 10, transition: "all 0.2s"
                      }}
                    >
                      {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                      Tải xuống dữ liệu
                      <ChevronDown size={16} style={{ transform: exportDownloadMenuOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
                    </button>

                    {exportDownloadMenuOpen && (
                      <div style={{
                        position: "absolute", bottom: "calc(100% + 12px)", right: 0, width: 220,
                        background: "white", borderRadius: 16, boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
                        border: "1px solid #e2e8f0", padding: 8, zIndex: 100
                      }}>
                        {[
                          { label: "Xuất file Excel (.xlsx)", icon: <FileSpreadsheet size={16} />, format: "excel" as const, color: "#16a34a" },
                          { label: "Xuất file PDF (.pdf)", icon: <FileText size={16} />, format: "pdf" as const, color: "#ef4444" },
                        ].map(opt => (
                          <button
                            key={opt.format}
                            onClick={() => {
                              exportReport({ format: opt.format });
                              setExportDownloadMenuOpen(false);
                            }}
                            style={{
                              width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                              borderRadius: 10, border: "none", background: "none", cursor: "pointer",
                              fontSize: 13, fontWeight: 700, color: "#475569", transition: "all 0.2s", textAlign: "left"
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.color = opt.color; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#475569"; }}
                          >
                            <span style={{ color: opt.color }}>{opt.icon}</span>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </main>
          </div>
        </section>
      );
    };

  const renderSystemLogsTab = () => {
    return (
      <section style={{ display: "grid", gap: 24 }}>
        {/* 1. Summary Header */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          <section style={{ background: "white", borderRadius: 24, padding: 24, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 12 }}>Tổng số tác vụ</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: DEEP_BLUE_PRIMARY }}>{logsTotalCount}</div>
            <p style={{ margin: "8px 0 0 0", fontSize: 13, color: "#64748b" }}>Ghi nhận hoạt động quan trọng trong hệ thống</p>
          </section>

          <section style={{ background: "white", borderRadius: 24, padding: 24, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 12 }}>Trạng thái hoạt động</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 800, color: "#16a34a", marginTop: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />
              Đang hoạt động ổn định
            </div>
            <p style={{ margin: "14px 0 0 0", fontSize: 13, color: "#64748b" }}>Tự động ghi nhận log kiểm toán thời gian thực</p>
          </section>
        </div>

        {/* 2. Log History Table Card */}
        <section style={{ background: "white", borderRadius: 28, padding: 32, border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Lịch sử Hoạt động Hệ thống</h3>
              <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#64748b" }}>Nhật ký các thao tác tạo/sửa hội đồng, công bố lịch, nhập/khóa điểm, duyệt hồ sơ hậu bảo vệ</p>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              {/* Search */}
              <div style={{ position: "relative" }}>
                <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                <input 
                  placeholder="Mã SV, mã đề tài, người dùng..."
                  style={{ padding: "10px 16px 10px 38px", borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 14, width: 240, outline: "none" }}
                  value={logsSearch}
                  onChange={(e) => {
                    setLogsSearch(e.target.value);
                    setLogsPage(1);
                  }}
                />
              </div>

              {/* Module Filter */}
              <select 
                style={{ 
                  padding: "10px 36px 10px 16px", borderRadius: 14, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 700, color: "#1e293b", background: "white",
                  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' /%3E%3C/svg%3E\")",
                  backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", backgroundSize: "16px", appearance: "none", cursor: "pointer", outline: "none"
                }}
                value={logsModuleFilter}
                onChange={(e) => {
                  setLogsModuleFilter(e.target.value);
                  setLogsPage(1);
                }}
              >
                <option value="all">Tất cả Phân hệ</option>
                <option value="Defense">Lịch & Đợt bảo vệ</option>
                <option value="Committee">Quản lý Hội đồng</option>
                <option value="Topic">Đề tài & Hồ sơ</option>
              </select>

              {/* Action Filter */}
              <select 
                style={{ 
                  padding: "10px 36px 10px 16px", borderRadius: 14, border: "1px solid #e2e8f0", fontSize: 14, fontWeight: 700, color: "#1e293b", background: "white",
                  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' /%3E%3C/svg%3E\")",
                  backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", backgroundSize: "16px", appearance: "none", cursor: "pointer", outline: "none"
                }}
                value={logsActionFilter}
                onChange={(e) => {
                  setLogsActionFilter(e.target.value);
                  setLogsPage(1);
                }}
              >
                <option value="all">Tất cả Hành động</option>
                <option value="CREATE">Tạo mới (CREATE)</option>
                <option value="UPDATE">Cập nhật (UPDATE)</option>
                <option value="PUBLISH">Công bố (PUBLISH)</option>
                <option value="LOCK">Khóa điểm (LOCK)</option>
                <option value="SUBMIT">Nhập điểm/Nộp (SUBMIT)</option>
                <option value="APPROVE">Phê duyệt (APPROVE)</option>
                <option value="REJECT">Từ chối (REJECT)</option>
                <option value="OPEN_SESSION">Mở phiên (OPEN_SESSION)</option>
                <option value="CLOSE_SESSION">Đóng phiên (CLOSE_SESSION)</option>
              </select>

              {/* Refresh Button */}
              <button 
                onClick={() => fetchSystemLogs()}
                disabled={logsLoading}
                style={{ padding: "10px", borderRadius: 12, border: "1px solid #e2e8f0", background: "white", cursor: "pointer", color: "#64748b" }}
              >
                <RefreshCw size={18} className={logsLoading ? "animate-spin" : ""} />
              </button>
              {/* Export Button */}
              <button
                onClick={() => setLogExportModalOpen(true)}
                disabled={logsLoading}
                style={{ marginLeft: 8, padding: "10px 14px", borderRadius: 12, border: "1px solid #1e3a5f", background: "#1e3a5f", color: "white", cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}
              >
                <Download size={16} /> Tải xuống
              </button>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" }}>
              <thead>
                <tr style={{ color: "#64748b", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>
                  <th style={{ padding: "12px 20px", textAlign: "left" }}>Thời gian</th>
                  <th style={{ padding: "12px 20px", textAlign: "left" }}>Tài khoản</th>
                  <th style={{ padding: "12px 20px", textAlign: "left" }}>Phân hệ</th>
                  <th style={{ padding: "12px 20px", textAlign: "left" }}>Hành động</th>
                  <th style={{ padding: "12px 20px", textAlign: "left" }}>Mô tả chi tiết</th>
                  <th style={{ padding: "12px 20px", textAlign: "center" }}>Trạng thái</th>
                  <th style={{ padding: "12px 20px", textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {logsLoading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                      <Loader2 size={32} className="animate-spin" style={{ margin: "0 auto 12px auto", display: "block" }} />
                      Đang tải dữ liệu lịch sử nhật ký...
                    </td>
                  </tr>
                ) : systemLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "#64748b", fontStyle: "italic" }}>
                      Không tìm thấy bản ghi nhật ký hoạt động nào.
                    </td>
                  </tr>
                ) : (
                  systemLogs.map((log) => {
                    const isSuccess = String(log.status || "").toUpperCase() === "SUCCESS";
                    return (
                      <tr 
                        key={log.logID} 
                        style={{ background: "#f8fafc", transition: "all 0.2s", borderRadius: 16 }}
                      >
                        <td style={{ padding: "16px 20px", borderRadius: "16px 0 0 16px", whiteSpace: "nowrap", fontSize: 13, fontWeight: 600 }}>
                          {new Date(log.performedAt).toLocaleString("vi-VN")}
                        </td>
                        <td style={{ padding: "16px 20px" }}>
                          <div style={{ fontWeight: 700, color: "#1e293b" }}>{log.userCode || "Hệ thống"}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>{log.userRole || "-"}</div>
                        </td>
                        <td style={{ padding: "16px 20px" }}>
                          <span style={{ 
                            padding: "4px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700,
                            background: log.module === "Defense" ? "#e0f2fe" : log.module === "Committee" ? "#f5f3ff" : "#f1f5f9",
                            color: log.module === "Defense" ? "#0369a1" : log.module === "Committee" ? "#6d28d9" : "#475569"
                          }}>{log.module || "Hệ thống"}</span>
                        </td>
                        <td style={{ padding: "16px 20px" }}>
                          <span style={{ 
                            padding: "4px 8px", borderRadius: 8, fontSize: 11, fontWeight: 800,
                            background: 
                              log.actionType === "CREATE" ? "#dcfce7" : 
                              log.actionType === "UPDATE" ? "#eff6ff" : 
                              log.actionType === "DELETE" ? "#fee2e2" : 
                              log.actionType === "LOCK" ? "#fef3c7" : 
                              log.actionType === "PUBLISH" ? "#e0e7ff" :
                              log.actionType === "APPROVE" ? "#d1fae5" :
                              log.actionType === "REJECT" ? "#ffe4e6" :
                              log.actionType === "SUBMIT" ? "#dbeafe" :
                              log.actionType === "OPEN_SESSION" ? "#ecfdf5" :
                              log.actionType === "CLOSE_SESSION" ? "#fef9c3" : "#f1f5f9",
                            color: 
                              log.actionType === "CREATE" ? "#15803d" : 
                              log.actionType === "UPDATE" ? "#1d4ed8" : 
                              log.actionType === "DELETE" ? "#991b1b" : 
                              log.actionType === "LOCK" ? "#b45309" : 
                              log.actionType === "PUBLISH" ? "#4338ca" :
                              log.actionType === "APPROVE" ? "#047857" :
                              log.actionType === "REJECT" ? "#be123c" :
                              log.actionType === "SUBMIT" ? "#1e40af" :
                              log.actionType === "OPEN_SESSION" ? "#059669" :
                              log.actionType === "CLOSE_SESSION" ? "#a16207" : "#475569"
                          }}>{log.actionType}</span>
                        </td>
                        <td style={{ padding: "16px 20px", fontSize: 13, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <span title={log.actionDescription}>{log.actionDescription || "-"}</span>
                        </td>
                        <td style={{ padding: "16px 20px", textAlign: "center" }}>
                          <span style={{ 
                            padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 800,
                            background: isSuccess ? "#dcfce7" : "#fee2e2",
                            color: isSuccess ? "#16a34a" : "#ef4444"
                          }}>{isSuccess ? "Thành công" : "Lỗi"}</span>
                        </td>
                        <td style={{ padding: "16px 20px", textAlign: "right", borderRadius: "0 16px 16px 0" }}>
                          <button 
                            onClick={() => setSelectedLogDetail(log)}
                            style={{ background: "white", border: "1px solid #e2e8f0", padding: "8px", borderRadius: 10, cursor: "pointer", color: DEEP_BLUE_PRIMARY, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                            title="Xem chi tiết"
                          >
                            <Eye size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {logsTotalCount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, padding: "0 8px" }}>
              <div style={{ fontSize: 14, color: "#64748b" }}>
                Hiển thị {(logsPage - 1) * logsPageSize + 1} - {Math.min(logsPage * logsPageSize, logsTotalCount)} trên tổng số {logsTotalCount} kết quả
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button 
                  disabled={logsPage === 1}
                  onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                  style={{ padding: "10px 20px", borderRadius: 12, border: "1px solid #e2e8f0", background: "white", fontWeight: 700, cursor: logsPage === 1 ? "not-allowed" : "pointer", opacity: logsPage === 1 ? 0.5 : 1 }}
                >Trước</button>
                <button 
                  disabled={logsPage * logsPageSize >= logsTotalCount}
                  onClick={() => setLogsPage(p => p + 1)}
                  style={{ padding: "10px 20px", borderRadius: 12, border: "1px solid #e2e8f0", background: "white", fontWeight: 700, cursor: logsPage * logsPageSize >= logsTotalCount ? "not-allowed" : "pointer", opacity: logsPage * logsPageSize >= logsTotalCount ? 0.5 : 1 }}
                >Tiếp theo</button>
              </div>
            </div>
          )}
        </section>

        {/* 3. Log Details Modal */}
        {selectedLogDetail && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
            animation: "fadeIn 0.2s ease"
          }}>
            <div style={{
              background: "white", borderRadius: 24, width: "100%", maxWidth: 640,
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", overflow: "hidden",
              border: "1px solid #e2e8f0"
            }}>
              {/* Modal Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 32px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>Chi tiết Nhật ký Hoạt động</h3>
                  <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#64748b" }}>Log ID: #{selectedLogDetail.logID}</p>
                </div>
                <button 
                  onClick={() => setSelectedLogDetail(null)}
                  style={{ background: "#e2e8f0", border: "none", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#475569" }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Content */}
              <div style={{ padding: 32, display: "grid", gap: 16, maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 16, fontSize: 14 }}>
                  <div style={{ fontWeight: 700, color: "#64748b" }}>Thời gian:</div>
                  <div style={{ color: "#0f172a" }}>{new Date(selectedLogDetail.performedAt).toLocaleString("vi-VN")}</div>

                  <div style={{ fontWeight: 700, color: "#64748b" }}>Tài khoản:</div>
                  <div style={{ color: "#0f172a", fontWeight: 600 }}>{selectedLogDetail.userCode || "Hệ thống"} ({selectedLogDetail.userRole || "-"})</div>

                  <div style={{ fontWeight: 700, color: "#64748b" }}>IP Address / Device:</div>
                  <div style={{ color: "#0f172a" }}>{selectedLogDetail.ipAddress || "-"} <span style={{ fontSize: 12, color: "#64748b" }}>({selectedLogDetail.deviceInfo || "-"})</span></div>

                  <div style={{ fontWeight: 700, color: "#64748b" }}>Phân hệ & Thao tác:</div>
                  <div style={{ color: "#0f172a" }}>
                    <span style={{ padding: "2px 6px", borderRadius: 4, background: "#f1f5f9", marginRight: 8, fontSize: 12, fontWeight: 700 }}>{selectedLogDetail.module}</span>
                    <span style={{ padding: "2px 6px", borderRadius: 4, background: "#eff6ff", color: "#1d4ed8", fontSize: 12, fontWeight: 700 }}>{selectedLogDetail.actionType}</span>
                  </div>

                  <div style={{ fontWeight: 700, color: "#64748b" }}>Mô tả chi tiết:</div>
                  <div style={{ color: "#0f172a", lineHeight: 1.5 }}>{selectedLogDetail.actionDescription || "-"}</div>

                  <div style={{ fontWeight: 700, color: "#64748b" }}>Trạng thái:</div>
                  <div>
                    <span style={{ 
                      padding: "4px 8px", borderRadius: 99, fontSize: 12, fontWeight: 800,
                      background: String(selectedLogDetail.status || "").toUpperCase() === "SUCCESS" ? "#dcfce7" : "#fee2e2",
                      color: String(selectedLogDetail.status || "").toUpperCase() === "SUCCESS" ? "#16a34a" : "#ef4444"
                    }}>{String(selectedLogDetail.status || "").toUpperCase() === "SUCCESS" ? "Thành công" : "Thất bại"}</span>
                  </div>

                  {selectedLogDetail.relatedRecordCode && (
                    <>
                      <div style={{ fontWeight: 700, color: "#64748b" }}>Đề tài/Bản ghi liên quan:</div>
                      <div style={{ color: "#0f172a", fontWeight: 600 }}>{selectedLogDetail.relatedRecordCode}</div>
                    </>
                  )}

                  {selectedLogDetail.comment && (
                    <>
                      <div style={{ fontWeight: 700, color: "#64748b" }}>Ghi chú:</div>
                      <div style={{ color: "#0f172a", fontStyle: "italic" }}>{selectedLogDetail.comment}</div>
                    </>
                  )}
                </div>

                {/* Old vs New Values */}
                {(selectedLogDetail.oldValue || selectedLogDetail.newValue) && (
                  <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 16, paddingTop: 16 }}>
                    <div style={{ fontWeight: 700, color: "#64748b", marginBottom: 12 }}>Thay đổi dữ liệu chi tiết:</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>Dữ liệu cũ:</div>
                        <pre style={{ margin: 0, padding: 12, background: "#f8fafc", borderRadius: 8, fontSize: 12, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 150, border: "1px solid #e2e8f0" }}>
                          {selectedLogDetail.oldValue || "(Không có)"}
                        </pre>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 6 }}>Dữ liệu mới:</div>
                        <pre style={{ margin: 0, padding: 12, background: "#f8fafc", borderRadius: 8, fontSize: 12, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 150, border: "1px solid #e2e8f0" }}>
                          {selectedLogDetail.newValue || "(Không có)"}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "16px 32px", borderTop: "1px solid #f1f5f9", background: "#f8fafc" }}>
                <button 
                  onClick={() => setSelectedLogDetail(null)}
                  style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #e2e8f0", background: "white", cursor: "pointer", fontWeight: 700, color: "#475569" }}
                >Đóng</button>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  };

  const renderExportPreviewModal = () => {
    if (!exportPreviewModalOpen) return null;

    // Get a sample of fields for preview (e.g., first 5 rows)
    const previewRows = analyticsTopics.slice(0, 5);
    const selectedFieldConfigs = exportFieldGroups.flatMap(g => g.fields).filter(f => exportSelectedFields.includes(f.key));

    return (
      <ModalOverlay onClose={() => setExportPreviewModalOpen(false)} width={1200}>
        <div style={{ padding: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Xem trước dữ liệu trích xuất</h2>
              <p style={{ margin: "4px 0 0 0", fontSize: 14, color: "#64748b" }}>Hiển thị 5 bản ghi mẫu dựa trên cấu hình hiện tại</p>
            </div>
            <button 
              onClick={() => setExportPreviewModalOpen(false)}
              style={{ background: "#f1f5f9", border: "none", padding: 10, borderRadius: 12, cursor: "pointer" }}
            >
              <X size={20} />
            </button>
          </div>

          <div style={{ overflowX: "auto", background: "#f8fafc", borderRadius: 20, border: "1px solid #e2e8f0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  {selectedFieldConfigs.map(f => (
                    <th key={f.key} style={{ padding: "16px 20px", textAlign: "left", fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.length === 0 ? (
                  <tr>
                    <td colSpan={selectedFieldConfigs.length} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Không có dữ liệu để xem trước</td>
                  </tr>
                ) : (
                  previewRows.map((row: any, idx) => (
                    <tr key={idx} style={{ borderTop: "1px solid #e2e8f0", background: "white" }}>
                      {selectedFieldConfigs.map(f => {
                        let val = row[f.key] || row[f.key.charAt(0).toLowerCase() + f.key.slice(1)] || "-";
                        if (typeof val === "boolean") val = val ? "Có" : "Không";
                        return (
                          <td key={f.key} style={{ padding: "14px 20px", fontSize: 13, color: "#1e293b", whiteSpace: "nowrap" }}>
                            {String(val)}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 32, display: "flex", justifyContent: "flex-end" }}>
            <button 
              onClick={() => setExportPreviewModalOpen(false)}
              style={{ padding: "12px 24px", borderRadius: 12, background: DEEP_BLUE_PRIMARY, color: "white", border: "none", fontWeight: 800, cursor: "pointer" }}
            >
              Đóng xem trước
            </button>
          </div>
        </div>
      </ModalOverlay>
    );
  };

  const renderSkeletonPanel = (titleWidth: number, rows: number) => (
    <section style={cardStyle}>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ height: 16, width: `${titleWidth}px`, borderRadius: 8, background: "#e2e8f0" }} />
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} style={{ display: "grid", gap: 8 }}>
            <div style={{ height: 12, width: "72%", borderRadius: 8, background: "#e2e8f0" }} />
            <div style={{ height: 12, width: "48%", borderRadius: 8, background: "#e2e8f0" }} />
          </div>
        ))}
      </div>
    </section>
  );

  if ((loadingSnapshot || analyticsLoading) && !snapshot && !analyticsDistribution) {
    return renderLoading();
  }

  // --- MODAL RENDERING FUNCTIONS (SCOPED) ---

  const renderTopicDetailModal = () => {
    if (!selectedTopic) return null;
    return (
      <ModalOverlay onClose={() => setTopicDetailModalOpen(false)} width={1000}>
        <div style={{ padding: "32px 40px 24px", background: "linear-gradient(to bottom, #f8fafc, white)", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <div style={{ 
                width: 72, 
                height: 72, 
                borderRadius: 24, 
                background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", 
                color: "white", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)"
              }}>
                <User size={36} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.02em" }}>{selectedTopic.studentName}</h2>
                <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                  <span style={{ fontSize: 14, color: "#64748b", fontWeight: 700, background: "#f1f5f9", padding: "2px 8px", borderRadius: 6 }}>{selectedTopic.studentCode}</span>
                  <span style={{ fontSize: 14, color: "#64748b", fontWeight: 600 }}>{selectedTopic.className} • {selectedTopic.cohortCode}</span>
                </div>
              </div>
            </div>
            <button onClick={() => setTopicDetailModalOpen(false)} style={{ background: "#f1f5f9", border: "none", padding: 10, borderRadius: 14, cursor: "pointer", color: "#64748b", transition: "all 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.background = "#e2e8f0"} onMouseLeave={(e) => e.currentTarget.style.background = "#f1f5f9"}>
              <X size={24} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", background: "#dcfce7", color: "#15803d", padding: "8px 16px", borderRadius: 12, gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", opacity: 0.8 }}>Điểm tổng kết:</span>
              <span style={{ fontSize: 18, fontWeight: 900 }}>{formatScore(selectedTopic.finalScore ?? selectedTopic.currentScore)}</span>
              {selectedTopic.finalGrade && <span style={{ fontSize: 15, fontWeight: 900, borderLeft: "1px solid #16a34a40", paddingLeft: 8 }}>{selectedTopic.finalGrade}</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", background: "#f1f5f9", color: "#475569", padding: "8px 16px", borderRadius: 12, gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", opacity: 0.8 }}>Hội đồng:</span>
              <span style={{ fontSize: 14, fontWeight: 800 }}>{selectedTopic.committeeCode}</span>
            </div>
          </div>
        </div>
        <div style={{ padding: "32px 40px", overflowY: "auto", flex: 1, display: "grid", gridTemplateColumns: "1fr 340px", gap: 40 }}>
          <div style={{ display: "grid", gap: 40 }}>
            {/* Section: Topic Info */}
            <section>
              <h4 style={{ fontSize: 14, fontWeight: 800, color: "#1e293b", textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <BookOpen size={16} color={DEEP_BLUE_PRIMARY} /> Thông tin đề tài
              </h4>
              <div style={{ background: "#f8fafc", padding: 24, borderRadius: 20, border: "1px solid #f1f5f9" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>Mã đề tài: {selectedTopic.topicCode}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", lineHeight: 1.5, marginBottom: 16 }}>
                  {selectedTopic.topicTitle}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <User size={24} color="#64748b" />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Giảng viên hướng dẫn</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{selectedTopic.supervisorLecturerName || selectedTopic.supervisorName || "-"}</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section: Documents */}
            <section>
              <h4 style={{ fontSize: 14, fontWeight: 800, color: "#1e293b", textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <Paperclip size={16} color={DEEP_BLUE_PRIMARY} /> Tài liệu & Báo cáo ({(selectedTopic.defenseDocuments?.length || 0) + (selectedTopic.revisionFileUrl ? 1 : 0)})
              </h4>
              <div style={{ display: "grid", gap: 12 }}>
                {/* Defense Documents */}
                {selectedTopic.defenseDocuments && selectedTopic.defenseDocuments.length > 0 ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Tài liệu nộp</div>
                    {selectedTopic.defenseDocuments.map((doc: any, i: number) => {
                      const fileName = doc.fileName || doc.name || `Tài liệu ${i + 1}`;
                      const fileExt = fileName.split('.').pop()?.toLowerCase() || "file";
                      const getFileIcon = () => {
                        if (["pdf"].includes(fileExt)) return <FileText size={16} />;
                        if (["doc", "docx"].includes(fileExt)) return <FileText size={16} />;
                        if (["xls", "xlsx", "csv"].includes(fileExt)) return <BarChart3 size={16} />;
                        if (["zip", "rar", "7z"].includes(fileExt)) return <Package size={16} />;
                        if (["jpg", "jpeg", "png", "gif"].includes(fileExt)) return <Image size={16} />;
                        return <Paperclip size={16} />;
                      };
                      return (
                        <a
                          key={`doc-${i}`}
                          href={doc.fileUrl || doc.url || doc.path || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: "12px 14px",
                            borderRadius: 12,
                            background: "white",
                            border: "1px solid #e2e8f0",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            color: "#1e293b",
                            textDecoration: "none",
                            fontSize: 13,
                            fontWeight: 600,
                            transition: "all 0.2s"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = DEEP_BLUE_PRIMARY;
                            e.currentTarget.style.background = "#f0f9ff";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "#e2e8f0";
                            e.currentTarget.style.background = "white";
                          }}
                        >
                          <div style={{ minWidth: 20, display: "flex", alignItems: "center" }}>{getFileIcon()}</div>
                          <div style={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
                            <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 13, fontWeight: 700 }}>
                              {fileName}
                            </div>
                            {doc.uploadedAt && (
                              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                                Nộp: {new Date(doc.uploadedAt).toLocaleDateString("vi-VN")}
                              </div>
                            )}
                          </div>
                          <ExternalLink size={14} color={DEEP_BLUE_PRIMARY} style={{ flexShrink: 0 }} />
                        </a>
                      );
                    })}
                  </div>
                ) : null}

                {/* Post-Defense New Report */}
                {selectedTopic.revisionFileUrl && (
                  <div style={{ display: "grid", gap: 8 }}>
                    {selectedTopic.defenseDocuments && selectedTopic.defenseDocuments.length > 0 && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginTop: 8, paddingTop: 8, borderTop: "1px solid #e2e8f0" }}>
                        Báo cáo hậu bảo vệ
                      </div>
                    )}
                    <a
                      href={selectedTopic.revisionFileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: "12px 14px",
                        borderRadius: 12,
                        background: "#fffbeb",
                        border: "1px solid #fcd34d",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        color: "#92400e",
                        textDecoration: "none",
                        fontSize: 13,
                        fontWeight: 800,
                        transition: "all 0.2s"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#fef3c7";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(245, 158, 11, 0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#fffbeb";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <ClipboardList size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
                        <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          Báo cáo Hậu bảo vệ mới
                        </div>
                        <div style={{ fontSize: 11, color: "#b45309", fontWeight: 700 }}>Nhấn để tải về</div>
                      </div>
                      <ExternalLink size={14} color="#f59e0b" style={{ flexShrink: 0 }} />
                    </a>
                  </div>
                )}

                {(!selectedTopic.defenseDocuments || selectedTopic.defenseDocuments.length === 0) && !selectedTopic.revisionFileUrl && (
                  <div style={{ padding: "32px 20px", borderRadius: 16, background: "#f8fafc", border: "1px dashed #e2e8f0", color: "#94a3b8", textAlign: "center" }}>
                    <FileText size={40} style={{ opacity: 0.2, margin: "0 auto 12px" }} />
                    <div style={{ fontSize: 14, fontWeight: 700 }}>Chưa có tài liệu nào được nộp</div>
                    <div style={{ fontSize: 12, marginTop: 6, color: "#cbd5e1" }}>Các báo cáo bảo vệ và hậu bảo vệ sẽ xuất hiện tại đây</div>
                  </div>
                )}
              </div>
            </section>

          </div>

          <aside style={{ display: "grid", gap: 40 }}>
            {/* Section: Scoring Breakdown */}
            <section>
              <h4 style={{ fontSize: 14, fontWeight: 800, color: "#1e293b", textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <TrendingUp size={16} color={DEEP_BLUE_PRIMARY} /> Chi tiết chấm điểm
              </h4>
              <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 20, overflow: "hidden" }}>
                {[
                  { label: "GV Hướng dẫn", score: selectedTopic.scoreGvhd, name: selectedTopic.supervisorLecturerName },
                  { label: "Chủ tịch", score: selectedTopic.scoreCt, name: selectedTopic.committeeChairName },
                  { label: "Thư ký", score: selectedTopic.scoreTk, name: selectedTopic.committeeSecretaryName },
                  { label: "Phản biện", score: selectedTopic.scorePb, name: selectedTopic.committeeReviewerName },
                ].map((item, i) => (
                  <div key={i} style={{ 
                    padding: "16px 20px", 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    borderBottom: i < 3 ? "1px solid #f1f5f9" : "none",
                    background: i % 2 === 0 ? "white" : "#fcfdfe"
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{item.name || "-"}</div>
                    </div>
                    <div style={{ 
                      fontSize: 16, 
                      fontWeight: 900, 
                      color: item.score ? DEEP_BLUE_PRIMARY : "#cbd5e1",
                      background: item.score ? "#f0f9ff" : "#f8fafc",
                      padding: "4px 12px",
                      borderRadius: 8
                    }}>
                      {formatScore(item.score)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Status & Variance */}
              <div style={{ marginTop: 16, padding: 20, borderRadius: 20, background: "#f0f9ff", border: "1px solid #e0f2fe" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 14, color: "#0369a1", fontWeight: 700 }}>Trạng thái:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: selectedTopic.isLocked ? "#16a34a" : "#f59e0b" }} />
                    <span style={{ fontSize: 14, color: "#0369a1", fontWeight: 800 }}>{selectedTopic.isLocked ? "Đã khóa điểm" : "Đang chấm"}</span>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 14, color: "#0369a1", fontWeight: 700 }}>Độ lệch:</span>
                  <span style={{ fontSize: 14, color: "#0369a1", fontWeight: 800 }}>{selectedTopic.variance ?? "0.0"}</span>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <div style={{ padding: "20px 40px", background: "white", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: 16 }}>
          <button 
            onClick={() => setTopicDetailModalOpen(false)}
            style={{ padding: "12px 24px", borderRadius: 14, border: "1px solid #e2e8f0", background: "white", color: "#475569", fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
            onMouseLeave={(e) => e.currentTarget.style.background = "white"}
          >
            Đóng cửa sổ
          </button>
        </div>
      </ModalOverlay>
    );
  };

  const renderPreviewModal = () => {
    if (!previewModalType) return null;
    
    if (previewModalType === "scoreSheet") {
      if (!selectedCommittee) return null;
      const topics = scoringMatrix.filter(row => row.committeeCode === selectedCommittee.code);

      return (
        <ModalOverlay onClose={() => setPreviewModalType(null)} width={1200}>
          <div style={{ padding: "24px 32px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#ffffff" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#0f172a" }}>XEM TRƯỚC BẢNG ĐIỂM HỘI ĐỒNG</h2>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 4, fontWeight: 600 }}>
                Kiểm tra dữ liệu hội đồng {selectedCommittee.code} trước khi xuất bản cứng
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ position: "relative" }}>
                <button 
                  onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                  disabled={isDownloadingPreviewFile}
                  style={{ background: DEEP_BLUE_PRIMARY, color: "white", padding: "10px 18px", borderRadius: 12, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 12px rgba(30, 58, 95, 0.2)" }}
                >
                  <Download size={16} />
                  {isDownloadingPreviewFile ? "Đang tải..." : "Tải xuống"}
                  <ChevronDown size={14} style={{ transform: showDownloadDropdown ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                </button>
                {showDownloadDropdown && (
                  <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)", minWidth: 180, zIndex: 1000, overflow: "hidden", padding: 6 }}>
                    <button 
                      onClick={() => { setShowDownloadDropdown(false); downloadPreviewDocument("scoreSheet", "word"); }} 
                      style={{ width: "100%", background: "none", border: "none", padding: "10px 12px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#0f172a", cursor: "pointer", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                    >
                      <FileText size={16} color="#2563eb" /> Xuất Word (.docx)
                    </button>
                    <button 
                      onClick={() => { setShowDownloadDropdown(false); downloadPreviewDocument("scoreSheet", "pdf"); }} 
                      style={{ width: "100%", background: "none", border: "none", padding: "10px 12px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#0f172a", cursor: "pointer", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                    >
                      <Download size={16} color="#dc2626" /> Xuất PDF (.pdf)
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => { setPreviewModalType(null); setShowDownloadDropdown(false); }} style={{ background: "#f1f5f9", border: "none", padding: 10, borderRadius: 12, cursor: "pointer", color: "#64748b" }}>
                <X size={20} />
              </button>
            </div>
          </div>
          <div style={{ padding: 40, overflowY: "auto", flex: 1, background: "#f8fafc" }}>
            <div style={{ background: "#ffffff", padding: 50, borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", maxWidth: 900, margin: "0 auto", fontFamily: "'Be Vietnam Pro', sans-serif", color: "#000000", lineHeight: 1.6 }}>
              <div style={{ display: "grid", gap: 10, fontSize: 13, lineHeight: 1.5 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: "bold" }}>BỘ GIÁO DỤC VÀ ĐÀO TẠO</div>
                  <div style={{ fontSize: 13, fontWeight: "bold" }}>TRƯỜNG ĐẠI HỌC ĐẠI NAM</div>
                  <div style={{ fontSize: 14, fontWeight: "bold", marginTop: 6 }}>BẢNG ĐIỂM GHI KẾT QUẢ BẢO VỆ ĐỒ ÁN</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>NGÀNH: Công nghệ thông tin</div>
                  <div style={{ fontSize: 12, fontWeight: "bold", marginTop: 4 }}>HỘI ĐỒNG SỐ: {selectedCommittee.code}   NGÀY BẢO VỆ: {formatDate(selectedCommittee.defenseDate)}</div>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 8 }}>
                  <thead>
                    <tr>
                      <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold" }}>STT</td>
                      <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold" }}>MSSV</td>
                      <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold" }}>Họ và tên sinh viên</td>
                      <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold" }}>Khoá</td>
                      <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold" }}>Họ và tên giảng viên hướng dẫn</td>
                      <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold" }}>Điểm GVHD</td>
                      <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold", minWidth: 50 }}>CT</td>
                      <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold", minWidth: 50 }}>UVTK</td>
                      <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold", minWidth: 50 }}>UVPB</td>
                      <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold", minWidth: 60 }}>ĐIỂM TỔNG KẾT</td>
                    </tr>
                  </thead>
                  <tbody>
                    {topics.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ border: "1px solid #000", padding: 8, textAlign: "center", color: "#64748b" }}>Chưa có dữ liệu bảng điểm cho hội đồng này.</td>
                      </tr>
                    ) : (
                      topics.map((row, idx) => (
                        <tr key={idx}>
                          <td style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}>{idx + 1}</td>
                          <td style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}>{row.studentCode}</td>
                          <td style={{ border: "1px solid #000", padding: 4 }}>{row.studentName}</td>
                          <td style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}>{row.cohortCode ?? "-"}</td>
                          <td style={{ border: "1px solid #000", padding: 4 }}>{row.supervisorLecturerName ?? "-"}</td>
                          <td style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}>{formatScore(row.scoreGvhd)}</td>
                          <td style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}>{formatScore(row.scoreCt)}</td>
                          <td style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}>{formatScore(row.scoreTk)}</td>
                          <td style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}>{formatScore(row.scorePb)}</td>
                          <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold" }}>{formatScore(row.finalScore)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: "bold", marginBottom: 8 }}>CÁC THÀNH VIÊN HỘI ĐỒNG</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <tbody>
                      <tr>
                        <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold" }}>STT</td>
                        <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold" }}>Chức danh</td>
                        <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold" }}>Họ và tên</td>
                        <td style={{ border: "1px solid #000", padding: 4, textAlign: "center", fontWeight: "bold" }}>Ký tên</td>
                      </tr>
                      <tr>
                        <td style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}>1</td>
                        <td style={{ border: "1px solid #000", padding: 4 }}>CHỦ TỊCH</td>
                        <td style={{ border: "1px solid #000", padding: 4 }}>{selectedCommittee?.chair ?? "-"}</td>
                        <td style={{ border: "1px solid #000", padding: 4 }}></td>
                      </tr>
                      <tr>
                        <td style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}>2</td>
                        <td style={{ border: "1px solid #000", padding: 4 }}>ỦY VIÊN THƯ KÝ</td>
                        <td style={{ border: "1px solid #000", padding: 4 }}>{selectedCommittee?.secretary ?? "-"}</td>
                        <td style={{ border: "1px solid #000", padding: 4 }}></td>
                      </tr>
                      <tr>
                        <td style={{ border: "1px solid #000", padding: 4, textAlign: "center" }}>3</td>
                        <td style={{ border: "1px solid #000", padding: 4 }}>ỦY VIÊN PHẢN BIỆN</td>
                        <td style={{ border: "1px solid #000", padding: 4 }}>{selectedCommittee?.reviewer ?? "-"}</td>
                        <td style={{ border: "1px solid #000", padding: 4 }}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 16, textAlign: "center", fontSize: 12 }}>
                  <div>
                    {(() => {
                      const d = new Date(selectedCommittee?.defenseDate || new Date());
                      return `Hà Nội, ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
                    })()}
                  </div>
                  <div style={{ marginTop: 12, fontWeight: "bold" }}>Chủ tịch Hội đồng</div>
                  <div style={{ fontSize: 11, fontStyle: "italic", marginTop: 2 }}>(Ký và ghi rõ họ tên)</div>
                </div>
              </div>
            </div>
          </div>
        </ModalOverlay>
      );
    }

    if (!selectedMatrixRow) return null;
    const committee = snapshot?.committees?.find(c => 
      c.code === selectedMatrixRow.committeeCode || 
      c.name === selectedMatrixRow.committeeName
    );
    return (
      <ModalOverlay onClose={() => setPreviewModalType(null)} width={1000}>
        <div style={{ padding: "24px 32px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#ffffff" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#0f172a" }}>
              {previewModalType === "meeting" ? "BIÊN BẢN HỌP HỘI ĐỒNG" : "NHẬN XÉT PHẢN BIỆN"}
            </h2>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4, fontWeight: 600 }}>
              {selectedMatrixRow.studentName} • {selectedMatrixRow.studentCode}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                disabled={isDownloadingPreviewFile}
                style={{ background: DEEP_BLUE_PRIMARY, color: "white", padding: "10px 18px", borderRadius: 12, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 12px rgba(30, 58, 95, 0.2)" }}
              >
                <Download size={16} />
                  {isDownloadingPreviewFile ? "Đang tải..." : "Tải xuống"}
                  <ChevronDown size={14} style={{ transform: showDownloadDropdown ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
              </button>
              {showDownloadDropdown && (
                <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)", minWidth: 180, zIndex: 1000, overflow: "hidden", padding: 6 }}>
                  <button onClick={() => downloadPreviewDocument(previewModalType, "word")} style={{ width: "100%", background: "none", border: "none", padding: "10px 12px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#0f172a", cursor: "pointer", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }} onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"} onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
                    <FileText size={16} color="#2563eb" /> Xuất Word (.docx)
                  </button>
                  <button onClick={() => downloadPreviewDocument(previewModalType, "pdf")} style={{ width: "100%", background: "none", border: "none", padding: "10px 12px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#0f172a", cursor: "pointer", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }} onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"} onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
                    <Download size={16} color="#dc2626" /> Xuất PDF (.pdf)
                  </button>
                </div>
              )}
            </div>
            <button onClick={() => { setPreviewModalType(null); setShowDownloadDropdown(false); }} style={{ background: "#f1f5f9", border: "none", padding: 10, borderRadius: 12, cursor: "pointer", color: "#64748b" }}>
              <X size={20} />
            </button>
          </div>
        </div>
        <div style={{ padding: 40, overflowY: "auto", flex: 1, background: "#f8fafc" }}>
          <div style={{ background: "#ffffff", padding: 50, borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", maxWidth: 800, margin: "0 auto", fontFamily: "'Be Vietnam Pro', sans-serif", color: "#000000", lineHeight: 1.6 }}>
            {previewModalType === "meeting" ? (
              <div style={{ display: "grid", gap: 15, fontSize: 14 }}>
                <div style={{ textAlign: "center", fontWeight: "bold", fontSize: 16, marginBottom: 10 }}>BIÊN BẢN HỌP<br />HỘI ĐỒNG CHẤM LUẬN ĐỒ ÁN</div>
                <div style={{ marginBottom: 10 }}>Hội đồng đã họp vào ngày <strong>{formatDate(selectedMatrixRow.scheduledAt)}</strong> tại Trường Đại học Đại Nam để chấm đồ án cho sinh viên: <strong>{selectedMatrixRow.studentName}</strong> MSV: <strong>{selectedMatrixRow.studentCode}</strong></div>
                <div>Lớp: <strong>{selectedMatrixRow.className ?? "-"}</strong> Khóa: <strong>{selectedMatrixRow.cohortCode ?? "-"}</strong></div>
                <div>Về đề tài: <strong>{selectedMatrixRow.topicTitle}</strong></div>
                <div>Họ tên người hướng dẫn: <strong>{selectedMatrixRow.supervisorLecturerName ?? "-"}</strong></div>
                <div style={{ fontWeight: "bold", marginTop: 15 }}>I. Tóm tắt nội dung đồ án</div>
                <div style={{ paddingLeft: 15 }}>{chapterContents.length === 0 ? "..." : chapterContents.map((c: any, i: number) => (<div key={i} style={{ marginBottom: 8 }}><strong>{String.fromCharCode(97 + i)}) Chương {toRomanNumeral(i + 1)}:</strong> {c.content}</div>))}</div>
                <div style={{ fontWeight: "bold", marginTop: 10 }}>II. Ý kiến của các thành viên Hội đồng</div>
                <div style={{ paddingLeft: 15 }}>
                  <div style={{ marginBottom: 5 }}><strong>1. Uỷ viên phản biện:</strong> {review || "..."}</div>
                  <div><strong>2. Các thành viên khác:</strong> {questions || "..."}</div>
                </div>
                <div style={{ fontWeight: "bold", marginTop: 10 }}>III. Tác giả trả lời các câu hỏi</div>
                <div style={{ paddingLeft: 15 }}>{answers || "..."}</div>
                <div style={{ fontWeight: "bold", marginTop: 10 }}>IV. Đánh giá của Hội đồng</div>
                <div style={{ paddingLeft: 15 }}>
                  <div style={{ marginBottom: 5 }}><strong>a. Ưu điểm:</strong> {strengths || "..."}</div>
                  <div style={{ marginBottom: 5 }}><strong>b. Thiếu sót:</strong> {weaknesses || "..."}</div>
                  <div><strong>c. Kiến nghị:</strong> {recommendations || "..."}</div>
                </div>
                <div style={{ fontWeight: "bold", marginTop: 10 }}>V. Kết quả chấm điểm</div>
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
                  <thead><tr><th style={{ border: "1px solid #000", padding: 8 }}>Thành viên</th><th style={{ border: "1px solid #000", padding: 8 }}>Điểm số</th><th style={{ border: "1px solid #000", padding: 8 }}>Điểm chữ</th></tr></thead>
                  <tbody>
                    <tr><td style={{ border: "1px solid #000", padding: 8 }}>Chủ tịch: {selectedMatrixRow.committeeChairName ?? committee?.chair ?? "-"}</td><td style={{ border: "1px solid #000", padding: 8, textAlign: "center" }}>{formatScore(selectedMatrixRow.scoreCt)}</td><td style={{ border: "1px solid #000", padding: 8, textAlign: "center" }}>{formatLetterGrade(selectedMatrixRow.scoreCt)}</td></tr>
                    <tr><td style={{ border: "1px solid #000", padding: 8 }}>Thư ký: {selectedMatrixRow.committeeSecretaryName ?? committee?.secretary ?? "-"}</td><td style={{ border: "1px solid #000", padding: 8, textAlign: "center" }}>{formatScore(selectedMatrixRow.scoreTk)}</td><td style={{ border: "1px solid #000", padding: 8, textAlign: "center" }}>{formatLetterGrade(selectedMatrixRow.scoreTk)}</td></tr>
                    <tr><td style={{ border: "1px solid #000", padding: 8 }}>Phản biện: {selectedMatrixRow.committeeReviewerName ?? committee?.reviewer ?? "-"}</td><td style={{ border: "1px solid #000", padding: 8, textAlign: "center" }}>{formatScore(selectedMatrixRow.scorePb)}</td><td style={{ border: "1px solid #000", padding: 8, textAlign: "center" }}>{formatLetterGrade(selectedMatrixRow.scorePb)}</td></tr>
                    <tr style={{ fontWeight: "bold" }}><td style={{ border: "1px solid #000", padding: 8, textAlign: "center" }}>TỔNG CỘNG (Trung bình)</td><td style={{ border: "1px solid #000", padding: 8, textAlign: "center" }}>{formatScore(selectedMatrixRow.finalScore)}</td><td style={{ border: "1px solid #000", padding: 8, textAlign: "center" }}>{formatLetterGrade(selectedMatrixRow.finalScore, selectedMatrixRow.finalGrade)}</td></tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 15, fontSize: 14 }}>
                <div style={{ textAlign: "center", fontWeight: "bold", fontSize: 16, marginBottom: 10 }}>NHẬN XÉT CỦA NGƯỜI PHẢN BIỆN ĐỒ ÁN<br />NGÀNH CÔNG NGHỆ THÔNG TIN</div>
                <div style={{ marginBottom: 10 }}>Sinh viên: <strong>{selectedMatrixRow.studentName}</strong> MSV: <strong>{selectedMatrixRow.studentCode}</strong></div>
                <div>Đề tài: <strong>{selectedMatrixRow.topicTitle}</strong></div>
                <div>Người phản biện: <strong>{selectedMatrixRow.committeeReviewerName ?? committee?.reviewer ?? "-"}</strong></div>
                <div style={{ fontWeight: "bold", marginTop: 15 }}>NỘI DUNG NHẬN XÉT</div>
                <div style={{ marginBottom: 10 }}><strong>1. Tính cấp thiết:</strong><br />{reviewerSections.necessity || "..."}</div>
                <div style={{ marginBottom: 10 }}><strong>2. Tính mới:</strong><br />{reviewerSections.novelty || "..."}</div>
                <div style={{ marginBottom: 10 }}><strong>3. Phương pháp nghiên cứu:</strong><br />{reviewerSections.methodologyReliability || "..."}</div>
                <div style={{ marginBottom: 10 }}><strong>4. Kết quả đạt được:</strong><br />{reviewerSections.resultsContent || "..."}</div>
                <div style={{ marginBottom: 10 }}><strong>5. Hạn chế:</strong><br />{reviewerSections.limitations || "..."}</div>
                <div style={{ marginBottom: 10 }}><strong>6. Gợi ý hoàn thiện:</strong><br />{reviewerSections.suggestions || "..."}</div>
                <div><strong>7. Kết luận:</strong><br />{reviewerSections.overallConclusion || review || "..."}</div>
              </div>
            )}
          </div>
        </div>
      </ModalOverlay>
    );
  };

  const renderExportModal = () => (
    <ModalOverlay onClose={() => setExportModalOpen(false)} width={1000}>
      <div style={{ padding: "32px 32px 20px", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Trung tâm Xuất báo cáo</h2>
            <p style={{ margin: "4px 0 0 0", fontSize: 14, color: "#64748b" }}>Cấu hình và tải xuống các biểu mẫu điều hành</p>
          </div>
          <button onClick={() => setExportModalOpen(false)} style={{ background: "#f1f5f9", border: "none", padding: 8, borderRadius: 12, cursor: "pointer" }}>
            <X size={24} />
          </button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", flex: 1, overflow: "hidden" }}>
        <div style={{ background: "#f8fafc", padding: 24, borderRight: "1px solid #f1f5f9", overflowY: "auto" }}>
          <h4 style={{ fontSize: 12, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: 16 }}>Chọn Template</h4>
          <div style={{ display: "grid", gap: 8 }}>
            {[
              { id: "council-summary", label: "Tổng hợp Hội đồng", icon: <Grid size={18} /> },
              { id: "scoreboard", label: "Ma trận điểm số", icon: <Table size={18} /> },
              { id: "form-1", label: "Biểu mẫu 01 (Cá nhân)", icon: <FileText size={18} /> },
              { id: "minutes", label: "Biên bản Hội đồng", icon: <Printer size={18} /> },
            ].map((t) => (
              <button 
                key={t.id}
                onClick={() => setReportType(t.id as ReportType)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  borderRadius: 14,
                  border: "1px solid",
                  borderColor: reportType === t.id ? DEEP_BLUE_PRIMARY : "transparent",
                  background: reportType === t.id ? `${DEEP_BLUE_PRIMARY}10` : "transparent",
                  color: reportType === t.id ? DEEP_BLUE_PRIMARY : "#475569",
                  textAlign: "left",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          
          <div style={{ marginTop: 32 }}>
            <h4 style={{ fontSize: 12, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: 16 }}>Định dạng File</h4>
            <div style={{ display: "flex", gap: 8 }}>
              {(["pdf", "xlsx", "docx"] as const).map(f => {
                const formatMap: Record<string, ReportFormat> = { pdf: "pdf", xlsx: "excel", docx: "word" };
                const targetFormat = formatMap[f];
                const isActive = reportFormat === targetFormat;
                return (
                  <button
                    key={f}
                    onClick={() => setReportFormat(targetFormat)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: 12,
                      border: "1px solid",
                      borderColor: isActive ? DEEP_BLUE_PRIMARY : "#e2e8f0",
                      background: isActive ? DEEP_BLUE_PRIMARY : "white",
                      color: isActive ? "white" : "#475569",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: "pointer",
                      textTransform: "uppercase"
                    }}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        
        <div style={{ padding: 32, overflowY: "auto" }}>
          <h4 style={{ fontSize: 14, fontWeight: 800, color: "#1e293b", marginBottom: 20 }}>Tùy chọn hiển thị</h4>
          <div style={{ display: "grid", gap: 16 }}>
            {[
              { label: "Chèn logo trường", state: exportIncludeLogo, set: setExportIncludeLogo },
              { label: "Hiển thị chữ ký", state: exportIncludeSignature, set: setExportIncludeSignature },
              { label: "Bảo mật mật khẩu", state: exportPasswordProtect, set: setExportPasswordProtect },
              { label: "Chỉ đề tài đã chốt", state: exportOnlyLocked, set: setExportOnlyLocked },
            ].map((opt, i) => (
              <label key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 16, border: "1px solid #f1f5f9", cursor: "pointer" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>{opt.label}</span>
                <input 
                  type="checkbox" 
                  checked={opt.state} 
                  onChange={e => opt.set(e.target.checked)}
                  style={{ width: 20, height: 20, cursor: "pointer", accentColor: DEEP_BLUE_PRIMARY }}
                />
              </label>
            ))}
          </div>
          
          <div style={{ marginTop: 32, padding: 24, borderRadius: 20, background: "#f8fafc", border: "1px dashed #e2e8f0" }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ 
                width: 48, 
                height: 48, 
                borderRadius: 14, 
                background: "white", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)" 
              }}>
                <Info size={24} style={{ color: DEEP_BLUE_PRIMARY }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>Preview: {reportType}.{reportFormat === "excel" ? "xlsx" : reportFormat}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>Báo cáo bao gồm {scoredRowsForDistribution.length} đề tài đã chấm điểm.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding: "24px 32px", borderTop: "1px solid #f1f5f9", background: "white", display: "flex", justifyContent: "flex-end", gap: 12 }}>
        <button 
          onClick={() => setExportModalOpen(false)}
          style={{ padding: "12px 24px", borderRadius: 14, border: "1px solid #e2e8f0", background: "white", color: "#475569", fontWeight: 700, cursor: "pointer" }}
        >
          Hủy
        </button>
        <button 
          style={{ 
            padding: "12px 32px", 
            borderRadius: 14, 
            border: "none", 
            background: "linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)", 
            color: "white", 
            fontWeight: 800, 
            cursor: "pointer",
            boxShadow: "0 10px 15px -3px rgba(30, 58, 95, 0.3)"
          }}
        >
          Tải xuống ngay
        </button>
      </div>
    </ModalOverlay>
  );


  return (
    <div className="committee-ops-root" style={{
      minHeight: "100vh",
      background: "#f8fafc",
      color: "#1e293b",
      fontFamily: "'Be Vietnam Pro', sans-serif",
      padding: "0 0 40px 0"
    }}>
      {/* 1. Header Section */}
      <div style={{
        background: DEEP_BLUE_PRIMARY,
        padding: "40px 32px 80px 32px",
        position: "relative",
        overflow: "hidden"
      }}>
        {/* Background Accents */}
        <div style={{
          position: "absolute",
          top: "-50%",
          right: "-10%",
          width: "600px",
          height: "600px",
          background: "radial-gradient(circle, rgba(243, 112, 33, 0.1) 0%, transparent 70%)",
          filter: "blur(60px)"
        }} />

        <div style={{
          maxWidth: 1600,
          margin: "0 auto",
          position: "relative",
          zIndex: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
          flexWrap: "wrap"
        }}>
          <div>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
              animation: "fadeIn 0.5s ease"
            }}>
              <div style={{
                background: "rgba(255, 255, 255, 0.15)",
                backdropFilter: "blur(8px)",
                padding: "8px 16px",
                borderRadius: 99,
                color: "white",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                border: "1px solid rgba(255, 255, 255, 0.2)"
              }}>
                Hệ thống Quản lý Đồ án
              </div>
              <div style={{
                height: 4,
                width: 4,
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.3)"
              }} />
              <div style={{
                color: "rgba(255, 255, 255, 0.7)",
                fontSize: 12,
                fontWeight: 500
              }}>
                Hội đồng & Điểm số
              </div>
            </div>

            <h1 style={{
              fontSize: 42,
              fontWeight: 900,
              color: "white",
              margin: 0,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              animation: "slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)"
            }}>
              Điều hành <span style={{ color: "#f37021" }}>hội đồng</span>
            </h1>
            
            <p style={{
              fontSize: 16,
              color: "rgba(255, 255, 255, 0.7)",
              marginTop: 12,
              maxWidth: 600,
              fontWeight: 500,
              animation: "fadeIn 0.8s ease"
            }}>
              Điều hành, chấm điểm và quản lý hồ sơ bảo vệ cho đợt: <strong style={{ color: "white" }}>{periodInfo.name}</strong>
            </p>
          </div>

          <div style={{
            display: "flex",
            gap: 12,
            animation: "fadeIn 1s ease"
          }}>
            <button
              onClick={() => loadOperationsSnapshot()}
              style={{
                background: "rgba(255, 255, 255, 0.1)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "white",
                padding: "12px 20px",
                borderRadius: 14,
                fontSize: 14,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
                transition: "all 0.2s ease",
                backdropFilter: "blur(10px)"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
            >
              <RefreshCw size={18} className={loadingSnapshot ? "animate-spin" : ""} />
              {loadingSnapshot ? "Đang đồng bộ..." : "Làm mới Realtime"}
            </button>
            
            <div style={{
              background: "#f37021",
              color: "white",
              padding: "12px 24px",
              borderRadius: 14,
              fontSize: 14,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              gap: 10,
              boxShadow: "0 10px 20px -5px rgba(243, 112, 33, 0.4)"
            }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "white",
                animation: "pulse 2s infinite"
              }} />
              {getStatusLabel(periodInfo.status)}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Content Wrapper */}
      <div style={{
        maxWidth: 1600,
        margin: "-48px auto 0 auto",
        padding: "0 32px",
        position: "relative",
        zIndex: 10
      }}>
        {/* 2.1 Tab Navigation (Sticky) */}
        <div style={{
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(16px)",
          borderRadius: 20,
          padding: "8px",
          display: "flex",
          gap: 4,
          boxShadow: "0 15px 30px -10px rgba(0, 0, 0, 0.1)",
          marginBottom: 24,
          position: "sticky",
          top: 16,
          zIndex: 100,
          border: "1px solid rgba(255, 255, 255, 0.8)"
        }}>
          {[
            { key: "overview", label: "Điều hành Dashboard", icon: <LayoutDashboard size={18} />, badge: null },
            { key: "analytics", label: "Phân tích & Thống kê", icon: <Activity size={18} />, badge: null },
            { key: "committee", label: "Danh sách Hội đồng", icon: <Users size={18} />, badge: snapshot?.committees?.length ? String(snapshot.committees.length) : null },
            { key: "post-defense", label: "Hồ sơ Sau bảo vệ", icon: <Archive size={18} />, badge: snapshot?.postDefense?.items?.length ? String(snapshot.postDefense.items.length) : null },
            { key: "export", label: "Xuất bản Báo cáo", icon: <Download size={18} />, badge: null },
            { key: "audit", label: "Nhật ký Hoạt động", icon: <ShieldCheck size={18} />, badge: null },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 14,
                  border: "none",
                  background: isActive ? DEEP_BLUE_PRIMARY : "transparent",
                  color: isActive ? "white" : "#64748b",
                  fontSize: 13,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  minWidth: 120,
                  cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  position: "relative"
                }}
              >
                {tab.icon}
                {tab.label}
                {tab.badge && (
                  <span style={{
                    background: isActive ? "#f37021" : "#e2e8f0",
                    color: isActive ? "white" : "#475569",
                    padding: "2px 8px",
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 800
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 2.2 Dynamic Content Area */}
        <div style={{
          animation: "fadeIn 0.4s ease",
          minHeight: 600
        }}>
          {activeTab === "overview" && renderOverviewTab()}
          {activeTab === "analytics" && renderAnalyticsTab()}
          {activeTab === "committee" && renderCommitteeTab()}
          {activeTab === "post-defense" && renderPostDefenseTab()}
          {activeTab === "export" && renderExportTab()}
          {activeTab === "audit" && renderSystemLogsTab()}
        </div>

        {/* Global Modals Area */}
        {topicDetailModalOpen && renderTopicDetailModal()}
        {logExportModalOpen && (
          <ModalOverlay onClose={() => setLogExportModalOpen(false)} width={860}>
            <div style={{ display: "flex", flexDirection: "column", minHeight: 0, maxWidth: 860 }}>
              <div style={{
                padding: "28px 32px 22px 32px",
                background: "linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)",
                color: "white",
                position: "relative",
                overflow: "hidden"
              }}>
                <div style={{
                  position: "absolute",
                  inset: 0,
                  background: "radial-gradient(circle at top right, rgba(243, 112, 33, 0.18), transparent 38%)"
                }} />
                <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 12px 24px rgba(0,0,0,0.18)" }}>
                      <Download size={24} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>
                        Xuất nhật ký
                      </div>
                      <h3 style={{ margin: 0, fontSize: 24, fontWeight: 900, lineHeight: 1.2 }}>Tải Nhật ký Hoạt động</h3>
                      <p style={{ margin: "8px 0 0 0", fontSize: 14, color: "rgba(255,255,255,0.78)", maxWidth: 640 }}>
                        Chọn các trường cần xuất và định dạng file phù hợp trước khi tải xuống.
                      </p>
                    </div>
                  </div>

                  <div style={{
                    alignSelf: "center",
                    padding: "10px 14px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    fontSize: 12,
                    fontWeight: 800,
                    color: "white"
                  }}>
                    {logExportSelectedFields.length} trường đã chọn
                  </div>
                </div>
              </div>

              <div style={{ padding: 32, background: "#f8fafc", overflowY: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", gap: 24, alignItems: "start" }}>
                  <div style={{ display: "grid", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#1e293b" }}>Chọn trường xuất</h4>
                      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Có thể bật/tắt từng cột</div>
                    </div>

                    <div style={{ maxHeight: 360, overflow: "auto", paddingRight: 8 }}>
                      <div style={{ display: "grid", gap: 10 }}>
                        {[
                          { key: "PerformedAt", label: "Thời gian" },
                          { key: "UserCode", label: "Tài khoản" },
                          { key: "UserRole", label: "Vai trò" },
                          { key: "Module", label: "Phân hệ" },
                          { key: "ActionType", label: "Hành động" },
                          { key: "ActionDescription", label: "Mô tả" },
                          { key: "EntityName", label: "Đối tượng" },
                          { key: "EntityId", label: "ID đối tượng" },
                          { key: "Status", label: "Trạng thái" },
                          { key: "OldValue", label: "Giá trị cũ" },
                          { key: "NewValue", label: "Giá trị mới" },
                          { key: "IPAddress", label: "Địa chỉ IP" },
                        ].map((f) => {
                          const checked = logExportSelectedFields.includes(f.key);
                          return (
                            <label
                              key={f.key}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 16,
                                padding: "14px 16px",
                                borderRadius: 16,
                                border: `1px solid ${checked ? DEEP_BLUE_PRIMARY : "#e2e8f0"}`,
                                background: checked ? "#eef4ff" : "white",
                                boxShadow: checked ? "0 8px 16px rgba(30,58,95,0.08)" : "0 2px 8px rgba(15,23,42,0.03)",
                                cursor: "pointer",
                                transition: "all 0.2s ease"
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <span style={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: 99,
                                  background: checked ? DEEP_BLUE_PRIMARY : "#cbd5e1",
                                  boxShadow: checked ? "0 0 0 4px rgba(30,58,95,0.12)" : "none"
                                }} />
                                <span style={{ fontWeight: 700, color: "#0f172a" }}>{f.label}</span>
                              </div>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const nextChecked = e.target.checked;
                                  setLogExportSelectedFields((prev) => nextChecked
                                    ? Array.from(new Set([...prev, f.key]))
                                    : prev.filter((x) => x !== f.key));
                                }}
                                style={{ width: 18, height: 18, cursor: "pointer", accentColor: DEEP_BLUE_PRIMARY }}
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 16, position: "sticky", top: 0 }}>
                    <div style={{ background: "white", borderRadius: 20, padding: 20, border: "1px solid #e2e8f0", boxShadow: "0 10px 20px rgba(15,23,42,0.04)" }}>
                      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b", marginBottom: 12 }}>Định dạng file</div>
                      <div style={{ display: "grid", gap: 10 }}>
                        {[
                          { value: "excel", label: "Excel", hint: ".xlsx" },
                          { value: "pdf", label: "PDF", hint: "in ấn" },
                          { value: "csv", label: "CSV", hint: "dữ liệu thô" },
                        ].map((item) => {
                          const active = logExportFormat === item.value;
                          return (
                            <label
                              key={item.value}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12,
                                padding: 14,
                                borderRadius: 16,
                                border: `1px solid ${active ? DEEP_BLUE_PRIMARY : "#e2e8f0"}`,
                                background: active ? "#f0f7ff" : "#fff",
                                cursor: "pointer",
                                transition: "all 0.2s ease"
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <input
                                  type="radio"
                                  name="logExportFormat"
                                  checked={active}
                                  onChange={() => setLogExportFormat(item.value as ReportFormat)}
                                  style={{ width: 18, height: 18, accentColor: DEEP_BLUE_PRIMARY, cursor: "pointer" }}
                                />
                                <div>
                                  <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{item.label}</div>
                                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{item.hint}</div>
                                </div>
                              </div>
                              {active && (
                                <span style={{ fontSize: 11, fontWeight: 800, color: DEEP_BLUE_PRIMARY, background: "rgba(30,58,95,0.08)", padding: "6px 10px", borderRadius: 999 }}>
                                  Đang chọn
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ background: "white", borderRadius: 20, padding: 20, border: "1px solid #e2e8f0", boxShadow: "0 10px 20px rgba(15,23,42,0.04)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 14, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Info size={22} style={{ color: DEEP_BLUE_PRIMARY }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>Xem trước</div>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                            system-activity-logs.{logExportFormat === "excel" ? "xlsx" : logExportFormat}
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: 14, fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
                        File sẽ bao gồm {logExportSelectedFields.length} cột đã chọn và bộ lọc hiện tại của danh sách logs.
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <button
                        onClick={() => setLogExportModalOpen(false)}
                        style={{ padding: "12px 18px", borderRadius: 14, background: "white", border: "1px solid #e2e8f0", color: "#475569", fontWeight: 700, cursor: "pointer" }}
                      >
                        Hủy
                      </button>
                      <button
                        onClick={() => exportSystemLogs()}
                        disabled={logIsExporting}
                        style={{
                          padding: "12px 20px",
                          borderRadius: 14,
                          background: logIsExporting ? "#94a3b8" : "linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)",
                          color: "white",
                          border: "none",
                          fontWeight: 800,
                          cursor: logIsExporting ? "not-allowed" : "pointer",
                          boxShadow: logIsExporting ? "none" : "0 10px 15px -3px rgba(30,58,95,0.28)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8
                        }}
                      >
                        <Download size={16} />
                        {logIsExporting ? "Đang xuất..." : "Tải xuống ngay"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ModalOverlay>
        )}
        {exportModalOpen && renderExportModal()}
        {previewModalType && renderPreviewModal()}
        {exportPreviewModalOpen && renderExportPreviewModal()}
      </div>
    </div>
  );
};

const formatScore = (s: any) => {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n.toFixed(1) : "-";
};

const formatLetterGrade = (s: any, fallback?: string) => {
  if (fallback && fallback.length <= 2) return fallback;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return "-";
  if (n >= 9.0) return "A+";
  if (n >= 8.5) return "A";
  if (n >= 8.0) return "B+";
  if (n >= 7.0) return "B";
  if (n >= 6.5) return "C+";
  if (n >= 5.5) return "C";
  if (n >= 5.0) return "D+";
  if (n >= 4.0) return "D";
  return "F";
};

const toRomanNumeral = (num: number) => {
  const lookup: any = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
  let roman = "";
  for (let i in lookup) {
    while (num >= lookup[i]) {
      roman += i;
      num -= lookup[i];
    }
  }
  return roman;
};

const stripQuestionSource = (q: string) => (q ?? "").replace(/^\[(II\.1|II\.2)\]\s*/i, "").trimStart();

const formatDate = (d: any) => {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("vi-VN");
};

export default CommitteeOperationsManagement;
