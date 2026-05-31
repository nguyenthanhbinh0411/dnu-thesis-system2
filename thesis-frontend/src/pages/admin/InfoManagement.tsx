import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  GraduationCap,
  Building2,
  BookOpen,
  ClipboardList,
  UserCheck,
  Activity,
  FileSpreadsheet,
  FileDown,
  LayoutDashboard,
  ShieldCheck,
  Download,
  RefreshCw,
  Info,
} from "lucide-react";
import StudentProfilesManagement from "../studentservices/StudentProfilesManagement";
import LecturerProfilesManagement from "../studentservices/LecturerProfilesManagement";
import DepartmentsManagement from "../studentservices/DepartmentsManagement";
import ClassesManagement from "../studentservices/ClassesManagement";
import TagsManagement from "../studentservices/TagsManagement";
import CatalogTopicsWarehousePage from "../studentservices/CatalogTopicsWarehousePage";
import RoomsManagement from "./RoomsManagement";
import UsersManagement from "./UsersManagement";
import { fetchData, normalizeUrl, FetchDataError } from "../../api/fetchData";
import { useToast } from "../../context/useToast";
import { getAccessToken } from "../../services/auth-session.service";
import { getActiveDefensePeriodId } from "../../utils/defensePeriod";
import { readEnvelopeData } from "../../utils/api-envelope";
import type { ApiResponse } from "../../types/api";

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

const DEPARTMENT_FIELDS = [
  { key: "departmentCode", label: "Mã khoa", category: "Thông tin khoa" },
  { key: "name", label: "Tên khoa", category: "Thông tin khoa" },
  { key: "description", label: "Mô tả", category: "Thông tin khoa" },
];

const CLASS_FIELDS = [
  { key: "classID", label: "ID lớp học", category: "Thông tin lớp học" },
  { key: "classCode", label: "Mã lớp", category: "Thông tin lớp học" },
  { key: "name", label: "Tên lớp", category: "Thông tin lớp học" },
  { key: "departmentCode", label: "Mã khoa quản lý", category: "Thông tin đơn vị" },
];

const TAG_FIELDS = [
  { key: "tagCode", label: "Mã Tag", category: "Thông tin Tag" },
  { key: "tagName", label: "Tên Tag", category: "Thông tin Tag" },
  { key: "description", label: "Mô tả chuyên môn", category: "Thông tin Tag" },
];

const CATALOG_TOPIC_FIELDS = [
  { key: "catalogTopicCode", label: "Mã đề tài mẫu", category: "Thông tin cơ bản" },
  { key: "title", label: "Tên đề tài mẫu", category: "Thông tin cơ bản" },
  { key: "summary", label: "Tóm tắt đề tài", category: "Thông tin nội dung" },
  { key: "departmentCode", label: "Mã khoa quản lý", category: "Thông tin quản lý" },
  { key: "assignedStatus", label: "Trạng thái", category: "Trạng thái" },
  { key: "tagCodes", label: "Các thẻ (Tag)", category: "Phân loại" },
];

const ROOM_FIELDS = [
  { key: "roomCode", label: "Mã phòng bảo vệ", category: "Thông tin phòng" },
  { key: "status", label: "Trạng thái hoạt động", category: "Thông tin phòng" },
  { key: "createdAt", label: "Thời gian khởi tạo", category: "Thông tin hệ thống" },
  { key: "lastUpdated", label: "Cập nhật cuối", category: "Thông tin hệ thống" },
];

const USER_FIELDS = [
  { key: "userID", label: "ID tài khoản", category: "Thông tin cơ bản" },
  { key: "userCode", label: "Mã người dùng", category: "Thông tin cơ bản" },
  { key: "username", label: "Tên đăng nhập", category: "Thông tin cơ bản" },
  { key: "fullName", label: "Họ và tên hiển thị", category: "Thông tin cơ bản" },
  { key: "email", label: "Địa chỉ Email", category: "Thông tin liên lạc" },
  { key: "role", label: "Vai trò / Quyền", category: "Quyền hạn" },
  { key: "isActive", label: "Trạng thái hoạt động", category: "Trạng thái" },
];

