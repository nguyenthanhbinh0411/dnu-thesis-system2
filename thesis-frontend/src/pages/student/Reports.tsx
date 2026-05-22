import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Upload,
  FileText,
  Calendar,
  Clock,
  ClipboardList,
  Download,
  User as UserIcon,
  BookOpen,
  Award,
  CheckCircle2,
  X,
  Eye,
  MessageSquare,
  ChevronRight,
  TrendingUp,
  Target,
  CheckCircle,
  LayoutGrid,
  AlertCircle,
  XCircle,
  Link as LinkIcon,
  ExternalLink,
  Send,
} from "lucide-react";
import { useToast } from "../../context/useToast";
import { fetchData, normalizeUrl } from "../../api/fetchData";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { getAccessToken } from "../../services/auth-session.service";
import type { ApiResponse } from "../../types/api";
import type { SubmissionFile } from "../../types/submissionFile";
import type { Report } from "../../types/report";
import type { Topic } from "../../types/topic";
import type { LecturerProfile } from "../../types/lecturer";
import type { MilestoneTemplate } from "../../types/milestoneTemplate";
import type {
  ReportAggregateTag,
  StudentDashboardPayload,
  StudentProgressHistoryPayload,
  StudentProgressHistorySubmission,
  StudentProgressSubmitPayload,
  StudentReportAggregateMilestone,
  StudentReportAggregateSupervisor,
  StudentReportAggregateTopic,
} from "../../types/report-aggregate";

const mapAggregateTopicToTopic = (
  topic: StudentReportAggregateTopic,
): Topic => ({
  topicID: topic.topicID,
  topicCode: topic.topicCode,
  title: topic.title,
  summary: topic.summary,
  type: topic.type,
  proposerUserID: 0,
  proposerUserCode: "",
  proposerStudentProfileID: 0,
  proposerStudentCode: "",
  supervisorUserID: null,
  supervisorUserCode: topic.supervisorLecturerCode,
  supervisorLecturerProfileID: null,
  supervisorLecturerCode: topic.supervisorLecturerCode,
  catalogTopicID: null,
  catalogTopicCode: topic.catalogTopicCode,
  departmentID: null,
  departmentCode: null,
  status: topic.status,
  resubmitCount: null,
  createdAt: topic.createdAt,
  lastUpdated: topic.lastUpdated,
  tagID: null,
  tagCode: null,
});

const mapAggregateSupervisorToLecturer = (
  supervisor: StudentReportAggregateSupervisor,
): LecturerProfile => ({
  lecturerProfileID: supervisor.lecturerProfileID,
  lecturerCode: supervisor.lecturerCode,
  userCode: "",
  departmentCode: supervisor.departmentCode,
  degree: supervisor.degree,
  guideQuota: 0,
  defenseQuota: 0,
  currentGuidingCount: 0,
  gender: "",
  dateOfBirth: "",
  email: supervisor.email,
  phoneNumber: supervisor.phoneNumber,
  profileImage: "",
  address: "",
  notes: "",
  fullName: supervisor.fullName,
  createdAt: "",
  lastUpdated: null,
});

const mapHistorySubmissionToReport = (
  submission: StudentProgressHistorySubmission,
): Report => ({
  submissionID: submission.submissionID,
  submissionCode: submission.submissionCode,
  milestoneID: submission.milestoneID,
  milestoneCode: submission.milestoneCode,
  ordinal: submission.ordinal ?? null,
  studentUserID: 0,
  studentUserCode: submission.studentUserCode,
  studentProfileID: 0,
  studentProfileCode: submission.studentProfileCode || "",
  lecturerProfileID: null,
  lecturerCode: submission.lecturerCode,
  submittedAt: submission.submittedAt,
  attemptNumber: submission.attemptNumber,
  lecturerComment: submission.lecturerComment || undefined,
  lecturerState: submission.lecturerState || undefined,
  feedbackLevel: submission.feedbackLevel || undefined,
  reportTitle: submission.reportTitle,
  reportDescription: submission.reportDescription,
  lastUpdated: submission.lastUpdated,
  files: submission.files || [],
});

