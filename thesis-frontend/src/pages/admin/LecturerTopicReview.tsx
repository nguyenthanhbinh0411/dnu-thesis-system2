import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  BookOpen,
  CheckCircle,
  Clock,
  AlertCircle,
  Edit,
  User,
  FileText,
  Loader2,
  Filter,
  Eye,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  Tag as TagIcon,
  X,
  Calendar,
  Mail,
  Phone,
  Users,
  TrendingUp,
  Zap,
  ChevronUp,
  ChevronDown,
  Download,
  Plus,
  Award,
  Check,
  Trash2,
  RefreshCw,
  FileSpreadsheet,
  FileArchive,
  FileImage,
  File,
  Archive,
  LayoutDashboard,
  FileDown,
  Info,
} from "lucide-react";
import { fetchData, getAvatarUrl, normalizeUrl } from "../../api/fetchData";
import { useToast } from "../../context/useToast";
import { getAccessToken } from "../../services/auth-session.service";
import { readEnvelopeData } from "../../utils/api-envelope";
import type { Topic } from "../../types/topic";
import type { StudentProfile } from "../../types/studentProfile";
import type { LecturerProfile } from "../../types/lecturer-profile";
import type { Tag, CatalogTopicTag, TopicTag } from "../../types/tag";
import type { ApiResponse } from "../../types/api";
import type { ProgressMilestone } from "../../types/progressMilestone";
import type { ProgressSubmission } from "../../types/progressSubmission";
import type { SubmissionFile } from "../../types/submissionFile";
import { useAuth } from "../../hooks/useAuth";
import { useActiveDefensePeriodId } from "../../utils/defensePeriod";
import {
  decideTopicWorkflow,
  getTopicWorkflowDetail,
  getTopicWorkflowTimeline,
} from "../../services/topic-workflow.service";
import * as XLSX from "xlsx";

interface TopicDisplay {
  topicID: number;
  topicCode: string;
  catalogTopicCode?: string | null;
  title: string;
  description: string;
  studentCode: string;
  studentName: string;
  submissionDate: string;
  status: "Chờ duyệt" | "Đã duyệt" | "Từ chối" | "Cần sửa đổi";
  category: string;
  comments?: string;
  studentProfile?: StudentProfile;
  supervisorLecturerProfileID?: number | null;
  supervisorLecturerCode?: string | null;
  lecturerProfile?: LecturerProfile | null;
}

interface CriterionRating {
  name: string;
  score: number;
  comment: string;
}

interface ThesisAiAnalysisResult {
  overallScore: number;
  status: string;
  criteria: CriterionRating[];
  pros: string[];
  cons: string[];
  suggestions: string[];
  summary: string;
  feedbackForStudent: string;
}

interface DefensePeriod {
  defenseTermId: number;
  name: string;
  status: string;
}

interface AutoAssignPreviewDto {
  studentCode: string;
  studentName: string;
  studentDepartment: string;
  catalogTopicCode: string;
  topicTitle: string;
  supervisorLecturerCode: string;
  supervisorLecturerName: string;
  matchTagsCount: number;
  isFallback: boolean;
  commonTags: string[];
}

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

const STUDENT_FIELDS = [
  { key: "StudentCode", label: "Mã sinh viên", category: "Thông tin cơ bản" },
  { key: "FullName", label: "Họ và tên", category: "Thông tin cơ bản" },
  { key: "Gender", label: "Giới tính", category: "Thông tin cơ bản" },
  { key: "DateOfBirth", label: "Ngày sinh", category: "Thông tin cơ bản" },
  { key: "FacultyCode", label: "Khoa", category: "Đơn vị" },
  { key: "DepartmentCode", label: "Khoa", category: "Đơn vị" },
  { key: "ClassCode", label: "Lớp", category: "Đơn vị" },
  { key: "EnrollmentYear", label: "Khóa học", category: "Tiến độ" },
  { key: "GraduationYear", label: "Năm tốt nghiệp", category: "Tiến độ" },
  { key: "GPA", label: "Điểm TB", category: "Kết quả" },
  { key: "AcademicStanding", label: "Xếp loại", category: "Kết quả" },
  { key: "StudentEmail", label: "Email", category: "Liên lạc" },
  { key: "PhoneNumber", label: "Số điện thoại", category: "Liên lạc" },
  { key: "Address", label: "Địa chỉ", category: "Liên lạc" },
  { key: "Status", label: "Trạng thái hồ sơ", category: "Trạng thái" },
  { key: "TopicTitle", label: "Đề tài đăng ký", category: "Đề tài liên kết" },
  { key: "SupervisorName", label: "Giảng viên hướng dẫn", category: "Đề tài liên kết" },
  { key: "TopicStatus", label: "Trạng thái đề tài", category: "Đề tài liên kết" },
];

const EXPORT_REPORTS = [
  {
    key: "assigned-topics",
    label: "Phân công đề tài & Giảng viên hướng dẫn",
    desc: "Báo cáo chi tiết các đề tài đã được gán sinh viên và giảng viên hướng dẫn.",
    icon: <FileSpreadsheet size={20} />,
    type: "modular",
    fields: TOPIC_FIELDS
  },
  {
    key: "lecturers-grouped-students",
    label: "Danh sách hướng dẫn gộp theo giảng viên",
    desc: "Báo cáo danh sách sinh viên theo từng giảng viên hướng dẫn, có gộp cột giảng viên.",
    icon: <LayoutDashboard size={20} />,
    type: "modular",
    fields: GROUPED_LECTURER_FIELDS
  },
  {
    key: "all-students",
    label: "Danh sách sinh viên trong đợt",
    desc: "Báo cáo danh sách sinh viên trong đợt bảo vệ, tùy chọn lọc theo trạng thái đề tài và cột dữ liệu.",
    icon: <Users size={20} />,
    type: "client-side",
    fields: STUDENT_FIELDS
  }
];

interface LecturerTopicReviewProps {
  currentLecturerOnly?: boolean;
}