const STATISTICS_REPORTS = [
  { key: "students", label: "Danh sách Sinh viên", desc: "Xuất dữ liệu chi tiết sinh viên trong đợt (họ tên, mã SV, điểm số, trạng thái...).", iconKey: "students", type: "modular", fields: STUDENT_FIELDS },
  { key: "lecturers", label: "Danh sách Giảng viên", desc: "Dữ liệu giảng viên tham gia trong đợt, bao gồm định mức hướng dẫn và chuyên môn.", iconKey: "lecturers", type: "modular", fields: LECTURER_FIELDS },
  { key: "departments", label: "Danh sách Khoa", desc: "Xuất thông tin chi tiết các Khoa/Viện đào tạo trong hệ thống.", iconKey: "departments", type: "modular", fields: DEPARTMENT_FIELDS },
  { key: "classes", label: "Danh sách Lớp học", desc: "Xuất danh sách các lớp học cùng khoa quản lý tương ứng.", iconKey: "classes", type: "modular", fields: CLASS_FIELDS },
  { key: "tags", label: "Danh sách Lĩnh vực / Tag", desc: "Xuất danh mục các tag, nhãn khoa học chuyên môn.", iconKey: "tags", type: "modular", fields: TAG_FIELDS },
  { key: "catalogtopics", label: "Kho đề tài mẫu", desc: "Xuất danh sách các đề tài mẫu có sẵn cho sinh viên tham khảo.", iconKey: "catalogtopics", type: "modular", fields: CATALOG_TOPIC_FIELDS },
  { key: "rooms", label: "Danh sách Phòng bảo vệ", desc: "Xuất danh sách các phòng bảo vệ hội đồng và trạng thái tương ứng.", iconKey: "rooms", type: "modular", fields: ROOM_FIELDS },
  { key: "users", label: "Danh sách Tài khoản", desc: "Xuất danh sách tài khoản người dùng và vai trò phân quyền.", iconKey: "users", type: "modular", fields: USER_FIELDS },
];

const DEEP_BLUE_PRIMARY = "#1e3a5f";

