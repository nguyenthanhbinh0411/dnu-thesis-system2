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
  Sparkles,
  Shield,
  History,
  Bell,
  BellRing,
  Send,
  RotateCcw,
  XCircle,
  AlertOctagon,
} from "lucide-react";
import { fetchData, normalizeUrl, FetchDataError } from "../../api/fetchData";
import { getActiveDefensePeriodId, setActiveDefensePeriodId } from "../../utils/defensePeriod";
import { useToast } from "../../context/useToast";
import type { ApiResponse } from "../../types/api";
import { readEnvelopeData, readEnvelopeSuccess } from "../../utils/api-envelope";
import { useAuth } from "../../hooks/useAuth";
import DefenseTermStudentsSection, { type DefenseTermStudentsSectionHandle } from "../../components/admin/DefenseTermStudentsSection";
import DefenseTermLecturersSection, { type DefenseTermLecturersSectionHandle } from "../../components/admin/DefenseTermLecturersSection";

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
  configJson?: string;
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
  Registration: { label: "Đăng ký & Phân công", color: "#0ea5e9", bg: "#f0f9ff", icon: <FileDown size={14} /> },
  Assignment: { label: "Đăng ký & Phân công", color: "#6366f1", bg: "#eef2ff", icon: <Users size={14} /> },
  ProgressTracking: { label: "Theo dõi tiến độ", color: "#f59e0b", bg: "#fffbeb", icon: <Activity size={14} /> },
  CommitteePreparation: { label: "Phân công hội đồng", color: "#8b5cf6", bg: "#f5f3ff", icon: <Settings size={14} /> },
  Running: { label: "Bảo vệ", color: "#166534", bg: "#dcfce7", icon: <Play size={14} /> },
  Paused: { label: "Tạm dừng", color: "#92400e", bg: "#fef3c7", icon: <Pause size={14} /> },
  ScoringLocked: { label: "Khóa điểm", color: "#991b1b", bg: "#fee2e2", icon: <Lock size={14} /> },
  Finalization: { label: "Hậu bảo vệ", color: "#3730a3", bg: "#e0e7ff", icon: <CheckCircle size={14} /> },
  Finalized: { label: "Hậu bảo vệ", color: "#3730a3", bg: "#e0e7ff", icon: <CheckCircle size={14} /> },
  Published: { label: "Công bố", color: "#15803d", bg: "#f0fdf4", icon: <Zap size={14} /> },
  Closed: { label: "Đóng & Lưu trữ", color: "#1e293b", bg: "#f8fafc", icon: <Archive size={14} /> },
  Archived: { label: "Đóng & Lưu trữ", color: "#475569", bg: "#f1f5f9", icon: <Archive size={14} /> },
};

