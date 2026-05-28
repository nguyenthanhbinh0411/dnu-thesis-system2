import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import {
  Edit,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Eye,
  User,
  UserCheck,
  Mail,
  Phone,
  Calendar,
  BookOpen,
  CheckCircle,
  Clock,
  FileText,
  Activity,
  Archive,
  TrendingUp,
  RotateCcw,
  X,
  ShieldAlert,
  FileSpreadsheet,
  FileArchive,
  FileImage,
  File,
} from "lucide-react";
import {
  createDefenseTermStudent,
  deleteDefenseTermStudent,
  listDefenseTermStudents,
  updateDefenseTermStudent,
  type DefenseTermStudentPayload,
} from "../../services/defense-term-membership.service";
import { useToast } from "../../context/useToast";
import TablePagination from "../TablePagination/TablePagination";
import DefenseTermStudentsPickerModal, {
  type DefenseTermStudentSelection,
} from "./DefenseTermStudentsPickerModal";

import { fetchData, getAvatarUrl, normalizeUrl } from "../../api/fetchData";
import type { Topic } from "../../types/topic";
import type { LecturerProfile } from "../../types/lecturer-profile";
import type { ProgressMilestone } from "../../types/progressMilestone";
import type { ProgressSubmission } from "../../types/progressSubmission";
import type { SubmissionFile } from "../../types/submissionFile";


type RecordData = Record<string, unknown>;

type DefenseTermStudentRow = {
  defenseTermStudentID: number;
  defenseTermId: number;
  studentProfileID: number;
  studentCode: string;
  userCode: string;
  fullName: string;
  classCode: string;
  facultyCode: string;
  departmentCode: string;
  gpa: number | null;
  createdAt: string;
  updatedAt: string;
  raw: RecordData;
};

type StudentFilterState = {
  search: string;
  studentCode: string;
  userCode: string;
  fromDate: string;
  toDate: string;
  sortBy: string;
  sortDescending: string;
};

const initialFilters: StudentFilterState = {
  search: "",
  studentCode: "",
  userCode: "",
  fromDate: "",
  toDate: "",
  sortBy: "createdAt",
  sortDescending: "true",
};

function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeStudentRow(row: RecordData): DefenseTermStudentRow {
  return {
    defenseTermStudentID: asNumber(
      row.defenseTermStudentID ?? row.DefenseTermStudentID ?? row.id ?? row.Id,
    ),
    defenseTermId: asNumber(row.defenseTermId ?? row.DefenseTermId),
    studentProfileID: asNumber(
      row.studentProfileID ?? row.StudentProfileID ?? row.studentProfileId,
    ),
    studentCode: asString(row.studentCode ?? row.StudentCode),
    userCode: asString(row.userCode ?? row.UserCode),
    fullName: asString(
      row.fullName || row.FullName || row.studentName || row.StudentName || row.name || row.Name || row.studentCode || row.StudentCode
    ),
    classCode: asString(row.classCode ?? row.ClassCode),
    facultyCode: asString(row.facultyCode ?? row.FacultyCode),
    departmentCode: asString(row.departmentCode ?? row.DepartmentCode),
    gpa: asNullableNumber(row.gpa ?? row.GPA),
    createdAt: asString(row.createdAt ?? row.CreatedAt),
    updatedAt: asString(
      row.updatedAt ?? row.UpdatedAt ?? row.lastUpdated ?? row.LastUpdated,
    ),
    raw: row,
  };
}

function toPayload(
  row: DefenseTermStudentSelection,
  defenseTermId: number,
): DefenseTermStudentPayload {
  return {
    defenseTermId,
    studentProfileID: row.studentProfileID,
    studentCode: row.studentCode,
    userCode: row.userCode,
  };
}

interface DefenseTermStudentsSectionProps {
  defenseTermId: number | null;
}

export interface DefenseTermStudentsSectionHandle {
  openAdd: () => void;
}

const DefenseTermStudentsSection = forwardRef<
  DefenseTermStudentsSectionHandle,
  DefenseTermStudentsSectionProps