const LecturerTopicReview: React.FC<LecturerTopicReviewProps> = ({
  currentLecturerOnly = false,
}) => {
  const activePeriodId = useActiveDefensePeriodId();
  const [periods, setPeriods] = useState<DefensePeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [milestoneTemplates, setMilestoneTemplates] = useState<any[]>([]);

  useEffect(() => {
    const fetchPeriods = async () => {
      try {
        const response = await fetchData<ApiResponse<DefensePeriod[]>>(
          "/defense-periods",
          { method: "GET" }
        );
        if (response?.success && response.data) {
          setPeriods(response.data);
        }
      } catch {
        setPeriods([]);
      }
    };
    void fetchPeriods();
  }, []);

  useEffect(() => {
    const fetchMilestoneTemplates = async () => {
      try {
        const response = await fetchData<ApiResponse<any[]>>(
          "/MilestoneTemplates/get-list",
          { method: "GET" }
        );
        if (response?.success && response.data) {
          setMilestoneTemplates([...response.data].sort((a, b) => a.ordinal - b.ordinal));
        }
      } catch (err) {
        console.error("Error fetching milestone templates:", err);
      }
    };
    void fetchMilestoneTemplates();
  }, []);

  useEffect(() => {
    if (activePeriodId) {
      setSelectedPeriodId(activePeriodId);
    }
  }, [activePeriodId]);

  const { user } = useAuth();
  const { addToast } = useToast();
  const [topics, setTopics] = useState<TopicDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentLecturerCode, setCurrentLecturerCode] = useState<string>("");
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const [commentModal, setCommentModal] = useState<{
    isOpen: boolean;
    action: "reject" | "revision" | null;
    topicID: number | null;
    topicTitle: string;
  }>({
    isOpen: false,
    action: null,
    topicID: null,
    topicTitle: "",
  });
  const [commentText, setCommentText] = useState("");

  const [viewCommentModal, setViewCommentModal] = useState<{
    isOpen: boolean;
    comments: string;
    topicTitle: string;
  }>({
    isOpen: false,
    comments: "",
    topicTitle: "",
  });
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    topic: TopicDisplay | null;
  }>({
    isOpen: false,
    topic: null,
  });
  const [successModal, setSuccessModal] = useState<{
    isOpen: boolean;
    action: "approve" | "reject" | "revision" | null;
    topicTitle: string;
  }>({
    isOpen: false,
    action: null,
    topicTitle: "",
  });

  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean;
    topic: TopicDisplay | null;
  }>({
    isOpen: false,
    topic: null,
  });

  const [detailMilestones, setDetailMilestones] = useState<ProgressMilestone[]>([]);
  const [detailSubmissions, setDetailSubmissions] = useState<(ProgressSubmission & { files?: SubmissionFile[] })[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const [aiAnalysis, setAiAnalysis] = useState<ThesisAiAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showDetailedAi, setShowDetailedAi] = useState(false);

  const [topicTags, setTopicTags] = useState<Tag[]>([]);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchTrigger, setSearchTrigger] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10; // Fixed page size for now
  const [totalCount, setTotalCount] = useState<number>(0);
  const [stats, setStats] = useState<{
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    revision: number;
  }>({
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    revision: 0,
  });

  // --- Admin Registration Dashboard States & Types ---
  const [activeAdminTab, setActiveAdminTab] = useState<"overview" | "topics-management" | "lecturer-quota" | "export">("overview");

  // Topics Management Tab States
  const [topicsSearchTerm, setTopicsSearchTerm] = useState("");
  const [topicsTypeFilter, setTopicsTypeFilter] = useState<string>("all");
  const [topicsStatusFilter, setTopicsStatusFilter] = useState<string>("all");
  const [isCreateTopicModalOpen, setIsCreateTopicModalOpen] = useState(false);
  const [isEditTopicModalOpen, setIsEditTopicModalOpen] = useState(false);
  const [selectedTopicToEdit, setSelectedTopicToEdit] = useState<Topic | null>(null);
  const [isTopicSaving, setIsTopicSaving] = useState(false);
  const [isTopicDeleting, setIsTopicDeleting] = useState<number | null>(null);

  // Form values for Topic Create/Edit
  const [topicFormTitle, setTopicFormTitle] = useState("");
  const [topicFormSummary, setTopicFormSummary] = useState("");
  const [topicFormType, setTopicFormType] = useState<"CATALOG" | "SELF">("CATALOG");
  const [topicFormDepartmentCode, setTopicFormDepartmentCode] = useState("");
  const [topicFormProposerCode, setTopicFormProposerCode] = useState("");
  const [topicFormSupervisorCode, setTopicFormSupervisorCode] = useState("");
  const [topicFormStatus, setTopicFormStatus] = useState("Đang chờ");

  // Lecturer Load Tab States
  const [lecturerLoadSearchTerm, setLecturerLoadSearchTerm] = useState("");
  const [lecturerLoadDeptFilter, setLecturerLoadDeptFilter] = useState("all");
  const [expandedLecturerCode, setExpandedLecturerCode] = useState<string | null>(null);

  // Custom Field Export States
  const [selectedExportFields, setSelectedExportFields] = useState<string[]>([
    "STT", "studentCode", "fullName", "classCode", "departmentCode", "status", "topicTitle", "supervisorName"
  ]);

  const openCreateTopicModal = () => {
    setTopicFormTitle("");
    setTopicFormSummary("");
    setTopicFormType("CATALOG");
    setTopicFormDepartmentCode(allStudents[0]?.departmentCode || "");
    setTopicFormProposerCode("");
    setTopicFormSupervisorCode("");
    setTopicFormStatus("Đang chờ");
    setIsCreateTopicModalOpen(true);
  };

  const openEditTopicModal = (topic: Topic) => {
    setSelectedTopicToEdit(topic);
    setTopicFormTitle(topic.title || "");
    setTopicFormSummary(topic.summary || "");
    setTopicFormType(topic.type === "CATALOG" ? "CATALOG" : "SELF");
    setTopicFormDepartmentCode(topic.departmentCode || "");
    setTopicFormProposerCode(topic.proposerStudentCode || "");
    setTopicFormSupervisorCode(topic.supervisorLecturerCode || "");
    setTopicFormStatus(topic.status || "Đang chờ");
    setIsEditTopicModalOpen(true);
  };

  const handleCreateTopicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicFormTitle.trim()) {
      addToast("Vui lòng nhập tên đề tài.", "warning");
      return;
    }

    setIsTopicSaving(true);
    try {
      const payload: any = {
        title: topicFormTitle.trim(),
        summary: topicFormSummary.trim(),
        type: topicFormType,
        departmentCode: topicFormDepartmentCode || null,
        proposerUserCode: topicFormProposerCode.trim() || null,
        proposerStudentCode: topicFormProposerCode.trim() || null,
        supervisorLecturerCode: topicFormSupervisorCode || null,
        status: "Đang chờ"
      };

      if (selectedPeriodId) {
        payload.defenseTermId = selectedPeriodId;
      }

      if (topicFormProposerCode.trim()) {
        const studentProfile = allStudents.find(s => s.studentCode === topicFormProposerCode.trim());
        if (studentProfile) {
          payload.proposerStudentProfileID = studentProfile.studentProfileID;
          payload.proposerUserID = studentProfile.studentProfileID;
        }
      }

      if (topicFormSupervisorCode) {
        const lecturerProfile = allLecturers.find(l => l.lecturerCode === topicFormSupervisorCode);
        if (lecturerProfile) {
          payload.supervisorLecturerProfileID = lecturerProfile.lecturerProfileID;
        }
      }

      const response = await fetchData<ApiResponse<any>>("/Topics/create", {
        method: "POST",
        body: payload
      });

      if (response?.success) {
        addToast("Tạo đề tài thành công!", "success");
        setIsCreateTopicModalOpen(false);
        await fetchStats();
        await fetchStudents();
      } else {
        addToast(response?.message || "Tạo đề tài thất bại.", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Lỗi hệ thống khi tạo đề tài.", "error");
    } finally {
      setIsTopicSaving(false);
    }
  };

  const handleUpdateTopicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTopicToEdit) return;
    if (!topicFormTitle.trim()) {
      addToast("Vui lòng nhập tên đề tài.", "warning");
      return;
    }

    setIsTopicSaving(true);
    try {
      const payload: any = {
        topicID: selectedTopicToEdit.topicID,
        topicCode: selectedTopicToEdit.topicCode,
        title: topicFormTitle.trim(),
        summary: topicFormSummary.trim(),
        type: topicFormType,
        departmentCode: topicFormDepartmentCode || null,
        proposerUserCode: topicFormProposerCode.trim() || null,
        proposerStudentCode: topicFormProposerCode.trim() || null,
        supervisorLecturerCode: topicFormSupervisorCode || null,
        status: topicFormStatus
      };

      if (selectedPeriodId) {
        payload.defenseTermId = selectedPeriodId;
      }

      if (topicFormProposerCode.trim()) {
        const studentProfile = allStudents.find(s => s.studentCode === topicFormProposerCode.trim());
        if (studentProfile) {
          payload.proposerStudentProfileID = studentProfile.studentProfileID;
        }
      }

      if (topicFormSupervisorCode) {
        const lecturerProfile = allLecturers.find(l => l.lecturerCode === topicFormSupervisorCode);
        if (lecturerProfile) {
          payload.supervisorLecturerProfileID = lecturerProfile.lecturerProfileID;
        }
      }

      const response = await fetchData<ApiResponse<any>>(`/Topics/update/${encodeURIComponent(selectedTopicToEdit.topicID)}`, {
        method: "PUT",
        body: payload
      });

      if (response?.success) {
        addToast("Cập nhật đề tài thành công!", "success");
        setIsEditTopicModalOpen(false);
        await fetchStats();
        await fetchStudents();
      } else {
        addToast(response?.message || "Cập nhật đề tài thất bại.", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Lỗi hệ thống khi cập nhật đề tài.", "error");
    } finally {
      setIsTopicSaving(false);
    }
  };

  const handleDeleteTopic = async (topic: Topic) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa đề tài "${topic.title}" không?`)) return;

    setIsTopicDeleting(topic.topicID);
    try {
      const response = await fetchData<ApiResponse<any>>(`/Topics/delete/${encodeURIComponent(topic.topicCode)}`, {
        method: "DELETE"
      });
      if (response?.success) {
        addToast("Xóa đề tài thành công!", "success");
        await fetchStats();
        await fetchStudents();
      } else {
        addToast(response?.message || "Không thể xóa đề tài.", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Lỗi hệ thống khi xóa đề tài.", "error");
    } finally {
      setIsTopicDeleting(null);
    }
  };

  const handleEditQuotaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editQuotaModal.lecturer) return;

    setIsQuotaSaving(true);
    const code = editQuotaModal.lecturer.lecturerCode;
    try {
      // 1. Fetch complete details to prevent wiping other properties
      const getRes = await fetchData<ApiResponse<any>>(`/LecturerProfiles/get-update/${encodeURIComponent(code)}`);

      if (!getRes?.success || !getRes.data) {
        addToast(getRes?.message || "Không thể tải thông tin giảng viên để cập nhật.", "error");
        setIsQuotaSaving(false);
        return;
      }

      const currentDto = getRes.data;

      // 2. Prepare update payload
      const updatePayload = {
        departmentCode: currentDto.departmentCode,
        degree: currentDto.degree,
        organization: currentDto.organization,
        guideQuota: editQuotaModal.quotaValue,
        defenseQuota: editQuotaModal.defenseQuotaValue,
        currentGuidingCount: currentDto.currentGuidingCount,
        gender: currentDto.gender,
        dateOfBirth: currentDto.dateOfBirth,
        email: currentDto.email,
        phoneNumber: currentDto.phoneNumber,
        address: currentDto.address,
        notes: currentDto.notes,
        fullName: currentDto.fullName,
        defenseTermId: currentDto.defenseTermId || selectedPeriodId
      };

      // 3. Put request
      const putRes = await fetchData<ApiResponse<any>>(`/LecturerProfiles/update/${encodeURIComponent(code)}`, {
        method: "PUT",
        body: updatePayload
      });

      if (putRes?.success) {
        addToast(`Cập nhật định mức cho giảng viên ${updatePayload.fullName} thành công!`, "success");
        setEditQuotaModal(prev => ({ ...prev, isOpen: false }));
        // 4. Refresh lecturer list
        await fetchLecturers();
      } else {
        addToast(putRes?.message || "Cập nhật định mức thất bại.", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Lỗi hệ thống khi cập nhật định mức.", "error");
    } finally {
      setIsQuotaSaving(false);
    }
  };

  // Reports Export States
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(EXPORT_REPORTS[0].key);
  const [selectedFields, setSelectedFields] = useState<string[]>(EXPORT_REPORTS[0].fields?.map(f => f.key) || []);
  const [exportFormat, setExportFormat] = useState("xlsx");
  const [isExporting, setIsExporting] = useState(false);
  const [studentFilter, setStudentFilter] = useState<"all" | "has-topic" | "no-topic">("all");

  const handleDownloadReport = async (item: any, format: string = "xlsx", fields?: string[]) => {
    if (!selectedPeriodId) {
      addToast("Không xác định được đợt bảo vệ tốt nghiệp.", "error");
      return;
    }

    if (item.type === "client-side") {
      setIsExporting(true);

      const fieldsToExport = fields || selectedFields;
      if (!fieldsToExport || fieldsToExport.length === 0) {
        addToast("Vui lòng chọn ít nhất một trường dữ liệu để xuất.", "warning");
        setIsExporting(false);
        return;
      }

      if (format === "pdf") {
        addToast("Đối với báo cáo danh sách sinh viên, hệ thống tự động xuất định dạng Excel (.xlsx) để quản lý dữ liệu tốt nhất.", "info");
      }

      // Filter students based on studentFilter
      let students = allStudents;
      if (studentFilter === "has-topic") {
        students = allStudents.filter(s => getStudentRegistrationInfo(s.studentCode) !== null);
      } else if (studentFilter === "no-topic") {
        students = allStudents.filter(s => getStudentRegistrationInfo(s.studentCode) === null);
      }

      if (students.length === 0) {
        addToast("Không có dữ liệu sinh viên phù hợp để xuất báo cáo.", "info");
        setIsExporting(false);
        return;
      }

      try {
        const rows = students.map((student) => {
          const rowData: Record<string, any> = {};

          fieldsToExport.forEach(key => {
            const fieldObj = STUDENT_FIELDS.find(f => f.key === key);
            const label = fieldObj ? fieldObj.label : key;

            let val: any = "";
            if (key === "StudentCode") val = student.studentCode;
            else if (key === "FullName") val = student.fullName;
            else if (key === "Gender") val = student.gender;
            else if (key === "DateOfBirth") val = student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString("vi-VN") : "";
            else if (key === "FacultyCode") val = student.facultyCode;
            else if (key === "DepartmentCode") val = student.departmentCode;
            else if (key === "ClassCode") val = student.classCode;
            else if (key === "EnrollmentYear") val = student.enrollmentYear;
            else if (key === "GraduationYear") val = student.graduationYear;
            else if (key === "GPA") val = student.gpa;
            else if (key === "AcademicStanding") val = student.academicStanding;
            else if (key === "StudentEmail") val = student.studentEmail;
            else if (key === "PhoneNumber") val = student.phoneNumber;
            else if (key === "Address") val = student.address;
            else if (key === "Status") val = student.status;
            else if (key === "Notes") val = student.notes;
            else if (key === "TopicTitle" || key === "SupervisorName" || key === "TopicStatus") {
              const topic = getStudentRegistrationInfo(student.studentCode);
              if (key === "TopicTitle") val = topic ? topic.title : "Chưa đăng ký";
              else if (key === "SupervisorName") {
                if (topic) {
                  const lecturer = allLecturers.find(l => l.lecturerCode === topic.supervisorLecturerCode);
                  val = lecturer ? lecturer.fullName : (topic.supervisorLecturerCode || "Chưa phân công");
                } else {
                  val = "Chưa phân công";
                }
              }
              else if (key === "TopicStatus") val = topic ? mapApiStatusToDisplay(topic.status) : "Chưa đăng ký";
            }
            rowData[label] = val ?? "";
          });

          return rowData;
        });

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Danh sách");

        // Auto-fit column widths
        const maxLens = fieldsToExport.map(key => {
          const label = STUDENT_FIELDS.find(f => f.key === key)?.label || key;
          return label.length;
        });
        rows.forEach(row => {
          Object.keys(row).forEach((colName, colIdx) => {
            const valStr = String(row[colName] || "");
            if (valStr.length > maxLens[colIdx]) {
              maxLens[colIdx] = valStr.length;
            }
          });
        });
        worksheet["!cols"] = maxLens.map(len => ({ wch: Math.min(50, Math.max(12, len + 3)) }));

        const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const blob = new Blob([arrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;

        const dateStr = new Date().toISOString().split('T')[0];
        const selectedPeriod = periods.find(p => p.defenseTermId === selectedPeriodId);
        const termSuffix = selectedPeriod?.name?.replace(/\s+/g, "_") || 'period';

        let reportPrefix = "danh_sach_sinh_vien_trong_dot";
        if (studentFilter === "has-topic") reportPrefix = "danh_sach_sinh_vien_da_co_de_tai";
        else if (studentFilter === "no-topic") reportPrefix = "danh_sach_sinh_vien_chua_co_de_tai";

        const fileName = `${reportPrefix}_${termSuffix}_${dateStr}.xlsx`;
        link.download = fileName;

        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);
        addToast(`Đã tải xuống: ${item.label} (Excel)`, "success");
      } catch (err: any) {
        addToast(`Không thể tạo file báo cáo: ${err.message}`, "error");
      } finally {
        setIsExporting(false);
      }
      return;
    }

    const reportType = item.key;
    const isSpecial = ["students", "lecturers", "assigned-topics", "lecturers-grouped-students"].includes(reportType);
    let baseUrl = "";

    if (isSpecial) {
      baseUrl = `/defense-periods/${selectedPeriodId}/exports/${reportType}`;
    } else {
      baseUrl = `/defense-periods/${selectedPeriodId}/reports/export`;
    }

    const params = new URLSearchParams();
    params.set("format", format);
    if (reportType && !isSpecial) params.set("reportType", reportType);
    if (fields && fields.length > 0) params.set("fields", fields.join(","));

    const url = normalizeUrl(`${baseUrl}?${params.toString()}`);
    const token = getAccessToken();

    setIsExporting(true);

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

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json") || contentType.includes("text/html")) {
        const text = await response.text();
        let errorMessage = "Yêu cầu không hợp lệ từ máy chủ.";
        try {
          const errorData = JSON.parse(text);
          errorMessage = readEnvelopeData<string>(errorData) || errorMessage;
          if (contentType.includes("text/html")) {
            errorMessage = "Lỗi hệ thống: Máy chủ trả về HTML thay vì file. Có thể sai đường dẫn API.";
          }
        } catch (e) { }
        addToast(errorMessage, "error");
        return;
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      const dateStr = new Date().toISOString().split('T')[0];
      const selectedPeriod = periods.find(p => p.defenseTermId === selectedPeriodId);
      const termSuffix = (selectedPeriod as any)?.termCode || selectedPeriod?.name?.replace(/\s+/g, "_") || 'period';
      const fileName = `${item.key}_${termSuffix}_${dateStr}.${format}`;
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
      setIsExporting(false);
    }
  };

  const [allStudents, setAllStudents] = useState<StudentProfile[]>([]);
  const [allLecturers, setAllLecturers] = useState<LecturerProfile[]>([]);
  const [allTopicsList, setAllTopicsList] = useState<Topic[]>([]);
  const [topicMilestones, setTopicMilestones] = useState<Record<number, any>>({});
  const [isStudentsLoading, setIsStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);

  // Auto assign preview states
  const [autoAssignPreview, setAutoAssignPreview] = useState<AutoAssignPreviewDto[]>([]);
  const [isAutoAssignPreviewOpen, setIsAutoAssignPreviewOpen] = useState(false);
  const [autoAssignCurrentPage, setAutoAssignCurrentPage] = useState(1);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);

  // Manual assign states
  const [manualAssignModal, setManualAssignModal] = useState<{
    isOpen: boolean;
    student: StudentProfile | null;
  }>({
    isOpen: false,
    student: null,
  });
  const [manualTopicTitle, setManualTopicTitle] = useState("");
  const [manualSupervisorCode, setManualSupervisorCode] = useState("");
  const [isManualAssigning, setIsManualAssigning] = useState(false);

  // Bulk manual assign states for overdue students
  const [isBulkManualModalOpen, setIsBulkManualModalOpen] = useState(false);
  const [bulkAssignments, setBulkAssignments] = useState<any[]>([]);
  const [catalogTopics, setCatalogTopics] = useState<any[]>([]);
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  const [bulkSearchTerm, setBulkSearchTerm] = useState("");

  // Filter and search states for registration tab
  const [regSearchTerm, setRegSearchTerm] = useState("");
  const [regStatusFilter, setRegStatusFilter] = useState<"all" | "has_topic" | "no_topic" | "pending_approval">("all");
  const [regCurrentPage, setRegCurrentPage] = useState(1);
  const [topicsCurrentPage, setTopicsCurrentPage] = useState(1);
  const [lecturerLoadCurrentPage, setLecturerLoadCurrentPage] = useState(1);

  // Lecturer Quota Edit Modal States
  const [editQuotaModal, setEditQuotaModal] = useState<{
    isOpen: boolean;
    lecturer: LecturerProfile | null;
    quotaValue: number;
    defenseQuotaValue: number;
  }>({
    isOpen: false,
    lecturer: null,
    quotaValue: 5,
    defenseQuotaValue: 5,
  });
  const [isQuotaSaving, setIsQuotaSaving] = useState(false);

  const renderPagination = (
    page: number,
    totalPages: number,
    onPageChange: (newPage: number) => void
  ) => {
    if (totalPages <= 1) return null;
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "8px",
          marginTop: "24px",
          padding: "16px",
        }}
      >
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          title="Trang trước"
          style={{
            padding: "8px 12px",
            background: page === 1 ? "#F3F4F6" : "#FFFFFF",
            color: page === 1 ? "#9CA3AF" : "#374151",
            border: "1px solid #D1D5DB",
            borderRadius: "6px",
            cursor: page === 1 ? "not-allowed" : "pointer",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <ChevronLeft size={16} />
          Trước
        </button>

        <div style={{ display: "flex", gap: "4px" }}>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (page <= 3) {
              pageNum = i + 1;
            } else if (page >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = page - 2 + i;
            }

            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                title={`Đến trang ${pageNum}`}
                style={{
                  padding: "8px 12px",
                  background: page === pageNum ? "#1e3a5f" : "#FFFFFF",
                  color: page === pageNum ? "white" : "#374151",
                  border: "1px solid #D1D5DB",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  minWidth: "40px",
                }}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          title="Trang sau"
          style={{
            padding: "8px 12px",
            background: page === totalPages ? "#F3F4F6" : "#FFFFFF",
            color: page === totalPages ? "#9CA3AF" : "#374151",
            border: "1px solid #D1D5DB",
            borderRadius: "6px",
            cursor: page === totalPages ? "not-allowed" : "pointer",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          Sau
          <ChevronRight size={16} />
        </button>
      </div>
    );
  };

  useEffect(() => {
    setRegCurrentPage(1);
  }, [regSearchTerm, regStatusFilter]);

  useEffect(() => {
    setTopicsCurrentPage(1);
  }, [topicsSearchTerm, topicsTypeFilter, topicsStatusFilter]);

  useEffect(() => {
    setLecturerLoadCurrentPage(1);
  }, [lecturerLoadSearchTerm, lecturerLoadDeptFilter]);

  const getStudentRegistrationInfo = useCallback((studentCode: string) => {
    const studentTopic = allTopicsList.find(
      (t) => t.proposerStudentCode === studentCode && t.status.toLowerCase() !== "rejected"
    ) || null;
    return studentTopic;
  }, [allTopicsList]);

  const registeredCount = useMemo(() => {
    return allStudents.filter(s => getStudentRegistrationInfo(s.studentCode) !== null).length;
  }, [allStudents, getStudentRegistrationInfo]);

  const overdueCount = useMemo(() => {
    return allStudents.filter(s => getStudentRegistrationInfo(s.studentCode) === null).length;
  }, [allStudents, getStudentRegistrationInfo]);

  const completionPercent = useMemo(() => {
    if (allStudents.length === 0) return 0;
    return Math.round((registeredCount / allStudents.length) * 100);
  }, [allStudents.length, registeredCount]);

  const sortedLecturers = useMemo(() => {
    if (!manualAssignModal.student) return allLecturers;
    const deptCode = manualAssignModal.student.departmentCode;
    return [...allLecturers].sort((a, b) => {
      const aSameDept = a.departmentCode === deptCode ? 1 : 0;
      const bSameDept = b.departmentCode === deptCode ? 1 : 0;
      return bSameDept - aSameDept;
    });
  }, [allLecturers, manualAssignModal.student]);

  const filteredStudents = useMemo(() => {
    return allStudents.filter((student) => {
      const topic = getStudentRegistrationInfo(student.studentCode);
      const isRegistered = topic !== null;

      // Status filter
      if (regStatusFilter === "has_topic" && !isRegistered) return false;
      if (regStatusFilter === "no_topic" && isRegistered) return false;
      if (regStatusFilter === "pending_approval") {
        if (!isRegistered) return false;
        if (topic.type !== "SELF" || mapApiStatusToDisplay(topic.status) !== "Chờ duyệt") return false;
      }

      // Search term
      const search = regSearchTerm.trim().toLowerCase();
      if (!search) return true;

      const studentName = (student.fullName || "").toLowerCase();
      const studentCode = (student.studentCode || "").toLowerCase();
      const classCode = (student.classCode || "").toLowerCase();
      const deptCode = (student.departmentCode || "").toLowerCase();
      const topicTitle = topic ? (topic.title || "").toLowerCase() : "";
      const supervisorLecturerCode = topic ? topic.supervisorLecturerCode : null;
      const lecturer = allLecturers.find(l => l.lecturerCode === supervisorLecturerCode);
      const supervisorName = lecturer ? lecturer.fullName.toLowerCase() : (supervisorLecturerCode || "").toLowerCase();

      return (
        studentName.includes(search) ||
        studentCode.includes(search) ||
        classCode.includes(search) ||
        deptCode.includes(search) ||
        topicTitle.includes(search) ||
        supervisorName.includes(search)
      );
    });
  }, [allStudents, getStudentRegistrationInfo, regSearchTerm, regStatusFilter]);

  const mapApiStatusToDisplay = useCallback(
    (apiStatus: string): TopicDisplay["status"] => {
      const status = apiStatus.toLowerCase();
      switch (status) {
        case "approved":
        case "đã duyệt":
          return "Đã duyệt";
        case "rejected":
        case "từ chối":
          return "Từ chối";
        case "revision":
        case "cần sửa đổi":
          return "Cần sửa đổi";
        case "pending":
        case "đang chờ":
        case "chờ duyệt":
          return "Chờ duyệt";
        default:
          return "Đã duyệt";
      }
    },
    [],
  );

  // Fetch stats for all topics (not filtered)
  const fetchStats = useCallback(async () => {
    try {
      if (!selectedPeriodId) {
        setStats({
          total: 0,
          approved: 0,
          pending: 0,
          rejected: 0,
          revision: 0,
        });
        return;
      }

      if (currentLecturerOnly && !currentLecturerCode) {
        setStats({
          total: 0,
          approved: 0,
          pending: 0,
          rejected: 0,
          revision: 0,
        });
        return;
      }

      const lecturerFilter =
        currentLecturerOnly && currentLecturerCode
          ? `&SupervisorLecturerCode=${encodeURIComponent(currentLecturerCode)}`
          : "";

      const statsResponse = await fetchData<{
        data: Topic[];
        totalCount: number;
      }>(`/Topics/get-list?Page=1&PageSize=1000&DefenseTermId=${selectedPeriodId}${lecturerFilter}`); // Get a large number to count all

      const allTopics = statsResponse.data || [];
      setAllTopicsList(allTopics);

      // Fetch progress milestones for this defense term
      try {
        const milestonesRes = await fetchData<ApiResponse<any[]>>(
          `/ProgressMilestones/get-list?Page=1&PageSize=1000&DefenseTermId=${selectedPeriodId}`
        );
        if (milestonesRes?.success && milestonesRes.data) {
          const grouped: Record<number, any> = {};
          milestonesRes.data.forEach((ms) => {
            const current = grouped[ms.topicID];
            if (!current || ms.ordinal > current.ordinal) {
              grouped[ms.topicID] = ms;
            }
          });
          setTopicMilestones(grouped);
        }
      } catch (err) {
        console.warn("Failed to fetch progress milestones:", err);
      }

      const statsData = {
        total: statsResponse.totalCount,
        approved: allTopics.filter(
          (t) => mapApiStatusToDisplay(t.status) === "Đã duyệt",
        ).length,
        pending: allTopics.filter(
          (t) => mapApiStatusToDisplay(t.status) === "Chờ duyệt",
        ).length,
        rejected: allTopics.filter(
          (t) => mapApiStatusToDisplay(t.status) === "Từ chối",
        ).length,
        revision: allTopics.filter(
          (t) => mapApiStatusToDisplay(t.status) === "Cần sửa đổi",
        ).length,
      };

      setStats(statsData);
    } catch (err) {
      console.warn("Failed to fetch stats:", err);
      // Keep existing stats or set to 0
    }
  }, [currentLecturerCode, currentLecturerOnly, mapApiStatusToDisplay, selectedPeriodId]);

  const fetchStudents = useCallback(async () => {
    if (!selectedPeriodId || currentLecturerOnly) return;
    try {
      setIsStudentsLoading(true);
      setStudentsError(null);
      const response = await fetchData<ApiResponse<StudentProfile[]>>(
        `/StudentProfiles/get-list?DefenseTermId=${selectedPeriodId}&Page=1&PageSize=1000`
      );
      if (response?.success && response.data) {
        setAllStudents(response.data);
      } else {
        setAllStudents([]);
      }
    } catch (err) {
      console.error("Failed to fetch students list:", err);
      setStudentsError("Không thể tải danh sách sinh viên.");
      setAllStudents([]);
    } finally {
      setIsStudentsLoading(false);
    }
  }, [selectedPeriodId, currentLecturerOnly]);

  const fetchLecturers = useCallback(async () => {
    if (!selectedPeriodId || currentLecturerOnly) return;
    try {
      const response = await fetchData<ApiResponse<LecturerProfile[]>>(
        `/LecturerProfiles/get-list?Page=1&PageSize=500&DefenseTermId=${selectedPeriodId}`
      );
      if (response?.success && response.data) {
        setAllLecturers(response.data);
      }
    } catch (err) {
      console.error("Failed to fetch lecturers:", err);
    }
  }, [selectedPeriodId, currentLecturerOnly]);

  useEffect(() => {
    if (selectedPeriodId && !currentLecturerOnly) {
      void fetchStudents();
      void fetchLecturers();
    }
  }, [selectedPeriodId, currentLecturerOnly, fetchStudents, fetchLecturers]);

  const handleAutoAssignPreview = async () => {
    if (!selectedPeriodId) return;
    try {
      setLoading(true);
      const response = await fetchData<ApiResponse<AutoAssignPreviewDto[]>>(
        "/Topics/auto-assign/preview",
        {
          method: "POST",
          body: { defenseTermId: selectedPeriodId },
        }
      );
      if (response?.success && response.data) {
        setAutoAssignPreview(response.data);
        setIsAutoAssignPreviewOpen(true);
        setAutoAssignCurrentPage(1);
        if (response.data.length === 0) {
          addToast("Tất cả sinh viên trong đợt bảo vệ hiện hành đều đã có đề tài!", "info");
        }
      } else {
        addToast(response?.message || "Không thể tải danh sách xem trước phân công.", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Lỗi khi chạy thuật toán phân công tự động.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoAssignConfirm = async () => {
    if (autoAssignPreview.length === 0) return;
    setIsAutoAssigning(true);
    try {
      const payload = autoAssignPreview.map(item => ({
        studentCode: item.studentCode,
        catalogTopicCode: item.catalogTopicCode || "",
        topicTitle: item.topicTitle,
        supervisorLecturerCode: item.supervisorLecturerCode,
      }));

      const response = await fetchData<ApiResponse<any>>(
        "/Topics/auto-assign/confirm",
        {
          method: "POST",
          body: payload,
        }
      );

      if (response?.success) {
        addToast(`Đã phân công tự động thành công cho ${autoAssignPreview.length} sinh viên!`, "success");
        setIsAutoAssignPreviewOpen(false);
        // Refresh statistics and list
        await fetchStudents();
        await fetchStats();
      } else {
        addToast(response?.message || "Phân công tự động thất bại.", "error");
      }
    } catch (err: any) {
      console.error("Confirm auto assign error:", err);
      addToast(err.message || "Lỗi khi lưu kết quả phân công tự động.", "error");
    } finally {
      setIsAutoAssigning(false);
    }
  };

  const handleManualAssignSubmit = async () => {
    if (!manualTopicTitle.trim()) {
      addToast("Vui lòng nhập tên đề tài chỉ định.", "warning");
      return;
    }
    if (!manualSupervisorCode) {
      addToast("Vui lòng chọn giảng viên hướng dẫn.", "warning");
      return;
    }
    if (!manualAssignModal.student || !selectedPeriodId) return;

    setIsManualAssigning(true);
    try {
      const payload = [
        {
          studentCode: manualAssignModal.student.studentCode,
          catalogTopicCode: "", // manual self-selected assignment
          topicTitle: manualTopicTitle.trim(),
          supervisorLecturerCode: manualSupervisorCode,
        }
      ];
      const response = await fetchData<ApiResponse<any>>(
        "/Topics/auto-assign/confirm",
        {
          method: "POST",
          body: payload,
        }
      );

      if (response?.success) {
        addToast(`Đã chỉ định đề tài cho sinh viên ${manualAssignModal.student.fullName} thành công!`, "success");
        setManualAssignModal({ isOpen: false, student: null });
        // Refresh statistics and list
        await fetchStudents();
        await fetchStats();
      } else {
        addToast(response?.message || "Chỉ định đề tài thất bại.", "error");
      }
    } catch (err: any) {
      console.error("Manual assign error:", err);
      addToast(err.message || "Không thể thực hiện chỉ định đề tài.", "error");
    } finally {
      setIsManualAssigning(false);
    }
  };

  const fetchCatalogTopics = async () => {
    try {
      const response = await fetchData<ApiResponse<any[]>>(
        "/CatalogTopics/get-list?Page=1&PageSize=500"
      );
      if (response?.success && response.data) {
        setCatalogTopics(response.data);
      }
    } catch (err) {
      console.error("Failed to fetch catalog topics:", err);
    }
  };

  const handleOpenBulkManualModal = () => {
    const overdueStudents = allStudents.filter(
      (s) => getStudentRegistrationInfo(s.studentCode) === null
    );

    if (overdueStudents.length === 0) {
      addToast("Tất cả sinh viên trong đợt hiện hành đều đã có đề tài!", "info");
      return;
    }

    void fetchCatalogTopics();
    setBulkSearchTerm("");
    setBulkAssignments(
      overdueStudents.map((student) => ({
        studentCode: student.studentCode,
        fullName: student.fullName,
        departmentCode: student.departmentCode || "",
        classCode: student.classCode || "",
        sourceType: "SELF",
        catalogTopicCode: "",
        topicTitle: `Đề tài tốt nghiệp - ${student.fullName}`,
        supervisorLecturerCode: "",
      }))
    );
    setIsBulkManualModalOpen(true);
  };

  const updateBulkAssignmentRow = (studentCode: string, field: string, value: any) => {
    setBulkAssignments((prev) =>
      prev.map((item) => {
        if (item.studentCode !== studentCode) return item;
        const updated = { ...item, [field]: value };
        if (field === "catalogTopicCode" && item.sourceType === "CATALOG") {
          const selectedCatalog = catalogTopics.find((c) => c.catalogTopicCode === value);
          if (selectedCatalog) {
            updated.topicTitle = selectedCatalog.title;
          }
        }
        if (field === "sourceType") {
          if (value === "CATALOG") {
            const deptCatalog = catalogTopics.find((c) => c.departmentCode === item.departmentCode) || catalogTopics[0];
            if (deptCatalog) {
              updated.catalogTopicCode = deptCatalog.catalogTopicCode;
              updated.topicTitle = deptCatalog.title;
            } else {
              updated.catalogTopicCode = "";
              updated.topicTitle = "";
            }
          } else {
            updated.catalogTopicCode = "";
            updated.topicTitle = `Đề tài tốt nghiệp - ${item.fullName}`;
          }
        }
        return updated;
      })
    );
  };

  const handleBulkManualSubmit = async () => {
    const invalidItem = bulkAssignments.find(
      (item) => !item.topicTitle.trim() || !item.supervisorLecturerCode
    );

    if (invalidItem) {
      addToast(
        `Vui lòng nhập tên đề tài và chọn giảng viên hướng dẫn cho sinh viên ${invalidItem.fullName}.`,
        "warning"
      );
      return;
    }

    setIsBulkAssigning(true);
    try {
      const payload = bulkAssignments.map((item) => ({
        studentCode: item.studentCode,
        catalogTopicCode: item.sourceType === "CATALOG" ? item.catalogTopicCode : "",
        topicTitle: item.topicTitle.trim(),
        supervisorLecturerCode: item.supervisorLecturerCode,
      }));

      const response = await fetchData<ApiResponse<any>>(
        "/Topics/auto-assign/confirm",
        {
          method: "POST",
          body: payload,
        }
      );

      if (response?.success) {
        addToast(
          `Đã chỉ định thủ công đề tài thành công cho ${bulkAssignments.length} sinh viên quá hạn!`,
          "success"
        );
        setIsBulkManualModalOpen(false);
        await fetchStudents();
        await fetchStats();
      } else {
        addToast(response?.message || "Lưu phân công thủ công thất bại.", "error");
      }
    } catch (err: any) {
      console.error("Bulk manual assign error:", err);
      addToast(err.message || "Lỗi hệ thống khi lưu phân công thủ công.", "error");
    } finally {
      setIsBulkAssigning(false);
    }
  };

  const handleExportCSV = (type: "all" | "has_topic" | "no_topic") => {
    let list = allStudents;
    if (type === "has_topic") {
      list = allStudents.filter(s => getStudentRegistrationInfo(s.studentCode) !== null);
    } else if (type === "no_topic") {
      list = allStudents.filter(s => getStudentRegistrationInfo(s.studentCode) === null);
    }

    if (list.length === 0) {
      addToast("Không có dữ liệu để xuất báo cáo.", "warning");
      return;
    }

    const headers: string[] = [];
    if (selectedExportFields.includes("STT")) headers.push("STT");
    if (selectedExportFields.includes("studentCode")) headers.push("Mã Sinh Viên");
    if (selectedExportFields.includes("fullName")) headers.push("Họ và Tên");
    if (selectedExportFields.includes("classCode")) headers.push("Lớp");
    if (selectedExportFields.includes("departmentCode")) headers.push("Khoa");
    if (selectedExportFields.includes("status")) headers.push("Trạng Thái Đăng Ký");
    if (selectedExportFields.includes("topicTitle")) headers.push("Tên Đề Tài");
    if (selectedExportFields.includes("supervisorName")) headers.push("Giảng Viên Hướng Dẫn");

    const rows = list.map((student, index) => {
      const topic = getStudentRegistrationInfo(student.studentCode);
      const rowData: any[] = [];

      if (selectedExportFields.includes("STT")) {
        rowData.push(index + 1);
      }
      if (selectedExportFields.includes("studentCode")) {
        rowData.push(student.studentCode || "");
      }
      if (selectedExportFields.includes("fullName")) {
        rowData.push(student.fullName || "");
      }
      if (selectedExportFields.includes("classCode")) {
        rowData.push(student.classCode || "");
      }
      if (selectedExportFields.includes("departmentCode")) {
        rowData.push(student.departmentCode || "");
      }
      if (selectedExportFields.includes("status")) {
        rowData.push(topic ? "Đã đăng ký đề tài" : "Chưa có đề tài (Quá hạn)");
      }
      if (selectedExportFields.includes("topicTitle")) {
        rowData.push(topic ? topic.title : "");
      }
      if (selectedExportFields.includes("supervisorName")) {
        const supervisorLecturerCode = topic ? topic.supervisorLecturerCode : null;
        const lecturer = allLecturers.find(l => l.lecturerCode === supervisorLecturerCode);
        rowData.push(topic ? (lecturer ? lecturer.fullName : (supervisorLecturerCode || "")) : "");
      }

      return rowData;
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const fileSuffix = type === "all" ? "tong-hop" : type === "has_topic" ? "da-co-de-tai" : "chua-co-de-tai";
    const fileName = `bao-cao-phan-cong-${fileSuffix}-${dateStr}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast(`Đã xuất báo cáo CSV thành công.`, "success");
  };

  useEffect(() => {
    const resolveLecturerCode = async () => {
      if (!currentLecturerOnly) {
        setCurrentLecturerCode("");
        return;
      }

      if (!user?.userCode) {
        setCurrentLecturerCode("");
        return;
      }

      try {
        const lecturerProfileResponse = await fetchData<
          ApiResponse<LecturerProfile[]>
        >(
          `/LecturerProfiles/get-list?UserCode=${encodeURIComponent(
            user.userCode,
          )}`,
        );

        const lecturerCode =
          lecturerProfileResponse?.data?.[0]?.lecturerCode?.trim() || "";
        setCurrentLecturerCode(lecturerCode);

        if (!lecturerCode) {
          setError("Không tìm thấy mã giảng viên cho tài khoản hiện tại.");
        }
      } catch (err) {
        console.error("Failed to resolve lecturer code:", err);
        setCurrentLecturerCode("");
        setError("Không thể xác định thông tin giảng viên hiện tại.");
      }
    };

    void resolveLecturerCode();
  }, [currentLecturerOnly, user?.userCode]);

  // Build API URL based on status filter
  const buildApiUrl = (
    status: string,
    search: string,
    page: number,
    size: number,
    supervisorLecturerCode?: string,
  ): string => {
    let url = `/Topics/get-list?Page=${page}&PageSize=${size}&SortBy=createdAt&SortOrder=desc&Type=SELF`;

    if (selectedPeriodId) {
      url += `&DefenseTermId=${selectedPeriodId}`;
    }

    if (supervisorLecturerCode) {
      url += `&SupervisorLecturerCode=${encodeURIComponent(
        supervisorLecturerCode,
      )}`;
    }

    if (search.trim()) {
      url += `&Search=${encodeURIComponent(search.trim())}`;
    }

    if (status !== "all") {
      const statusMap: { [key: string]: string } = {
        "Chờ duyệt": "Đang chờ",
        "Đã duyệt": "Đã duyệt",
        "Cần sửa đổi": "Cần sửa đổi",
        "Từ chối": "Từ chối",
      };

      const encodedStatus = encodeURIComponent(statusMap[status] || status);
      url += `&Status=${encodedStatus}`;
    }

    return url;
  };

  // Fetch topics for the lecturer
  useEffect(() => {
    const fetchTopics = async () => {
      if (!user?.userCode) return;

      if (!selectedPeriodId) {
        setTopics([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      if (currentLecturerOnly && !currentLecturerCode) {
        setTopics([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const apiUrl = buildApiUrl(
          statusFilter,
          searchTerm,
          currentPage,
          pageSize,
          currentLecturerOnly ? currentLecturerCode : undefined,
        );
        const topicsResponse = await fetchData<{
          data: Topic[];
          totalCount: number;
        }>(apiUrl);

        setTotalCount(topicsResponse.totalCount);

        // Collect all unique student codes and lecturer codes
        const studentCodes = [
          ...new Set(
            topicsResponse.data
              .map((topic) => topic.proposerStudentCode)
              .filter((code) => code),
          ),
        ];
        const lecturerCodes = [
          ...new Set(
            topicsResponse.data
              .map((topic) => topic.supervisorLecturerCode)
              .filter((code) => code),
          ),
        ];

        // Fetch all student profiles in one request
        const studentProfilesMap: { [key: string]: StudentProfile } = {};
        if (studentCodes.length > 0) {
          try {
            const studentCodesParam = studentCodes
              .map((code) => `StudentCodes=${encodeURIComponent(code)}`)
              .join("&");
            const studentResponse = await fetchData<{
              data: StudentProfile[];
            }>(`/StudentProfiles/get-list?${studentCodesParam}`);
            studentResponse.data.forEach((profile) => {
              studentProfilesMap[profile.studentCode] = profile;
            });
          } catch (err) {
            console.warn("Failed to fetch student profiles:", err);
          }
        }

        // Fetch all lecturer profiles in one request
        const lecturerProfilesMap: { [key: string]: LecturerProfile } = {};
        if (lecturerCodes.length > 0) {
          try {
            const lecturerCodesParam = lecturerCodes
              .filter((code) => code) // Filter out null/undefined values
              .map((code) => `LecturerCodes=${encodeURIComponent(code!)}`)
              .join("&");
            const lecturerResponse = await fetchData<{
              data: LecturerProfile[];
            }>(`/LecturerProfiles/get-list?${lecturerCodesParam}`);
            lecturerResponse.data.forEach((profile) => {
              lecturerProfilesMap[profile.lecturerCode] = profile;
            });
          } catch (err) {
            console.warn("Failed to fetch lecturer profiles:", err);
          }
        }

        // Transform topics to display format
        const displayTopics: TopicDisplay[] = topicsResponse.data
          .map((topic) => {
            const studentProfile =
              studentProfilesMap[topic.proposerStudentCode || ""];
            const lecturerProfile =
              lecturerProfilesMap[topic.supervisorLecturerCode || ""] || null;

            return {
              topicID: topic.topicID,
              topicCode: topic.topicCode,
              catalogTopicCode: topic.catalogTopicCode,
              title: topic.title,
              description: topic.summary, // Using summary as description
              studentCode: topic.proposerStudentCode || "",
              studentName: studentProfile?.fullName || "Unknown",
              submissionDate: topic.createdAt,
              status: mapApiStatusToDisplay(topic.status),
              category:
                topic.type === "CATALOG" ? "Đề tài catalog" : "Đề tài tự chọn",
              comments: topic.lecturerComment || "", // Include lecturer comments from API
              studentProfile,
              supervisorLecturerProfileID: topic.supervisorLecturerProfileID,
              supervisorLecturerCode: topic.supervisorLecturerCode,
              lecturerProfile,
            };
          })
          .sort((a, b) => {
            // Prioritize "Chờ duyệt" status
            if (a.status === "Chờ duyệt" && b.status !== "Chờ duyệt") return -1;
            if (a.status !== "Chờ duyệt" && b.status === "Chờ duyệt") return 1;

            // Then sort by submission date (newest first)
            return (
              new Date(b.submissionDate).getTime() -
              new Date(a.submissionDate).getTime()
            );
          });

        setTopics(displayTopics);
      } catch (err) {
        console.error("Failed to fetch topics:", err);
        setError("Không thể tải danh sách đề tài. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    };

    fetchTopics();
    fetchStats(); // Fetch stats whenever topics change
  }, [
    currentLecturerOnly,
    currentLecturerCode,
    user?.userCode,
    statusFilter,
    searchTerm,
    searchTrigger,
    currentPage,
    pageSize,
    mapApiStatusToDisplay,
    fetchStats,
    selectedPeriodId,
  ]);

  const syncTopicFromWorkflow = useCallback(
    async (topicID: number) => {
      const [detail, timeline] = await Promise.all([
        getTopicWorkflowDetail(topicID),
        getTopicWorkflowTimeline(topicID),
      ]);

      const status = mapApiStatusToDisplay(detail.topic.status);

      setTopics((prev) =>
        prev.map((topic) =>
          topic.topicID === topicID
            ? {
              ...topic,
              title: detail.topic.title,
              description: detail.topic.summary,
              status,
              comments:
                detail.latestLecturerComment ||
                detail.topic.lecturerComment ||
                topic.comments,
            }
            : topic,
        ),
      );

      // Timeline is re-fetched to keep workflow state synchronized.
      void timeline;
    },
    [mapApiStatusToDisplay],
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Đã duyệt":
        return <CheckCircle size={16} color="#22C55E" />;
      case "Chờ duyệt":
        return <Clock size={16} color="#F59E0B" />;
      case "Từ chối":
        return <AlertCircle size={16} color="#EF4444" />;
      case "Cần sửa đổi":
        return <Edit size={16} color="#F59E0B" />;
      default:
        return <CheckCircle size={16} color="#22C55E" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "Đã duyệt":
        return "Đã duyệt";
      case "Chờ duyệt":
        return "Chờ duyệt";
      case "Từ chối":
        return "Từ chối";
      case "Cần sửa đổi":
        return "Cần sửa đổi";
      default:
        return "Đã duyệt";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Đã duyệt":
        return "#22C55E";
      case "Chờ duyệt":
        return "#F59E0B";
      case "Từ chối":
        return "#EF4444";
      case "Cần sửa đổi":
        return "#F59E0B";
      default:
        return "#22C55E";
    }
  };

  const handleApprove = async (topicID: number) => {
    try {
      setUpdatingStatus(`approve-${topicID}`);
      await decideTopicWorkflow(topicID, {
        action: "approve",
        comment: "Đề tài đạt yêu cầu",
      });
      await syncTopicFromWorkflow(topicID);

      showSuccessModal(
        "approve",
        topics.find((t) => t.topicID === topicID)?.title || "",
      );

      // Reload page after successful approval
      window.location.reload();
    } catch (err) {
      console.error("Failed to approve topic:", err);
      addToast("Không thể duyệt đề tài. Vui lòng thử lại.", "error");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleReject = async (topicID: number, comment: string) => {
    try {
      setUpdatingStatus(`reject-${topicID}`);

      await decideTopicWorkflow(topicID, {
        action: "reject",
        comment,
      });
      await syncTopicFromWorkflow(topicID);

      showSuccessModal(
        "reject",
        topics.find((t) => t.topicID === topicID)?.title || "",
      );

      // Reload page after successful rejection
      window.location.reload();
    } catch (err) {
      console.error("Failed to reject topic:", err);
      addToast("Không thể từ chối đề tài. Vui lòng thử lại.", "error");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleRequestRevision = async (topicID: number, comment: string) => {
    try {
      setUpdatingStatus(`revision-${topicID}`);

      await decideTopicWorkflow(topicID, {
        action: "revision",
        comment,
      });
      await syncTopicFromWorkflow(topicID);

      showSuccessModal(
        "revision",
        topics.find((t) => t.topicID === topicID)?.title || "",
      );

      // Reload page after successful revision request
      window.location.reload();
    } catch (err) {
      console.error("Failed to request revision:", err);
      addToast("Không thể yêu cầu sửa đổi đề tài. Vui lòng thử lại.", "error");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const openCommentModal = (
    action: "reject" | "revision",
    topicID: number,
    topicTitle: string,
  ) => {
    setCommentModal({
      isOpen: true,
      action,
      topicID,
      topicTitle,
    });
    setCommentText("");
  };

  const closeCommentModal = () => {
    setCommentModal({
      isOpen: false,
      action: null,
      topicID: null,
      topicTitle: "",
    });
    setCommentText("");
  };

  const openViewCommentModal = (comments: string, topicTitle: string) => {
    setViewCommentModal({
      isOpen: true,
      comments,
      topicTitle,
    });
  };

  const closeViewCommentModal = () => {
    setViewCommentModal({
      isOpen: false,
      comments: "",
      topicTitle: "",
    });
  };

  const handleCommentSubmit = async () => {
    if (!commentModal.topicID || !commentModal.action || !commentText.trim())
      return;

    try {
      if (commentModal.action === "reject") {
        await handleReject(commentModal.topicID, commentText.trim());
      } else if (commentModal.action === "revision") {
        await handleRequestRevision(commentModal.topicID, commentText.trim());
      }
      closeCommentModal();
    } catch {
      // Error handling is done in the individual functions
    }
  };

  const openConfirmationModal = (topic: TopicDisplay) => {
    setConfirmationModal({
      isOpen: true,
      topic,
    });
  };

  const closeConfirmationModal = () => {
    setConfirmationModal({
      isOpen: false,
      topic: null,
    });
  };

  const handleConfirmApprove = async () => {
    if (!confirmationModal.topic) return;

    try {
      await handleApprove(confirmationModal.topic.topicID);
      closeConfirmationModal();
      showSuccessModal("approve", confirmationModal.topic.title);
    } catch {
      // Error handling is done in handleApprove
    }
  };

  const showSuccessModal = (
    action: "approve" | "reject" | "revision",
    topicTitle: string,
  ) => {
    setSuccessModal({
      isOpen: true,
      action,
      topicTitle,
    });
  };

  const closeSuccessModal = () => {
    setSuccessModal({
      isOpen: false,
      action: null,
      topicTitle: "",
    });
  };

  const handleStatusFilterChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setCurrentPage(1); // Reset to first page when changing filter
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const getFileIconAndColor = (fileName: string) => {
    const ext = (fileName || "").split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return {
          icon: <FileText size={14} color="#ef4444" />,
          label: "PDF",
          color: "#ef4444"
        };
      case "xlsx":
      case "xls":
      case "csv":
        return {
          icon: <FileSpreadsheet size={14} color="#10b981" />,
          label: "Excel",
          color: "#10b981"
        };
      case "zip":
      case "rar":
      case "7z":
      case "tar":
      case "gz":
        return {
          icon: <FileArchive size={14} color="#eab308" />,
          label: "Zip",
          color: "#eab308"
        };
      case "png":
      case "jpg":
      case "jpeg":
      case "gif":
      case "webp":
      case "svg":
        return {
          icon: <FileImage size={14} color="#3b82f6" />,
          label: "Hình ảnh",
          color: "#3b82f6"
        };
      case "doc":
      case "docx":
        return {
          icon: <FileText size={14} color="#2563eb" />,
          label: "Word",
          color: "#2563eb"
        };
      default:
        return {
          icon: <File size={14} color="#64748b" />,
          label: "Tệp",
          color: "#64748b"
        };
    }
  };

  const calculateProgress = (milestones: ProgressMilestone[]): number => {
    if (milestones.length === 0) return 0;
    const m = milestones[0];
    let completedCount = 0;
    if (m.completedAt1) completedCount++;
    if (m.completedAt2) completedCount++;
    if (m.completedAt3) completedCount++;
    if (m.completedAt4) completedCount++;
    if (m.state === "WaitingForCommittee") return 100;
    return Math.round((completedCount / 4) * 100);
  };

  const calculateStats = (
    milestones: ProgressMilestone[],
    submissions: ProgressSubmission[],
  ) => {
    if (milestones.length === 0)
      return { onTimeRate: 100, revisionCount: 0, daysRemaining: null };

    const revisionCount = submissions.filter(
      (s) =>
        s.attemptNumber > 1 || s.lecturerState === "REVISION_REQUIRED",
    ).length;

    const totalChecks = submissions.length;
    const onTimeCount = submissions.length;
    const onTimeRate =
      totalChecks > 0 ? Math.round((onTimeCount / totalChecks) * 100) : 100;

    const sortedMilestones = [...milestones].sort(
      (a, b) => (a.ordinal || 0) - (b.ordinal || 0),
    );
    const nextMilestone = sortedMilestones.find((m) => m.state !== "completed");

    let daysRemaining = null;
    if (nextMilestone?.deadline) {
      const diffTime =
        new Date(nextMilestone.deadline).getTime() - new Date().getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    return { onTimeRate, revisionCount, daysRemaining };
  };

  const openDetailModal = async (topic: TopicDisplay) => {
    setDetailModal({
      isOpen: true,
      topic,
    });
    setIsDetailLoading(true);
    setDetailMilestones([]);
    setDetailSubmissions([]);

    try {
      const tagPromise = (async () => {
        try {
          const detail = await getTopicWorkflowDetail(topic.topicID);
          const tagCodes = detail.tagCodes || [];

          if (tagCodes.length > 0) {
            const tagPromises = tagCodes.map(async (code) => {
              try {
                const tagRes = await fetchData<ApiResponse<Tag[]>>(`/Tags/list?TagCode=${code}`);
                return tagRes.data?.[0] || null;
              } catch {
                return null;
              }
            });

            const tagResults = await Promise.all(tagPromises);
            return tagResults.filter((tag): tag is Tag => tag !== null);
          }
        } catch (error) {
          console.error("Error fetching topic tags:", error);
        }
        return [];
      })();

      const milestonePromise = (async () => {
        try {
          const res = await fetchData<ApiResponse<ProgressMilestone[]>>(
            `/ProgressMilestones/get-list?TopicID=${topic.topicID}&Page=1&PageSize=100`
          );
          return res.data || [];
        } catch (error) {
          console.error("Error fetching milestones:", error);
          return [];
        }
      })();

      const submissionPromise = (async () => {
        try {
          if (!topic.studentCode) return [];
          const res = await fetchData<ApiResponse<ProgressSubmission[]>>(
            `/ProgressSubmissions/get-list?StudentUserCode=${encodeURIComponent(topic.studentCode)}&Page=1&PageSize=100`
          );
          const subs = res.data || [];

          return await Promise.all(
            subs.map(async (sub) => {
              try {
                const filesRes = await fetchData<ApiResponse<SubmissionFile[]>>(
                  `/SubmissionFiles/get-list?SubmissionID=${sub.submissionID}`
                );
                return { ...sub, files: filesRes.data || [] };
              } catch {
                return { ...sub, files: [] };
              }
            })
          );
        } catch (error) {
          console.error("Error fetching submissions:", error);
          return [];
        }
      })();

      const [tags, milestones, submissions] = await Promise.all([
        tagPromise,
        milestonePromise,
        submissionPromise,
      ]);

      setTopicTags(tags);
      setDetailMilestones(milestones.sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0)));
      setDetailSubmissions(submissions.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
    } catch (error) {
      console.error("Error in openDetailModal data fetching:", error);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const closeDetailModal = () => {
    setDetailModal({
      isOpen: false,
      topic: null,
    });
    setTopicTags([]);
    setAiAnalysis(null);
    setIsAnalyzing(false);
    setDetailMilestones([]);
    setDetailSubmissions([]);
    setIsDetailLoading(false);
  };

  const getMilestoneTitle = (milestone: ProgressMilestone) => {
    if (milestone.milestoneTemplateCode) {
      const code = milestone.milestoneTemplateCode.toUpperCase();
      if (code.includes("DE_CUONG") || code.includes("DC")) return "Báo cáo Đề cương chi tiết";
      if (code.includes("GIUA_KY") || code.includes("GK")) return "Báo cáo Tiến độ Giữa kỳ";
      if (code.includes("CUOI_KY") || code.includes("CK")) return "Báo cáo Tổng kết Cuối kỳ";
      if (code.includes("SO_KHAO") || code.includes("SK")) return "Báo cáo Sơ khảo";
      if (code.includes("BAO_VE") || code.includes("BV")) return "Báo cáo Bảo vệ";
      return milestone.milestoneTemplateCode;
    }
    return `Báo cáo Tiến độ Mốc ${milestone.ordinal || 1}`;
  };

  const getMilestoneStateColor = (state: string) => {
    switch (state.toUpperCase()) {
      case "APPROVED":
        return { bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46" };
      case "FAILED":
        return { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" };
      case "REVISION":
        return { bg: "#fffbeb", border: "#fde68a", text: "#92400e" };
      case "SUBMITTED":
        return { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af" };
      case "PENDING":
      default:
        return { bg: "#f8fafc", border: "#cbd5e1", text: "#475569" };
    }
  };

  const getMilestoneStateLabel = (state: string) => {
    switch (state.toUpperCase()) {
      case "APPROVED":
        return "Hoàn thành (Đạt)";
      case "FAILED":
        return "Trễ hạn / Không đạt";
      case "REVISION":
        return "Cần sửa đổi";
      case "SUBMITTED":
        return "Đã nộp báo cáo";
      case "PENDING":
      default:
        return "Chờ nộp";
    }
  };

  const getSubmissionStateColor = (state: string) => {
    switch (state.toUpperCase()) {
      case "APPROVED":
      case "ACCEPT":
      case "ĐẠT":
        return { bg: "#ecfdf5", border: "#10b981", text: "#065f46" };
      case "REJECTED":
      case "REJECT":
      case "KHÔNG ĐẠT":
        return { bg: "#fef2f2", border: "#ef4444", text: "#991b1b" };
      case "REVISION":
      case "YÊU CẦU SỬA ĐỔI":
        return { bg: "#fffbeb", border: "#f59e0b", text: "#92400e" };
      case "PENDING":
      default:
        return { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af" };
    }
  };

  const getSubmissionStateLabel = (state: string) => {
    switch (state.toUpperCase()) {
      case "APPROVED":
      case "ACCEPT":
      case "ĐẠT":
        return "Đã duyệt (Đạt)";
      case "REJECTED":
      case "REJECT":
      case "KHÔNG ĐẠT":
        return "Từ chối (Không đạt)";
      case "REVISION":
      case "YÊU CẦU SỬA ĐỔI":
        return "Cần chỉnh sửa";
      case "PENDING":
      default:
        return "Đang chờ duyệt";
    }
  };

  const handleAiAnalysis = async () => {
    if (!detailModal.topic) return;

    try {
      setIsAnalyzing(true);
      const response = await fetchData<ApiResponse<ThesisAiAnalysisResult>>("/thesis-ai/analyze", {
        method: "POST",
        body: JSON.stringify({
          title: detailModal.topic.title,
          description: detailModal.topic.description,
          techStack: "", // We can add this field later if available
          major: detailModal.topic.studentProfile?.departmentCode || "Công nghệ thông tin",
        }),
      });

      if (response.success && response.data) {
        setAiAnalysis(response.data);
      } else {
        addToast(response.message || "Không thể phân tích đề tài.", "error");
      }
    } catch (err) {
      console.error("AI Analysis error:", err);
      addToast("Lỗi kết nối khi phân tích AI.", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="dashboard-root" style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      <style>{`
        :root {
          --primary: #1e3a5f;
          --primary-light: #f0f6ff;
          --secondary: #1e3a8a;
          --text-main: #0f172a;
          --text-muted: #64748b;
          --bg-card: #ffffff;
          --radius-lg: 24px;
          --radius-md: 16px;
          --shadow-sm: 0 1px 3px rgba(0,0,0,0.1);
          --shadow-md: 0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05);
          --shadow-lg: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
        }

        .premium-card {
          background: var(--bg-card);
          border-radius: var(--radius-md);
          padding: 24px;
          border: 1px solid rgba(226, 232, 240, 0.8);
          box-shadow: var(--shadow-md);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 160px;
        }

        .premium-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
          border-color: var(--primary);
        }

        .stat-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }

        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .modal-content {
          animation: slideInUp 0.4s ease-out;
        }
        .smooth-scroll {
          scroll-behavior: smooth;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E2E8F0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #CBD5E1;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      {currentLecturerOnly ? (
        <>
          {/* Header */}
          <div style={{ marginBottom: "32px" }}>
            <h1
              style={{
                fontSize: "28px",
                fontWeight: "700",
                color: "#1a1a1a",
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <BookOpen size={32} color="#1e3a5f" />
              Quản lý đề tài
            </h1>
            <p style={{ fontSize: "14px", color: "#666" }}>
              Xem và duyệt các đề tài luận văn của sinh viên - Đợt hiện tại: <strong style={{ color: "#f37021" }}>{periods.find((p) => p.defenseTermId === selectedPeriodId)?.name || "Đang tải..."}</strong>
            </p>
          </div>

          {/* Toolbar */}
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "20px",
              marginBottom: "24px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              border: "1px solid #E5E7EB",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "16px",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              {/* Search Box */}
              <div style={{ flex: "1 1 400px", position: "relative" }}>
                <Search
                  size={18}
                  color="#9CA3AF"
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                />
                <input
                  type="text"
                  placeholder="Tìm kiếm tên đề tài, mã đề tài, sinh viên..."
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px 10px 40px",
                    border: "1px solid #D1D5DB",
                    borderRadius: "8px",
                    fontSize: "14px",
                    outline: "none",
                    transition: "all 0.2s ease",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#1e3a5f";
                    e.currentTarget.style.boxShadow =
                      "0 0 0 3px rgba(243, 112, 33, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#D1D5DB";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              {/* Filter Section */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>


                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Filter size={16} color="#6B7280" />
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #D1D5DB",
                      borderRadius: "8px",
                      fontSize: "14px",
                      cursor: "pointer",
                      outline: "none",
                      background: "white",
                      minWidth: "180px",
                    }}
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="Chờ duyệt">Chờ duyệt</option>
                    <option value="Đã duyệt">Đã duyệt</option>
                    <option value="Cần sửa đổi">Cần sửa đổi</option>
                    <option value="Từ chối">Từ chối</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div
              style={{
                background: "#FEE2E2",
                border: "1px solid #EF4444",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "24px",
                color: "#DC2626",
              }}
            >
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: "center", padding: "48px" }}>
              <Loader2
                size={32}
                color="#F59E0B"
                style={{ animation: "spin 1s linear infinite" }}
              />
              <p style={{ marginTop: "16px", color: "#666" }}>
                Đang tải danh sách đề tài...
              </p>
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "24px",
                  marginBottom: "32px",
                }}
              >
                <div className="premium-card">
                  <div>
                    <div className="stat-icon-wrapper" style={{ background: "rgba(30, 58, 95, 0.1)" }}>
                      <BookOpen size={24} color="#1e3a5f" />
                    </div>
                    <div style={{ fontSize: "14px", color: "#64748b", fontWeight: "600", marginBottom: "4px" }}>
                      Tổng đề tài
                    </div>
                    <div style={{ fontSize: "32px", fontWeight: "800", color: "#1e293b" }}>
                      {stats.total}
                    </div>
                  </div>
                  <div style={{ height: "4px", background: "#1e3a5f", borderRadius: "2px", width: "40%", marginTop: "12px" }} />
                </div>

                <div className="premium-card">
                  <div>
                    <div className="stat-icon-wrapper" style={{ background: "rgba(34, 197, 94, 0.1)" }}>
                      <CheckCircle size={24} color="#22C55E" />
                    </div>
                    <div style={{ fontSize: "14px", color: "#64748b", fontWeight: "600", marginBottom: "4px" }}>
                      Đã duyệt
                    </div>
                    <div style={{ fontSize: "32px", fontWeight: "800", color: "#1e293b" }}>
                      {stats.approved}
                    </div>
                  </div>
                  <div style={{ height: "4px", background: "#22C55E", borderRadius: "2px", width: "40%", marginTop: "12px" }} />
                </div>

                <div className="premium-card">
                  <div>
                    <div className="stat-icon-wrapper" style={{ background: "rgba(245, 158, 11, 0.1)" }}>
                      <Clock size={24} color="#F59E0B" />
                    </div>
                    <div style={{ fontSize: "14px", color: "#64748b", fontWeight: "600", marginBottom: "4px" }}>
                      Chờ duyệt
                    </div>
                    <div style={{ fontSize: "32px", fontWeight: "800", color: "#1e293b" }}>
                      {stats.pending}
                    </div>
                  </div>
                  <div style={{ height: "4px", background: "#F59E0B", borderRadius: "2px", width: "40%", marginTop: "12px" }} />
                </div>

                <div className="premium-card">
                  <div>
                    <div className="stat-icon-wrapper" style={{ background: "rgba(239, 68, 68, 0.1)" }}>
                      <AlertCircle size={24} color="#EF4444" />
                    </div>
                    <div style={{ fontSize: "14px", color: "#64748b", fontWeight: "600", marginBottom: "4px" }}>
                      Từ chối
                    </div>
                    <div style={{ fontSize: "32px", fontWeight: "800", color: "#1e293b" }}>
                      {stats.rejected}
                    </div>
                  </div>
                  <div style={{ height: "4px", background: "#EF4444", borderRadius: "2px", width: "40%", marginTop: "12px" }} />
                </div>

              </div>

              {/* Topics Table */}
              <div
                style={{
                  background: "white",
                  borderRadius: "24px",
                  border: "1px solid #D9E1F2",
                  padding: "20px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                }}
              >
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", fontSize: "14px" }}>
                    <thead>
                      <tr
                        style={{
                          borderBottom: "1px solid #E5ECFB",
                          background: "#F8FAFF",
                        }}
                      >
                        <th
                          style={{
                            padding: "12px 16px",
                            textAlign: "left",
                            fontWeight: "600",
                            color: "#1F3C88",
                          }}
                        >
                          Mã đề tài
                        </th>
                        <th
                          style={{
                            padding: "12px 16px",
                            textAlign: "left",
                            fontWeight: "600",
                            color: "#1F3C88",
                          }}
                        >
                          Tên đề tài
                        </th>
                        <th
                          style={{
                            padding: "12px 16px",
                            textAlign: "left",
                            fontWeight: "600",
                            color: "#1F3C88",
                            minWidth: "140px",
                          }}
                        >
                          Sinh viên
                        </th>
                        <th
                          style={{
                            padding: "12px 16px",
                            textAlign: "left",
                            fontWeight: "600",
                            color: "#1F3C88",
                            minWidth: "140px",
                          }}
                        >
                          Loại đề tài
                        </th>
                        <th
                          style={{
                            padding: "12px 16px",
                            textAlign: "left",
                            fontWeight: "600",
                            color: "#1F3C88",
                          }}
                        >
                          Ngày nộp
                        </th>
                        <th
                          style={{
                            padding: "12px 16px",
                            textAlign: "left",
                            fontWeight: "600",
                            color: "#1F3C88",
                            minWidth: "150px",
                          }}
                        >
                          Trạng thái
                        </th>
                        <th
                          style={{
                            padding: "12px 8px",
                            textAlign: "center",
                            fontWeight: "600",
                            color: "#1F3C88",
                            width: "120px",
                          }}
                        >
                          Hành động
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {topics.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            style={{
                              padding: "32px",
                              textAlign: "center",
                              color: "#4A5775",
                            }}
                          >
                            Không có đề tài nào
                          </td>
                        </tr>
                      ) : (
                        topics
                          .sort((a, b) => {
                            const priorityOrder = {
                              "Chờ duyệt": 1,
                              "Cần sửa đổi": 2,
                              "Đã duyệt": 3,
                              "Từ chối": 4,
                            };

                            const aPriority =
                              priorityOrder[
                              a.status as keyof typeof priorityOrder
                              ] || 5;
                            const bPriority =
                              priorityOrder[
                              b.status as keyof typeof priorityOrder
                              ] || 5;

                            return aPriority - bPriority;
                          })
                          .map((topic) => (
                            <tr
                              key={topic.topicID}
                              style={{
                                borderBottom: "1px solid #E5ECFB",
                                cursor: "pointer",
                                transition: "background 0.2s ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#F8FAFF";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "white";
                              }}
                            >
                              {/* Mã đề tài */}
                              <td
                                style={{
                                  padding: "12px 16px",
                                  fontWeight: "600",
                                  color: "#1F3C88",
                                }}
                              >
                                {topic.topicCode}
                              </td>

                              {/* Tên đề tài */}
                              <td
                                style={{
                                  padding: "12px 16px",
                                  color: "#1a1a1a",
                                  maxWidth: "300px",
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: "600",
                                    color: "#1F3C88",
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    lineHeight: "1.4",
                                    maxHeight: "2.8em", // line-height * 2
                                    marginBottom: "4px",
                                  }}
                                  title={topic.title}
                                >
                                  {topic.title}
                                </div>
                                {topic.lecturerProfile && (
                                  <div
                                    style={{
                                      fontSize: "12px",
                                      color: "#666",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      marginTop: "4px",
                                    }}
                                  >
                                    <User size={12} />
                                    GVHD: {topic.lecturerProfile.fullName}
                                  </div>
                                )}
                              </td>

                              {/* Sinh viên */}
                              <td
                                style={{
                                  padding: "12px 16px",
                                  color: "#4A5775",
                                  minWidth: "140px",
                                }}
                              >
                                <div style={{ fontWeight: "500" }}>
                                  {topic.studentName}
                                </div>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "#666",
                                    marginTop: "2px",
                                  }}
                                >
                                  {topic.studentCode}
                                </div>
                              </td>

                              {/* Loại đề tài */}
                              <td
                                style={{
                                  padding: "12px 16px",
                                  color: "#4A5775",
                                  minWidth: "150px",
                                }}
                              >
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "4px 8px",
                                    borderRadius: "12px",
                                    fontSize: "12px",
                                    fontWeight: "500",
                                    background:
                                      topic.category === "Đề tài catalog"
                                        ? "#E0F2FE"
                                        : "#FEF3C7",
                                    color:
                                      topic.category === "Đề tài catalog"
                                        ? "#0369A1"
                                        : "#92400E",
                                  }}
                                >
                                  {topic.category}
                                </span>
                              </td>

                              {/* Ngày nộp */}
                              <td
                                style={{
                                  padding: "12px 16px",
                                  color: "#4A5775",
                                  fontSize: "13px",
                                }}
                              >
                                {new Date(topic.submissionDate).toLocaleDateString(
                                  "vi-VN",
                                )}
                              </td>

                              {/* Trạng thái */}
                              <td
                                style={{
                                  padding: "12px 16px",
                                  minWidth: "140px",
                                }}
                              >
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "6px 12px",
                                    borderRadius: "20px",
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    background:
                                      topic.status === "Đã duyệt"
                                        ? "#DCFCE7"
                                        : topic.status === "Từ chối"
                                          ? "#FEE2E2"
                                          : topic.status === "Cần sửa đổi"
                                            ? "#FEF3C7"
                                            : "#FEF3C7",
                                    color:
                                      topic.status === "Đã duyệt"
                                        ? "#166534"
                                        : topic.status === "Từ chối"
                                          ? "#991B1B"
                                          : topic.status === "Cần sửa đổi"
                                            ? "#92400E"
                                            : "#92400E",
                                  }}
                                >
                                  {getStatusIcon(topic.status)}
                                  {getStatusText(topic.status)}
                                </span>
                              </td>

                              {/* Hành động */}
                              <td
                                style={{
                                  padding: "12px 16px",
                                  textAlign: "center",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "8px",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  {/* Nút xem chi tiết */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDetailModal(topic);
                                    }}
                                    title="Xem chi tiết đề tài"
                                    style={{
                                      padding: "8px",
                                      background: "#1F3C88",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "6px",
                                      fontSize: "14px",
                                      cursor: "pointer",
                                      transition: "all 0.2s ease",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      width: "32px",
                                      height: "32px",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = "#162B61";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = "#1F3C88";
                                    }}
                                  >
                                    <Eye size={16} />
                                  </button>

                                  {/* Nút hành động theo trạng thái */}
                                  {topic.status === "Chờ duyệt" && (
                                    <>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openConfirmationModal(topic);
                                        }}
                                        title="Duyệt đề tài"
                                        disabled={
                                          updatingStatus ===
                                          `approve-${topic.topicID}`
                                        }
                                        style={{
                                          padding: "8px",
                                          background:
                                            updatingStatus ===
                                              `approve-${topic.topicID}`
                                              ? "#9CA3AF"
                                              : "#22C55E",
                                          color: "white",
                                          border: "none",
                                          borderRadius: "6px",
                                          cursor:
                                            updatingStatus ===
                                              `approve-${topic.topicID}`
                                              ? "not-allowed"
                                              : "pointer",
                                          transition: "all 0.2s ease",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          width: "32px",
                                          height: "32px",
                                        }}
                                        onMouseEnter={(e) => {
                                          if (
                                            updatingStatus !==
                                            `approve-${topic.topicID}`
                                          ) {
                                            e.currentTarget.style.background =
                                              "#16A34A";
                                          }
                                        }}
                                        onMouseLeave={(e) => {
                                          if (
                                            updatingStatus !==
                                            `approve-${topic.topicID}`
                                          ) {
                                            e.currentTarget.style.background =
                                              "#22C55E";
                                          }
                                        }}
                                      >
                                        {updatingStatus ===
                                          `approve-${topic.topicID}` ? (
                                          <Loader2
                                            size={16}
                                            style={{
                                              animation: "spin 1s linear infinite",
                                            }}
                                          />
                                        ) : (
                                          <CheckCircle size={16} />
                                        )}
                                      </button>

                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openCommentModal(
                                            "revision",
                                            topic.topicID,
                                            topic.title,
                                          );
                                        }}
                                        title="Yêu cầu sửa đổi đề tài"
                                        disabled={
                                          updatingStatus ===
                                          `revision-${topic.topicID}`
                                        }
                                        style={{
                                          padding: "8px",
                                          background:
                                            updatingStatus ===
                                              `revision-${topic.topicID}`
                                              ? "#9CA3AF"
                                              : "#F59E0B",
                                          color: "white",
                                          border: "none",
                                          borderRadius: "6px",
                                          cursor:
                                            updatingStatus ===
                                              `revision-${topic.topicID}`
                                              ? "not-allowed"
                                              : "pointer",
                                          transition: "all 0.2s ease",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          width: "32px",
                                          height: "32px",
                                        }}
                                        onMouseEnter={(e) => {
                                          if (
                                            updatingStatus !==
                                            `revision-${topic.topicID}`
                                          ) {
                                            e.currentTarget.style.background =
                                              "#D97706";
                                          }
                                        }}
                                        onMouseLeave={(e) => {
                                          if (
                                            updatingStatus !==
                                            `revision-${topic.topicID}`
                                          ) {
                                            e.currentTarget.style.background =
                                              "#F59E0B";
                                          }
                                        }}
                                      >
                                        {updatingStatus ===
                                          `revision-${topic.topicID}` ? (
                                          <Loader2
                                            size={16}
                                            style={{
                                              animation: "spin 1s linear infinite",
                                            }}
                                          />
                                        ) : (
                                          <Edit size={16} />
                                        )}
                                      </button>

                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openCommentModal(
                                            "reject",
                                            topic.topicID,
                                            topic.title,
                                          );
                                        }}
                                        title="Từ chối đề tài"
                                        disabled={
                                          updatingStatus ===
                                          `reject-${topic.topicID}`
                                        }
                                        style={{
                                          padding: "8px",
                                          background:
                                            updatingStatus ===
                                              `reject-${topic.topicID}`
                                              ? "#9CA3AF"
                                              : "#EF4444",
                                          color: "white",
                                          border: "none",
                                          borderRadius: "6px",
                                          cursor:
                                            updatingStatus ===
                                              `reject-${topic.topicID}`
                                              ? "not-allowed"
                                              : "pointer",
                                          transition: "all 0.2s ease",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          width: "32px",
                                          height: "32px",
                                        }}
                                        onMouseEnter={(e) => {
                                          if (
                                            updatingStatus !==
                                            `reject-${topic.topicID}`
                                          ) {
                                            e.currentTarget.style.background =
                                              "#DC2626";
                                          }
                                        }}
                                        onMouseLeave={(e) => {
                                          if (
                                            updatingStatus !==
                                            `reject-${topic.topicID}`
                                          ) {
                                            e.currentTarget.style.background =
                                              "#EF4444";
                                          }
                                        }}
                                      >
                                        {updatingStatus ===
                                          `reject-${topic.topicID}` ? (
                                          <Loader2
                                            size={16}
                                            style={{
                                              animation: "spin 1s linear infinite",
                                            }}
                                          />
                                        ) : (
                                          <AlertCircle size={16} />
                                        )}
                                      </button>
                                    </>
                                  )}

                                  {topic.status !== "Chờ duyệt" &&
                                    topic.comments && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openViewCommentModal(
                                            topic.comments || "Không có nhận xét",
                                            topic.title,
                                          );
                                        }}
                                        title="Xem nhận xét của giảng viên"
                                        style={{
                                          padding: "8px",
                                          background: "#8B5CF6",
                                          color: "white",
                                          border: "none",
                                          borderRadius: "6px",
                                          cursor: "pointer",
                                          transition: "all 0.2s ease",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          width: "32px",
                                          height: "32px",
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.background =
                                            "#7C3AED";
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.background =
                                            "#8B5CF6";
                                        }}
                                      >
                                        <MessageCircle size={16} />
                                      </button>
                                    )}
                                </div>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "8px",
                    marginTop: "24px",
                    padding: "16px",
                  }}
                >
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    title="Trang trước"
                    style={{
                      padding: "8px 12px",
                      background: currentPage === 1 ? "#F3F4F6" : "#FFFFFF",
                      color: currentPage === 1 ? "#9CA3AF" : "#374151",
                      border: "1px solid #D1D5DB",
                      borderRadius: "6px",
                      cursor: currentPage === 1 ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <ChevronLeft size={16} />
                    Trước
                  </button>

                  <div style={{ display: "flex", gap: "4px" }}>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          title={`Đến trang ${pageNum}`}
                          style={{
                            padding: "8px 12px",
                            background:
                              currentPage === pageNum ? "#1F3C88" : "#FFFFFF",
                            color: currentPage === pageNum ? "white" : "#374151",
                            border: "1px solid #D1D5DB",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "14px",
                            minWidth: "40px",
                          }}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    title="Trang sau"
                    style={{
                      padding: "8px 12px",
                      background:
                        currentPage === totalPages ? "#F3F4F6" : "#FFFFFF",
                      color: currentPage === totalPages ? "#9CA3AF" : "#374151",
                      border: "1px solid #D1D5DB",
                      borderRadius: "6px",
                      cursor:
                        currentPage === totalPages ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    Sau
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}

              {/* Page info */}
              <div
                style={{
                  textAlign: "center",
                  marginTop: "16px",
                  fontSize: "14px",
                  color: "#6B7280",
                }}
              >
                Hiển thị {topics.length} đề tài trên tổng số {totalCount} đề tài
                {totalPages > 1 && ` (Trang ${currentPage}/${totalPages})`}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="admin-ops-root" style={{
          minHeight: "100vh",
          background: "#f8fafc",
          color: "#1e293b",
          fontFamily: "'Be Vietnam Pro', sans-serif",
          padding: "0 0 40px 0"
        }}>
          {/* 1. Premium Header Section */}
          <div style={{
            background: "#1e3a5f",
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
                  marginBottom: 16
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
                    Phân công Hướng dẫn
                  </div>
                </div>

                <h1 style={{
                  fontSize: 42,
                  fontWeight: 900,
                  color: "white",
                  margin: 0,
                  letterSpacing: "-0.03em",
                  lineHeight: 1
                }}>
                  Phân công GVHD và <span style={{ color: "#f37021" }}>theo dõi</span>
                </h1>

                <div style={{
                  fontSize: 16,
                  color: "rgba(255, 255, 255, 0.7)",
                  marginTop: 12,
                  maxWidth: 600,
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap"
                }}>
                  <span>Giám sát đăng ký và phân công giảng viên hướng dẫn đợt:</span>
                  <span style={{
                    background: "rgba(255, 255, 255, 0.15)",
                    border: "1px solid rgba(255, 255, 255, 0.3)",
                    borderRadius: "10px",
                    padding: "4px 12px",
                    color: "white",
                    fontSize: "14px",
                    fontWeight: 700,
                  }}>
                    {periods.find((p) => p.defenseTermId === selectedPeriodId)?.name || "Chưa chọn đợt"}
                  </span>
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
            {!selectedPeriodId ? (
              <div style={{
                background: "white",
                borderRadius: 28,
                padding: "80px 40px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
                textAlign: "center",
                maxWidth: 600,
                margin: "40px auto"
              }}>
                <div style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: "#eff6ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 24px auto",
                  color: "#1e3a5f"
                }}>
                  <BookOpen size={40} />
                </div>
                <h2 style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", marginBottom: "12px" }}>
                  Chưa có đợt bảo vệ hiện hành
                </h2>
                <p style={{ fontSize: "15px", color: "#64748b", lineHeight: 1.6, marginBottom: "28px" }}>
                  Hệ thống chưa ghi nhận đợt đồ án tốt nghiệp hiện hành nào đang diễn ra. Vui lòng tạo đợt mới hoặc kích hoạt đợt tại module Quản lý đợt.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <a
                    href="/admin/defense-periods"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "48px",
                      borderRadius: "14px",
                      background: "#1e3a5f",
                      color: "white",
                      fontSize: "15px",
                      fontWeight: 700,
                      textDecoration: "none",
                      transition: "background 0.2s"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#12253f"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "#1e3a5f"}
                  >
                    Quản lý đợt bảo vệ
                  </a>
                </div>
              </div>
            ) : (
              <>
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
                  border: "1px solid rgba(255, 255, 255, 0.8)",
                }}>
                  {[
                    { key: "overview" as const, label: "Tình hình đăng ký", icon: <Users size={18} />, badge: (overdueCount > 0 || stats.pending > 0) ? `${overdueCount} QH - ${stats.pending} Chờ` : null, badgeColor: "#ef4444" },
                    { key: "topics-management" as const, label: "Quản lý đề tài và tiến độ", icon: <BookOpen size={18} />, badge: allTopicsList.length ? String(allTopicsList.length) : null, badgeColor: "#1e3a5f" },
                    { key: "lecturer-quota" as const, label: "Định mức & Điều phối tải Giảng viên", icon: <Award size={18} />, badge: allLecturers.length ? String(allLecturers.length) : null, badgeColor: "#8b5cf6" },
                    { key: "export" as const, label: "Xuất bản Báo cáo", icon: <Download size={18} />, badge: null, badgeColor: "" },
                  ].map((tab) => {
                    const isActive = activeAdminTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveAdminTab(tab.key)}
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 10,
                          padding: "12px 14px",
                          borderRadius: 14,
                          border: "none",
                          background: isActive ? "#1e3a5f" : "transparent",
                          color: isActive ? "white" : "#64748b",
                          fontSize: 13,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          cursor: "pointer",
                          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                      >
                        {tab.icon}
                        {tab.label}
                        {tab.badge && (
                          <span style={{
                            background: isActive ? "white" : tab.badgeColor,
                            color: isActive ? tab.badgeColor : "white",
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
                  minHeight: 500
                }}>
                  {/* TAB 1: OVERVIEW */}
                  {/* TAB 1: OVERVIEW */}
                  {activeAdminTab === "overview" && (() => {
                    const currentPeriod = periods.find((p) => p.defenseTermId === selectedPeriodId);
                    const currentStatus = currentPeriod?.status || "Draft";

                    // Calculations for detailed progress stats
                    const totalStudentsCount = allStudents.length;
                    const regCount = registeredCount;
                    const complPercent = completionPercent;

                    const approvedCount = allTopicsList.filter(
                      (t) => mapApiStatusToDisplay(t.status) === "Đã duyệt"
                    ).length;
                    const pendingCount = allTopicsList.filter(
                      (t) => mapApiStatusToDisplay(t.status) === "Chờ duyệt"
                    ).length;
                    const revisionCount = allTopicsList.filter(
                      (t) => mapApiStatusToDisplay(t.status) === "Cần sửa đổi"
                    ).length;
                    const rejectedCount = allTopicsList.filter(
                      (t) => mapApiStatusToDisplay(t.status) === "Từ chối"
                    ).length;

                    const catalogTopicsCount = allTopicsList.filter(t => t.type === "CATALOG").length;
                    const selfTopicsCount = allTopicsList.filter(t => t.type !== "CATALOG").length;

                    // Sửa theo yêu cầu: tính cả đang chờ (pendingCount) + đã duyệt (approvedCount) / tổng sinh viên (totalStudentsCount)
                    const assignedAdvisorCount = approvedCount + pendingCount;
                    const noAdvisorCount = allTopicsList.filter(t => !t.supervisorLecturerCode).length;
                    const advisorAssignPercent = totalStudentsCount > 0
                      ? Math.round((assignedAdvisorCount / totalStudentsCount) * 100)
                      : 0;

                    const steps = [
                      { key: "Draft", label: "Soạn thảo", desc: "Khởi tạo đợt" },
                      { key: "Registration", label: "Đăng ký & Phân công", desc: "Đăng ký & Phân công" },
                      { key: "ProgressTracking", label: "Tiến độ", desc: "Theo dõi thực hiện" },
                      { key: "CommitteePreparation", label: "Hội đồng", desc: "Chuẩn bị hội đồng" },
                      { key: "Running", label: "Bảo vệ", desc: "Chấm điểm & Bảo vệ" },
                      { key: "Finalization", label: "Hậu bảo vệ", desc: "Tổng kết & Nộp lại" },
                      { key: "Archived", label: "Đóng & Lưu trữ", desc: "Kết thúc & Lưu trữ" },
                    ];

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

                    const milestoneStatusOrder: Record<string, number> = {
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
                      closed: 5,
                      archived: 5
                    };
                    const currentMilestoneIndex = milestoneStatusOrder[normalizedKey] ?? 0;

                    const displaySteps = milestoneTemplates.length > 0
                      ? milestoneTemplates.map((m: any) => ({
                        key: m.milestoneTemplateCode,
                        label: m.name,
                        desc: m.deadline ? `Hạn: ${new Date(m.deadline).toLocaleDateString("vi-VN")}` : m.description || "",
                        ordinal: m.ordinal
                      }))
                      : steps;

                    return (
                      <>
                        {/* Detailed Progress Statistics Header */}
                        <div style={{
                          background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                          borderRadius: "16px",
                          border: "1px solid #e2e8f0",
                          padding: "24px",
                          marginBottom: "32px",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                        }}>
                          {/* Detailed Progress Stats Grid */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                            {/* Card 1: Sinh viên đăng ký */}
                            <div style={{ background: "white", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                                <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b" }}>Tỷ lệ đăng ký đề tài</span>
                                <Users size={16} color="#3b82f6" />
                              </div>
                              <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                                <span style={{ fontSize: "20px", fontWeight: "800", color: "#1e293b" }}>{regCount}</span>
                                <span style={{ fontSize: "12px", color: "#64748b" }}>/ {totalStudentsCount} SV</span>
                                <span style={{ marginLeft: "auto", fontSize: "12px", fontWeight: "800", color: "#3b82f6", background: "#dbeafe", padding: "2px 6px", borderRadius: "6px" }}>
                                  {complPercent}%
                                </span>
                              </div>
                              <div style={{ height: "6px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden", marginTop: "12px" }}>
                                <div style={{ width: `${complPercent}%`, height: "100%", background: "#3b82f6", borderRadius: "3px" }} />
                              </div>
                            </div>

                            {/* Card 2: Phê duyệt đề tài */}
                            <div style={{ background: "white", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                                <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b" }}>Trạng thái phê duyệt</span>
                                <CheckCircle size={16} color="#10b981" />
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", fontSize: "12px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", color: "#166534", fontWeight: "700" }}>
                                  <span>Đã duyệt:</span> <span>{approvedCount}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", color: "#b45309", fontWeight: "700" }}>
                                  <span>Chờ duyệt:</span> <span>{pendingCount}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", color: "#92400e", fontWeight: "700" }}>
                                  <span>Cần sửa:</span> <span>{revisionCount}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", color: "#991b1b", fontWeight: "700" }}>
                                  <span>Từ chối:</span> <span>{rejectedCount}</span>
                                </div>
                              </div>
                            </div>

                            {/* Card 3: Phân loại đề tài */}
                            <div style={{ background: "white", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                                <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b" }}>Phân loại nguồn đề tài</span>
                                <BookOpen size={16} color="#8b5cf6" />
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", color: "#1e293b", fontWeight: "700" }}>
                                  <span style={{ color: "#64748b", fontWeight: "600" }}>Đề tài Catalog:</span>
                                  <span style={{ background: "#f3e8ff", color: "#6b21a8", padding: "1px 6px", borderRadius: "4px" }}>{catalogTopicsCount}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", color: "#1e293b", fontWeight: "700" }}>
                                  <span style={{ color: "#64748b", fontWeight: "600" }}>Đề tài Tự chọn:</span>
                                  <span style={{ background: "#fef3c7", color: "#92400e", padding: "1px 6px", borderRadius: "4px" }}>{selfTopicsCount}</span>
                                </div>
                              </div>
                            </div>

                            {/* Card 4: Tỷ lệ phân công GVHD */}
                            <div style={{ background: "white", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                                <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b" }}>Tỷ lệ phân công GVHD</span>
                                <Award size={16} color="#f37021" />
                              </div>
                              <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                                <span style={{ fontSize: "20px", fontWeight: "800", color: "#1e293b" }}>{assignedAdvisorCount}</span>
                                <span style={{ fontSize: "12px", color: "#64748b" }}>/ {totalStudentsCount} sinh viên</span>
                                <span style={{ marginLeft: "auto", fontSize: "12px", fontWeight: "800", color: "#f37021", background: "#fff7ed", padding: "2px 6px", borderRadius: "6px" }}>
                                  {advisorAssignPercent}%
                                </span>
                              </div>
                              <div style={{ height: "6px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden", marginTop: "12px" }}>
                                <div style={{ width: `${advisorAssignPercent}%`, height: "100%", background: "#f37021", borderRadius: "3px" }} />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Student Table */}
                        <div style={{
                          background: "white",
                          borderRadius: "24px",
                          border: "1px solid #D9E1F2",
                          padding: "24px",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", flex: 1 }}>
                              <div style={{ position: "relative", minWidth: 320 }}>
                                <Search size={18} color="#9CA3AF" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                                <input
                                  type="text"
                                  placeholder="Tìm theo Mã SV, Tên SV, Lớp, Đề tài, Giảng viên..."
                                  value={regSearchTerm}
                                  onChange={(e) => setRegSearchTerm(e.target.value)}
                                  style={{
                                    width: "100%",
                                    padding: "10px 14px 10px 42px",
                                    border: "1px solid #CBD5E1",
                                    borderRadius: "12px",
                                    fontSize: "14px",
                                    outline: "none"
                                  }}
                                />
                              </div>
                              <select
                                value={regStatusFilter}
                                onChange={(e) => setRegStatusFilter(e.target.value as any)}
                                style={{
                                  padding: "10px 16px",
                                  border: "1px solid #CBD5E1",
                                  borderRadius: "12px",
                                  fontSize: "14px",
                                  outline: "none",
                                  background: "white",
                                  minWidth: 180,
                                  fontWeight: "600",
                                  color: "#475569"
                                }}
                              >
                                <option value="all">Tất cả trạng thái</option>
                                <option value="has_topic">Đã có đề tài</option>
                                <option value="no_topic">Chưa có đề tài</option>
                                <option value="pending_approval">Chờ duyệt đề tài tự chọn</option>
                              </select>
                            </div>

                            <div style={{ display: "flex", gap: "12px" }}>
                              <button
                                type="button"
                                onClick={handleOpenBulkManualModal}
                                style={{
                                  padding: "10px 24px",
                                  background: "#1e3a5f",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "24px",
                                  fontWeight: "800",
                                  fontSize: "14px",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  boxShadow: "0 4px 12px rgba(30, 58, 95, 0.15)",
                                  transition: "all 0.2s ease"
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                              >
                                <Edit size={16} /> Ghép thủ công SV quá hạn
                              </button>

                              <button
                                type="button"
                                onClick={handleAutoAssignPreview}
                                style={{
                                  padding: "10px 24px",
                                  background: "#f37021",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "24px",
                                  fontWeight: "800",
                                  fontSize: "14px",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  boxShadow: "0 4px 12px rgba(243, 112, 33, 0.3)",
                                  transition: "all 0.2s ease"
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                              >
                                <Zap size={16} fill="white" /> Tự động ghép GV
                              </button>
                            </div>
                          </div>

                          {isStudentsLoading ? (
                            <div style={{ textAlign: "center", padding: "64px" }}>
                              <Loader2 size={36} color="#1e3a5f" style={{ animation: "spin 1s linear infinite", margin: "0 auto 16px auto" }} />
                              <p style={{ color: "#64748b", fontWeight: 600 }}>Đang tải danh sách điều hành đăng ký...</p>
                            </div>
                          ) : studentsError ? (
                            <div style={{ padding: 32, background: "#fee2e2", border: "1px solid #fca5a5", color: "#b91c1c", borderRadius: 16, textAlign: "center", fontWeight: 600 }}>
                              {studentsError}
                            </div>
                          ) : filteredStudents.length === 0 ? (
                            <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontStyle: "italic", fontWeight: 600 }}>
                              Không tìm thấy sinh viên nào phù hợp với bộ lọc.
                            </div>
                          ) : (
                            <>
                              <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", fontSize: "14px", borderCollapse: "separate", borderSpacing: "0 8px" }}>
                                  <thead>
                                    <tr style={{ background: "#f8fafc", color: "#475569" }}>
                                      <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Sinh viên</th>
                                      <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Khoa</th>
                                      <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Lớp</th>
                                      {regStatusFilter === "no_topic" && (
                                        <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Trạng thái đăng ký</th>
                                      )}
                                      <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Đề tài luận văn</th>
                                      <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Trạng thái đề tài</th>
                                      <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Hành động</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filteredStudents
                                      .slice((regCurrentPage - 1) * 10, regCurrentPage * 10)
                                      .map((student) => {
                                        const topic = getStudentRegistrationInfo(student.studentCode);
                                        return (
                                          <tr key={student.studentCode} style={{ background: "#fcfdfe", borderRadius: "16px", border: "1px solid #f1f5f9" }}>
                                            <td style={{ padding: "16px", borderRadius: "12px 0 0 12px" }}>
                                              <div style={{ fontWeight: "700", color: "#1e293b" }}>{student.fullName}</div>
                                              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>{student.studentCode}</div>
                                            </td>
                                            <td style={{ padding: "16px", color: "#475569", fontWeight: "600" }}>
                                              {student.departmentCode || "-"}
                                            </td>
                                            <td style={{ padding: "16px", color: "#475569", fontWeight: "600" }}>
                                              {student.classCode || "-"}
                                            </td>
                                            {regStatusFilter === "no_topic" && (
                                              <td style={{ padding: "16px" }}>
                                                <span style={{
                                                  display: "inline-block",
                                                  padding: "6px 12px",
                                                  borderRadius: "99px",
                                                  fontSize: "12px",
                                                  fontWeight: "800",
                                                  background: "#fee2e2",
                                                  color: "#991b1b"
                                                }}>
                                                  Chưa đăng ký
                                                </span>
                                              </td>
                                            )}
                                            <td style={{ padding: "16px", maxWidth: 360 }}>
                                              {topic ? (
                                                <div>
                                                  <div style={{ fontWeight: "700", color: "#1e3a5f", lineHeight: "1.4" }} title={topic.title}>{topic.title}</div>
                                                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", fontWeight: "600" }}>
                                                    GVHD: {allLecturers.find(l => l.lecturerCode === topic.supervisorLecturerCode)?.fullName || topic.supervisorLecturerCode}
                                                  </div>
                                                </div>
                                              ) : (
                                                <span style={{ color: "#94a3b8", fontStyle: "italic", fontWeight: "500" }}>Chưa chỉ định đề tài & GVHD</span>
                                              )}
                                            </td>
                                            <td style={{ padding: "16px" }}>
                                              {topic ? (
                                                <span style={{
                                                  display: "inline-block",
                                                  padding: "6px 12px",
                                                  borderRadius: "99px",
                                                  fontSize: "12px",
                                                  fontWeight: "800",
                                                  background: topic.status === "Đã duyệt" ? "#dcfce7" : topic.status === "Từ chối" ? "#fee2e2" : "#fef3c7",
                                                  color: topic.status === "Đã duyệt" ? "#166534" : topic.status === "Từ chối" ? "#991b1b" : "#b45309"
                                                }}>
                                                  {topic.status}
                                                </span>
                                              ) : (
                                                <span style={{ color: "#94a3b8", fontWeight: "500" }}>-</span>
                                              )}
                                            </td>
                                            <td style={{ padding: "16px", borderRadius: "0 12px 12px 0", textAlign: "left" }}>
                                              {(() => {
                                                if (topic) {
                                                  const displayMap: TopicDisplay = {
                                                    topicID: topic.topicID,
                                                    topicCode: topic.topicCode,
                                                    title: topic.title,
                                                    description: topic.summary || "",
                                                    studentCode: topic.proposerStudentCode || "",
                                                    studentName: student.fullName || "",
                                                    submissionDate: topic.createdAt || "",
                                                    status: mapApiStatusToDisplay(topic.status),
                                                    category: topic.type === "CATALOG" ? "Đề tài catalog" : "Đề tài tự chọn",
                                                    comments: topic.lecturerComment || "",
                                                    studentProfile: student,
                                                    supervisorLecturerCode: topic.supervisorLecturerCode,
                                                  };

                                                  const isSelfPending = topic.type === "SELF" && mapApiStatusToDisplay(topic.status) === "Chờ duyệt";

                                                  return (
                                                    <div style={{
                                                      display: "grid",
                                                      gridTemplateColumns: "repeat(2, 32px)",
                                                      gap: "8px",
                                                      justifyContent: "start",
                                                      alignItems: "center",
                                                    }}>
                                                      {/* Nút xem chi tiết */}
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          openDetailModal(displayMap);
                                                        }}
                                                        title="Xem chi tiết đề tài"
                                                        style={{
                                                          padding: "8px",
                                                          background: "#1F3C88",
                                                          color: "white",
                                                          border: "none",
                                                          borderRadius: "6px",
                                                          fontSize: "14px",
                                                          cursor: "pointer",
                                                          transition: "all 0.2s ease",
                                                          display: "flex",
                                                          alignItems: "center",
                                                          justifyContent: "center",
                                                          width: "32px",
                                                          height: "32px",
                                                        }}
                                                        onMouseEnter={(e) => {
                                                          e.currentTarget.style.background = "#162B61";
                                                        }}
                                                        onMouseLeave={(e) => {
                                                          e.currentTarget.style.background = "#1F3C88";
                                                        }}
                                                      >
                                                        <Eye size={16} />
                                                      </button>

                                                      {isSelfPending && (
                                                        <>
                                                          <button
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              openConfirmationModal(displayMap);
                                                            }}
                                                            title="Duyệt đề tài"
                                                            disabled={
                                                              updatingStatus ===
                                                              `approve-${topic.topicID}`
                                                            }
                                                            style={{
                                                              padding: "8px",
                                                              background:
                                                                updatingStatus ===
                                                                  `approve-${topic.topicID}`
                                                                  ? "#9CA3AF"
                                                                  : "#22C55E",
                                                              color: "white",
                                                              border: "none",
                                                              borderRadius: "6px",
                                                              cursor:
                                                                updatingStatus ===
                                                                  `approve-${topic.topicID}`
                                                                  ? "not-allowed"
                                                                  : "pointer",
                                                              transition: "all 0.2s ease",
                                                              display: "flex",
                                                              alignItems: "center",
                                                              justifyContent: "center",
                                                              width: "32px",
                                                              height: "32px",
                                                            }}
                                                            onMouseEnter={(e) => {
                                                              if (
                                                                updatingStatus !==
                                                                `approve-${topic.topicID}`
                                                              ) {
                                                                e.currentTarget.style.background =
                                                                  "#16A34A";
                                                              }
                                                            }}
                                                            onMouseLeave={(e) => {
                                                              if (
                                                                updatingStatus !==
                                                                `approve-${topic.topicID}`
                                                              ) {
                                                                e.currentTarget.style.background =
                                                                  "#22C55E";
                                                              }
                                                            }}
                                                          >
                                                            {updatingStatus ===
                                                              `approve-${topic.topicID}` ? (
                                                              <Loader2
                                                                size={16}
                                                                style={{
                                                                  animation: "spin 1s linear infinite",
                                                                }}
                                                              />
                                                            ) : (
                                                              <CheckCircle size={16} />
                                                            )}
                                                          </button>

                                                          <button
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              openCommentModal(
                                                                "revision",
                                                                topic.topicID,
                                                                topic.title,
                                                              );
                                                            }}
                                                            title="Yêu cầu sửa đổi đề tài"
                                                            disabled={
                                                              updatingStatus ===
                                                              `revision-${topic.topicID}`
                                                            }
                                                            style={{
                                                              padding: "8px",
                                                              background:
                                                                updatingStatus ===
                                                                  `revision-${topic.topicID}`
                                                                  ? "#9CA3AF"
                                                                  : "#F59E0B",
                                                              color: "white",
                                                              border: "none",
                                                              borderRadius: "6px",
                                                              cursor:
                                                                updatingStatus ===
                                                                  `revision-${topic.topicID}`
                                                                  ? "not-allowed"
                                                                  : "pointer",
                                                              transition: "all 0.2s ease",
                                                              display: "flex",
                                                              alignItems: "center",
                                                              justifyContent: "center",
                                                              width: "32px",
                                                              height: "32px",
                                                            }}
                                                            onMouseEnter={(e) => {
                                                              if (
                                                                updatingStatus !==
                                                                `revision-${topic.topicID}`
                                                              ) {
                                                                e.currentTarget.style.background =
                                                                  "#D97706";
                                                              }
                                                            }}
                                                            onMouseLeave={(e) => {
                                                              if (
                                                                updatingStatus !==
                                                                `revision-${topic.topicID}`
                                                              ) {
                                                                e.currentTarget.style.background =
                                                                  "#F59E0B";
                                                              }
                                                            }}
                                                          >
                                                            {updatingStatus ===
                                                              `revision-${topic.topicID}` ? (
                                                              <Loader2
                                                                size={16}
                                                                style={{
                                                                  animation: "spin 1s linear infinite",
                                                                }}
                                                              />
                                                            ) : (
                                                              <Edit size={16} />
                                                            )}
                                                          </button>

                                                          <button
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              openCommentModal(
                                                                "reject",
                                                                topic.topicID,
                                                                topic.title,
                                                              );
                                                            }}
                                                            title="Từ chối đề tài"
                                                            disabled={
                                                              updatingStatus ===
                                                              `reject-${topic.topicID}`
                                                            }
                                                            style={{
                                                              padding: "8px",
                                                              background:
                                                                updatingStatus ===
                                                                  `reject-${topic.topicID}`
                                                                  ? "#9CA3AF"
                                                                  : "#EF4444",
                                                              color: "white",
                                                              border: "none",
                                                              borderRadius: "6px",
                                                              cursor:
                                                                updatingStatus ===
                                                                  `reject-${topic.topicID}`
                                                                  ? "not-allowed"
                                                                  : "pointer",
                                                              transition: "all 0.2s ease",
                                                              display: "flex",
                                                              alignItems: "center",
                                                              justifyContent: "center",
                                                              width: "32px",
                                                              height: "32px",
                                                            }}
                                                            onMouseEnter={(e) => {
                                                              if (
                                                                updatingStatus !==
                                                                `reject-${topic.topicID}`
                                                              ) {
                                                                e.currentTarget.style.background =
                                                                  "#DC2626";
                                                              }
                                                            }}
                                                            onMouseLeave={(e) => {
                                                              if (
                                                                updatingStatus !==
                                                                `reject-${topic.topicID}`
                                                              ) {
                                                                e.currentTarget.style.background =
                                                                  "#EF4444";
                                                              }
                                                            }}
                                                          >
                                                            {updatingStatus ===
                                                              `reject-${topic.topicID}` ? (
                                                              <Loader2
                                                                size={16}
                                                                style={{
                                                                  animation: "spin 1s linear infinite",
                                                                }}
                                                              />
                                                            ) : (
                                                              <X size={16} />
                                                            )}
                                                          </button>
                                                        </>
                                                      )}
                                                    </div>
                                                  );
                                                }

                                                // Topic does not exist -> manual assign
                                                return (
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setManualAssignModal({ isOpen: true, student });
                                                      setManualTopicTitle("");
                                                      setManualSupervisorCode("");
                                                    }}
                                                    style={{
                                                      padding: "8px 16px",
                                                      background: "#f37021",
                                                      border: "none",
                                                      borderRadius: "8px",
                                                      fontSize: "13px",
                                                      fontWeight: "800",
                                                      color: "white",
                                                      cursor: "pointer",
                                                      boxShadow: "0 2px 6px rgba(243, 112, 33, 0.15)",
                                                      transition: "all 0.2s ease"
                                                    }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                                                  >
                                                    Gán thủ công
                                                  </button>
                                                );
                                              })()}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                  </tbody>
                                </table>
                              </div>
                              {renderPagination(regCurrentPage, Math.ceil(filteredStudents.length / 10), setRegCurrentPage)}
                            </>
                          )}
                        </div>
                      </>
                    );
                  })()}

                  {/* TAB 2: TOPICS MANAGEMENT (Embedded Module) */}
                  {activeAdminTab === "topics-management" && (() => {
                    // Lọc theo đợt hiện tại/đã chọn
                    const termTopics = allTopicsList.filter(
                      (t) => !selectedPeriodId || t.defenseTermId === selectedPeriodId
                    );

                    const filteredTopics = termTopics.filter(topic => {
                      const s = topicsSearchTerm.trim().toLowerCase();
                      const student = allStudents.find(st => st.studentCode === topic.proposerStudentCode);
                      const matchesSearch = !s ||
                        (topic.topicCode || "").toLowerCase().includes(s) ||
                        (topic.title || "").toLowerCase().includes(s) ||
                        (topic.proposerStudentCode || "").toLowerCase().includes(s) ||
                        (student?.fullName || "").toLowerCase().includes(s);

                      const milestone = topicMilestones[topic.topicID];

                      // Lọc theo mốc tiến độ hiện tại
                      const matchesMilestone = topicsTypeFilter === "all" || (milestone && milestone.milestoneTemplateCode === topicsTypeFilter);

                      // Lọc theo trạng thái thực hiện mốc
                      const milestoneState = milestone?.state || "Chờ khởi động";
                      const matchesMilestoneState = topicsStatusFilter === "all" || (() => {
                        const filterVal = topicsStatusFilter.toLowerCase().trim();
                        const stateVal = milestoneState.toLowerCase().trim();
                        if (filterVal === "chờ khởi động") return stateVal.includes("khởi động");
                        if (filterVal === "đang thực hiện") return stateVal.includes("thực hiện") || stateVal.includes("tiến hành") || stateVal.includes("draft") || stateVal.includes("notstarted") || stateVal.includes("progress");
                        if (filterVal === "chờ duyệt") return stateVal.includes("chờ duyệt") || stateVal.includes("waiting") || stateVal.includes("chờ");
                        if (filterVal === "đã hoàn thành") return stateVal.includes("hoàn thành") || stateVal.includes("đã xong") || stateVal.includes("approved") || stateVal.includes("committee") || stateVal.includes("đạt");
                        if (filterVal === "cần sửa đổi") return stateVal.includes("sửa đổi") || stateVal.includes("cần sửa") || stateVal.includes("revision");
                        if (filterVal === "quá hạn") return stateVal.includes("trễ") || stateVal.includes("quá hạn") || stateVal.includes("overdue");
                        return stateVal === filterVal;
                      })();

                      return matchesSearch && matchesMilestone && matchesMilestoneState;
                    });
                    const paginatedTopics = filteredTopics.slice((topicsCurrentPage - 1) * 10, topicsCurrentPage * 10);

                    const currentPeriod = periods.find((p) => p.defenseTermId === selectedPeriodId);
                    const currentStatus = currentPeriod?.status || "Draft";

                    // Calculations for detailed progress stats
                    const totalStudentsCount = allStudents.length;
                    const regCount = registeredCount;
                    const complPercent = completionPercent;

                    const approvedCount = termTopics.filter(
                      (t) => mapApiStatusToDisplay(t.status) === "Đã duyệt"
                    ).length;
                    const pendingCount = termTopics.filter(
                      (t) => mapApiStatusToDisplay(t.status) === "Chờ duyệt"
                    ).length;
                    const revisionCount = termTopics.filter(
                      (t) => mapApiStatusToDisplay(t.status) === "Cần sửa đổi"
                    ).length;
                    const rejectedCount = termTopics.filter(
                      (t) => mapApiStatusToDisplay(t.status) === "Từ chối"
                    ).length;

                    const catalogTopicsCount = termTopics.filter(t => t.type === "CATALOG").length;
                    const selfTopicsCount = termTopics.filter(t => t.type !== "CATALOG").length;

                    const assignedAdvisorCount = termTopics.filter(t => t.supervisorLecturerCode).length;
                    const noAdvisorCount = termTopics.filter(t => !t.supervisorLecturerCode).length;
                    const advisorAssignPercent = termTopics.length > 0
                      ? Math.round((assignedAdvisorCount / termTopics.length) * 100)
                      : 0;

                    const steps = [
                      { key: "Draft", label: "Soạn thảo", desc: "Khởi tạo đợt" },
                      { key: "Registration", label: "Đăng ký & Phân công", desc: "Đăng ký & Phân công" },
                      { key: "ProgressTracking", label: "Tiến độ", desc: "Theo dõi thực hiện" },
                      { key: "CommitteePreparation", label: "Hội đồng", desc: "Chuẩn bị hội đồng" },
                      { key: "Running", label: "Bảo vệ", desc: "Chấm điểm & Bảo vệ" },
                      { key: "Finalization", label: "Hậu bảo vệ", desc: "Tổng kết & Nộp lại" },
                      { key: "Archived", label: "Đóng & Lưu trữ", desc: "Kết thúc & Lưu trữ" },
                    ];

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

                    const milestoneStatusOrder: Record<string, number> = {
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
                      closed: 5,
                      archived: 5
                    };
                    const currentMilestoneIndex = milestoneStatusOrder[normalizedKey] ?? 0;

                    const displaySteps = milestoneTemplates.length > 0
                      ? milestoneTemplates.map((m: any) => ({
                        key: m.milestoneTemplateCode,
                        label: m.name,
                        desc: m.deadline ? `Hạn: ${new Date(m.deadline).toLocaleDateString("vi-VN")}` : m.description || "",
                        ordinal: m.ordinal
                      }))
                      : steps;

                    return (
                      <div style={{
                        background: "white",
                        borderRadius: "24px",
                        border: "1px solid #D9E1F2",
                        padding: "24px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                      }}>
                        {/* Detailed Progress Statistics Header */}
                        <div style={{
                          background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                          borderRadius: "16px",
                          border: "1px solid #e2e8f0",
                          padding: "24px",
                          marginBottom: "32px",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                        }}>
                          {/* Detailed Progress Stats Grid */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                            {/* Card 1: Tổng số đề tài */}
                            <div style={{ background: "white", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                                <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b" }}>Đề tài đang thực hiện</span>
                                <Users size={16} color="#3b82f6" />
                              </div>
                              <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                                <span style={{ fontSize: "20px", fontWeight: "800", color: "#1e293b" }}>{termTopics.length}</span>
                                <span style={{ fontSize: "12px", color: "#64748b" }}>đề tài</span>
                                <span style={{ marginLeft: "auto", fontSize: "12px", fontWeight: "800", color: "#3b82f6", background: "#dbeafe", padding: "2px 6px", borderRadius: "6px" }}>
                                  {termTopics.length > 0 ? 100 : 0}%
                                </span>
                              </div>
                              <div style={{ height: "6px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden", marginTop: "12px" }}>
                                <div style={{ width: "100%", height: "100%", background: "#3b82f6", borderRadius: "3px" }} />
                              </div>
                            </div>

                            {/* Card 2: Phân bổ mốc tiến độ */}
                            <div style={{ background: "white", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                                <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b" }}>Phân bổ mốc tiến độ</span>
                                <Clock size={16} color="#8b5cf6" />
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", fontSize: "11px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", color: "#475569", fontWeight: "700" }}>
                                  <span>Đăng ký:</span> <span style={{ color: "#1e293b" }}>{termTopics.filter(t => topicMilestones[t.topicID]?.milestoneTemplateCode === "MS_REG").length}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", color: "#475569", fontWeight: "700" }}>
                                  <span>Báo cáo 1:</span> <span style={{ color: "#1e293b" }}>{termTopics.filter(t => topicMilestones[t.topicID]?.milestoneTemplateCode === "MS_PROG1").length}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", color: "#475569", fontWeight: "700" }}>
                                  <span>Báo cáo 2:</span> <span style={{ color: "#1e293b" }}>{termTopics.filter(t => topicMilestones[t.topicID]?.milestoneTemplateCode === "MS_PROG2").length}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", color: "#475569", fontWeight: "700" }}>
                                  <span>Hoàn thiện:</span> <span style={{ color: "#1e293b" }}>{termTopics.filter(t => topicMilestones[t.topicID]?.milestoneTemplateCode === "MS_FULL").length}</span>
                                </div>
                              </div>
                            </div>

                            {/* Card 3: Trạng thái thực hiện mốc */}
                            <div style={{ background: "white", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                                <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b" }}>Trạng thái thực hiện</span>
                                <CheckCircle size={16} color="#10b981" />
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", fontSize: "11px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", color: "#166534", fontWeight: "700" }}>
                                  <span>Đạt/Xong:</span> <span>{termTopics.filter(t => {
                                    const st = topicMilestones[t.topicID]?.state?.toLowerCase() || "";
                                    return st.includes("approved") || st.includes("committee") || st.includes("hoàn thành") || st.includes("đã xong");
                                  }).length}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", color: "#b45309", fontWeight: "700" }}>
                                  <span>Chờ duyệt:</span> <span>{termTopics.filter(t => {
                                    const st = topicMilestones[t.topicID]?.state?.toLowerCase() || "";
                                    return st.includes("supervisor") || st.includes("chờ");
                                  }).length}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", color: "#c2410c", fontWeight: "700" }}>
                                  <span>Cần sửa:</span> <span>{termTopics.filter(t => {
                                    const st = topicMilestones[t.topicID]?.state?.toLowerCase() || "";
                                    return st.includes("revision") || st.includes("sửa");
                                  }).length}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", color: "#991b1b", fontWeight: "700" }}>
                                  <span>Trễ hạn:</span> <span>{termTopics.filter(t => {
                                    const st = topicMilestones[t.topicID]?.state?.toLowerCase() || "";
                                    return st.includes("overdue") || st.includes("trễ") || st.includes("quá hạn");
                                  }).length}</span>
                                </div>
                              </div>
                            </div>

                            {/* Card 4: Tỷ lệ đúng hạn */}
                            <div style={{ background: "white", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                                <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b" }}>Tỷ lệ đúng hạn tiến độ</span>
                                <Award size={16} color="#f37021" />
                              </div>
                              <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                                <span style={{ fontSize: "20px", fontWeight: "800", color: "#1e293b" }}>
                                  {termTopics.filter(t => {
                                    const st = topicMilestones[t.topicID]?.state?.toLowerCase() || "";
                                    return !st.includes("overdue") && !st.includes("trễ") && !st.includes("quá hạn");
                                  }).length}
                                </span>
                                <span style={{ fontSize: "12px", color: "#64748b" }}>/ {termTopics.length} đề tài</span>
                                <span style={{
                                  marginLeft: "auto",
                                  fontSize: "12px",
                                  fontWeight: "800",
                                  color: "#f37021",
                                  background: "#fff7ed",
                                  padding: "2px 6px",
                                  borderRadius: "6px"
                                }}>
                                  {(() => {
                                    const onTimeCount = termTopics.filter(t => {
                                      const st = topicMilestones[t.topicID]?.state?.toLowerCase() || "";
                                      return !st.includes("overdue") && !st.includes("trễ") && !st.includes("quá hạn");
                                    }).length;
                                    return termTopics.length > 0 ? Math.round((onTimeCount / termTopics.length) * 100) : 100;
                                  })()}%
                                </span>
                              </div>
                              <div style={{ height: "6px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden", marginTop: "12px" }}>
                                <div style={{
                                  width: `${(() => {
                                    const onTimeCount = termTopics.filter(t => {
                                      const st = topicMilestones[t.topicID]?.state?.toLowerCase() || "";
                                      return !st.includes("overdue") && !st.includes("trễ") && !st.includes("quá hạn");
                                    }).length;
                                    return termTopics.length > 0 ? Math.round((onTimeCount / termTopics.length) * 100) : 100;
                                  })()}%`,
                                  height: "100%",
                                  background: "#f37021",
                                  borderRadius: "3px"
                                }} />
                              </div>
                            </div>
                          </div>
                        </div>



                        {/* Toolbar */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
                          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", flex: 1 }}>
                            <div style={{ position: "relative", minWidth: 300 }}>
                              <Search size={18} color="#9CA3AF" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                              <input
                                type="text"
                                placeholder="Tìm mã đề tài, tên đề tài, mã sinh viên, tên sinh viên..."
                                value={topicsSearchTerm}
                                onChange={(e) => setTopicsSearchTerm(e.target.value)}
                                style={{
                                  width: "100%",
                                  padding: "10px 14px 10px 42px",
                                  border: "1px solid #CBD5E1",
                                  borderRadius: "12px",
                                  fontSize: "14px",
                                  outline: "none"
                                }}
                              />
                            </div>
                            <select
                              value={topicsTypeFilter}
                              onChange={(e) => setTopicsTypeFilter(e.target.value)}
                              style={{
                                padding: "10px 16px",
                                border: "1px solid #CBD5E1",
                                borderRadius: "12px",
                                fontSize: "14px",
                                outline: "none",
                                background: "white",
                                fontWeight: "600",
                                color: "#475569"
                              }}
                            >
                              <option value="all">Tất cả mốc tiến độ</option>
                              <option value="MS_REG">Đăng ký đề tài</option>
                              <option value="MS_PROG1">Đề cương</option>
                              <option value="MS_PROG2">Báo cáo</option>
                              <option value="MS_FULL">Hoàn thiện khóa luận</option>
                            </select>
                            <select
                              value={topicsStatusFilter}
                              onChange={(e) => setTopicsStatusFilter(e.target.value)}
                              style={{
                                padding: "10px 16px",
                                border: "1px solid #CBD5E1",
                                borderRadius: "12px",
                                fontSize: "14px",
                                outline: "none",
                                background: "white",
                                fontWeight: "600",
                                color: "#475569"
                              }}
                            >
                              <option value="all">Tất cả trạng thái tiến độ</option>
                              <option value="Chờ khởi động">Chờ khởi động</option>
                              <option value="Đang thực hiện">Đang thực hiện</option>
                              <option value="Chờ duyệt">Chờ duyệt</option>
                              <option value="Đã hoàn thành">Đã hoàn thành/Đạt</option>
                              <option value="Cần sửa đổi">Cần sửa đổi</option>
                              <option value="Quá hạn">Quá hạn/Trễ hạn</option>
                            </select>
                          </div>
                        </div>

                        {/* Topics List Table */}
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", fontSize: "14px", borderCollapse: "separate", borderSpacing: "0 8px" }}>
                            <thead>
                              <tr style={{ background: "#f8fafc", color: "#475569" }}>
                                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Mã đề tài</th>
                                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Thông tin đề tài & Sinh viên</th>
                                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Giảng viên hướng dẫn</th>
                                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Mốc tiến độ hiện tại</th>
                                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Trạng thái thực hiện</th>
                                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Hạn nộp mốc</th>
                                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: "700" }}>Thao tác</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredTopics.length === 0 ? (
                                <tr>
                                  <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#64748b", fontStyle: "italic" }}>
                                    Không tìm thấy đề tài nào phù hợp với bộ lọc.
                                  </td>
                                </tr>
                              ) : (
                                paginatedTopics.map((topic) => {
                                  const milestone = topicMilestones[topic.topicID];
                                  const milestoneName = milestone
                                    ? (milestoneTemplates.find((m: any) => m.milestoneTemplateCode === milestone.milestoneTemplateCode)?.name || milestone.milestoneTemplateCode)
                                    : "Chưa bắt đầu";
                                  const milestoneState = milestone?.state || "Chờ khởi động";
                                  const deadlineDate = milestone?.deadline
                                    ? new Date(milestone.deadline).toLocaleDateString("vi-VN")
                                    : "-";

                                  const getMilestoneStyles = (code: string) => {
                                    const c = String(code).trim().toUpperCase();
                                    if (c.includes("REG") || c.includes("ĐĂNG KÝ")) {
                                      return { bg: "#e0e7ff", color: "#4338ca", border: "1px solid rgba(67, 56, 202, 0.15)" };
                                    }
                                    if (c.includes("PROG1") || c.includes("1")) {
                                      return { bg: "#f3e8ff", color: "#6b21a8", border: "1px solid rgba(107, 33, 168, 0.15)" };
                                    }
                                    if (c.includes("PROG2") || c.includes("2")) {
                                      return { bg: "#fce7f3", color: "#be185d", border: "1px solid rgba(190, 24, 93, 0.15)" };
                                    }
                                    if (c.includes("FULL") || c.includes("HOÀN THIỆN") || c.includes("HOÀN CHỈNH")) {
                                      return { bg: "#dcfce7", color: "#15803d", border: "1px solid rgba(21, 128, 61, 0.15)" };
                                    }
                                    return { bg: "#f8fafc", color: "#64748b", border: "1px solid rgba(100, 116, 139, 0.1)" };
                                  };
                                  const milestoneCode = milestone?.milestoneTemplateCode || "NONE";
                                  const milestoneStyles = getMilestoneStyles(milestoneCode);

                                  const getStateStyles = (state: string) => {
                                    const s = String(state).trim().toLowerCase();
                                    if (s.includes("hoàn thành") || s.includes("đã xong")) {
                                      return { bg: "#dcfce7", color: "#15803d" };
                                    }
                                    if (s.includes("thực hiện") || s.includes("tiến hành")) {
                                      return { bg: "#dbeafe", color: "#1d4ed8" };
                                    }
                                    if (s.includes("trễ") || s.includes("quá hạn") || s.includes("thất bại")) {
                                      return { bg: "#fee2e2", color: "#b91c1c" };
                                    }
                                    if (s.includes("sửa đổi") || s.includes("cần sửa")) {
                                      return { bg: "#ffedd5", color: "#c2410c" };
                                    }
                                    if (s.includes("chờ")) {
                                      return { bg: "#f1f5f9", color: "#475569" };
                                    }
                                    if (s.includes("từ chối")) {
                                      return { bg: "#fef2f2", color: "#991b1b" };
                                    }
                                    return { bg: "#fef3c7", color: "#b45309" };
                                  };
                                  const stateStyles = getStateStyles(milestoneState);

                                  const student = allStudents.find(s => s.studentCode === topic.proposerStudentCode);
                                  const displayMap: TopicDisplay = {
                                    topicID: topic.topicID,
                                    topicCode: topic.topicCode,
                                    title: topic.title,
                                    description: topic.summary || "",
                                    studentCode: topic.proposerStudentCode || "",
                                    studentName: student?.fullName || topic.proposerStudentCode || "",
                                    submissionDate: topic.createdAt || "",
                                    status: mapApiStatusToDisplay(topic.status),
                                    category: topic.type === "CATALOG" ? "Đề tài catalog" : "Đề tài tự chọn",
                                    comments: topic.lecturerComment || "",
                                    studentProfile: student,
                                    supervisorLecturerCode: topic.supervisorLecturerCode,
                                  };

                                  return (
                                    <tr key={topic.topicID} style={{ background: "#fcfdfe", borderRadius: "16px", border: "1px solid #f1f5f9" }}>
                                      <td style={{ padding: "16px", fontWeight: "700", color: "#1e3a5f", borderRadius: "12px 0 0 12px" }}>
                                        {topic.topicCode}
                                      </td>
                                      <td style={{ padding: "16px", maxWidth: 280 }}>
                                        <div style={{ fontWeight: "700", color: "#1e293b", lineHeight: "1.4" }} title={topic.title}>{topic.title}</div>
                                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                                          SV: {student?.fullName || topic.proposerStudentCode || "-"} ({topic.proposerStudentCode || "-"})
                                        </div>
                                      </td>
                                      <td style={{ padding: "16px", color: "#475569" }}>
                                        <div style={{ fontWeight: "700", color: "#334155" }}>
                                          {allLecturers.find(l => l.lecturerCode === topic.supervisorLecturerCode)?.fullName || topic.supervisorLecturerCode || "-"}
                                        </div>
                                        {topic.supervisorLecturerCode && <div style={{ fontSize: "11px", color: "#64748b" }}>{topic.supervisorLecturerCode}</div>}
                                      </td>
                                      <td style={{ padding: "16px" }}>
                                        <span style={{
                                          display: "inline-block",
                                          padding: "6px 12px",
                                          borderRadius: "99px",
                                          fontSize: "12px",
                                          fontWeight: "800",
                                          background: milestoneStyles.bg,
                                          color: milestoneStyles.color,
                                          border: milestoneStyles.border,
                                          boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
                                        }}>
                                          {milestoneName}
                                        </span>
                                      </td>
                                      <td style={{ padding: "16px" }}>
                                        <span style={{
                                          display: "inline-block",
                                          padding: "6px 12px",
                                          borderRadius: "99px",
                                          fontSize: "12px",
                                          fontWeight: "800",
                                          background: stateStyles.bg,
                                          color: stateStyles.color
                                        }}>
                                          {milestoneState}
                                        </span>
                                      </td>
                                      <td style={{ padding: "16px", color: "#475569", fontWeight: "600" }}>
                                        {deadlineDate}
                                      </td>
                                      <td style={{ padding: "16px", borderRadius: "0 12px 12px 0", textAlign: "right" }}>
                                        <button
                                          type="button"
                                          onClick={() => openDetailModal(displayMap)}
                                          title="Xem chi tiết đề tài"
                                          style={{
                                            padding: "8px 12px",
                                            background: "#f1f5f9",
                                            border: "1px solid #e2e8f0",
                                            borderRadius: "8px",
                                            fontSize: "13px",
                                            fontWeight: "700",
                                            color: "#475569",
                                            cursor: "pointer",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            whiteSpace: "nowrap"
                                          }}
                                        >
                                          <Eye size={14} />
                                          Chi tiết
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                        {renderPagination(topicsCurrentPage, Math.ceil(filteredTopics.length / 10), setTopicsCurrentPage)}
                      </div>
                    );
                  })()}



                  {/* TAB 4: LECTURER GUIDANCE LOAD */}
                  {activeAdminTab === "lecturer-quota" && (() => {
                    const filteredLecturers = allLecturers.filter(lec => {
                      const s = lecturerLoadSearchTerm.trim().toLowerCase();
                      const matchesSearch = !s || lec.fullName.toLowerCase().includes(s) || lec.lecturerCode.toLowerCase().includes(s) || (lec.degree || "").toLowerCase().includes(s);
                      const matchesDept = lecturerLoadDeptFilter === "all" || lec.departmentCode === lecturerLoadDeptFilter;
                      return matchesSearch && matchesDept;
                    });
                    const paginatedLecturers = filteredLecturers.slice((lecturerLoadCurrentPage - 1) * 10, lecturerLoadCurrentPage * 10);

                    // Guidance Quota Calculations
                    const totalLecs = allLecturers.length;
                    const totalQuota = allLecturers.reduce((acc, lec) => acc + (lec.guideQuota || 5), 0);
                    const totalAssignedTopics = allTopicsList.filter(t => t.supervisorLecturerCode && t.status.toLowerCase() !== "rejected").length;

                    const overloadedCount = allLecturers.filter(lec => {
                      const count = allTopicsList.filter(t => t.supervisorLecturerCode === lec.lecturerCode && t.status.toLowerCase() !== "rejected").length;
                      return count > (lec.guideQuota || 5);
                    }).length;

                    const fullCount = allLecturers.filter(lec => {
                      const count = allTopicsList.filter(t => t.supervisorLecturerCode === lec.lecturerCode && t.status.toLowerCase() !== "rejected").length;
                      return count === (lec.guideQuota || 5);
                    }).length;

                    const underCount = allLecturers.filter(lec => {
                      const count = allTopicsList.filter(t => t.supervisorLecturerCode === lec.lecturerCode && t.status.toLowerCase() !== "rejected").length;
                      return count < (lec.guideQuota || 5);
                    }).length;

                    const loadPercent = totalQuota > 0 ? Math.round((totalAssignedTopics / totalQuota) * 100) : 0;
                    const avgLoad = totalLecs > 0 ? (totalAssignedTopics / totalLecs).toFixed(1) : "0.0";

                    return (
                      <div style={{
                        background: "white",
                        borderRadius: "24px",
                        border: "1px solid #D9E1F2",
                        padding: "24px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                      }}>
                        {/* Quota & Load Statistics Dashboard */}
                        <div style={{
                          background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                          borderRadius: "16px",
                          border: "1px solid #e2e8f0",
                          padding: "20px 24px",
                          marginBottom: "24px",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
                            <Award size={20} color="#1e3a5f" />
                            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#1e3a5f" }}>
                              Báo cáo định mức & Tải lượng hướng dẫn của Giảng viên
                            </h3>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                            {/* Card 1: Tổng số GV */}
                            <div style={{ background: "white", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                                <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b" }}>Giảng viên tham gia</span>
                                <Users size={16} color="#3b82f6" />
                              </div>
                              <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                                <span style={{ fontSize: "20px", fontWeight: "800", color: "#1e293b" }}>{totalLecs}</span>
                                <span style={{ fontSize: "12px", color: "#64748b" }}>giảng viên</span>
                              </div>
                              <p style={{ margin: "8px 0 0 0", fontSize: "11px", color: "#64748b" }}>Tham gia điều hành đợt đồ án</p>
                            </div>

                            {/* Card 2: Tổng năng lực đợt */}
                            <div style={{ background: "white", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                                <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b" }}>Năng lực nhận hướng dẫn</span>
                                <TrendingUp size={16} color="#8b5cf6" />
                              </div>
                              <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                                <span style={{ fontSize: "20px", fontWeight: "800", color: "#1e293b" }}>{totalAssignedTopics}</span>
                                <span style={{ fontSize: "12px", color: "#64748b" }}>/ {totalQuota} chỉ tiêu</span>
                                <span style={{ marginLeft: "auto", fontSize: "12px", fontWeight: "800", color: "#8b5cf6", background: "#f3e8ff", padding: "2px 6px", borderRadius: "6px" }}>
                                  {loadPercent}%
                                </span>
                              </div>
                              <div style={{ height: "6px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden", marginTop: "12px" }}>
                                <div style={{ width: `${loadPercent}%`, height: "100%", background: "#8b5cf6", borderRadius: "3px" }} />
                              </div>
                            </div>

                            {/* Card 3: Trạng thái tải của giảng viên */}
                            <div style={{ background: "white", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                                <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b" }}>Trạng thái định mức tải</span>
                                <Award size={16} color="#f37021" />
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", fontSize: "12px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", color: "#166534", fontWeight: "700" }}>
                                  <span>Dưới tải:</span> <span>{underCount}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", color: "#b45309", fontWeight: "700" }}>
                                  <span>Đầy tải:</span> <span>{fullCount}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", color: "#991b1b", fontWeight: "700", gridColumn: "1 / span 2" }}>
                                  <span>Quá chỉ tiêu định mức:</span> <span>{overloadedCount}</span>
                                </div>
                              </div>
                            </div>

                            {/* Card 4: Trung bình phân công */}
                            <div style={{ background: "white", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                                <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b" }}>Phân bổ trung bình đợt</span>
                                <CheckCircle size={16} color="#10b981" />
                              </div>
                              <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                                <span style={{ fontSize: "20px", fontWeight: "800", color: "#10b981" }}>{avgLoad}</span>
                                <span style={{ fontSize: "12px", color: "#64748b" }}>đề tài / giảng viên</span>
                              </div>
                              <p style={{ margin: "8px 0 0 0", fontSize: "11px", color: "#64748b" }}>Mức phân bổ tải lượng thực tế</p>
                            </div>
                          </div>
                        </div>

                        {/* Search and filter toolbar */}
                        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
                          <div style={{ position: "relative", minWidth: 320 }}>
                            <Search size={18} color="#9CA3AF" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                            <input
                              type="text"
                              placeholder="Tìm giảng viên theo mã, tên, học vị..."
                              value={lecturerLoadSearchTerm}
                              onChange={(e) => setLecturerLoadSearchTerm(e.target.value)}
                              style={{
                                width: "100%",
                                padding: "10px 14px 10px 42px",
                                border: "1px solid #CBD5E1",
                                borderRadius: "12px",
                                fontSize: "14px",
                                outline: "none"
                              }}
                            />
                          </div>

                          <select
                            value={lecturerLoadDeptFilter}
                            onChange={(e) => setLecturerLoadDeptFilter(e.target.value)}
                            style={{
                              padding: "10px 16px",
                              border: "1px solid #CBD5E1",
                              borderRadius: "12px",
                              fontSize: "14px",
                              outline: "none",
                              background: "white",
                              minWidth: 200,
                              fontWeight: "600",
                              color: "#475569"
                            }}
                          >
                            <option value="all">Tất cả khoa</option>
                            {Array.from(new Set(allLecturers.map(l => l.departmentCode).filter(Boolean))).map(dept => (
                              <option key={dept} value={dept}>{dept}</option>
                            ))}
                          </select>
                        </div>

                        {/* Lecturers Table */}
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", fontSize: "14px", borderCollapse: "separate", borderSpacing: "0 8px" }}>
                            <thead>
                              <tr style={{ background: "#f8fafc", color: "#475569" }}>
                                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Mã GV</th>
                                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Giảng viên</th>
                                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Khoa</th>
                                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Học vị</th>
                                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "700" }}>Chỉ tiêu</th>
                                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700", minWidth: 200 }}>Tải lượng hướng dẫn</th>
                                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "700" }}>Trạng thái tải</th>
                                <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "700" }}>Thao tác</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredLecturers.length === 0 ? (
                                <tr>
                                  <td colSpan={8} style={{ padding: "32px", textAlign: "center", color: "#64748b", fontStyle: "italic" }}>
                                    Không tìm thấy giảng viên nào phù hợp với bộ lọc.
                                  </td>
                                </tr>
                              ) : (
                                paginatedLecturers.map((lecturer) => {
                                  const activeCount = allTopicsList.filter(t => t.supervisorLecturerCode === lecturer.lecturerCode && t.status.toLowerCase() !== "rejected").length;
                                  const quota = lecturer.guideQuota || 5;
                                  const pct = Math.min(100, Math.round((activeCount / quota) * 100));
                                  const isOverloaded = activeCount > quota;
                                  const isFull = activeCount === quota;

                                  const badgeColor = isOverloaded ? "#ef4444" : isFull ? "#f59e0b" : "#22c55e";
                                  const badgeBg = isOverloaded ? "#fee2e2" : isFull ? "#fef3c7" : "#dcfce7";
                                  const badgeLabel = isOverloaded ? "Quá tải trọng" : isFull ? "Đầy chỉ tiêu" : "Dưới định mức";

                                  const isExpanded = expandedLecturerCode === lecturer.lecturerCode;
                                  const lecturerTopics = allTopicsList.filter(t => t.supervisorLecturerCode === lecturer.lecturerCode && t.status.toLowerCase() !== "rejected");

                                  return (
                                    <React.Fragment key={lecturer.lecturerCode}>
                                      <tr
                                        onClick={() => setExpandedLecturerCode(isExpanded ? null : lecturer.lecturerCode)}
                                        style={{
                                          background: "#fcfdfe",
                                          borderRadius: "16px",
                                          border: "1px solid #f1f5f9",
                                          cursor: "pointer",
                                          transition: "all 0.2s"
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = "#fcfdfe"; }}
                                      >
                                        <td style={{ padding: "16px", fontWeight: "700", color: "#1e3a5f", borderRadius: "12px 0 0 12px" }}>
                                          {lecturer.lecturerCode}
                                        </td>
                                        <td style={{ padding: "16px", fontWeight: "700", color: "#1e293b" }}>
                                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            {lecturer.fullName}
                                            {isExpanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                                          </div>
                                        </td>
                                        <td style={{ padding: "16px", color: "#475569", fontWeight: "600" }}>
                                          {lecturer.departmentCode || "-"}
                                        </td>
                                        <td style={{ padding: "16px", color: "#475569" }}>
                                          {lecturer.degree || "-"}
                                        </td>
                                        <td style={{ padding: "16px", textAlign: "center", fontWeight: "800", color: "#1e3a5f" }}>
                                          {quota}
                                        </td>
                                        <td style={{ padding: "16px" }}>
                                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <div style={{ flex: 1, height: "6px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
                                              <div style={{ width: `${pct}%`, height: "100%", background: badgeColor, borderRadius: "3px", transition: "width 0.3s" }} />
                                            </div>
                                            <span style={{ fontSize: "12px", fontWeight: "800", color: "#1e293b", minWidth: 45 }}>
                                              {activeCount} / {quota}
                                            </span>
                                          </div>
                                        </td>
                                        <td style={{ padding: "16px", borderRadius: "0", textAlign: "center" }}>
                                          <span style={{
                                            display: "inline-block",
                                            padding: "6px 12px",
                                            borderRadius: "99px",
                                            fontSize: "12px",
                                            fontWeight: "800",
                                            background: badgeBg,
                                            color: badgeColor
                                          }}>
                                            {badgeLabel}
                                          </span>
                                        </td>
                                        <td style={{ padding: "16px", borderRadius: "0 12px 12px 0", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                                          <button
                                            type="button"
                                            onClick={() => setEditQuotaModal({
                                              isOpen: true,
                                              lecturer,
                                              quotaValue: quota,
                                              defenseQuotaValue: lecturer.defenseQuota || 5
                                            })}
                                            style={{
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: "6px",
                                              padding: "6px 12px",
                                              borderRadius: "8px",
                                              border: "1px solid #cbd5e1",
                                              background: "white",
                                              color: "#334155",
                                              fontSize: "12px",
                                              fontWeight: "600",
                                              cursor: "pointer",
                                              transition: "all 0.15s ease-in-out",
                                            }}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.borderColor = "#1e3a5f";
                                              e.currentTarget.style.background = "#f1f5f9";
                                              e.currentTarget.style.color = "#1e3a5f";
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.borderColor = "#cbd5e1";
                                              e.currentTarget.style.background = "white";
                                              e.currentTarget.style.color = "#334155";
                                            }}
                                          >
                                            <Edit size={12} />
                                            Sửa định mức
                                          </button>
                                        </td>
                                      </tr>

                                      {/* Expanded sub-table row */}
                                      {isExpanded && (
                                        <tr>
                                          <td colSpan={8} style={{ padding: "8px 24px 20px 24px", background: "#f8fafc" }}>
                                            <div style={{
                                              background: "white",
                                              borderRadius: "16px",
                                              border: "1px solid #e2e8f0",
                                              padding: "16px",
                                              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)"
                                            }}>
                                              <h4 style={{ margin: "0 0 12px 0", fontSize: 13, fontWeight: "800", color: "#1e3a5f", textTransform: "uppercase" }}>
                                                Danh sách sinh viên đang hướng dẫn ({lecturerTopics.length})
                                              </h4>
                                              {lecturerTopics.length === 0 ? (
                                                <p style={{ margin: 0, fontStyle: "italic", fontSize: 13, color: "#64748b" }}>Giảng viên này chưa được phân công sinh viên nào.</p>
                                              ) : (
                                                <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
                                                  <thead>
                                                    <tr style={{ color: "#64748b", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                                                      <th style={{ padding: "8px 12px", fontWeight: "700" }}>Mã SV</th>
                                                      <th style={{ padding: "8px 12px", fontWeight: "700" }}>Sinh viên</th>
                                                      <th style={{ padding: "8px 12px", fontWeight: "700" }}>Lớp</th>
                                                      <th style={{ padding: "8px 12px", fontWeight: "700" }}>Đề tài</th>
                                                      <th style={{ padding: "8px 12px", fontWeight: "700" }}>Loại</th>
                                                      <th style={{ padding: "8px 12px", fontWeight: "700" }}>Trạng thái</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {lecturerTopics.map(topic => {
                                                      const student = allStudents.find(s => s.studentCode === topic.proposerStudentCode);
                                                      return (
                                                        <tr key={topic.topicID} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                                          <td style={{ padding: "10px 12px", fontWeight: "600", color: "#1e3a5f" }}>{topic.proposerStudentCode}</td>
                                                          <td style={{ padding: "10px 12px", fontWeight: "700", color: "#1e293b" }}>{student?.fullName || "-"}</td>
                                                          <td style={{ padding: "10px 12px", color: "#475569" }}>{student?.classCode || "-"}</td>
                                                          <td style={{ padding: "10px 12px", fontWeight: "600", color: "#334155" }}>{topic.title}</td>
                                                          <td style={{ padding: "10px 12px" }}>{topic.type === "CATALOG" ? "Catalog" : "Tự chọn"}</td>
                                                          <td style={{ padding: "10px 12px" }}>
                                                            <span style={{
                                                              padding: "2px 8px",
                                                              borderRadius: 99,
                                                              fontSize: 11,
                                                              fontWeight: 800,
                                                              background: topic.status === "Đã duyệt" ? "#dcfce7" : "#fef3c7",
                                                              color: topic.status === "Đã duyệt" ? "#166534" : "#b45309"
                                                            }}>{topic.status}</span>
                                                          </td>
                                                        </tr>
                                                      );
                                                    })}
                                                  </tbody>
                                                </table>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                        {renderPagination(lecturerLoadCurrentPage, Math.ceil(filteredLecturers.length / 10), setLecturerLoadCurrentPage)}
                      </div>
                    );
                  })()}

                  {/* TAB 5: REPORT EXPORT CENTER */}
                  {/* TAB 5: REPORT EXPORT CENTER */}
                  {activeAdminTab === "export" && (() => {
                    const currentTemplate = EXPORT_REPORTS.find(t => t.key === selectedTemplateKey) || EXPORT_REPORTS[0];

                    // Group fields by category
                    const categories: Record<string, any[]> = {};
                    if (currentTemplate.fields) {
                      currentTemplate.fields.forEach((f: any) => {
                        if (!categories[f.category]) categories[f.category] = [];
                        categories[f.category].push(f);
                      });
                    }

                    return (
                      <div style={{ display: "grid", gap: "24px", animation: "modalFadeIn 0.4s ease-out" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "24px", alignItems: "start" }}>

                          {/* Column 1: Report template selection */}
                          <div style={{ background: "#f8fafc", padding: "24px", borderRadius: "20px", border: "1px solid #e2e8f0" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#1e3a5f", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "800" }}>1</div>
                              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Chọn mẫu báo cáo</h3>
                            </div>

                            <div style={{ display: "grid", gap: "10px" }}>
                              {EXPORT_REPORTS.map((item) => (
                                <button
                                  key={item.key}
                                  type="button"
                                  onClick={() => {
                                    setSelectedTemplateKey(item.key);
                                    if (item.fields) {
                                      setSelectedFields(item.fields.map(f => f.key));
                                    } else {
                                      setSelectedFields([]);
                                    }
                                  }}
                                  style={{
                                    width: "100%", padding: "16px", borderRadius: "16px", textAlign: "left",
                                    border: `2px solid ${selectedTemplateKey === item.key ? "#1e3a5f" : "transparent"}`,
                                    background: selectedTemplateKey === item.key ? "white" : "transparent",
                                    boxShadow: selectedTemplateKey === item.key ? "0 4px 12px rgba(0,0,0,0.05)" : "none",
                                    cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: "12px"
                                  }}
                                  onMouseEnter={(e) => {
                                    if (selectedTemplateKey !== item.key) e.currentTarget.style.background = "#f1f5f9";
                                  }}
                                  onMouseLeave={(e) => {
                                    if (selectedTemplateKey !== item.key) e.currentTarget.style.background = "transparent";
                                  }}
                                >
                                  <div style={{ color: selectedTemplateKey === item.key ? "#1e3a5f" : "#94a3b8" }}>{item.icon}</div>
                                  <span style={{ fontSize: "14px", fontWeight: selectedTemplateKey === item.key ? "700" : "600", color: selectedTemplateKey === item.key ? "#1e293b" : "#64748b" }}>{item.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Column 2: Fields Configuration */}
                          <div style={{ background: "white", padding: "32px", borderRadius: "20px", border: "1px solid #e2e8f0", minHeight: "500px", display: "flex", flexDirection: "column" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#1e3a5f", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "800" }}>2</div>
                                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cấu hình trường dữ liệu</h3>
                              </div>
                              {currentTemplate.fields && (
                                <div style={{ display: "flex", gap: "16px" }}>
                                  <button type="button" onClick={() => setSelectedFields(currentTemplate.fields?.map(f => f.key) || [])} style={{ background: "none", border: "none", color: "#1e3a5f", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>Chọn tất cả</button>
                                  <button type="button" onClick={() => setSelectedFields([])} style={{ background: "none", border: "none", color: "#ef4444", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>Bỏ chọn</button>
                                </div>
                              )}
                            </div>

                            {currentTemplate.key === "all-students" && (
                              <div style={{
                                marginBottom: "24px",
                                padding: "20px",
                                background: "#f8fafc",
                                borderRadius: "16px",
                                border: "1px solid #e2e8f0"
                              }}>
                                <div style={{
                                  fontSize: "12px",
                                  fontWeight: "800",
                                  color: "#64748b",
                                  marginBottom: "14px",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px"
                                }}>
                                  Bộ lọc trạng thái sinh viên
                                  <div style={{ flex: 1, height: "1px", background: "#cbd5e1" }} />
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                                  {[
                                    { id: "all", label: "Tất cả sinh viên" },
                                    { id: "has-topic", label: "Đã có đề tài" },
                                    { id: "no-topic", label: "Chưa có đề tài" },
                                  ].map(opt => (
                                    <label
                                      key={opt.id}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "10px",
                                        padding: "12px 16px",
                                        borderRadius: "12px",
                                        border: `2px solid ${studentFilter === opt.id ? "#1e3a5f" : "#e2e8f0"}`,
                                        background: studentFilter === opt.id ? "rgba(30, 58, 95, 0.03)" : "white",
                                        cursor: "pointer",
                                        transition: "all 0.2s",
                                        fontWeight: "700",
                                        fontSize: "13px",
                                        color: studentFilter === opt.id ? "#1e3a5f" : "#475569",
                                        boxShadow: studentFilter === opt.id ? "0 4px 6px -1px rgba(0,0,0,0.05)" : "none"
                                      }}
                                      onMouseEnter={(e) => {
                                        if (studentFilter !== opt.id) e.currentTarget.style.borderColor = "#cbd5e1";
                                      }}
                                      onMouseLeave={(e) => {
                                        if (studentFilter !== opt.id) e.currentTarget.style.borderColor = "#e2e8f0";
                                      }}
                                    >
                                      <input
                                        type="radio"
                                        name="studentFilter"
                                        checked={studentFilter === opt.id}
                                        onChange={() => setStudentFilter(opt.id as any)}
                                        style={{ width: "16px", height: "16px", accentColor: "#1e3a5f", cursor: "pointer" }}
                                      />
                                      {opt.label}
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}

                            {currentTemplate.fields ? (
                              <div style={{ flex: 1, display: "grid", gap: "32px" }}>
                                {Object.entries(categories).map(([cat, fields]) => (
                                  <div key={cat}>
                                    <div style={{ fontSize: "12px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
                                      {cat} <div style={{ flex: 1, height: "1px", background: "#f1f5f9" }} />
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
                                      {fields.map(field => {
                                        const isChecked = selectedFields.includes(field.key);
                                        return (
                                          <label
                                            key={field.key}
                                            style={{
                                              display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderRadius: "14px",
                                              border: `1px solid ${isChecked ? "#1e3a5f" : "#f1f5f9"}`,
                                              background: isChecked ? "rgba(30, 58, 95, 0.03)" : "#fcfdfe",
                                              cursor: "pointer", transition: "all 0.2s"
                                            }}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => {
                                                setSelectedFields(prev => prev.includes(field.key) ? prev.filter(k => k !== field.key) : [...prev, field.key]);
                                              }}
                                              style={{ width: "18px", height: "18px", accentColor: "#1e3a5f", cursor: "pointer" }}
                                            />
                                            <span style={{ fontSize: "13px", fontWeight: "600", color: isChecked ? "#1e293b" : "#64748b" }}>{field.label}</span>
                                          </label>
                                        );
                                      })}
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

                        {/* Bottom Row: Export format & Action button */}
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
                                  type="button"
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
                            type="button"
                            onClick={() => handleDownloadReport(currentTemplate, exportFormat, selectedFields)}
                            disabled={!selectedPeriodId || isExporting || (currentTemplate.fields && selectedFields.length === 0)}
                            style={{
                              padding: "16px 48px", borderRadius: "16px", border: "none",
                              background: "#3b82f6", color: "white", fontWeight: "800", fontSize: "15px",
                              cursor: (isExporting || (currentTemplate.fields && selectedFields.length === 0)) ? "not-allowed" : "pointer",
                              display: "flex", alignItems: "center", gap: "12px",
                              boxShadow: "0 10px 15px -3px rgba(59, 130, 246, 0.3)", transition: "all 0.2s",
                              opacity: (isExporting || (currentTemplate.fields && selectedFields.length === 0)) ? 0.6 : 1
                            }}
                          >
                            {isExporting ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={20} />}
                            Xuất dữ liệu ngay
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* Comment Modal */}
      {commentModal.isOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20000,
          }}
          onClick={closeCommentModal}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "500px",
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "#1a1a1a",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {commentModal.action === "reject" ? (
                <AlertCircle size={20} color="#EF4444" />
              ) : (
                <Edit size={20} color="#8B5CF6" />
              )}
              {commentModal.action === "reject"
                ? "Từ chối đề tài"
                : "Yêu cầu sửa đổi"}
            </h3>

            <div style={{ marginBottom: "16px" }}>
              <p
                style={{
                  fontSize: "14px",
                  color: "#666",
                  marginBottom: "8px",
                }}
              >
                <strong>Đề tài:</strong> {commentModal.topicTitle}
              </p>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                {commentModal.action === "reject"
                  ? "Lý do từ chối:"
                  : "Yêu cầu sửa đổi:"}
              </label>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={
                  commentModal.action === "reject"
                    ? "Nhập lý do từ chối đề tài..."
                    : "Nhập yêu cầu sửa đổi cho sinh viên..."
                }
                style={{
                  width: "100%",
                  minHeight: "100px",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  resize: "vertical",
                  outline: "none",
                  transition: "border-color 0.2s ease",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#F59E0B";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#D1D5DB";
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={closeCommentModal}
                style={{
                  padding: "8px 16px",
                  background: "#F3F4F6",
                  color: "#374151",
                  border: "1px solid #D1D5DB",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#E5E7EB";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#F3F4F6";
                }}
              >
                Hủy
              </button>
              <button
                onClick={handleCommentSubmit}
                disabled={!commentText.trim() || updatingStatus !== null}
                style={{
                  padding: "8px 16px",
                  background:
                    commentText.trim() && updatingStatus === null
                      ? commentModal.action === "reject"
                        ? "#EF4444"
                        : "#8B5CF6"
                      : "#9CA3AF",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor:
                    commentText.trim() && updatingStatus === null
                      ? "pointer"
                      : "not-allowed",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
                onMouseEnter={(e) => {
                  if (commentText.trim() && updatingStatus === null) {
                    e.currentTarget.style.opacity = "0.9";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
              >
                {updatingStatus ? (
                  <>
                    <Loader2
                      size={14}
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                    Đang xử lý...
                  </>
                ) : commentModal.action === "reject" ? (
                  "Từ chối"
                ) : (
                  "Yêu cầu sửa đổi"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Comment Modal */}
      {viewCommentModal.isOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20000,
          }}
          onClick={closeViewCommentModal}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "500px",
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#1F2937",
                  margin: 0,
                }}
              >
                Nhận xét của giảng viên
              </h3>
              <button
                onClick={closeViewCommentModal}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#6B7280",
                  padding: "4px",
                  borderRadius: "4px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#F3F4F6";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "none";
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <strong style={{ color: "#374151" }}>Đề tài:</strong>{" "}
              <span style={{ color: "#6B7280" }}>
                {viewCommentModal.topicTitle}
              </span>
            </div>

            <div
              style={{
                background: "#F9FAFB",
                border: "1px solid #E5E7EB",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "20px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "#374151",
                  lineHeight: "1.6",
                  whiteSpace: "pre-wrap",
                }}
              >
                {viewCommentModal.comments}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={closeViewCommentModal}
                style={{
                  padding: "8px 16px",
                  background: "#6B7280",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#4B5563";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#6B7280";
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmationModal.isOpen && confirmationModal.topic && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20000,
          }}
          onClick={closeConfirmationModal}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "680px",
              width: "90%",
              maxHeight: "90vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: "20px",
                fontWeight: "600",
                color: "#1a1a1a",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <CheckCircle size={24} color="#22C55E" />
              Xác nhận duyệt đề tài
            </h3>

            <div style={{ marginBottom: "24px" }}>
              <div
                style={{
                  background: "#F0FDF4",
                  border: "1px solid #22C55E",
                  borderRadius: "8px",
                  padding: "16px",
                  marginBottom: "16px",
                }}
              >
                <h4
                  style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#1a1a1a",
                    marginBottom: "8px",
                  }}
                >
                  {confirmationModal.topic.title}
                </h4>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#666",
                    margin: 0,
                    lineHeight: "1.5",
                  }}
                >
                  {confirmationModal.topic.description}
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "16px",
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      fontWeight: "600",
                      textTransform: "uppercase",
                    }}
                  >
                    Sinh viên
                  </span>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#1a1a1a",
                      margin: "4px 0",
                      fontWeight: "500",
                    }}
                  >
                    {confirmationModal.topic.studentName}
                  </p>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      margin: 0,
                    }}
                  >
                    {confirmationModal.topic.studentCode}
                  </p>
                </div>

                <div>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      fontWeight: "600",
                      textTransform: "uppercase",
                    }}
                  >
                    Danh mục
                  </span>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#1a1a1a",
                      margin: "4px 0",
                      fontWeight: "500",
                    }}
                  >
                    {confirmationModal.topic.category}
                  </p>
                </div>

                <div>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      fontWeight: "600",
                      textTransform: "uppercase",
                    }}
                  >
                    Ngày nộp
                  </span>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#1a1a1a",
                      margin: "4px 0",
                      fontWeight: "500",
                    }}
                  >
                    {new Date(
                      confirmationModal.topic.submissionDate,
                    ).toLocaleDateString("vi-VN")}
                  </p>
                </div>
              </div>

              {confirmationModal.topic.studentProfile && (
                <div
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: "8px",
                    padding: "16px",
                    marginTop: "16px",
                  }}
                >
                  <h5
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#002855",
                      marginBottom: "12px",
                    }}
                  >
                    Thông tin sinh viên
                  </h5>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(150px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#666",
                          fontWeight: "600",
                        }}
                      >
                        Email:
                      </span>
                      <p
                        style={{
                          fontSize: "13px",
                          color: "#1a1a1a",
                          margin: "2px 0",
                        }}
                      >
                        {confirmationModal.topic.studentProfile.studentEmail}
                      </p>
                    </div>
                    <div>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#666",
                          fontWeight: "600",
                        }}
                      >
                        GPA:
                      </span>
                      <p
                        style={{
                          fontSize: "13px",
                          color: "#1a1a1a",
                          margin: "2px 0",
                        }}
                      >
                        {confirmationModal.topic.studentProfile.gpa}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                background: "#FEF3C7",
                border: "1px solid #FCD34D",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "24px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "8px",
                }}
              >
                <AlertCircle size={16} color="#92400E" />
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#92400E",
                  }}
                >
                  Lưu ý quan trọng
                </span>
              </div>
              <p
                style={{
                  fontSize: "13px",
                  color: "#92400E",
                  margin: 0,
                  lineHeight: "1.5",
                }}
              >
                Khi duyệt đề tài, bạn sẽ trở thành giảng viên hướng dẫn chính
                của sinh viên này và tiến độ luận văn sẽ được cập nhật tự động.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={closeConfirmationModal}
                style={{
                  padding: "10px 20px",
                  background: "#F3F4F6",
                  color: "#374151",
                  border: "1px solid #D1D5DB",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#E5E7EB";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#F3F4F6";
                }}
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmApprove}
                disabled={updatingStatus !== null}
                style={{
                  padding: "10px 20px",
                  background: updatingStatus === null ? "#22C55E" : "#9CA3AF",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: updatingStatus === null ? "pointer" : "not-allowed",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
                onMouseEnter={(e) => {
                  if (updatingStatus === null) {
                    e.currentTarget.style.background = "#16A34A";
                  }
                }}
                onMouseLeave={(e) => {
                  if (updatingStatus === null) {
                    e.currentTarget.style.background = "#22C55E";
                  }
                }}
              >
                {updatingStatus ? (
                  <>
                    <Loader2
                      size={16}
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Xác nhận duyệt
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successModal.isOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20000,
          }}
          onClick={closeSuccessModal}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "400px",
              width: "90%",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "#F0FDF4",
                border: "4px solid #22C55E",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <CheckCircle size={32} color="#22C55E" />
            </div>

            <h3
              style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "#1a1a1a",
                marginBottom: "8px",
              }}
            >
              {successModal.action === "approve" && "Duyệt đề tài thành công"}
              {successModal.action === "reject" && "Từ chối đề tài thành công"}
              {successModal.action === "revision" &&
                "Yêu cầu sửa đổi thành công"}
            </h3>

            <p
              style={{
                fontSize: "14px",
                color: "#666",
                marginBottom: "24px",
                lineHeight: "1.5",
              }}
            >
              Đề tài <strong>"{successModal.topicTitle}"</strong> đã được{" "}
              {successModal.action === "approve" && "duyệt"}
              {successModal.action === "reject" && "từ chối"}
              {successModal.action === "revision" && "yêu cầu sửa đổi"} thành
              công.
            </p>

            <button
              onClick={closeSuccessModal}
              style={{
                padding: "10px 24px",
                background: "#22C55E",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#16A34A";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#22C55E";
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailModal.isOpen && detailModal.topic && (() => {
        const topic = detailModal.topic;
        const stats = calculateStats(detailMilestones, detailSubmissions);
        const progress = calculateProgress(detailMilestones);

        return (
          <div
            style={{
              position: "fixed",
              top: "64px",
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "16px",
              animation: "modalFadeIn 0.3s ease-out",
            }}
            onClick={closeDetailModal}
          >
            <div
              className="modal-content smooth-scroll"
              style={{
                background: "white",
                borderRadius: "20px",
                width: "100%",
                maxWidth: "1100px",
                maxHeight: "80vh",
                overflow: "hidden",
                boxShadow: "0 25px 50px rgba(0, 0, 0, 0.25)",
                position: "relative",
                display: "flex",
                flexDirection: "column",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button X */}
              <button
                onClick={closeDetailModal}
                style={{
                  position: "absolute",
                  top: "24px",
                  right: "24px",
                  width: "40px",
                  height: "40px",
                  borderRadius: "12px",
                  backgroundColor: "white",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  cursor: "pointer",
                  zIndex: 100,
                  transition: "all 0.2s ease",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f1f5f9";
                  e.currentTarget.style.color = "#0f172a";
                  e.currentTarget.style.transform = "scale(1.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "white";
                  e.currentTarget.style.color = "#64748b";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <X size={20} />
              </button>

              <div
                className="custom-scrollbar"
                style={{
                  overflowY: "auto",
                  flex: 1,
                }}
              >
                {isDetailLoading || !topic ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "400px", gap: "16px" }}>
                    <div style={{ width: "40px", height: "40px", border: "4px solid #f3f4f6", borderTop: "4px solid #F37021", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                    <p style={{ color: "#64748b", fontWeight: "600" }}>Đang tải dữ liệu chi tiết...</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", minHeight: "100%" }}>
                    {/* --- LEFT: TOPIC DETAILS & PROGRESS (7 cols) --- */}
                    <div style={{ gridColumn: "span 7", padding: "40px", backgroundColor: "white" }}>

                      {/* Topic Title & Badges */}
                      <div style={{ marginBottom: "40px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                          <span
                            style={{
                              padding: "6px 12px",
                              background: getStatusColor(topic.status) + "15",
                              color: getStatusColor(topic.status),
                              borderRadius: "10px",
                              fontSize: "12px",
                              fontWeight: "800",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            {getStatusIcon(topic.status)}
                            {getStatusText(topic.status)}
                          </span>
                          <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600" }}>
                            Mã đề tài: {topic.topicCode}
                          </span>
                          <span style={{ fontSize: "12px", background: "#f0f6ff", color: "#1e3a5f", padding: "4px 10px", borderRadius: "8px", fontWeight: "700" }}>
                            {topic.category}
                          </span>
                        </div>
                        <h2 style={{ fontSize: "32px", fontWeight: "800", color: "#0f172a", lineHeight: "1.2", marginBottom: "16px" }}>
                          {topic.title}
                        </h2>
                        <div style={{ fontSize: "14px", color: "#64748b", fontWeight: "600" }}>
                          Sinh viên thực hiện: <span style={{ color: "#0f172a", fontWeight: "800" }}>{topic.studentName}</span> ({topic.studentCode})
                        </div>
                      </div>

                      {/* Summary Section */}
                      <div style={{ background: "#f8fafc", padding: "32px", borderRadius: "24px", border: "1px solid #f1f5f9", marginBottom: "32px" }}>
                        <h3 style={{ fontSize: "14px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                          <BookOpen size={18} color="#f37021" />
                          Mô tả đề tài
                        </h3>
                        <p style={{ fontSize: "15px", color: "#334155", lineHeight: "1.8", margin: 0, whiteSpace: "pre-wrap" }}>
                          {topic.description || "Không có mô tả chi tiết cho đề tài này."}
                        </p>
                      </div>

                      {/* Tags Section */}
                      <div style={{ marginBottom: "32px" }}>
                        <h3 style={{ fontSize: "14px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                          <TagIcon size={18} color="#f37021" />
                          Lĩnh vực & Chuyên ngành
                        </h3>
                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                          {topicTags.length > 0 ? (
                            topicTags.map((tag) => (
                              <span key={tag.tagID} style={{ padding: "8px 16px", background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", fontSize: "13px", fontWeight: "600", color: "#1e293b", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                                {tag.tagName}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: "13px", color: "#94a3b8", fontStyle: "italic" }}>Chưa có thông tin lĩnh vực</span>
                          )}
                        </div>
                      </div>

                      {/* Quick Stats Grid */}
                      {!currentLecturerOnly && activeAdminTab !== "overview" && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "40px" }}>
                          <div style={{ padding: "20px", background: "white", borderRadius: "20px", border: "1px solid #f1f5f9", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)", display: "flex", alignItems: "center", gap: "16px" }}>
                            <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981" }}>
                              <TrendingUp size={24} />
                            </div>
                            <div>
                              <div style={{ fontSize: "11px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase" }}>Nộp đúng hạn</div>
                              <div style={{ fontSize: "20px", fontWeight: "900", color: "#0f172a" }}>{stats.onTimeRate}%</div>
                            </div>
                          </div>

                          <div style={{ padding: "20px", background: "white", borderRadius: "20px", border: "1px solid #f1f5f9", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)", display: "flex", alignItems: "center", gap: "16px" }}>
                            <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "rgba(245, 158, 11, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b" }}>
                              <Archive size={24} />
                            </div>
                            <div>
                              <div style={{ fontSize: "11px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase" }}>Số lần sửa</div>
                              <div style={{ fontSize: "20px", fontWeight: "900", color: "#0f172a" }}>{stats.revisionCount}</div>
                            </div>
                          </div>

                          <div style={{ padding: "20px", background: "white", borderRadius: "20px", border: "1px solid #f1f5f9", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)", display: "flex", alignItems: "center", gap: "16px" }}>
                            <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "rgba(59, 130, 246, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6" }}>
                              <Clock size={24} />
                            </div>
                            <div>
                              <div style={{ fontSize: "11px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase" }}>Ngày còn lại</div>
                              <div style={{ fontSize: "20px", fontWeight: "900", color: "#0f172a" }}>
                                {stats.daysRemaining !== null ? `${stats.daysRemaining} ngày` : "---"}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Timeline Tracker */}
                      {!currentLecturerOnly && activeAdminTab !== "overview" && (
                        <div style={{ marginBottom: "40px" }}>
                          <h3 style={{ fontSize: "14px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "24px", display: "flex", alignItems: "center", gap: "8px" }}>
                            <Clock size={18} color="#f37021" />
                            Lộ trình thực hiện
                          </h3>
                          <div style={{ display: "flex", alignItems: "flex-start", padding: "0 10px" }}>
                            {(() => {
                              const mainMilestone = detailMilestones?.[0];
                              const currentState = mainMilestone?.state;
                              const milestoneList = [
                                { code: "MS_REG", name: "Đăng ký" },
                                { code: "MS_PROG1", name: "Báo cáo 1" },
                                { code: "MS_PROG2", name: "Báo cáo 2" },
                                { code: "MS_FULL", name: currentState === "WaitingForCommittee" ? "Khóa luận hoàn chỉnh" : "Hoàn thiện" }
                              ];

                              const firstNotCompletedIdx = [
                                mainMilestone?.completedAt1,
                                mainMilestone?.completedAt2,
                                mainMilestone?.completedAt3,
                                mainMilestone?.completedAt4
                              ].findIndex(val => !val);

                              return milestoneList.map((m, idx) => {
                                const completedAtKey = `completedAt${idx + 1}`;
                                const completedAtValue = mainMilestone ? (mainMilestone as any)[completedAtKey] : null;
                                let isCompleted = !!completedAtValue;
                                if (idx === 3 && currentState === "WaitingForCommittee") isCompleted = true;

                                let isCurrent = false;
                                if (firstNotCompletedIdx === idx && currentState !== "WaitingForCommittee") isCurrent = true;

                                return (
                                  <React.Fragment key={m.code}>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, position: "relative" }}>
                                      <div style={{
                                        width: "40px",
                                        height: "40px",
                                        borderRadius: "14px",
                                        backgroundColor: isCompleted ? "#10b981" : isCurrent ? "#f37021" : "#f1f5f9",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: isCompleted || isCurrent ? "white" : "#94a3b8",
                                        boxShadow: isCurrent ? "0 0 0 4px rgba(243, 112, 33, 0.2)" : "none",
                                        zIndex: 2,
                                        transition: "all 0.3s ease",
                                      }}>
                                        {isCompleted ? <CheckCircle size={20} /> : <span style={{ fontWeight: "900", fontSize: "14px" }}>{idx + 1}</span>}
                                      </div>
                                      <div style={{ marginTop: "12px", textAlign: "center" }}>
                                        <div style={{ fontSize: "13px", fontWeight: "800", color: isCurrent ? "#f37021" : "#1e293b" }}>{m.name}</div>
                                        <div style={{ fontSize: "10px", fontWeight: "600", color: "#94a3b8", marginTop: "2px" }}>
                                          {isCompleted && completedAtValue ? (
                                            <span style={{ color: "#10b981" }}>{new Date(completedAtValue).toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit' })}</span>
                                          ) : isCurrent ? "Đang làm" : "Chờ tới"}
                                        </div>
                                      </div>
                                    </div>
                                    {idx < 3 && (
                                      <div style={{
                                        flex: 1,
                                        height: "4px",
                                        backgroundColor: !!(mainMilestone as any)?.[`completedAt${idx + 2}`] ? "#10b981" : isCompleted ? "#f37021" : "#f1f5f9",
                                        marginTop: "18px",
                                        marginRight: "-20px",
                                        marginLeft: "-20px",
                                        zIndex: 1,
                                        transition: "background-color 0.3s ease",
                                      }} />
                                    )}
                                  </React.Fragment>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Submissions History Table */}
                      {!currentLecturerOnly && activeAdminTab !== "overview" && (
                        <div style={{ marginBottom: "40px" }}>
                          <h3 style={{ fontSize: "14px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
                            <Archive size={18} color="#f37021" />
                            Theo dõi Tiến độ & Bài nộp
                          </h3>
                          <div style={{ background: "white", borderRadius: "24px", border: "1px solid #f1f5f9", overflowX: "auto", overflowY: "auto", maxHeight: "420px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }} className="custom-scrollbar">
                            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
                              <thead>
                                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, zIndex: 10 }}>
                                  <th style={{ padding: "16px", textAlign: "left", fontSize: "11px", fontWeight: "900", color: "#64748b", textTransform: "uppercase", width: "120px" }}>Mốc / Lần</th>
                                  <th style={{ padding: "16px", textAlign: "left", fontSize: "11px", fontWeight: "900", color: "#64748b", textTransform: "uppercase", width: "200px" }}>Tệp tin</th>
                                  <th style={{ padding: "16px", textAlign: "left", fontSize: "11px", fontWeight: "900", color: "#64748b", textTransform: "uppercase", width: "120px" }}>Ngày nộp</th>
                                  <th style={{ padding: "16px", textAlign: "left", fontSize: "11px", fontWeight: "900", color: "#64748b", textTransform: "uppercase", width: "150px" }}>Trạng thái</th>
                                  <th style={{ padding: "16px", textAlign: "left", fontSize: "11px", fontWeight: "900", color: "#64748b", textTransform: "uppercase" }}>Nhận xét giảng viên</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detailSubmissions && detailSubmissions.length > 0 ? (
                                  detailSubmissions.map((sub, idx) => (
                                    <tr key={sub.submissionID} style={{ borderBottom: idx === (detailSubmissions?.length || 0) - 1 ? "none" : "1px solid #f8fafc" }}>
                                      <td style={{ padding: "16px" }}>
                                        <div style={{ fontSize: "13px", fontWeight: "800", color: "#1e293b" }}>
                                          {sub.ordinal === 1 ? "Đăng ký đề tài" : sub.ordinal === 2 ? "Đề cương" : sub.ordinal === 3 ? "Báo cáo" : sub.ordinal === 4 ? "Hoàn thiện khóa luận" : sub.ordinal === 5 ? "Bảo vệ luận văn" : sub.milestoneCode || `Mốc ${sub.ordinal}`}
                                        </div>
                                        <div style={{ fontSize: "11px", fontWeight: "600", color: "#94a3b8" }}>Lần nộp: {sub.attemptNumber}</div>
                                      </td>
                                      <td style={{ padding: "16px" }}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                          {sub.files && sub.files.length > 0 ? sub.files.map(file => {
                                            const fileInfo = getFileIconAndColor(file.fileName);
                                            return (
                                              <div key={file.fileID} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                {fileInfo.icon}
                                                <span style={{ fontSize: "12px", fontWeight: "700", color: "#334155", cursor: "pointer", textDecoration: "underline" }} onClick={() => window.open(normalizeUrl(`/SubmissionFiles/download/${file.fileID}`), '_blank')}>
                                                  {file.fileName}
                                                </span>
                                              </div>
                                            );
                                          }) : <span style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>Không có tệp</span>}
                                        </div>
                                      </td>
                                      <td style={{ padding: "16px", fontSize: "13px", color: "#64748b", fontWeight: "600" }}>{new Date(sub.submittedAt).toLocaleDateString("vi-VN")}</td>
                                      <td style={{ padding: "16px" }}>
                                        <span style={{ fontSize: "11px", fontWeight: "800", padding: "4px 10px", borderRadius: "20px", background: sub.lecturerState === "APPROVED" ? "#ecfdf5" : sub.lecturerState === "REVISION_REQUIRED" ? "#fff7ed" : "#f1f5f9", color: sub.lecturerState === "APPROVED" ? "#059669" : sub.lecturerState === "REVISION_REQUIRED" ? "#d97706" : "#64748b", border: `1px solid ${sub.lecturerState === "APPROVED" ? "#10b98120" : sub.lecturerState === "REVISION_REQUIRED" ? "#f59e0b20" : "#e2e8f0"}` }}>
                                          {sub.lecturerState === "APPROVED" ? "Đã duyệt" : sub.lecturerState === "REVISION_REQUIRED" ? "Cần sửa" : sub.lecturerState || "Đang chờ"}
                                        </span>
                                      </td>
                                      <td style={{ padding: "16px" }}>
                                        {sub.lecturerComment ? (
                                          <div style={{ fontSize: "13px", color: "#334155", lineHeight: "1.5", fontWeight: "500", background: "#f8fafc", padding: "12px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
                                            {sub.lecturerComment}
                                            <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "4px", fontWeight: "800", textTransform: "uppercase" }}>Mức độ: {sub.feedbackLevel}</div>
                                          </div>
                                        ) : <span style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>Chưa có nhận xét</span>}
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={5} style={{ padding: "60px", textAlign: "center", color: "#94a3b8", fontSize: "14px" }}>
                                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                                        <Archive size={40} strokeWidth={1} color="#e2e8f0" />
                                        Chưa có lịch sử bài nộp nào
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* AI Assitant Thẩm định DNU-GPT */}
                      <div style={{ marginTop: "8px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                          <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#1e293b", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                            <TrendingUp size={18} color="#8B5CF6" />
                            Trợ lý AI Thẩm định
                            <span style={{ fontSize: "10px", background: "#8B5CF6", color: "white", padding: "2px 8px", borderRadius: "99px", marginLeft: "8px", textTransform: "uppercase" }}>DNU-GPT</span>
                          </h3>
                          {!aiAnalysis && !isAnalyzing && (
                            <button onClick={handleAiAnalysis} style={{ padding: "8px 16px", background: "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)", color: "white", border: "none", borderRadius: "12px", fontSize: "13px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 6px -1px rgba(139, 92, 246, 0.3)" }}>
                              Phân tích đề tài ngay
                            </button>
                          )}
                        </div>

                        {isAnalyzing && (
                          <div style={{ padding: "40px", background: "#F5F3FF", borderRadius: "20px", border: "2px dashed #DDD6FE", textAlign: "center" }}>
                            <Loader2 size={32} color="#8B5CF6" className="animate-spin" style={{ margin: "0 auto 16px" }} />
                            <div style={{ fontSize: "15px", fontWeight: "700", color: "#5B21B6", marginBottom: "4px" }}>Đang thẩm định đề tài...</div>
                            <div style={{ fontSize: "13px", color: "#7C3AED" }}>Hệ thống đang phân tích hàm lượng khoa học và tính thực tiễn</div>
                          </div>
                        )}

                        {aiAnalysis && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                            <div style={{ padding: "24px", background: "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)", borderRadius: "24px", border: "1px solid #DDD6FE" }}>
                              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "24px", alignItems: "center" }}>
                                <div style={{ textAlign: "center" }}>
                                  <div style={{ width: "80px", height: "80px", borderRadius: "20px", background: "white", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 15px -3px rgba(139, 92, 246, 0.2)", border: "2px solid #8B5CF6" }}>
                                    <span style={{ fontSize: "28px", fontWeight: "900", color: "#5B21B6" }}>{aiAnalysis.overallScore}</span>
                                    <span style={{ fontSize: "10px", fontWeight: "700", color: "#7C3AED", textTransform: "uppercase" }}>Điểm số</span>
                                  </div>
                                  <div style={{ marginTop: "12px", padding: "4px 12px", background: aiAnalysis.status === "Đạt" ? "#22C55E" : aiAnalysis.status === "Không đạt" ? "#EF4444" : "#F59E0B", color: "white", borderRadius: "8px", fontSize: "12px", fontWeight: "800" }}>{aiAnalysis.status.toUpperCase()}</div>
                                </div>
                                <div>
                                  <h4 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: "800", color: "#5B21B6", display: "flex", alignItems: "center", gap: "8px" }}><Zap size={16} /> Nhận xét cốt lõi</h4>
                                  <p style={{ margin: 0, fontSize: "14px", color: "#4C1D95", lineHeight: "1.6", fontWeight: "500" }}>{aiAnalysis.summary}</p>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                              <div style={{ padding: "20px", background: "#F0FDF4", borderRadius: "20px", border: "1px solid #DCFCE7" }}>
                                <h4 style={{ fontSize: "14px", fontWeight: "800", color: "#166534", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}><CheckCircle size={14} /> Ưu điểm</h4>
                                <ul style={{ margin: 0, paddingLeft: "18px", display: "grid", gap: "8px" }}>
                                  {aiAnalysis.pros.map((p, i) => <li key={i} style={{ fontSize: "13px", color: "#166534", lineHeight: "1.4" }}>{p}</li>)}
                                </ul>
                              </div>
                              <div style={{ padding: "20px", background: "#FEF2F2", borderRadius: "20px", border: "1px solid #FEE2E2" }}>
                                <h4 style={{ fontSize: "14px", fontWeight: "800", color: "#991B1B", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}><AlertCircle size={14} /> Hạn chế</h4>
                                <ul style={{ margin: 0, paddingLeft: "18px", display: "grid", gap: "8px" }}>
                                  {aiAnalysis.cons.map((c, i) => <li key={i} style={{ fontSize: "13px", color: "#991B1B", lineHeight: "1.4" }}>{c}</li>)}
                                </ul>
                              </div>
                            </div>

                            <button onClick={() => setShowDetailedAi(!showDetailedAi)} style={{ width: "100%", padding: "12px", background: "#F8FAFC", border: "1px dashed #CBD5E1", borderRadius: "16px", color: "#64748B", fontSize: "13px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                              {showDetailedAi ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              {showDetailedAi ? "Thu gọn phân tích kỹ thuật" : "Xem phân tích kỹ thuật chi tiết & Lộ trình phát triển"}
                            </button>

                            {showDetailedAi && (
                              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                                <div>
                                  <h4 style={{ fontSize: "14px", fontWeight: "800", color: "#1E293B", marginBottom: "12px" }}>Thẩm định chi tiết theo tiêu chí</h4>
                                  <div style={{ display: "grid", gap: "10px" }}>
                                    {aiAnalysis.criteria.map((c, i) => (
                                      <div key={i} style={{ padding: "16px", background: "white", border: "1px solid #E2E8F0", borderRadius: "16px" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                          <span style={{ fontSize: "13px", fontWeight: "700", color: "#334155" }}>{c.name}</span>
                                          <span style={{ fontSize: "13px", fontWeight: "800", color: "#8B5CF6" }}>{c.score}/10</span>
                                        </div>
                                        <div style={{ height: "6px", background: "#F1F5F9", borderRadius: "3px", marginBottom: "12px" }}>
                                          <div style={{ height: "100%", width: `${c.score * 10}%`, background: "linear-gradient(90deg, #8B5CF6, #A78BFA)", borderRadius: "3px" }}></div>
                                        </div>
                                        <p style={{ margin: 0, fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>{c.comment}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div style={{ padding: "24px", background: "#FFFBEB", borderRadius: "24px", border: "1px solid #FEF3C7" }}>
                                  <h4 style={{ fontSize: "14px", fontWeight: "800", color: "#92400E", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}><Edit size={16} /> Lộ trình hoàn thiện & Công nghệ đề xuất</h4>
                                  <div style={{ display: "grid", gap: "12px" }}>
                                    {aiAnalysis.suggestions.map((s, i) => (
                                      <div key={i} style={{ display: "flex", gap: "12px", fontSize: "13px", color: "#92400E", lineHeight: "1.6", background: "rgba(255,255,255,0.5)", padding: "12px", borderRadius: "12px" }}>
                                        <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#FDE68A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "800", flexShrink: 0 }}>{i + 1}</div>
                                        <span>{s}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}

                            <div style={{ padding: "24px", background: "white", borderRadius: "24px", border: "2px solid #8B5CF6", boxShadow: "0 10px 15px -3px rgba(139, 92, 246, 0.1)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                                <h4 style={{ fontSize: "15px", fontWeight: "800", color: "#5B21B6", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}><MessageCircle size={18} /> Phản hồi gửi Sinh viên</h4>
                                <button onClick={() => { navigator.clipboard.writeText(aiAnalysis.feedbackForStudent); addToast("Đã sao chép phản hồi!", "success"); }} style={{ padding: "8px 16px", background: "#F5F3FF", color: "#8B5CF6", border: "1px solid #DDD6FE", borderRadius: "10px", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>Sao chép nội dung</button>
                              </div>
                              <div style={{ fontSize: "14px", color: "#1e293b", lineHeight: "1.7", background: "#F8FAFC", padding: "20px", borderRadius: "16px", border: "1px solid #f1f5f9", whiteSpace: "pre-wrap", fontStyle: "italic" }}>"{aiAnalysis.feedbackForStudent}"</div>
                              <p style={{ marginTop: "12px", fontSize: "11px", color: "#94a3b8", fontStyle: "italic", textAlign: "right" }}>* Giảng viên có thể sao chép đoạn văn này để gửi cho sinh viên.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* --- RIGHT: SIDEBAR (3 cols) --- */}
                    <div style={{ gridColumn: "span 3", backgroundColor: "#f8fafc", padding: "40px", display: "flex", flexDirection: "column", gap: "24px" }}>

                      {/* Student Card */}
                      <div style={{ background: "white", borderRadius: "24px", padding: "32px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", border: "1px solid #f1f5f9", textAlign: "center" }}>
                        <div style={{ width: "128px", height: "128px", borderRadius: "32px", margin: "0 auto 24px", background: "linear-gradient(135deg, #1e3a5f 0%, #2a5282 100%)", display: "flex", alignItems: "center", justifyContent: "center", border: "4px solid white", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", overflow: "hidden" }}>
                          {topic.studentProfile?.studentImage ? (
                            <img src={getAvatarUrl(topic.studentProfile.studentImage)} alt={topic.studentName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <span style={{ fontSize: "48px", color: "white", fontWeight: "800" }}>{topic.studentName.charAt(0)}</span>
                          )}
                        </div>
                        <h4 style={{ fontSize: "22px", fontWeight: "900", color: "#0f172a", marginBottom: "6px" }}>{topic.studentName}</h4>
                        <div style={{ display: "inline-block", padding: "4px 12px", backgroundColor: "rgba(243, 112, 33, 0.1)", borderRadius: "8px" }}>
                          <span style={{ fontSize: "11px", fontWeight: "900", color: "#1e3a5f", textTransform: "uppercase", letterSpacing: "0.1em" }}>Mã SV: {topic.studentCode}</span>
                        </div>
                      </div>

                      {/* Student Info Cards */}
                      <div style={{ display: "grid", gap: "12px" }}>
                        {[
                          { icon: <Users size={16} />, label: "Lớp", value: topic.studentProfile?.classCode },
                          { icon: <TrendingUp size={16} />, label: "GPA", value: topic.studentProfile?.gpa?.toFixed(2) },
                          { icon: <Calendar size={16} />, label: "Ngày đăng ký", value: new Date(topic.submissionDate).toLocaleDateString("vi-VN") },
                        ].map((item, idx) => (
                          <div key={idx} style={{ padding: "16px", background: "white", borderRadius: "16px", border: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: "8px", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#94a3b8" }}>
                              {item.icon}
                              <span style={{ fontSize: "10px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.label}</span>
                            </div>
                            <span style={{ fontSize: "13px", fontWeight: "700", color: "#334155", wordBreak: "break-all" }}>{item.value || "---"}</span>
                          </div>
                        ))}
                      </div>

                      {/* Supervisor Profile Card */}
                      {topic.lecturerProfile && (
                        <div style={{ background: "white", borderRadius: "16px", padding: "20px", border: "1px solid #f1f5f9", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                          <div style={{ fontSize: "10px", fontWeight: "900", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Giảng viên hướng dẫn</div>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#1e3a5f", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "800" }}>
                              {topic.lecturerProfile.fullName.charAt(0)}
                            </div>
                            <div>
                              <div style={{ fontSize: "14px", fontWeight: "700", color: "#1e293b" }}>{topic.lecturerProfile.fullName}</div>
                              <div style={{ fontSize: "12px", color: "#64748b" }}>{topic.lecturerProfile.degree}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      {topic.status === "Chờ duyệt" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "auto" }}>
                          <button onClick={() => openConfirmationModal(topic)} style={{ padding: "16px", background: "#22c55e", color: "white", border: "none", borderRadius: "16px", fontSize: "15px", fontWeight: "800", cursor: "pointer", boxShadow: "0 10px 15px -3px rgba(34, 197, 94, 0.25)", transition: "all 0.2s ease" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
                            Duyệt đề tài
                          </button>
                          <button onClick={() => openCommentModal("revision", topic.topicID, topic.title)} style={{ padding: "14px", background: "#f0f6ff", color: "#d97706", border: "1px solid #bfdbfe", borderRadius: "16px", fontSize: "14px", fontWeight: "700", cursor: "pointer", transition: "all 0.2s ease" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#ffedd5"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "#f0f6ff"; }}>
                            Yêu cầu sửa đổi
                          </button>
                          <button onClick={() => openCommentModal("reject", topic.topicID, topic.title)} style={{ padding: "14px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "16px", fontSize: "14px", fontWeight: "700", cursor: "pointer", transition: "all 0.2s ease" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#fee2e2"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "#fef2f2"; }}>
                            Từ chối
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
      {/* Manual Assign Modal */}
      {manualAssignModal.isOpen && manualAssignModal.student && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
            backdropFilter: "blur(4px)"
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "24px",
              padding: "32px",
              maxWidth: "540px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "20px", fontWeight: "900", color: "#1e3a5f", margin: 0 }}>
                Chỉ định Đề tài & Hướng dẫn
              </h3>
              <button
                type="button"
                onClick={() => setManualAssignModal({ isOpen: false, student: null })}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={24} />
              </button>
            </div>

            <div style={{ background: "#f8fafc", padding: 16, borderRadius: 16, marginBottom: 20, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 13, color: "#64748b", fontWeight: 700 }}>SINH VIÊN ĐƯỢC CHỈ ĐỊNH:</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
                {manualAssignModal.student.fullName} ({manualAssignModal.student.studentCode})
              </div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 2, fontWeight: 600 }}>
                Khoa: {manualAssignModal.student.departmentCode} • Lớp: {manualAssignModal.student.classCode}
              </div>
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#374151", marginBottom: "6px" }}>
                  Tên đề tài chỉ định <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Nhập tên đề tài luận văn tốt nghiệp..."
                  value={manualTopicTitle}
                  onChange={(e) => setManualTopicTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "10px",
                    fontSize: "14px",
                    outline: "none"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#374151", marginBottom: "6px" }}>
                  Giảng viên hướng dẫn <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  value={manualSupervisorCode}
                  onChange={(e) => setManualSupervisorCode(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "10px",
                    fontSize: "14px",
                    outline: "none",
                    background: "white",
                    fontWeight: "600",
                    color: "#334155"
                  }}
                >
                  <option value="">-- Chọn giảng viên hướng dẫn --</option>
                  {sortedLecturers.map(lec => {
                    const isSameDept = lec.departmentCode === manualAssignModal.student?.departmentCode;
                    return (
                      <option key={lec.lecturerCode} value={lec.lecturerCode}>
                        {lec.fullName} ({lec.lecturerCode}) {isSameDept ? "★ (Cùng khoa)" : ""}
                      </option>
                    );
                  })}
                </select>
                <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "#64748b" }}>
                  ★ Ưu tiên giảng viên cùng khoa với sinh viên được xếp ở đầu danh sách.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "28px" }}>
              <button
                type="button"
                onClick={() => setManualAssignModal({ isOpen: false, student: null })}
                disabled={isManualAssigning}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  background: "white",
                  color: "#475569",
                  fontWeight: "700",
                  cursor: "pointer"
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleManualAssignSubmit}
                disabled={isManualAssigning}
                style={{
                  padding: "10px 24px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#1e3a5f",
                  color: "white",
                  fontWeight: "800",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}
              >
                {isManualAssigning ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {isManualAssigning ? "Đang xử lý..." : "Lưu phân công"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Manual Assign Modal for Overdue Students */}
      {isBulkManualModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
            backdropFilter: "blur(4px)"
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "24px",
              padding: "32px",
              maxWidth: "1100px",
              width: "95%",
              maxHeight: "90vh",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
              fontFamily: "'Be Vietnam Pro', sans-serif"
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexShrink: 0 }}>
              <div>
                <h3 style={{ fontSize: "20px", fontWeight: "900", color: "#1e3a5f", margin: 0 }}>
                  Ghép đề tài thủ công cho sinh viên quá hạn
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#64748b" }}>
                  Có <strong style={{ color: "#f37021" }}>{bulkAssignments.length}</strong> sinh viên quá hạn chưa đăng ký đề tài trong đợt tốt nghiệp này.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkManualModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Filter Input */}
            <div style={{ marginBottom: "16px", flexShrink: 0, position: "relative" }}>
              <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Tìm sinh viên theo mã số hoặc tên..."
                value={bulkSearchTerm}
                onChange={(e) => setBulkSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 38px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "10px",
                  fontSize: "13px",
                  outline: "none"
                }}
              />
            </div>

            {/* Scrollable List */}
            <div style={{ flex: 1, overflowY: "auto", paddingRight: 8, marginBottom: 20 }}>
              {bulkAssignments.filter(item =>
                item.fullName.toLowerCase().includes(bulkSearchTerm.toLowerCase()) ||
                item.studentCode.toLowerCase().includes(bulkSearchTerm.toLowerCase())
              ).length === 0 ? (
                <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontStyle: "italic" }}>
                  Không tìm thấy sinh viên nào phù hợp với bộ lọc.
                </div>
              ) : (
                <table style={{ width: "100%", fontSize: "13px", borderCollapse: "separate", borderSpacing: "0 8px" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", color: "#475569" }}>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: "700" }}>Sinh viên</th>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: "700", width: "160px" }}>Hình thức</th>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: "700" }}>Chi tiết Đề tài</th>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: "700", width: "240px" }}>Giảng viên hướng dẫn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkAssignments
                      .filter(item =>
                        item.fullName.toLowerCase().includes(bulkSearchTerm.toLowerCase()) ||
                        item.studentCode.toLowerCase().includes(bulkSearchTerm.toLowerCase())
                      )
                      .map((item) => {
                        const unusedCatalogTopics = catalogTopics.filter(cat =>
                          !allTopicsList.some(t => t.catalogTopicCode === cat.catalogTopicCode && t.status.toLowerCase() !== "rejected")
                        );
                        const sortedCatalogList = [...unusedCatalogTopics].sort((a, b) => {
                          const aSame = a.departmentCode === item.departmentCode ? 1 : 0;
                          const bSame = b.departmentCode === item.departmentCode ? 1 : 0;
                          return bSame - aSame;
                        });

                        const sortedLecturersList = [...allLecturers].sort((a, b) => {
                          const aSame = a.departmentCode === item.departmentCode ? 1 : 0;
                          const bSame = b.departmentCode === item.departmentCode ? 1 : 0;
                          return bSame - aSame;
                        });

                        return (
                          <tr key={item.studentCode} style={{ background: "#fcfdfe", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "12px", borderRadius: "8px 0 0 8px" }}>
                              <div style={{ fontWeight: "700", color: "#1e293b" }}>{item.fullName}</div>
                              <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                                {item.studentCode} • Lớp {item.classCode}
                              </div>
                              <div style={{ fontSize: "10px", color: "#f37021", fontWeight: "700", marginTop: "2px" }}>
                                Khoa: {item.departmentCode}
                              </div>
                            </td>
                            <td style={{ padding: "12px" }}>
                              <select
                                value={item.sourceType}
                                onChange={(e) => updateBulkAssignmentRow(item.studentCode, "sourceType", e.target.value)}
                                style={{
                                  width: "100%",
                                  padding: "8px",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: "8px",
                                  fontSize: "12px",
                                  outline: "none",
                                  background: "white",
                                  fontWeight: "600",
                                  color: "#374151"
                                }}
                              >
                                <option value="SELF">Đề tài Tự chọn</option>
                                <option value="CATALOG">Chọn từ Catalog</option>
                              </select>
                            </td>
                            <td style={{ padding: "12px" }}>
                              {item.sourceType === "CATALOG" ? (
                                <select
                                  value={item.catalogTopicCode}
                                  onChange={(e) => updateBulkAssignmentRow(item.studentCode, "catalogTopicCode", e.target.value)}
                                  style={{
                                    width: "100%",
                                    padding: "8px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "8px",
                                    fontSize: "12px",
                                    outline: "none",
                                    background: "white",
                                    color: "#374151"
                                  }}
                                >
                                  <option value="">-- Chọn đề tài mẫu Catalog --</option>
                                  {sortedCatalogList.map(cat => (
                                    <option key={cat.catalogTopicCode} value={cat.catalogTopicCode}>
                                      {cat.departmentCode === item.departmentCode ? "⭐ " : ""}[{cat.departmentCode || "Khoa"}] {cat.title}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  placeholder="Nhập tên đề tài tự chọn..."
                                  value={item.topicTitle}
                                  onChange={(e) => updateBulkAssignmentRow(item.studentCode, "topicTitle", e.target.value)}
                                  style={{
                                    width: "100%",
                                    padding: "8px 12px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "8px",
                                    fontSize: "12px",
                                    outline: "none",
                                    color: "#374151"
                                  }}
                                />
                              )}
                            </td>
                            <td style={{ padding: "12px", borderRadius: "0 8px 8px 0" }}>
                              <select
                                value={item.supervisorLecturerCode}
                                onChange={(e) => updateBulkAssignmentRow(item.studentCode, "supervisorLecturerCode", e.target.value)}
                                style={{
                                  width: "100%",
                                  padding: "8px",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: "8px",
                                  fontSize: "12px",
                                  outline: "none",
                                  background: "white",
                                  color: "#374151"
                                }}
                              >
                                <option value="">-- Chọn giảng viên hướng dẫn --</option>
                                {sortedLecturersList.map(lec => {
                                  const activeCount = allTopicsList.filter(t => t.supervisorLecturerCode === lec.lecturerCode && t.status.toLowerCase() !== "rejected").length;
                                  const quota = lec.guideQuota || 5;
                                  const isSameDept = lec.departmentCode === item.departmentCode;

                                  return (
                                    <option key={lec.lecturerCode} value={lec.lecturerCode} disabled={activeCount >= quota}>
                                      {isSameDept ? "⭐ " : ""}{lec.fullName} ({lec.departmentCode}) - Tải: {activeCount}/{quota} {activeCount >= quota ? "[ĐẦY]" : ""}
                                    </option>
                                  );
                                })}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer Buttons */}
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setIsBulkManualModalOpen(false)}
                disabled={isBulkAssigning}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  background: "white",
                  color: "#475569",
                  fontWeight: "700",
                  cursor: "pointer"
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleBulkManualSubmit}
                disabled={isBulkAssigning || bulkAssignments.length === 0}
                style={{
                  padding: "10px 24px",
                  borderRadius: "10px",
                  border: "none",
                  background: "linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)",
                  color: "white",
                  fontWeight: "800",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}
              >
                {isBulkAssigning ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {isBulkAssigning ? "Đang lưu phân công..." : `Xác nhận ghép thủ công ${bulkAssignments.length} SV`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto Assign Preview Modal */}
      {isAutoAssignPreviewOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
            backdropFilter: "blur(4px)"
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "24px",
              padding: "32px",
              maxWidth: "1300px",
              width: "95%",
              maxHeight: "90vh",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexShrink: 0 }}>
              <div>
                <h3 style={{ fontSize: "20px", fontWeight: "900", color: "#1e3a5f", margin: 0 }}>
                  Xem trước Phân công Tự động
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#64748b" }}>
                  Hệ thống ghép nối thông minh tự động {autoAssignPreview.length} sinh viên quá hạn chưa có đề tài.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAutoAssignPreviewOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Premium Stat Cards */}
            {autoAssignPreview.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "20px", flexShrink: 0 }}>
                <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "rgba(30, 58, 95, 0.08)", color: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Users size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", fontWeight: "900", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Tổng sinh viên quá hạn</div>
                    <div style={{ fontSize: "18px", fontWeight: "800", color: "#1e3a5f", marginTop: "2px" }}>{autoAssignPreview.length}</div>
                  </div>
                </div>

                <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "rgba(22, 101, 52, 0.08)", color: "#166534", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <TagIcon size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", fontWeight: "900", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Ghép khớp Tag</div>
                    <div style={{ fontSize: "18px", fontWeight: "800", color: "#166534", marginTop: "2px" }}>{autoAssignPreview.filter(item => !item.isFallback).length}</div>
                  </div>
                </div>

                <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "rgba(153, 27, 27, 0.08)", color: "#991b1b", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", fontWeight: "900", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Gán mặc định</div>
                    <div style={{ fontSize: "18px", fontWeight: "800", color: "#991b1b", marginTop: "2px" }}>{autoAssignPreview.filter(item => item.isFallback).length}</div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ flex: 1, overflowY: "auto", paddingRight: 8, marginBottom: 12 }}>
              {autoAssignPreview.length === 0 ? (
                <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontStyle: "italic" }}>
                  Không có sinh viên nào cần phân công hoặc không tìm thấy ứng viên ghép nối phù hợp.
                </div>
              ) : (
                <>
                  <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", color: "#475569", borderBottom: "2px solid #e2e8f0" }}>
                        <th style={{ padding: "12px", textAlign: "left" }}>Sinh viên quá hạn</th>
                        <th style={{ padding: "12px", textAlign: "left" }}>Đề tài ghép nối tự động</th>
                        <th style={{ padding: "12px", textAlign: "left" }}>Giảng viên hướng dẫn ghép</th>
                        <th style={{ padding: "12px", textAlign: "center", whiteSpace: "nowrap" }}>Mức độ khớp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {autoAssignPreview
                        .slice((autoAssignCurrentPage - 1) * 10, autoAssignCurrentPage * 10)
                        .map((item, index) => (
                          <tr key={index} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ padding: "12px" }}>
                              <div style={{ fontWeight: "700", color: "#0f172a" }}>{item.studentName}</div>
                              <div style={{ fontSize: "11px", color: "#64748b" }}>{item.studentCode} ({item.studentDepartment})</div>
                            </td>
                            <td style={{ padding: "12px" }}>
                              <div style={{ fontWeight: "600", color: "#1e3a5f" }}>{item.topicTitle}</div>
                              {item.catalogTopicCode && (
                                <span style={{ fontSize: "10px", background: "#e0f2fe", color: "#0369a1", padding: "2px 6px", borderRadius: 4, display: "inline-block", marginTop: 4, fontWeight: "700" }}>
                                  Catalog: {item.catalogTopicCode}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "12px" }}>
                              <div style={{ fontWeight: "600", color: "#334155" }}>{item.supervisorLecturerName}</div>
                              <div style={{ fontSize: "11px", color: "#64748b" }}>{item.supervisorLecturerCode}</div>
                            </td>
                            <td style={{ padding: "12px", textAlign: "center", whiteSpace: "nowrap" }}>
                              {item.isFallback ? (
                                <span style={{ background: "#fee2e2", color: "#991b1b", padding: "4px 8px", borderRadius: 99, fontSize: 11, fontWeight: "700", display: "inline-block", whiteSpace: "nowrap" }}>Gán Mặc Định</span>
                              ) : (
                                <span style={{ background: "#dcfce7", color: "#166534", padding: "4px 8px", borderRadius: 99, fontSize: 11, fontWeight: "700", display: "inline-block", whiteSpace: "nowrap" }}>
                                  Khớp {item.matchTagsCount} Tag
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>

            {/* Pagination controls using internal renderPagination helper */}
            {autoAssignPreview.length > 0 && (
              <div style={{ flexShrink: 0, marginBottom: "16px" }}>
                {renderPagination(autoAssignCurrentPage, Math.ceil(autoAssignPreview.length / 10), setAutoAssignCurrentPage)}
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setIsAutoAssignPreviewOpen(false)}
                disabled={isAutoAssigning}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  background: "white",
                  color: "#475569",
                  fontWeight: "700",
                  cursor: "pointer"
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleAutoAssignConfirm}
                disabled={isAutoAssigning || autoAssignPreview.length === 0}
                style={{
                  padding: "10px 24px",
                  borderRadius: "10px",
                  border: "none",
                  background: "linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)",
                  color: "white",
                  fontWeight: "800",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}
              >
                {isAutoAssigning ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {isAutoAssigning ? "Đang tiến hành phân công..." : `Xác nhận & Lưu ${autoAssignPreview.length} Phân công`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Topic Modal */}
      {isCreateTopicModalOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "16px",
          backdropFilter: "blur(4px)"
        }}>
          <div style={{
            background: "#FFFFFF",
            borderRadius: "24px",
            padding: "32px",
            maxWidth: "600px",
            width: "100%",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "20px", fontWeight: "900", color: "#1e3a5f", margin: 0 }}>
                Thêm Mới Đề Tài Nghiên Cứu
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateTopicModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateTopicSubmit} style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#374151", marginBottom: "6px" }}>
                  Tên đề tài <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Nhập tên đề tài..."
                  value={topicFormTitle}
                  onChange={(e) => setTopicFormTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "10px",
                    fontSize: "14px",
                    outline: "none"
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#374151", marginBottom: "6px" }}>
                  Tóm tắt đề tài
                </label>
                <textarea
                  placeholder="Nhập tóm tắt đề tài..."
                  value={topicFormSummary}
                  onChange={(e) => setTopicFormSummary(e.target.value)}
                  style={{
                    width: "100%",
                    height: "100px",
                    padding: "12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "10px",
                    fontSize: "14px",
                    outline: "none",
                    resize: "vertical"
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#374151", marginBottom: "6px" }}>
                    Loại đề tài
                  </label>
                  <select
                    value={topicFormType}
                    onChange={(e) => setTopicFormType(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "10px",
                      fontSize: "14px",
                      outline: "none",
                      background: "white"
                    }}
                  >
                    <option value="CATALOG">Đề tài Catalog</option>
                    <option value="SELF">Đề tài Tự chọn</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#374151", marginBottom: "6px" }}>
                    Khoa quản lý
                  </label>
                  <select
                    value={topicFormDepartmentCode}
                    onChange={(e) => setTopicFormDepartmentCode(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "10px",
                      fontSize: "14px",
                      outline: "none",
                      background: "white"
                    }}
                  >
                    <option value="">-- Chọn khoa --</option>
                    {Array.from(new Set(allLecturers.map(l => l.departmentCode).filter(Boolean))).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#374151", marginBottom: "6px" }}>
                    Sinh viên đề xuất (Mã số)
                  </label>
                  <input
                    type="text"
                    placeholder="Mã sinh viên đề xuất..."
                    value={topicFormProposerCode}
                    onChange={(e) => setTopicFormProposerCode(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "10px",
                      fontSize: "14px",
                      outline: "none"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#374151", marginBottom: "6px" }}>
                    Giảng viên hướng dẫn
                  </label>
                  <select
                    value={topicFormSupervisorCode}
                    onChange={(e) => setTopicFormSupervisorCode(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "10px",
                      fontSize: "14px",
                      outline: "none",
                      background: "white"
                    }}
                  >
                    <option value="">-- Chọn giảng viên --</option>
                    {allLecturers.map(l => (
                      <option key={l.lecturerCode} value={l.lecturerCode}>{l.fullName} ({l.lecturerCode})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setIsCreateTopicModalOpen(false)}
                  disabled={isTopicSaving}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    background: "white",
                    color: "#475569",
                    fontWeight: "700",
                    cursor: "pointer"
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isTopicSaving}
                  style={{
                    padding: "10px 24px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#1e3a5f",
                    color: "white",
                    fontWeight: "800",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                  }}
                >
                  {isTopicSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {isTopicSaving ? "Đang tạo..." : "Tạo đề tài"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Topic Modal */}
      {isEditTopicModalOpen && selectedTopicToEdit && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "16px",
          backdropFilter: "blur(4px)"
        }}>
          <div style={{
            background: "#FFFFFF",
            borderRadius: "24px",
            padding: "32px",
            maxWidth: "600px",
            width: "100%",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "20px", fontWeight: "900", color: "#1e3a5f", margin: 0 }}>
                Chỉnh Sửa Đề Tài Nghiên Cứu
              </h3>
              <button
                type="button"
                onClick={() => setIsEditTopicModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleUpdateTopicSubmit} style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#374151", marginBottom: "6px" }}>
                  Tên đề tài <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Nhập tên đề tài..."
                  value={topicFormTitle}
                  onChange={(e) => setTopicFormTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "10px",
                    fontSize: "14px",
                    outline: "none"
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#374151", marginBottom: "6px" }}>
                  Tóm tắt đề tài
                </label>
                <textarea
                  placeholder="Nhập tóm tắt đề tài..."
                  value={topicFormSummary}
                  onChange={(e) => setTopicFormSummary(e.target.value)}
                  style={{
                    width: "100%",
                    height: "100px",
                    padding: "12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "10px",
                    fontSize: "14px",
                    outline: "none",
                    resize: "vertical"
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#374151", marginBottom: "6px" }}>
                    Loại đề tài
                  </label>
                  <select
                    value={topicFormType}
                    onChange={(e) => setTopicFormType(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "10px",
                      fontSize: "14px",
                      outline: "none",
                      background: "white"
                    }}
                  >
                    <option value="CATALOG">Đề tài Catalog</option>
                    <option value="SELF">Đề tài Tự chọn</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#374151", marginBottom: "6px" }}>
                    Khoa quản lý
                  </label>
                  <select
                    value={topicFormDepartmentCode}
                    onChange={(e) => setTopicFormDepartmentCode(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "10px",
                      fontSize: "14px",
                      outline: "none",
                      background: "white"
                    }}
                  >
                    <option value="">-- Chọn khoa --</option>
                    {Array.from(new Set(allLecturers.map(l => l.departmentCode).filter(Boolean))).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#374151", marginBottom: "6px" }}>
                    Sinh viên đề xuất (Mã số)
                  </label>
                  <input
                    type="text"
                    placeholder="Mã sinh viên đề xuất..."
                    value={topicFormProposerCode}
                    onChange={(e) => setTopicFormProposerCode(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "10px",
                      fontSize: "14px",
                      outline: "none"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#374151", marginBottom: "6px" }}>
                    Giảng viên hướng dẫn
                  </label>
                  <select
                    value={topicFormSupervisorCode}
                    onChange={(e) => setTopicFormSupervisorCode(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "10px",
                      fontSize: "14px",
                      outline: "none",
                      background: "white"
                    }}
                  >
                    <option value="">-- Chọn giảng viên --</option>
                    {allLecturers.map(l => (
                      <option key={l.lecturerCode} value={l.lecturerCode}>{l.fullName} ({l.lecturerCode})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#374151", marginBottom: "6px" }}>
                  Trạng thái đề tài
                </label>
                <select
                  value={topicFormStatus}
                  onChange={(e) => setTopicFormStatus(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "10px",
                    fontSize: "14px",
                    outline: "none",
                    background: "white",
                    fontWeight: "600"
                  }}
                >
                  <option value="Đang chờ">Đang chờ duyệt (Pending)</option>
                  <option value="Đã duyệt">Đã duyệt (Approved)</option>
                  <option value="Từ chối">Từ chối (Rejected)</option>
                  <option value="Cần sửa đổi">Cần sửa đổi (Revision)</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setIsEditTopicModalOpen(false)}
                  disabled={isTopicSaving}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    background: "white",
                    color: "#475569",
                    fontWeight: "700",
                    cursor: "pointer"
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isTopicSaving}
                  style={{
                    padding: "10px 24px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#1e3a5f",
                    color: "white",
                    fontWeight: "800",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                  }}
                >
                  {isTopicSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {isTopicSaving ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Quota Modal */}
      {editQuotaModal.isOpen && editQuotaModal.lecturer && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1100,
          padding: "16px",
          animation: "modalFadeIn 0.3s ease-out"
        }}>
          <div style={{
            background: "#FFFFFF",
            borderRadius: "24px",
            padding: "32px",
            maxWidth: "520px",
            width: "100%",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.3)",
            animation: "slideInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            border: "1px solid rgba(255, 255, 255, 0.2)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ background: "rgba(139, 92, 246, 0.1)", padding: "10px", borderRadius: "12px" }}>
                  <Award size={22} color="#8b5cf6" />
                </div>
                <h3 style={{ fontSize: "20px", fontWeight: "900", color: "#1e3a5f", margin: 0 }}>
                  Điều Phối & Định Mức Tải
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditQuotaModal(prev => ({ ...prev, isOpen: false }))}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", transition: "color 0.2s" }}
                onMouseEnter={(e) => e.currentTarget.style.color = "#1e293b"}
                onMouseLeave={(e) => e.currentTarget.style.color = "#64748b"}
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleEditQuotaSubmit} style={{ display: "grid", gap: 20 }}>
              {/* Lecturer Info Card */}
              <div style={{
                background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                borderRadius: "16px",
                padding: "16px 20px",
                border: "1px solid #e2e8f0",
                display: "grid",
                gap: 8
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "16px", fontWeight: "800", color: "#1e293b" }}>
                    {editQuotaModal.lecturer.fullName}
                  </span>
                  <span style={{ fontSize: "11px", fontWeight: "800", color: "#8b5cf6", background: "#f3e8ff", padding: "2px 8px", borderRadius: "99px" }}>
                    {editQuotaModal.lecturer.lecturerCode}
                  </span>
                </div>
                <div style={{ height: "1px", background: "#e2e8f0", margin: "4px 0" }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontSize: "13px", color: "#475569" }}>
                  <div>
                    <span style={{ fontWeight: "600" }}>Khoa:</span> {editQuotaModal.lecturer.departmentCode || "-"}
                  </div>
                  <div>
                    <span style={{ fontWeight: "600" }}>Học vị:</span> {editQuotaModal.lecturer.degree || "-"}
                  </div>
                  <div style={{ gridColumn: "1 / span 2" }}>
                    <span style={{ fontWeight: "600" }}>Đang hướng dẫn:</span> <span style={{ fontWeight: "800", color: "#1e3a5f" }}>{allTopicsList.filter(t => t.supervisorLecturerCode === editQuotaModal.lecturer?.lecturerCode && t.status.toLowerCase() !== "rejected").length} đề tài</span>
                  </div>
                </div>
              </div>

              {/* Guide Quota Input */}
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: "14px", fontWeight: "800", color: "#374151" }}>
                    Định mức Hướng dẫn tối đa <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>
                    Chỉ tiêu nhận SV hướng dẫn
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => setEditQuotaModal(prev => ({ ...prev, quotaValue: Math.max(1, prev.quotaValue - 1) }))}
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      background: "white",
                      fontSize: "18px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#475569",
                      transition: "all 0.15s"
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.borderColor = "#94a3b8"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={editQuotaModal.quotaValue}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) {
                        setEditQuotaModal(prev => ({ ...prev, quotaValue: Math.max(1, val) }));
                      }
                    }}
                    style={{
                      flex: 1,
                      height: "44px",
                      padding: "0 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "10px",
                      fontSize: "16px",
                      fontWeight: "800",
                      textAlign: "center",
                      color: "#1e3a5f",
                      outline: "none"
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setEditQuotaModal(prev => ({ ...prev, quotaValue: Math.min(50, prev.quotaValue + 1) }))}
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      background: "white",
                      fontSize: "18px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#475569",
                      transition: "all 0.15s"
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.borderColor = "#94a3b8"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Defense Quota Input */}
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: "14px", fontWeight: "800", color: "#374151" }}>
                    Định mức Phản biện tối đa <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>
                    Chỉ tiêu chấm hội đồng phản biện
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => setEditQuotaModal(prev => ({ ...prev, defenseQuotaValue: Math.max(1, prev.defenseQuotaValue - 1) }))}
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      background: "white",
                      fontSize: "18px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#475569",
                      transition: "all 0.15s"
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.borderColor = "#94a3b8"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={editQuotaModal.defenseQuotaValue}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) {
                        setEditQuotaModal(prev => ({ ...prev, defenseQuotaValue: Math.max(1, val) }));
                      }
                    }}
                    style={{
                      flex: 1,
                      height: "44px",
                      padding: "0 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "10px",
                      fontSize: "16px",
                      fontWeight: "800",
                      textAlign: "center",
                      color: "#1e3a5f",
                      outline: "none"
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setEditQuotaModal(prev => ({ ...prev, defenseQuotaValue: Math.min(50, prev.defenseQuotaValue + 1) }))}
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      background: "white",
                      fontSize: "18px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#475569",
                      transition: "all 0.15s"
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.borderColor = "#94a3b8"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Modal Buttons */}
              <div style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
                marginTop: "12px",
                borderTop: "1px solid #f1f5f9",
                paddingTop: "20px"
              }}>
                <button
                  type="button"
                  onClick={() => setEditQuotaModal(prev => ({ ...prev, isOpen: false }))}
                  style={{
                    padding: "10px 24px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    background: "white",
                    color: "#475569",
                    fontWeight: "700",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.color = "#1e293b"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = "#475569"; }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isQuotaSaving}
                  style={{
                    padding: "10px 24px",
                    borderRadius: "10px",
                    border: "none",
                    background: "linear-gradient(135deg, #1e3a5f 0%, #1e293b 100%)",
                    color: "white",
                    fontWeight: "800",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: "0 4px 12px rgba(30, 58, 95, 0.25)",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 16px rgba(30, 58, 95, 0.35)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(30, 58, 95, 0.25)"; }}
                >
                  {isQuotaSaving ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={16} />}
                  {isQuotaSaving ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerTopicReview;
