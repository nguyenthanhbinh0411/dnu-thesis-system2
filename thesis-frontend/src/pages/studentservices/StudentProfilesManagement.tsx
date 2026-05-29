import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle,
  Circle,
  Clock,
  Clock3,
  Edit,
  Filter,
  Plus,
  Search,
  ShieldCheck,
  Trash,
  Users,
  Eye,
  BookOpen,
  History,
  User,
} from "lucide-react";
import { fetchData, getAvatarUrl, normalizeUrl } from "../../api/fetchData";
import ImportExportActions from "../../components/admin/ImportExportActions";
import ManagementSectionedFormBody from "../../components/admin/ManagementSectionedFormBody";
import { useToast } from "../../context/useToast";
import type { ApiResponse } from "../../types/api";
import { useActiveDefensePeriodId } from "../../utils/defensePeriod";
import "./StudentProfilesManagement.css";
import TablePagination from "../../components/TablePagination/TablePagination";

type DefensePeriod = {
  defenseTermId: number;
  name: string;
  status: string;
};

type DashboardStudent = {
  studentProfileID: number;
  studentCode: string;
  userCode: string;
  fullName: string;
  studentEmail: string;
  phoneNumber: string;
  departmentCode: string;
  classCode: string;
  facultyCode: string;
  studentImage?: string;
  gpa?: number;
  academicStanding?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: string;
  enrollmentYear?: number;
  graduationYear?: number | null;
  status?: string;
};

type DashboardTopic = {
  topicID: number;
  topicCode: string;
  title: string;
  summary: string;
  status: string;
  createdAt: string;
  lastUpdated: string;
};

type DashboardTag = {
  tagCode: string;
  tagName: string;
};

type DashboardMilestone = {
  milestoneTemplateCode: string;
  ordinal?: number;
  state?: string;
  startedAt?: string | null;
  completedAt1?: string | null;
  completedAt2?: string | null;
  completedAt3?: string | null;
  completedAt4?: string | null;
  completedAt5?: string | null;
};

type DashboardSupervisor = {
  lecturerCode: string;
  fullName: string;
  degree?: string;
  email: string;
  phoneNumber: string;
  guideQuota?: number;
  currentGuidingCount?: number;
  departmentCode?: string;
};

type StudentDashboardItem = {
  student: DashboardStudent;
  topic?: DashboardTopic | null;
  topicTags: DashboardTag[];
  currentMilestone: DashboardMilestone | null;
  supervisor: DashboardSupervisor | null;
  supervisorTags?: DashboardTag[];
  canSubmit?: boolean;
  blockReason?: string | null;
};

type DashboardDataPayload = {
  items: StudentDashboardItem[];
  page: number;
  pageSize: number;
  totalCount: number;
};

type MilestoneTemplate = {
  milestoneTemplateID: number;
  milestoneTemplateCode: string;
  ordinal: number;
};

type ProgressHistoryFile = {
  fileID: number;
  fileURL: string;
  fileName: string;
  fileSizeBytes?: number;
  mimeType?: string;
  uploadedAt?: string;
};

type ProgressHistorySubmission = {
  submissionID: number;
  submissionCode: string;
  milestoneCode: string;
  ordinal?: number;
  studentUserCode: string;
  lecturerCode?: string;
  submittedAt?: string;
  attemptNumber?: number;
  lecturerComment?: string;
  lecturerState?: string;
  feedbackLevel?: string;
  reportTitle?: string;
  reportDescription?: string;
  lastUpdated?: string;
  files?: ProgressHistoryFile[];
};

type ProgressHistoryItem = {
  submission: ProgressHistorySubmission;
};

type ProgressHistoryPayload = {
  items: ProgressHistoryItem[];
  page: number;
  pageSize: number;
  totalCount: number;
};

type RowStatus =
  | "approved"
  | "pending"
  | "rejected"
  | "revision"
  | "defense-ready"
  | "committee-assigned"
  | "none";

type DashboardRowView = StudentDashboardItem & {
  __status: RowStatus;
  __progress: number;
};

type FieldType = "text" | "number" | "date" | "textarea";

type FieldDef = {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
};

