import React, { useState, useEffect } from "react";
import {
  Users,
  User,
  Mail,
  Phone,
  Calendar,
  BookOpen,
  CheckCircle,
  Clock,
  AlertCircle,
  LayoutGrid,
  List,
  Search,
  Filter,
  ArrowUpDown,
  X,
  FileText,
  Download,
  MessageSquare,
  Activity,
  History,
  Archive,
  ArrowRight,
  TrendingUp,
  RotateCcw,
  Bell,
  ShieldAlert,
  CalendarClock,
  ShieldCheck,
} from "lucide-react";
import { fetchData, getAvatarUrl, normalizeUrl } from "../../api/fetchData";
import type { Topic } from "../../types/topic";
import type { StudentProfile } from "../../types/studentProfile";
import type { ProgressMilestone } from "../../types/progressMilestone";
import type { ProgressSubmission } from "../../types/progressSubmission";
import type { SubmissionFile } from "../../types/submissionFile";
import type { MilestoneTemplate } from "../../types/milestoneTemplate";
import { useAuth } from "../../hooks/useAuth";
import { useActiveDefensePeriodId } from "../../utils/defensePeriod";
import TablePagination from "../../components/TablePagination/TablePagination";

interface Student {
  studentCode: string;
  studentName: string;
  email: string;
  phone: string;
  topicTitle: string;
  topicCode: string;
  registrationDate: string;
  status: "approved" | "pending" | "defense-ready" | "committee-assigned" | "post-defense";
  progress: number;
  lastActivity: string;
  topic: Topic;
  studentProfile?: StudentProfile;
  milestones?: ProgressMilestone[];
  submissions?: ProgressSubmission[];
  allFiles?: SubmissionFile[];
  stats?: {
    onTimeRate: number;
    revisionCount: number;
    daysRemaining: number | null;
  };
}