const getStageNote = (status: string) => {
  const s = String(status ?? "").trim().toLowerCase();
  if (s === "draft") {
    return "Cần thêm danh sách sinh viên, giảng viên vào đợt.";
  }
  if (s === "registration" || s === "assignment") {
    return "Cho phép sinh viên đăng ký đề tài và Phân công giảng viên hướng dẫn (bắt buộc) khi không chọn đề tài.";
  }
  if (s === "progresstracking") {
    return "Theo dõi sinh viên - giảng viên về tiến độ của từng sinh viên.";
  }
  if (s === "committeepreparation") {
    return "Tạo hội đồng, xếp lịch và gửi thông báo cho sinh viên và thành viên hội đồng.";
  }
  if (s === "running" || s === "paused") {
    return "Điều hành chấm điểm.";
  }
  if (["scoringlocked", "finalization", "finalized", "published"].includes(s)) {
    return "Đảm bảo hậu bảo vệ thành công.";
  }
  if (s === "closed" || s === "archived") {
    return "Đợt đã hoàn thành và lưu trữ thành công.";
  }
  return "";
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
  lifecycle: (id: number, action: string, idempotencyKey?: string, extra?: Record<string, any>) =>
    fetchData<ApiResponse<boolean>>(`/defense-periods/${id}/lifecycle`, {
      method: "POST",
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
      body: JSON.stringify({ action, idempotencyKey, ...extra })
    }),
  rollbackStage: (id: number, reason: string, idempotencyKey?: string) =>
    fetchData<ApiResponse<boolean>>(`/defense-periods/${id}/lifecycle`, {
      method: "POST",
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
      body: JSON.stringify({
        action: "ROLLBACK",
        rollbackTarget: "STAGE",
        rollbackReason: reason,
        idempotencyKey
      })
    }),
  sendReminder: (id: number, payload: { recipientUserCodes: string[]; message: string; stage: string; notifTitle: string }) =>
    fetchData<ApiResponse<any>>(`/defense-periods/${id}/send-reminder`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  snapshot: (id: number) => fetchData<ApiResponse<any>>(`/defense-periods/${id}/management/snapshot`, { method: "GET" }),
  monitoring: (id: number) => fetchData<ApiResponse<any>>(`/defense-periods/${id}/monitoring/snapshot`, { method: "GET" }),
  export: (id: number, reportType: string, format: string = "xlsx", councilId?: number, fields?: string[]) => {
    const isSpecial = ["students", "lecturers", "assigned-topics", "lecturers-grouped-students"].includes(reportType);
    let baseUrl = "";

    if (isSpecial) {
      baseUrl = `/defense-periods/${id}/exports/${reportType}`;
    } else {
      baseUrl = `/defense-periods/${id}/reports/export`;
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
  { key: "UserCode", label: "Mã user", category: "Thông tin cơ bản" },
  { key: "FullName", label: "Họ và tên", category: "Thông tin cơ bản" },
  { key: "Gender", label: "Giới tính", category: "Thông tin cơ bản" },
  { key: "DateOfBirth", label: "Ngày sinh", category: "Thông tin cơ bản" },
  { key: "FacultyCode", label: "Khoa viện", category: "Đơn vị" },
  { key: "DepartmentCode", label: "Khoa", category: "Đơn vị" },
  { key: "ClassCode", label: "Lớp", category: "Đơn vị" },
  { key: "EnrollmentYear", label: "Khóa học", category: "Tiến độ" },
  { key: "GraduationYear", label: "Năm tốt nghiệp", category: "Tiến độ" },
  { key: "GPA", label: "Điểm TB", category: "Kết quả" },
  { key: "AcademicStanding", label: "Xếp loại", category: "Kết quả" },
  { key: "ParticipationStatus", label: "Trạng thái tham gia", category: "Trạng thái" },
  { key: "StudentEmail", label: "Email", category: "Liên lạc" },
  { key: "PhoneNumber", label: "Số điện thoại", category: "Liên lạc" },
  { key: "Address", label: "Địa chỉ", category: "Liên lạc" },
  { key: "Status", label: "Trạng thái hồ sơ", category: "Trạng thái" },
  { key: "Notes", label: "Ghi chú", category: "Khác" },
];

const LECTURER_FIELDS = [
  { key: "LecturerCode", label: "Mã giảng viên", category: "Thông tin cơ bản" },
  { key: "UserCode", label: "Mã user", category: "Thông tin cơ bản" },
  { key: "FullName", label: "Họ và tên", category: "Thông tin cơ bản" },
  { key: "Degree", label: "Học hàm/Học vị", category: "Thông tin cơ bản" },
  { key: "Gender", label: "Giới tính", category: "Thông tin cơ bản" },
  { key: "DepartmentCode", label: "Khoa", category: "Đơn vị" },
  { key: "Organization", label: "Cơ quan công tác", category: "Đơn vị" },
  { key: "Email", label: "Email", category: "Liên lạc" },
  { key: "PhoneNumber", label: "Số điện thoại", category: "Liên lạc" },
  { key: "GuideQuota", label: "Định mức hướng dẫn", category: "Hạn ngạch" },
  { key: "DefenseQuota", label: "Định mức bảo vệ", category: "Hạn ngạch" },
  { key: "CurrentGuidingCount", label: "Đang hướng dẫn", category: "Hạn ngạch" },
  { key: "RemainingGuideQuota", label: "Hạn ngạch còn lại", category: "Hạn ngạch" },
  { key: "Specialties", label: "Chuyên môn", category: "Thông tin cơ bản" },
  { key: "ProfileImage", label: "Ảnh hồ sơ", category: "Khác" },
  { key: "Address", label: "Địa chỉ", category: "Liên lạc" },
  { key: "Notes", label: "Ghi chú", category: "Khác" },
];

const TOPIC_FIELDS = [
  { key: "TopicCode", label: "Mã đề tài", category: "Thông tin đề tài" },
  { key: "CatalogTopicCode", label: "Mã danh mục", category: "Thông tin đề tài" },
  { key: "Title", label: "Tên đề tài", category: "Thông tin đề tài" },
  { key: "Type", label: "Loại đề tài", category: "Thông tin đề tài" },
  { key: "Summary", label: "Tóm tắt", category: "Thông tin đề tài" },
  { key: "ProposerStudentCode", label: "Mã sinh viên", category: "Sinh viên" },
  { key: "ProposerUserCode", label: "Mã user sinh viên", category: "Sinh viên" },
  { key: "ProposerName", label: "Sinh viên thực hiện", category: "Sinh viên" },
  { key: "SupervisorLecturerCode", label: "Mã giảng viên HD", category: "Giảng viên" },
  { key: "SupervisorUserCode", label: "Mã user giảng viên", category: "Giảng viên" },
  { key: "SupervisorName", label: "Giảng viên hướng dẫn", category: "Giảng viên" },
  { key: "DepartmentCode", label: "Khoa quản lý", category: "Quản lý" },
  { key: "LecturerComment", label: "Nhận xét giảng viên", category: "Quản lý" },
  { key: "ResubmitCount", label: "Số lần nộp lại", category: "Tiến độ" },
  { key: "NumChapters", label: "Số chương", category: "Cấu trúc" },
  { key: "NumPages", label: "Số trang", category: "Cấu trúc" },
  { key: "NumTables", label: "Số bảng", category: "Cấu trúc" },
  { key: "NumFigures", label: "Số hình", category: "Cấu trúc" },
  { key: "NumReferences", label: "Tài liệu tham khảo", category: "Cấu trúc" },
  { key: "NumVietnameseReferences", label: "Tài liệu tiếng Việt", category: "Cấu trúc" },
  { key: "NumForeignReferences", label: "Tài liệu tiếng Anh", category: "Cấu trúc" },
  { key: "TopicTags", label: "Tag đề tài", category: "Phân loại" },
  { key: "Score", label: "Điểm số", category: "Kết quả" },
  { key: "Status", label: "Trạng thái", category: "Trạng thái" },
];

const GROUPED_LECTURER_FIELDS = [
  { key: "TopicCode", label: "Mã đề tài", category: "Thông tin đề tài" },
  { key: "Title", label: "Tên đề tài", category: "Thông tin đề tài" },
  { key: "Type", label: "Loại đề tài", category: "Thông tin đề tài" },
  { key: "TopicTags", label: "Tag đề tài", category: "Phân loại" },
  { key: "ProposerStudentCode", label: "Mã SV", category: "Sinh viên" },
  { key: "ProposerName", label: "Sinh viên thực hiện", category: "Sinh viên" },
  { key: "DepartmentCode", label: "Khoa", category: "Quản lý" },
  { key: "LecturerComment", label: "Nhận xét giảng viên", category: "Quản lý" },
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
  { key: "lecturers-grouped-students", label: "Danh sách hướng dẫn gộp theo giảng viên", desc: "Báo cáo danh sách sinh viên theo từng giảng viên hướng dẫn, có gộp cột giảng viên.", icon: <LayoutDashboard size={20} />, type: "modular", fields: GROUPED_LECTURER_FIELDS },
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
  if (s === "soạn thảo" || s === "nháp") return "Draft";
  if (s === "đăng ký đề tài" || s === "đăng ký") return "Registration";
  if (s === "phân công") return "Assignment";
  if (s === "theo dõi tiến độ" || s === "tiến độ") return "ProgressTracking";
  if (s === "chuẩn bị hội đồng" || s === "hội đồng") return "CommitteePreparation";
  if (s === "đang bảo vệ" || s === "đang diễn ra" || s === "bảo vệ" || s === "đang chạy") return "Running";
  if (s === "tạm dừng") return "Paused";
  if (s === "khóa điểm") return "ScoringLocked";
  if (s === "tổng kết" || s === "hậu bảo vệ" || s === "hoàn tất") return "Finalization";
  if (s === "đã tổng kết") return "Finalized";
  if (s === "công bố" || s === "đã công bố") return "Published";
  if (s === "đã đóng" || s === "kết thúc" || s === "đóng") return "Closed";
  if (s === "lưu trữ" || s === "đóng & lưu trữ") return "Archived";

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

const getNextStatus = (status?: DefenseTermStatus): DefenseTermStatus => {
  if (!status) return "Draft";
  switch (status) {
    case "Draft": return "Registration";
    case "Registration": return "ProgressTracking";
    case "Assignment": return "ProgressTracking";
    case "ProgressTracking": return "CommitteePreparation";
    case "CommitteePreparation": return "Running";
    case "Running": return "Finalization";
    case "Paused": return "Running";
    case "Finalization": return "Archived";
    case "Finalized": return "Archived";
    // Legacy support cases:
    case "ScoringLocked": return "Finalization";
    case "Published": return "Archived";
    case "Closed": return "Archived";
    default: return "Archived";
  }
};

const getNextActionLabel = (status?: DefenseTermStatus): string => {
  if (!status) return "Tiếp tục quy trình";
  switch (status) {
    case "Draft": return "Mở đăng ký & Phân công";
    case "Registration": return "Theo dõi tiến độ";
    case "Assignment": return "Theo dõi tiến độ";
    case "ProgressTracking": return "Chuẩn bị hội đồng";
    case "CommitteePreparation": return "Bắt đầu bảo vệ";
    case "Running": return "Chốt & Tổng kết đợt";
    case "Paused": return "Tiếp tục đợt";
    case "Finalization": return "Đóng & Lưu trữ";
    case "Finalized": return "Đóng & Lưu trữ";
    // Legacy support cases:
    case "ScoringLocked": return "Tổng kết đợt";
    case "Published": return "Đóng & Lưu trữ";
    case "Closed": return "Đóng & Lưu trữ";
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

// --- Send Reminder Modal ---
const SendReminderModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSend: (selectedUserCodes: string[], message: string) => void;
  isSending: boolean;
  recipients: { userCode: string; name: string; role: "student" | "lecturer"; topicTitle: string }[];
  stageName: string;
  reminderSentCount: number;
}> = ({ isOpen, onClose, onSend, isSending, recipients, stageName, reminderSentCount }) => {
  const [selectedCodes, setSelectedCodes] = useState<string[]>(recipients.map(r => r.userCode));
  const [message, setMessage] = useState(
    `Kính gửi,\n\nĐợt đồ án tốt nghiệp hiện đang ở giai đoạn "${stageName}". Hệ thống ghi nhận đề tài của bạn chưa được cập nhật phù hợp với giai đoạn hiện tại.\n\nVui lòng truy cập hệ thống để kiểm tra và cập nhật trạng thái đề tài trong thời gian sớm nhất.\n\nTrân trọng,\nBộ phận Quản lý Đào tạo`
  );

  useEffect(() => {
    if (isOpen) {
      setSelectedCodes(recipients.map(r => r.userCode));
      setMessage(
        `Kính gửi,\n\nĐợt đồ án tốt nghiệp hiện đang ở giai đoạn "${stageName}". Hệ thống ghi nhận đề tài của bạn chưa được cập nhật phù hợp với giai đoạn hiện tại.\n\nVui lòng truy cập hệ thống để kiểm tra và cập nhật trạng thái đề tài trong thời gian sớm nhất.\n\nTrân trọng,\nBộ phận Quản lý Đào tạo`
      );
    }
  }, [isOpen, recipients, stageName]);

  if (!isOpen) return null;

  const toggleCode = (code: string) => {
    setSelectedCodes(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };

  const students = recipients.filter(r => r.role === "student");
  const lecturers = recipients.filter(r => r.role === "lecturer");

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10001, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}>
      <div style={{ background: "white", width: "90%", maxWidth: "680px", borderRadius: "24px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "24px 28px 0 28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <div style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", color: "white", padding: "10px", borderRadius: "12px", display: "flex" }}>
              <BellRing size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "900", color: "#1e293b" }}>Gửi thông báo nhắc nhở</h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                Nhắc nhở sinh viên/giảng viên cập nhật trạng thái đề tài — Giai đoạn: <strong style={{ color: "#1e3a5f" }}>{stageName}</strong>
              </p>
            </div>
          </div>
          {reminderSentCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "10px", marginTop: "12px" }}>
              <CheckCircle size={16} color="#16a34a" />
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#15803d" }}>Đã gửi {reminderSentCount} thông báo trong lần trước.</span>
            </div>
          )}
        </div>

        {/* Recipient List */}
        <div style={{ padding: "20px 28px", flex: 1, overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#374151" }}>Danh sách người nhận ({recipients.length} người)</h4>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setSelectedCodes(recipients.map(r => r.userCode))} style={{ background: "none", border: "none", color: "#3b82f6", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>Chọn tất cả</button>
              <button onClick={() => setSelectedCodes([])} style={{ background: "none", border: "none", color: "#ef4444", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>Bỏ chọn</button>
            </div>
          </div>

          {students.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", fontWeight: "800", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Users size={12} /> Sinh viên ({students.length})
              </div>
              <div style={{ display: "grid", gap: "6px" }}>
                {students.map(r => (
                  <label key={r.userCode} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "10px", background: selectedCodes.includes(r.userCode) ? "#eff6ff" : "#f8fafc", border: `1px solid ${selectedCodes.includes(r.userCode) ? "#3b82f6" : "#e2e8f0"}`, cursor: "pointer" }}>
                    <input type="checkbox" checked={selectedCodes.includes(r.userCode)} onChange={() => toggleCode(r.userCode)} style={{ width: "16px", height: "16px", accentColor: "#3b82f6" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: "#1e293b" }}>{r.name}</div>
                      <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>Đề tài: {r.topicTitle}</div>
                    </div>
                    <span style={{ fontSize: "10px", background: "#dbeafe", color: "#1d4ed8", padding: "2px 8px", borderRadius: "99px", fontWeight: "700" }}>SV</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {lecturers.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", fontWeight: "800", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                <UserCheck size={12} /> Giảng viên hướng dẫn ({lecturers.length})
              </div>
              <div style={{ display: "grid", gap: "6px" }}>
                {lecturers.map(r => (
                  <label key={r.userCode} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "10px", background: selectedCodes.includes(r.userCode) ? "#fdf4ff" : "#f8fafc", border: `1px solid ${selectedCodes.includes(r.userCode) ? "#a855f7" : "#e2e8f0"}`, cursor: "pointer" }}>
                    <input type="checkbox" checked={selectedCodes.includes(r.userCode)} onChange={() => toggleCode(r.userCode)} style={{ width: "16px", height: "16px", accentColor: "#a855f7" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: "#1e293b" }}>{r.name}</div>
                      <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>Liên quan đề tài: {r.topicTitle}</div>
                    </div>
                    <span style={{ fontSize: "10px", background: "#f3e8ff", color: "#7c3aed", padding: "2px 8px", borderRadius: "99px", fontWeight: "700" }}>GV</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Message editor */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#374151", marginBottom: "8px" }}>Nội dung thông báo</label>
            <textarea
              rows={6}
              value={message}
              onChange={e => setMessage(e.target.value)}
              style={{ width: "100%", padding: "12px", border: "1px solid #cbd5e1", borderRadius: "10px", fontSize: "13px", color: "#1e293b", resize: "vertical", outline: "none", lineHeight: "1.6", fontFamily: "inherit" }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 28px 24px 28px", borderTop: "1px solid #f1f5f9", display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button onClick={onClose} disabled={isSending} style={{ padding: "10px 20px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "white", fontWeight: "700", fontSize: "14px", cursor: "pointer", color: "#475569" }}>Đóng</button>
          <button
            onClick={() => onSend(selectedCodes, message)}
            disabled={isSending || selectedCodes.length === 0}
            style={{ padding: "10px 24px", borderRadius: "10px", border: "none", background: selectedCodes.length === 0 ? "#cbd5e1" : "linear-gradient(135deg, #3b82f6, #1d4ed8)", color: "white", fontWeight: "700", fontSize: "14px", cursor: selectedCodes.length === 0 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px" }}
          >
            {isSending ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
            {isSending ? "Đang gửi..." : `Gửi đến ${selectedCodes.length} người`}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Stale Topics Warning Banner ---
const StaleTopicsWarningBanner: React.FC<{
  errorCount: number;
  nextStageLabel: string;
  onViewDetails: () => void;
  onSendReminder: () => void;
  reminderSentCount: number;
  compact?: boolean;
}> = ({ errorCount, nextStageLabel, onViewDetails, onSendReminder, reminderSentCount, compact = false }) => {
  if (errorCount === 0) return null;

  const isDanger = errorCount >= 4;
  const colors = isDanger
    ? { bg: "linear-gradient(135deg, #fef2f2, #fff5f5)", border: "#fca5a5", icon: "#dc2626", iconBg: "#fee2e2", text: "#991b1b", subtext: "#b91c1c", btnBg: "#dc2626", badgeBg: "#fee2e2", badgeText: "#991b1b" }
    : { bg: "linear-gradient(135deg, #fff7ed, #fffbeb)", border: "#fed7aa", icon: "#d97706", iconBg: "#fef3c7", text: "#92400e", subtext: "#b45309", btnBg: "#d97706", badgeBg: "#fef3c7", badgeText: "#92400e" };

  return (
    <div style={{
      background: colors.bg,
      border: `1.5px solid ${colors.border}`,
      borderRadius: compact ? "12px" : "16px",
      padding: compact ? "14px 16px" : "18px 22px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "16px",
      flexWrap: "wrap",
      boxShadow: `0 4px 12px ${isDanger ? "rgba(220,38,38,0.08)" : "rgba(245,158,11,0.08)"}`,
      animation: "fadeIn 0.4s ease"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, minWidth: 0 }}>
        <div style={{ background: colors.iconBg, padding: compact ? "8px" : "10px", borderRadius: "10px", color: colors.icon, display: "flex", flexShrink: 0 }}>
          {isDanger ? <AlertOctagon size={compact ? 18 : 22} /> : <AlertTriangle size={compact ? 18 : 22} />}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: compact ? "13px" : "14px", fontWeight: "800", color: colors.text, display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {isDanger ? "⚠️ Cảnh báo nghiêm trọng" : "⚡ Cảnh báo điều kiện giai đoạn"}
            <span style={{ background: colors.badgeBg, color: colors.badgeText, fontSize: "11px", fontWeight: "800", padding: "2px 8px", borderRadius: "99px", border: `1px solid ${colors.border}` }}>
              {errorCount} đề tài
            </span>
            {reminderSentCount > 0 && (
              <span style={{ background: "#dcfce7", color: "#16a34a", fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "99px" }}>
                ✓ Đã nhắc {reminderSentCount} lần
              </span>
            )}
          </div>
          <div style={{ fontSize: compact ? "11px" : "12px", color: colors.subtext, marginTop: "3px" }}>
            {errorCount} đề tài chưa đủ điều kiện chuyển sang <strong>{nextStageLabel}</strong>. Đợt có thể vẫn được chuyển nhưng cần xác nhận.
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
        <button
          onClick={onSendReminder}
          style={{ background: "white", border: `1px solid ${colors.border}`, color: colors.text, borderRadius: "8px", padding: compact ? "6px 12px" : "8px 14px", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
        >
          <Bell size={13} /> Gửi nhắc nhở
        </button>
        <button
          onClick={onViewDetails}
          style={{ background: colors.btnBg, color: "white", border: "none", borderRadius: "8px", padding: compact ? "6px 12px" : "8px 14px", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", boxShadow: `0 2px 4px ${isDanger ? "rgba(220,38,38,0.2)" : "rgba(217,119,6,0.2)"}` }}
        >
          <Eye size={13} /> Xem danh sách
        </button>
      </div>
    </div>
  );
};

const generateRandomTermCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `DT-${result}`;
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
        termCode: generateRandomTermCode(),
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
                disabled={true}
                placeholder="Tự động sinh mã đợt"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  background: "#f1f5f9",
                  cursor: "not-allowed",
                  color: DEEP_BLUE_PRIMARY,
                  fontWeight: "700"
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
  const selectedIdRef = useRef<number | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
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
  const [ineligibleModal, setIneligibleModal] = useState<{
    isOpen: boolean;
    currentStatus: DefenseTermStatus;
    errors: { studentName: string; studentCode: string; supervisorName: string; topicTitle: string; reason: string }[];
  } | null>(null);

  // Reminder modal state
  const [sendReminderModal, setSendReminderModal] = useState<{
    isOpen: boolean;
    recipients: { userCode: string; name: string; role: "student" | "lecturer"; topicTitle: string }[];
    stage: string;
  } | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [hasRolledBackThisSession, setHasRolledBackThisSession] = useState(false);
  const [reminderSentCount, setReminderSentCount] = useState(0);

  const studentSectionRef = useRef<DefenseTermStudentsSectionHandle>(null);
  const lecturerSectionRef = useRef<DefenseTermLecturersSectionHandle>(null);

  const userRole = (auth.user?.role || "").toUpperCase();
  const canManage = userRole === "ADMIN" || userRole === "STUDENTSERVICE" || userRole === "HEAD";

  const selectedRow = useMemo(() => rows.find(r => r.defenseTermId === selectedId), [rows, selectedId]);
  const hasUnfinishedPeriod = useMemo(() => rows.some(r => r.status !== "Closed" && r.status !== "Archived"), [rows]);

  const parsedConfig = useMemo(() => {
    if (!selectedRow?.configJson) return null;
    try {
      return JSON.parse(selectedRow.configJson);
    } catch (e) {
      return null;
    }
  }, [selectedRow?.configJson]);

  const councilListLocked = parsedConfig?.councilListLocked === true || parsedConfig?.CouncilListLocked === true;
  const scoredTopics = asNumber(monitoring?.pipeline?.scoredTopics);
  const totalTopics = asNumber(monitoring?.pipeline?.totalTopics);
  const hasAnyScoredTopics = scoredTopics > 0;
  const isScoringComplete = totalTopics > 0 && scoredTopics >= totalTopics;
  const canRollbackStage = parsedConfig?.canRollbackStage === true || parsedConfig?.CanRollbackStage === true;

  const stats = useMemo(() => monitoring?.analytics?.overview || {}, [monitoring]);
  const pipeline = useMemo(() => monitoring?.pipeline || {}, [monitoring]);
  const overviewSnapshot = useMemo(() => snapshot?.analytics?.overview ?? snapshot?.overview ?? snapshot ?? {}, [snapshot]);
  const totalStudents = useMemo(() => readCount(stats, ["totalStudents", "studentCount", "totalStudentCount"], readCount(overviewSnapshot, ["totalStudents", "studentCount", "totalStudentCount"], readArrayCount(snapshot, ["students", "studentList", "studentRows", "studentItems", "members", "items"]))), [stats, overviewSnapshot, snapshot]);
  const totalLecturers = useMemo(() => readCount(stats, ["totalLecturers", "lecturerCount", "totalLecturerCount"], readCount(overviewSnapshot, ["totalLecturers", "lecturerCount", "totalLecturerCount"], readArrayCount(snapshot, ["lecturers", "lecturerList", "lecturerRows", "lecturerItems", "members", "items"]))), [stats, overviewSnapshot, snapshot]);

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
      
      const currentSelectedId = selectedIdRef.current;
      const currentExists = currentSelectedId ? data.find(r => r.defenseTermId === currentSelectedId) : null;
      
      if (currentExists) {
        // Keep currently selected period (manual selection)
      } else {
        // Auto select the active (unfinished) period if it exists.
        const unfinished = data.find((r: DefensePeriod) => r.status !== "Closed" && r.status !== "Archived");
        if (unfinished) {
          setSelectedId(unfinished.defenseTermId);
          setActiveDefensePeriodId(unfinished.defenseTermId);
          window.dispatchEvent(new Event("storage"));
        } else {
          setSelectedId(null);
          setActiveDefensePeriodId(null);
          window.dispatchEvent(new Event("storage"));
        }
      }
    } catch (err: any) {
      const errMsg = err.data?.message || err.data?.Message || err.message || "Không thể tải danh sách đợt đồ án tốt nghiệp.";
      addToast(errMsg, "error");
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [addToast]);

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
    } catch (err: any) {
      const errMsg = err.data?.message || err.data?.Message || err.message || "Không thể tải lộ trình.";
      addToast(errMsg, "error");
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
    } catch (err: any) {
      const errMsg = err.data?.message || err.data?.Message || err.message || "Lỗi hệ thống khi cập nhật lộ trình.";
      addToast(errMsg, "error");
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

  const validatePhaseTransition = useCallback((currentStatus: DefenseTermStatus): { studentName: string; studentCode: string; supervisorName: string; topicTitle: string; reason: string }[] => {
    const errors: { studentName: string; studentCode: string; supervisorName: string; topicTitle: string; reason: string }[] = [];
    const matrix = snapshot?.scoringMatrix ?? [];

    if (currentStatus === "Registration") {
      matrix.forEach((row: any) => {
        const tStatus = String(row.status ?? "").toLowerCase().trim();
        const hasNoTopic = !row.topicTitle || row.topicTitle === "-" || row.topicTitle.trim() === "" || tStatus === "";
        const isNotApproved = tStatus === "draft" || tStatus === "pending" || tStatus === "requested" || tStatus === "reviewing";
        if (hasNoTopic) {
          errors.push({
            studentName: row.studentName ?? "Sinh viên chưa rõ",
            studentCode: row.studentCode ?? "-",
            supervisorName: "Chưa gán",
            topicTitle: "Chưa đăng ký đề tài",
            reason: "Sinh viên chưa có đề tài trong đợt.",
          });
        } else if (isNotApproved) {
          errors.push({
            studentName: row.studentName ?? "Sinh viên chưa rõ",
            studentCode: row.studentCode ?? "-",
            supervisorName: row.supervisorLecturerName ?? row.supervisorName ?? "Chưa gán",
            topicTitle: row.topicTitle ?? "Đề tài chưa được duyệt tên",
            reason: `Đề tài ở trạng thái "${row.status ?? "Nháp/Chờ duyệt"}" chưa được duyệt.`,
          });
        }
      });
    } else if (currentStatus === "Assignment") {
      matrix.forEach((row: any) => {
        const svName = row.supervisorLecturerName ?? row.supervisorName;
        if (!svName || svName === "-" || svName.trim() === "") {
          errors.push({
            studentName: row.studentName ?? "Sinh viên chưa rõ",
            studentCode: row.studentCode ?? "-",
            supervisorName: "Chưa gán",
            topicTitle: row.topicTitle ?? "Đề tài chưa gán",
            reason: "Chưa gán Giảng viên hướng dẫn.",
          });
        }
      });
    } else if (currentStatus === "ProgressTracking") {
      matrix.forEach((row: any) => {
        const submitted = Number(row.submittedCount ?? 0);
        const required = Number(row.requiredCount ?? 0);
        if (required > 0 && submitted < required) {
          errors.push({
            studentName: row.studentName ?? "Sinh viên chưa rõ",
            studentCode: row.studentCode ?? "-",
            supervisorName: row.supervisorLecturerName ?? row.supervisorName ?? "Chưa gán",
            topicTitle: row.topicTitle ?? "Đề tài chưa nộp báo cáo",
            reason: `Chưa nộp đủ báo cáo tiến độ (${submitted}/${required}).`,
          });
        }
      });
    } else if (currentStatus === "CommitteePreparation") {
      matrix.forEach((row: any) => {
        const commCode = row.committeeCode;
        if (!commCode || commCode === "-" || commCode.trim() === "") {
          errors.push({
            studentName: row.studentName ?? "Sinh viên chưa rõ",
            studentCode: row.studentCode ?? "-",
            supervisorName: row.supervisorLecturerName ?? row.supervisorName ?? "Chưa gán",
            topicTitle: row.topicTitle ?? "Đề tài chưa xếp hội đồng",
            reason: "Chưa được gán vào Hội đồng bảo vệ.",
          });
        }
      });
    } else if (currentStatus === "Running") {
      matrix.forEach((row: any) => {
        if (!row.isLocked) {
          errors.push({
            studentName: row.studentName ?? "Sinh viên chưa rõ",
            studentCode: row.studentCode ?? "-",
            supervisorName: row.supervisorLecturerName ?? row.supervisorName ?? "Chưa gán",
            topicTitle: row.topicTitle ?? "Hội đồng chưa chốt điểm",
            reason: "Hội đồng chưa khóa điểm bảo vệ.",
          });
        }
      });
    }

    return errors;
  }, [snapshot]);

  const currentTransitionErrors = useMemo(() => {
    const currentStatus = selectedRow?.status || "Draft";
    return validatePhaseTransition(currentStatus);
  }, [selectedRow?.status, validatePhaseTransition]);

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

  const handleAction = async (action: string, bypassValidation = false) => {
    if (!selectedId) return;

    const currentStatus = selectedRow?.status || "Draft";
    const nextAction = getNextActionLabel(currentStatus);

    // Business Logic Validations
    if (action === "NEXT") {
      if (!bypassValidation) {
        const transitionErrors = validatePhaseTransition(currentStatus);
        if (transitionErrors.length > 0) {
          setIneligibleModal({
            isOpen: true,
            currentStatus,
            errors: transitionErrors
          });
          addToast(`Có ${transitionErrors.length} đề tài chưa đủ điều kiện chuyển giai đoạn. Vui lòng kiểm tra chi tiết trước khi quyết định bỏ qua.`, "warning");
          return;
        }
      }

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
      if (!isScoringComplete || scoringPercent < 100) {
        addToast(
          `Chưa thể tổng kết đợt. Cần chốt điểm toàn bộ đề tài trước khi chuyển sang giai đoạn hậu bảo vệ và kết thúc đợt. Hiện mới đạt ${scoringPercent}% (${scoredTopics}/${totalTopics}).`,
          "warning",
        );
        return;
      }
    }

    if (action === "ARCHIVE" || action === "CLOSE") {
      if (currentStatus !== "Finalization" && currentStatus !== "Finalized" && currentStatus !== "Published" && currentStatus !== "Closed") {
        addToast("Đợt đồ án phải được Tổng kết trước khi Đóng & Lưu trữ.", "warning");
        return;
      }
    }

    if (action === "ROLLBACK_STAGE") {
      // Check if already rolled back in this session or if backend says not allowed
      if (hasRolledBackThisSession || !canRollbackStage || councilListLocked || hasAnyScoredTopics) {
        addToast(
          councilListLocked || hasAnyScoredTopics
            ? "Không thể quay lại giai đoạn trước khi đã chốt danh sách hội đồng hoặc đã có điểm cho bất kỳ hội đồng nào."
            : "Rollback chỉ được phép thực hiện tối đa 1 lần cho mỗi giai đoạn. Lần rollback đã được sử dụng.",
          "warning",
        );
        return;
      }
      setConfirmState({
        isOpen: true,
        action,
        title: "Xác nhận quay lại giai đoạn trước",
        message: `Bạn có chắc chắn muốn quay lại trạng thái trước của đợt "${selectedRow?.name}"? Lưu ý: Hệ thống chỉ cho phép quay lại tối đa 1 lần. Sau khi rollback, tính năng này sẽ bị vô hiệu hóa cho đến lần chuyển giai đoạn tiếp theo.`,
        type: "warning"
      });
      return;
    }

    const actionLabel = action === "NEXT"
      ? nextAction
      : action === "CLOSE"
        ? "Đóng đợt"
        : action === "ARCHIVE"
          ? "Đóng & Lưu trữ"
          : action === "PAUSE"
            ? "Tạm dừng đợt"
            : action === "RESUME"
              ? "Tiếp tục đợt"
              : action === "SYNC"
                ? "Đồng bộ dữ liệu"
                : action === "LOCK_SCORING"
                  ? "Khóa chấm điểm"
                  : action;

    setConfirmState({
      isOpen: true,
      action,
      title: `Xác nhận điều hành: ${actionLabel}`,
      message: (action === "NEXT" && currentStatus === "Draft")
        ? `Bạn có chắc chắn muốn bắt đầu giai đoạn Đăng ký & Phân công cho đợt này? Hệ thống ghi nhận có ${totalStudents} sinh viên và ${totalLecturers} giảng viên tham gia đợt.`
        : `Hệ thống sẽ thực hiện lệnh "${actionLabel}" cho đợt "${selectedRow?.name}". Hành động này sẽ chuyển trạng thái quy trình và cập nhật quyền hạn truy cập của sinh viên, giảng viên.`,
      type: action === "FINALIZE" || action === "CLOSE" || action === "ARCHIVE" ? "warning" : "info"
    });
  };

  const executeAction = async () => {
    if (!selectedId || !confirmState) return;
    const { action } = confirmState;
    if (action === "CLOSE_MODAL") {
      setConfirmState(null);
      return;
    }

    setRefreshing(true);
    let shouldClearConfirm = true;
    try {
      const idempotencyKey = safeRandomUUID();
      let res;
      if (action === "ROLLBACK_STAGE") {
        const reason = window.prompt("Vui lòng nhập lý do quay lại bước trước:", "Thao tác nhầm") || "Thao tác nhầm";
        res = await defensePeriodApi.rollbackStage(selectedId, reason, idempotencyKey);
      } else if (action === "NEXT_BYPASS") {
        res = await defensePeriodApi.lifecycle(selectedId, "NEXT", idempotencyKey, { bypassProgressCheck: true });
      } else {
        res = await defensePeriodApi.lifecycle(selectedId, action, idempotencyKey);
      }
      if (readEnvelopeSuccess(res)) {
        if (action === "ROLLBACK_STAGE") {
          addToast("Quay lại giai đoạn trước thành công. Lần rollback đã được sử dụng cho giai đoạn này.", "success");
          setHasRolledBackThisSession(true);
        } else if (action === "NEXT" || action === "NEXT_BYPASS") {
          // Reset rollback tracking when moving to next stage
          setHasRolledBackThisSession(false);
          setReminderSentCount(0);
          addToast("Chuyển giai đoạn thành công!", "success");
        } else if (action === "CLOSE") {
          addToast("Đóng đợt đồ án thành công!", "success");
        } else if (action === "ARCHIVE") {
          addToast("Đóng & Lưu trữ đợt đồ án thành công!", "success");
        } else if (action === "PAUSE") {
          addToast("Tạm dừng đợt đồ án thành công!", "success");
        } else if (action === "RESUME") {
          addToast("Tiếp tục đợt đồ án thành công!", "success");
        } else if (action === "LOCK_SCORING") {
          addToast("Khóa chấm điểm thành công!", "success");
        } else if (action === "SYNC") {
          addToast("Đồng bộ dữ liệu đợt đồ án thành công!", "success");
        }

        // Reset active period state if it was closed or archived
        if (action === "CLOSE" || action === "ARCHIVE") {
          if (getActiveDefensePeriodId() === selectedId) {
            setActiveDefensePeriodId(null);
            window.dispatchEvent(new Event("storage"));
          }
          setSelectedId(null);
        }

        await loadData(true);
        await loadSnapshots();
      } else {
        addToast(readEnvelopeData<string>(res) || "Thao tác thất bại.", "error");
      }
    } catch (err: any) {
      const errCode = err.data?.code ?? err.data?.Code;
      const errMsg = err.data?.message ?? err.data?.Message ?? err.message ?? "Lỗi hệ thống khi thực hiện lệnh.";

      if (errCode === "UC2.NEXT.STUDENTS_WITHOUT_TOPIC") {
        const studentCodes = err.data?.data?.studentsWithoutTopic ?? err.data?.Data?.StudentsWithoutTopic ?? [];
        const listStr = Array.isArray(studentCodes) && studentCodes.length > 0 ? studentCodes.join(", ") : "";
        setConfirmState({
          isOpen: true,
          action: "CLOSE_MODAL",
          title: "Thiếu đề tài sinh viên",
          message: `${errMsg} Danh sách mã sinh viên chưa có đề tài: ${listStr}`,
          type: "danger"
        });
        shouldClearConfirm = false;
        return;
      }

      if (errCode === "UC2.NEXT.INELIGIBLE_TOPICS") {
        setConfirmState({
          isOpen: true,
          action: "NEXT_BYPASS",
          title: "Xác nhận chuyển giai đoạn",
          message: "Một số đề tài chưa Đủ điều kiện bảo vệ (có đồ án vẫn chưa đủ điều kiện bảo vệ). Bạn có muốn tiếp tục chuyển sang giai đoạn chuẩn bị hội đồng?",
          type: "warning"
        });
        shouldClearConfirm = false;
        return;
      }

      if (err instanceof FetchDataError && err.status === 409 && action === "ARCHIVE") {
        const confirmForce = window.confirm("Đợt bảo vệ chưa công bố điểm. Bạn có muốn lưu trữ cưỡng bức (Force Archive) không?");
        if (confirmForce) {
          const reason = window.prompt("Vui lòng nhập lý do lưu trữ cưỡng bức:", "Đóng đợt đặc biệt");
          if (reason !== null) {
            try {
              const retryIdempotencyKey = safeRandomUUID();
              const retryRes = await defensePeriodApi.lifecycle(selectedId, "ARCHIVE", retryIdempotencyKey, {
                forceArchiveWithoutPublish: true,
                reason: reason || "Đóng đợt đặc biệt"
              });
              if (readEnvelopeSuccess(retryRes)) {
                addToast("Lưu trữ cưỡng bức đợt thành công.", "success");

                // Clear active period state if it was the archived one
                if (getActiveDefensePeriodId() === selectedId) {
                  setActiveDefensePeriodId(null);
                  window.dispatchEvent(new Event("storage"));
                }
                setSelectedId(null);

                await loadData(true);
                await loadSnapshots();
              } else {
                const errMsg = readEnvelopeData<string>(retryRes) || "Lưu trữ cưỡng bức thất bại.";
                addToast(errMsg, "error");
              }
            } catch (retryErr: any) {
              const errMsg = retryErr.data?.message || retryErr.data?.Message || retryErr.message || "Lỗi hệ thống khi lưu trữ cưỡng bức.";
              addToast(errMsg, "error");
            }
          }
        }
      } else {
        addToast(errMsg, "error");
      }
    } finally {
      if (shouldClearConfirm) {
        setConfirmState(null);
      }
      setRefreshing(false);
    }
  };

  const handleSendReminder = async (selectedUserCodes: string[], message: string) => {
    if (!selectedId || !sendReminderModal) return;
    setSendingReminder(true);
    try {
      const stageName = sendReminderModal.stage;
      const notifTitle = `Nhắc nhở cập nhật đề tài — Giai đoạn ${stageName}`;
      await defensePeriodApi.sendReminder(selectedId, {
        recipientUserCodes: selectedUserCodes,
        message,
        stage: stageName,
        notifTitle,
      });
      setReminderSentCount(prev => prev + selectedUserCodes.length);
      addToast(`Đã gửi thông báo nhắc nhở đến ${selectedUserCodes.length} người thành công!`, "success");
      setSendReminderModal(null);
    } catch (err: any) {
      const errMsg = err.data?.message || err.data?.Message || err.message || "Gửi thông báo thất bại.";
      addToast(errMsg, "error");
    } finally {
      setSendingReminder(false);
    }
  };

  const openReminderFromErrors = (errors: { studentName: string; studentCode: string; supervisorName: string; topicTitle: string; reason: string }[], stageName: string) => {
    // Build unique recipients from errors: students + supervisors
    const recipientMap = new Map<string, { userCode: string; name: string; role: "student" | "lecturer"; topicTitle: string }>();
    errors.forEach(err => {
      if (err.studentCode && err.studentCode !== "-") {
        if (!recipientMap.has(err.studentCode)) {
          recipientMap.set(err.studentCode, {
            userCode: err.studentCode,
            name: err.studentName || err.studentCode,
            role: "student",
            topicTitle: err.topicTitle,
          });
        }
      }
      // Build a synthetic lecturer code from supervisor name (fallback)
      const svKey = `lec_${err.supervisorName}`;
      if (err.supervisorName && err.supervisorName !== "Chưa gán" && !recipientMap.has(svKey)) {
        // Try to find lecturer code from scoringMatrix
        const matrixRow = (snapshot?.scoringMatrix ?? []).find((r: any) =>
          (r.studentCode === err.studentCode || r.studentName === err.studentName)
        );
        const lecCode = matrixRow?.supervisorLecturerCode ?? matrixRow?.supervisorCode ?? svKey;
        recipientMap.set(lecCode, {
          userCode: lecCode,
          name: err.supervisorName,
          role: "lecturer",
          topicTitle: err.topicTitle,
        });
      }
    });
    setSendReminderModal({
      isOpen: true,
      recipients: Array.from(recipientMap.values()),
      stage: stageName,
    });
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
      const errMsg = err.data?.message || err.data?.Message || err.message || "Không thể tải báo cáo. Vui lòng thử lại sau.";
      addToast(errMsg, "error");
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
        termCode: data.termCode ? data.termCode.trim() : ""
      };

      if (mode === "create" || mode === "clone") {
        const res = await defensePeriodApi.create(payload);
        if (readEnvelopeSuccess(res)) {
          const newPeriod = readEnvelopeData<DefensePeriod>(res);
          addToast(mode === "create" ? "Khởi tạo đợt đồ án tốt nghiệp mới thành công." : "Nhân bản đợt đồ án tốt nghiệp thành công.", "success");
          await loadData(true);
          if (newPeriod) {
            setSelectedId(newPeriod.defenseTermId);
            // Set as active defense period and notify layouts
            setActiveDefensePeriodId(newPeriod.defenseTermId);
            window.dispatchEvent(new Event("storage"));
          }
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

          // Clear active period state if it was the deleted one
          if (getActiveDefensePeriodId() === data) {
            setActiveDefensePeriodId(null);
            window.dispatchEvent(new Event("storage"));
          }

          await loadData(true);
          if (selectedId === data) setSelectedId(null);
          setConfirmState(null);
        }
      }
    } catch (err: any) {
      const errMsg = err.data?.message || err.data?.Message || err.message || "Thao tác thất bại.";
      addToast(errMsg, "error");
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
      { key: "Draft", label: "Soạn thảo", desc: "Khởi tạo đợt đồ án" },
      { key: "Registration", label: "Đăng ký & Phân công", desc: "Đăng ký đề tài & Gán GV" },
      { key: "ProgressTracking", label: "Tiến độ", desc: "Theo dõi thực hiện" },
      { key: "CommitteePreparation", label: "Hội đồng", desc: "Chuẩn bị hội đồng" },
      { key: "Running", label: "Bảo vệ", desc: "Chấm điểm & biên bản" },
      { key: "Finalization", label: "Hậu bảo vệ", desc: "Tổng kết & Nộp lại" },
      { key: "Archived", label: "Đóng & Lưu trữ", desc: "Kết thúc & Lưu trữ" },
    ];

    const currentStatus = selectedRow?.status || "Draft";
    const statusOrder: Record<string, number> = {
      draft: 0,
      registration: 1,
      assignment: 1,
      progresstracking: 2,
      committeepreparation: 3,
      running: 4,
      paused: 4,
      scoringlocked: 5,
      finalization: 5,
      finalized: 5,
      published: 5,
      closed: 6,
      archived: 6
    };

    const normalizedKey = String(currentStatus).toLowerCase().trim();
    const currentIndex = statusOrder[normalizedKey] ?? 0;

    return (
      <div style={{ background: "#fff", padding: "24px", borderRadius: "16px", border: "1px solid #e2e8f0", marginBottom: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Activity size={18} color={DEEP_BLUE_PRIMARY} />
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: DEEP_BLUE_PRIMARY }}>Lộ trình thực hiện đợt</h3>
          </div>
          <div style={{ fontSize: "12px", color: "#64748b", display: "flex", alignItems: "center", gap: "6px", background: "#f8fafc", padding: "6px 12px", borderRadius: "8px" }}>
            <Clock size={14} /> Cập nhật: {selectedRow?.lastUpdated ? new Date(selectedRow.lastUpdated).toLocaleString() : "--"}
          </div>
        </div>
        <div style={{ display: "flex", position: "relative", padding: "0 10px" }}>
          {steps.map((step, idx) => {
            const isCompleted = idx < currentIndex || (currentStatus === "Archived" && idx === 6);
            const isActive = idx === currentIndex && currentStatus !== "Archived";

            const isPausedActive = isActive && currentStatus === "Paused";
            const color = isCompleted
              ? "#10b981"
              : (isActive
                ? (isPausedActive ? "#f59e0b" : DEEP_BLUE_PRIMARY)
                : "#cbd5e1");

            return (
              <React.Fragment key={step.key}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", zIndex: 2 }}>
                  <div style={{
                    width: "36px", height: "36px", borderRadius: "50%", background: "#fff",
                    border: `2.5px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: isActive ? `0 0 0 4px ${color}20` : "none", transition: "all 0.3s ease"
                  }}>
                    {isCompleted ? (
                      <CheckCircle size={20} color="#10b981" />
                    ) : isActive ? (
                      isPausedActive ? (
                        <Pause size={20} fill="#f59e0b" color="#f59e0b" />
                      ) : (
                        <Play size={20} fill={DEEP_BLUE_PRIMARY} color={DEEP_BLUE_PRIMARY} />
                      )
                    ) : (
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#cbd5e1" }} />
                    )}
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
                    background: idx < currentIndex || (currentStatus === "Archived" && idx < 6) ? "#10b981" : "#e2e8f0",
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
    const assignedTopics = readCount(stats, ["totalTopics", "topicCount", "assignmentCount", "assignedTopics"], readCount(pipeline, ["totalTopics", "topicCount", "assignmentCount", "assignedTopics"], readCount(overviewSnapshot, ["totalTopics", "topicCount", "assignmentCount", "assignedTopics"])));
    const committeeCount = readCount(stats, ["totalCommittees", "committeeCount", "committeeTotal", "councilCount"], readCount(overviewSnapshot, ["totalCommittees", "committeeCount", "committeeTotal", "councilCount"], readArrayCount(snapshot, ["committees", "committeeList", "committeeRows", "committeeItems", "councils"])));
    const currentStatus = selectedRow?.status || "Draft";

    return (
      <div style={{ display: "grid", gap: "24px" }}>
        {renderTimeline()}

        {currentTransitionErrors.length > 0 && (
          <StaleTopicsWarningBanner
            errorCount={currentTransitionErrors.length}
            nextStageLabel={getStatusPresentation(getNextStatus(selectedRow?.status)).label}
            onViewDetails={() => setIneligibleModal({
              isOpen: true,
              currentStatus: selectedRow?.status || "Draft",
              errors: currentTransitionErrors
            })}
            onSendReminder={() => openReminderFromErrors(currentTransitionErrors, getStatusPresentation(selectedRow?.status).label)}
            reminderSentCount={reminderSentCount}
          />
        )}

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

        {getStageNote(currentStatus) && (
          <div style={{
            background: `linear-gradient(135deg, ${getStatusPresentation(currentStatus).color}0a 0%, ${getStatusPresentation(currentStatus).color}15 100%)`,
            border: `1.5px dashed ${getStatusPresentation(currentStatus).color}`,
            borderRadius: "16px",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.02)"
          }}>
            <div style={{
              background: getStatusPresentation(currentStatus).color,
              color: "#ffffff",
              padding: "8px",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}>
              <BookOpen size={16} />
            </div>
            <div>
              <div style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                Nhiệm vụ cần làm trong giai đoạn {getStatusPresentation(currentStatus).label}
              </div>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "#1e293b", lineHeight: "1.5" }}>
                {getStageNote(currentStatus)}
              </div>
            </div>
          </div>
        )}

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
                  onClick={() => {
                    const status = selectedRow.status;
                    if (status === "Paused") {
                      handleAction("RESUME");
                    } else if (status === "Closed") {
                      handleAction("ARCHIVE");
                    } else if (status === "Finalization" || status === "Finalized" || status === "Published") {
                      handleAction("ARCHIVE");
                    } else {
                      handleAction("NEXT");
                    }
                  }}
                  style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: "10px", padding: "12px", fontWeight: "700", fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                  disabled={selectedRow.status === "Archived"}
                >
                  <Play size={18} /> {getNextActionLabel(selectedRow.status)}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Lịch sử các đợt đồ án tốt nghiệp */}
        <div style={{ background: "white", padding: "24px", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: DEEP_BLUE_PRIMARY, display: "flex", alignItems: "center", gap: "8px" }}>
              <History size={18} /> Lịch sử các đợt đồ án tốt nghiệp
            </h3>
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "700" }}>Tổng số: {rows.length} đợt</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
            {rows.map((row) => (
              <div
                key={row.defenseTermId}
                onClick={() => setSelectedId(row.defenseTermId)}
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  border: `1px solid ${selectedId === row.defenseTermId ? "#f37021" : "#e2e8f0"}`,
                  background: selectedId === row.defenseTermId ? "#fffaf5" : "#f8fafc",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "12px"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "700", color: DEEP_BLUE_PRIMARY, background: "#eff6ff", padding: "4px 8px", borderRadius: "6px" }}>
                      {row.termCode || `DT-${row.defenseTermId}`}
                    </span>
                    <span style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background: getStatusPresentation(row.status).bg,
                      color: getStatusPresentation(row.status).color
                    }}>
                      {getStatusPresentation(row.status).label}
                    </span>
                  </div>
                  <h4 style={{ fontSize: "14px", fontWeight: "800", color: "#1e293b", margin: "10px 0 4px 0", lineHeight: "1.4" }}>
                    {row.name}
                  </h4>
                  <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
                    {row.academicYear || "--"} • {row.semester || "--"}
                  </p>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px dashed #e2e8f0", paddingTop: "8px", fontSize: "11px", color: "#64748b" }}>
                  <span>Bắt đầu: {row.startDate ? new Date(row.startDate).toLocaleDateString() : "--"}</span>
                  <span style={{ fontWeight: "700", color: selectedId === row.defenseTermId ? "#f37021" : DEEP_BLUE_PRIMARY }}>
                    {selectedId === row.defenseTermId ? "Đang xem" : "Click để xem"} →
                  </span>
                </div>
              </div>
            ))}
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

        {currentTransitionErrors.length > 0 && (
          <StaleTopicsWarningBanner
            errorCount={currentTransitionErrors.length}
            nextStageLabel={getStatusPresentation(getNextStatus(currentStatus)).label}
            onViewDetails={() => setIneligibleModal({
              isOpen: true,
              currentStatus: currentStatus,
              errors: currentTransitionErrors
            })}
            onSendReminder={() => openReminderFromErrors(currentTransitionErrors, getStatusPresentation(currentStatus).label)}
            reminderSentCount={reminderSentCount}
          />
        )}

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
                {currentStatus === "Registration" && "Sinh viên thực hiện đăng ký đề tài và phân công giảng viên hướng dẫn. Bạn có thể theo dõi số lượng đăng ký, duyệt các đề tài hợp lệ và gán giảng viên hướng dẫn."}
                {currentStatus === "Assignment" && "Giai đoạn phân công giảng viên hướng dẫn và chuẩn bị nhân sự cho các hội đồng bảo vệ."}
                {currentStatus === "ProgressTracking" && "Theo dõi tiến độ nộp báo cáo của sinh viên theo các mốc thời gian đã thiết lập trong lộ trình."}
                {currentStatus === "CommitteePreparation" && "Thiết lập lịch bảo vệ chi tiết, gán phòng và thời gian cho từng hội đồng."}
                {currentStatus === "Running" && "Hội đồng đang thực hiện chấm điểm. Điểm số sẽ được cập nhật thời gian thực vào hệ thống."}
                {currentStatus === "ScoringLocked" && "Điểm số đã được khóa. Bạn cần phê duyệt các báo cáo hậu bảo vệ (nếu có) trước khi tổng kết."}
                {currentStatus === "Finalization" && "Tính toán kết quả cuối cùng và chuẩn bị đóng đợt để khóa hồ sơ bảo vệ."}
              </div>
            </div>

            {getStageNote(currentStatus) && (
              <div style={{
                background: `linear-gradient(135deg, ${getStatusPresentation(currentStatus).color}0a 0%, ${getStatusPresentation(currentStatus).color}15 100%)`,
                border: `1.5px dashed ${getStatusPresentation(currentStatus).color}`,
                borderRadius: "16px",
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: "14px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.02)"
              }}>
                <div style={{
                  background: getStatusPresentation(currentStatus).color,
                  color: "#ffffff",
                  padding: "8px",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}>
                  <BookOpen size={16} />
                </div>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                    Nhiệm vụ cần làm
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: "#1e293b", lineHeight: "1.5" }}>
                    {getStageNote(currentStatus)}
                  </div>
                </div>
              </div>
            )}

            {currentStatus === "Draft" && (
              <div style={{
                background: "linear-gradient(135deg, #e0f2fe 0%, #eff6ff 100%)",
                border: "1px solid #bae6fd",
                borderRadius: "16px",
                padding: "20px",
                boxShadow: "0 4px 15px rgba(14, 165, 233, 0.05)",
                display: "flex",
                alignItems: "flex-start",
                gap: "14px"
              }}>
                <div style={{ background: "#bae6fd", color: "#0369a1", padding: "10px", borderRadius: "12px", display: "flex", flexShrink: 0 }}>
                  <Info size={20} />
                </div>
                <div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "14px", fontWeight: "800", color: "#0369a1" }}>Thành viên tham gia đợt</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "13px", color: "#075985", fontWeight: "700" }}>
                    <div>• Có {totalStudents} sinh viên trong đợt</div>
                    <div>• Có {totalLecturers} giảng viên trong đợt</div>
                  </div>
                </div>
              </div>
            )}

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
                disabled={refreshing || currentStatus === "Archived" || (nextAction === "Tổng kết đợt" && !isScoringComplete)}
                onClick={() => {
                  if (currentStatus === "Paused") {
                    handleAction("RESUME");
                  } else if (currentStatus === "Closed") {
                    handleAction("ARCHIVE");
                  } else if (currentStatus === "Finalization" || currentStatus === "Finalized" || currentStatus === "Published") {
                    handleAction("ARCHIVE");
                  } else {
                    handleAction("NEXT");
                  }
                }}
                title={nextAction === "Tổng kết đợt" && !isScoringComplete ? "Cần chốt điểm toàn bộ đề tài trước khi tổng kết đợt." : undefined}
                style={{
                  width: "100%", padding: "18px", borderRadius: "16px", border: "none",
                  background: refreshing || currentStatus === "Archived" || (nextAction === "Tổng kết đợt" && !isScoringComplete)
                    ? "#cbd5e1"
                    : `linear-gradient(135deg, ${DEEP_BLUE_PRIMARY}, #2c5282)`,
                  color: "white", fontSize: "16px", fontWeight: "800", cursor: refreshing || currentStatus === "Archived" || (nextAction === "Tổng kết đợt" && !isScoringComplete) ? "not-allowed" : "pointer",
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
                  { action: "PAUSE", label: "Tạm dừng đợt", icon: <Pause size={18} />, color: "#f59e0b", disabled: currentStatus === "Draft" || currentStatus === "Paused" || currentStatus === "Closed" || currentStatus === "Archived" },
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
                    onClick={() => handleAction("ARCHIVE")}
                    disabled={currentStatus !== "Finalization" && currentStatus !== "Finalized" && currentStatus !== "Published"}
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
        background: "white",
        borderRadius: "24px",
        padding: "48px 32px",
        boxShadow: "0 20px 40px rgba(15, 23, 42, 0.06)",
        border: "1px solid #e2e8f0",
        maxWidth: 1000,
        margin: "0 auto", // Changed from 40px auto to 0 auto to prevent extra gap
        textAlign: "center"
      }}>
        {/* Welcome Icon Circle wrapper */}
        <div style={{
          width: 80,
          height: 80,
          borderRadius: 24,
          background: "rgba(30, 58, 95, 0.08)",
          color: "#1e3a5f",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 24px auto",
          boxShadow: "0 8px 16px rgba(30, 58, 95, 0.08)"
        }}>
          <Sparkles size={40} />
        </div>

        <h2 style={{
          fontSize: "22px",
          fontWeight: 800,
          color: DEEP_BLUE_PRIMARY,
          margin: "0 0 10px 0",
          letterSpacing: "-0.01em"
        }}>
          Hệ thống Quản lý Đồ án Tốt nghiệp FIT DNU
        </h2>

        <p style={{
          color: "#475569",
          fontSize: "14px",
          lineHeight: "1.5",
          maxWidth: 640,
          margin: "0 auto 32px auto",
          fontWeight: 500
        }}>
          Nền tảng hỗ trợ tự động hóa vòng đời đợt bảo vệ đồ án tốt nghiệp của sinh viên Khoa Công nghệ Thông tin — tối ưu lập hội đồng, theo dõi tiến độ và đánh giá kết quả minh bạch.
        </p>

        {/* Feature Highlights Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "20px",
          marginBottom: "48px",
          textAlign: "left"
        }}>
          <div style={{ background: "#f8fafc", padding: "20px", borderRadius: "16px", border: "1px solid #e2e8f0", transition: "all 0.2s ease" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#eff6ff", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
              <Settings size={18} />
            </div>
            <h4 style={{ fontWeight: 800, color: "#1e293b", margin: "0 0 6px 0", fontSize: "14px" }}>Khởi tạo đợt đồ án</h4>
            <p style={{ color: "#64748b", fontSize: "12px", margin: 0, lineHeight: 1.5 }}>Cấu hình lộ trình mốc thời gian, áp dụng biểu mẫu tiến trình chuẩn hóa.</p>
          </div>

          <div style={{ background: "#f8fafc", padding: "20px", borderRadius: "16px", border: "1px solid #e2e8f0", transition: "all 0.2s ease" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#ecfdf5", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
              <Users size={18} />
            </div>
            <h4 style={{ fontWeight: 800, color: "#1e293b", margin: "0 0 6px 0", fontSize: "14px" }}>Thành viên & Định mức</h4>
            <p style={{ color: "#64748b", fontSize: "12px", margin: 0, lineHeight: 1.5 }}>Nhập xuất sinh viên, giảng viên hướng dẫn và kiểm soát hạn ngạch phụ trách.</p>
          </div>

          <div style={{ background: "#f8fafc", padding: "20px", borderRadius: "16px", border: "1px solid #e2e8f0", transition: "all 0.2s ease" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#fffbeb", color: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
              <Shield size={18} />
            </div>
            <h4 style={{ fontWeight: 800, color: "#1e293b", margin: "0 0 6px 0", fontSize: "14px" }}>Phân bổ Hội đồng</h4>
            <p style={{ color: "#64748b", fontSize: "12px", margin: 0, lineHeight: 1.5 }}>Lập danh sách hội đồng, chia nhóm đề tài chuyên môn và xếp lịch bảo vệ.</p>
          </div>

          <div style={{ background: "#f8fafc", padding: "20px", borderRadius: "16px", border: "1px solid #e2e8f0", transition: "all 0.2s ease" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#fdf2f8", color: "#ec4899", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
              <Zap size={18} />
            </div>
            <h4 style={{ fontWeight: 800, color: "#1e293b", margin: "0 0 6px 0", fontSize: "14px" }}>Điều hành & Chấm điểm</h4>
            <p style={{ color: "#64748b", fontSize: "12px", margin: 0, lineHeight: 1.5 }}>Hỗ trợ nhập điểm thi bảo vệ trực tiếp, khóa điểm và xuất báo cáo kết quả.</p>
          </div>
        </div>

        {/* CTA Section */}
        <div style={{
          background: "#f0f6ff",
          border: "1px solid #bfdbfe",
          padding: "24px",
          borderRadius: "16px",
          display: "inline-block",
          width: "100%",
          maxWidth: 640
        }}>
          <div style={{ fontSize: "14px", color: "#1e3a5f", fontWeight: 700, marginBottom: "16px" }}>
            {rows.length > 0
              ? "Hiện tại không có đợt đồ án tốt nghiệp nào đang chạy. Bạn có thể khởi tạo đợt mới hoặc xem lịch sử các đợt ở bên dưới."
              : "Hiện chưa có đợt đồ án tốt nghiệp nào được khởi tạo trong hệ thống."}
          </div>
          <button
            onClick={() => setPeriodModal({ isOpen: true, mode: "create" })}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "14px 28px",
              borderRadius: "12px",
              border: "none",
              background: "#1e3a5f",
              color: "white",
              fontSize: "14px",
              fontWeight: "800",
              cursor: "pointer",
              boxShadow: "0 10px 20px -5px rgba(30, 58, 95, 0.3)",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#12253f";
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 12px 24px -3px rgba(30, 58, 95, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#1e3a5f";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 10px 20px -5px rgba(30, 58, 95, 0.3)";
            }}
          >
            <Plus size={18} /> Khởi tạo đợt đồ án tốt nghiệp
          </button>
        </div>

        {/* Lịch sử các đợt đồ án tốt nghiệp */}
        {rows.length > 0 && (
          <div style={{ background: "white", padding: "24px", borderRadius: "16px", border: "1px solid #e2e8f0", marginTop: "32px", textAlign: "left" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: DEEP_BLUE_PRIMARY, display: "flex", alignItems: "center", gap: "8px" }}>
                <History size={18} /> Lịch sử các đợt đồ án tốt nghiệp
              </h3>
              <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "700" }}>Tổng số: {rows.length} đợt</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
              {rows.map((row) => (
                <div
                  key={row.defenseTermId}
                  onClick={() => setSelectedId(row.defenseTermId)}
                  style={{
                    padding: "16px",
                    borderRadius: "12px",
                    border: `1px solid ${selectedId === row.defenseTermId ? "#f37021" : "#e2e8f0"}`,
                    background: selectedId === row.defenseTermId ? "#fffaf5" : "#f8fafc",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "12px"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "700", color: DEEP_BLUE_PRIMARY, background: "#eff6ff", padding: "4px 8px", borderRadius: "6px" }}>
                        {row.termCode || `DT-${row.defenseTermId}`}
                      </span>
                      <span style={{
                        fontSize: "11px",
                        fontWeight: "700",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        background: getStatusPresentation(row.status).bg,
                        color: getStatusPresentation(row.status).color
                      }}>
                        {getStatusPresentation(row.status).label}
                      </span>
                    </div>
                    <h4 style={{ fontSize: "14px", fontWeight: "800", color: "#1e293b", margin: "10px 0 4px 0", lineHeight: "1.4" }}>
                      {row.name}
                    </h4>
                    <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
                      {row.academicYear || "--"} • {row.semester || "--"}
                    </p>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px dashed #e2e8f0", paddingTop: "8px", fontSize: "11px", color: "#64748b" }}>
                    <span>Bắt đầu: {row.startDate ? new Date(row.startDate).toLocaleDateString() : "--"}</span>
                    <span style={{ fontWeight: "700", color: DEEP_BLUE_PRIMARY }}>
                      Xem thông tin →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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
                Đang khởi tạo hệ thống
              </div>
              <h2 style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#0f172a",
                margin: 0,
                letterSpacing: "-0.01em"
              }}>
                Quản lý đợt bảo vệ
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

  if (rows.length === 0 || (!hasUnfinishedPeriod && !selectedId)) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#1e293b",
        fontFamily: "'Be Vietnam Pro', sans-serif",
        padding: "0 0 40px 0"
      }}>
        <div style={{
          background: DEEP_BLUE_PRIMARY,
          padding: "60px 24px 100px 24px", // Increased padding bottom to give title more breathing space
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
            maxWidth: 800,
            margin: "0 auto",
            position: "relative",
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 16
          }}>
            <div>
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
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
                  FIT DNU
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
                  Quản trị đợt đồ án
                </div>
              </div>

              <h1 style={{
                fontSize: 38,
                fontWeight: 900,
                color: "white",
                margin: 0,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
                animation: "slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)"
              }}>
                Quản lý <span style={{ color: "#38bdf8" }}>Đợt đồ án tốt nghiệp</span>
              </h1>

              <p style={{
                fontSize: 15,
                color: "rgba(255, 255, 255, 0.8)",
                marginTop: 8,
                maxWidth: 600,
                fontWeight: 500,
                animation: "fadeIn 0.8s ease",
                lineHeight: 1.6
              }}>
                Điều hành vòng đời, cấu hình lộ trình thời gian và quản lý thành viên đợt đồ án tốt nghiệp.
              </p>
            </div>
          </div>
        </div>

        <div style={{
          maxWidth: 1000,
          margin: "-60px auto 0 auto",
          padding: "0 24px",
          position: "relative",
          zIndex: 10
        }}>
          {renderEmptyState()}
        </div>

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
    <div style={{
      minHeight: "100vh",
      background: "#f8fafc",
      color: "#1e293b",
      fontFamily: "'Be Vietnam Pro', sans-serif",
      padding: "0 0 40px 0"
    }}>
      {/* Header Section */}
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
                FIT DNU
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
                Quản trị đợt đồ án
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <h1 style={{
                fontSize: 42,
                fontWeight: 900,
                color: "white",
                margin: 0,
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                animation: "slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)"
              }}>
                Quản lý <span style={{ color: "#f37021" }}>Đợt đồ án tốt nghiệp</span>
              </h1>
              {selectedRow && (
                <div style={{
                  padding: "6px 16px",
                  borderRadius: "99px",
                  background: "rgba(255, 255, 255, 0.1)",
                  backdropFilter: "blur(4px)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginTop: 4,
                  animation: "fadeIn 0.7s ease"
                }}>
                  <CalendarIcon size={14} color="#f37021" /> {selectedRow.academicYear || "--"} - {selectedRow.semester || "--"}
                </div>
              )}
            </div>

            <p style={{
              fontSize: 16,
              color: "rgba(255, 255, 255, 0.7)",
              marginTop: 12,
              maxWidth: 700,
              fontWeight: 500,
              animation: "fadeIn 0.8s ease",
              lineHeight: 1.5
            }}>
              {selectedRow ? `Điều hành: ${selectedRow.name}` : "Điều hành vòng đời, theo dõi tiến độ và quản lý thành viên đợt đồ án tốt nghiệp."}
            </p>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center", animation: "fadeIn 0.8s ease" }}>
            {!hasUnfinishedPeriod && selectedId && (
              <button
                onClick={() => setSelectedId(null)}
                style={{
                  padding: "12px 20px",
                  borderRadius: "14px",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  background: "rgba(255, 255, 255, 0.1)",
                  backdropFilter: "blur(8px)",
                  fontWeight: "700",
                  fontSize: "14px",
                  color: "white",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  outline: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                }}
              >
                <ArrowLeft size={16} /> Quay lại trang chủ
              </button>
            )}

          </div>
        </div>
      </div>

      {/* Main Content Card Wrapper */}
      <div style={{
        maxWidth: 1600,
        margin: "-48px auto 0 auto",
        padding: "0 32px",
        position: "relative",
        zIndex: 10
      }}>
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
                  <button onClick={() => studentSectionRef.current?.openAdd()} style={{ background: DEEP_BLUE_PRIMARY, color: "#fff", border: "none", borderRadius: "10px", padding: "8px 16px", fontWeight: "700", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Plus size={16} /> Thêm sinh viên
                  </button>
                </div>
                <DefenseTermStudentsSection key={selectedId ?? "null"} ref={studentSectionRef} defenseTermId={selectedId} />
              </div>
            )}
            {activeTab === "lecturers" && (
              <div style={{ display: "grid", gap: "24px" }}>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button onClick={() => lecturerSectionRef.current?.openAdd()} style={{ background: DEEP_BLUE_PRIMARY, color: "#fff", border: "none", borderRadius: "10px", padding: "8px 16px", fontWeight: "700", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Plus size={16} /> Thêm giảng viên
                  </button>
                </div>
                <DefenseTermLecturersSection key={selectedId ?? "null"} ref={lecturerSectionRef} defenseTermId={selectedId} />
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

      {/* Ineligible Topics Warning Modal */}
      {ineligibleModal && ineligibleModal.isOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}>
          <div style={{ background: "white", width: "90%", maxWidth: "800px", borderRadius: "24px", padding: "32px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{ background: "#fee2e2", color: "#dc2626", padding: "10px", borderRadius: "12px" }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "20px", fontWeight: "900", color: "#1e293b" }}>Yêu Cầu Đủ Điều Kiện Giai Đoạn</h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                  Danh sách đề tài chưa đạt điều kiện chuyển giai đoạn cho trạng thái: <strong>{getStatusPresentation(ineligibleModal.currentStatus).label}</strong>
                </p>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", border: "1px solid #cbd5e1", borderRadius: "16px", marginBottom: "24px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                    <th style={{ padding: "12px 16px", fontSize: "12px", fontWeight: "800", color: "#334155", textTransform: "uppercase" }}>Sinh viên</th>
                    <th style={{ padding: "12px 16px", fontSize: "12px", fontWeight: "800", color: "#334155", textTransform: "uppercase" }}>Giảng viên HD</th>
                    <th style={{ padding: "12px 16px", fontSize: "12px", fontWeight: "800", color: "#334155", textTransform: "uppercase" }}>Đề tài</th>
                    <th style={{ padding: "12px 16px", fontSize: "12px", fontWeight: "800", color: "#dc2626", textTransform: "uppercase" }}>Lỗi / Thiếu điều kiện</th>
                  </tr>
                </thead>
                <tbody>
                  {ineligibleModal.errors.map((err, idx) => (
                    <tr key={idx} style={{ borderBottom: idx < ineligibleModal.errors.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                      <td style={{ padding: "12px 16px", fontSize: "13px" }}>
                        <div style={{ fontWeight: "700", color: "#0f172a" }}>{err.studentName}</div>
                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>MSSV: {err.studentCode}</div>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: "600", color: "#334155" }}>
                        {err.supervisorName}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", color: "#475569", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {err.topicTitle}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "13px" }}>
                        <span style={{ background: "#fef2f2", color: "#991b1b", padding: "4px 8px", borderRadius: "6px", fontWeight: "700", fontSize: "11px", border: "1px solid #fecaca" }}>
                          {err.reason}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  if (ineligibleModal) {
                    const currentStatusLabel = getStatusPresentation(ineligibleModal.currentStatus).label;
                    openReminderFromErrors(ineligibleModal.errors, currentStatusLabel);
                  }
                }}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                  color: "white", border: "none", borderRadius: "12px",
                  padding: "12px 20px", fontWeight: "700", fontSize: "14px", cursor: "pointer"
                }}
              >
                <BellRing size={16} /> Gửi nhắc nhở (đến {ineligibleModal?.errors.length ?? 0} đề tài)
              </button>
              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  onClick={() => setIneligibleModal(null)}
                  style={{
                    background: "#e2e8f0",
                    color: "#475569",
                    border: "none",
                    borderRadius: "12px",
                    padding: "12px 24px",
                    fontWeight: "700",
                    fontSize: "14px",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={() => {
                    setIneligibleModal(null);
                    void handleAction("NEXT", true);
                  }}
                  style={{
                    background: "#dc2626",
                    color: "white",
                    border: "none",
                    borderRadius: "12px",
                    padding: "12px 24px",
                    fontWeight: "700",
                    fontSize: "14px",
                    cursor: "pointer",
                    boxShadow: "0 4px 6px rgba(220, 38, 38, 0.2)",
                    transition: "all 0.2s"
                  }}
                >
                  Bỏ qua cảnh báo & Tiếp tục
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {sendReminderModal && sendReminderModal.isOpen && (
        <SendReminderModal
          isOpen={sendReminderModal.isOpen}
          onClose={() => setSendReminderModal(null)}
          onSend={handleSendReminder}
          isSending={sendingReminder}
          recipients={sendReminderModal.recipients}
          stageName={sendReminderModal.stage}
          reminderSentCount={reminderSentCount}
        />
      )}

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
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