const profileFields: FieldDef[] = [
  { name: "studentCode", label: "Mã sinh viên" },
  { name: "userCode", label: "Mã user", required: true },
  { name: "departmentCode", label: "Khoa" },
  { name: "classCode", label: "Lớp" },
  { name: "facultyCode", label: "Khoa viện" },
  { name: "studentImage", label: "Ảnh sinh viên" },
  { name: "fullName", label: "Họ tên" },
  { name: "studentEmail", label: "Email" },
  { name: "phoneNumber", label: "Số điện thoại" },
  { name: "academicStanding", label: "Học lực" },
  { name: "status", label: "Trạng thái" },
  { name: "enrollmentYear", label: "Năm nhập học", type: "number" },
  { name: "graduationYear", label: "Năm tốt nghiệp", type: "number" },
  { name: "gender", label: "Giới tính" },
  { name: "dateOfBirth", label: "Ngày sinh", type: "date" },
  { name: "gpa", label: "GPA", type: "number" },
  { name: "address", label: "Địa chỉ" },
  { name: "notes", label: "Ghi chú", type: "textarea" },
];

const editFieldSections: Array<{
  title: string;
  description: string;
  fields: string[];
}> = [
  {
    title: "Thông tin tài khoản",
    description: "Thông tin định danh và tài khoản liên kết.",
    fields: ["studentCode", "userCode", "status"],
  },
  {
    title: "Thông tin cá nhân",
    description: "Thông tin liên hệ, nhân thân của sinh viên.",
    fields: [
      "fullName",
      "studentEmail",
      "phoneNumber",
      "gender",
      "dateOfBirth",
      "address",
      "studentImage",
    ],
  },
  {
    title: "Thông tin học tập",
    description: "Khoa, lớp, niên khóa và học lực.",
    fields: [
      "departmentCode",
      "classCode",
      "facultyCode",
      "enrollmentYear",
      "graduationYear",
      "gpa",
      "academicStanding",
      "notes",
    ],
  },
];

function getFieldDefinition(name: string): FieldDef {
  return (
    profileFields.find((field) => field.name === name) ?? {
      name,
      label: name,
      type: "text",
    }
  );
}

function toDisplay(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function toFormRecord(data: Record<string, unknown>): Record<string, string> {
  return profileFields.reduce<Record<string, string>>((acc, field) => {
    acc[field.name] = toDisplay(data[field.name]);
    return acc;
  }, {});
}

function toPayload(
  formValues: Record<string, string>,
): Record<string, unknown> {
  return profileFields.reduce<Record<string, unknown>>((acc, field) => {
    const raw = (formValues[field.name] ?? "").trim();
    if (!raw) {
      acc[field.name] = field.type === "number" ? null : "";
      return acc;
    }

    if (field.type === "number") {
      const parsed = Number(raw);
      acc[field.name] = Number.isFinite(parsed) ? parsed : raw;
      return acc;
    }

    acc[field.name] = raw;
    return acc;
  }, {});
}

async function requestApiData<T>(
  path: string,
  options?: Parameters<typeof fetchData>[1],
  fallback = "Không thể tải dữ liệu.",
): Promise<{ data: T }> {
  const response = await fetchData<ApiResponse<T>>(path, options);
  if (!response?.success) {
    throw new Error(response?.message || response?.title || fallback);
  }
  return { data: response.data as T };
}

function mapApiStatusToDisplay(apiStatus?: string): RowStatus {
  const status = (apiStatus || "").toLowerCase();
  if (status.includes("đủ điều kiện bảo vệ")) return "defense-ready";
  if (status.includes("đã phân hội đồng")) return "committee-assigned";
  if (status.includes("đã duyệt")) return "approved";
  if (status.includes("từ chối")) return "rejected";
  if (status.includes("cần sửa")) return "revision";
  if (!apiStatus) return "none";
  return "pending";
}

function getStatusText(status: RowStatus | string): string {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("đã phân hội đồng")) return "đã có HĐ";
  if (normalized === "committee-assigned") return "đã có HĐ";
  if (normalized.includes("đủ điều kiện bảo vệ")) return "Chờ bảo vệ";
  if (normalized === "defense-ready") return "Chờ bảo vệ";
  if (status === "approved") return "Đã duyệt";
  if (status === "rejected") return "Từ chối";
  if (status === "revision") return "Cần sửa đổi";
  if (status === "none") return "Chưa đăng ký";
  return "Chờ duyệt";
}

