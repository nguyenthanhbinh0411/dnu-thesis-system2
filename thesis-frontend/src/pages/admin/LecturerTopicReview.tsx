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
} from "lucide-react";
import { fetchData, getAvatarUrl } from "../../api/fetchData";
import { useToast } from "../../context/useToast";
import type { Topic } from "../../types/topic";
import type { StudentProfile } from "../../types/studentProfile";
import type { LecturerProfile } from "../../types/lecturer-profile";
import type { Tag, CatalogTopicTag, TopicTag } from "../../types/tag";
import type { ApiResponse } from "../../types/api";
import { useAuth } from "../../hooks/useAuth";
import { useActiveDefensePeriodId } from "../../utils/defensePeriod";
import {
  decideTopicWorkflow,
  getTopicWorkflowDetail,
  getTopicWorkflowTimeline,
} from "../../services/topic-workflow.service";

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

interface LecturerTopicReviewProps {
  currentLecturerOnly?: boolean;
}

const LecturerTopicReview: React.FC<LecturerTopicReviewProps> = ({
  currentLecturerOnly = false,
}) => {
  const activePeriodId = useActiveDefensePeriodId();
  const [periods, setPeriods] = useState<DefensePeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);

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
  const [activeAdminTab, setActiveAdminTab] = useState<"overview" | "topics-management" | "review" | "lecturer-quota" | "export">("overview");

  // Topics Management Tab States
  const [topicsSearchTerm, setTopicsSearchTerm] = useState("");
  const [topicsTypeFilter, setTopicsTypeFilter] = useState<"all" | "CATALOG" | "SELF">("all");
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
  const [allStudents, setAllStudents] = useState<StudentProfile[]>([]);
  const [allLecturers, setAllLecturers] = useState<LecturerProfile[]>([]);
  const [allTopicsList, setAllTopicsList] = useState<Topic[]>([]);
  const [isStudentsLoading, setIsStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);

  // Auto assign preview states
  const [autoAssignPreview, setAutoAssignPreview] = useState<AutoAssignPreviewDto[]>([]);
  const [isAutoAssignPreviewOpen, setIsAutoAssignPreviewOpen] = useState(false);
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

  // Filter and search states for registration tab
  const [regSearchTerm, setRegSearchTerm] = useState("");
  const [regStatusFilter, setRegStatusFilter] = useState<"all" | "has_topic" | "no_topic">("all");
  const [regCurrentPage, setRegCurrentPage] = useState(1);
  const [topicsCurrentPage, setTopicsCurrentPage] = useState(1);
  const [lecturerLoadCurrentPage, setLecturerLoadCurrentPage] = useState(1);

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
        "/LecturerProfiles/get-list?Page=1&PageSize=500"
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
    if (selectedExportFields.includes("departmentCode")) headers.push("Bộ Môn");
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
    let url = `/Topics/get-list?Page=${page}&PageSize=${size}&SortBy=createdAt&SortOrder=desc`;

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

  const openDetailModal = async (topic: TopicDisplay) => {
    // Fetch topic tags using workflow detail
    try {
      let tags: Tag[] = [];
      
      const detail = await getTopicWorkflowDetail(topic.topicID);
      const tagCodes = detail.tagCodes || [];

      if (tagCodes.length > 0) {
        // Fetch tag details for each tag code
        const tagPromises = tagCodes.map(async (code) => {
          try {
            const tagRes = await fetchData<ApiResponse<Tag[]>>(`/Tags/list?TagCode=${code}`);
            return tagRes.data?.[0] || null;
          } catch {
            return null;
          }
        });

        const tagResults = await Promise.all(tagPromises);
        tags = tagResults.filter((tag): tag is Tag => tag !== null);
      }

      setTopicTags(tags);
    } catch (error) {
      console.error("Error fetching topic tags:", error);
      setTopicTags([]);
    }

    setDetailModal({
      isOpen: true,
      topic,
    });
  };

  const closeDetailModal = () => {
    setDetailModal({
      isOpen: false,
      topic: null,
    });
    setTopicTags([]);
    setAiAnalysis(null);
    setIsAnalyzing(false);
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
              Điều hành đăng ký & <span style={{ color: "#f37021" }}>Phân công GVHD</span>
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
            <Loader2 size={48} color="#f37021" style={{ animation: "spin 1s linear infinite", margin: "0 auto 20px auto" }} />
            <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", marginBottom: "8px" }}>
              Đang kết nối đợt bảo vệ tốt nghiệp...
            </h3>
            <p style={{ fontSize: "14px", color: "#64748b" }}>
              Hệ thống tự động xác định đợt bảo vệ hiện hành để tải dữ liệu điều hành.
            </p>
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
                { key: "overview" as const, label: "Tình hình đăng ký", icon: <Users size={18} />, badge: overdueCount > 0 ? `${overdueCount} quá hạn` : null, badgeColor: "#ef4444" },
                { key: "topics-management" as const, label: "Quản lý đề tài", icon: <BookOpen size={18} />, badge: allTopicsList.length ? String(allTopicsList.length) : null, badgeColor: "#1e3a5f" },
                { key: "review" as const, label: "Phê duyệt đề tài tự chọn", icon: <CheckCircle size={18} />, badge: stats.pending > 0 ? `${stats.pending} chờ` : null, badgeColor: "#f59e0b" },
                { key: "lecturer-quota" as const, label: "Định mức hướng dẫn", icon: <Award size={18} />, badge: allLecturers.length ? String(allLecturers.length) : null, badgeColor: "#8b5cf6" },
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
              {activeAdminTab === "overview" && (
                <>
                  {/* Stats Widgets */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "24px",
                    marginBottom: "32px",
                  }}>
                    <div className="premium-card">
                      <div>
                        <div className="stat-icon-wrapper" style={{ background: "rgba(30, 58, 95, 0.1)" }}>
                          <Users size={24} color="#1e3a5f" />
                        </div>
                        <div style={{ fontSize: "14px", color: "#64748b", fontWeight: "600", marginBottom: "4px" }}>
                          Tổng số sinh viên
                        </div>
                        <div style={{ fontSize: "32px", fontWeight: "800", color: "#1e293b" }}>
                          {allStudents.length}
                        </div>
                      </div>
                      <div style={{ height: "4px", background: "#1e3a5f", borderRadius: "2px", width: "45%", marginTop: "12px" }} />
                    </div>

                    <div className="premium-card">
                      <div>
                        <div className="stat-icon-wrapper" style={{ background: "rgba(34, 197, 94, 0.1)" }}>
                          <CheckCircle size={24} color="#22C55E" />
                        </div>
                        <div style={{ fontSize: "14px", color: "#64748b", fontWeight: "600", marginBottom: "4px" }}>
                          Đã đăng ký đề tài
                        </div>
                        <div style={{ fontSize: "32px", fontWeight: "800", color: "#1e293b" }}>
                          {registeredCount}
                        </div>
                      </div>
                      <div style={{ height: "4px", background: "#22C55E", borderRadius: "2px", width: "45%", marginTop: "12px" }} />
                    </div>

                    <div className="premium-card">
                      <div>
                        <div className="stat-icon-wrapper" style={{ background: "rgba(239, 68, 68, 0.1)" }}>
                          <AlertCircle size={24} color="#EF4444" />
                        </div>
                        <div style={{ fontSize: "14px", color: "#64748b", fontWeight: "600", marginBottom: "4px" }}>
                          Chưa đăng ký (Quá hạn)
                        </div>
                        <div style={{ fontSize: "32px", fontWeight: "800", color: "#1e293b" }}>
                          {overdueCount}
                        </div>
                      </div>
                      <div style={{ height: "4px", background: "#EF4444", borderRadius: "2px", width: "45%", marginTop: "12px" }} />
                    </div>

                    <div className="premium-card">
                      <div>
                        <div className="stat-icon-wrapper" style={{ background: "rgba(245, 158, 11, 0.1)" }}>
                          <TrendingUp size={24} color="#F59E0B" />
                        </div>
                        <div style={{ fontSize: "14px", color: "#64748b", fontWeight: "600", marginBottom: "4px" }}>
                          Tỷ lệ hoàn thành
                        </div>
                        <div style={{ fontSize: "32px", fontWeight: "800", color: "#1e293b" }}>
                          {completionPercent}%
                        </div>
                      </div>
                      <div style={{ height: "4px", background: "#F59E0B", borderRadius: "2px", width: "45%", marginTop: "12px" }} />
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
                        </select>
                      </div>

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
                                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Bộ môn</th>
                                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Lớp</th>
                                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Trạng thái</th>
                                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Đề tài luận văn</th>
                                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: "700" }}>Hành động</th>
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
                                      <td style={{ padding: "16px" }}>
                                        <span style={{
                                          display: "inline-block",
                                          padding: "6px 12px",
                                          borderRadius: "99px",
                                          fontSize: "12px",
                                          fontWeight: "800",
                                          background: topic ? "#dcfce7" : "#fee2e2",
                                          color: topic ? "#166534" : "#991b1b"
                                        }}>
                                          {topic ? "Đã có đề tài" : "Chưa đăng ký"}
                                        </span>
                                      </td>
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
                                      <td style={{ padding: "16px", borderRadius: "0 12px 12px 0", textAlign: "right" }}>
                                        {topic ? (
                                          <button
                                            type="button"
                                            onClick={() => {
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
                                              openDetailModal(displayMap);
                                            }}
                                            style={{
                                              padding: "8px 16px",
                                              background: "#f1f5f9",
                                              border: "1px solid #e2e8f0",
                                              borderRadius: "8px",
                                              fontSize: "13px",
                                              fontWeight: "700",
                                              color: "#475569",
                                              cursor: "pointer"
                                            }}
                                          >
                                            Xem chi tiết
                                          </button>
                                        ) : (
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
                                        )}
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
              )}

              {/* TAB 2: TOPICS MANAGEMENT (Embedded Module) */}
              {activeAdminTab === "topics-management" && (() => {
                const filteredTopics = allTopicsList.filter(topic => {
                  const s = topicsSearchTerm.trim().toLowerCase();
                  const matchesSearch = !s || (topic.topicCode || "").toLowerCase().includes(s) || (topic.title || "").toLowerCase().includes(s);
                  const matchesType = topicsTypeFilter === "all" || topic.type === topicsTypeFilter;
                  const matchesStatus = topicsStatusFilter === "all" || topic.status === topicsStatusFilter;
                  return matchesSearch && matchesType && matchesStatus;
                });
                const paginatedTopics = filteredTopics.slice((topicsCurrentPage - 1) * 10, topicsCurrentPage * 10);
                return (
                  <div style={{
                    background: "white",
                    borderRadius: "24px",
                    border: "1px solid #D9E1F2",
                    padding: "24px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  }}>
                    {/* Toolbar */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", flex: 1 }}>
                        <div style={{ position: "relative", minWidth: 300 }}>
                          <Search size={18} color="#9CA3AF" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                          <input
                            type="text"
                            placeholder="Tìm mã đề tài, tên đề tài..."
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
                          onChange={(e) => setTopicsTypeFilter(e.target.value as any)}
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
                          <option value="all">Tất cả loại đề tài</option>
                          <option value="CATALOG">Đề tài Catalog</option>
                          <option value="SELF">Đề tài Tự chọn</option>
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
                          <option value="all">Tất cả trạng thái</option>
                          <option value="Đang chờ">Đang chờ duyệt</option>
                          <option value="Đã duyệt">Đã duyệt</option>
                          <option value="Từ chối">Từ chối</option>
                          <option value="Cần sửa đổi">Cần sửa đổi</option>
                        </select>
                      </div>

                      <div style={{ display: "flex", gap: 12 }}>
                        <button
                          type="button"
                          onClick={openCreateTopicModal}
                          style={{
                            padding: "10px 20px",
                            background: "#1e3a5f",
                            color: "white",
                            border: "none",
                            borderRadius: "12px",
                            fontWeight: "800",
                            fontSize: "14px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6
                          }}
                        >
                          <Plus size={16} /> Thêm mới đề tài
                        </button>
                      </div>
                    </div>

                    {/* Topics List Table */}
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", fontSize: "14px", borderCollapse: "separate", borderSpacing: "0 8px" }}>
                        <thead>
                          <tr style={{ background: "#f8fafc", color: "#475569" }}>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Mã đề tài</th>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Thông tin đề tài</th>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Khoa/Bộ môn</th>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Người đề xuất</th>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>GV hướng dẫn</th>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Trạng thái</th>
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
                            paginatedTopics.map((topic) => (
                              <tr key={topic.topicID} style={{ background: "#fcfdfe", borderRadius: "16px", border: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "16px", fontWeight: "700", color: "#1e3a5f", borderRadius: "12px 0 0 12px" }}>
                                  {topic.topicCode}
                                </td>
                                <td style={{ padding: "16px", maxWidth: 300 }}>
                                  <div style={{ fontWeight: "700", color: "#1e293b", lineHeight: "1.4" }}>{topic.title}</div>
                                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>Loại: {topic.type === "CATALOG" ? "Catalog" : "Tự chọn"}</div>
                                </td>
                                <td style={{ padding: "16px", color: "#475569", fontWeight: "600" }}>
                                  {topic.departmentCode || "-"}
                                </td>
                                <td style={{ padding: "16px", color: "#475569" }}>
                                  <div style={{ fontWeight: "600" }}>{allStudents.find(s => s.studentCode === topic.proposerStudentCode)?.fullName || topic.proposerStudentCode || "-"}</div>
                                  {topic.proposerStudentCode && <div style={{ fontSize: "11px", color: "#64748b" }}>{topic.proposerStudentCode}</div>}
                                </td>
                                <td style={{ padding: "16px", color: "#475569" }}>
                                  <div style={{ fontWeight: "600" }}>{allLecturers.find(l => l.lecturerCode === topic.supervisorLecturerCode)?.fullName || topic.supervisorLecturerCode || "-"}</div>
                                  {topic.supervisorLecturerCode && <div style={{ fontSize: "11px", color: "#64748b" }}>{topic.supervisorLecturerCode}</div>}
                                </td>
                                <td style={{ padding: "16px" }}>
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
                                </td>
                                <td style={{ padding: "16px", borderRadius: "0 12px 12px 0", textAlign: "right" }}>
                                  <div style={{ display: "inline-flex", gap: "8px" }}>
                                    <button
                                      type="button"
                                      onClick={() => openEditTopicModal(topic)}
                                      style={{
                                        padding: "8px 12px",
                                        background: "#f1f5f9",
                                        border: "1px solid #cbd5e1",
                                        borderRadius: "8px",
                                        fontSize: "13px",
                                        fontWeight: "700",
                                        color: "#1e3a5f",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4
                                      }}
                                    >
                                      <Edit size={14} /> Sửa
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTopic(topic)}
                                      disabled={isTopicDeleting === topic.topicID}
                                      style={{
                                        padding: "8px 12px",
                                        background: "#fee2e2",
                                        border: "1px solid #fca5a5",
                                        borderRadius: "8px",
                                        fontSize: "13px",
                                        fontWeight: "700",
                                        color: "#ef4444",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4
                                      }}
                                    >
                                      {isTopicDeleting === topic.topicID ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={14} />} Xóa
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    {renderPagination(topicsCurrentPage, Math.ceil(filteredTopics.length / 10), setTopicsCurrentPage)}
                  </div>
                );
              })()}

              {/* TAB 3: SELF-SELECTED REVIEW */}
              {activeAdminTab === "review" && (
                <>
                  {/* Toolbar */}
                  <div style={{
                    background: "white",
                    borderRadius: "12px",
                    padding: "20px",
                    marginBottom: "24px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                    border: "1px solid #E5E7EB",
                  }}>
                    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ flex: "1 1 400px", position: "relative" }}>
                        <Search size={18} color="#9CA3AF" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
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
                          }}
                        />
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
                          <option value="all">Tất cả trạng thái duyệt</option>
                          <option value="Chờ duyệt">Chờ duyệt</option>
                          <option value="Đã duyệt">Đã duyệt</option>
                          <option value="Cần sửa đổi">Cần sửa đổi</option>
                          <option value="Từ chối">Từ chối</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Review Table */}
                  <div style={{
                    background: "white",
                    borderRadius: "24px",
                    border: "1px solid #D9E1F2",
                    padding: "20px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  }}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", fontSize: "14px" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid #E5ECFB", background: "#F8FAFF" }}>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", color: "#1F3C88" }}>Mã đề tài</th>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", color: "#1F3C88" }}>Tên đề tài</th>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", color: "#1F3C88", minWidth: "140px" }}>Sinh viên</th>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", color: "#1F3C88", minWidth: "140px" }}>Loại đề tài</th>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", color: "#1F3C88" }}>Ngày nộp</th>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", color: "#1F3C88", minWidth: "150px" }}>Trạng thái</th>
                            <th style={{ padding: "12px 8px", textAlign: "center", fontWeight: "600", color: "#1F3C88", width: "120px" }}>Hành động</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topics.length === 0 ? (
                            <tr>
                              <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#4A5775" }}>
                                Không có đề tài tự chọn nào cần duyệt
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
                                return (priorityOrder[a.status as keyof typeof priorityOrder] || 5) - (priorityOrder[b.status as keyof typeof priorityOrder] || 5);
                              })
                              .map((topic) => (
                                <tr
                                  key={topic.topicID}
                                  style={{ borderBottom: "1px solid #E5ECFB", transition: "background 0.2s ease" }}
                                >
                                  <td style={{ padding: "12px 16px", fontWeight: "600", color: "#1F3C88" }}>{topic.topicCode}</td>
                                  <td style={{ padding: "12px 16px", color: "#1a1a1a", maxWidth: "300px" }}>
                                    <div style={{ fontWeight: "600", color: "#1F3C88", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis", lineHeight: "1.4", maxHeight: "2.8em", marginBottom: "4px" }}>
                                      {topic.title}
                                    </div>
                                    {topic.lecturerProfile && (
                                      <div style={{ fontSize: "12px", color: "#666", display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                                        <User size={12} />
                                        GVHD: {topic.lecturerProfile.fullName}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: "12px 16px", color: "#4A5775", minWidth: "140px" }}>
                                    <div style={{ fontWeight: "500" }}>{topic.studentName}</div>
                                    <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>{topic.studentCode}</div>
                                  </td>
                                  <td style={{ padding: "12px 16px", color: "#4A5775", minWidth: "150px" }}>
                                    <span style={{ display: "inline-block", padding: "4px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "500", background: topic.category === "Đề tài catalog" ? "#E0F2FE" : "#FEF3C7", color: topic.category === "Đề tài catalog" ? "#0369A1" : "#92400E" }}>
                                      {topic.category}
                                    </span>
                                  </td>
                                  <td style={{ padding: "12px 16px", color: "#4A5775", fontSize: "13px" }}>
                                    {new Date(topic.submissionDate).toLocaleDateString("vi-VN")}
                                  </td>
                                  <td style={{ padding: "12px 16px", minWidth: "140px" }}>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "600", background: topic.status === "Đã duyệt" ? "#DCFCE7" : topic.status === "Từ chối" ? "#FEE2E2" : "#FEF3C7", color: topic.status === "Đã duyệt" ? "#166534" : topic.status === "Từ chối" ? "#991B1B" : "#92400E" }}>
                                      {getStatusIcon(topic.status)}
                                      {getStatusText(topic.status)}
                                    </span>
                                  </td>
                                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                                      <button
                                        onClick={() => openDetailModal(topic)}
                                        title="Xem chi tiết đề tài"
                                        style={{ padding: "8px", background: "#1F3C88", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px" }}
                                      >
                                        <Eye size={16} />
                                      </button>

                                      {topic.status === "Chờ duyệt" && (
                                        <>
                                          <button
                                            onClick={() => openConfirmationModal(topic)}
                                            title="Duyệt đề tài"
                                            disabled={updatingStatus !== null}
                                            style={{ padding: "8px", background: "#22C55E", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px" }}
                                          >
                                            <CheckCircle size={16} />
                                          </button>
                                          <button
                                            onClick={() => openCommentModal("revision", topic.topicID, topic.title)}
                                            title="Yêu cầu sửa đổi đề tài"
                                            disabled={updatingStatus !== null}
                                            style={{ padding: "8px", background: "#F59E0B", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px" }}
                                          >
                                            <Edit size={16} />
                                          </button>
                                          <button
                                            onClick={() => openCommentModal("reject", topic.topicID, topic.title)}
                                            title="Từ chối đề tài"
                                            disabled={updatingStatus !== null}
                                            style={{ padding: "8px", background: "#EF4444", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px" }}
                                          >
                                            <X size={16} />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    {renderPagination(currentPage, Math.ceil(totalCount / pageSize), setCurrentPage)}
                  </div>
                </>
              )}

              {/* TAB 4: LECTURER GUIDANCE LOAD */}
              {activeAdminTab === "lecturer-quota" && (() => {
                const filteredLecturers = allLecturers.filter(lec => {
                  const s = lecturerLoadSearchTerm.trim().toLowerCase();
                  const matchesSearch = !s || lec.fullName.toLowerCase().includes(s) || lec.lecturerCode.toLowerCase().includes(s) || (lec.degree || "").toLowerCase().includes(s);
                  const matchesDept = lecturerLoadDeptFilter === "all" || lec.departmentCode === lecturerLoadDeptFilter;
                  return matchesSearch && matchesDept;
                });
                const paginatedLecturers = filteredLecturers.slice((lecturerLoadCurrentPage - 1) * 10, lecturerLoadCurrentPage * 10);
                return (
                  <div style={{
                    background: "white",
                    borderRadius: "24px",
                    border: "1px solid #D9E1F2",
                    padding: "24px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  }}>
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
                        <option value="all">Tất cả khoa / bộ môn</option>
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
                            <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Bộ môn</th>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700" }}>Học vị</th>
                            <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "700" }}>Chỉ tiêu</th>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "700", minWidth: 200 }}>Tải lượng hướng dẫn</th>
                            <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: "700" }}>Trạng thái tải</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLecturers.length === 0 ? (
                            <tr>
                              <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#64748b", fontStyle: "italic" }}>
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
                                    <td style={{ padding: "16px", borderRadius: "0 12px 12px 0", textAlign: "center" }}>
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
                                  </tr>

                                  {/* Expanded sub-table row */}
                                  {isExpanded && (
                                    <tr>
                                      <td colSpan={7} style={{ padding: "8px 24px 20px 24px", background: "#f8fafc" }}>
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
              {activeAdminTab === "export" && (
                <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "32px", alignItems: "start" }}>
                  {/* Left: Quick Export Options */}
                  <div style={{ display: "grid", gap: "24px" }}>
                    {[
                      { title: "Báo cáo Tổng hợp Phân công", desc: "Xuất dữ liệu toàn bộ sinh viên trong đợt bảo vệ kèm thông tin đề tài và giảng viên hướng dẫn.", type: "all" as const, color: "#1e3a5f" },
                      { title: "Báo cáo Sinh viên đã có Đề tài", desc: "Danh sách chi tiết các sinh viên đã được chỉ định hoặc đã duyệt đề tài thành công.", type: "has_topic" as const, color: "#22c55e" },
                      { title: "Báo cáo Sinh viên chưa có Đề tài", desc: "Danh sách sinh viên quá hạn, chưa đăng ký đề tài hoặc chưa được giáo vụ phân công.", type: "no_topic" as const, color: "#ef4444" }
                    ].map((card, i) => (
                      <div key={i} className="premium-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <div>
                          <h4 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 800, color: "#1e293b" }}>{card.title}</h4>
                          <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{card.desc}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleExportCSV(card.type)}
                          style={{
                            marginTop: 24,
                            padding: "12px",
                            background: "white",
                            border: `1.5px solid ${card.color}`,
                            color: card.color,
                            borderRadius: 12,
                            fontWeight: 800,
                            fontSize: 13,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            transition: "all 0.2s"
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = `${card.color}10`; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "white"; }}
                        >
                          <Download size={15} /> Xuất Báo Cáo (.csv)
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Right: Export Columns Configuration */}
                  <div style={{
                    background: "white",
                    borderRadius: "24px",
                    border: "1px solid #D9E1F2",
                    padding: "24px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  }}>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: "800", color: "#1e3a5f" }}>
                      Tùy chọn trường thông tin xuất
                    </h4>
                    <p style={{ margin: "0 0 20px 0", fontSize: 13, color: "#64748b" }}>
                      Chọn hoặc bỏ chọn các cột dữ liệu sẽ xuất ra file CSV báo cáo:
                    </p>

                    <div style={{ display: "grid", gap: 12 }}>
                      {[
                        { key: "STT", label: "Số thứ tự (STT)" },
                        { key: "studentCode", label: "Mã sinh viên" },
                        { key: "fullName", label: "Họ và Tên sinh viên" },
                        { key: "classCode", label: "Lớp học" },
                        { key: "departmentCode", label: "Khoa / Bộ môn" },
                        { key: "status", label: "Trạng thái đăng ký" },
                        { key: "topicTitle", label: "Tên đề tài luận văn" },
                        { key: "supervisorName", label: "Giảng viên hướng dẫn" }
                      ].map(field => {
                        const isChecked = selectedExportFields.includes(field.key);
                        return (
                          <label
                            key={field.key}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "12px 16px",
                              borderRadius: "12px",
                              border: `1.5px solid ${isChecked ? "#1e3a5f" : "#f1f5f9"}`,
                              background: isChecked ? "rgba(30, 58, 95, 0.02)" : "white",
                              cursor: "pointer",
                              transition: "all 0.2s"
                            }}
                          >
                            <span style={{ fontSize: "14px", fontWeight: "600", color: "#334155" }}>
                              {field.label}
                            </span>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedExportFields(prev => [...prev, field.key]);
                                } else {
                                  setSelectedExportFields(prev => prev.filter(k => k !== field.key));
                                }
                              }}
                              style={{
                                width: 18,
                                height: 18,
                                accentColor: "#1e3a5f",
                                cursor: "pointer"
                              }}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
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
            zIndex: 1100,
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
            zIndex: 1100,
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
            zIndex: 1100,
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
            zIndex: 1100,
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
      {detailModal.isOpen && detailModal.topic && (
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
          }}
          onClick={closeDetailModal}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "24px",
              padding: "0",
              maxWidth: "1100px",
              width: "95%",
              height: "90vh",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top-right close button */}
            <button
              onClick={closeDetailModal}
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                width: "36px",
                height: "36px",
                borderRadius: "12px",
                background: "white",
                border: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                zIndex: 100,
                transition: "all 0.2s ease",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#fee2e2";
                e.currentTarget.style.color = "#ef4444";
                e.currentTarget.style.borderColor = "#fecaca";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "white";
                e.currentTarget.style.color = "#64748b";
                e.currentTarget.style.borderColor = "#e2e8f0";
              }}
            >
              <X size={20} />
            </button>

            {/* Scrollable Container */}
            <div
              className="custom-scrollbar"
              style={{
                flex: 1,
                overflowY: "auto",
              }}
            >
              {/* Modal Body with 7/3 Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "7fr 3fr",
                  minHeight: "100%",
                }}
              >
                {/* Left Column: Topic Details */}
                <div
                  style={{
                    padding: "40px",
                    background: "white",
                    borderRight: "1px solid #f1f5f9",
                  }}
                >
                {/* Topic Header */}
                <div style={{ marginBottom: "32px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "#1e3a5f",
                      fontSize: "12px",
                      fontWeight: "800",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      marginBottom: "12px",
                    }}
                  >
                    <BookOpen size={14} />
                    Chi tiết đề tài
                  </div>
                  <h2
                    style={{
                      fontSize: "28px",
                      fontWeight: "800",
                      color: "#0f172a",
                      lineHeight: "1.3",
                      marginBottom: "16px",
                    }}
                  >
                    {detailModal.topic.title}
                  </h2>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        padding: "6px 12px",
                        background: "#f1f5f9",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#475569",
                      }}
                    >
                      Mã: {detailModal.topic.topicCode}
                    </span>
                    <span
                      style={{
                        padding: "6px 12px",
                        background: getStatusColor(detailModal.topic.status) + "15",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: "800",
                        color: getStatusColor(detailModal.topic.status),
                      }}
                    >
                      {detailModal.topic.status}
                    </span>
                    <span
                      style={{
                        padding: "6px 12px",
                        background: "#f0f6ff",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#1e3a5f",
                      }}
                    >
                      {detailModal.topic.category}
                    </span>
                  </div>
                </div>

                {/* Topic Body */}
                <div style={{ display: "grid", gap: "32px" }}>
                  {/* Summary Section */}
                  <div>
                    <h3
                      style={{
                        fontSize: "16px",
                        fontWeight: "700",
                        color: "#1e293b",
                        marginBottom: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <FileText size={18} color="#1e3a5f" />
                      Tóm tắt đề tài
                    </h3>
                    <div
                      style={{
                        padding: "24px",
                        background: "#f8fafc",
                        borderRadius: "16px",
                        fontSize: "15px",
                        color: "#334155",
                        lineHeight: "1.7",
                        border: "1px solid #f1f5f9",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {detailModal.topic.description || "Chưa có nội dung tóm tắt cho đề tài này."}
                    </div>
                  </div>

                  {/* Tags Section */}
                  <div>
                    <h3
                      style={{
                        fontSize: "16px",
                        fontWeight: "700",
                        color: "#1e293b",
                        marginBottom: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <TagIcon size={18} color="#1e3a5f" />
                      Lĩnh vực & Chuyên ngành
                    </h3>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      {topicTags.length > 0 ? (
                        topicTags.map((tag) => (
                          <span
                            key={tag.tagID}
                            style={{
                              padding: "8px 16px",
                              background: "white",
                              border: "1px solid #e2e8f0",
                              borderRadius: "12px",
                              fontSize: "13px",
                              fontWeight: "600",
                              color: "#1e293b",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                            }}
                          >
                            {tag.tagName}
                          </span>
                        ))
                      ) : (
                        <div style={{ fontSize: "14px", color: "#94a3b8", fontStyle: "italic" }}>
                          Chưa có thông tin lĩnh vực
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Lecturer Feedback Section */}
                  {detailModal.topic.comments && (
                    <div>
                      <h3
                        style={{
                          fontSize: "16px",
                          fontWeight: "700",
                          color: "#1e293b",
                          marginBottom: "12px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <MessageCircle size={18} color="#1e3a5f" />
                        Ghi chú từ giảng viên
                      </h3>
                      <div
                        style={{
                          padding: "20px",
                          background: "#f0f6ff",
                          borderRadius: "16px",
                          fontSize: "14px",
                          color: "#1e3a5f",
                          lineHeight: "1.6",
                          border: "1px solid #ffedd5",
                          fontWeight: "500",
                        }}
                      >
                        {detailModal.topic.comments}
                      </div>
                    </div>
                  )}

                  {/* AI Analysis Section */}
                  <div style={{ marginTop: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <h3
                        style={{
                          fontSize: "16px",
                          fontWeight: "700",
                          color: "#1e293b",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          margin: 0
                        }}
                      >
                        <TrendingUp size={18} color="#8B5CF6" />
                        Trợ lý AI Thẩm định
                        <span style={{ 
                          fontSize: "10px", 
                          background: "#8B5CF6", 
                          color: "white", 
                          padding: "2px 8px", 
                          borderRadius: "99px",
                          marginLeft: "8px",
                          textTransform: "uppercase"
                        }}>DNU-GPT</span>
                      </h3>
                      
                      {!aiAnalysis && !isAnalyzing && (
                        <button
                          onClick={handleAiAnalysis}
                          style={{
                            padding: "8px 16px",
                            background: "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)",
                            color: "white",
                            border: "none",
                            borderRadius: "12px",
                            fontSize: "13px",
                            fontWeight: "700",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            boxShadow: "0 4px 6px -1px rgba(139, 92, 246, 0.3)"
                          }}
                        >
                          <Loader2 size={14} />
                          Phân tích đề tài ngay
                        </button>
                      )}
                    </div>

                    {isAnalyzing && (
                      <div style={{ 
                        padding: "40px", 
                        background: "#F5F3FF", 
                        borderRadius: "20px", 
                        border: "2px dashed #DDD6FE",
                        textAlign: "center"
                      }}>
                        <Loader2 size={32} color="#8B5CF6" className="animate-spin" style={{ margin: "0 auto 16px" }} />
                        <div style={{ fontSize: "15px", fontWeight: "700", color: "#5B21B6", marginBottom: "4px" }}>Đang thẩm định đề tài...</div>
                        <div style={{ fontSize: "13px", color: "#7C3AED" }}>Hệ thống đang phân tích hàm lượng khoa học và tính thực tiễn</div>
                      </div>
                    )}

                    {aiAnalysis && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        {/* 1. Score and Summary Card (Overview) */}
                        <div style={{ 
                          padding: "24px", 
                          background: "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)", 
                          borderRadius: "24px",
                          border: "1px solid #DDD6FE",
                          boxShadow: "0 4px 12px rgba(139, 92, 246, 0.05)"
                        }}>
                          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "24px", alignItems: "center" }}>
                            <div style={{ textAlign: "center" }}>
                              <div style={{ 
                                width: "80px", 
                                height: "80px", 
                                borderRadius: "20px", 
                                background: "white",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: "0 10px 15px -3px rgba(139, 92, 246, 0.2)",
                                border: "2px solid #8B5CF6"
                              }}>
                                <span style={{ fontSize: "28px", fontWeight: "900", color: "#5B21B6" }}>{aiAnalysis.overallScore}</span>
                                <span style={{ fontSize: "10px", fontWeight: "700", color: "#7C3AED", textTransform: "uppercase" }}>Điểm số</span>
                              </div>
                              <div style={{ 
                                marginTop: "12px",
                                padding: "4px 12px",
                                background: aiAnalysis.status === "Đạt" ? "#22C55E" : aiAnalysis.status === "Không đạt" ? "#EF4444" : "#F59E0B",
                                color: "white",
                                borderRadius: "8px",
                                fontSize: "12px",
                                fontWeight: "800"
                              }}>
                                {aiAnalysis.status.toUpperCase()}
                              </div>
                            </div>
                            <div>
                              <h4 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: "800", color: "#5B21B6", display: "flex", alignItems: "center", gap: "8px" }}>
                                <Zap size={16} /> Nhận xét cốt lõi
                              </h4>
                              <p style={{ margin: 0, fontSize: "14px", color: "#4C1D95", lineHeight: "1.6", fontWeight: "500" }}>
                                {aiAnalysis.summary}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* 2. Pros and Cons (Quick Review) */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                          <div style={{ padding: "20px", background: "#F0FDF4", borderRadius: "20px", border: "1px solid #DCFCE7" }}>
                            <h4 style={{ fontSize: "14px", fontWeight: "800", color: "#166534", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                              <CheckCircle size={14} /> Ưu điểm
                            </h4>
                            <ul style={{ margin: 0, paddingLeft: "18px", display: "grid", gap: "8px" }}>
                              {aiAnalysis.pros.map((p, i) => (
                                <li key={i} style={{ fontSize: "13px", color: "#166534", lineHeight: "1.4" }}>{p}</li>
                              ))}
                            </ul>
                          </div>
                          <div style={{ padding: "20px", background: "#FEF2F2", borderRadius: "20px", border: "1px solid #FEE2E2" }}>
                            <h4 style={{ fontSize: "14px", fontWeight: "800", color: "#991B1B", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                              <AlertCircle size={14} /> Hạn chế
                            </h4>
                            <ul style={{ margin: 0, paddingLeft: "18px", display: "grid", gap: "8px" }}>
                              {aiAnalysis.cons.map((c, i) => (
                                <li key={i} style={{ fontSize: "13px", color: "#991B1B", lineHeight: "1.4" }}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* 3. Detail Toggle Button */}
                        <button
                          onClick={() => setShowDetailedAi(!showDetailedAi)}
                          style={{
                            width: "100%",
                            padding: "12px",
                            background: "#F8FAFC",
                            border: "1px dashed #CBD5E1",
                            borderRadius: "16px",
                            color: "#64748B",
                            fontSize: "13px",
                            fontWeight: "700",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                            transition: "all 0.2s ease"
                          }}
                        >
                          {showDetailedAi ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          {showDetailedAi ? "Thu gọn phân tích kỹ thuật" : "Xem phân tích kỹ thuật chi tiết & Lộ trình phát triển"}
                        </button>

                        {/* 4. Detailed Section (Collapsible) */}
                        {showDetailedAi && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "fadeIn 0.3s ease" }}>
                            {/* Detailed Criteria */}
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

                            {/* Technical Suggestions / Roadmap */}
                            <div style={{ padding: "24px", background: "#FFFBEB", borderRadius: "24px", border: "1px solid #FEF3C7" }}>
                              <h4 style={{ fontSize: "14px", fontWeight: "800", color: "#92400E", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                                <Edit size={16} /> Lộ trình hoàn thiện & Công nghệ đề xuất
                              </h4>
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

                        {/* 5. Feedback for Student Card (Always Visible) */}
                        <div style={{ 
                          padding: "24px", 
                          background: "white", 
                          borderRadius: "24px", 
                          border: "2px solid #8B5CF6",
                          boxShadow: "0 10px 15px -3px rgba(139, 92, 246, 0.1)"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                            <h4 style={{ fontSize: "15px", fontWeight: "800", color: "#5B21B6", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                              <MessageCircle size={18} /> Phản hồi gửi Sinh viên
                            </h4>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(aiAnalysis.feedbackForStudent);
                                addToast("Đã sao chép phản hồi!", "success");
                              }}
                              style={{
                                padding: "8px 16px",
                                background: "#F5F3FF",
                                color: "#8B5CF6",
                                border: "1px solid #DDD6FE",
                                borderRadius: "10px",
                                fontSize: "12px",
                                fontWeight: "700",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                transition: "all 0.2s ease"
                              }}
                            >
                              Sao chép nội dung
                            </button>
                          </div>
                          <div style={{ 
                            fontSize: "14px", 
                            color: "#1e293b", 
                            lineHeight: "1.7", 
                            background: "#F8FAFC", 
                            padding: "20px", 
                            borderRadius: "16px",
                            border: "1px solid #f1f5f9",
                            whiteSpace: "pre-wrap",
                            fontStyle: "italic"
                          }}>
                            "{aiAnalysis.feedbackForStudent}"
                          </div>
                          <p style={{ marginTop: "12px", fontSize: "11px", color: "#94a3b8", fontStyle: "italic", textAlign: "right" }}>
                            * Giảng viên có thể sao chép đoạn văn này để gửi cho sinh viên.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Right Column: Sidebar */}
              <div
                style={{
                  background: "#f8fafc",
                  padding: "40px 32px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "24px",
                }}
              >
                {/* Student Profile Card */}
                <div
                  style={{
                    background: "white",
                    borderRadius: "24px",
                    padding: "32px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                    border: "1px solid #f1f5f9",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      width: "128px",
                      height: "128px",
                      borderRadius: "32px",
                      margin: "0 auto 24px",
                      background: "linear-gradient(135deg, #1e3a5f 0%, #2a5282 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "4px solid white",
                      boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
                      overflow: "hidden",
                    }}
                  >
                    {detailModal.topic.studentProfile?.studentImage ? (
                      <img
                        src={getAvatarUrl(detailModal.topic.studentProfile.studentImage)}
                        alt={detailModal.topic.studentName}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <span style={{ fontSize: "48px", color: "white", fontWeight: "800" }}>
                        {detailModal.topic.studentName.charAt(0)}
                      </span>
                    )}
                  </div>
                  <h4 style={{ fontSize: "22px", fontWeight: "900", color: "#0f172a", marginBottom: "6px" }}>
                    {detailModal.topic.studentName}
                  </h4>
                  <div
                    style={{
                      display: "inline-block",
                      padding: "4px 12px",
                      backgroundColor: "rgba(243, 112, 33, 0.1)",
                      borderRadius: "8px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "900",
                        color: "#1e3a5f",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                      }}
                    >
                      Mã SV: {detailModal.topic.studentCode}
                    </span>
                  </div>
                </div>

                {/* Info List - Reduced */}
                <div style={{ display: "grid", gap: "12px" }}>
                  {[
                    { icon: <Users size={16} />, label: "Lớp", value: detailModal.topic.studentProfile?.classCode },
                    { icon: <TrendingUp size={16} />, label: "GPA", value: detailModal.topic.studentProfile?.gpa?.toFixed(2) },
                    { icon: <Calendar size={16} />, label: "Ngày đăng ký", value: new Date(detailModal.topic.submissionDate).toLocaleDateString("vi-VN") },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "16px",
                        background: "white",
                        borderRadius: "16px",
                        border: "1px solid #f1f5f9",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#94a3b8" }}>
                        {item.icon}
                        <span style={{ fontSize: "10px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {item.label}
                        </span>
                      </div>
                      <span style={{ fontSize: "14px", fontWeight: "700", color: "#334155", wordBreak: "break-all" }}>
                        {item.value || "---"}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Lecturer Card if available */}
                {detailModal.topic.lecturerProfile && (
                  <div
                    style={{
                      background: "white",
                      borderRadius: "16px",
                      padding: "20px",
                      border: "1px solid #f1f5f9",
                    }}
                  >
                    <div style={{ fontSize: "10px", fontWeight: "900", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>
                      Giảng viên hướng dẫn
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#1e3a5f", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "800" }}>
                        {detailModal.topic.lecturerProfile.fullName.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: "700", color: "#1e293b" }}>
                          {detailModal.topic.lecturerProfile.fullName}
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b" }}>
                          {detailModal.topic.lecturerProfile.degree}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Vertical Action Buttons */}
                {detailModal.topic.status === "Chờ duyệt" && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      marginTop: "auto",
                    }}
                  >
                    <button
                      onClick={() => openConfirmationModal(detailModal.topic!)}
                      style={{
                        padding: "16px",
                        background: "#22c55e",
                        color: "white",
                        border: "none",
                        borderRadius: "16px",
                        fontSize: "15px",
                        fontWeight: "800",
                        cursor: "pointer",
                        boxShadow: "0 10px 15px -3px rgba(34, 197, 94, 0.25)",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 15px 20px -5px rgba(34, 197, 94, 0.3)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 10px 15px -3px rgba(34, 197, 94, 0.25)";
                      }}
                    >
                      Duyệt đề tài
                    </button>
                    <button
                      onClick={() => {
                        openCommentModal("revision", detailModal.topic!.topicID, detailModal.topic!.title);
                      }}
                      style={{
                        padding: "14px",
                        background: "#f0f6ff",
                        color: "#d97706",
                        border: "1px solid #bfdbfe",
                        borderRadius: "16px",
                        fontSize: "14px",
                        fontWeight: "700",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#ffedd5";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#f0f6ff";
                      }}
                    >
                      Yêu cầu sửa đổi
                    </button>
                    <button
                      onClick={() => {
                        openCommentModal("reject", detailModal.topic!.topicID, detailModal.topic!.title);
                      }}
                      style={{
                        padding: "14px",
                        background: "#fef2f2",
                        color: "#dc2626",
                        border: "1px solid #fecaca",
                        borderRadius: "16px",
                        fontSize: "14px",
                        fontWeight: "700",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#fee2e2";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#fef2f2";
                      }}
                    >
                      Từ chối
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
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
                Bộ môn: {manualAssignModal.student.departmentCode} • Lớp: {manualAssignModal.student.classCode}
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
                        {lec.fullName} ({lec.lecturerCode}) {isSameDept ? "★ (Cùng bộ môn)" : ""}
                      </option>
                    );
                  })}
                </select>
                <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "#64748b" }}>
                  ★ Ưu tiên giảng viên cùng bộ môn với sinh viên được xếp ở đầu danh sách.
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
              maxWidth: "1000px",
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

            <div style={{ flex: 1, overflowY: "auto", paddingRight: 8, marginBottom: 20 }}>
              {autoAssignPreview.length === 0 ? (
                <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontStyle: "italic" }}>
                  Không có sinh viên nào cần phân công hoặc không tìm thấy ứng viên ghép nối phù hợp.
                </div>
              ) : (
                <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", color: "#475569", borderBottom: "2px solid #e2e8f0" }}>
                      <th style={{ padding: "12px", textAlign: "left" }}>Sinh viên quá hạn</th>
                      <th style={{ padding: "12px", textAlign: "left" }}>Đề tài ghép nối tự động</th>
                      <th style={{ padding: "12px", textAlign: "left" }}>Giảng viên hướng dẫn ghép</th>
                      <th style={{ padding: "12px", textAlign: "center" }}>Mức độ khớp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {autoAssignPreview.map((item, index) => (
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
                        <td style={{ padding: "12px", textAlign: "center" }}>
                          {item.isFallback ? (
                            <span style={{ background: "#fee2e2", color: "#991b1b", padding: "4px 8px", borderRadius: 99, fontSize: 11, fontWeight: "700" }}>Gán Mặc Định</span>
                          ) : (
                            <span style={{ background: "#dcfce7", color: "#166534", padding: "4px 8px", borderRadius: 99, fontSize: 11, fontWeight: "700" }}>
                              Khớp {item.matchTagsCount} Tag
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

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
                    Bộ môn quản lý
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
                    <option value="">-- Chọn bộ môn --</option>
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
                    Bộ môn quản lý
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
                    <option value="">-- Chọn bộ môn --</option>
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
    </div>
  );
};

export default LecturerTopicReview;