const InfoManagement: React.FC = () => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<
    "students" | "lecturers" | "departments" | "classes" | "tags" | "catalogtopics" | "rooms" | "users" | "statistics"
  >("students");

  const [periods, setPeriods] = useState<DefensePeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const fetchPeriods = async () => {
      try {
        const response = await fetchData<ApiResponse<DefensePeriod[]>>("/defense-periods");
        if (response?.success && response.data) {
          setPeriods(response.data);
          const activeId = getActiveDefensePeriodId();
          if (activeId && response.data.some((p) => p.defenseTermId === activeId)) {
            setSelectedPeriodId(activeId);
          } else if (response.data.length > 0) {
            setSelectedPeriodId(response.data[0].defenseTermId);
          }
        }
      } catch (err) {
        console.error("Error loading defense periods:", err);
      }
    };
    void fetchPeriods();
  }, []);

  const handleDownloadReport = async (item: any, format: string = "xlsx", fields?: string[]) => {
    if (!selectedPeriodId) return;

    setRefreshing(true);

    try {
      const baseUrl = `/defense-periods/${selectedPeriodId}/exports/${item.key}`;

      const params = new URLSearchParams();
      params.set("format", format);
      if (fields && fields.length > 0) {
        params.set("fields", fields.join(","));
      }

      const url = normalizeUrl(`${baseUrl}?${params.toString()}`);
      const token = getAccessToken();

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
        setRefreshing(false);
        return;
      }

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
        setRefreshing(false);
        return;
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      const selectedPeriod = periods.find(p => p.defenseTermId === selectedPeriodId);
      const fileName = `${item.key}_${selectedPeriod?.termCode || 'period'}_${new Date().toISOString().split('T')[0]}.${format}`;
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

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", paddingBottom: "80px" }}>
      {/* Header Banner */}
      <div style={{
        background: `linear-gradient(135deg, ${DEEP_BLUE_PRIMARY}, #2b4c7e)`,
        color: "white",
        padding: "60px 32px 108px 32px",
        position: "relative",
        overflow: "hidden"
      }}>
        {/* Decorative elements */}
        <div style={{
          position: "absolute",
          top: "-20%",
          right: "-10%",
          width: "500px",
          height: "500px",
          background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 70%)",
          borderRadius: "50%"
        }} />
        
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
              Hệ thống Quản lý
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
              Quản lý <span style={{ color: "#f37021" }}>Thông tin hệ thống</span>
            </h1>
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
            Xem, thêm mới, cập nhật và quản lý cơ sở dữ liệu hệ thống bao gồm Sinh viên, Giảng viên, Khoa, Tags, Đề tài và Phòng bảo vệ.
          </p>
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
        <div style={{ background: "#fff", borderRadius: "24px", border: "1px solid #e2e8f0", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", overflow: "hidden" }}>
          {/* Sticky Tab Bar */}
          <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 24px", position: "sticky", top: 0, zIndex: 20, overflowX: "auto", whiteSpace: "nowrap" }}>
            {[
              { id: "students", label: "Sinh viên", icon: <Users size={18} /> },
              { id: "lecturers", label: "Giảng viên", icon: <GraduationCap size={18} /> },
              { id: "departments", label: "Khoa", icon: <Building2 size={18} /> },
              { id: "classes", label: "Lớp", icon: <Building2 size={18} /> },
              { id: "tags", label: "Tag", icon: <BookOpen size={18} /> },
              { id: "catalogtopics", label: "Kho đề tài", icon: <ClipboardList size={18} /> },
              { id: "rooms", label: "Phòng bảo vệ", icon: <Building2 size={18} /> },
              { id: "users", label: "Tài khoản", icon: <UserCheck size={18} /> },
              { id: "statistics", label: "Thống kê", icon: <Activity size={18} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: "20px 24px",
                  background: "none",
                  border: "none",
                  borderBottom: `3px solid ${activeTab === tab.id ? DEEP_BLUE_PRIMARY : "transparent"}`,
                  color: activeTab === tab.id ? DEEP_BLUE_PRIMARY : "#64748b",
                  fontWeight: activeTab === tab.id ? "800" : "600",
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  transition: "all 0.2s ease"
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content Area */}
          <div style={{ padding: "32px", background: "#fff" }}>
            {activeTab === "students" && <StudentProfilesManagement />}
            {activeTab === "lecturers" && <LecturerProfilesManagement />}
            {activeTab === "departments" && <DepartmentsManagement />}
            {activeTab === "classes" && <ClassesManagement />}
            {activeTab === "tags" && <TagsManagement />}
            {activeTab === "catalogtopics" && <CatalogTopicsWarehousePage />}
            {activeTab === "rooms" && <RoomsManagement />}
            {activeTab === "users" && <UsersManagement />}
            {activeTab === "statistics" && (
              <div style={{ display: "grid", gap: "24px" }}>
                <div style={{ background: "#f8fafc", padding: "20px", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: "700", color: "#334155", marginBottom: "8px" }}>
                    Chọn đợt đồ án tốt nghiệp cần thống kê:
                  </label>
                  <select
                    value={selectedPeriodId || ""}
                    onChange={(e) => setSelectedPeriodId(e.target.value ? Number(e.target.value) : null)}
                    style={{
                      width: "100%",
                      maxWidth: "400px",
                      padding: "10px 14px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "10px",
                      fontSize: "14px",
                      outline: "none",
                      background: "#fff",
                    }}
                  >
                    <option value="">-- Chọn đợt bảo vệ --</option>
                    {periods.map((p) => (
                      <option key={p.defenseTermId} value={p.defenseTermId}>
                        {p.name} ({p.academicYear || "--"} - {p.semester || "--"})
                      </option>
                    ))}
                  </select>
                </div>
                {!selectedPeriodId ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "300px", color: "#64748b", background: "#fff", borderRadius: "16px", border: "1px dashed #cbd5e1", padding: "40px" }}>
                    <Activity size={48} strokeWidth={1} style={{ marginBottom: "16px", color: "#94a3b8" }} />
                    <p style={{ margin: 0, fontWeight: "600", fontSize: "15px" }}>Vui lòng chọn đợt đồ án tốt nghiệp ở trên để xem thống kê và xuất báo cáo.</p>
                  </div>
                ) : (
                  <StatisticsSection
                    selectedId={selectedPeriodId}
                    refreshing={refreshing}
                    onDownload={handleDownloadReport}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

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

  const getIcon = (key: string) => {
    switch (key) {
      case "students": return <Users size={20} />;
      case "lecturers": return <UserCheck size={20} />;
      case "departments": return <Building2 size={20} />;
      case "classes": return <Building2 size={20} />;
      case "tags": return <BookOpen size={20} />;
      case "catalogtopics": return <ClipboardList size={20} />;
      case "rooms": return <Building2 size={20} />;
      case "users": return <UserCheck size={20} />;
      default: return <Users size={20} />;
    }
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
                <div style={{ color: selectedTemplateKey === item.key ? DEEP_BLUE_PRIMARY : "#94a3b8" }}>{getIcon(item.iconKey)}</div>
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

export default InfoManagement;