>(({ defenseTermId }, ref) => {
  const { addToast } = useToast();
  const [rows, setRows] = useState<DefenseTermStudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [filters, setFilters] = useState<StudentFilterState>(initialFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<DefenseTermStudentRow | null>(
    null,
  );

  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean;
    student?: {
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
      milestones?: ProgressMilestone[];
      submissions?: ProgressSubmission[];
      allFiles?: SubmissionFile[];
      lecturerProfile?: LecturerProfile;
      stats?: {
        onTimeRate: number;
        revisionCount: number;
        daysRemaining: number | null;
      };
    };
  }>({ isOpen: false });

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

  const getCurrentOrdinal = (m: ProgressMilestone): number => {
    if (!m.completedAt1) return 1;
    if (!m.completedAt2) return 2;
    if (!m.completedAt3) return 3;
    if (!m.completedAt4) return 4;
    return 4;
  };

  const mapApiStatusToDisplay = (apiStatus: string): "approved" | "pending" | "defense-ready" | "committee-assigned" | "post-defense" => {
    const status = (apiStatus || "").toLowerCase();
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

  const openDetail = async (row: DefenseTermStudentRow) => {
    setLoadingDetail(true);
    setDetailModal({ isOpen: true });

    try {
      const topicResp = await fetchData<{ data: Topic[] }>(
        `/Topics/get-list?ProposerStudentCode=${row.studentCode}&Page=1&PageSize=1`
      );

      const topic = topicResp?.data?.[0];
      if (!topic) {
        addToast(`Sinh viên ${row.fullName} (${row.studentCode}) chưa đăng ký đề tài hoặc không tìm thấy đề tài.`, "warning");
        setDetailModal({ isOpen: false });
        return;
      }

      const topicID = topic.topicID;
      const supervisorCode = topic.supervisorLecturerCode || topic.supervisorUserCode;

      const [submissionsResp, milestonesResp, filesResp, lecturerResp] = await Promise.all([
        fetchData<{ data: ProgressSubmission[] }>(`/ProgressSubmissions/get-list?StudentProfileCode=${row.studentCode}&Page=1&PageSize=100`),
        fetchData<{ data: ProgressMilestone[] }>(`/ProgressMilestones/get-list?TopicID=${topicID}&Page=1&PageSize=100`),
        fetchData<{ data: SubmissionFile[] }>(`/SubmissionFiles/get-list?UploadedByUserCode=${row.studentCode}`),
        supervisorCode 
          ? fetchData<{ data: LecturerProfile[] }>(`/LecturerProfiles/get-list?LecturerCode=${supervisorCode}`)
          : Promise.resolve({ data: [] })
      ]);

      const submissions = submissionsResp?.data || [];
      const milestones = milestonesResp?.data || [];
      const allFiles = filesResp?.data || [];
      const lecturerProfile = lecturerResp?.data?.[0] || undefined;

      const stats = calculateStats(milestones, submissions);
      const progress = calculateProgress(milestones);

      setDetailModal({
        isOpen: true,
        student: {
          studentCode: row.studentCode,
          studentName: row.fullName,
          email: row.raw?.studentEmail as string || row.raw?.email as string || "",
          phone: row.raw?.phoneNumber as string || row.raw?.phone as string || "",
          topicTitle: topic.title,
          topicCode: topic.topicCode,
          registrationDate: topic.createdAt,
          status: mapApiStatusToDisplay(topic.status),
          progress,
          lastActivity: topic.lastUpdated,
          topic,
          milestones,
          submissions,
          allFiles,
          lecturerProfile,
          stats
        }
      });
    } catch (err) {
      console.error("Failed to fetch student details:", err);
      addToast("Không thể tải chi tiết sinh viên. Vui lòng thử lại sau.", "error");
      setDetailModal({ isOpen: false });
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetailModal = () => {
    setDetailModal({ isOpen: false });
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchKeyword(searchInput.trim());
      setFilters((prev) => ({ ...prev, search: searchInput.trim() }));
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const listQuery = useMemo(
    () => ({
      defenseTermId: defenseTermId ?? undefined,
      search: searchKeyword,
      studentCode: filters.studentCode,
      userCode: filters.userCode,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      sortBy: filters.sortBy,
      sortDescending: filters.sortDescending === "true",
      page,
      pageSize,
    }),
    [defenseTermId, filters, page, pageSize, searchKeyword],
  );

  const loadRows = useCallback(async () => {
    if (defenseTermId == null) {
      setRows([]);
      setTotalCount(0);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await listDefenseTermStudents(listQuery);
      setRows(response.data.map(normalizeStudentRow));
      setTotalCount(response.totalCount);
    } catch (loadError) {
      setRows([]);
      setTotalCount(0);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải danh sách sinh viên trong đợt.",
      );
    } finally {
      setLoading(false);
    }
  }, [defenseTermId, listQuery]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize))),
    [pageSize, totalCount],
  );

  const openAdd = useCallback(() => {
    if (defenseTermId == null) {
      addToast("Vui lòng chọn một đợt trước khi thêm sinh viên.", "warning");
      return;
    }
    setEditingRow(null);
    setPickerOpen(true);
  }, [addToast, defenseTermId]);

  useImperativeHandle(ref, () => ({ openAdd }), [openAdd]);

  const openEdit = (row: DefenseTermStudentRow) => {
    setEditingRow(row);
    setPickerOpen(true);
  };

  const handleDelete = async (row: DefenseTermStudentRow) => {
    if (!row.defenseTermStudentID) {
      addToast("Không xác định được bản ghi để xóa.", "error");
      return;
    }
    if (
      !window.confirm(
        `Xóa sinh viên ${row.studentCode || row.fullName || "này"}?`,
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      await deleteDefenseTermStudent(row.defenseTermStudentID);
      addToast("Đã xóa sinh viên trong đợt.", "success");
      await loadRows();
    } catch (deleteError) {
      addToast(
        deleteError instanceof Error
          ? deleteError.message
          : "Không thể xóa sinh viên.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSelection = async (
    selected: DefenseTermStudentSelection[],
  ) => {
    if (defenseTermId == null) {
      return;
    }
    if (selected.length === 0) {
      addToast("Chưa chọn sinh viên nào.", "warning");
      return;
    }

    setSaving(true);
    try {
      if (editingRow) {
        const first = selected[0];
        await updateDefenseTermStudent(editingRow.defenseTermStudentID, {
          defenseTermId,
          studentProfileID: first.studentProfileID,
          studentCode: first.studentCode,
          userCode: first.userCode,
        } as DefenseTermStudentPayload);
        addToast("Đã cập nhật sinh viên trong đợt.", "success");
      } else {
        const existingIds = new Set(rows.map((r) => r.studentProfileID));
        const newSelected = selected.filter(
          (item) => !existingIds.has(item.studentProfileID),
        );

        if (newSelected.length > 0) {
          await Promise.all(
            newSelected.map((item) =>
              createDefenseTermStudent(toPayload(item, defenseTermId)),
            ),
          );
          addToast(`Đã thêm ${newSelected.length} sinh viên mới vào đợt.`, "success");
        } else {
          addToast("Không có sinh viên mới nào được chọn để thêm.", "info");
        }
      }
      setPickerOpen(false);
      setEditingRow(null);
      await loadRows();
    } catch (submitError) {
      addToast(
        submitError instanceof Error
          ? submitError.message
          : "Không thể lưu sinh viên vào đợt.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const resetFilters = () => {
    setSearchInput("");
    setSearchKeyword("");
    setFilters(initialFilters);
    setPage(1);
  };

  return (
    <section
      style={{
        border: "1px solid #cbd5e1",
        borderRadius: 10,
        background: "#ffffff",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          padding: "14px 18px",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
            Sinh viên trong đợt
          </div>
          <div style={{ marginTop: 2, color: "#475569", fontSize: 12 }}>
            {rows.length} hàng
          </div>
        </div>
      </div>

      <div
        style={{
          padding: "12px 18px",
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr",
          gap: 10,
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 11, color: "#0f172a" }}>Tìm kiếm</span>
          <div style={{ position: "relative" }}>
            <Search
              size={13}
              style={{
                position: "absolute",
                left: 10,
                top: 9,
                color: "#1e3a5f",
              }}
            />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tên, mã SV, mã user"
              style={{
                width: "100%",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "8px 10px 8px 32px",
                fontSize: 12,
              }}
            />
          </div>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 11, color: "#0f172a" }}>Sắp xếp</span>
          <select
            value={filters.sortBy}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, sortBy: event.target.value }))
            }
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 12,
            }}
          >
            <option value="createdAt">CreatedAt</option>
            <option value="updatedAt">UpdatedAt</option>
            <option value="studentCode">StudentCode</option>
            <option value="userCode">UserCode</option>
          </select>
        </label>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
          <button
            type="button"
            onClick={() => setPage(1)}
            style={{
              border: "1px solid #1e3a5f",
              background: "#1e3a5f",
              color: "#ffffff",
              borderRadius: 8,
              padding: "8px 10px",
              fontWeight: 600,
              fontSize: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              flex: 1,
            }}
          >
            <Filter size={12} /> Áp dụng
          </button>
          <button
            type="button"
            onClick={resetFilters}
            style={{
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#0f172a",
              borderRadius: 8,
              padding: "8px 10px",
              fontWeight: 600,
              fontSize: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {error ? (
        <div
          style={{
            padding: 12,
            color: "#b91c1c",
            background: "#fff1f2",
            borderBottom: "1px solid #fecdd3",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc", textAlign: "left" }}>
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>Mã SV</th>
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>Sinh viên</th>
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>User</th>
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>Lớp</th>
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>Khoa</th>
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>GPA</th>
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.defenseTermStudentID || row.studentProfileID}
                style={{ borderTop: "1px solid #e2e8f0" }}
              >
                <td
                  style={{ padding: "10px 12px", verticalAlign: "top", fontWeight: 700, fontSize: 13, color: "#0f172a" }}
                >
                  {row.studentCode || "--"}
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>
                    {row.fullName || "--"}
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                    {row.studentProfileID || "--"}
                  </div>
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", fontSize: 13, color: "#0f172a" }}>
                  {row.userCode || "--"}
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", fontSize: 13, color: "#0f172a" }}>
                  {row.classCode || "--"}
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", fontSize: 13, color: "#0f172a" }}>
                  {row.departmentCode || "--"}
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", fontSize: 13, color: "#0f172a" }}>
                  {row.gpa ?? "--"}
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top" }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => void openDetail(row)}
                      style={{
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#0f172a",
                        borderRadius: 8,
                        padding: "6px 8px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      <Eye size={12} /> Chi tiết
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      style={{
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#0f172a",
                        borderRadius: 8,
                        padding: "6px 8px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      <Edit size={12} /> Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(row)}
                      disabled={saving}
                      style={{
                        border: "1px solid #ef4444",
                        background: "#ffffff",
                        color: "#b91c1c",
                        borderRadius: 8,
                        padding: "6px 8px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={12} /> Xóa
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  style={{ padding: 24, textAlign: "center", color: "#64748b" }}
                >
                  Chưa có sinh viên trong đợt.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div style={{ padding: 12, borderTop: "1px solid #e2e8f0" }}>
        <TablePagination
          totalCount={totalCount}
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          isLoading={loading}
          pageSizeOptions={[10, 20, 50, 100]}
          totalLabel="Tổng sinh viên:"
          pageSizeLabel="Số dòng/trang"
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      </div>

      <DefenseTermStudentsPickerModal
        isOpen={pickerOpen}
        defenseTermId={defenseTermId}
        initialSelectedIds={
          editingRow
            ? [editingRow.studentProfileID]
            : rows.map((r) => r.studentProfileID)
        }
        initialSelections={
          editingRow
            ? [
                {
                  studentProfileID: editingRow.studentProfileID,
                  studentCode: editingRow.studentCode,
                  userCode: editingRow.userCode,
                  fullName: editingRow.fullName,
                  classCode: editingRow.classCode,
                  facultyCode: editingRow.facultyCode,
                  departmentCode: editingRow.departmentCode,
                  gpa: editingRow.gpa,
                  studentImage: "",
                  raw: editingRow.raw,
                },
              ]
            : rows.map((r) => ({
                studentProfileID: r.studentProfileID,
                studentCode: r.studentCode,
                userCode: r.userCode,
                fullName: r.fullName,
                classCode: r.classCode,
                facultyCode: r.facultyCode,
                departmentCode: r.departmentCode,
                gpa: r.gpa,
                studentImage: "",
                raw: r.raw,
              }))
        }
        title={
          editingRow ? "Sửa sinh viên trong đợt" : "Thêm sinh viên vào đợt"
        }
        subtitle={
          editingRow
            ? "Chọn một sinh viên mới để thay thế bản ghi hiện tại."
            : "Chọn nhiều sinh viên từ danh sách nguồn để thêm vào đợt."
        }
        onClose={() => {
          setPickerOpen(false);
          setEditingRow(null);
        }}
        onConfirm={handleConfirmSelection}
      />

      {detailModal.isOpen && (
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
              {loadingDetail || !detailModal.student ? (
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
                      <div style={{ fontSize: "14px", color: "#64748b", fontWeight: "600" }}>
                        Sinh viên thực hiện: <span style={{ color: "#0f172a", fontWeight: "800" }}>{detailModal.student.studentName}</span> ({detailModal.student.studentCode})
                      </div>
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

                    {/* Timeline */}
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
                          const milestoneList = [
                            { code: "MS_REG", name: "Đăng ký" },
                            { code: "MS_PROG1", name: "Đề cương" },
                            { code: "MS_PROG2", name: "Báo cáo" },
                            { 
                              code: "MS_FULL", 
                              name: currentState === "WaitingForCommittee" ? "Khóa luận hoàn chỉnh" : "Hoàn thiện" 
                            }
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
                            
                            if (idx === 3 && currentState === "WaitingForCommittee") {
                              isCompleted = true;
                            }

                            let isCurrent = false;
                            if (firstNotCompletedIdx === idx && currentState !== "WaitingForCommittee") {
                              isCurrent = true;
                            }

                            return (
                              <React.Fragment key={m.code}>
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
                                {idx < 3 && (
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

                    {/* Submission History */}
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
                                          {sub.ordinal === 1 ? "Đăng ký đề tài" :
                                           sub.ordinal === 2 ? "Đề cương" :
                                           sub.ordinal === 3 ? "Báo cáo" :
                                           sub.ordinal === 4 ? "Hoàn thiện khóa luận" :
                                           sub.ordinal === 5 ? "Bảo vệ luận văn" :
                                           sub.milestoneCode || `Mốc ${sub.ordinal}`}
                                        </div>
                                        <div style={{ fontSize: "11px", fontWeight: "600", color: "#94a3b8" }}>Lần nộp: {sub.attemptNumber}</div>
                                      </td>
                                      <td style={{ padding: "16px" }}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                          {subFiles.length > 0 ? subFiles.map(file => {
                                            const fileInfo = getFileIconAndColor(file.fileName);
                                            return (
                                              <div key={file.fileID} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                {fileInfo.icon}
                                                <span 
                                                  style={{ fontSize: "12px", fontWeight: "700", color: "#334155", cursor: "pointer", textDecoration: "underline" }}
                                                  onClick={() => window.open(normalizeUrl(file.fileURL), '_blank')}
                                                  title={`${fileInfo.label} file`}
                                                >
                                                  {file.fileName}
                                                </span>
                                              </div>
                                            );
                                          }) : (
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

                  {/* --- RIGHT: SUPERVISOR PROFILE (3 cols) --- */}
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
                          {detailModal.student.lecturerProfile?.profileImage ? (
                            <img
                              src={getAvatarUrl(
                                detailModal.student.lecturerProfile.profileImage,
                              )}
                              alt={detailModal.student.lecturerProfile.fullName}
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
                        {detailModal.student.lecturerProfile?.fullName || "Chưa phân công giảng viên"}
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
                          GVHD: {detailModal.student.lecturerProfile?.lecturerCode || "---"}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: "12px" }}>
                      {[
                        {
                          icon: <Mail size={16} />,
                          label: "Email giảng viên",
                          value: detailModal.student.lecturerProfile?.email || "---",
                        },
                        {
                          icon: <Phone size={16} />,
                          label: "Số điện thoại",
                          value: detailModal.student.lecturerProfile?.phoneNumber || "---",
                        },
                        {
                          icon: <BookOpen size={16} />,
                          label: "Khoa",
                          value: detailModal.student.lecturerProfile?.departmentCode || "---",
                        },
                        {
                          icon: <UserCheck size={16} />,
                          label: "Học vị / Học hàm",
                          value: detailModal.student.lecturerProfile?.degree || "---",
                        },
                        {
                          icon: <TrendingUp size={16} />,
                          label: "Số lượng hướng dẫn",
                          value: detailModal.student.lecturerProfile 
                            ? `${detailModal.student.lecturerProfile.currentGuidingCount}/${detailModal.student.lecturerProfile.guideQuota}` 
                            : "---",
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
    </section>
  );
});

DefenseTermStudentsSection.displayName = "DefenseTermStudentsSection";

export default DefenseTermStudentsSection;