const LecturerStudents: React.FC = () => {
  const { user } = useAuth();
  const activeDefenseTermId = useActiveDefensePeriodId();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean;
    student?: Student;
  }>({ isOpen: false });
  const [viewMode, setViewMode] = useState<"card" | "table">("table");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "progress" | "date">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  /** Milestone templates - dùng để lấy deadline thực của từng mốc */
  const [milestoneTemplates, setMilestoneTemplates] = useState<MilestoneTemplate[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter]);

  // ---- Override Failure Modal state ----
  const [overrideModal, setOverrideModal] = useState<{
    isOpen: boolean;
    milestoneId?: number;
    milestoneName?: string;
    studentName?: string;
    /** Lý do thất bại từ FAILED milestone */
    failureReason?: string | null;
    /** Thời điểm bị FAILED */
    failedAt?: string | null;
    /** Deadline gốc của mốc */
    originalDeadline?: string | null;
    /** Ordinal của mốc hiện tại */
    currentOrdinal?: number | null;
  }>({ isOpen: false });
  const [overrideAction, setOverrideAction] = useState<"EXTEND_DEADLINE" | "EXEMPT" | "MARK_INELIGIBLE">("EXTEND_DEADLINE");
  const [overrideNewDeadline, setOverrideNewDeadline] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overriding, setOverriding] = useState(false);

  const getCurrentOrdinal = (m: ProgressMilestone): number => {
    const total = milestoneTemplates.length > 0 ? milestoneTemplates.length : 5;
    for (let i = 1; i <= total; i++) {
      const completedField = `completedAt${i}` as keyof ProgressMilestone;
      if (!m[completedField]) {
        return i;
      }
    }
    return total; // all done
  };

  /**
   * Phát hiện SV quá hạn dựa trên deadline thực tế từ MilestoneTemplate.
   * Logic: tìm ordinal hiện tại, lấy template tương ứng, kiểm tra deadline.
   */
  const isStudentOverdue = (s: Student): boolean => {
    if (!s.milestones || s.milestones.length === 0) return false;
    const m = s.milestones[0];
    // Trường hợp rõ ràng: đã bị FAILED
    if (m.state?.toUpperCase() === "FAILED") return true;
    // Không kiểm tra nếu đã hoàn tất hoặc exempted
    if (m.state === "WaitingForCommittee" || m.state?.toUpperCase() === "EXEMPTED") return false;
    // Dùng template deadlines nếu có
    if (milestoneTemplates.length > 0) {
      const ordinal = getCurrentOrdinal(m);
      const template = milestoneTemplates.find(t => t.ordinal === ordinal);
      if (template?.deadline && new Date(template.deadline) < new Date()) return true;
    } else {
      // Fallback: dùng deadline trong milestone record nếu chưa load templates
      if (m.deadline && new Date(m.deadline) < new Date()) {
        const completedAll = !!m.completedAt1 && !!m.completedAt2 && !!m.completedAt3 && !!m.completedAt4;
        if (!completedAll) return true;
      }
    }
    return false;
  };

  /** Trả về thông tin context quá hạn để hiển thị trong modal */
  const getOverdueContext = (s: Student) => {
    if (!s.milestones || s.milestones.length === 0) return null;
    const m = s.milestones[0];
    const ordinal = getCurrentOrdinal(m);
    const template = milestoneTemplates.find(t => t.ordinal === ordinal);
    return {
      ordinal,
      milestoneName: template?.name ?? `Mốc ${ordinal}`,
      originalDeadline: template?.deadline ?? m.deadline ?? null,
      failureReason: m.state?.toUpperCase() === "FAILED" ? (m.failureReason ?? null) : null,
      failedAt: m.state?.toUpperCase() === "FAILED" ? (m.failedAt ?? null) : null,
      milestoneId: m.milestoneID,
      isFailed: m.state?.toUpperCase() === "FAILED",
      isDeadlinePassed: !!template?.deadline && new Date(template.deadline) < new Date(),
    };
  };

  /** GV c\u1ea5p ph\u00e9p ho\u1eb7c thu h\u1ed3i ph\u00e9p n\u1ed9p mu\u1ed9n */
  const handleAllowLateSubmit = async (milestoneId: number, allow: boolean, studentName: string) => {
    if (!user?.userCode) return;
    const confirmed = window.confirm(
      allow
        ? `Cấp phép nộp muộn cho ${studentName}?\nSinh viên sẽ được nộp báo cáo 1 lần dù đã quá deadline. Phép sẽ tự hết sau khi nộp.`
        : `Thu hồi phép nộp muộn của ${studentName}?`
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/ProgressMilestones/allow-late-submit/${milestoneId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify({ allow, grantedByUserCode: user.userCode, note: null }),
      });
      if (res.ok) {
        const data = await res.json();
        const updatedMilestone = data?.data;
        // Cập nhật state local — không reload trang, giữ modal mở
        setStudents(prev => prev.map(s => {
          if (!s.milestones) return s;
          const idx = s.milestones.findIndex(m => m.milestoneID === milestoneId);
          if (idx === -1) return s;
          const newMilestones = [...s.milestones];
          newMilestones[idx] = updatedMilestone ?? {
            ...newMilestones[idx],
            allowLateSubmit: allow,
            lateSubmitGrantedBy: allow ? user.userCode : null,
            lateSubmitGrantedAt: allow ? new Date().toISOString() : null,
          };
          return { ...s, milestones: newMilestones };
        }));
        // Cập nhật luôn detailModal nếu đang mở
        setDetailModal(prev => {
          if (!prev.student) return prev;
          const idx = prev.student.milestones?.findIndex(m => m.milestoneID === milestoneId) ?? -1;
          if (idx === -1) return prev;
          const newMilestones = [...(prev.student.milestones ?? [])];
          newMilestones[idx] = updatedMilestone ?? {
            ...newMilestones[idx],
            allowLateSubmit: allow,
            lateSubmitGrantedBy: allow ? user.userCode : null,
            lateSubmitGrantedAt: allow ? new Date().toISOString() : null,
          };
          return { ...prev, student: { ...prev.student, milestones: newMilestones } };
        });
      } else {
        const err = await res.json();
        alert(`Lỗi: ${err?.message || "Không thể cập nhật."}`);
      }
    } catch {
      alert("Lỗi kết nối. Vui lòng thử lại.");
    }
  };

  const handleOverrideSubmit = async () => {
    if (!overrideModal.milestoneId || !user?.userCode) return;
    if (overrideAction === "EXTEND_DEADLINE" && !overrideNewDeadline) return;
    setOverriding(true);
    try {
      const body: Record<string, unknown> = {
        action: overrideAction,
        reason: overrideReason || null,
        overriddenByUserCode: user.userCode,
        newDeadline: overrideAction === "EXTEND_DEADLINE" ? new Date(overrideNewDeadline).toISOString() : null,
      };
      const res = await fetch(`/api/ProgressMilestones/override-failure/${overrideModal.milestoneId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        alert(`Đã xử lý thành công! Mốc tiến độ đã được ${ overrideAction === "EXTEND_DEADLINE" ? "gia hạn" : "miễn trừ" }.`);
        setOverrideModal({ isOpen: false });
        setOverrideReason("");
        setOverrideNewDeadline("");
        // Reload data
        window.location.reload();
      } else {
        const err = await res.json();
        alert(`Lỗi: ${err?.message || "Không thể xử lý. Vui lòng thử lại."} `);
      }
    } catch {
      alert("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setOverriding(false);
    }
  };

  const openDetailModal = async (student: Student) => {
    setDetailModal({ isOpen: true, student });
    setLoadingDetail(true);

    // Fetch fresh data for the specific student when opening modal
    try {
      const [submissionsResp, milestonesResp, filesResp] = await Promise.all([
        fetchData<{ data: ProgressSubmission[] }>(`/ProgressSubmissions/get-list?StudentProfileCode=${student.studentCode}&DefenseTermId=${activeDefenseTermId}&Page=1&PageSize=100`),
        fetchData<{ data: ProgressMilestone[] }>(`/ProgressMilestones/get-list?TopicCode=${student.topic.topicCode}&Page=1&PageSize=100`),
        fetchData<{ data: SubmissionFile[] }>(`/SubmissionFiles/get-list?UploadedByUserCode=${student.studentCode}`),
      ]);

      const milestones = milestonesResp?.data || [];
      const topicMilestoneIds = milestones.map((m) => m.milestoneID);

      // Lọc các bản nộp theo đúng mốc tiến độ (milestoneID) của topic hiện tại
      const submissions = (submissionsResp?.data || []).filter((sub) =>
        topicMilestoneIds.includes(sub.milestoneID)
      );

      // Lọc các tệp tin theo đúng ID bản nộp của topic hiện tại trong đợt này
      const submissionIds = submissions.map((s) => s.submissionID);
      const allFiles = (filesResp?.data || []).filter((file) =>
        submissionIds.includes(file.submissionID)
      );

      const stats = calculateStats(milestones, submissions);

      setDetailModal((prev) => ({
        ...prev,
        student: {
          ...student,
          submissions,
          allFiles,
          milestones,
          stats,
        },
      }));
    } catch (err) {
      console.error("Failed to fetch detailed student data:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetailModal = () => {
    setDetailModal({ isOpen: false });
  };

  const getCurrentMilestone = (milestones: ProgressMilestone[]) => {
    if (milestones.length === 0) return null;

    // Sort milestones by ordinal
    const sortedMilestones = milestones.sort(
      (a, b) => (a.ordinal || 0) - (b.ordinal || 0),
    );

    // Find the first milestone that is not completed
    const currentMilestone = sortedMilestones.find(
      (m) => m.state !== "completed",
    );
    return currentMilestone || sortedMilestones[sortedMilestones.length - 1];
  };

  // Map API status to display status
  const mapApiStatusToDisplay = (apiStatus: string): Student["status"] => {
    const status = apiStatus.toLowerCase();
    switch (status) {
      case "đã duyệt":
        return "approved";
      case "đang chờ":
      case "chờ duyệt":
        return "pending";
      case "đủ điều kiện bảo vệ":
      case "waitingforcommittee":
        return "defense-ready";
      case "cần sửa đổi":
      case "revision":
        return "approved";
      case "đã phân hội đồng":
      case "phân hội đồng":
        return "committee-assigned";
      case "đã bảo vệ":
      case "hậu bảo vệ":
      case "đã chốt":
      case "finalized":
      case "completed":
      case "đã hoàn thành":
        return "post-defense";
      case "từ chối":
      case "rejected":
        return "pending";
      default:
        return "pending";
    }
  };

  // Calculate progress based on milestones
  const calculateProgress = (milestones: ProgressMilestone[]): number => {
    if (milestones.length === 0) return 0;

    const m = milestones[0];
    let completedCount = 0;
    const totalMilestones = milestoneTemplates.length > 0 ? milestoneTemplates.length : 4;

    for (let i = 1; i <= totalMilestones; i++) {
      const completedField = `completedAt${i}` as keyof ProgressMilestone;
      if (m[completedField]) completedCount++;
    }

    // If milestone is done or we are waiting for committee, it's essentially 100%
    if (m.state === "WaitingForCommittee") return 100;

    return Math.min(100, Math.round((completedCount / totalMilestones) * 100));
  };

  // Calculate detailed stats for student
  const calculateStats = (
    milestones: ProgressMilestone[],
    submissions: ProgressSubmission[],
  ) => {
    if (milestones.length === 0)
      return { onTimeRate: 100, revisionCount: 0, daysRemaining: null };

    // 1. Revision Count: Submissions that aren't the first attempt or required revisions
    const revisionCount = submissions.filter(
      (s) =>
        s.attemptNumber > 1 || s.lecturerState === "REVISION_REQUIRED",
    ).length;

    // 2. On Time Rate: Heuristic based on deadline vs submittedAt
    // (Simplified for demo purposes)
    const totalChecks = submissions.length;
    const onTimeCount = submissions.length; // Placeholder logic
    const onTimeRate =
      totalChecks > 0 ? Math.round((onTimeCount / totalChecks) * 100) : 100;

    // 3. Days Remaining to next deadline
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

  useEffect(() => {
    const fetchStudentsData = async () => {
      if (!user?.userCode) return;

      // Nếu chưa có đợt active, không tải dữ liệu — tránh hiển thị lẫn đợt cũ
      if (activeDefenseTermId == null) {
        setStudents([]);
        setLoading(false);
        setError("Chưa xác định được đợt bảo vệ hiện tại. Vui lòng chờ quản trị viên thiết lập đợt.");
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch topics supervised by lecturer + milestone templates (song song)
        // Lọc theo DefenseTermId để chỉ lấy đề tài của đợt hiện tại
        const [topicsResponse, templatesResponse] = await Promise.all([
          fetchData<{ data: Topic[] }>(`/Topics/get-list?SupervisorUserCode=${user.userCode}&DefenseTermId=${activeDefenseTermId}&PageSize=100`),
          fetchData<{ data: MilestoneTemplate[] }>(`/MilestoneTemplates/get-list?Page=1&PageSize=50&DefenseTermId=${activeDefenseTermId}`),
        ]);
        const topics: Topic[] = topicsResponse.data || [];
        // Lưu templates vào state để isStudentOverdue có thể dùng deadline thực của từng mốc
        setMilestoneTemplates((templatesResponse as { data: MilestoneTemplate[] }).data || []);

        // Process each topic to get student data and progress
        const studentsData: Student[] = await Promise.all(
          topics.map(async (topic) => {
            try {
              // Fetch student profile
              const studentResponse: { data: StudentProfile[] } =
                await fetchData(
                  `/StudentProfiles/get-list?StudentCode=${topic.proposerStudentCode}`,
                );
              const studentProfile: StudentProfile = studentResponse.data?.[0];

              // Fetch progress milestones
              const progressResponse: { data: ProgressMilestone[] } =
                await fetchData(
                  `/ProgressMilestones/get-list?TopicID=${topic.topicID}`,
                );
              const milestones: ProgressMilestone[] =
                progressResponse.data || [];
              const progress = calculateProgress(milestones);

              // Get last activity from topic/milestones
              const lastActivity = topic.lastUpdated;

              return {
                studentCode: topic.proposerStudentCode,
                studentName:
                  studentProfile?.fullName || topic.proposerStudentCode,
                email: studentProfile?.studentEmail || "",
                phone: studentProfile?.phoneNumber || "",
                topicTitle: topic.title,
                topicCode: topic.topicCode,
                registrationDate: topic.createdAt,
                status: mapApiStatusToDisplay(topic.status),
                progress,
                lastActivity,
                topic,
                studentProfile,
                milestones,
              };
            } catch (err) {
              console.error(
                `Error fetching data for topic ${topic.topicCode}:`,
                err,
              );
              // Return basic info if API calls fail
              return {
                studentCode: topic.proposerStudentCode,
                studentName: topic.proposerStudentCode,
                email: "",
                phone: "",
                topicTitle: topic.title,
                topicCode: topic.topicCode,
                registrationDate: topic.createdAt,
                status: mapApiStatusToDisplay(topic.status),
                progress: 0,
                lastActivity: topic.lastUpdated,
                topic,
              };
            }
          }),
        );

        setStudents(studentsData);
      } catch (err) {
        console.error("Failed to fetch students data:", err);
        setError("Không thể tải danh sách sinh viên. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    };

    fetchStudentsData();
  }, [user?.userCode, activeDefenseTermId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle size={16} color="#22C55E" />;
      case "pending":
        return <Clock size={16} color="#F59E0B" />;
      case "defense-ready":
        return <CheckCircle size={16} color="#10B981" />;
      case "committee-assigned":
        return <BookOpen size={16} color="#3B82F6" />;
      case "post-defense":
        return <Archive size={16} color="#F37021" />;
      default:
        return <Clock size={16} color="#6B7280" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "approved":
        return "Đã duyệt";
      case "pending":
        return "Đang chờ duyệt";
      case "defense-ready":
        return "Đủ điều kiện bảo vệ";
      case "committee-assigned":
        return "Đã phân hội đồng";
      case "post-defense":
        return "Hậu bảo vệ";
      default:
        return "Không xác định";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "#22C55E";
      case "pending":
        return "#F59E0B";
      case "defense-ready":
        return "#10B981";
      case "committee-assigned":
        return "#3B82F6";
      case "post-defense":
        return "#F37021";
      default:
        return "#6B7280";
    }
  };

  // Filter and sort students
  const filteredAndSortedStudents = students
    .filter((student) => {
      const matchesSearch =
        student.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.studentCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.topicTitle.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "overdue"
            ? isStudentOverdue(student)
            : student.status === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "name":
          comparison = a.studentName.localeCompare(b.studentName);
          break;
        case "progress":
          comparison = a.progress - b.progress;
          break;
        case "date":
          comparison =
            new Date(a.registrationDate).getTime() -
            new Date(b.registrationDate).getTime();
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

  const toggleSort = (field: "name" | "progress" | "date") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const totalCount = filteredAndSortedStudents.length;
  const pageCount = Math.ceil(totalCount / pageSize) || 1;
  const paginatedStudents = filteredAndSortedStudents.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="dashboard-root" style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      <style>{`
        :root {
          --primary: #F37021;
          --primary-light: #fff7ed;
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
          <Users size={32} color="#F37021" />
          Sinh viên hướng dẫn
        </h1>
        <p style={{ fontSize: "14px", color: "#666" }}>
          Quản lý và theo dõi tiến độ của các sinh viên đang hướng dẫn
        </p>
      </div>

      {error && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: "8px",
            padding: "16px",
            marginBottom: "24px",
            color: "#DC2626",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertCircle size={20} />
            <span style={{ fontWeight: "600" }}>Lỗi tải dữ liệu</span>
          </div>
          <p style={{ margin: "8px 0 0 28px" }}>{error}</p>
        </div>
      )}

      {loading ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px 20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "4px solid #F3F4F6",
              borderTop: "4px solid #F37021",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              marginBottom: "16px",
            }}
          />
          <p style={{ color: "#666", fontSize: "16px" }}>
            Đang tải danh sách sinh viên...
          </p>
        </div>
      ) : (
        <>
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
              <div style={{ flex: "1 1 300px", position: "relative" }}>
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
                  placeholder="Tìm kiếm sinh viên, mã SV, đề tài..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
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
                    e.currentTarget.style.borderColor = "#F37021";
                    e.currentTarget.style.boxShadow =
                      "0 0 0 3px rgba(243, 112, 33, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#D1D5DB";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              {/* Filter and View Toggle */}
              <div
                style={{ display: "flex", gap: "12px", alignItems: "center" }}
              >
                {/* Status Filter */}
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <Filter size={16} color="#6B7280" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #D1D5DB",
                      borderRadius: "8px",
                      fontSize: "14px",
                      cursor: "pointer",
                      outline: "none",
                      background: "white",
                    }}
                  >
                  <option value="all">Tất cả trạng thái</option>
                    <option value="overdue">⚠️ Quá hạn / Trễ tiến độ</option>
                    <option value="pending">Đang chờ duyệt</option>
                    <option value="approved">Đã duyệt</option>
                    <option value="defense-ready">Đủ điều kiện bảo vệ</option>
                    <option value="committee-assigned">Đã phân hội đồng</option>
                    <option value="post-defense">Hậu bảo vệ</option>
                  </select>
                </div>

                {/* View Toggle */}
                <div
                  style={{
                    display: "flex",
                    background: "#F3F4F6",
                    borderRadius: "8px",
                    padding: "4px",
                  }}
                >
                  <button
                    onClick={() => setViewMode("card")}
                    style={{
                      padding: "6px 12px",
                      background: viewMode === "card" ? "white" : "transparent",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "13px",
                      fontWeight: "500",
                      color: viewMode === "card" ? "#F37021" : "#6B7280",
                      transition: "all 0.2s ease",
                      boxShadow:
                        viewMode === "card"
                          ? "0 1px 3px rgba(0,0,0,0.1)"
                          : "none",
                    }}
                  >
                    <LayoutGrid size={16} />
                    Card
                  </button>
                  <button
                    onClick={() => setViewMode("table")}
                    style={{
                      padding: "6px 12px",
                      background:
                        viewMode === "table" ? "white" : "transparent",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "13px",
                      fontWeight: "500",
                      color: viewMode === "table" ? "#F37021" : "#6B7280",
                      transition: "all 0.2s ease",
                      boxShadow:
                        viewMode === "table"
                          ? "0 1px 3px rgba(0,0,0,0.1)"
                          : "none",
                    }}
                  >
                    <List size={16} />
                    Table
                  </button>
                </div>
              </div>
            </div>
          </div>

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
                <div className="stat-icon-wrapper" style={{ background: "rgba(243, 112, 33, 0.1)" }}>
                  <Users size={24} color="#F37021" />
                </div>
                <div style={{ fontSize: "14px", color: "#64748b", fontWeight: "600", marginBottom: "4px" }}>
                  Tổng sinh viên
                </div>
                <div style={{ fontSize: "32px", fontWeight: "800", color: "#1e293b" }}>
                  {students.length}
                </div>
              </div>
              <div style={{ height: "4px", background: "#F37021", borderRadius: "2px", width: "40%", marginTop: "12px" }} />
            </div>

            <div className="premium-card">
              <div>
                <div className="stat-icon-wrapper" style={{ background: "rgba(16, 185, 129, 0.1)" }}>
                  <CheckCircle size={24} color="#10B981" />
                </div>
                <div style={{ fontSize: "14px", color: "#64748b", fontWeight: "600", marginBottom: "4px" }}>
                  Đã duyệt đề tài
                </div>
                <div style={{ fontSize: "32px", fontWeight: "800", color: "#1e293b" }}>
                  {students.filter((s) => s.status === "approved").length}
                </div>
              </div>
              <div style={{ height: "4px", background: "#10B981", borderRadius: "2px", width: "40%", marginTop: "12px" }} />
            </div>

            <div className="premium-card">
              <div>
                <div className="stat-icon-wrapper" style={{ background: "rgba(139, 92, 246, 0.1)" }}>
                  <TrendingUp size={24} color="#8B5CF6" />
                </div>
                <div style={{ fontSize: "14px", color: "#64748b", fontWeight: "600", marginBottom: "4px" }}>
                  Đủ điều kiện bảo vệ
                </div>
                <div style={{ fontSize: "32px", fontWeight: "800", color: "#1e293b" }}>
                  {students.filter((s) => s.status === "defense-ready").length}
                </div>
              </div>
              <div style={{ height: "4px", background: "#8B5CF6", borderRadius: "2px", width: "40%", marginTop: "12px" }} />
            </div>

            <div className="premium-card">
              <div>
                <div className="stat-icon-wrapper" style={{ background: "rgba(59, 130, 246, 0.1)" }}>
                  <BookOpen size={24} color="#3B82F6" />
                </div>
                <div style={{ fontSize: "14px", color: "#64748b", fontWeight: "600", marginBottom: "4px" }}>
                  Đã phân hội đồng
                </div>
                <div style={{ fontSize: "32px", fontWeight: "800", color: "#1e293b" }}>
                  {students.filter((s) => s.status === "committee-assigned").length}
                </div>
              </div>
              <div style={{ height: "4px", background: "#3B82F6", borderRadius: "2px", width: "40%", marginTop: "12px" }} />
            </div>
          </div>

          {/* Students List */}
          {viewMode === "card" ? (
            <div style={{ display: "grid", gap: "16px" }}>
              {paginatedStudents.map((student) => {
                const overdue = isStudentOverdue(student);
                return (
                <div
                  key={student.studentCode}
                  style={{
                    background: overdue ? "linear-gradient(135deg, #fff5f5 0%, #fff 60%)" : "white",
                    border: overdue ? "2px solid #fecaca" : "1px solid #E5E7EB",
                    borderRadius: "12px",
                    padding: "24px",
                    boxShadow: overdue ? "0 2px 12px rgba(220,38,38,0.08)" : "0 2px 8px rgba(0,0,0,0.05)",
                    transition: "all 0.2s ease",
                    position: "relative",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = overdue
                      ? "0 8px 24px rgba(220,38,38,0.15)"
                      : "0 8px 24px rgba(0,0,0,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = overdue
                      ? "0 2px 12px rgba(220,38,38,0.08)"
                      : "0 2px 8px rgba(0,0,0,0.05)";
                  }}
                >
                  {/* Badge quá hạn */}
                  {overdue && (
                    <div style={{
                      position: "absolute", top: "12px", right: "12px",
                      background: "#dc2626", color: "white",
                      fontSize: "10px", fontWeight: "800", padding: "3px 10px",
                      borderRadius: "20px", letterSpacing: "0.05em",
                      display: "flex", alignItems: "center", gap: "4px",
                    }}>
                      <AlertCircle size={10} /> QUÁ HẠN
                    </div>
                  )}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      gap: "20px",
                      alignItems: "start",
                    }}
                  >
                    {/* Student Avatar */}
                    <div
                      style={{
                        width: "60px",
                        height: "60px",
                        borderRadius: "50%",
                        background:
                          "linear-gradient(135deg, #F37021 0%, #FF8838 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontSize: "20px",
                        fontWeight: "700",
                        boxShadow: "0 4px 12px rgba(243, 112, 33, 0.3)",
                        overflow: "hidden",
                      }}
                    >
                      {student.studentProfile?.studentImage ? (
                        <img
                          src={getAvatarUrl(
                            student.studentProfile.studentImage,
                          )}
                          alt={student.studentName}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            borderRadius: "50%",
                          }}
                          onError={(e) => {
                            // Fallback to initial if image fails to load
                            e.currentTarget.style.display = "none";
                            const parent = e.currentTarget.parentElement;
                            if (parent) {
                              parent.innerHTML = student.studentName.charAt(0);
                              parent.style.fontSize = "20px";
                              parent.style.fontWeight = "700";
                            }
                          }}
                        />
                      ) : (
                        student.studentName.charAt(0)
                      )}
                    </div>

                    {/* Student Info */}
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          marginBottom: "12px",
                        }}
                      >
                        <h3
                          style={{
                            fontSize: "18px",
                            fontWeight: "600",
                            color: "#1a1a1a",
                          }}
                        >
                          {student.studentName}
                        </h3>
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "4px 8px",
                            background: getStatusColor(student.status) + "20",
                            color: getStatusColor(student.status),
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "600",
                          }}
                        >
                          {getStatusIcon(student.status)}
                          {getStatusText(student.status)}
                        </span>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(250px, 1fr))",
                          gap: "16px",
                          marginBottom: "16px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <User size={14} color="#666" />
                          <span style={{ fontSize: "14px", color: "#666" }}>
                            Mã SV: <strong>{student.studentCode}</strong>
                          </span>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <Mail size={14} color="#666" />
                          <span style={{ fontSize: "14px", color: "#666" }}>
                            {student.email}
                          </span>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <Phone size={14} color="#666" />
                          <span style={{ fontSize: "14px", color: "#666" }}>
                            {student.phone}
                          </span>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <Calendar size={14} color="#666" />
                          <span style={{ fontSize: "14px", color: "#666" }}>
                            Đăng ký:{" "}
                            {new Date(
                              student.registrationDate,
                            ).toLocaleDateString("vi-VN")}
                          </span>
                        </div>
                      </div>

                      {/* Topic Info */}
                      <div
                        style={{
                          background: "#F9FAFB",
                          borderRadius: "8px",
                          padding: "16px",
                          marginBottom: "16px",
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
                          <BookOpen size={16} color="#F37021" />
                          <span
                            style={{
                              fontSize: "14px",
                              fontWeight: "600",
                              color: "#1a1a1a",
                            }}
                          >
                            Đề tài: {student.topicTitle}
                          </span>
                        </div>
                        <p
                          style={{
                            fontSize: "12px",
                            color: "#666",
                            margin: 0,
                          }}
                        >
                          Mã đề tài: {student.topicCode}
                        </p>
                      </div>

                      {/* Progress */}
                      <div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "8px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#666",
                              textTransform: "uppercase",
                            }}
                          >
                            Tiến độ
                          </span>
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#1a1a1a",
                            }}
                          >
                            {student.progress}%
                          </span>
                        </div>
                        <div
                          style={{
                            width: "100%",
                            height: "6px",
                            background: "#E5E7EB",
                            borderRadius: "3px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${student.progress}%`,
                              height: "100%",
                              background:
                                "linear-gradient(90deg, #F37021 0%, #FF8838 100%)",
                              borderRadius: "3px",
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                       <button
                        style={{
                          padding: "8px 16px",
                          background: "#F37021",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: "600",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#E55A1B";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#F37021";
                        }}
                        onClick={() => openDetailModal(student)}
                      >
                        Xem chi tiết
                      </button>
                      {/* Nút xử lý quá hạn — hiện khi overdue (kể cả chưa FAILED nhưng deadline đã qua) */}
                      {overdue && (() => {
                        const ctx = getOverdueContext(student);
                        if (!ctx) return null;
                        return (
                          <button
                            style={{
                              padding: "8px 16px",
                              background: "#fef2f2",
                              color: "#dc2626",
                              border: "1px solid #fecaca",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "700",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                            onClick={() => {
                              setOverrideModal({
                                isOpen: true,
                                milestoneId: ctx.milestoneId,
                                milestoneName: ctx.milestoneName,
                                studentName: student.studentName,
                                failureReason: ctx.failureReason,
                                failedAt: ctx.failedAt,
                                originalDeadline: ctx.originalDeadline,
                                currentOrdinal: ctx.ordinal,
                              });
                              setOverrideAction("EXTEND_DEADLINE");
                              setOverrideReason("");
                              setOverrideNewDeadline("");
                            }}
                          >
                            <ShieldAlert size={12} /> Xử lý quá hạn
                          </button>
                        );
                      })()}
                      {/* Nút cấp phép nộp muộn — hiện khi overdue */}
                      {overdue && (() => {
                        const ctx = getOverdueContext(student);
                        if (!ctx) return null;
                        const milestoneData = student.milestones?.[0];
                        const alreadyAllowed = milestoneData?.allowLateSubmit === true;
                        return alreadyAllowed ? (
                          <button
                            style={{
                              padding: "8px 16px",
                              background: "#f0fdf4",
                              color: "#16a34a",
                              border: "1px solid #bbf7d0",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "700",
                              cursor: "pointer",
                              display: "flex", alignItems: "center", gap: "6px",
                            }}
                            title="GV đã cấp phép — click để thu hồi"
                            onClick={() => handleAllowLateSubmit(ctx.milestoneId, false, student.studentName)}
                          >
                            ✅ Đã cho phép nộp muộn
                          </button>
                        ) : (
                          <button
                            style={{
                              padding: "8px 16px",
                              background: "#dcfce7",
                              color: "#15803d",
                              border: "1px solid #86efac",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "700",
                              cursor: "pointer",
                              display: "flex", alignItems: "center", gap: "6px",
                            }}
                            onClick={() => handleAllowLateSubmit(ctx.milestoneId, true, student.studentName)}
                          >
                            ⏰ Cho phép nộp muộn
                          </button>
                        );
                      })()}
                      <button
                        style={{
                          padding: "8px 16px",
                          background: "white",
                          color: "#F37021",
                          border: "1px solid #F37021",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: "600",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#FFF5F0";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "white";
                        }}
                      >
                        Nhắn tin
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            // Table View
            <div
              style={{
                background: "white",
                borderRadius: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                border: "1px solid #E5E7EB",
                overflow: "hidden",
              }}
            >
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr
                      style={{
                        background: "#F9FAFB",
                        borderBottom: "2px solid #E5E7EB",
                      }}
                    >
                      <th
                        style={{
                          padding: "16px",
                          textAlign: "left",
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "#374151",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                        onClick={() => toggleSort("name")}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          Sinh viên
                          <ArrowUpDown size={14} />
                        </div>
                      </th>
                      <th
                        style={{
                          padding: "16px",
                          textAlign: "left",
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "#374151",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Liên hệ
                      </th>
                      <th
                        style={{
                          padding: "16px",
                          textAlign: "left",
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "#374151",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Đề tài
                      </th>
                      <th
                        style={{
                          padding: "16px",
                          textAlign: "center",
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "#374151",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Trạng thái
                      </th>
                      <th
                        style={{
                          padding: "16px",
                          textAlign: "center",
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "#374151",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          cursor: "pointer",
                          userSelect: "none",
                          whiteSpace: "nowrap",
                        }}
                        onClick={() => toggleSort("progress")}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            justifyContent: "center",
                          }}
                        >
                          Tiến độ
                          <ArrowUpDown size={14} />
                        </div>
                      </th>
                      <th
                        style={{
                          padding: "16px",
                          textAlign: "center",
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "#374151",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          cursor: "pointer",
                          userSelect: "none",
                          whiteSpace: "nowrap",
                        }}
                        onClick={() => toggleSort("date")}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            justifyContent: "center",
                          }}
                        >
                          Ngày đăng ký
                          <ArrowUpDown size={14} />
                        </div>
                      </th>
                      <th
                        style={{
                          padding: "16px",
                          textAlign: "center",
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "#374151",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStudents.map((student, index) => (
                      <tr
                        key={student.studentCode}
                        style={{
                          borderBottom: "1px solid #E5E7EB",
                          background: index % 2 === 0 ? "white" : "#F9FAFB",
                          transition: "background 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#FFF5F0";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background =
                            index % 2 === 0 ? "white" : "#F9FAFB";
                        }}
                      >
                        {/* Student Info */}
                        <td style={{ padding: "16px" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                            }}
                          >
                            <div
                              style={{
                                width: "40px",
                                height: "40px",
                                borderRadius: "50%",
                                background:
                                  "linear-gradient(135deg, #F37021 0%, #FF8838 100%)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "white",
                                fontSize: "14px",
                                fontWeight: "700",
                                flexShrink: 0,
                                overflow: "hidden",
                              }}
                            >
                              {student.studentProfile?.studentImage ? (
                                <img
                                  src={getAvatarUrl(
                                    student.studentProfile.studentImage,
                                  )}
                                  alt={student.studentName}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    borderRadius: "50%",
                                  }}
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                    const parent =
                                      e.currentTarget.parentElement;
                                    if (parent) {
                                      parent.innerHTML =
                                        student.studentName.charAt(0);
                                      parent.style.fontSize = "14px";
                                      parent.style.fontWeight = "700";
                                    }
                                  }}
                                />
                              ) : (
                                student.studentName.charAt(0)
                              )}
                            </div>
                            <div>
                              <div
                                style={{
                                  fontSize: "14px",
                                  fontWeight: "600",
                                  color: "#1F2937",
                                }}
                              >
                                {student.studentName}
                              </div>
                              <div
                                style={{ fontSize: "12px", color: "#6B7280" }}
                              >
                                {student.studentCode}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td style={{ padding: "16px" }}>
                          <div style={{ fontSize: "13px", color: "#4B5563" }}>
                            <div style={{ marginBottom: "4px" }}>
                              {student.email}
                            </div>
                            <div style={{ color: "#9CA3AF" }}>
                              {student.phone}
                            </div>
                          </div>
                        </td>

                        {/* Topic */}
                        <td style={{ padding: "16px", maxWidth: "300px" }}>
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: "500",
                              color: "#1F2937",
                              marginBottom: "4px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                            }}
                          >
                            {student.topicTitle}
                          </div>
                          <div style={{ fontSize: "11px", color: "#9CA3AF" }}>
                            {student.topicCode}
                          </div>
                        </td>

                        {/* Status */}
                        <td style={{ padding: "16px", textAlign: "center" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "6px 12px",
                              background: getStatusColor(student.status) + "20",
                              color: getStatusColor(student.status),
                              borderRadius: "20px",
                              fontSize: "12px",
                              fontWeight: "600",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {getStatusIcon(student.status)}
                            {getStatusText(student.status)}
                          </span>
                        </td>

                        {/* Progress */}
                        <td style={{ padding: "16px" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                            }}
                          >
                            <div
                              style={{
                                flex: 1,
                                height: "6px",
                                background: "#E5E7EB",
                                borderRadius: "3px",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${student.progress}%`,
                                  height: "100%",
                                  background:
                                    "linear-gradient(90deg, #F37021 0%, #FF8838 100%)",
                                  borderRadius: "3px",
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: "12px",
                                fontWeight: "600",
                                color: "#374151",
                                minWidth: "35px",
                              }}
                            >
                              {student.progress}%
                            </span>
                          </div>
                        </td>

                        {/* Date */}
                        <td style={{ padding: "16px", textAlign: "center" }}>
                          <div style={{ fontSize: "13px", color: "#4B5563" }}>
                            {new Date(
                              student.registrationDate,
                            ).toLocaleDateString("vi-VN")}
                          </div>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "16px", textAlign: "center" }}>
                          <button
                            onClick={() => openDetailModal(student)}
                            style={{
                              padding: "6px 12px",
                              background: "#F37021",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "600",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                              whiteSpace: "nowrap",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#E55A1B";
                              e.currentTarget.style.transform =
                                "translateY(-1px)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "#F37021";
                              e.currentTarget.style.transform = "translateY(0)";
                            }}
                          >
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {totalCount > 0 && (
            <div style={{ marginTop: "24px" }}>
              <TablePagination
                totalCount={totalCount}
                page={page}
                pageCount={pageCount}
                pageSize={pageSize}
                onPageChange={(nextPage) => setPage(nextPage)}
                onPageSizeChange={(nextPageSize) => {
                  setPageSize(nextPageSize);
                  setPage(1);
                }}
              />
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {detailModal.isOpen && detailModal.student && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
            animation: "modalFadeIn 0.3s ease-out",
          }}
          onClick={closeDetailModal}
        >
          <style>{`
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
            .progress-ring {
              transform: rotate(-90deg);
            }
            .progress-ring circle {
              transition: stroke-dashoffset 0.5s ease;
            }
            .custom-scrollbar::-webkit-scrollbar {
              width: 6px;
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
          <div
            className="modal-content smooth-scroll"
            style={{
              background: "white",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "1100px",
              maxHeight: "90vh",
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
              {loadingDetail && !detailModal.student.submissions ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "400px", gap: "16px" }}>
                   <div style={{ width: "40px", height: "40px", border: "4px solid #f3f4f6", borderTop: "4px solid #F37021", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                   <p style={{ color: "#64748b", fontWeight: "600" }}>Đang tải dữ liệu chi tiết...</p>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(10, 1fr)",
                    minHeight: "100%",
                  }}
                >
                  {/* --- LEFT: TOPIC DETAILS & PROGRESS (7 cols) --- */}
                  <div
                    style={{
                      gridColumn: "span 7",
                      padding: "40px",
                      backgroundColor: "white",
                    }}
                  >
                    <div style={{ marginBottom: "40px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          marginBottom: "16px",
                        }}
                      >
                        <span
                          style={{
                            padding: "6px 12px",
                            background:
                              getStatusColor(detailModal.student.status) + "15",
                            color: getStatusColor(detailModal.student.status),
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
                          {getStatusIcon(detailModal.student.status)}
                          {getStatusText(detailModal.student.status)}
                        </span>
                        <span
                          style={{
                            fontSize: "12px",
                            color: "#94a3b8",
                            fontWeight: "600",
                          }}
                        >
                          Mã đề tài: {detailModal.student.topicCode}
                        </span>
                      </div>
                      <h2
                        style={{
                          fontSize: "32px",
                          fontWeight: "800",
                          color: "#0f172a",
                          lineHeight: "1.2",
                          marginBottom: "16px",
                        }}
                      >
                        {detailModal.student.topicTitle}
                      </h2>
                    </div>

                    {/* Summary Section */}
                    <div
                      style={{
                        background: "#f8fafc",
                        padding: "32px",
                        borderRadius: "24px",
                        border: "1px solid #f1f5f9",
                        marginBottom: "32px",
                      }}
                    >
                      <h3
                        style={{
                          fontSize: "14px",
                          fontWeight: "800",
                          color: "#64748b",
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          marginBottom: "16px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <BookOpen size={18} color="#f37021" />
                        Mô tả đề tài
                      </h3>
                      <p
                        style={{
                          fontSize: "15px",
                          color: "#334155",
                          lineHeight: "1.8",
                          margin: 0,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {detailModal.student.topic?.summary ||
                          "Không có mô tả chi tiết cho đề tài này."}
                      </p>
                    </div>

                    {/* Quick Stats Section */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: "16px",
                        marginBottom: "40px",
                      }}
                    >
                      <div
                        style={{
                          padding: "20px",
                          background: "white",
                          borderRadius: "20px",
                          border: "1px solid #f1f5f9",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                          display: "flex",
                          alignItems: "center",
                          gap: "16px",
                        }}
                      >
                        <div
                          style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "14px",
                            background: "rgba(16, 185, 129, 0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#10b981",
                          }}
                        >
                          <TrendingUp size={24} />
                        </div>
                        <div>
                          <div style={{ fontSize: "11px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase" }}>Nộp đúng hạn</div>
                          <div style={{ fontSize: "20px", fontWeight: "900", color: "#0f172a" }}>{detailModal.student.stats?.onTimeRate ?? 100}%</div>
                        </div>
                      </div>

                      <div
                        style={{
                          padding: "20px",
                          background: "white",
                          borderRadius: "20px",
                          border: "1px solid #f1f5f9",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                          display: "flex",
                          alignItems: "center",
                          gap: "16px",
                        }}
                      >
                        <div
                          style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "14px",
                            background: "rgba(245, 158, 11, 0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#f59e0b",
                          }}
                        >
                          <RotateCcw size={24} />
                        </div>
                        <div>
                          <div style={{ fontSize: "11px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase" }}>Số lần sửa</div>
                          <div style={{ fontSize: "20px", fontWeight: "900", color: "#0f172a" }}>{detailModal.student.stats?.revisionCount ?? 0}</div>
                        </div>
                      </div>

                      <div
                        style={{
                          padding: "20px",
                          background: "white",
                          borderRadius: "20px",
                          border: "1px solid #f1f5f9",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                          display: "flex",
                          alignItems: "center",
                          gap: "16px",
                        }}
                      >
                        <div
                          style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "14px",
                            background: "rgba(59, 130, 246, 0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#3b82f6",
                          }}
                        >
                          <Clock size={24} />
                        </div>
                        <div>
                          <div style={{ fontSize: "11px", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase" }}>Ngày còn lại</div>
                          <div style={{ fontSize: "20px", fontWeight: "900", color: "#0f172a" }}>
                            {detailModal.student.stats?.daysRemaining !== undefined && detailModal.student.stats?.daysRemaining !== null 
                              ? `${detailModal.student.stats.daysRemaining} ngày` 
                              : "---"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 1. Visual Timeline Section */}
                    <div style={{ marginBottom: "40px" }}>
                      <h3
                        style={{
                          fontSize: "14px",
                          fontWeight: "800",
                          color: "#64748b",
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          marginBottom: "24px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <Activity size={18} color="#f37021" />
                        Lộ trình thực hiện
                      </h3>
                      <div style={{ display: "flex", alignItems: "flex-start", padding: "0 10px" }}>
                        {(() => {
                          const mainMilestone = detailModal.student?.milestones?.[0];
                          const currentState = mainMilestone?.state;
                          const milestoneList = milestoneTemplates.length > 0 
                            ? milestoneTemplates.map(t => ({
                                code: t.milestoneTemplateCode,
                                name: t.name.replace("Đăng ký đề tài", "Đăng ký").replace("Nộp đề cương", "Đề cương").replace("Nộp báo cáo tiến độ", "Báo cáo").replace("Báo cáo hoàn thành", "Hoàn thiện").replace("Báo cáo hoàn chỉnh", "Khóa luận hoàn chỉnh")
                              }))
                            : [
                                { code: "MS_REG", name: "Đăng ký" },
                                { code: "MS_PROG1", name: "Đề cương" },
                                { code: "MS_PROG2", name: "Báo cáo" },
                                { 
                                  code: "MS_FULL", 
                                  name: currentState === "WaitingForCommittee" ? "Khóa luận hoàn chỉnh" : "Hoàn thiện" 
                                }
                              ];

                          const totalM = milestoneList.length;
                          const completedArray = [];
                          for (let i = 1; i <= totalM; i++) {
                            const completedAtKey = `completedAt${i}` as keyof ProgressMilestone;
                            completedArray.push(mainMilestone ? mainMilestone[completedAtKey] : null);
                          }

                          const firstNotCompletedIdx = completedArray.findIndex(val => !val);

                          return milestoneList.map((m, idx) => {
                            const completedAtKey = `completedAt${idx + 1}`;
                            const completedAtValue = mainMilestone ? (mainMilestone as any)[completedAtKey] : null;
                            let isCompleted = !!completedAtValue;
                            
                            if (idx === totalM - 1 && currentState === "WaitingForCommittee") {
                              isCompleted = true;
                            }

                            let isCurrent = false;
                            if (firstNotCompletedIdx === idx && currentState !== "WaitingForCommittee") {
                              isCurrent = true;
                            }

                            return (
                              <React.Fragment key={m.code || idx}>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, position: "relative" }}>
                                  <div
                                    style={{
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
                                    }}
                                  >
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
                                {idx < totalM - 1 && (
                                  <div
                                    style={{
                                      flex: 1,
                                      height: "4px",
                                      backgroundColor: !!(mainMilestone as any)?.[`completedAt${idx + 2}`] 
                                        ? "#10b981" 
                                        : isCompleted 
                                          ? "#f37021" 
                                          : "#f1f5f9",
                                      marginTop: "18px",
                                      marginRight: "-20px",
                                      marginLeft: "-20px",
                                      zIndex: 1,
                                      transition: "background-color 0.3s ease",
                                    }}
                                  />
                                )}
                              </React.Fragment>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* Unified Submission & Feedback History Section */}
                    <div style={{ marginBottom: "40px" }}>
                      <h3
                        style={{
                          fontSize: "14px",
                          fontWeight: "800",
                          color: "#64748b",
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          marginBottom: "20px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <Archive size={18} color="#f37021" />
                        Theo dõi Tiến độ & Bài nộp
                      </h3>
                      <div 
                        style={{ 
                          background: "white", 
                          borderRadius: "24px", 
                          border: "1px solid #f1f5f9", 
                          overflowX: "auto",
                          overflowY: "auto",
                          maxHeight: "420px",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)"
                        }}
                        className="custom-scrollbar"
                      >
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
                            {detailModal.student.submissions && detailModal.student.submissions.length > 0 ? (
                              detailModal.student.submissions
                                .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
                                .map((sub, idx) => {
                                  const subFiles = detailModal.student?.allFiles?.filter(f => f.submissionID === sub.submissionID) || [];
                                  
                                  return (
                                    <tr key={sub.submissionID} style={{ borderBottom: idx === (detailModal.student?.submissions?.length || 0) - 1 ? "none" : "1px solid #f8fafc" }}>
                                      <td style={{ padding: "16px" }}>
                                        <div style={{ fontSize: "13px", fontWeight: "800", color: "#1e293b" }}>
                                          {(() => {
                                            const tmpl = milestoneTemplates.find(t => t.ordinal === sub.ordinal);
                                            if (tmpl) return tmpl.name;
                                            return sub.ordinal === 1 ? "Đăng ký đề tài" :
                                                   sub.ordinal === 2 ? "Đề cương" :
                                                   sub.ordinal === 3 ? "Báo cáo" :
                                                   sub.ordinal === 4 ? "Hoàn thiện khóa luận" :
                                                   sub.ordinal === 5 ? "Bảo vệ luận văn" :
                                                   sub.milestoneCode || `Mốc ${sub.ordinal}`;
                                          })()}
                                        </div>
                                        <div style={{ fontSize: "11px", fontWeight: "600", color: "#94a3b8" }}>Lần nộp: {sub.attemptNumber}</div>
                                      </td>
                                      <td style={{ padding: "16px" }}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                          {subFiles.length > 0 ? subFiles.map(file => (
                                            <div key={file.fileID} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                              <FileText size={14} color="#3b82f6" />
                                              <span 
                                                style={{ fontSize: "12px", fontWeight: "700", color: "#334155", cursor: "pointer", textDecoration: "underline" }}
                                                onClick={() => window.open(normalizeUrl(file.fileURL), '_blank')}
                                              >
                                                {file.fileName}
                                              </span>
                                            </div>
                                          )) : (
                                            <span style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>Không có file</span>
                                          )}
                                        </div>
                                      </td>
                                      <td style={{ padding: "16px", fontSize: "13px", color: "#64748b", fontWeight: "600" }}>
                                        {new Date(sub.submittedAt).toLocaleDateString("vi-VN")}
                                      </td>
                                      <td style={{ padding: "16px" }}>
                                        <span 
                                          style={{ 
                                            fontSize: "11px", 
                                            fontWeight: "800", 
                                            padding: "4px 10px", 
                                            borderRadius: "20px",
                                            background: sub.lecturerState === "APPROVED" ? "#ecfdf5" : sub.lecturerState === "REVISION_REQUIRED" ? "#fff7ed" : "#f1f5f9",
                                            color: sub.lecturerState === "APPROVED" ? "#059669" : sub.lecturerState === "REVISION_REQUIRED" ? "#d97706" : "#64748b",
                                            border: `1px solid ${sub.lecturerState === "APPROVED" ? "#10b98120" : sub.lecturerState === "REVISION_REQUIRED" ? "#f59e0b20" : "#e2e8f0"}`
                                          }}
                                        >
                                          {sub.lecturerState === "APPROVED" ? "Đã duyệt" : sub.lecturerState === "REVISION_REQUIRED" ? "Cần sửa" : sub.lecturerState || "Đang chờ"}
                                        </span>
                                      </td>
                                      <td style={{ padding: "16px" }}>
                                        {sub.lecturerComment ? (
                                          <div style={{ fontSize: "13px", color: "#334155", lineHeight: "1.5", fontWeight: "500", background: "#f8fafc", padding: "12px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
                                            {sub.lecturerComment}
                                            <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "4px", fontWeight: "800", textTransform: "uppercase" }}>
                                              Mức độ: {sub.feedbackLevel}
                                            </div>
                                          </div>
                                        ) : (
                                          <span style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>Chưa có nhận xét</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })
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
                  </div>

                  {/* --- RIGHT: STUDENT PROFILE (3 cols) --- */}
                  <div
                    style={{
                      gridColumn: "span 3",
                      backgroundColor: "#f8fafc",
                      padding: "40px",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div style={{ textAlign: "center", marginBottom: "40px" }}>
                      <div
                        style={{
                          position: "relative",
                          display: "inline-block",
                          marginBottom: "24px",
                        }}
                      >
                        <div
                          style={{
                            width: "128px",
                            height: "128px",
                            borderRadius: "32px",
                            border: "4px solid white",
                            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
                            overflow: "hidden",
                            backgroundColor: "#003D82",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                          }}
                        >
                          {detailModal.student.studentProfile?.studentImage ? (
                            <img
                              src={getAvatarUrl(
                                detailModal.student.studentProfile.studentImage,
                              )}
                              alt={detailModal.student.studentName}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <User size={56} color="white" />
                          )}
                        </div>
                      </div>
                      <h3
                        style={{
                          fontSize: "22px",
                          fontWeight: "900",
                          color: "#0f172a",
                          lineHeight: "1.2",
                          marginBottom: "6px",
                        }}
                      >
                        {detailModal.student.studentName}
                      </h3>
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
                            color: "#f37021",
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                          }}
                        >
                          Mã SV: {detailModal.student.studentCode}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: "12px" }}>
                      {[
                        {
                          icon: <Mail size={16} />,
                          label: "Email",
                          value: detailModal.student.email || "---",
                        },
                        {
                          icon: <Phone size={16} />,
                          label: "SĐT",
                          value: detailModal.student.phone || "---",
                        },
                        {
                          icon: <Users size={16} />,
                          label: "Lớp",
                          value:
                            detailModal.student.studentProfile?.classCode ||
                            "---",
                        },
                        {
                          icon: <BookOpen size={16} />,
                          label: "Học lực",
                          value:
                            detailModal.student.studentProfile?.academicStanding ||
                            (detailModal.student.studentProfile?.gpa 
                              ? (detailModal.student.studentProfile.gpa >= 3.6 ? "Xuất sắc" : 
                                 detailModal.student.studentProfile.gpa >= 3.2 ? "Giỏi" : 
                                 detailModal.student.studentProfile.gpa >= 2.5 ? "Khá" : "Trung bình")
                              : "---"),
                        },
                        {
                          icon: <TrendingUp size={16} />,
                          label: "GPA",
                          value: detailModal.student.studentProfile?.gpa?.toFixed(2) || "---",
                        },
                        {
                          icon: <Calendar size={16} />,
                          label: "Ngày đăng ký",
                          value: detailModal.student.registrationDate ? new Date(
                            detailModal.student.registrationDate,
                          ).toLocaleDateString("vi-VN") : "---",
                        },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: "16px",
                            backgroundColor: "white",
                            borderRadius: "16px",
                            border: "1px solid #f1f5f9",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              color: "#94a3b8",
                            }}
                          >
                            {item.icon}
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: "900",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                              }}
                            >
                              {item.label}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: "13px",
                              fontWeight: "700",
                              color: "#334155",
                              wordBreak: "break-all",
                            }}
                          >
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>


                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          OVERRIDE FAILURE MODAL — Xử lý mốc bị FAILED
      ============================================================ */}
      {overrideModal.isOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(15,23,42,0.65)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
        }}>
          <div style={{
            background: "#fff", borderRadius: "24px", width: "100%", maxWidth: "520px",
            boxShadow: "0 25px 60px rgba(0,0,0,0.2)", overflow: "hidden",
            animation: "fadeInUp 0.25s ease",
          }}>
            {/* Header */}
            <div style={{
              background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
              padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "white" }}>
                  <ShieldAlert size={20} />
                  <span style={{ fontWeight: "800", fontSize: "16px" }}>Xử lý mốc tiến độ thất bại</span>
                </div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)", marginTop: "4px" }}>
                  SV: <strong>{overrideModal.studentName}</strong> — {overrideModal.milestoneName}
                </div>
              </div>
              <button onClick={() => setOverrideModal({ isOpen: false })}
                style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", padding: "6px", cursor: "pointer", color: "white" }}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* === Context panel: T\u00ecnh tr\u1ea1ng SV === */}
              <div style={{
                background: "#fef2f2", border: "1px solid #fecaca",
                borderRadius: "12px", padding: "14px 16px",
              }}>
                <div style={{ fontSize: "11px", fontWeight: "800", color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>
                  📋 T\u00ecnh tr\u1ea1ng hi\u1ec7n t\u1ea1i
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div>
                    <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "700", marginBottom: "2px" }}>M\u1ed1c ti\u1ebfn \u0111\u1ed9</div>
                    <div style={{ fontSize: "13px", fontWeight: "800", color: "#1e293b" }}>
                      {overrideModal.milestoneName}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "700", marginBottom: "2px" }}>Deadline g\u1ed1c</div>
                    <div style={{ fontSize: "13px", fontWeight: "800", color: "#dc2626" }}>
                      {overrideModal.originalDeadline
                        ? new Date(overrideModal.originalDeadline).toLocaleDateString("vi-VN")
                        : "Kh\u00f4ng r\u00f5"}
                      {overrideModal.originalDeadline && new Date(overrideModal.originalDeadline) < new Date() && (
                        <span style={{ fontSize: "10px", color: "#ef4444", marginLeft: "6px" }}>
                          ({Math.floor((new Date().getTime() - new Date(overrideModal.originalDeadline).getTime()) / 86400000)} ng\u00e0y tr\u01b0\u1edbc)
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "700", marginBottom: "2px" }}>Tr\u1ea1ng th\u00e1i</div>
                    <div style={{ fontSize: "12px", fontWeight: "700" }}>
                      {overrideModal.failureReason
                        ? <span style={{ color: "#dc2626" }}>❌ \u0110\u00e3 b\u1ecb \u0111\u00e1nh d\u1ea5u FAILED</span>
                        : <span style={{ color: "#f59e0b" }}>⚠\ufe0f Qu\u00e1 deadline (ch\u01b0a FAILED)</span>}
                    </div>
                  </div>
                  {overrideModal.failedAt && (
                    <div>
                      <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "700", marginBottom: "2px" }}>Th\u1eddi \u0111i\u1ec3m FAILED</div>
                      <div style={{ fontSize: "12px", fontWeight: "700", color: "#64748b" }}>
                        {new Date(overrideModal.failedAt).toLocaleString("vi-VN")}
                      </div>
                    </div>
                  )}
                </div>
                {overrideModal.failureReason && (
                  <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #fecaca" }}>
                    <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "700", marginBottom: "4px" }}>L\u00dd DO TH\u1ea4T B\u1ea0I</div>
                    <div style={{
                      fontSize: "12px", fontWeight: "700", color: "#b91c1c",
                      background: "#fff", padding: "6px 10px", borderRadius: "6px", border: "1px solid #fecaca",
                    }}>
                      {overrideModal.failureReason.includes("ABSENT")
                        ? "🚫 Sinh vi\u00ean b\u1ecf kh\u00f4ng n\u1ed9p b\u00e1o c\u00e1o (Absent)"
                        : overrideModal.failureReason.includes("ABANDONED_REVISION")
                          ? "🔄 Sinh vi\u00ean b\u1ecf kh\u00f4ng s\u1eeda b\u00e1o c\u00e1o sau khi b\u1ecb y\u00eau c\u1ea7u ch\u1ec9nh s\u1eeda"
                          : overrideModal.failureReason}
                    </div>
                  </div>
                )}
              </div>

              {/* Ch\u1ecdn h\u00e0nh \u0111\u1ed9ng */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "8px" }}>
                  Hành động xử lý *
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                  <button
                    onClick={() => setOverrideAction("EXTEND_DEADLINE")}
                    style={{
                      padding: "12px 10px", borderRadius: "12px", border: "2px solid",
                      borderColor: overrideAction === "EXTEND_DEADLINE" ? "#F37021" : "#e2e8f0",
                      background: overrideAction === "EXTEND_DEADLINE" ? "#fff7ed" : "#f8fafc",
                      cursor: "pointer", textAlign: "left", transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                      <CalendarClock size={14} color={overrideAction === "EXTEND_DEADLINE" ? "#F37021" : "#94a3b8"} />
                      <span style={{ fontWeight: "800", fontSize: "12px", color: overrideAction === "EXTEND_DEADLINE" ? "#F37021" : "#64748b" }}>Gia hạn</span>
                    </div>
                    <p style={{ fontSize: "10px", color: "#94a3b8", margin: 0 }}>Reset deadline, SV nộp lại</p>
                  </button>
                  <button
                    onClick={() => setOverrideAction("EXEMPT")}
                    style={{
                      padding: "12px 10px", borderRadius: "12px", border: "2px solid",
                      borderColor: overrideAction === "EXEMPT" ? "#10b981" : "#e2e8f0",
                      background: overrideAction === "EXEMPT" ? "#f0fdf4" : "#f8fafc",
                      cursor: "pointer", textAlign: "left", transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                      <ShieldCheck size={14} color={overrideAction === "EXEMPT" ? "#10b981" : "#94a3b8"} />
                      <span style={{ fontWeight: "800", fontSize: "12px", color: overrideAction === "EXEMPT" ? "#10b981" : "#64748b" }}>Miễn trừ</span>
                    </div>
                    <p style={{ fontSize: "10px", color: "#94a3b8", margin: 0 }}>Bỏ qua mốc, pipeline tiếp tục</p>
                  </button>
                  <button
                    onClick={() => setOverrideAction("MARK_INELIGIBLE")}
                    style={{
                      padding: "12px 10px", borderRadius: "12px", border: "2px solid",
                      borderColor: overrideAction === "MARK_INELIGIBLE" ? "#7c3aed" : "#e2e8f0",
                      background: overrideAction === "MARK_INELIGIBLE" ? "#f5f3ff" : "#f8fafc",
                      cursor: "pointer", textAlign: "left", transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                      <ShieldAlert size={14} color={overrideAction === "MARK_INELIGIBLE" ? "#7c3aed" : "#94a3b8"} />
                      <span style={{ fontWeight: "800", fontSize: "12px", color: overrideAction === "MARK_INELIGIBLE" ? "#7c3aed" : "#64748b" }}>Không đủ ĐKBV</span>
                    </div>
                    <p style={{ fontSize: "10px", color: "#94a3b8", margin: 0 }}>Xét không đủ điều kiện bảo vệ</p>
                  </button>
                </div>
              </div>

              {/* Deadline mới — chỉ hiện khi EXTEND_DEADLINE */}
              {overrideAction === "EXTEND_DEADLINE" && (
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "8px" }}>
                    Deadline mới *
                  </label>
                  <input
                    type="datetime-local"
                    value={overrideNewDeadline}
                    onChange={(e) => setOverrideNewDeadline(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    style={{
                      width: "100%", padding: "10px 14px", border: "2px solid #e2e8f0",
                      borderRadius: "10px", fontSize: "14px", fontWeight: "600", outline: "none",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#F37021"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; }}
                  />
                  <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "6px" }}>Phải là thời điểm trong tương lai. SV sẽ được nộp báo cáo lại.</p>
                </div>
              )}

              {/* Lý do */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "8px" }}>
                  Lý do / Ghi chú
                </label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Nhập lý do xử lý để lưu vào audit trail..."
                  rows={3}
                  style={{
                    width: "100%", padding: "10px 14px", border: "2px solid #e2e8f0",
                    borderRadius: "10px", fontSize: "13px", resize: "vertical", outline: "none",
                    boxSizing: "border-box", fontFamily: "inherit",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#F37021"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; }}
                />
              </div>

              {/* Info box */}
              <div style={{
                padding: "12px 14px",
                background: overrideAction === "MARK_INELIGIBLE" ? "#fdf4ff" : "#fef3c7",
                border: `1px solid ${overrideAction === "MARK_INELIGIBLE" ? "#e9d5ff" : "#fde68a"}`,
                borderRadius: "10px", fontSize: "12px",
                color: overrideAction === "MARK_INELIGIBLE" ? "#6b21a8" : "#92400e",
              }}>
                {overrideAction === "MARK_INELIGIBLE"
                  ? "🔒 Hành động này sẽ đánh dấu đề tài là KHÔNG ĐỦ ĐIỀU KIỆN BẢO VỆ. SV sẽ không thể tiếp tục nộp báo cáo. Có thể đảo ngược bằng Gia hạn."
                  : "\u26a0\ufe0f Hành động này sẽ được ghi nhận vào lịch sử audit với tên giảng viên thực hiện."}
                {overrideAction === "EXEMPT" && " SV được miễn trừ sẽ được tính là hoàn thành mốc này."}
                {overrideAction === "EXTEND_DEADLINE" && " Mốc sẽ reset về trạng thái Pending với deadline mới."}
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setOverrideModal({ isOpen: false })}
                  disabled={overriding}
                  style={{
                    padding: "10px 20px", background: "#f1f5f9", color: "#64748b",
                    border: "none", borderRadius: "10px", fontWeight: "700", cursor: "pointer",
                  }}
                >
                  Hủy
                </button>
                <button
                  onClick={handleOverrideSubmit}
                  disabled={overriding || (overrideAction === "EXTEND_DEADLINE" && !overrideNewDeadline)}
                  style={{
                    padding: "10px 24px",
                    background: overrideAction === "EXEMPT" ? "#10b981"
                      : overrideAction === "MARK_INELIGIBLE" ? "#7c3aed"
                      : "#F37021",
                    color: "white", border: "none", borderRadius: "10px",
                    fontWeight: "800", fontSize: "13px", cursor: "pointer",
                    opacity: (overriding || (overrideAction === "EXTEND_DEADLINE" && !overrideNewDeadline)) ? 0.5 : 1,
                    display: "flex", alignItems: "center", gap: "6px",
                  }}
                >
                  {overrideAction === "EXEMPT" ? <ShieldCheck size={14} />
                    : overrideAction === "MARK_INELIGIBLE" ? <ShieldAlert size={14} />
                    : <CalendarClock size={14} />}
                  {overriding ? "Đang xử lý..."
                    : overrideAction === "EXEMPT" ? "Xác nhận Miễn trừ"
                    : overrideAction === "MARK_INELIGIBLE" ? "Xác nhận Không đủ ĐKBV"
                    : "Xác nhận Gia hạn"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default LecturerStudents;