const Reports: React.FC = () => {
  const auth = useAuth();
  const { addToast } = useToast();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<{ name: string; url: string }[]>([]);
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkName, setNewLinkName] = useState("");
  const [reportTitle, setReportTitle] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [lateReason, setLateReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [canSubmit, setCanSubmit] = useState(true);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [lecturerProfile, setLecturerProfile] = useState<LecturerProfile | null>(null);
  const [currentMilestone, setCurrentMilestone] = useState<StudentReportAggregateMilestone | null>(null);
  const [milestoneTemplates, setMilestoneTemplates] = useState<MilestoneTemplate[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showReportDetailModal, setShowReportDetailModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const navigate = useNavigate();

  const loadStudentDashboard = useCallback(async (userCode: string) => {
    try {
      const dashboardRes = (await fetchData(
        `/reports/student/dashboard?userCode=${encodeURIComponent(userCode)}`,
      )) as ApiResponse<StudentDashboardPayload>;
      if (dashboardRes.success && dashboardRes.data) {
        const dashboard = dashboardRes.data;
        setTopic(dashboard.topic ? mapAggregateTopicToTopic(dashboard.topic) : null);
        setCurrentMilestone(dashboard.currentMilestone || null);
        setLecturerProfile(dashboard.supervisor ? mapAggregateSupervisorToLecturer(dashboard.supervisor) : null);
        setCanSubmit(Boolean(dashboard.canSubmit));
        setSubmitMessage(dashboard.blockReason || null);
      }
    } catch (err) { console.error("Error loading dashboard:", err); }
  }, []);

  const loadMilestoneTemplates = useCallback(async () => {
    try {
      const res = await fetchData<{ data?: MilestoneTemplate[] }>(
        "/MilestoneTemplates/get-list?Page=0&PageSize=10",
      );
      if (res.data) setMilestoneTemplates(res.data);
    } catch (err) { console.error("Error loading milestones:", err); }
  }, []);

  const loadProgressHistory = useCallback(async (userCode: string) => {
    try {
      const historyRes = (await fetchData(
        `/reports/student/progress-history?userCode=${encodeURIComponent(userCode)}&page=1&pageSize=50`,
      )) as ApiResponse<StudentProgressHistoryPayload>;
      if (historyRes.success && historyRes.data) {
        const items = historyRes.data.items || [];
        setReports(items.map((item) => mapHistorySubmissionToReport(item.submission)));
      }
    } catch (err) { console.error("Error loading history:", err); }
  }, []);

  useEffect(() => {
    const userCode = auth.user?.userCode;
    if (!userCode) return;
    const bootstrap = async () => {
      setLoading(true);
      await Promise.all([loadStudentDashboard(userCode), loadProgressHistory(userCode), loadMilestoneTemplates()]);
      setLoading(false);
    };
    bootstrap();
  }, [auth.user?.userCode, loadProgressHistory, loadStudentDashboard, loadMilestoneTemplates]);

  const milestoneViews = useMemo(() => {
    const sorted = [...milestoneTemplates].sort((a, b) => a.ordinal - b.ordinal);
    const currentOrdinal = currentMilestone?.ordinal ?? -1;
    const currentState = currentMilestone?.state;
    const now = new Date();

    return sorted.map((m) => {
      const isCompleted =
        m.ordinal < currentOrdinal ||
        (m.ordinal === currentOrdinal && (currentState === "COMPLETED" || currentState === "WaitingForCommittee"));
      const isCurrent =
        m.ordinal === currentOrdinal && currentState !== "COMPLETED" && currentState !== "WaitingForCommittee";
      // Phát hiện quá hạn ngay phía client: mốc đang thực hiện mà deadline đã qua
      const isOverdue = isCurrent && !!m.deadline && new Date(m.deadline) < now;
      return { ...m, isCompleted, isCurrent, isOverdue };
    });
  }, [milestoneTemplates, currentMilestone]);

  const isOverdue = useMemo(() => {
    if (!currentMilestone?.deadline) return false;
    const isCompleted =
      currentMilestone.state === "Hoàn thành" ||
      currentMilestone.state === "COMPLETED" ||
      currentMilestone.state === "WaitingForCommittee";
    if (isCompleted) return false;
    return new Date(currentMilestone.deadline) < new Date();
  }, [currentMilestone]);

  const isLateRequest = useMemo(() => {
    return isOverdue && currentMilestone?.allowLateSubmit !== true;
  }, [isOverdue, currentMilestone]);

  const getSubmitButtonText = () => {
    if (submitting) {
      if (isOverdue) {
        return currentMilestone?.allowLateSubmit === true
          ? "Đang gửi báo cáo..."
          : "Đang gửi yêu cầu...";
      }
      return "Đang gửi...";
    }
    
    if (isOverdue) {
      return currentMilestone?.allowLateSubmit === true
        ? "Gửi báo cáo (Nộp muộn)"
        : "Gửi yêu cầu xin nộp muộn";
    }
    return "Gửi báo cáo ngay";
  };

  const getConfirmButtonText = () => {
    if (submitting) {
      if (isOverdue) {
        return currentMilestone?.allowLateSubmit === true
          ? "Đang gửi báo cáo..."
          : "Đang gửi yêu cầu...";
      }
      return "Đang gửi báo cáo...";
    }

    if (isOverdue) {
      return currentMilestone?.allowLateSubmit === true
        ? "Xác nhận & Gửi nộp muộn"
        : "Xác nhận & Gửi yêu cầu";
    }
    return "Xác nhận & Gửi ngay";
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const handleMultipleFilesSelection = (files: FileList) => {
    const currentTotal = selectedFiles.length + links.length;
    if (currentTotal >= 4) {
      addToast("Bạn chỉ được nộp tối đa 4 tài nguyên báo cáo (bao gồm tệp tin và liên kết ngoài).", "warning");
      return;
    }

    const validFiles: File[] = [];
    const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) {
        addToast(`File ${file.name} vượt quá 10MB và bị bỏ qua.`, "warning");
        continue;
      }
      if (!allowed.includes(file.type)) {
        addToast(`File ${file.name} sai định dạng và bị bỏ qua.`, "warning");
        continue;
      }
      if (selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      const remainingSlots = 4 - currentTotal;
      if (validFiles.length > remainingSlots) {
        const filesToAdd = validFiles.slice(0, remainingSlots);
        setSelectedFiles(prev => [...prev, ...filesToAdd]);
        addToast(`Chỉ đính kèm thêm ${filesToAdd.length} tệp tài liệu do đạt giới hạn tối đa 4 tài nguyên báo cáo.`, "warning");
      } else {
        setSelectedFiles(prev => [...prev, ...validFiles]);
        addToast(`Đã thêm ${validFiles.length} file tài liệu.`, "success");
      }
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const isValidUrl = (url: string) => {
    const trimmed = url.trim().toLowerCase();
    return trimmed.startsWith("http://") || trimmed.startsWith("https://");
  };

  const addLink = () => {
    const currentTotal = selectedFiles.length + links.length;
    if (currentTotal >= 4) {
      addToast("Bạn chỉ được nộp tối đa 4 tài nguyên báo cáo (bao gồm tệp tin và liên kết ngoài).", "warning");
      return;
    }

    const urlTrimmed = newLinkUrl.trim();
    const nameTrimmed = newLinkName.trim();
    if (!urlTrimmed || !nameTrimmed || !isValidUrl(urlTrimmed)) return;

    if (links.some(l => l.url.trim().toLowerCase() === urlTrimmed.toLowerCase())) {
      addToast("Đường dẫn liên kết này đã có trong danh sách đính kèm.", "warning");
      return;
    }

    setLinks(prev => [...prev, { name: nameTrimmed, url: urlTrimmed }]);
    setNewLinkUrl("");
    setNewLinkName("");
  };

  const handleLinkKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addLink();
    }
  };

  const removeLink = (index: number) => {
    setLinks(prev => prev.filter((_, i) => i !== index));
  };

  const handleDownloadFile = async (file: SubmissionFile, e?: React.MouseEvent) => {
    e?.preventDefault();
    try {
      const url = normalizeUrl(`/api/SubmissionFiles/download/${file.fileID}`);
      const token = getAccessToken();
      const resp = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      if (!resp.ok) throw new Error("Download failed");
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = file.fileName || "download";
      a.click();
    } catch (err) { addToast("Không thể tải file.", "error"); }
  };

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.user?.userCode) {
      addToast("Vui lòng đăng nhập.", "warning"); return;
    }
    if (isLateRequest) {
      if (!lateReason.trim()) {
        addToast("Vui lòng nhập lý do giải trình xin nộp muộn.", "warning"); return;
      }
    } else {
      if (selectedFiles.length === 0 && links.length === 0) {
        addToast("Vui lòng chọn ít nhất một file báo cáo hoặc thêm một liên kết tài liệu.", "warning"); return;
      }
    }
    setShowConfirmModal(true);
  };

  const performSubmit = async () => {
    setSubmitting(true);
    try {
      const finalTitle = isLateRequest
        ? `Đơn xin nộp muộn mốc ${currentMilestone?.milestoneCode || ""}`
        : reportTitle.trim();

      const finalDescription = isLateRequest
        ? lateReason.trim()
        : reportDescription.trim();

      const formData = new FormData();
      formData.append("topicCode", topic?.topicCode || "");
      formData.append("milestoneCode", currentMilestone?.milestoneCode || "");
      formData.append("studentUserCode", auth.user?.userCode || "");
      formData.append("lecturerCode", lecturerProfile?.lecturerCode || "");
      formData.append("reportTitle", finalTitle);
      formData.append("reportDescription", finalDescription);
      
      if (!isLateRequest && selectedFiles.length > 0) {
        selectedFiles.forEach((file) => {
          formData.append("files", file);
        });
      }
      if (!isLateRequest && links.length > 0) {
        formData.append("externalLinks", JSON.stringify(links));
      }
      const res = (await fetchData("/reports/student/progress-submit", { method: "POST", body: formData })) as ApiResponse<any>;
      if (res.success) {
        if (isLateRequest) {
          addToast("Gửi yêu cầu xin nộp muộn thành công! Vui lòng chờ giảng viên phê duyệt.", "success");
        } else {
          addToast("Nộp báo cáo thành công", "success");
        }
        setReportTitle(""); setReportDescription(""); setLateReason(""); setSelectedFiles([]); setLinks([]);
        setShowConfirmModal(false);
        if (auth.user?.userCode) {
          await Promise.all([
            loadStudentDashboard(auth.user.userCode),
            loadProgressHistory(auth.user.userCode)
          ]);
        }
      }
    } catch (err: any) {
      const errMsg = err?.data?.message || err?.data?.Message || err?.data?.errorMessage || err?.message || "Lỗi khi nộp báo cáo";
      
      // If it's a late request, the backend returns a 409 Conflict to prevent actual submission, 
      // but successfully sends a notification to the lecturer. We treat this 409 error as a SUCCESSFUL request dispatch on UI.
      if (isLateRequest && (err?.status === 409 || errMsg.toLowerCase().includes("yêu cầu nộp muộn") || errMsg.toLowerCase().includes("đã được gửi"))) {
        addToast("Gửi yêu cầu xin nộp muộn thành công! Vui lòng chờ giảng viên phê duyệt.", "success");
        setLateReason("");
        setReportTitle("");
        setReportDescription("");
        setSelectedFiles([]);
        setLinks([]);
        setShowConfirmModal(false);
        if (auth.user?.userCode) {
          await Promise.all([
            loadStudentDashboard(auth.user.userCode),
            loadProgressHistory(auth.user.userCode)
          ]);
        }
      } else {
        addToast(errMsg, "error");
        setShowConfirmModal(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusText = (s?: string) => {
    const state = s?.toLowerCase();
    if (["đã duyệt", "approved", "accepted"].includes(state!)) return "Đã duyệt";
    if (["chờ duyệt", "pending"].includes(state!)) return "Chờ duyệt";
    return "Cần sửa";
  };

  const getStatusTone = (s?: string) => {
    const state = s?.toLowerCase();
    if (["đã duyệt", "approved", "accepted"].includes(state!)) return { bg: "#ecfdf5", color: "#10b981", border: "#10b981" };
    if (["chờ duyệt", "pending"].includes(state!)) return { bg: "#fff7ed", color: "#F37021", border: "#fdba74" };
    return { bg: "#fef9c3", color: "#a16207", border: "#fde047" };
  };

  const getFeedbackLevelText = (level?: string) => {
    switch (level?.toLowerCase()) {
      case "good": return "Tốt";
      case "moderate": return "Trung bình";
      case "high": return "Cao";
      case "normal": return "Bình thường";
      case "medium": return "Trung cấp";
      case "low": return "Thấp";
      default: return level || "Chưa có";
    }
  };

  const getMilestoneTone = (isCompleted: boolean, isCurrent: boolean, isOverdue: boolean, state?: string) => {
    if (isCompleted || state === "WaitingForCommittee") return { bg: "#ecfdf5", color: "#10b981", border: "#10b981", dot: "#10B981" };
    if (isOverdue) return { bg: "#fef2f2", color: "#dc2626", border: "#fecaca", dot: "#dc2626" };
    if (isCurrent) return { bg: "#fff7ed", color: "#F37021", border: "#fdba74", dot: "#F37021" };
    return { bg: "#f8fafc", color: "#64748b", border: "#cbd5e1", dot: "#e2e8f0" };
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[#003D82] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Đang tải dữ liệu...</p>
      </div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 lg:p-8 w-full flex flex-col gap-6">
      <style>
        {`
          .unified-workspace {
            display: grid; grid-template-columns: 1fr 450px; gap: 24px;
            width: 100%; align-items: stretch;
          }
          @media (max-width: 1400px) { .unified-workspace { grid-template-columns: 1fr; } }
          .custom-table th {
            text-align: left; padding: 12px 16px; background: #FFFFFF; color: #64748B;
            font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;
            border-bottom: 2px solid #F1F5F9;
          }
          .custom-table td { padding: 14px 16px; border-bottom: 1px solid #F1F5F9; font-size: 12px; }
          .custom-table tr:hover { background: #F8FAFC; }
        `}
      </style>

      {/* --- QUICK STATS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100 flex items-center gap-5 group hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#F37021] flex items-center justify-center group-hover:scale-110 transition-transform"><FileText size={24} /></div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng số báo cáo</p>
               <h3 className="text-xl font-black text-slate-900">{reports.length} bản ghi</h3>
            </div>
         </div>
         <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100 flex items-center gap-5 group hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#003D82] flex items-center justify-center group-hover:scale-110 transition-transform"><TrendingUp size={24} /></div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đánh giá gần nhất</p>
               <h3 className="text-xl font-black text-slate-900">{reports[0] ? getFeedbackLevelText(reports[0].feedbackLevel) : "Chưa có"}</h3>
            </div>
         </div>
         {/* Stat card Hạn chót — đỏ khi overdue */}
         {(() => {
           const isCurrentOverdue = !!currentMilestone?.deadline && new Date(currentMilestone.deadline) < new Date();
           return (
             <div className={`p-5 rounded-[24px] shadow-sm flex items-center gap-5 group hover:shadow-md transition-all ${
               isCurrentOverdue
                 ? "bg-red-50 border-2 border-red-200"
                 : "bg-white border border-slate-100"
             }`}>
               <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${
                 isCurrentOverdue ? "bg-red-100 text-red-500" : "bg-emerald-50 text-emerald-500"
               }`}>
                 {isCurrentOverdue ? <AlertCircle size={24} /> : <Target size={24} />}
               </div>
               <div>
                 <p className={`text-[10px] font-black uppercase tracking-widest ${
                   isCurrentOverdue ? "text-red-400" : "text-slate-400"
                 }`}>
                   {isCurrentOverdue ? "⚠️ Đã quá hạn" : "Hạn chót tiếp theo"}
                 </p>
                 <h3 className={`text-xl font-black ${
                   isCurrentOverdue ? "text-red-600" : "text-slate-900"
                 }`}>
                   {currentMilestone?.deadline ? new Date(currentMilestone.deadline).toLocaleDateString('vi-VN') : "Không có"}
                 </h3>
               </div>
             </div>
           );
         })()}
      </div>

      {/* --- MAXIMUM STRETCH ROADMAP --- */}
      <div className="bg-white p-10 lg:p-12 rounded-[24px] shadow-sm border border-slate-100 relative overflow-hidden">
         {/* Banner cảnh báo overdue — hiện ngay dưới roadmap */}
         {milestoneViews.some(m => m.isOverdue) && (
           <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
             <div className="flex-shrink-0 mt-0.5"><AlertCircle size={18} className="text-red-500" /></div>
             <div>
               <p className="text-sm font-black text-red-600 mb-0.5">⚠️ Cảnh báo: Mốc tiến độ đã quá hạn!</p>
               <p className="text-xs font-bold text-red-400">
                 Mốc <strong>{milestoneViews.find(m => m.isOverdue)?.name}</strong> đã qua deadline{" "}
                 <strong>{milestoneViews.find(m => m.isOverdue)?.deadline ? new Date(milestoneViews.find(m => m.isOverdue)!.deadline!).toLocaleDateString('vi-VN') : ""}</strong>.
                 Hệ thống sẽ tự động đánh dấu thất bại. Vui lòng liên hệ giảng viên hướng dẫn ngay.
               </p>
             </div>
           </div>
         )}
         <div className="flex justify-between items-start relative px-8">
            {milestoneViews.map((m, idx) => {
               const tone = getMilestoneTone(m.isCompleted, m.isCurrent, m.isOverdue, m.ordinal === currentMilestone?.ordinal ? currentMilestone?.state : undefined);
               const nextMilestone = milestoneViews[idx + 1] || null;
               
               let lineColor = "#E2E8F0";
               if (nextMilestone) {
                  if (nextMilestone.isCompleted) lineColor = "#10B981";
                  else if (nextMilestone.isOverdue) lineColor = "#dc2626";
                  else if (nextMilestone.isCurrent) lineColor = "#F37021";
               }

               return (
                  <div key={m.milestoneTemplateID} className="flex-1 flex flex-col items-center relative group">
                     {idx < milestoneViews.length - 1 && (
                        <div className="absolute top-6 left-[50%] right-[-50%] h-[2px] z-0" style={{ backgroundColor: lineColor }}></div>
                     )}

                     <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-300 bg-white z-10
                        ${m.isCompleted || m.isCurrent || m.isOverdue ? 'scale-110 shadow-lg' : ''}`}
                        style={{ borderColor: tone.dot, color: tone.dot }}>
                        {m.isCompleted
                          ? <CheckCircle size={24} />
                          : m.isOverdue
                            ? <AlertCircle size={24} />
                            : <span className="font-black text-sm">{idx + 1}</span>}
                     </div>

                     <div className="mt-7 text-center px-2">
                        <p className={`text-[12px] font-black mb-1 transition-colors ${m.isCurrent || m.isCompleted || m.isOverdue ? 'text-slate-900' : 'text-slate-400'}`}>
                           {m.name}
                        </p>
                        <span className={`text-[10px] font-bold block mb-2 ${m.isOverdue ? 'text-red-400 font-black' : 'text-slate-400'}`}>
                           {m.deadline ? new Date(m.deadline).toLocaleDateString('vi-VN') : "Đang cập nhật"}
                        </span>
                        <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider"
                           style={{ background: tone.bg, color: tone.color, border: `1px solid ${tone.border}` }}>
                           {m.ordinal === 4 && currentMilestone?.state === "WaitingForCommittee"
                              ? "Chờ hội đồng & bảo vệ"
                              : m.isCompleted ? "Hoàn thành"
                              : m.isOverdue ? "⚠️ Quá hạn"
                              : m.isCurrent ? "Đang thực hiện"
                              : "Sắp tới"}
                        </span>
                     </div>
                  </div>
               );
            })}
         </div>
      </div>

      <div className="unified-workspace">
        {/* --- LEFT: SUBMISSION OR LATE REQUEST PORTAL --- */}
        {(!canSubmit || currentMilestone?.state === "WaitingForCommittee") ? (
          <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-6 lg:p-10 flex flex-col gap-8 h-full">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Upload size={24} className="text-[#F37021]" />Nộp báo cáo tiến độ</h2>
              </div>
              {!canSubmit && <div className="px-4 py-2 bg-orange-50 border border-orange-100 rounded-xl text-orange-600 text-[10px] font-black uppercase">Cổng đang đóng</div>}
            </div>
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-10">
               {/* Case 1: Waiting for committee */}
               {currentMilestone?.state === "WaitingForCommittee" && (
                 <>
                   <div className="w-16 h-16 rounded-full flex items-center justify-center bg-emerald-50 text-emerald-500">
                     <CheckCircle size={32} />
                   </div>
                   <p className="text-emerald-600 font-bold text-sm max-w-xs text-center">
                     Bạn đã hoàn thành tất cả các mốc báo cáo. Vui lòng chờ nhà trường sắp xếp hội đồng bảo vệ.
                   </p>
                 </>
               )}
               {/* Case 2: Milestone FAILED */}
               {!canSubmit && submitMessage?.includes("that bai") && currentMilestone?.state !== "WaitingForCommittee" && (
                 <>
                   <div className="w-16 h-16 rounded-full flex items-center justify-center bg-red-50 text-red-500">
                     <XCircle size={32} />
                   </div>
                   <div className="max-w-sm text-center space-y-2">
                     <p className="text-red-600 font-black text-sm">Mốc tiến độ đã thất bại</p>
                     <p className="text-red-500 font-bold text-xs">
                       {submitMessage?.includes("ABSENT") || submitMessage?.includes("khong nop")
                         ? "Bạn không nộp báo cáo trước deadline."
                         : "Bạn không nộp lại sau khi giảng viên yêu cầu sửa đổi."}
                     </p>
                     <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl text-[10px] font-bold text-red-400 text-left">
                       ⚠️ Vui lòng liên hệ giảng viên hướng dẫn để được xem xét gia hạn (EXTEND_DEADLINE) hoặc miễn trừ (EXEMPT) mốc này.
                     </div>
                   </div>
                 </>
               )}
               {/* Case 3: Sequential guard - mốc trước chưa xong */}
               {!canSubmit && submitMessage?.includes("moc truoc") && currentMilestone?.state !== "WaitingForCommittee" && (
                 <>
                   <div className="w-16 h-16 rounded-full flex items-center justify-center bg-amber-50 text-amber-500">
                     <Clock size={32} />
                   </div>
                   <div className="max-w-sm text-center space-y-2">
                     <p className="text-amber-600 font-black text-sm">Chưa hoàn thành mốc trước</p>
                     <p className="text-amber-500 font-bold text-xs">
                       Bạn cần hoàn thành mốc tiến độ trước đó trước khi nộp mốc này.
                     </p>
                   </div>
                 </>
               )}
               {/* Case 4: Pending review hoặc các lý do khác */}
               {!canSubmit && !submitMessage?.includes("that bai") && !submitMessage?.includes("moc truoc") && currentMilestone?.state !== "WaitingForCommittee" && (
                 <>
                   <div className="w-16 h-16 rounded-full flex items-center justify-center bg-slate-50 text-slate-300">
                     <Clock size={32} />
                   </div>
                   <p className="text-slate-400 font-bold text-sm max-w-xs text-center">
                     {submitMessage || "Hiện tại không trong thời gian nộp bài."}
                   </p>
                 </>
               )}
            </div>
          </div>
        ) : isOverdue && currentMilestone?.allowLateSubmit !== true ? (
          /* --- COMPONENT A: LATE REQUEST PORTAL --- */
          <div className="bg-gradient-to-br from-white to-amber-50/10 rounded-[24px] shadow-sm border border-amber-200/60 p-6 lg:p-10 flex flex-col gap-8 h-full">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black text-amber-800 flex items-center gap-2">
                  <Clock size={24} className="text-amber-500 animate-pulse" />
                  Đơn xin nộp muộn mốc tiến độ
                </h2>
                <p className="text-xs font-bold text-amber-600 mt-1">Gửi giải trình tới giảng viên hướng dẫn để xin phép mở cổng nộp bài trễ hạn</p>
              </div>
              <div className="px-4 py-2 bg-amber-50 border border-amber-100 rounded-xl text-amber-600 text-[10px] font-black uppercase">⚠️ Đã quá hạn</div>
            </div>

            <form onSubmit={handleOpenConfirm} className="flex-1 flex flex-col gap-6">
              <div className="p-5 bg-amber-50/60 border border-amber-200 rounded-[20px] flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <AlertCircle size={20} className="text-amber-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-black text-amber-800 mb-0.5">Mốc tiến độ: {currentMilestone?.milestoneCode}</h4>
                  <p className="text-xs font-bold text-amber-700 leading-relaxed">
                    Hạn chót của mốc tiến độ này đã qua ({currentMilestone?.deadline ? new Date(currentMilestone.deadline).toLocaleString('vi-VN') : ""}). Cổng nộp báo cáo chính thức đã đóng. Vui lòng nhập lý do giải trình bên dưới để xin giảng viên cấp phép nộp muộn.
                  </p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[20px] border border-amber-200/80 flex flex-col gap-4 shadow-sm">
                <label className="text-[10px] font-black text-amber-800 uppercase tracking-widest block">Lý do xin nộp muộn (Giải trình lý do quá hạn)</label>
                <textarea 
                  value={lateReason} 
                  onChange={(e) => setLateReason(e.target.value)}
                  required
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-50 transition-all resize-none min-h-[180px]"
                  placeholder="Ví dụ: Gặp vấn đề sức khỏe có giấy xác nhận, sự cố hỏng thiết bị phần cứng đột xuất, hoặc cần thêm thời gian để thu thập dữ liệu thử nghiệm..." 
                />
                <div className="text-[10px] font-bold text-amber-600 leading-relaxed">
                  💡 <strong>Lưu ý:</strong> Khi bạn gửi, hệ thống sẽ chuyển ngay đơn giải trình này dưới dạng thông báo khẩn cấp tới Giảng viên hướng dẫn. Bạn không cần đính kèm tệp tin tài liệu hay liên kết ở bước xin phép này. Hãy điền chi tiết lý do để được duyệt nhanh chóng.
                </div>
              </div>

              <div className="pt-6 border-t border-amber-100 flex items-center justify-between mt-auto">
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-black text-amber-600 uppercase flex items-center gap-1.5">
                    <AlertCircle size={14} /> Điền lý do giải trình để gửi yêu cầu
                  </p>
                </div>
                <button 
                  type="submit" 
                  disabled={submitting || !lateReason.trim()}
                  className={`px-12 py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all
                    ${(submitting || !lateReason.trim()) 
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                      : "bg-amber-500 text-white shadow-xl shadow-amber-100 hover:bg-amber-600"}`}
                >
                  {submitting ? "Đang gửi yêu cầu..." : "Gửi yêu cầu xin nộp muộn"}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* --- COMPONENT B: REGULAR / APPROVED LATE SUBMISSION FORM --- */
          <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-6 lg:p-10 flex flex-col gap-8 h-full">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Upload size={24} className={isOverdue ? "text-emerald-500" : "text-[#F37021]"} />
                  Nộp báo cáo tiến độ {isOverdue && "(Nộp muộn)"}
                </h2>
              </div>
            </div>

            <form onSubmit={handleOpenConfirm} className="flex-1 flex flex-col gap-8">
              {/* Overdue Banner when allowLateSubmit is true */}
              {isOverdue && currentMilestone?.allowLateSubmit === true && (
                <div className="p-5 bg-emerald-50/80 border-2 border-emerald-200 rounded-[20px] flex items-start gap-4 shadow-sm animate-in fade-in slide-in-from-top-3 duration-300">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 animate-in fade-in zoom-in-75 duration-300">
                    <CheckCircle2 size={20} className="text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-emerald-800 mb-0.5">Đã được cấp phép nộp muộn</h4>
                    <p className="text-xs font-bold text-emerald-600 leading-relaxed">
                      Giảng viên hướng dẫn đã đồng ý và cho phép nộp báo cáo muộn cho mốc tiến độ này. Bạn có thể tiến hành gửi báo cáo chính thức ngay bây giờ. Quyền nộp muộn chỉ có giá trị cho một lần nộp duy nhất.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 flex-1">
                 <div className="flex flex-col gap-6 h-full">
                     <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Tiêu đề báo cáo</label>
                       <input type="text" value={reportTitle} onChange={(e) => setReportTitle(e.target.value)}
                         className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-[#003D82] focus:ring-4 focus:ring-blue-50 transition-all"
                         placeholder="Nhập tiêu đề..." required />
                     </div>
                     <div className="flex-1 flex flex-col">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Mô tả</label>
                       <textarea value={reportDescription} onChange={(e) => setReportDescription(e.target.value)}
                         className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-[#003D82] focus:ring-4 focus:ring-blue-50 transition-all resize-none flex-1 min-h-[160px]"
                         placeholder="Mô tả nội dung..." />
                     </div>
                  </div>
                  <div className="flex flex-col gap-5 h-full">
                      {/* Section: Upload File & Add Link Actions Row */}
                      <div className="space-y-3">
                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Đính kèm tài nguyên</label>
                           <div className="flex items-center gap-2">
                              {/* Left: Drag-Drop area */}
                              <div className={`flex-1 border-2 border-dashed rounded-xl px-3 py-2 flex items-center justify-center text-center cursor-pointer transition-all relative h-[42px] min-h-[42px]
                                  ${selectedFiles.length + links.length >= 4 
                                    ? "border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed" 
                                    : isDragOver ? "border-[#003D82] bg-blue-50" : "border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300"}`}
                                onDragOver={(e) => { 
                                  if (selectedFiles.length + links.length >= 4) return;
                                  e.preventDefault(); 
                                  setIsDragOver(true); 
                                }} 
                                onDragLeave={() => setIsDragOver(false)}
                                onDrop={(e) => { 
                                  e.preventDefault(); 
                                  setIsDragOver(false); 
                                  if (selectedFiles.length + links.length >= 4) {
                                    addToast("Bạn đã đạt giới hạn tối đa 4 tài nguyên báo cáo.", "warning");
                                    return;
                                  }
                                  if (e.dataTransfer.files) handleMultipleFilesSelection(e.dataTransfer.files); 
                                }}
                                onClick={() => {
                                  if (selectedFiles.length + links.length >= 4) {
                                    addToast("Bạn đã đạt giới hạn tối đa 4 tài nguyên báo cáo.", "warning");
                                    return;
                                  }
                                  document.getElementById("file-input")?.click();
                                }}>
                                 
                                 <input 
                                   type="file" 
                                   id="file-input" 
                                   className="hidden" 
                                   multiple 
                                   disabled={selectedFiles.length + links.length >= 4}
                                   onChange={(e) => { if (e.target.files) handleMultipleFilesSelection(e.target.files); }} 
                                 />
                                 
                                 <div className="flex items-center gap-2">
                                    <Upload size={12} className="text-slate-400" />
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Chọn file</span>
                                 </div>
                              </div>

                              {/* Right: Add Link button */}
                              <button 
                                type="button" 
                                onClick={addLink}
                                disabled={selectedFiles.length + links.length >= 4 || !newLinkUrl.trim() || !newLinkName.trim() || !isValidUrl(newLinkUrl)}
                                className={`px-4 h-[42px] font-black text-[10px] uppercase rounded-xl transition-all shadow-sm flex-shrink-0 flex items-center justify-center gap-1.5
                                  ${(selectedFiles.length + links.length >= 4 || !newLinkUrl.trim() || !newLinkName.trim() || !isValidUrl(newLinkUrl)) 
                                    ? "bg-slate-50 text-slate-300 border border-slate-200 cursor-not-allowed" 
                                    : "bg-[#003D82] text-white hover:bg-blue-800"}`}
                              >
                                 <ExternalLink size={12} />
                                 Thêm Link
                              </button>
                           </div>
                        </div>

                        {/* Row 2: Two inputs for Link below the first row */}
                        <div className="space-y-1">
                           <div className="flex items-center gap-2">
                              <input 
                                type="text" 
                                value={newLinkUrl} 
                                onChange={(e) => setNewLinkUrl(e.target.value)}
                                onKeyDown={handleLinkKeyDown}
                                disabled={selectedFiles.length + links.length >= 4}
                                placeholder={selectedFiles.length + links.length >= 4 ? "Đã đạt giới hạn tối đa 4 tài nguyên..." : "Nhập đường dẫn liên kết ngoài (URL)..."}
                                className={`flex-[1.8] min-w-0 px-3.5 py-2 border rounded-xl font-bold text-[11px] outline-none transition-all
                                  ${selectedFiles.length + links.length >= 4 
                                    ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed placeholder-slate-400" 
                                    : "bg-slate-50 border-slate-200 focus:border-[#003D82]"}`}
                              />
                              <input 
                                type="text" 
                                value={newLinkName} 
                                onChange={(e) => setNewLinkName(e.target.value)}
                                onKeyDown={handleLinkKeyDown}
                                disabled={selectedFiles.length + links.length >= 4}
                                placeholder={selectedFiles.length + links.length >= 4 ? "Đã đạt giới hạn..." : "Nhãn liên kết (ví dụ: GitHub, Drive, Slide...)"}
                                className={`flex-[1.2] min-w-0 px-3.5 py-2 border rounded-xl font-bold text-[11px] outline-none transition-all
                                  ${selectedFiles.length + links.length >= 4 
                                    ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed placeholder-slate-400" 
                                    : "bg-slate-50 border-slate-200 focus:border-[#003D82]"}`}
                              />
                           </div>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col min-h-[160px]">
                         <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Danh sách tài nguyên nộp</span>
                            {(selectedFiles.length > 0 || links.length > 0) && (
                               <span className="text-[8px] font-black text-[#003D82] uppercase bg-blue-50/80 px-2 py-0.5 rounded-md tracking-wider">
                                  📂 {selectedFiles.length} file • 🔗 {links.length} link
                               </span>
                            )}
                         </div>
                         
                         {selectedFiles.length === 0 && links.length === 0 ? (
                            <div className="h-[175px] flex flex-col items-center justify-center border border-slate-100 rounded-[20px] bg-slate-50/50 p-6 text-center">
                               <span className="text-slate-300 mb-1"><FileText size={20} /></span>
                               <p className="text-[9px] font-bold text-slate-400">Chưa có tài liệu hoặc liên kết nào được đính kèm</p>
                            </div>
                         ) : (
                            <div className="space-y-1.5 max-h-[175px] overflow-y-auto pr-1">
                               {/* selectedFiles List Cards */}
                               {selectedFiles.map((file, idx) => (
                                  <div key={`file-${idx}`} className="flex items-center justify-between p-2.5 bg-emerald-50/40 border border-emerald-100/50 rounded-xl animate-in fade-in slide-in-from-bottom-1 duration-200">
                                     <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                                           <FileText size={14} />
                                        </div>
                                        <div className="min-w-0">
                                           <p className="text-[10px] font-black text-slate-800 truncate leading-tight" title={file.name}>{file.name}</p>
                                           <p className="text-[8px] font-bold text-slate-400 leading-none">{formatBytes(file.size)}</p>
                                        </div>
                                     </div>
                                     <button 
                                       type="button" 
                                       onClick={() => removeFile(idx)}
                                       className="p-1 hover:bg-emerald-100/60 rounded-md text-emerald-600/50 hover:text-red-500 transition-all border border-transparent shadow-sm"
                                     >
                                        <X size={10} />
                                     </button>
                                  </div>
                               ))}

                               {/* links List Cards */}
                               {links.map((link, idx) => {
                                  const isGithub = link.name?.toLowerCase().includes("github") || link.url?.toLowerCase().includes("github");
                                  const isDrive = link.name?.toLowerCase().includes("drive") || link.url?.toLowerCase().includes("drive") || link.name?.toLowerCase().includes("video");
                                  const isSlide = link.name?.toLowerCase().includes("slide");
                                  
                                  let cardBg = "bg-blue-50/40 border-blue-100/50 text-blue-600";
                                  let iconBg = "bg-blue-50 text-blue-600";
                                  if (isGithub) { cardBg = "bg-slate-50 border-slate-200/60 text-slate-800"; iconBg = "bg-slate-100 text-slate-800"; }
                                  else if (isDrive) { cardBg = "bg-amber-50/40 border-amber-100/50 text-amber-600"; iconBg = "bg-amber-50 text-amber-600"; }
                                  else if (isSlide) { cardBg = "bg-orange-50/40 border-orange-100/50 text-orange-600"; iconBg = "bg-orange-50 text-orange-600"; }

                                  return (
                                     <div key={`link-${idx}`} className={`flex items-center justify-between p-2.5 ${cardBg} border rounded-xl animate-in fade-in slide-in-from-bottom-1 duration-200`}>
                                        <div className="flex items-center gap-2.5 min-w-0">
                                           <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
                                              <ExternalLink size={12} />
                                           </div>
                                           <div className="min-w-0">
                                              <p className="text-[10px] font-black text-slate-800 truncate leading-tight" title={link.name}>{link.name}</p>
                                              <p className="text-[8px] font-bold text-slate-400 truncate leading-none" title={link.url}>{link.url}</p>
                                           </div>
                                        </div>
                                        <button 
                                          type="button" 
                                          onClick={() => removeLink(idx)}
                                          className="p-1 hover:bg-white rounded-md text-slate-400 hover:text-red-500 transition-all border border-transparent shadow-sm"
                                        >
                                           <X size={10} />
                                        </button>
                                     </div>
                                  );
                               })}
                            </div>
                         )}
                      </div>
                  </div>
              </div>

              <div className="pt-8 border-t border-slate-100 flex items-center justify-between">
                 <div className="flex flex-col gap-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5">
                       <AlertCircle size={14} /> Định dạng: PDF, DOC, DOCX (Tối đa 10MB / tệp)
                    </p>
                 </div>
                 {(() => {
                    const isSubmitDisabled = submitting || (selectedFiles.length === 0 && links.length === 0);
                    return (
                       <button 
                          type="submit" 
                          disabled={isSubmitDisabled}
                          className={`px-12 py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all
                            ${isSubmitDisabled 
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                              : isLateRequest 
                                ? "bg-amber-500 text-white shadow-xl shadow-amber-100 hover:bg-amber-600"
                                : "bg-[#F37021] text-white shadow-xl shadow-orange-100 hover:bg-orange-600"}`}
                       >
                          {getSubmitButtonText()}
                       </button>
                    );
                 })()}
              </div>
            </form>
          </div>
        )}

        {/* --- RIGHT: HISTORY TABLE --- */}
        <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 flex flex-col overflow-hidden h-full max-h-[800px]">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
             <h2 className="text-sm font-black text-slate-900 flex items-center gap-2"><Clock size={16} className="text-[#003D82]" />Lịch sử nộp báo cáo ({reports.length})</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full custom-table border-collapse">
              <thead>
                <tr>
                  <th className="w-14">Lần</th>
                  <th>Tiêu đề</th>
                  <th className="w-24">Ngày nộp</th>
                  <th className="w-24">Trạng thái</th>
                  <th className="text-center w-20">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-20 text-slate-400 font-bold italic text-[11px]">Chưa có dữ liệu.</td></tr>
                ) : (
                  reports.map((report, idx) => {
                    const tone = getStatusTone(report.lecturerState);
                    return (
                      <tr 
                        key={report.submissionID}
                        className="cursor-pointer hover:bg-blue-50/30 group/row transition-all relative"
                        onClick={() => { setSelectedReport(report); setShowReportDetailModal(true); }}
                      >
                        <td className="font-black text-slate-400">#{report.attemptNumber || reports.length - idx}</td>
                        <td className="font-bold text-slate-800">
                           <div className="truncate max-w-[150px] group-hover/row:text-[#003D82] transition-colors" title={report.reportTitle}>{report.reportTitle}</div>
                        </td>
                        <td className="text-slate-500 font-medium whitespace-nowrap">{new Date(report.submittedAt).toLocaleDateString("vi-VN")}</td>
                        <td>
                           <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider whitespace-nowrap"
                              style={{ background: tone.bg, color: tone.color, border: `1px solid ${tone.border}` }}>
                              {getStatusText(report.lecturerState)}
                           </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                           <div className="flex items-center justify-center gap-1">
                              <button onClick={() => { setSelectedReport(report); setShowReportDetailModal(true); }} className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-[#003D82] shadow-sm border border-transparent hover:border-slate-100 transition-all" title="Xem chi tiết"><Eye size={14} /></button>
                              {report.files?.find(f => f.mimeType !== "text/html") && (
                                 <button onClick={(e) => handleDownloadFile(report.files.find(f => f.mimeType !== "text/html")!, e)} className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-emerald-500 shadow-sm border border-transparent hover:border-slate-100 transition-all" title="Tải tài liệu"><Download size={14} /></button>
                               )}
                           </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showReportDetailModal && selectedReport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
           <div className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
              <div className="bg-gradient-to-r from-[#003D82] to-[#0052a2] p-6 text-white flex justify-between items-center">
                 <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] opacity-80 mb-0.5">Chi tiết lịch sử nộp báo cáo</h3>
                    <p className="text-[10px] font-bold text-blue-100 flex items-center gap-2"><Clock size={12} /> Lần nộp #{selectedReport.attemptNumber || "N/A"}</p>
                 </div>
                 <button onClick={() => setShowReportDetailModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={20} /></button>
              </div>
              <div className="p-8 space-y-6 max-h-[65vh] overflow-y-auto">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Mốc tiến độ</span>
                             <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#F37021]"></div>
                                <span className="text-xs font-black text-slate-900 uppercase">{selectedReport.milestoneCode}</span>
                             </div>
                          </div>
                          <div className="space-y-1 text-right">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Ngày nộp</span>
                             <div className="text-xs font-black text-slate-900">{new Date(selectedReport.submittedAt).toLocaleString('vi-VN')}</div>
                          </div>
                       </div>

                       <div className="p-5 rounded-[20px] bg-slate-50 border border-slate-100 space-y-3">
                          <div className="space-y-1">
                             <span className="text-[9px] font-black text-[#003D82] uppercase tracking-widest block">Tiêu đề báo cáo</span>
                             <p className="text-lg font-black text-slate-900 leading-tight">{selectedReport.reportTitle}</p>
                          </div>
                          <div className="space-y-1">
                             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Mô tả nội dung</span>
                             <p className="text-xs text-slate-600 font-bold italic leading-relaxed">"{selectedReport.reportDescription || "Không có mô tả"}"</p>
                          </div>
                       </div>
                    </div>

                    <div className="space-y-6">
                       {selectedReport.files && selectedReport.files.filter(f => f.mimeType !== "text/html").length > 0 && (
                           <div className="space-y-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Tài liệu đính kèm (Files)</span>
                              <div className="space-y-2">
                                 {selectedReport.files.filter(f => f.mimeType !== "text/html").map((file) => (
                                    <div key={file.fileID} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-[#003D82] transition-all group">
                                       <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#003D82] flex items-center justify-center group-hover:bg-[#003D82] group-hover:text-white transition-all"><FileText size={16} /></div>
                                          <div className="max-w-[200px]">
                                             <p className="text-[11px] font-black text-slate-900 truncate" title={file.fileName}>{file.fileName}</p>
                                          </div>
                                       </div>
                                       <button onClick={(e) => handleDownloadFile(file, e)} className="p-2 text-slate-400 hover:text-emerald-500 transition-all" title="Tải xuống"><Download size={16} /></button>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        )}

                        {selectedReport.files && selectedReport.files.filter(f => f.mimeType === "text/html").length > 0 && (
                           <div className="space-y-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Liên kết ngoài & Sản phẩm</span>
                              <div className="space-y-2">
                                 {selectedReport.files.filter(f => f.mimeType === "text/html").map((file) => {
                                    const isGithub = file.fileName?.toLowerCase().includes("github") || file.fileURL?.toLowerCase().includes("github");
                                    const isDrive = file.fileName?.toLowerCase().includes("drive") || file.fileURL?.toLowerCase().includes("drive") || file.fileName?.toLowerCase().includes("video");
                                    const isSlide = file.fileName?.toLowerCase().includes("slide");
                                    
                                    let iconColor = "#3b82f6";
                                    let bgColor = "#eff6ff";
                                    if (isGithub) { iconColor = "#0f172a"; bgColor = "#f1f5f9"; }
                                    else if (isDrive) { iconColor = "#f59e0b"; bgColor = "#fef3c7"; }
                                    else if (isSlide) { iconColor = "#f37021"; bgColor = "#fff7ed"; }

                                    return (
                                       <a 
                                         key={file.fileID} 
                                         href={file.fileURL} 
                                         target="_blank" 
                                         rel="noopener noreferrer" 
                                         className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-[#003D82] transition-all group hover:shadow-sm"
                                       >
                                          <div className="flex items-center gap-3">
                                             <div 
                                               className="w-8 h-8 rounded-lg flex items-center justify-center transition-all group-hover:scale-105"
                                               style={{ color: iconColor, backgroundColor: bgColor }}
                                             >
                                                <ExternalLink size={16} />
                                             </div>
                                             <div className="max-w-[200px]">
                                                <p className="text-[11px] font-black text-slate-900 truncate" title={file.fileName}>{file.fileName}</p>
                                                <p className="text-[9px] font-bold text-slate-400 truncate max-w-[180px]">{file.fileURL}</p>
                                             </div>
                                          </div>
                                          <div className="p-2 text-slate-400 group-hover:text-[#003D82] transition-all">
                                             <ExternalLink size={14} />
                                          </div>
                                       </a>
                                    );
                                 })}
                              </div>
                           </div>
                        )}

                       {selectedReport.lecturerComment && (
                          <div className="p-5 rounded-[20px] bg-orange-50 border border-orange-100 space-y-2">
                             <span className="text-[9px] font-black text-[#F37021] uppercase tracking-widest flex items-center gap-2">
                                <MessageSquare size={12} /> Phản hồi từ giảng viên
                             </span>
                             <p className="text-xs text-slate-700 font-bold leading-relaxed">{selectedReport.lecturerComment}</p>
                             {selectedReport.feedbackLevel && (
                                <div className="pt-1">
                                   <span className="px-2 py-0.5 bg-white rounded-md text-[9px] font-black text-[#F37021] uppercase border border-orange-200">
                                      Đánh giá: {getFeedbackLevelText(selectedReport.feedbackLevel)}
                                   </span>
                                </div>
                             )}
                          </div>
                       )}
                    </div>
                 </div>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                 <button onClick={() => setShowReportDetailModal(false)} className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-100 transition-all">Đóng</button>
              </div>
           </div>
        </div>
       )}

      {/* Premium Confirm Submission Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
           {/* Glass Backdrop */}
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={() => setShowConfirmModal(false)} />
           
           {/* Modal Box */}
           <div className="bg-white rounded-[32px] overflow-hidden shadow-2xl border border-slate-100 w-full max-w-2xl relative z-10 animate-in zoom-in-95 duration-200 flex flex-col">
              {isLateRequest ? (
                /* --- LATE REQUEST CONFIRMATION --- */
                <>
                  {/* Header */}
                  <div className="p-8 pb-4 text-center">
                     <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-bounce">
                        <Clock size={24} />
                     </div>
                     <h3 className="text-lg font-black text-amber-800 tracking-tight uppercase">
                        Gửi yêu cầu xin nộp muộn
                     </h3>
                     <p className="text-[11px] font-bold text-slate-400 mt-1">
                        Vui lòng rà soát lại lý do xin nộp muộn dưới đây thật kỹ trước khi gửi tới Giảng viên hướng dẫn.
                     </p>
                  </div>

                  {/* Content Review Area */}
                  <div className="px-8 py-2 space-y-5 flex-1 overflow-y-auto max-h-[360px]">
                     <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <ClipboardList size={14} className="text-amber-500" />
                          <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Nội dung yêu cầu</span>
                        </div>
                        <div className="bg-amber-50/50 border border-amber-100 p-5 rounded-2xl space-y-3">
                           <div className="grid grid-cols-2 gap-4 border-b border-amber-100/50 pb-3">
                              <div>
                                 <span className="text-[8px] font-black text-amber-600 uppercase block">Mốc tiến độ</span>
                                 <span className="text-xs font-black text-amber-800">{currentMilestone?.milestoneCode}</span>
                              </div>
                              <div className="text-right">
                                 <span className="text-[8px] font-black text-amber-600 uppercase block">Giảng viên nhận</span>
                                 <span className="text-xs font-black text-amber-800">{lecturerProfile?.fullName || "Chưa phân công"}</span>
                              </div>
                           </div>
                           <div>
                              <span className="text-[8px] font-black text-amber-600 uppercase block mb-1">Lý do xin nộp muộn</span>
                              <div className="bg-white border border-amber-200 p-4 rounded-xl text-xs text-slate-700 font-bold leading-relaxed max-h-[140px] overflow-y-auto whitespace-pre-wrap">
                                 {lateReason}
                              </div>
                           </div>
                        </div>
                     </div>

                     <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-2xl">
                        <AlertCircle size={14} className="text-red-600 mt-0.5 flex-shrink-0 animate-pulse" />
                        <p className="text-[10px] font-bold text-red-700 leading-normal">
                           <strong>⚠️ Lưu ý gửi yêu cầu:</strong> Hệ thống sẽ gửi thông báo khẩn cấp tới Giảng viên hướng dẫn trực tiếp. Bạn cần đợi giảng viên đồng ý mở cổng thì mới có thể tiến hành nộp file báo cáo chính thức.
                        </p>
                     </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                     <button 
                       type="button"
                       onClick={() => setShowConfirmModal(false)}
                       disabled={submitting}
                       className="px-6 py-4 bg-white border border-slate-200 rounded-2xl font-black text-[11px] uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all disabled:opacity-50"
                     >
                        Quay lại
                     </button>
                     <button 
                       type="button"
                       onClick={performSubmit}
                       disabled={submitting}
                       className="px-10 py-4 bg-amber-500 text-white shadow-xl shadow-amber-100 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-amber-600 transition-all flex items-center gap-2 disabled:bg-slate-300 disabled:shadow-none"
                     >
                        {submitting ? "Đang gửi yêu cầu..." : "Xác nhận & Gửi yêu cầu"}
                     </button>
                  </div>
                </>
              ) : (
                /* --- REGULAR REPORT SUBMISSION CONFIRMATION --- */
                <>
                  {/* Header */}
                  <div className="p-8 pb-4 text-center">
                     <div className="w-14 h-14 bg-orange-50 text-[#F37021] rounded-2xl flex items-center justify-center mx-auto mb-4 animate-bounce">
                        <Send size={24} />
                     </div>
                     <h3 className="text-lg font-black text-slate-800 tracking-tight uppercase">
                        Xác nhận gửi báo cáo
                     </h3>
                     <p className="text-[11px] font-bold text-slate-400 mt-1">
                        Vui lòng rà soát lại thông tin báo cáo dưới đây thật kỹ trước khi gửi tới Giảng viên hướng dẫn.
                     </p>
                  </div>

                  {/* Content Review Area */}
                  <div className="px-8 py-2 space-y-5 flex-1 overflow-y-auto max-h-[360px]">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Left Panel: Report Text Info */}
                        <div className="space-y-4">
                           <div className="flex items-center gap-2">
                             <ClipboardList size={14} />
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nội dung báo cáo</span>
                           </div>
                           <div className="space-y-3">
                              <div>
                                 <span className="text-[8px] font-black text-slate-400 uppercase">Tiêu đề</span>
                                 <p className="text-xs font-black text-slate-800 leading-tight truncate">{reportTitle || "Chưa nhập tiêu đề"}</p>
                              </div>
                              <div>
                                 <span className="text-[8px] font-black text-slate-400 uppercase">Nội dung chi tiết</span>
                                 <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl text-[11px] text-slate-600 font-bold leading-relaxed max-h-[140px] overflow-y-auto mt-1 whitespace-pre-wrap">
                                    {reportDescription || "Không có mô tả chi tiết."}
                                 </div>
                              </div>
                           </div>
                        </div>

                        {/* Right Panel: Resources Info */}
                        <div className="space-y-4">
                           <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">🔗 Tài nguyên đính kèm</span>
                              <span className="text-[8px] font-black text-[#003D82] uppercase bg-blue-50/80 px-2 py-0.5 rounded-md tracking-wider">
                                 📂 {selectedFiles.length} file • 🔗 {links.length} link
                              </span>
                           </div>
                           
                           <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
                              {selectedFiles.map((file, idx) => (
                                 <div key={`confirm-file-${idx}`} className="flex items-center gap-2.5 p-2 bg-emerald-50/40 border border-emerald-100/50 rounded-xl">
                                    <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                                       <FileText size={12} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                       <p className="text-[9px] font-black text-slate-800 truncate leading-tight" title={file.name}>{file.name}</p>
                                       <p className="text-[7px] font-bold text-slate-400 leading-none">{formatBytes(file.size)}</p>
                                    </div>
                                 </div>
                              ))}

                              {links.map((link, idx) => {
                                 const isGithub = link.name?.toLowerCase().includes("github") || link.url?.toLowerCase().includes("github");
                                 const isDrive = link.name?.toLowerCase().includes("drive") || link.url?.toLowerCase().includes("drive");
                                 const isSlide = link.name?.toLowerCase().includes("slide");
                                 
                                 let cardBg = "bg-blue-50/40 border-blue-100/50 text-blue-600";
                                 let iconBg = "bg-blue-50 text-blue-600";
                                 if (isGithub) { cardBg = "bg-slate-50 border-slate-200/60 text-slate-800"; iconBg = "bg-slate-100 text-slate-800"; }
                                 else if (isDrive) { cardBg = "bg-amber-50/40 border-amber-100/50 text-amber-600"; iconBg = "bg-amber-50 text-amber-600"; }
                                 else if (isSlide) { cardBg = "bg-orange-50/40 border-orange-100/50 text-orange-600"; iconBg = "bg-orange-50 text-orange-600"; }

                                 return (
                                    <div key={`confirm-link-${idx}`} className={`flex items-center gap-2.5 p-2 ${cardBg} border rounded-xl`}>
                                       <div className={`w-6 h-6 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
                                          <ExternalLink size={10} />
                                       </div>
                                       <div className="min-w-0 flex-1">
                                          <p className="text-[9px] font-black text-slate-800 truncate leading-tight" title={link.name}>{link.name}</p>
                                          <p className="text-[7px] font-bold text-slate-400 truncate leading-none" title={link.url}>{link.url}</p>
                                       </div>
                                    </div>
                                 );
                              })}
                           </div>
                        </div>
                     </div>

                     {/* Warning Banner */}
                     <div className="flex items-start gap-2.5 p-3.5 bg-amber-50/70 border border-amber-100/50 rounded-2xl">
                        <AlertCircle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                        <p className="text-[10px] font-bold text-amber-700 leading-normal">
                           <strong>Lưu ý quan trọng:</strong> Sau khi gửi, bạn sẽ không thể tự ý sửa đổi hoặc xóa tài nguyên của mốc này trừ khi Giảng viên hướng dẫn đánh giá "Cần sửa" và mở quyền nộp lại.
                        </p>
                     </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                     <button 
                       type="button"
                       onClick={() => setShowConfirmModal(false)}
                       disabled={submitting}
                       className="px-6 py-4 bg-white border border-slate-200 rounded-2xl font-black text-[11px] uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all disabled:opacity-50"
                     >
                        Quay lại kiểm tra
                     </button>
                     <button 
                       type="button"
                       onClick={performSubmit}
                       disabled={submitting}
                       className="px-10 py-4 bg-[#F37021] text-white shadow-xl shadow-orange-100 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-orange-600 transition-all flex items-center gap-2 disabled:bg-slate-300 disabled:shadow-none"
                     >
                        {submitting ? "Đang gửi báo cáo..." : "Xác nhận & Gửi ngay"}
                     </button>
                  </div>
                </>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
