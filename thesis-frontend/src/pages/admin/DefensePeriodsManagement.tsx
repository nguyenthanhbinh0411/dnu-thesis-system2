import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  Activity,
  AlertCircle,
  Archive,
  ArrowLeft,
  Calendar as CalendarIcon,
  CheckCircle,
  ChevronRight,
  Clock,
  Download,
  Edit,
  FileDown,
  FileSpreadsheet,
  Filter,
  Info,
  LayoutDashboard,
  Lock,
  MoreVertical,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Save,
  Settings,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  Zap,
  Flag,
  Target,
  BookOpen,
} from "lucide-react";
import { fetchData, normalizeUrl } from "../../api/fetchData";
import { useToast } from "../../context/useToast";
import type { ApiResponse } from "../../types/api";
import { readEnvelopeData, readEnvelopeSuccess } from "../../utils/api-envelope";
import { useAuth } from "../../hooks/useAuth";
import DefenseTermStudentsSection, { type DefenseTermStudentsSectionHandle } from "../../components/admin/DefenseTermStudentsSection";
import DefenseTermLecturersSection, { type DefenseTermLecturersSectionHandle } from "../../components/admin/DefenseTermLecturersSection";
import ImportExportActions from "../../components/admin/ImportExportActions";
import { getAccessToken } from "../../services/auth-session.service";
import { Copy, PlusCircle, Search as SearchIcon, Filter as FilterIcon, MoreHorizontal, AlertTriangle, Eye, ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react";

// --- Types & Constants ---

type DefenseTermStatus = "Draft" | "Registration" | "Assignment" | "ProgressTracking" | "CommitteePreparation" | "Running" | "Paused" | "ScoringLocked" | "Finalization" | "Finalized" | "Published" | "Closed" | "Archived";

interface DefensePeriod {
  defenseTermId: number;
  termCode?: string;
  name: string;
  academicYear?: string;
  semester?: string;
  status: DefenseTermStatus;
  startDate?: string;
  endDate?: string;
  description?: string;
  createdAt: string;
  lastUpdated: string;
}

type MainTab = "overview" | "management" | "milestones" | "students" | "lecturers" | "operations" | "statistics";

interface MilestoneTemplate {
  milestoneTemplateID: number;
  milestoneTemplateCode: string;
  name: string;
  description: string;
  ordinal: number;
  deadline: string | null;
}

const STATUS_CONFIG: Record<DefenseTermStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  Draft: { label: "Soạn thảo", color: "#64748b", bg: "#f1f5f9", icon: <Edit size={14} /> },
  Registration: { label: "Đăng ký đề tài", color: "#0ea5e9", bg: "#f0f9ff", icon: <FileDown size={14} /> },
  Assignment: { label: "Phân công", color: "#6366f1", bg: "#eef2ff", icon: <Users size={14} /> },
  ProgressTracking: { label: "Theo dõi tiến độ", color: "#f59e0b", bg: "#fffbeb", icon: <Activity size={14} /> },
  CommitteePreparation: { label: "Chuẩn bị hội đồng", color: "#8b5cf6", bg: "#f5f3ff", icon: <Settings size={14} /> },
  Running: { label: "Đang bảo vệ", color: "#166534", bg: "#dcfce7", icon: <Play size={14} /> },
  Paused: { label: "Tạm dừng", color: "#92400e", bg: "#fef3c7", icon: <Pause size={14} /> },
  ScoringLocked: { label: "Khóa điểm", color: "#991b1b", bg: "#fee2e2", icon: <Lock size={14} /> },
  Finalization: { label: "Tổng kết", color: "#3730a3", bg: "#e0e7ff", icon: <CheckCircle size={14} /> },
  Finalized: { label: "Đã tổng kết", color: "#3730a3", bg: "#e0e7ff", icon: <CheckCircle size={14} /> },
  Published: { label: "Công bố", color: "#15803d", bg: "#f0fdf4", icon: <Zap size={14} /> },
  Closed: { label: "Đã đóng", color: "#1e293b", bg: "#f8fafc", icon: <Archive size={14} /> },
  Archived: { label: "Lưu trữ", color: "#475569", bg: "#f1f5f9", icon: <Archive size={14} /> },
};

const DEEP_BLUE_PRIMARY = "#1e3a5f";
const LIGHT_BLUE_SOFTEN = "#f0f4f8";

// --- API Service Shorthand ---