function formatDate(value?: string): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("vi-VN");
}

function formatDateTime(value?: string | null): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("vi-VN");
}

function calcProgress(
  currentMilestone: DashboardMilestone | null,
  totalTemplates: number,
): number {
  if (!currentMilestone || !totalTemplates) return 0;
  const ordinal = Number(currentMilestone.ordinal || 0);
  if (!Number.isFinite(ordinal) || ordinal < 1) return 0;

  // If we are at the last milestone and waiting for committee, it's 100%
  if (ordinal === totalTemplates && currentMilestone.state === "WaitingForCommittee") {
    return 100;
  }

  if (ordinal <= 1) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round(((ordinal - 1) / totalTemplates) * 100)),
  );
}

function getMilestoneLabel(code: string): string {
  const map: Record<string, string> = {
    MS_REG: "Đăng ký đề tài",
    MS_PROG1: "Tiến độ 1",
    MS_PROG2: "Tiến độ 2",
    MS_FULL: "Nộp full",
  };
  return map[code] || code;
}

const StudentProfilesManagement: React.FC = () => {
  const { addToast } = useToast();
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

  const [rows, setRows] = useState<DashboardStudent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [templates, setTemplates] = useState<MilestoneTemplate[]>([]);
  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean;
    row?: DashboardStudent;
  }>({ isOpen: false });
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<
    "info" | "supervisor" | "topic" | "history"
  >("info");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<ProgressHistoryItem[]>([]);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);
  const [activeModal, setActiveModal] = useState<"create" | "edit" | null>(
    null,
  );
  const [editingCode, setEditingCode] = useState("");
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshTick, setRefreshTick] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchKeyword(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const url = selectedPeriodId
          ? `/MilestoneTemplates/get-list?Page=0&PageSize=50&DefenseTermId=${selectedPeriodId}`
          : "/MilestoneTemplates/get-list?Page=0&PageSize=50";
        const response = await fetchData<ApiResponse<MilestoneTemplate[]>>(
          url,
          { method: "GET" },
        );
        if (!response?.success) return;
        setTemplates(response.data || []);
      } catch {
        setTemplates([]);
      }
    };
    void fetchTemplates();
  }, [selectedPeriodId]);

  useEffect(() => {
    const loadRows = async () => {
      if (!selectedPeriodId) {
        setRows([]);
        setTotalCount(0);
        return;
      }
      setIsLoading(true);
      try {
        const query = new URLSearchParams();
        query.append("page", String(Math.max(0, page - 1)));
        query.append("pageSize", String(pageSize));
        query.append("DefenseTermId", String(selectedPeriodId));
        if (searchKeyword) {
          query.append("search", searchKeyword);
        }

        const response = await fetchData<ApiResponse<any>>(
          `/StudentProfiles/get-list?${query.toString()}`,
          { method: "GET" },
        );

        if (!response?.success || !response.data) {
          throw new Error(
            response?.message || "Không thể tải danh sách sinh viên.",
          );
        }

        const payload = response.data;
        const items = Array.isArray(payload.items) ? payload.items : (Array.isArray(payload) ? payload : []);
        setRows(items);
        setTotalCount(
          Number(response.totalCount || 0) > 0
            ? Number(response.totalCount)
            : Number(payload.totalCount || items.length || 0),
        );
      } catch (error) {
        addToast(
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách sinh viên.",
          "error",
        );
        setRows([]);
        setTotalCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    void loadRows();
  }, [addToast, page, pageSize, refreshTick, selectedPeriodId, searchKeyword]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize))),
    [pageSize, totalCount],
  );

  const rowsView = useMemo<DashboardStudent[]>(() => {
    return rows.filter((item) => {
      const q = searchKeyword.toLowerCase();
      const matchSearch =
        !q ||
        item.fullName?.toLowerCase().includes(q) ||
        item.studentCode?.toLowerCase().includes(q) ||
        item.studentEmail?.toLowerCase().includes(q);
      const matchStatus =
        statusFilter === "all" || (item.status || "").toLowerCase().includes(statusFilter.toLowerCase());
      return matchSearch && matchStatus;
    });
  }, [rows, searchKeyword, statusFilter]);

  const openDetail = async (row: DashboardStudent) => {
    const studentCode = String(row.studentCode || "").trim();
    if (!studentCode) {
      addToast("Không xác định được mã sinh viên để tải chi tiết.", "error");
      return;
    }

    setDetailLoading(true);
    setDetailTab("info");
    setHistoryItems([]);
    setHistoryTotalCount(0);
    setDetailModal({ isOpen: true, row });

    try {
      const response = await fetchData<ApiResponse<any>>(
        `/StudentProfiles/get-detail/${encodeURIComponent(studentCode)}`,
        { method: "GET" },
      );

      if (response?.success && response.data) {
        setDetailModal({
          isOpen: true,
          row: response.data,
        });
      }
    } catch {
      // Fallback
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailModal({ isOpen: false });
  };

  const openCreate = async () => {
    try {
      const { data } = await requestApiData<Record<string, unknown>>(
        "/StudentProfiles/get-create",
        { method: "GET" },
        "Không thể tải mẫu tạo mới.",
      );
      setFormValues(toFormRecord(data || {}));
    } catch {
      setFormValues(toFormRecord({}));
    }
    setEditingCode("");
    setActiveModal("create");
  };

  const openEdit = async (row: DashboardStudent) => {
    const code = String(row.studentCode || "").trim();
    if (!code) {
      addToast("Không xác định được mã sinh viên để cập nhật.", "error");
      return;
    }
    try {
      const { data } = await requestApiData<Record<string, unknown>>(
        `/StudentProfiles/get-update/${encodeURIComponent(code)}`,
        { method: "GET" },
        "Không thể tải dữ liệu cập nhật.",
      );
      setFormValues(toFormRecord(data || {}));
      setEditingCode(code);
      setActiveModal("edit");
    } catch (error) {
      addToast(
        error instanceof Error
          ? error.message
          : "Không thể tải dữ liệu cập nhật.",
        "error",
      );
    }
  };

  const handleDelete = async (row: DashboardStudent) => {
    const code = String(row.studentCode || "").trim();
    if (!code) {
      addToast("Không xác định được mã sinh viên để xóa.", "error");
      return;
    }

    if (!window.confirm("Bạn chắc chắn muốn xóa bản ghi này?")) {
      return;
    }

    try {
      await requestApiData<unknown>(
        `/StudentProfiles/delete/${encodeURIComponent(code)}`,
        { method: "DELETE" },
        "Không thể xóa bản ghi.",
      );
      addToast("Xóa dữ liệu thành công.", "success");
      setRefreshTick((prev) => prev + 1);
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Không thể xóa bản ghi.",
        "error",
      );
    }
  };

  const handleSubmit = async () => {
    const payload = toPayload(formValues);
    const requiredField = profileFields.find((field) => {
      if (!field.required) return false;
      const value = payload[field.name];
      return !value || String(value).trim() === "";
    });

    if (requiredField) {
      addToast(`Trường ${requiredField.label} là bắt buộc.`, "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      if (activeModal === "create") {
        if (selectedPeriodId) {
          payload.defenseTermId = selectedPeriodId;
        }
        await requestApiData<unknown>(
          "/StudentProfiles/create",
          { method: "POST", body: payload },
          "Không thể tạo bản ghi.",
        );
        addToast("Tạo mới thành công.", "success");
      }

      if (activeModal === "edit") {
        await requestApiData<unknown>(
          `/StudentProfiles/update/${encodeURIComponent(editingCode)}`,
          { method: "PUT", body: payload },
          "Không thể cập nhật bản ghi.",
        );
        addToast("Cập nhật thành công.", "success");
      }

      setActiveModal(null);
      setRefreshTick((prev) => prev + 1);
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Không thể lưu dữ liệu.",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <div className="student-profiles-module">
      <div className="spm-header">
        <h1>
          <Users size={30} color="#1e3a5f" /> Danh sách sinh viên
        </h1>
        <p>Hiển thị theo dashboard báo cáo sinh viên và tiến độ đề tài.</p>
      </div>

      <div className="spm-toolbar">
        <div className="spm-search-wrap">
          <Search size={16} />
          <input
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
            }}
            placeholder="Tìm kiếm sinh viên, đề tài, mã đề tài..."
          />
        </div>

        <div className="spm-actions-wrap">
          <div className="spm-period-select-wrap">
            <select
              value={selectedPeriodId || ""}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedPeriodId(val ? Number(val) : null);
                setPage(1);
              }}
              className="spm-period-select"
            >
              <option value="">-- Chọn đợt bảo vệ --</option>
              {periods.map((p) => (
                <option key={p.defenseTermId} value={p.defenseTermId}>
                  {p.name} {p.defenseTermId === activePeriodId ? "(Hiện tại)" : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="spm-btn spm-btn-secondary"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={14} /> Bộ lọc
          </button>
          <ImportExportActions
            moduleName="students"
            moduleLabel="Quản lý sinh viên"
            onImportSuccess={() => {
              setPage(1);
              setRefreshTick((prev) => prev + 1);
            }}
          />
          <button type="button" className="spm-create-btn" onClick={openCreate}>
            <Plus size={14} /> Thêm mới
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="spm-filter-panel">
          <div className="spm-filter-grid">
            <div className="spm-filter-field">
              <span>Trạng thái</span>
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="pending">Chờ duyệt</option>
                <option value="approved">Đã duyệt</option>
                <option value="revision">Cần sửa đổi</option>
                <option value="defense-ready">Chờ bảo vệ</option>
                <option value="committee-assigned">đã có HĐ</option>
                <option value="rejected">Từ chối</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="spm-table-wrap">
        <table className="spm-table">
          <thead>
            <tr>
              <th>SINH VIÊN</th>
              <th>LIÊN HỆ</th>
              <th>KHOA / LỚP</th>
              <th>HỌC LỰC / GPA</th>
              <th>TRẠNG THÁI</th>
              <th>THAO TÁC</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6}>Đang tải dữ liệu...</td>
              </tr>
            ) : rowsView.length === 0 ? (
              <tr>
                <td colSpan={6}>Không có dữ liệu.</td>
              </tr>
            ) : (
              rowsView.map((row) => (
                <tr
                  key={row.studentProfileID}
                  className="spm-row"
                >
                  <td>
                    <div className="spm-student-cell">
                      <div className="spm-avatar-wrap">
                        {row.studentImage ? (
                          <img
                            src={getAvatarUrl(row.studentImage)}
                            alt={row.fullName}
                            className="spm-avatar"
                            loading="lazy"
                          />
                        ) : (
                          <div className="spm-avatar-fallback">
                            {row.fullName?.charAt(0) || "S"}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="spm-student-name">
                          {row.fullName}
                        </div>
                        <div className="spm-student-code">
                          {row.studentCode}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div className="spm-muted">
                      {row.studentEmail || "--"}
                    </div>
                    <div className="spm-subtle">
                      {row.phoneNumber || "--"}
                    </div>
                  </td>

                  <td>
                    <div className="spm-muted">{row.departmentCode || "--"}</div>
                    <div className="spm-subtle">{row.classCode || "--"}</div>
                  </td>

                  <td>
                    <div className="spm-muted">{row.academicStanding || "--"}</div>
                    <div className="spm-subtle">GPA: {row.gpa ?? "--"}</div>
                  </td>

                  <td>
                    <span className="spm-status spm-status-approved">
                      {row.status || "Hoạt động"}
                    </span>
                  </td>

                  <td>
                    <div className="spm-action-buttons">
                      <button
                        type="button"
                        className="spm-detail-btn"
                        onClick={() => void openDetail(row)}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        className="spm-edit-btn"
                        onClick={() => void openEdit(row)}
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        type="button"
                        className="spm-delete-btn"
                        onClick={() => void handleDelete(row)}
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        totalCount={totalCount}
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        isLoading={isLoading}
        onPageChange={(nextPage) => setPage(nextPage)}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPage(1);
        }}
      />

      {detailModal.isOpen && detailModal.row && (
        <div className="spm-modal-overlay" onClick={closeDetail}>
          <div
            className="spm-modal spm-detail-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="spm-close" onClick={closeDetail}>
              x
            </button>

            <div className="spm-detail-shell">
              <div className="spm-detail-header">
                <div className="spm-detail-header-left">
                  {detailModal.row.studentImage ? (
                    <img
                      src={getAvatarUrl(detailModal.row.studentImage)}
                      alt={detailModal.row.fullName}
                      className="spm-avatar-lg"
                    />
                  ) : (
                    <div className="spm-avatar-fallback spm-avatar-lg-fallback">
                      {detailModal.row.fullName?.charAt(0) || "S"}
                    </div>
                  )}
                  <div className="spm-detail-header-text">
                    <h3>{detailModal.row.fullName}</h3>
                    <p>
                      {detailModal.row.studentCode} • {detailModal.row.userCode}
                    </p>
                    <div className="spm-detail-subline">
                      <span className="spm-status spm-status-approved">
                        {detailModal.row.status || "Hoạt động"}
                      </span>
                      <span className="spm-detail-gpa">
                        GPA {detailModal.row.gpa ?? "--"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="spm-detail-header-actions">
                  <button
                    type="button"
                    className="spm-edit-btn"
                    onClick={() => {
                      void openEdit(detailModal.row as DashboardStudent);
                      closeDetail();
                    }}
                  >
                    <Edit size={13} />
                    Sửa
                  </button>
                  <button
                    type="button"
                    className="spm-delete-btn"
                    onClick={closeDetail}
                  >
                    Đóng
                  </button>
                </div>
              </div>

              <div className="spm-detail-body">
                {detailLoading ? (
                  <div className="spm-detail-loading">Đang tải chi tiết...</div>
                ) : (
                  <div className="spm-detail-columns">
                    <div className="spm-detail-column">
                      <div className="spm-detail-section spm-info-card">
                        <h4>Thông tin cá nhân</h4>
                        <div className="spm-detail-list">
                          <div>
                            <span>Email</span>
                            <strong>
                              {detailModal.row.studentEmail || "--"}
                            </strong>
                          </div>
                          <div>
                            <span>SĐT</span>
                            <strong>
                              {detailModal.row.phoneNumber || "--"}
                            </strong>
                          </div>
                          <div>
                            <span>Giới tính</span>
                            <strong>
                              {detailModal.row.gender || "--"}
                            </strong>
                          </div>
                          <div>
                            <span>Ngày sinh</span>
                            <strong>
                              {formatDate(detailModal.row.dateOfBirth) || "--"}
                            </strong>
                          </div>
                          <div>
                            <span>Địa chỉ</span>
                            <strong>
                              {detailModal.row.address || "--"}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="spm-detail-column">
                      <div className="spm-detail-section spm-info-card">
                        <h4>Học tập</h4>
                        <div className="spm-detail-list">
                          <div>
                            <span>Khoa</span>
                            <strong>
                              {detailModal.row.departmentCode || "--"}
                            </strong>
                          </div>
                          <div>
                            <span>Lớp</span>
                            <strong>
                              {detailModal.row.classCode || "--"}
                            </strong>
                          </div>
                          <div>
                            <span>Niên khóa</span>
                            <strong>
                              {detailModal.row.enrollmentYear || "--"}
                            </strong>
                          </div>
                          <div>
                            <span>GPA</span>
                            <strong>
                              {detailModal.row.gpa ?? "--"}
                            </strong>
                          </div>
                          <div>
                            <span>Xếp loại</span>
                            <strong>
                              {detailModal.row.academicStanding || "--"}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeModal && (
        <div className="spm-modal-overlay" onClick={() => setActiveModal(null)}>
          <div
            className="spm-modal spm-form-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="spm-close" onClick={() => setActiveModal(null)}>
              x
            </button>

            <div className="spm-modal-header">
              <div>
                <h3>
                  {activeModal === "create"
                    ? "Tạo hồ sơ sinh viên"
                    : "Cập nhật hồ sơ sinh viên"}
                </h3>
                <p>Nhập dữ liệu theo schema StudentProfiles.</p>
              </div>
            </div>

            <ManagementSectionedFormBody
              sections={editFieldSections}
              values={formValues}
              getFieldDefinition={getFieldDefinition}
              onFieldChange={(name, value) =>
                setFormValues((prev) => ({ ...prev, [name]: value }))
              }
            />

            <div className="spm-form-actions">
              <button
                type="button"
                className="spm-cancel-btn"
                onClick={() => setActiveModal(null)}
                disabled={isSubmitting}
              >
                Đóng
              </button>
              <button
                type="button"
                className="spm-save-btn"
                onClick={() => void handleSubmit()}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentProfilesManagement;