const defensePeriodApi = {
  list: () => fetchData<ApiResponse<DefensePeriod[]>>("/defense-periods", { method: "GET" }),
  get: (id: number) => fetchData<ApiResponse<DefensePeriod>>(`/defense-periods/${id}`, { method: "GET" }),
  create: (data: Partial<DefensePeriod>) => fetchData<ApiResponse<DefensePeriod>>("/defense-periods", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<DefensePeriod>) => fetchData<ApiResponse<DefensePeriod>>(`/defense-periods/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: number) => fetchData<ApiResponse<boolean>>(`/defense-periods/${id}`, { method: "DELETE" }),
  lifecycle: (id: number, action: string, idempotencyKey?: string) =>
    fetchData<ApiResponse<boolean>>(`/defense-periods/${id}/lifecycle`, {
      method: "POST",
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
      body: JSON.stringify({ action, idempotencyKey })
    }),
  snapshot: (id: number) => fetchData<ApiResponse<any>>(`/defense-periods/${id}/management/snapshot`, { method: "GET" }),
  monitoring: (id: number) => fetchData<ApiResponse<any>>(`/defense-periods/${id}/monitoring/snapshot`, { method: "GET" }),
  export: (id: number, reportType: string, format: string = "xlsx", councilId?: number, fields?: string[]) => {
    const isSpecial = ["students", "lecturers", "assigned-topics", "lecturers-grouped-students"].includes(reportType);
    let baseUrl = "";

    if (isSpecial) {
      baseUrl = `/api/defense-periods/${id}/exports/${reportType}`;
    } else {
      baseUrl = `/api/defense-periods/${id}/reports/export`;
    }

    const params = new URLSearchParams();
    params.set("format", format);
    if (reportType && !isSpecial) params.set("reportType", reportType);
    if (councilId) params.set("councilId", String(councilId));
    if (fields && fields.length > 0) params.set("fields", fields.join(","));

    return normalizeUrl(`${baseUrl}?${params.toString()}`);
  },
};

const STUDENT_FIELDS = [
  { key: "StudentCode", label: "Mã sinh viên", category: "Thông tin cơ bản" },
  { key: "FullName", label: "Họ và tên", category: "Thông tin cơ bản" },
  { key: "Gender", label: "Giới tính", category: "Thông tin cơ bản" },
  { key: "DateOfBirth", label: "Ngày sinh", category: "Thông tin cơ bản" },
  { key: "FacultyCode", label: "Khoa", category: "Đơn vị" },
  { key: "DepartmentCode", label: "Bộ môn", category: "Đơn vị" },
  { key: "ClassCode", label: "Lớp", category: "Đơn vị" },
  { key: "EnrollmentYear", label: "Khóa học", category: "Tiến độ" },
  { key: "GraduationYear", label: "Năm tốt nghiệp", category: "Tiến độ" },
  { key: "GPA", label: "Điểm TB", category: "Kết quả" },
  { key: "AcademicStanding", label: "Xếp loại", category: "Kết quả" },
  { key: "ParticipationStatus", label: "Trạng thái tham gia", category: "Trạng thái" },
  { key: "StudentEmail", label: "Email", category: "Liên lạc" },
  { key: "PhoneNumber", label: "Số điện thoại", category: "Liên lạc" },
];

const LECTURER_FIELDS = [
  { key: "LecturerCode", label: "Mã giảng viên", category: "Thông tin cơ bản" },
  { key: "FullName", label: "Họ và tên", category: "Thông tin cơ bản" },
  { key: "Degree", label: "Học hàm/Học vị", category: "Thông tin cơ bản" },
  { key: "Gender", label: "Giới tính", category: "Thông tin cơ bản" },
  { key: "DepartmentCode", label: "Bộ môn", category: "Đơn vị" },
  { key: "Organization", label: "Cơ quan công tác", category: "Đơn vị" },
  { key: "Email", label: "Email", category: "Liên lạc" },
  { key: "PhoneNumber", label: "Số điện thoại", category: "Liên lạc" },
  { key: "GuideQuota", label: "Định mức hướng dẫn", category: "Hạn ngạch" },
  { key: "CurrentGuidingCount", label: "Đang hướng dẫn", category: "Hạn ngạch" },
  { key: "RemainingGuideQuota", label: "Hạn ngạch còn lại", category: "Hạn ngạch" },
  { key: "Status", label: "Trạng thái", category: "Trạng thái" },
];

const TOPIC_FIELDS = [
  { key: "TopicCode", label: "Mã đề tài", category: "Thông tin đề tài" },
  { key: "Title", label: "Tên đề tài", category: "Thông tin đề tài" },
  { key: "Type", label: "Loại đề tài", category: "Thông tin đề tài" },
  { key: "ProposerStudentCode", label: "Mã sinh viên", category: "Sinh viên" },
  { key: "ProposerName", label: "Sinh viên thực hiện", category: "Sinh viên" },
  { key: "SupervisorLecturerCode", label: "Mã giảng viên HD", category: "Giảng viên" },
  { key: "SupervisorName", label: "Giảng viên hướng dẫn", category: "Giảng viên" },
  { key: "DepartmentCode", label: "Bộ môn quản lý", category: "Quản lý" },
  { key: "Score", label: "Điểm số", category: "Kết quả" },
  { key: "Status", label: "Trạng thái", category: "Trạng thái" },
];
const milestoneApi = {
  list: () => fetchData<ApiResponse<MilestoneTemplate[]>>("/MilestoneTemplates/get-list"),
  update: (id: number, data: any) => fetchData<ApiResponse<any>>(`/MilestoneTemplates/update/${id}`, { method: "PUT", body: JSON.stringify(data) }),
};

const STATISTICS_REPORTS = [
  { key: "students", label: "Danh sách sinh viên theo đợt", desc: "Xuất dữ liệu chi tiết sinh viên trong đợt (đề tài, điểm số, trạng thái).", icon: <Users size={20} />, type: "modular", fields: STUDENT_FIELDS },
  { key: "lecturers", label: "Danh sách giảng viên theo đợt", desc: "Dữ liệu giảng viên tham gia, bao gồm hạn ngạch hướng dẫn và chấm điểm.", icon: <UserCheck size={20} />, type: "modular", fields: LECTURER_FIELDS },
  { key: "assigned-topics", label: "Phân công đề tài & Giảng viên hướng dẫn", desc: "Báo cáo chi tiết các đề tài đã được gán sinh viên và giảng viên hướng dẫn.", icon: <FileSpreadsheet size={20} />, type: "modular", fields: TOPIC_FIELDS },
  { key: "lecturers-grouped-students", label: "Danh sách hướng dẫn gộp theo giảng viên", desc: "Báo cáo danh sách sinh viên theo từng giảng viên hướng dẫn.", icon: <LayoutDashboard size={20} />, type: "modular", fields: TOPIC_FIELDS },
  { key: "committee-roster", label: "Danh sách Hội đồng & Phân công", desc: "Xuất file Excel tổng hợp hội đồng, thành viên và đề tài.", icon: <Users size={20} />, type: "excel" },
  { key: "final-term", label: "Bảng điểm tổng kết đợt", desc: "Danh sách điểm số cuối cùng của toàn bộ sinh viên trong đợt.", icon: <ShieldCheck size={20} />, type: "pdf" },
];

// --- Helper Functions ---

function asNumber(val: any): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function safeRandomUUID(): string {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

const mapStatus = (status: any): DefenseTermStatus => {
  if (status === null || status === undefined) return "Draft";
  const s = String(status).trim().toLowerCase();

  // Numeric mapping (based on backend enum)
  if (s === "0") return "Draft";
  if (s === "1") return "Registration";
  if (s === "2") return "Assignment";
  if (s === "3") return "ProgressTracking";
  if (s === "4") return "CommitteePreparation";
  if (s === "5") return "Running";
  if (s === "6") return "Finalization";
  if (s === "7") return "Closed";

  // Vietnamese Label Mapping
  if (s === "soạn thảo") return "Draft";
  if (s === "đăng ký đề tài" || s === "đăng ký") return "Registration";
  if (s === "phân công") return "Assignment";
  if (s === "theo dõi tiến độ") return "ProgressTracking";
  if (s === "chuẩn bị hội đồng") return "CommitteePreparation";
  if (s === "đang bảo vệ" || s === "đang diễn ra" || s === "bảo vệ") return "Running";
  if (s === "tạm dừng") return "Paused";
  if (s === "khóa điểm") return "ScoringLocked";
  if (s === "tổng kết") return "Finalization";
  if (s === "đã tổng kết") return "Finalized";
  if (s === "công bố") return "Published";
  if (s === "đã đóng" || s === "kết thúc") return "Closed";
  if (s === "lưu trữ") return "Archived";

  // String mapping
  if (s === "draft") return "Draft";
  if (s === "registration") return "Registration";
  if (s === "assignment") return "Assignment";
  if (s === "progresstracking") return "ProgressTracking";
  if (s === "committeepreparation") return "CommitteePreparation";
  if (s === "preparing") return "Registration";
  if (s === "running") return "Running";
  if (s === "paused") return "Paused";
  if (s === "scoringlocked") return "ScoringLocked";
  if (s === "finalization") return "Finalization";
  if (s === "finalized") return "Finalized";
  if (s === "published") return "Published";
  if (s === "closed") return "Closed";
  if (s === "archived") return "Archived";

  return "Draft";
};

const getStatusPresentation = (status: unknown) => {
  const normalized = mapStatus(String(status ?? "Draft"));
  return STATUS_CONFIG[normalized] ?? STATUS_CONFIG.Draft;
};

const getNextActionLabel = (status?: DefenseTermStatus): string => {
  if (!status) return "Tiếp tục quy trình";
  switch (status) {
    case "Draft": return "Mở đăng ký đề tài";
    case "Registration": return "Chuyển sang Phân công";
    case "Assignment": return "Theo dõi tiến độ";
    case "ProgressTracking": return "Chuẩn bị hội đồng";
    case "CommitteePreparation": return "Bắt đầu bảo vệ";
    case "Running": return "Khóa điểm bảo vệ";
    case "ScoringLocked": return "Tổng kết đợt";
    case "Finalization": return "Công bố điểm";
    case "Finalized": return "Công bố điểm";
    case "Published": return "Đóng đợt";
    case "Closed": return "Lưu trữ";
    default: return "Tiếp tục quy trình";
  }
};

const readCount = (source: unknown, candidates: string[], fallback = 0): number => {
  if (!source || typeof source !== "object") {
    return fallback;
  }

  const record = source as Record<string, unknown>;
  for (const key of candidates) {
    const parsed = Number(record[key]);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

const readArrayCount = (source: unknown, candidates: string[], fallback = 0): number => {
  if (!source || typeof source !== "object") {
    return fallback;
  }

  const record = source as Record<string, unknown>;
  for (const key of candidates) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.length;
    }
  }

  return fallback;
};

// --- Reusable Components ---

const ConfirmModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  type?: "danger" | "warning" | "info";
  isLoading?: boolean;
}> = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = "Xác nhận", type = "info", isLoading }) => {
  if (!isOpen) return null;
  const colors = {
    danger: { bg: "#fee2e2", text: "#991b1b", btn: "#b91c1c" },
    warning: { bg: "#fef3c7", text: "#92400e", btn: "#d97706" },
    info: { bg: "#e0f2fe", text: "#0369a1", btn: "#0284c7" },
  };
  const theme = colors[type];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
      <div style={{ background: "white", width: "100%", maxWidth: "420px", borderRadius: "16px", padding: "24px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <div style={{ background: theme.bg, color: theme.text, padding: "10px", borderRadius: "12px" }}>
            {type === "danger" ? <Trash2 size={24} /> : (type === "warning" ? <AlertTriangle size={24} /> : <Info size={24} />)}
          </div>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#1e293b" }}>{title}</h3>
        </div>
        <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#64748b", lineHeight: "1.6" }}>{message}</p>
        <div style={{ display: "flex", gap: "12px" }}>
          <button onClick={onClose} disabled={isLoading} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "white", fontWeight: "600", cursor: "pointer" }}>Hủy</button>
          <button onClick={onConfirm} disabled={isLoading} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", background: theme.btn, color: "white", fontWeight: "600", cursor: "pointer" }}>{isLoading ? "Đang xử lý..." : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

const DefensePeriodModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: any;
  isLoading?: boolean;
}> = ({ isOpen, onClose, onSave, initialData, isLoading }) => {
  const [formData, setFormData] = useState({
    termCode: "",
    termName: "",
    startDate: "",
    endDate: "",
    semester: "Học kỳ 1",
    academicYear: new Date().getFullYear() + "-" + (new Date().getFullYear() + 1),
    description: "",
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        termCode: initialData.termCode || "",
        termName: initialData.name || "",
        startDate: initialData.startDate ? initialData.startDate.split('T')[0] : "",
        endDate: initialData.endDate ? initialData.endDate.split('T')[0] : "",
        semester: initialData.semester || "Học kỳ 1",
        academicYear: initialData.academicYear || (new Date().getFullYear() + "-" + (new Date().getFullYear() + 1)),
        description: initialData.description || "",
      });
    } else {
      setFormData({
        termCode: "",
        termName: "",
        startDate: "",
        endDate: "",
        semester: "Học kỳ 1",
        academicYear: new Date().getFullYear() + "-" + (new Date().getFullYear() + 1),
        description: "",
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}>
      <div style={{ background: "white", width: "100%", maxWidth: "500px", borderRadius: "20px", padding: "32px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
        <h3 style={{ margin: "0 0 24px 0", fontSize: "20px", fontWeight: "800", color: "#1e293b" }}>{initialData ? "Cập nhật đợt đồ án tốt nghiệp" : "Tạo đợt đồ án tốt nghiệp mới"}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#475569", marginBottom: "6px" }}>Mã đợt</label>
              <input
                value={formData.termCode}
                onChange={e => setFormData({ ...formData, termCode: e.target.value })}
                disabled={!!initialData}
                placeholder="VD: DT-2024-01"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  background: initialData ? "#f1f5f9" : "white",
                  cursor: initialData ? "not-allowed" : "text"
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#475569", marginBottom: "6px" }}>Tên đợt đồ án tốt nghiệp</label>
              <input value={formData.termName} onChange={e => setFormData({ ...formData, termName: e.target.value })} placeholder="VD: Đồ án tốt nghiệp 2024" style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #cbd5e1" }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#475569", marginBottom: "6px" }}>Năm học</label>
              <input value={formData.academicYear} onChange={e => setFormData({ ...formData, academicYear: e.target.value })} placeholder="2023-2024" style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #cbd5e1" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#475569", marginBottom: "6px" }}>Học kỳ</label>
              <select value={formData.semester} onChange={e => setFormData({ ...formData, semester: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
                <option>Học kỳ 1</option>
                <option>Học kỳ 2</option>
                <option>Học kỳ 3</option>
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#475569", marginBottom: "6px" }}>Ngày bắt đầu</label>
              <input type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #cbd5e1" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#475569", marginBottom: "6px" }}>Ngày kết thúc</label>
              <input type="date" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #cbd5e1" }} />
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#475569", marginBottom: "6px" }}>Mô tả chi tiết</label>
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #cbd5e1", resize: "none" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px", marginTop: "32px" }}>
          <button onClick={onClose} disabled={isLoading} style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "1px solid #e2e8f0", background: "white", fontWeight: "700", cursor: "pointer" }}>Hủy</button>
          <button onClick={() => onSave(formData)} disabled={isLoading} style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "none", background: DEEP_BLUE_PRIMARY, color: "white", fontWeight: "700", cursor: "pointer" }}>{isLoading ? "Đang lưu..." : "Lưu dữ liệu"}</button>
        </div>
      </div>
    </div>
  );
};

// --- Custom Modern DatePicker Component ---
interface CustomPickerProps {
  value: string | null;
  onChange: (newValue: string) => void;
  label: string;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}

const CustomDatePicker: React.FC<CustomPickerProps> = ({ value, onChange, label, isOpen, onToggle }) => {
  const [isTimeMode, setIsTimeMode] = useState(false);
  const [viewDate, setViewDate] = useState(new Date(value || new Date()));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onToggle(false);
        setIsTimeMode(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onToggle]);

  const selectedDate = value ? new Date(value) : new Date();

  const handleSelectDay = (day: number) => {
    const newDate = new Date(selectedDate);
    newDate.setFullYear(viewDate.getFullYear());
    newDate.setMonth(viewDate.getMonth());
    newDate.setDate(day);
    onChange(newDate.toISOString());
    setIsTimeMode(true);
  };

  const handleTimeSelect = (type: 'h' | 'm', val: number) => {
    const newDate = new Date(selectedDate);
    if (type === 'h') newDate.setHours(val);
    else newDate.setMinutes(val);
    onChange(newDate.toISOString());
  };

  const formatDisplay = (val: string | null) => {
    if (!val) return "Chọn thời gian...";
    const d = new Date(val);
    return `${d.getDate().toString().padStart(2, '0')}/${((d.getMonth() + 1)).toString().padStart(2, '0')}/${d.getFullYear()} - ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div style={{ position: "relative" }} ref={containerRef}>
      <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#475569", marginBottom: "6px" }}>{label}</label>
      <div
        onClick={() => onToggle(!isOpen)}
        style={{
          display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px",
          background: "white", border: "1px solid #cbd5e1", borderRadius: "10px",
          cursor: "pointer", fontWeight: "600", transition: "all 0.2s"
        }}
      >
        <CalendarIcon size={16} color="#64748b" />
        <span style={{ flex: 1, color: "#1e293b", fontSize: "14px" }}>{formatDisplay(value)}</span>
        <ChevronRight size={14} style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: "#94a3b8" }} />
      </div>

      {isOpen && (
        <div
          style={{
            position: "absolute", bottom: "calc(100% + 8px)", left: 0, width: "300px",
            background: "white", borderRadius: "16px", boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            border: "1px solid #e2e8f0", zIndex: 15, padding: "16px",
            animation: "slideDown 0.2s ease-out"
          }}
        >
          <div style={{ display: "flex", background: "#f1f5f9", padding: "4px", borderRadius: "10px", marginBottom: "12px" }}>
            <button
              onClick={(e) => { e.stopPropagation(); setIsTimeMode(false); }}
              style={{ flex: 1, border: "none", background: !isTimeMode ? "white" : "none", padding: "6px", fontSize: "12px", fontWeight: "700", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", color: !isTimeMode ? "#1e3a5f" : "#64748b", boxShadow: !isTimeMode ? "0 2px 4px rgba(0,0,0,0.05)" : "none" }}
            >
              <CalendarIcon size={12} /> Ngày
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setIsTimeMode(true); }}
              style={{ flex: 1, border: "none", background: isTimeMode ? "white" : "none", padding: "6px", fontSize: "12px", fontWeight: "700", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", color: isTimeMode ? "#1e3a5f" : "#64748b", boxShadow: isTimeMode ? "0 2px 4px rgba(0,0,0,0.05)" : "none" }}
            >
              <Clock size={12} /> Giờ
            </button>
          </div>

          {!isTimeMode ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <button style={{ border: "none", background: "none", cursor: "pointer", padding: "4px" }} onClick={(e) => { e.stopPropagation(); setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1)); }}><ChevronLeft size={16} /></button>
                <div style={{ fontWeight: "800", color: "#0f172a", fontSize: "14px" }}>Tháng {viewDate.getMonth() + 1}, {viewDate.getFullYear()}</div>
                <button style={{ border: "none", background: "none", cursor: "pointer", padding: "4px" }} onClick={(e) => { e.stopPropagation(); setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1)); }}><ChevronRight size={16} /></button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", fontSize: "10px", fontWeight: "800", color: "#94a3b8", textAlign: "center", marginBottom: "8px" }}>
                {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(d => <span key={d}>{d}</span>)}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
                {Array.from({ length: new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay() }).map((_, i) => <div key={`e-${i}`} />)}
                {Array.from({ length: new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                  const d = i + 1;
                  const isSelected = selectedDate.getDate() === d && selectedDate.getMonth() === viewDate.getMonth() && selectedDate.getFullYear() === viewDate.getFullYear();
                  return (
                    <div
                      key={d}
                      onClick={(e) => { e.stopPropagation(); handleSelectDay(d); }}
                      style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "600", cursor: "pointer", borderRadius: "8px", background: isSelected ? "#1e3a5f" : "none", color: isSelected ? "white" : "#475569" }}
                    >
                      {d}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "8px", height: "150px" }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: "10px", fontWeight: "800", color: "#94a3b8", textAlign: "center", marginBottom: "4px" }}>Giờ</div>
                <div style={{ flex: 1, overflowY: "auto", background: "#f8fafc", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                  {hours.map(h => (
                    <div key={h} onClick={(e) => { e.stopPropagation(); handleTimeSelect('h', h); }} style={{ padding: "6px", textAlign: "center", fontSize: "12px", fontWeight: "700", cursor: "pointer", background: selectedDate.getHours() === h ? "#1e3a5f" : "none", color: selectedDate.getHours() === h ? "white" : "#475569" }}>{h.toString().padStart(2, '0')}</div>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: "10px", fontWeight: "800", color: "#94a3b8", textAlign: "center", marginBottom: "4px" }}>Phút</div>
                <div style={{ flex: 1, overflowY: "auto", background: "#f8fafc", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                  {minutes.map(m => (
                    <div key={m} onClick={(e) => { e.stopPropagation(); handleTimeSelect('m', m); }} style={{ padding: "6px", textAlign: "center", fontSize: "12px", fontWeight: "700", cursor: "pointer", background: selectedDate.getMinutes() === m ? "#1e3a5f" : "none", color: selectedDate.getMinutes() === m ? "white" : "#475569" }}>{m.toString().padStart(2, '0')}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(false); }}
            style={{ width: "100%", marginTop: "12px", background: "#1e3a5f", color: "white", border: "none", padding: "8px", borderRadius: "10px", fontWeight: "700", cursor: "pointer", fontSize: "13px" }}
          >
            Xác nhận
          </button>
        </div>
      )}
    </div>
  );
};

// --- Main Component ---

const DefensePeriodsManagement: React.FC = () => {
  const auth = useAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<MainTab>("overview");
  const [rows, setRows] = useState<DefensePeriod[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(18);
  const [refreshing, setRefreshing] = useState(false);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [monitoring, setMonitoring] = useState<any>(null);
  const [periodSearch, setPeriodSearch] = useState("");
  const [milestones, setMilestones] = useState<MilestoneTemplate[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [milestonesSaving, setMilestonesSaving] = useState(false);
  const [activeMilestonePickerId, setActiveMilestonePickerId] = useState<number | null>(null);

  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; action: string; title: string; message: string; type: "info" | "warning" | "danger" } | null>(null);
  const [periodModal, setPeriodModal] = useState<{ isOpen: boolean; mode: "create" | "edit" | "clone"; row?: DefensePeriod } | null>(null);
  const studentSectionRef = useRef<DefenseTermStudentsSectionHandle>(null);
  const lecturerSectionRef = useRef<DefenseTermLecturersSectionHandle>(null);

  const userRole = (auth.user?.role || "").toUpperCase();
  const canManage = userRole === "ADMIN" || userRole === "STUDENTSERVICE" || userRole === "HEAD";

  const selectedRow = useMemo(() => rows.find(r => r.defenseTermId === selectedId), [rows, selectedId]);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await defensePeriodApi.list();
      const rawData = readEnvelopeData<any[]>(res) || [];
      const data: DefensePeriod[] = rawData.map(r => ({
        ...r,
        status: mapStatus(r.status)
      }));
      setRows(data);
      if (data.length > 0 && (!selectedId || !data.find(r => r.defenseTermId === selectedId))) {
        // Auto select running period if exists, otherwise first one
        const running = data.find((r: DefensePeriod) => r.status === "Running");
        setSelectedId(running?.defenseTermId || data[0].defenseTermId);
      }
    } catch (err) {
      addToast("Không thể tải danh sách đợt đồ án tốt nghiệp.", "error");
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [addToast, selectedId]);

  const loadSnapshots = useCallback(async () => {
    if (!selectedId) return;
    setRefreshing(true);
    try {
      const results = await Promise.allSettled([
        defensePeriodApi.snapshot(selectedId),
        defensePeriodApi.monitoring(selectedId)
      ]);

      if (results[0].status === "fulfilled") {
        setSnapshot(readEnvelopeData(results[0].value));
      }
      if (results[1].status === "fulfilled") {
        setMonitoring(readEnvelopeData(results[1].value));
      }
    } catch (err) {
      console.error("Snapshot error:", err);
    } finally {
      setRefreshing(false);
    }
  }, [selectedId]);

  const loadMilestones = useCallback(async () => {
    setMilestonesLoading(true);
    try {
      const res = await milestoneApi.list();
      const data = readEnvelopeData<MilestoneTemplate[]>(res);
      if (data) {
        setMilestones([...data].sort((a, b) => a.ordinal - b.ordinal));
      }
    } catch (err) {
      addToast("Không thể tải lộ trình.", "error");
    } finally {
      setMilestonesLoading(false);
    }
  }, [addToast]);

  const handleSaveMilestones = async () => {
    setMilestonesSaving(true);
    try {
      for (let i = 0; i < milestones.length - 1; i++) {
        const current = new Date(milestones[i].deadline!);
        const next = new Date(milestones[i + 1].deadline!);
        if (current >= next) {
          addToast(`Hạn nộp mốc ${i + 1} phải trước mốc ${i + 2}.`, "warning");
          setMilestonesSaving(false);
          return;
        }
      }
      const promises = milestones.map(m =>
        milestoneApi.update(m.milestoneTemplateID, {
          name: m.name,
          description: m.description,
          deadline: m.deadline,
          ordinal: m.ordinal
        })
      );
      const results = await Promise.all(promises);
      if (results.every(r => readEnvelopeSuccess(r))) {
        addToast("Cập nhật lộ trình thành công!", "success");
        loadMilestones();
      } else {
        addToast("Cập nhật thất bại.", "error");
      }
    } catch (err) {
      addToast("Lỗi hệ thống khi cập nhật lộ trình.", "error");
    } finally {
      setMilestonesSaving(false);
    }
  };

  useEffect(() => {
    loadData();
    loadMilestones();
  }, [loadData, loadMilestones]);

  useEffect(() => {
    if (selectedId) loadSnapshots();
  }, [selectedId, loadSnapshots]);

  useEffect(() => {
    if (!loading) {
      setLoadingProgress(100);
      return;
    }

    setLoadingProgress(18);

    const timer = window.setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 92) {
          return 92;
        }

        return Math.min(92, prev + Math.max(2, Math.round((100 - prev) * 0.16)));
      });
    }, 140);

    return () => window.clearInterval(timer);
  }, [loading]);

  const handleAction = async (action: string) => {
    if (!selectedId) return;

    const currentStatus = selectedRow?.status || "Draft";
    const nextAction = getNextActionLabel(currentStatus);

    // Business Logic Validations
    if (action === "NEXT") {
      if (currentStatus === "Draft") {
        // Validation: Ensure at least some milestones have deadlines set
        const hasDeadlines = milestones.some(m => m.deadline);
        if (!hasDeadlines) {
          addToast("Bạn cần thiết lập Lộ trình thời gian (Milestones) trước khi mở đăng ký đề tài.", "warning");
          setActiveTab("milestones");
          return;
        }
      }

      const runningExists = rows.find(r => r.status === "Running" && r.defenseTermId !== selectedId);
      if (runningExists) {
        addToast(`Đã có đợt "${runningExists.name}" đang chạy. Hệ thống chỉ cho phép 1 đợt hoạt động tại một thời điểm.`, "warning");
        return;
      }
    }

    if (action === "FINALIZE") {
      const scoringPercent = asNumber(monitoring?.pipeline?.overallCompletionPercent);
      if (scoringPercent < 100) {
        if (!window.confirm(`Tiến độ chấm điểm hiện mới đạt ${scoringPercent}%. Việc tổng kết đợt khi chưa chấm đủ có thể dẫn đến sai lệch kết quả. Bạn vẫn muốn tiếp tục?`)) return;
      }
    }

    if (action === "CLOSE") {
      if (currentStatus !== "Finalized" && currentStatus !== "Published") {
        addToast("Đợt đồ án phải được Tổng kết hoặc Công bố trước khi Đóng.", "warning");
        return;
      }
    }

    setConfirmState({
      isOpen: true,
      action,
      title: `Xác nhận điều hành: ${action === "NEXT" ? nextAction : action}`,
      message: `Hệ thống sẽ thực hiện lệnh ${action} cho đợt "${selectedRow?.name}". Hành động này sẽ chuyển trạng thái quy trình, kích hoạt lộ trình thời gian và cập nhật quyền hạn truy cập của sinh viên, giảng viên.`,
      type: action === "FINALIZE" || action === "CLOSE" ? "warning" : "info"
    });
  };

  const executeAction = async () => {
    if (!selectedId || !confirmState) return;
    const { action } = confirmState;

    setRefreshing(true);
    try {
      const idempotencyKey = safeRandomUUID();
      const res = await defensePeriodApi.lifecycle(selectedId, action, idempotencyKey);
      if (readEnvelopeSuccess(res)) {
        addToast(`Thực hiện ${action} thành công.`, "success");
        await loadData(true);
        await loadSnapshots();
      } else {
        addToast(readEnvelopeData<string>(res) || "Thao tác thất bại.", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Lỗi hệ thống khi thực hiện lệnh.", "error");
    } finally {
      setRefreshing(false);
      setConfirmState(null);
    }
  };

  const handleDownloadReport = async (item: any, format: string = "xlsx", fields?: string[]) => {
    if (!selectedId) return;

    const url = defensePeriodApi.export(selectedId, item.key, format, undefined, fields);
    const token = getAccessToken();

    setRefreshing(true);

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        let errorMessage = "Lỗi máy chủ khi tạo file.";
        try {
          const errorData = await response.json();
          errorMessage = readEnvelopeData<string>(errorData) || errorMessage;
        } catch (e) {
          // Response is not JSON
        }

        if (response.status === 401 || response.status === 403) {
          addToast("Phiên làm việc hết hạn hoặc không có quyền tải file.", "error");
        } else {
          addToast(errorMessage, "error");
        }
        return;
      }

      // Important: Check content type to prevent downloading JSON error envelopes as corrupted files
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json") || contentType.includes("text/html")) {
        const text = await response.text();
        let errorMessage = "Yêu cầu không hợp lệ từ máy chủ.";
        try {
          const errorData = JSON.parse(text);
          errorMessage = readEnvelopeData<string>(errorData) || errorMessage;
        } catch (e) {
          if (contentType.includes("text/html")) {
            errorMessage = "Lỗi hệ thống: Máy chủ trả về HTML thay vì file. Có thể sai đường dẫn API.";
          }
        }
        addToast(errorMessage, "error");
        return;
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      const fileName = `${item.key}_${selectedRow?.termCode || 'period'}_${new Date().toISOString().split('T')[0]}.${format}`;
      link.download = fileName;

      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      addToast(`Đã tải xuống: ${item.label} (${format.toUpperCase()})`, "success");
    } catch (err: any) {
      addToast(err.message || "Không thể tải báo cáo. Vui lòng thử lại sau.", "error");
    } finally {
      setRefreshing(false);
    }
  };

  const handleManagementCRUD = async (mode: "create" | "update" | "delete" | "clone", data?: any) => {
    if (!canManage) {
      addToast("Bạn không có quyền thực hiện thao tác này.", "error");
      return;
    }

    setRefreshing(true);
    try {
      const payload = {
        name: data.termName,
        startDate: data.startDate,
        endDate: data.endDate,
        semester: data.semester,
        academicYear: data.academicYear,
        description: data.description,
        termCode: data.termCode || `DT-${new Date().getFullYear()}${Math.floor(Math.random() * 1000)}`
      };

      if (mode === "create" || mode === "clone") {
        const res = await defensePeriodApi.create(payload);
        if (readEnvelopeSuccess(res)) {
          const newPeriod = readEnvelopeData<DefensePeriod>(res);
          addToast(mode === "create" ? "Khởi tạo đợt đồ án tốt nghiệp mới thành công." : "Nhân bản đợt đồ án tốt nghiệp thành công.", "success");
          await loadData(true);
          if (newPeriod) setSelectedId(newPeriod.defenseTermId);
          setPeriodModal(null);
        } else {
          addToast("Không thể tạo đợt đồ án tốt nghiệp.", "error");
        }
      } else if (mode === "update" && selectedId) {
        const res = await defensePeriodApi.update(selectedId, payload);
        if (readEnvelopeSuccess(res)) {
          addToast("Cập nhật thông tin đợt đồ án tốt nghiệp thành công.", "success");
          await loadData(true);
          setPeriodModal(null);
        }
      } else if (mode === "delete" && data) {
        const res = await defensePeriodApi.delete(data);
        if (readEnvelopeSuccess(res)) {
          addToast("Đã xóa đợt đồ án tốt nghiệp.", "success");
          await loadData(true);
          if (selectedId === data) setSelectedId(null);
          setConfirmState(null);
        }
      }
    } catch (err: any) {
      addToast(err.message || "Thao tác thất bại.", "error");
    } finally {
      setRefreshing(false);
    }
  };

  // --- Sub-sections ---

  // --- Render Helpers ---

  const renderPipeline = () => {
    const pipeline = monitoring?.pipeline || { stages: [] };
    const stages = pipeline.stages || [];

    return (
      <div style={{ marginTop: "24px" }}>
        <h4 style={{ fontSize: "14px", fontWeight: "700", color: "#475569", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Activity size={16} color={DEEP_BLUE_PRIMARY} /> Topic Lifecycle Pipeline
        </h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
          {stages.length > 0 ? stages.map((stage: any) => (
            <div key={stage.stageKey} style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b" }}>{stage.stageName}</span>
                <span style={{ fontSize: "11px", fontWeight: "800", color: DEEP_BLUE_PRIMARY }}>{stage.completedCount}/{stage.totalCount}</span>
              </div>
              <div style={{ height: "6px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden", marginBottom: "8px" }}>
                <div style={{ height: "100%", width: `${stage.completionPercent}%`, background: DEEP_BLUE_PRIMARY, borderRadius: "3px" }} />
              </div>
              <div style={{ fontSize: "10px", color: "#94a3b8" }}>{stage.status}</div>
            </div>
          )) : (
            <div style={{ gridColumn: "1/-1", padding: "32px", textAlign: "center", color: "#94a3b8", background: "#f1f5f9", borderRadius: "12px", border: "2px dashed #cbd5e1" }}>
              Không có dữ liệu tiến độ pipeline cho đợt này.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTimeline = () => {
    const steps = [
      { key: "Draft", label: "Soạn thảo", desc: "Khởi tạo đợt" },
      { key: "Registration", label: "Đăng ký", desc: "Mở đăng ký đề tài" },
      { key: "Assignment", label: "Phân công", desc: "Gán GV & Hội đồng" },
      { key: "ProgressTracking", label: "Tiến độ", desc: "Theo dõi nộp bài" },
      { key: "CommitteePreparation", label: "Chuẩn bị", desc: "Lịch bảo vệ" },
      { key: "Running", label: "Bảo vệ", desc: "Đang diễn ra" },
      { key: "ScoringLocked", label: "Hậu bảo vệ", desc: "Duyệt kết quả" },
      { key: "Finalization", label: "Tổng kết", desc: "Hoàn tất điểm" },
      { key: "Closed", label: "Kết thúc", desc: "Đóng & Lưu trữ" },
    ];

    const currentStatus = selectedRow?.status || "Draft";
    const statusOrder: Record<string, number> = {
      draft: 0, registration: 1, assignment: 2, progresstracking: 3,
      committeepreparation: 4, running: 5, paused: 5,
      scoringlocked: 6, finalization: 7, finalized: 7,
      published: 8, closed: 8, archived: 8
    };

    const normalizedKey = String(currentStatus).toLowerCase().trim();
    const currentIndex = statusOrder[normalizedKey] ?? 0;

    return (
      <div style={{ background: "#fff", padding: "24px", borderRadius: "16px", border: "1px solid #e2e8f0", marginBottom: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Activity size={18} color={DEEP_BLUE_PRIMARY} />
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: DEEP_BLUE_PRIMARY }}>Tiến trình điều hành đợt</h3>
          </div>
          <div style={{ fontSize: "12px", color: "#64748b", display: "flex", alignItems: "center", gap: "6px", background: "#f8fafc", padding: "6px 12px", borderRadius: "8px" }}>
            <Clock size={14} /> Cập nhật: {selectedRow?.lastUpdated ? new Date(selectedRow.lastUpdated).toLocaleString() : "--"}
          </div>
        </div>
        <div style={{ display: "flex", position: "relative", padding: "0 10px" }}>
          {steps.map((step, idx) => {
            const isCompleted = idx < currentIndex;
            const isActive = idx === currentIndex;
            const color = isCompleted ? "#10b981" : (isActive ? DEEP_BLUE_PRIMARY : "#cbd5e1");

            return (
              <React.Fragment key={step.key}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", zIndex: 2 }}>
                  <div style={{
                    width: "36px", height: "36px", borderRadius: "50%", background: "#fff",
                    border: `2.5px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: isActive ? `0 0 0 4px ${color}20` : "none", transition: "all 0.3s ease"
                  }}>
                    {isCompleted ? <CheckCircle size={20} color="#10b981" /> : (isActive ? <Play size={20} fill={DEEP_BLUE_PRIMARY} color={DEEP_BLUE_PRIMARY} /> : <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#cbd5e1" }} />)}
                  </div>
                  <div style={{ marginTop: "14px", textAlign: "center" }}>
                    <div style={{ fontSize: "13px", fontWeight: "800", color: isActive ? DEEP_BLUE_PRIMARY : (isCompleted ? "#1e293b" : "#94a3b8") }}>{step.label}</div>
                    <div style={{ fontSize: "10px", color: isActive ? DEEP_BLUE_PRIMARY : "#94a3b8", marginTop: "3px", fontWeight: isActive ? "700" : "500" }}>{step.desc}</div>
                  </div>
                </div>
                {idx < steps.length - 1 && (
                  <div style={{
                    position: "absolute",
                    left: `${((idx + 0.5) * (100 / steps.length))}%`,
                    top: "18px",
                    width: `${100 / steps.length}%`,
                    height: "2px",
                    background: idx < currentIndex ? "#10b981" : "#e2e8f0",
                    zIndex: 1,
                    transition: "all 0.5s ease"
                  }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };


  const renderOverview = () => {
    const stats = monitoring?.analytics?.overview || {};
    const pipeline = monitoring?.pipeline || {};
    const overviewSnapshot = snapshot?.analytics?.overview ?? snapshot?.overview ?? snapshot ?? {};
    const totalStudents = readCount(stats, ["totalStudents", "studentCount", "totalStudentCount"], readCount(overviewSnapshot, ["totalStudents", "studentCount", "totalStudentCount"], readArrayCount(snapshot, ["students", "studentList", "studentRows", "studentItems", "members", "items"])));
    const totalLecturers = readCount(stats, ["totalLecturers", "lecturerCount", "totalLecturerCount"], readCount(overviewSnapshot, ["totalLecturers", "lecturerCount", "totalLecturerCount"], readArrayCount(snapshot, ["lecturers", "lecturerList", "lecturerRows", "lecturerItems", "members", "items"])));
    const assignedTopics = readCount(stats, ["totalTopics", "topicCount", "assignmentCount", "assignedTopics"], readCount(pipeline, ["totalTopics", "topicCount", "assignmentCount", "assignedTopics"], readCount(overviewSnapshot, ["totalTopics", "topicCount", "assignmentCount", "assignedTopics"])));
    const committeeCount = readCount(stats, ["totalCommittees", "committeeCount", "committeeTotal", "councilCount"], readCount(overviewSnapshot, ["totalCommittees", "committeeCount", "committeeTotal", "councilCount"], readArrayCount(snapshot, ["committees", "committeeList", "committeeRows", "committeeItems", "councils"])));

    return (
      <div style={{ display: "grid", gap: "24px" }}>
        {renderTimeline()}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          {[
            { label: "Sinh viên trong đợt", value: totalStudents || 0, sub: "Đã được đưa vào đợt", icon: <Users size={20} />, color: "#3b82f6" },
            { label: "Giảng viên tham gia", value: totalLecturers || 0, sub: "Tham gia điều hành đợt", icon: <UserCheck size={20} />, color: "#f59e0b" },
            { label: "Đề tài đã được phân", value: assignedTopics || 0, sub: "Đã phân công cho sinh viên", icon: <LayoutDashboard size={20} />, color: "#8b5cf6" },
            { label: "Hội đồng đã phân", value: committeeCount || 0, sub: "Số hội đồng đã được tạo trong đợt", icon: <CheckCircle size={20} />, color: "#10b981" },
          ].map((stat, i) => (
            <div key={i} style={{ background: "#fff", padding: "20px", borderRadius: "16px", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: `${stat.color}15`, display: "flex", alignItems: "center", justifyContent: "center", color: stat.color }}>
                {stat.icon}
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>{stat.label}</div>
                <div style={{ fontSize: "24px", fontWeight: "800", color: "#1e293b", margin: "2px 0" }}>{stat.value}</div>
                <div style={{ fontSize: "11px", color: "#94a3b8" }}>{stat.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
          <div style={{ background: "#fff", padding: "24px", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
            <h3 style={{ margin: "0 0 20px 0", fontSize: "16px", fontWeight: "800", color: DEEP_BLUE_PRIMARY }}>Thông tin chi tiết đợt</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div style={{ padding: "12px", background: LIGHT_BLUE_SOFTEN, borderRadius: "12px" }}>
                <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "700" }}>Mã đợt</div>
                <div style={{ fontSize: "15px", fontWeight: "700", color: DEEP_BLUE_PRIMARY, marginTop: "4px" }}>{selectedRow?.termCode || `DT-${selectedRow?.defenseTermId}`}</div>
              </div>
              <div style={{ padding: "12px", background: LIGHT_BLUE_SOFTEN, borderRadius: "12px" }}>
                <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "700" }}>Tên đợt</div>
                <div style={{ fontSize: "15px", fontWeight: "700", color: DEEP_BLUE_PRIMARY, marginTop: "4px" }}>{selectedRow?.name}</div>
              </div>
              <div style={{ padding: "12px", background: LIGHT_BLUE_SOFTEN, borderRadius: "12px" }}>
                <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "700" }}>Năm học / Học kỳ</div>
                <div style={{ fontSize: "15px", fontWeight: "700", color: DEEP_BLUE_PRIMARY, marginTop: "4px" }}>{selectedRow?.academicYear || "--"} - {selectedRow?.semester || "--"}</div>
              </div>
              <div style={{ padding: "12px", background: LIGHT_BLUE_SOFTEN, borderRadius: "12px" }}>
                <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "700" }}>Trạng thái</div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: getStatusPresentation(selectedRow?.status).color }} />
                  <span style={{ fontSize: "15px", fontWeight: "700", color: getStatusPresentation(selectedRow?.status).color }}>{getStatusPresentation(selectedRow?.status).label}</span>
                </div>
              </div>
            </div>
            <div style={{ marginTop: "24px" }}>
              <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "700", marginBottom: "8px" }}>Mô tả đợt</div>
              <p style={{ margin: 0, fontSize: "14px", color: "#475569", lineHeight: "1.6" }}>{selectedRow?.description || "Chưa có mô tả cho đợt đồ án tốt nghiệp này."}</p>
            </div>
          </div>

          <div style={{ background: DEEP_BLUE_PRIMARY, padding: "24px", borderRadius: "16px", color: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "800" }}>Hành động nhanh</h3>
              <p style={{ margin: 0, fontSize: "13px", color: "#cbd5e1" }}>Các thao tác điều hành quan trọng cho trạng thái hiện tại.</p>
            </div>
            <div style={{ display: "grid", gap: "10px", marginTop: "24px" }}>
              {selectedRow && (
                <button
                  onClick={() => handleAction(selectedRow.status === "Closed" ? "ARCHIVE" : "NEXT")}
                  style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: "10px", padding: "12px", fontWeight: "700", fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                  disabled={selectedRow.status === "Archived"}
                >
                  <Play size={18} /> {getNextActionLabel(selectedRow.status)}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderOperations = () => {
    const currentStatus = selectedRow?.status || "Draft";
    const nextAction = getNextActionLabel(currentStatus);
    
    // Find matching milestone for current stage
    const currentMilestone = milestones.find(m => {
      if (currentStatus === "Registration") return m.ordinal === 1;
      if (currentStatus === "ProgressTracking") return m.ordinal === 2;
      if (currentStatus === "CommitteePreparation") return m.ordinal === 3;
      if (currentStatus === "Running") return m.ordinal === 4;
      return false;
    });

    return (
      <div style={{ display: "grid", gap: "24px", animation: "fadeIn 0.4s ease-out" }}>
        {/* 1. Visual Process Integration */}
        {renderTimeline()}

        {/* 2. Focused Action Center */}
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "24px" }}>
          <div style={{ background: "#fff", padding: "32px", borderRadius: "24px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "24px", boxShadow: "0 10px 30px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "12px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em" }}>Giai đoạn hiện tại</div>
                <h3 style={{ margin: "8px 0 0 0", fontSize: "24px", fontWeight: "900", color: DEEP_BLUE_PRIMARY }}>{getStatusPresentation(currentStatus).label}</h3>
              </div>
              <div style={{ padding: "12px", borderRadius: "16px", background: `${getStatusPresentation(currentStatus).color}10`, color: getStatusPresentation(currentStatus).color }}>
                {getStatusPresentation(currentStatus).icon}
              </div>
            </div>

            <div style={{ padding: "20px", background: "#f8fafc", borderRadius: "16px", border: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: "14px", color: "#475569", lineHeight: "1.6" }}>
                {currentStatus === "Draft" && "Đợt đồ án đang trong quá trình khởi tạo. Bạn cần thiết lập lộ trình thời gian và kiểm tra danh sách thành viên trước khi mở đăng ký."}
                {currentStatus === "Registration" && "Sinh viên đang thực hiện đăng ký đề tài. Bạn có thể theo dõi số lượng đăng ký và duyệt các đề tài hợp lệ."}
                {currentStatus === "Assignment" && "Giai đoạn phân công giảng viên hướng dẫn và chuẩn bị nhân sự cho các hội đồng bảo vệ."}
                {currentStatus === "ProgressTracking" && "Theo dõi tiến độ nộp báo cáo của sinh viên theo các mốc thời gian đã thiết lập trong lộ trình."}
                {currentStatus === "CommitteePreparation" && "Thiết lập lịch bảo vệ chi tiết, gán phòng và thời gian cho từng hội đồng."}
                {currentStatus === "Running" && "Hội đồng đang thực hiện chấm điểm. Điểm số sẽ được cập nhật thời gian thực vào hệ thống."}
                {currentStatus === "ScoringLocked" && "Điểm số đã được khóa. Bạn cần phê duyệt các báo cáo hậu bảo vệ (nếu có) trước khi tổng kết."}
                {currentStatus === "Finalization" && "Tính toán kết quả cuối cùng và chuẩn bị công bố điểm cho sinh viên."}
              </div>
            </div>

            {currentMilestone && (
              <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px", background: "#fffbeb", borderRadius: "16px", border: "1px solid #fef3c7" }}>
                <Clock size={20} color="#f59e0b" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: "800", color: "#92400e" }}>Hạn chót Giai đoạn {currentMilestone.ordinal}: {currentMilestone.name}</div>
                  <div style={{ fontSize: "12px", color: "#b45309" }}>{currentMilestone.deadline ? `Hết hạn vào: ${new Date(currentMilestone.deadline).toLocaleString("vi-VN")}` : "Chưa thiết lập hạn nộp bài"}</div>
                </div>
                <button 
                  onClick={() => setActiveTab("milestones")}
                  style={{ background: "white", border: "1px solid #fef3c7", padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: "700", color: "#f59e0b", cursor: "pointer" }}
                >
                  Điều chỉnh
                </button>
              </div>
            )}

            <div style={{ marginTop: "auto", paddingTop: "24px", borderTop: "1px solid #f1f5f9" }}>
              <button
                disabled={refreshing || currentStatus === "Archived"}
                onClick={() => handleAction("NEXT")}
                style={{
                  width: "100%", padding: "18px", borderRadius: "16px", border: "none",
                  background: `linear-gradient(135deg, ${DEEP_BLUE_PRIMARY}, #2c5282)`,
                  color: "white", fontSize: "16px", fontWeight: "800", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
                  boxShadow: "0 10px 20px -5px rgba(30, 58, 95, 0.3)", transition: "all 0.2s"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {refreshing ? <RefreshCw size={22} className="animate-spin" /> : <ChevronRightIcon size={22} />}
                {nextAction}
              </button>
              {currentStatus === "Draft" && (
                <div style={{ textAlign: "center", marginTop: "12px" }}>
                  <button 
                    onClick={() => setActiveTab("milestones")}
                    style={{ background: "none", border: "none", color: DEEP_BLUE_PRIMARY, fontSize: "13px", fontWeight: "700", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Thiết lập lộ trình thời gian trước khi bắt đầu
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ background: "#fff", padding: "24px", borderRadius: "24px", border: "1px solid #e2e8f0" }}>
              <h4 style={{ margin: "0 0 20px 0", fontSize: "15px", fontWeight: "800", color: "#1e293b", display: "flex", alignItems: "center", gap: "10px" }}>
                <Settings size={18} color={DEEP_BLUE_PRIMARY} /> Thao tác quản trị
              </h4>
              <div style={{ display: "grid", gap: "12px" }}>
                {[
                  { action: "SYNC", label: "Đồng bộ dữ liệu", icon: <RefreshCw size={18} />, color: "#3b82f6", disabled: false },
                  { action: "PAUSE", label: "Tạm dừng đợt", icon: <Pause size={18} />, color: "#f59e0b", disabled: currentStatus !== "Running" },
                  { action: "RESUME", label: "Tiếp tục đợt", icon: <Play size={18} />, color: "#10b981", disabled: currentStatus !== "Paused" },
                  { action: "LOCK_SCORING", label: "Khóa chấm điểm", icon: <Lock size={18} />, color: "#ef4444", disabled: currentStatus !== "Running" },
                ].map(op => (
                  <button
                    key={op.action}
                    disabled={op.disabled || refreshing}
                    onClick={() => handleAction(op.action)}
                    style={{
                      width: "100%", padding: "14px 16px", borderRadius: "12px", border: "1px solid #e2e8f0",
                      background: op.disabled ? "#f8fafc" : "white", color: op.disabled ? "#cbd5e1" : "#475569",
                      fontSize: "14px", fontWeight: "700", cursor: op.disabled ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", gap: "12px", transition: "all 0.2s"
                    }}
                  >
                    <span style={{ color: op.disabled ? "#cbd5e1" : op.color }}>{op.icon}</span>
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: "#fef2f2", padding: "24px", borderRadius: "24px", border: "1px solid #fee2e2" }}>
              <div style={{ display: "flex", gap: "16px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "#fee2e2", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <AlertCircle size={24} />
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "800", color: "#991b1b" }}>Vùng nguy hiểm</div>
                  <p style={{ margin: "4px 0 16px 0", fontSize: "12px", color: "#b91c1c", lineHeight: "1.5" }}>Các thao tác này sẽ ảnh hưởng vĩnh viễn đến dữ liệu và điểm số.</p>
                  <button 
                    onClick={() => handleAction("CLOSE")}
                    disabled={currentStatus !== "Finalized" && currentStatus !== "Published"}
                    style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #fca5a5", background: "white", color: "#b91c1c", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}
                  >
                    Đóng & Lưu trữ đợt
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };


  const renderMilestones = () => {
    if (milestonesLoading) {
      return (
        <div style={{ display: "flex", justifyContent: "center", padding: "100px" }}>
          <div style={{ width: "40px", height: "40px", border: `4px solid ${LIGHT_BLUE_SOFTEN}`, borderTop: `4px solid ${DEEP_BLUE_PRIMARY}`, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        </div>
      );
    }

    return (
      <div style={{ display: "grid", gap: "24px" }}>
        <div style={{
          background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
          padding: "24px", borderRadius: "20px", border: "1px solid #e2e8f0",
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <div>
            <div style={{ fontSize: "12px", fontWeight: "800", color: DEEP_BLUE_PRIMARY, textTransform: "uppercase", letterSpacing: "0.05em" }}>Cấu hình tiến độ</div>
            <h3 style={{ margin: "4px 0 0 0", fontSize: "20px", fontWeight: "900", color: "#0f172a" }}>Thiết lập lộ trình nộp bài</h3>
            <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "14px" }}>Xác định các mốc thời gian quan trọng sinh viên cần hoàn thành trong đợt.</p>
          </div>
          <button
            onClick={handleSaveMilestones}
            disabled={milestonesSaving}
            style={{
              background: DEEP_BLUE_PRIMARY, color: "white", border: "none", padding: "12px 24px",
              borderRadius: "12px", fontWeight: "700", cursor: "pointer", display: "flex",
              alignItems: "center", gap: "10px", boxShadow: "0 4px 12px rgba(30, 58, 95, 0.2)"
            }}
          >
            {milestonesSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
            <span>Lưu thay đổi lộ trình</span>
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "24px", alignItems: "start" }}>
          {/* Summary Sidebar */}
          <div style={{ background: "#fff", padding: "24px", borderRadius: "20px", border: "1px solid #e2e8f0", position: "sticky", top: "100px" }}>
            <h4 style={{ margin: "0 0 20px 0", fontSize: "16px", fontWeight: "800", color: DEEP_BLUE_PRIMARY }}>Tóm tắt lộ trình</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {milestones.map((m, idx) => (
                <React.Fragment key={m.milestoneTemplateID}>
                  <div style={{ display: "flex", gap: "16px", alignItems: "center", padding: "12px 0" }}>
                    <div style={{
                      width: "32px", height: "32px", background: m.ordinal === 4 ? "#fff7ed" : "#f1f5f9",
                      color: m.ordinal === 4 ? "#f97316" : DEEP_BLUE_PRIMARY,
                      borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: "800", fontSize: "14px", flexShrink: 0, border: `1px solid ${m.ordinal === 4 ? "#ffedd5" : "#e2e8f0"}`
                    }}>
                      {m.ordinal}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: "#334155", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                      <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>{m.deadline ? new Date(m.deadline).toLocaleDateString('vi-VN') : '---'}</div>
                    </div>
                  </div>
                  {idx < milestones.length - 1 && (
                    <div style={{ width: "2px", height: "20px", background: "#e2e8f0", marginLeft: "15px" }}></div>
                  )}
                </React.Fragment>
              ))}
            </div>
            <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: "8px", color: "#94a3b8", fontSize: "12px", fontWeight: "600" }}>
              <Info size={14} />
              <span>Quy trình gồm 4 giai đoạn</span>
            </div>
          </div>

          {/* Main Content: Timeline Editor */}
          <div style={{ display: "grid", gap: "32px" }}>
            {milestones.map((m, idx) => (
              <div key={m.milestoneTemplateID} style={{ display: "flex", gap: "24px" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "48px" }}>
                  <div style={{
                    width: "48px", height: "48px", background: "white",
                    border: `3px solid ${m.ordinal === 4 ? "#F37021" : DEEP_BLUE_PRIMARY}`,
                    color: m.ordinal === 4 ? "#F37021" : DEEP_BLUE_PRIMARY,
                    borderRadius: "50%", display: "flex", alignItems: "center",
                    justifyContent: "center", zIndex: 2, boxShadow: `0 0 0 6px ${m.ordinal === 4 ? "#fff7ed" : "#f0f7ff"}`
                  }}>
                    {m.ordinal === 1 ? <Target size={20} /> : m.ordinal === 4 ? <Flag size={20} /> : <BookOpen size={20} />}
                  </div>
                  {idx < milestones.length - 1 && (
                    <div style={{ width: "3px", flex: 1, background: "#e2e8f0", margin: "10px 0", borderRadius: "10px" }}></div>
                  )}
                </div>

                <div style={{
                  flex: 1, background: "white", borderRadius: "24px", padding: "24px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.02)", border: "1px solid #e2e8f0"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px" }}>Giai đoạn {m.ordinal}</span>
                    <div style={{ fontFamily: "monospace", fontSize: "11px", color: "#94a3b8", background: "#f8fafc", padding: "4px 10px", borderRadius: "8px", border: "1px solid #f1f5f9" }}>{m.milestoneTemplateCode}</div>
                  </div>

                  <div style={{ display: "grid", gap: "20px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#475569", marginBottom: "6px" }}>Tên giai đoạn</label>
                      <input
                        type="text"
                        value={m.name}
                        onChange={(e) => setMilestones(prev => prev.map(x => x.milestoneTemplateID === m.milestoneTemplateID ? { ...x, name: e.target.value } : x))}
                        style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: "10px", fontSize: "14px", color: "#1e293b", outline: "none" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#475569", marginBottom: "6px" }}>Mô tả yêu cầu</label>
                      <textarea
                        rows={2}
                        value={m.description || ""}
                        onChange={(e) => setMilestones(prev => prev.map(x => x.milestoneTemplateID === m.milestoneTemplateID ? { ...x, description: e.target.value } : x))}
                        style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: "10px", fontSize: "14px", color: "#1e293b", outline: "none", resize: "none" }}
                      />
                    </div>
                    <CustomDatePicker
                      label="Hạn nộp bài cuối cùng"
                      value={m.deadline}
                      onChange={(val) => setMilestones(prev => prev.map(x => x.milestoneTemplateID === m.milestoneTemplateID ? { ...x, deadline: val } : x))}
                      isOpen={activeMilestonePickerId === m.milestoneTemplateID}
                      onToggle={(open) => setActiveMilestonePickerId(open ? m.milestoneTemplateID : null)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderEmptyState = () => {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "80px 40px", textAlign: "center", background: "#fff", borderRadius: "24px",
        border: "1px dashed #cbd5e1", margin: "40px 0"
      }}>
        <div style={{
          width: "100px", height: "100px", borderRadius: "50%", background: "#f1f5f9",
          display: "flex", alignItems: "center", justifyContent: "center", color: DEEP_BLUE_PRIMARY,
          marginBottom: "32px"
        }}>
          <CalendarIcon size={48} />
        </div>
        <h2 style={{ fontSize: "28px", fontWeight: "900", color: "#1e293b", margin: "0 0 12px 0", letterSpacing: "-0.02em" }}>Sẵn sàng khởi tạo đợt đồ án tốt nghiệp?</h2>
        <p style={{ maxWidth: "520px", color: "#64748b", fontSize: "16px", lineHeight: "1.7", margin: "0 0 40px 0" }}>
          Hệ thống hiện chưa ghi nhận đợt đồ án tốt nghiệp nào. Hãy khởi tạo đợt đầu tiên để thiết lập lộ trình, quản lý danh sách sinh viên, giảng viên và bắt đầu điều hành hội đồng.
        </p>
        <div style={{ display: "flex", gap: "16px" }}>
          <button
            onClick={() => setPeriodModal({ isOpen: true, mode: "create" })}
            style={{
              display: "flex", alignItems: "center", gap: "12px", padding: "16px 36px",
              borderRadius: "16px", border: "none", background: `linear-gradient(135deg, ${DEEP_BLUE_PRIMARY}, #2c5282)`,
              color: "white", fontSize: "16px", fontWeight: "800", cursor: "pointer",
              boxShadow: "0 10px 25px -5px rgba(30, 58, 95, 0.4)", transform: "translateY(0)", transition: "all 0.2s ease"
            }}
          >
            <PlusCircle size={22} /> Khởi tạo ngay
          </button>
        </div>
      </div>
    );
  };

  const renderManagement = () => {
    const filteredPeriods = rows.filter(r =>
      r.name.toLowerCase().includes(periodSearch.toLowerCase()) ||
      (r.termCode || "").toLowerCase().includes(periodSearch.toLowerCase())
    );

    return (
      <div style={{ display: "grid", gap: "20px" }}>
        <div style={{ background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)", padding: "20px", borderRadius: "20px", border: "1px solid #dbeafe", display: "grid", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "12px", fontWeight: "800", color: DEEP_BLUE_PRIMARY, textTransform: "uppercase", letterSpacing: "0.08em" }}>Cấu hình đợt</div>
              <div style={{ fontSize: "18px", fontWeight: "900", color: "#0f172a", marginTop: "4px" }}>Quản lý thông tin, trạng thái và vòng đời đợt đồ án tốt nghiệp</div>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", color: "#475569", fontSize: "13px", lineHeight: 1.6 }}>
            <span style={{ padding: "6px 10px", borderRadius: "999px", background: "#fff", border: "1px solid #dbeafe" }}>Tìm kiếm đợt theo mã, tên hoặc học kỳ</span>
            <span style={{ padding: "6px 10px", borderRadius: "999px", background: "#fff", border: "1px solid #dbeafe" }}>Chọn đợt đang xử lý ở góc trên bên phải</span>
            <span style={{ padding: "6px 10px", borderRadius: "999px", background: "#fff", border: "1px solid #dbeafe" }}>Thao tác sinh viên và giảng viên nằm ở các tab con</span>
          </div>
        </div>

        <div style={{ background: "white", padding: "24px", borderRadius: "20px", border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ position: "relative" }}>
                <SearchIcon size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                <input value={periodSearch} onChange={e => setPeriodSearch(e.target.value)} placeholder="Tìm đợt đồ án tốt nghiệp..." style={{ padding: "10px 12px 10px 36px", borderRadius: "12px", border: "1px solid #e2e8f0", width: "300px", fontSize: "14px" }} />
              </div>
              <button style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", borderRadius: "12px", border: "1px solid #e2e8f0", background: "white", color: "#64748b", fontSize: "14px", fontWeight: "600" }}>
                <FilterIcon size={16} /> Lọc trạng thái
              </button>
            </div>
            <button onClick={() => setPeriodModal({ isOpen: true, mode: "create" })} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 20px", borderRadius: "14px", border: "none", background: DEEP_BLUE_PRIMARY, color: "white", fontSize: "14px", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 6px -1px rgba(30, 58, 95, 0.2)" }}>
              <PlusCircle size={18} /> Tạo đợt đồ án tốt nghiệp
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" }}>
              <thead>
                <tr style={{ color: "#64748b", fontSize: "12px", fontWeight: "700", textTransform: "uppercase", textAlign: "left" }}>
                  <th style={{ padding: "12px 16px" }}>Mã đợt</th>
                  <th style={{ padding: "12px 16px" }}>Tên đợt đồ án tốt nghiệp</th>
                  <th style={{ padding: "12px 16px" }}>Năm học / Kỳ</th>
                  <th style={{ padding: "12px 16px" }}>Thời gian</th>
                  <th style={{ padding: "12px 16px" }}>Trạng thái</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredPeriods.map(row => (
                  <tr key={row.defenseTermId} style={{ background: selectedId === row.defenseTermId ? "#f1f5f9" : "white", transition: "all 0.2s" }}>
                    <td style={{ padding: "16px", fontSize: "14px", fontWeight: "600", color: DEEP_BLUE_PRIMARY }}>{row.termCode || `DT-${row.defenseTermId}`}</td>
                    <td style={{ padding: "16px", fontSize: "14px", fontWeight: "700", color: "#1e293b" }}>{row.name}</td>
                    <td style={{ padding: "16px", fontSize: "13px", color: "#64748b" }}>{row.academicYear || "--"} - {row.semester || "--"}</td>
                    <td style={{ padding: "16px", fontSize: "13px", color: "#64748b" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}><CalendarIcon size={12} /> {row.startDate ? new Date(row.startDate).toLocaleDateString() : "--"}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}><Clock size={12} /> {row.endDate ? new Date(row.endDate).toLocaleDateString() : "--"}</div>
                    </td>
                    <td style={{ padding: "16px" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "10px", background: getStatusPresentation(row.status).bg, color: getStatusPresentation(row.status).color, fontSize: "12px", fontWeight: "700" }}>
                        {getStatusPresentation(row.status).icon} {getStatusPresentation(row.status).label}
                      </div>
                    </td>
                    <td style={{ padding: "16px", textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                        <button onClick={() => {
                          setSelectedId(row.defenseTermId);
                          setActiveTab("overview");
                        }} title="Xem chi tiết" style={{ padding: "8px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "white", color: "#64748b" }}><Eye size={16} /></button>
                        <button onClick={() => setPeriodModal({ isOpen: true, mode: "edit", row })} title="Sửa thông tin" style={{ padding: "8px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "white", color: "#64748b" }}><Edit size={16} /></button>
                        <button onClick={() => setPeriodModal({ isOpen: true, mode: "clone", row })} title="Nhân bản" style={{ padding: "8px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "white", color: "#64748b" }}><Copy size={16} /></button>
                        <button onClick={() => {
                          setSelectedId(row.defenseTermId);
                          setConfirmState({
                            isOpen: true,
                            action: "DELETE_PERIOD",
                            title: "Xóa đợt đồ án tốt nghiệp",
                            message: `Bạn có chắc chắn muốn xóa đợt đồ án tốt nghiệp "${row.name}"? Lưu ý: Hệ thống chỉ cho phép xóa đợt khi chưa phát sinh dữ liệu (sinh viên, giảng viên, hội đồng).`,
                            type: "danger"
                          });
                        }} title="Xóa" style={{ padding: "8px", borderRadius: "8px", border: "1px solid #fee2e2", background: "white", color: "#ef4444" }}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // --- Main Render ---

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
        background: "#0f172a",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Inter', sans-serif"
      }}>
        {/* Animated Background Elements */}
        <div style={{
          position: "absolute",
          top: "-10%",
          left: "-5%",
          width: "40%",
          height: "40%",
          background: "radial-gradient(circle, rgba(30, 58, 95, 0.4) 0%, transparent 70%)",
          filter: "blur(60px)",
          animation: "float 15s infinite ease-in-out"
        }} />
        <div style={{
          position: "absolute",
          bottom: "-10%",
          right: "-5%",
          width: "50%",
          height: "50%",
          background: "radial-gradient(circle, rgba(243, 112, 33, 0.15) 0%, transparent 70%)",
          filter: "blur(80px)",
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
            background: "rgba(255, 255, 255, 0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.4)",
            borderRadius: 32,
            padding: "48px 40px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
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
                fontSize: 13,
                fontWeight: 700,
                color: "#f37021",
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                marginBottom: 8
              }}>
                Đang khởi tạo hệ thống
              </div>
              <h2 style={{
                fontSize: 28,
                fontWeight: 800,
                color: "#1e293b",
                margin: 0,
                letterSpacing: "-0.02em"
              }}>
                Defense Management
              </h2>
            </div>

            <div style={{
              fontSize: 15,
              color: "#64748b",
              lineHeight: 1.6,
              marginBottom: 40,
              padding: "0 10px"
            }}>
              Vui lòng đợi trong giây lát, chúng tôi đang chuẩn bị không gian làm việc tối ưu cho bạn.
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
                  ? "Tải cấu hình hệ thống..."
                  : loadingProgress < 85
                    ? "Đồng bộ hóa dữ liệu..."
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
        `}</style>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div style={{ padding: "32px", background: "#f8fafc", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "900", color: "#0f172a", letterSpacing: "-0.02em" }}>Quản lý đợt đồ án tốt nghiệp</h1>
          <p style={{ margin: "8px 0 0 0", color: "#64748b", fontSize: "14px" }}>Điều hành vòng đời, theo dõi tiến độ và quản lý thành viên đợt đồ án tốt nghiệp.</p>
        </div>
        {renderEmptyState()}
        <DefensePeriodModal
          isOpen={!!periodModal}
          onClose={() => setPeriodModal(null)}
          initialData={periodModal?.row}
          isLoading={refreshing}
          onSave={(data) => handleManagementCRUD(periodModal?.mode === "edit" ? "update" : periodModal?.mode as any, data)}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: "32px", background: "#f8fafc", minHeight: "100vh" }}>
      {/* Header Section */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "900", color: "#0f172a", letterSpacing: "-0.02em" }}>Quản lý đợt đồ án tốt nghiệp</h1>
            {selectedRow && (
              <div style={{
                padding: "4px 12px", borderRadius: "20px", background: "#fff", border: "1px solid #cbd5e1",
                fontSize: "13px", fontWeight: "700", color: "#1e293b", display: "flex", alignItems: "center", gap: "6px"
              }}>
                <CalendarIcon size={14} color={DEEP_BLUE_PRIMARY} /> {selectedRow.academicYear || "--"} - {selectedRow.semester || "--"}
              </div>
            )}
          </div>
          <p style={{ margin: "8px 0 0 0", color: "#64748b", fontSize: "14px" }}>
            {selectedRow ? `Điều hành: ${selectedRow.name}` : "Điều hành vòng đời, theo dõi tiến độ và quản lý thành viên đợt đồ án tốt nghiệp."}
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>

          <select
            value={selectedId || ""}
            onChange={(e) => setSelectedId(Number(e.target.value))}
            style={{
              padding: "10px 16px", borderRadius: "12px", border: "1px solid #cbd5e1", background: "#fff",
              fontWeight: "700", fontSize: "14px", color: DEEP_BLUE_PRIMARY, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", outline: "none"
            }}
          >
            {rows.map(r => (
              <option key={r.defenseTermId} value={r.defenseTermId}>
                {r.name} ({getStatusPresentation(r.status).label})
              </option>
            ))}
          </select>
          <button
            onClick={() => setPeriodModal({ isOpen: true, mode: "create" })}
            style={{
              padding: "10px 20px", borderRadius: "12px", background: DEEP_BLUE_PRIMARY, color: "#fff",
              border: "none", fontWeight: "700", fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
              boxShadow: "0 4px 12px rgba(30, 58, 95, 0.25)"
            }}
          >
            <Plus size={18} /> Tạo đợt mới
          </button>
        </div>
      </div>

      {/* Main Tabs Container */}
      <div style={{ background: "#fff", borderRadius: "24px", border: "1px solid #e2e8f0", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
        {/* Sticky Tab Bar */}
        <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 24px", position: "sticky", top: 0, zIndex: 20, borderTopLeftRadius: "24px", borderTopRightRadius: "24px" }}>
          {[
            { id: "overview", label: "Tổng quan", icon: <LayoutDashboard size={18} /> },
            { id: "management", label: "Cấu hình đợt", icon: <Settings size={18} /> },
            { id: "milestones", label: "Lộ trình", icon: <Flag size={18} /> },
            { id: "students", label: "Sinh viên", icon: <Users size={18} /> },
            { id: "lecturers", label: "Giảng viên", icon: <UserCheck size={18} /> },
            { id: "operations", label: "Điều hành", icon: <Zap size={18} /> },
            { id: "statistics", label: "Thống kê", icon: <Activity size={18} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as MainTab)}
              style={{
                padding: "20px 24px", background: "none", border: "none", borderBottom: `3px solid ${activeTab === tab.id ? DEEP_BLUE_PRIMARY : "transparent"}`,
                color: activeTab === tab.id ? DEEP_BLUE_PRIMARY : "#64748b", fontWeight: activeTab === tab.id ? "800" : "600", fontSize: "14px",
                cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", transition: "all 0.2s ease"
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {refreshing && <RefreshCw size={16} className="animate-spin" color="#94a3b8" />}
            <button onClick={loadSnapshots} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: "8px" }}>
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        {/* Tab Content Area */}
        <div style={{ padding: "32px", background: "#fff" }}>
          {activeTab === "overview" && renderOverview()}
          {activeTab === "management" && renderManagement()}
          {activeTab === "milestones" && renderMilestones()}
          {activeTab === "students" && (
            <div style={{ display: "grid", gap: "24px" }}>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <ImportExportActions moduleName="students" moduleLabel="Sinh viên tham gia" onImportSuccess={() => studentSectionRef.current?.openAdd()} />
                <button onClick={() => studentSectionRef.current?.openAdd()} style={{ background: DEEP_BLUE_PRIMARY, color: "#fff", border: "none", borderRadius: "10px", padding: "8px 16px", fontWeight: "700", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Plus size={16} /> Thêm sinh viên
                </button>
              </div>
              <DefenseTermStudentsSection ref={studentSectionRef} defenseTermId={selectedId} />
            </div>
          )}
          {activeTab === "lecturers" && (
            <div style={{ display: "grid", gap: "24px" }}>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <ImportExportActions moduleName="lecturers" moduleLabel="Giảng viên tham gia" onImportSuccess={() => lecturerSectionRef.current?.openAdd()} />
                <button onClick={() => lecturerSectionRef.current?.openAdd()} style={{ background: DEEP_BLUE_PRIMARY, color: "#fff", border: "none", borderRadius: "10px", padding: "8px 16px", fontWeight: "700", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Plus size={16} /> Thêm giảng viên
                </button>
              </div>
              <DefenseTermLecturersSection ref={lecturerSectionRef} defenseTermId={selectedId} />
            </div>
          )}
          {activeTab === "operations" && renderOperations()}
          {activeTab === "statistics" && (
            <StatisticsSection
              selectedId={selectedId}
              refreshing={refreshing}
              onDownload={handleDownloadReport}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <ConfirmModal
        isOpen={!!confirmState}
        onClose={() => setConfirmState(null)}
        onConfirm={() => {
          if (confirmState?.action === "DELETE_PERIOD") {
            handleManagementCRUD("delete", selectedId);
          } else {
            executeAction();
          }
        }}
        title={confirmState?.title || ""}
        message={confirmState?.message || ""}
        type={confirmState?.type || "info"}
        isLoading={refreshing}
      />

      <DefensePeriodModal
        isOpen={!!periodModal}
        onClose={() => setPeriodModal(null)}
        initialData={periodModal?.row}
        isLoading={refreshing}
        onSave={(data) => handleManagementCRUD(periodModal?.mode === "edit" ? "update" : periodModal?.mode as any, data)}
      />
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};


export default DefensePeriodsManagement;

const StatisticsSection: React.FC<{
  selectedId: number | null;
  refreshing: boolean;
  onDownload: (item: any, format: string, fields?: string[]) => void;
}> = ({ selectedId, refreshing, onDownload }) => {
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(STATISTICS_REPORTS[0].key);
  const [selectedFields, setSelectedFields] = useState<string[]>(STATISTICS_REPORTS[0].fields?.map(f => f.key) || []);
  const [exportFormat, setExportFormat] = useState("xlsx");

  const currentTemplate = STATISTICS_REPORTS.find(t => t.key === selectedTemplateKey) || STATISTICS_REPORTS[0];

  const categories = useMemo(() => {
    const cats: Record<string, any[]> = {};
    if (currentTemplate.fields) {
      currentTemplate.fields.forEach((f: any) => {
        if (!cats[f.category]) cats[f.category] = [];
        cats[f.category].push(f);
      });
    }
    return cats;
  }, [currentTemplate]);

  // Sync fields when template changes
  useEffect(() => {
    if (currentTemplate.fields) {
      setSelectedFields(currentTemplate.fields.map(f => f.key));
    } else {
      setSelectedFields([]);
    }
  }, [selectedTemplateKey, currentTemplate]);

  const toggleField = (key: string) => {
    setSelectedFields(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  return (
    <div style={{ display: "grid", gap: "24px", animation: "fadeIn 0.4s ease-out" }}>
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "24px", alignItems: "start" }}>

        <div style={{ background: "#f8fafc", padding: "24px", borderRadius: "20px", border: "1px solid #e2e8f0", height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: DEEP_BLUE_PRIMARY, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "800" }}>1</div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Chọn mẫu báo cáo</h3>
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            {STATISTICS_REPORTS.map((item) => (
              <button
                key={item.key}
                onClick={() => setSelectedTemplateKey(item.key)}
                style={{
                  width: "100%", padding: "16px", borderRadius: "16px", textAlign: "left",
                  border: `2px solid ${selectedTemplateKey === item.key ? DEEP_BLUE_PRIMARY : "transparent"}`,
                  background: selectedTemplateKey === item.key ? "white" : "transparent",
                  boxShadow: selectedTemplateKey === item.key ? "0 4px 12px rgba(0,0,0,0.05)" : "none",
                  cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: "12px"
                }}
              >
                <div style={{ color: selectedTemplateKey === item.key ? DEEP_BLUE_PRIMARY : "#94a3b8" }}>{item.icon}</div>
                <span style={{ fontSize: "14px", fontWeight: selectedTemplateKey === item.key ? "700" : "600", color: selectedTemplateKey === item.key ? "#1e293b" : "#64748b" }}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: "white", padding: "32px", borderRadius: "20px", border: "1px solid #e2e8f0", minHeight: "500px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: DEEP_BLUE_PRIMARY, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "800" }}>2</div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cấu hình trường dữ liệu</h3>
            </div>
            {currentTemplate.fields && (
              <div style={{ display: "flex", gap: "16px" }}>
                <button onClick={() => setSelectedFields(currentTemplate.fields?.map(f => f.key) || [])} style={{ background: "none", border: "none", color: DEEP_BLUE_PRIMARY, fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>Chọn tất cả</button>
                <button onClick={() => setSelectedFields([])} style={{ background: "none", border: "none", color: "#ef4444", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>Bỏ chọn</button>
              </div>
            )}
          </div>

          {currentTemplate.fields ? (
            <div style={{ flex: 1, display: "grid", gap: "32px" }}>
              {Object.entries(categories).map(([cat, fields]) => (
                <div key={cat}>
                  <div style={{ fontSize: "12px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
                    {cat} <div style={{ flex: 1, height: "1px", background: "#f1f5f9" }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
                    {fields.map(field => (
                      <label
                        key={field.key}
                        style={{
                          display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderRadius: "14px",
                          border: `1px solid ${selectedFields.includes(field.key) ? DEEP_BLUE_PRIMARY : "#f1f5f9"}`,
                          background: selectedFields.includes(field.key) ? `${DEEP_BLUE_PRIMARY}05` : "#fcfdfe",
                          cursor: "pointer", transition: "all 0.2s"
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedFields.includes(field.key)}
                          onChange={() => toggleField(field.key)}
                          style={{ width: "18px", height: "18px", accentColor: DEEP_BLUE_PRIMARY, cursor: "pointer" }}
                        />
                        <span style={{ fontSize: "13px", fontWeight: "600", color: selectedFields.includes(field.key) ? "#1e293b" : "#64748b" }}>{field.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94a3b8", gap: "16px" }}>
              <Info size={48} strokeWidth={1} />
              <div style={{ fontSize: "14px", fontWeight: "600" }}>Mẫu báo cáo này không yêu cầu cấu hình trường dữ liệu bổ sung.</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ background: "#1e293b", padding: "32px", borderRadius: "24px", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "rgba(255,255,255,0.2)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "800" }}>3</div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.05em" }}>Định dạng & Xuất file</h3>
          </div>

          <div style={{ display: "flex", gap: "8px", background: "rgba(0,0,0,0.2)", padding: "4px", borderRadius: "12px" }}>
            {[
              { id: "xlsx", label: "Excel (.xlsx)", icon: <FileSpreadsheet size={16} /> },
              { id: "pdf", label: "PDF (.pdf)", icon: <FileDown size={16} /> },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setExportFormat(opt.id)}
                style={{
                  padding: "10px 20px", borderRadius: "10px", border: "none",
                  background: exportFormat === opt.id ? "white" : "transparent",
                  color: exportFormat === opt.id ? "#1e293b" : "#94a3b8",
                  fontWeight: "700", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
                  transition: "all 0.2s"
                }}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => onDownload(currentTemplate, exportFormat, selectedFields)}
          disabled={!selectedId || refreshing || (currentTemplate.fields && selectedFields.length === 0)}
          style={{
            padding: "16px 48px", borderRadius: "16px", border: "none",
            background: "#3b82f6", color: "white", fontWeight: "800", fontSize: "15px",
            cursor: "pointer", display: "flex", alignItems: "center", gap: "12px",
            boxShadow: "0 10px 15px -3px rgba(59, 130, 246, 0.3)", transition: "all 0.2s"
          }}
        >
          {refreshing ? <RefreshCw size={20} style={{ animation: "spin 2s linear infinite" }} /> : <Download size={20} />}
          Xuất dữ liệu ngay
        </button>
      </div>
    </div>
  );
};
