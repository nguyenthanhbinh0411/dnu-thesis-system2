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
  Mail,
  Phone,
  User,
  UserCheck,
  BookOpen,
  CheckCircle,
  Clock,
  Archive,
  TrendingUp,
  RotateCcw,
  X,
  ShieldAlert,
  LayoutGrid,
  List,
} from "lucide-react";
import {
  createDefenseTermLecturer,
  deleteDefenseTermLecturer,
  updateDefenseTermLecturer,
  listDefenseTermLecturers,
  type DefenseTermLecturerPayload,
} from "../../services/defense-term-membership.service";
import { useToast } from "../../context/useToast";
import TablePagination from "../TablePagination/TablePagination";
import DefenseTermLecturersPickerModal, {
  type DefenseTermLecturerSelection,
} from "./DefenseTermLecturersPickerModal";

import { fetchData, getAvatarUrl, normalizeUrl } from "../../api/fetchData";
import type { Topic } from "../../types/topic";
import type { LecturerProfile } from "../../types/lecturer-profile";
import type { StudentProfile } from "../../types/studentProfile";
import type { ProgressMilestone } from "../../types/progressMilestone";
import type { ProgressSubmission } from "../../types/progressSubmission";

type RecordData = Record<string, unknown>;

type DefenseTermLecturerRow = {
  defenseTermLecturerID: number;
  defenseTermId: number;
  lecturerProfileID: number;
  lecturerCode: string;
  userCode: string;
  fullName: string;
  departmentCode: string;
  degree: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  raw: RecordData;
};

type LecturerFilterState = {
  search: string;
  departmentCode: string;
  degree: string;
  tagCodes: string;
  tags: string;
  lecturerCode: string;
  userCode: string;
  role: string;
  isPrimary: string;
  fromDate: string;
  toDate: string;
  sortBy: string;
  sortDescending: string;
};

const initialFilters: LecturerFilterState = {
  search: "",
  departmentCode: "",
  degree: "",
  tagCodes: "",
  tags: "",
  lecturerCode: "",
  userCode: "",
  role: "",
  isPrimary: "",
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

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const text = asString(value).toLowerCase();
  return ["1", "true", "yes", "y", "on", "đúng", "co"].includes(text);
}

function toRoleList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(asString).filter(Boolean);
  }
  return asString(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeLecturerRow(row: RecordData): DefenseTermLecturerRow {
  return {
    defenseTermLecturerID: asNumber(
      row.defenseTermLecturerID ??
        row.DefenseTermLecturerID ??
        row.id ??
        row.Id,
    ),
    defenseTermId: asNumber(row.defenseTermId ?? row.DefenseTermId),
    lecturerProfileID: asNumber(
      row.lecturerProfileID ?? row.LecturerProfileID ?? row.lecturerProfileId,
    ),
    lecturerCode: asString(row.lecturerCode ?? row.LecturerCode),
    userCode: asString(row.userCode ?? row.UserCode),
    fullName: asString(
      row.fullName || row.FullName || row.lecturerName || row.LecturerName || row.name || row.Name || row.lecturerCode || row.LecturerCode
    ),
    departmentCode: asString(row.departmentCode ?? row.DepartmentCode),
    degree: asString(row.degree ?? row.Degree),
    isPrimary: asBoolean(row.isPrimary ?? row.IsPrimary),
    createdAt: asString(row.createdAt ?? row.CreatedAt),
    updatedAt: asString(
      row.updatedAt ?? row.UpdatedAt ?? row.lastUpdated ?? row.LastUpdated,
    ),
    raw: row,
  };
}

function toPayload(
  row: DefenseTermLecturerSelection,
  defenseTermId: number,
): DefenseTermLecturerPayload {
  return {
    defenseTermId,
    lecturerProfileID: row.lecturerProfileID,
    lecturerCode: row.lecturerCode,
    userCode: row.userCode,
    isPrimary: row.isPrimary,
  };
}

interface DefenseTermLecturersSectionProps {
  defenseTermId: number | null;
}

export interface DefenseTermLecturersSectionHandle {
  openAdd: () => void;
}

const DefenseTermLecturersSection = forwardRef<
  DefenseTermLecturersSectionHandle,
  DefenseTermLecturersSectionProps
>(({ defenseTermId }, ref) => {
  const { addToast } = useToast();
  const [rows, setRows] = useState<DefenseTermLecturerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [filters, setFilters] = useState<LecturerFilterState>(initialFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<DefenseTermLecturerRow | null>(
    null,
  );

  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailViewMode, setDetailViewMode] = useState<"card" | "table">("card");
  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean;
    lecturer?: {
      lecturerCode: string;
      fullName: string;
      email: string;
      phone: string;
      departmentCode: string;
      degree: string;
      profileImage: string;
      currentGuidingCount: number;
      guideQuota: number;
      raw: RecordData;
      students: Array<{
        studentCode: string;
        studentName: string;
        classCode: string;
        topicTitle: string;
        topicCode: string;
        progress: number;
        status: "approved" | "pending" | "defense-ready" | "committee-assigned" | "post-defense";
        stats: {
          onTimeRate: number;
          revisionCount: number;
          daysRemaining: number | null;
        };
        milestones: ProgressMilestone[];
        submissions: ProgressSubmission[];
      }>;
    };
  }>({ isOpen: false });

  const getCurrentOrdinal = (m: ProgressMilestone): number => {
    if (!m.completedAt1) return 1;
    if (!m.completedAt2) return 2;
    if (!m.completedAt3) return 3;
    if (!m.completedAt4) return 4;
    return 4;
  };

  const getCurrentMilestone = (milestones: ProgressMilestone[]) => {
    if (milestones.length === 0) return null;

    const sortedMilestones = [...milestones].sort(
      (a, b) => (a.ordinal || 0) - (b.ordinal || 0),
    );

    const currentMilestone = sortedMilestones.find(
      (m) => m.state !== "completed",
    );
    return currentMilestone || sortedMilestones[sortedMilestones.length - 1];
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

  const openDetail = async (row: DefenseTermLecturerRow) => {
    setLoadingDetail(true);
    setDetailModal({ isOpen: true });

    try {
      const lecturerResp = await fetchData<{ data: LecturerProfile[] }>(
        `/LecturerProfiles/get-list?LecturerCode=${row.lecturerCode}&Page=1&PageSize=1`
      );
      const lecturerProfile = lecturerResp?.data?.[0];

      const topicsResp = await fetchData<{ data: Topic[] }>(
        `/Topics/get-list?SupervisorUserCode=${row.userCode}&Page=1&PageSize=100`
      );
      const topics = topicsResp?.data || [];

      const supervisedStudents = await Promise.all(
        topics.map(async (topic) => {
          try {
            const [studentProfileResp, milestonesResp, submissionsResp] = await Promise.all([
              fetchData<{ data: StudentProfile[] }>(`/StudentProfiles/get-list?StudentCode=${topic.proposerStudentCode}&Page=1&PageSize=1`),
              fetchData<{ data: ProgressMilestone[] }>(`/ProgressMilestones/get-list?TopicID=${topic.topicID}&Page=1&PageSize=100`),
              fetchData<{ data: ProgressSubmission[] }>(`/ProgressSubmissions/get-list?StudentProfileCode=${topic.proposerStudentCode}&Page=1&PageSize=100`)
            ]);

            const studentProfile = studentProfileResp?.data?.[0];
            const milestones = milestonesResp?.data || [];
            const submissions = submissionsResp?.data || [];

            const progress = calculateProgress(milestones);
            const stats = calculateStats(milestones, submissions);

            return {
              studentCode: topic.proposerStudentCode,
              studentName: studentProfile?.fullName || topic.proposerStudentCode,
              classCode: studentProfile?.classCode || "---",
              topicTitle: topic.title,
              topicCode: topic.topicCode,
              progress,
              status: mapApiStatusToDisplay(topic.status),
              stats,
              milestones,
              submissions
            };
          } catch (studentErr) {
            console.error(`Failed to fetch supervised student details: ${topic.proposerStudentCode}`, studentErr);
            return {
              studentCode: topic.proposerStudentCode,
              studentName: topic.proposerStudentCode,
              classCode: "---",
              topicTitle: topic.title,
              topicCode: topic.topicCode,
              progress: 0,
              status: "pending" as const,
              stats: { onTimeRate: 100, revisionCount: 0, daysRemaining: null },
              milestones: [],
              submissions: []
            };
          }
        })
      );

      setDetailModal({
        isOpen: true,
        lecturer: {
          lecturerCode: row.lecturerCode,
          fullName: row.fullName,
          email: lecturerProfile?.email || row.raw?.email as string || "---",
          phone: lecturerProfile?.phoneNumber || row.raw?.phoneNumber as string || "---",
          departmentCode: row.departmentCode,
          degree: row.degree,
          profileImage: lecturerProfile?.profileImage || "",
          currentGuidingCount: lecturerProfile?.currentGuidingCount || 0,
          guideQuota: lecturerProfile?.guideQuota || 0,
          raw: row.raw,
          students: supervisedStudents
        }
      });
    } catch (err) {
      console.error("Failed to fetch lecturer details modal data:", err);
      addToast("Không thể tải chi tiết giảng viên. Vui lòng thử lại sau.", "error");
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
      departmentCode: filters.departmentCode,
      degree: filters.degree,
      tagCodes: filters.tagCodes,
      tags: filters.tags,
      lecturerCode: filters.lecturerCode,
      userCode: filters.userCode,
      isPrimary:
        filters.isPrimary === "" ? undefined : filters.isPrimary === "true",
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
      const response = await listDefenseTermLecturers(listQuery);
      setRows(response.data.map(normalizeLecturerRow));
      setTotalCount(response.totalCount);
    } catch (loadError) {
      setRows([]);
      setTotalCount(0);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải danh sách giảng viên trong đợt.",
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
      addToast("Vui lòng chọn một đợt trước khi thêm giảng viên.", "warning");
      return;
    }
    setEditingRow(null);
    setPickerOpen(true);
  }, [addToast, defenseTermId]);

  useImperativeHandle(ref, () => ({ openAdd }), [openAdd]);

  const openEdit = (row: DefenseTermLecturerRow) => {
    setEditingRow(row);
    setPickerOpen(true);
  };

  const handleDelete = async (row: DefenseTermLecturerRow) => {
    if (!row.defenseTermLecturerID) {
      addToast("Không xác định được bản ghi để xóa.", "error");
      return;
    }
    if (
      !window.confirm(
        `Xóa giảng viên ${row.lecturerCode || row.fullName || "này"}?`,
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      await deleteDefenseTermLecturer(row.defenseTermLecturerID);
      addToast("Đã xóa giảng viên trong đợt.", "success");
      await loadRows();
    } catch (deleteError) {
      addToast(
        deleteError instanceof Error
          ? deleteError.message
          : "Không thể xóa giảng viên.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSelection = async (
    selected: DefenseTermLecturerSelection[],
  ) => {
    if (defenseTermId == null) {
      return;
    }
    if (selected.length === 0) {
      addToast("Chưa chọn giảng viên nào.", "warning");
      return;
    }

    setSaving(true);
    try {
      if (editingRow) {
        const first = selected[0];
        await updateDefenseTermLecturer(
          editingRow.defenseTermLecturerID,
          toPayload(first, defenseTermId),
        );
        addToast("Đã cập nhật giảng viên trong đợt.", "success");
      } else {
        await Promise.all(
          selected.map((item) =>
            createDefenseTermLecturer({
              ...toPayload(item, defenseTermId),
            }),
          ),
        );
        addToast("Đã thêm giảng viên vào đợt.", "success");
      }
      setPickerOpen(false);
      setEditingRow(null);
      await loadRows();
    } catch (submitError) {
      addToast(
        submitError instanceof Error
          ? submitError.message
          : "Không thể lưu giảng viên vào đợt.",
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
            Giảng viên trong đợt
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
              placeholder="Tên, mã GV, mã user"
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
          <span style={{ fontWeight: 600, fontSize: 11, color: "#0f172a" }}>Khoa</span>
          <input
            value={filters.departmentCode}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                departmentCode: event.target.value,
              }))
            }
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 12,
            }}
          />
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
            onClick={() => {
              setFilters(initialFilters);
              setSearchInput("");
              setPage(1);
            }}
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
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>Mã GV</th>
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>Giảng viên</th>
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>User</th>
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>Khoa</th>
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>Học vị</th>
              <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", color: "#0f172a", letterSpacing: "0.02em" }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.defenseTermLecturerID}
                style={{ borderTop: "1px solid #e2e8f0" }}
              >
                <td
                  style={{ padding: "10px 12px", verticalAlign: "top", fontWeight: 700, fontSize: 13, color: "#0f172a" }}
                >
                  {row.lecturerCode || "--"}
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>
                    {row.fullName || "--"}
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                    {row.lecturerProfileID || "--"}
                  </div>
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", fontSize: 13, color: "#0f172a" }}>
                  {row.userCode || "--"}
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", fontSize: 13, color: "#0f172a" }}>
                  {row.departmentCode || "--"}
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", fontSize: 13, color: "#0f172a" }}>
                  {row.degree || "--"}
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
                  colSpan={6}
                  style={{ padding: 24, textAlign: "center", color: "#64748b" }}
                >
                  Chưa có giảng viên trong đợt.
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
          totalLabel="Tổng giảng viên:"
          pageSizeLabel="Số dòng/trang"
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      </div>

      <DefenseTermLecturersPickerModal
        isOpen={pickerOpen}
        defenseTermId={defenseTermId}
        initialSelectedIds={editingRow ? [editingRow.lecturerProfileID] : []}
        initialSelections={
          editingRow
            ? [
                {
                  lecturerProfileID: editingRow.lecturerProfileID,
                  lecturerCode: editingRow.lecturerCode,
                  userCode: editingRow.userCode,
                  fullName: editingRow.fullName,
                  departmentCode: editingRow.departmentCode,
                  degree: editingRow.degree,
                  profileImage: "",
                  isPrimary: editingRow.isPrimary,
                  raw: editingRow.raw,
                },
              ]
            : []
        }
        title={
          editingRow ? "Sửa giảng viên trong đợt" : "Thêm giảng viên vào đợt"
        }
        subtitle={
          editingRow
            ? "Chọn một giảng viên mới và cấu hình lại trạng thái chính cho bản ghi hiện tại."
            : "Chọn nhiều giảng viên trước khi lưu."
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
              {loadingDetail || !detailModal.lecturer ? (
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
                  {/* --- LEFT: SUPERVISED STUDENTS LIST (7 cols) --- */}
                  <div
                    style={{
                      gridColumn: "span 7",
                      padding: "40px",
                      backgroundColor: "white",
                    }}
                  >
                    {(() => {
                      const students = detailModal.lecturer.students;
                      const totalStudents = students.length;
                      const avgProgress = totalStudents > 0 
                        ? Math.round(students.reduce((acc, curr) => acc + curr.progress, 0) / totalStudents)
                        : 0;
                      const avgOnTimeRate = totalStudents > 0
                        ? Math.round(students.reduce((acc, curr) => acc + curr.stats.onTimeRate, 0) / totalStudents)
                        : 100;
                      const totalRevisions = students.reduce((acc, curr) => acc + curr.stats.revisionCount, 0);

                      return (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "28px", gap: "16px", flexWrap: "wrap" }}>
                            <div>
                              <span
                                style={{
                                  padding: "6px 12px",
                                  background: "rgba(243, 112, 33, 0.1)",
                                  color: "#f37021",
                                  borderRadius: "10px",
                                  fontSize: "12px",
                                  fontWeight: "800",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                Đợt bảo vệ hoạt động
                              </span>
                              <h2
                                style={{
                                  fontSize: "28px",
                                  fontWeight: "800",
                                  color: "#0f172a",
                                  lineHeight: "1.2",
                                  marginTop: "12px",
                                  marginBottom: "6px",
                                }}
                              >
                                Danh sách sinh viên hướng dẫn
                              </h2>
                              <p style={{ fontSize: "14px", color: "#64748b", fontWeight: "600", margin: 0 }}>
                                Tổng số: <span style={{ color: "#0f172a", fontWeight: "800" }}>{totalStudents}</span> sinh viên đang được giảng viên hướng dẫn.
                              </p>
                            </div>

                            {/* View Mode Toggle */}
                            <div
                              style={{
                                display: "flex",
                                background: "#f1f5f9",
                                borderRadius: "10px",
                                padding: "4px",
                                border: "1px solid #e2e8f0",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => setDetailViewMode("card")}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  padding: "6px 12px",
                                  border: "none",
                                  borderRadius: "8px",
                                  fontSize: "12px",
                                  fontWeight: "800",
                                  cursor: "pointer",
                                  transition: "all 0.2s ease",
                                  background: detailViewMode === "card" ? "#ffffff" : "transparent",
                                  color: detailViewMode === "card" ? "#f37021" : "#64748b",
                                  boxShadow: detailViewMode === "card" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
                                }}
                              >
                                <LayoutGrid size={14} /> Dạng Card
                              </button>
                              <button
                                type="button"
                                onClick={() => setDetailViewMode("table")}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  padding: "6px 12px",
                                  border: "none",
                                  borderRadius: "8px",
                                  fontSize: "12px",
                                  fontWeight: "800",
                                  cursor: "pointer",
                                  transition: "all 0.2s ease",
                                  background: detailViewMode === "table" ? "#ffffff" : "transparent",
                                  color: detailViewMode === "table" ? "#f37021" : "#64748b",
                                  boxShadow: detailViewMode === "table" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
                                }}
                              >
                                <List size={14} /> Dạng Bảng
                              </button>
                            </div>
                          </div>

                          {/* Workload Statistics Cards */}
                          {totalStudents > 0 && (
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(4, 1fr)",
                                gap: "16px",
                                marginBottom: "24px",
                              }}
                            >
                              <div
                                style={{
                                  padding: "16px",
                                  background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
                                  borderRadius: "16px",
                                  border: "1px solid #fed7aa",
                                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "12px",
                                }}
                              >
                                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(243, 112, 33, 0.1)", display: "flex", alignItems: "center", justifyCenter: "center", color: "#f37021", flexShrink: 0 }}>
                                  <User size={18} style={{ margin: "auto" }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: "10px", fontWeight: "800", color: "#c2410c", textTransform: "uppercase" }}>Tổng học viên</div>
                                  <div style={{ fontSize: "18px", fontWeight: "900", color: "#9a3412" }}>{totalStudents} SV</div>
                                </div>
                              </div>

                              <div
                                style={{
                                  padding: "16px",
                                  background: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)",
                                  borderRadius: "16px",
                                  border: "1px solid #7dd3fc",
                                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "12px",
                                }}
                              >
                                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(3, 105, 161, 0.1)", display: "flex", alignItems: "center", justifyCenter: "center", color: "#0369a1", flexShrink: 0 }}>
                                  <TrendingUp size={18} style={{ margin: "auto" }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: "10px", fontWeight: "800", color: "#0369a1", textTransform: "uppercase" }}>Tiến độ TB</div>
                                  <div style={{ fontSize: "18px", fontWeight: "900", color: "#075985" }}>{avgProgress}%</div>
                                </div>
                              </div>

                              <div
                                style={{
                                  padding: "16px",
                                  background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
                                  borderRadius: "16px",
                                  border: "1px solid #6ee7b7",
                                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "12px",
                                }}
                              >
                                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(5, 150, 105, 0.1)", display: "flex", alignItems: "center", justifyCenter: "center", color: "#059669", flexShrink: 0 }}>
                                  <CheckCircle size={18} style={{ margin: "auto" }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: "10px", fontWeight: "800", color: "#047857", textTransform: "uppercase" }}>Đúng hạn TB</div>
                                  <div style={{ fontSize: "18px", fontWeight: "900", color: "#065f46" }}>{avgOnTimeRate}%</div>
                                </div>
                              </div>

                              <div
                                style={{
                                  padding: "16px",
                                  background: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)",
                                  borderRadius: "16px",
                                  border: "1px solid #fca5a5",
                                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "12px",
                                }}
                              >
                                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(220, 38, 38, 0.1)", display: "flex", alignItems: "center", justifyCenter: "center", color: "#dc2626", flexShrink: 0 }}>
                                  <RotateCcw size={18} style={{ margin: "auto" }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: "10px", fontWeight: "800", color: "#b91c1c", textTransform: "uppercase" }}>Số lần sửa</div>
                                  <div style={{ fontSize: "18px", fontWeight: "900", color: "#991b1b" }}>{totalRevisions} lần</div>
                                </div>
                              </div>
                            </div>
                          )}

                          {detailViewMode === "table" ? (
                            /* --- DẠNG BẢNG (TABLE VIEW) --- */
                            <div
                              style={{
                                background: "white",
                                borderRadius: "20px",
                                border: "1px solid #e2e8f0",
                                overflow: "hidden",
                                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                              }}
                            >
                              <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "750px" }}>
                                  <thead>
                                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                                      <th style={{ padding: "16px 14px", fontSize: "11px", fontWeight: "900", color: "#64748b", textTransform: "uppercase", width: "200px" }}>Sinh viên</th>
                                      <th style={{ padding: "16px 14px", fontSize: "11px", fontWeight: "900", color: "#64748b", textTransform: "uppercase" }}>Đề tài khóa luận</th>
                                      <th style={{ padding: "16px 14px", fontSize: "11px", fontWeight: "900", color: "#64748b", textTransform: "uppercase", width: "120px" }}>Tiến độ</th>
                                      <th style={{ padding: "16px 14px", fontSize: "11px", fontWeight: "900", color: "#64748b", textTransform: "uppercase", width: "130px" }}>Trạng thái</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {totalStudents > 0 ? (
                                      students.map((student, idx) => (
                                        <tr
                                          key={student.studentCode}
                                          style={{
                                            borderBottom: idx === totalStudents - 1 ? "none" : "1px solid #f1f5f9",
                                            transition: "background-color 0.2s",
                                          }}
                                        >
                                          <td style={{ padding: "14px" }}>
                                            <div style={{ fontWeight: "800", color: "#0f172a", fontSize: "13px" }}>{student.studentName}</div>
                                            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px", fontWeight: "700" }}>MSV: {student.studentCode}</div>
                                            <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "1px", fontWeight: "600" }}>Lớp: {student.classCode}</div>
                                          </td>
                                          <td style={{ padding: "14px" }}>
                                            <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "4px", marginBottom: "3px" }}>
                                              <BookOpen size={12} color="#f37021" /> {student.topicCode}
                                            </div>
                                            <div style={{ fontSize: "13px", fontWeight: "700", color: "#334155", lineHeight: "1.4" }}>{student.topicTitle}</div>
                                          </td>
                                          <td style={{ padding: "14px" }}>
                                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                              <div style={{ fontSize: "12px", fontWeight: "900", color: "#0f172a" }}>{student.progress}%</div>
                                              <div style={{ height: "4px", width: "80px", background: "#e2e8f0", borderRadius: "2px", overflow: "hidden" }}>
                                                <div style={{ height: "100%", width: `${student.progress}%`, background: "#10b981", borderRadius: "2px" }} />
                                              </div>
                                            </div>
                                          </td>
                                          <td style={{ padding: "14px" }}>
                                            <span
                                              style={{
                                                padding: "4px 8px",
                                                background: getStatusColor(student.status) + "15",
                                                color: getStatusColor(student.status),
                                                borderRadius: "6px",
                                                fontSize: "10px",
                                                fontWeight: "800",
                                                textTransform: "uppercase",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "3px",
                                              }}
                                            >
                                              {getStatusIcon(student.status)}
                                              {getStatusText(student.status)}
                                            </span>
                                          </td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td colSpan={4} style={{ padding: "40px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                                          Giảng viên này chưa hướng dẫn sinh viên nào.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : (
                            /* --- DẠNG CARD (CARD VIEW) --- */
                            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                              {totalStudents > 0 ? (
                                students.map((student) => (
                                  <div
                                    key={student.studentCode}
                                    style={{
                                      background: "#f8fafc",
                                      padding: "24px",
                                      borderRadius: "20px",
                                      border: "1px solid #e2e8f0",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "16px",
                                      boxShadow: "0 2px 4px rgba(0,0,0,0.01)",
                                    }}
                                  >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                                      <div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                          <span style={{ fontWeight: "800", color: "#0f172a", fontSize: "16px" }}>{student.studentName}</span>
                                          <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", background: "#e2e8f0", padding: "2px 8px", borderRadius: "12px" }}>
                                            {student.studentCode}
                                          </span>
                                        </div>
                                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", fontWeight: "600" }}>
                                          Lớp: <span style={{ color: "#334155", fontWeight: "700" }}>{student.classCode}</span>
                                        </div>
                                      </div>
                                      
                                      <span
                                        style={{
                                          padding: "4px 10px",
                                          background: getStatusColor(student.status) + "15",
                                          color: getStatusColor(student.status),
                                          borderRadius: "8px",
                                          fontSize: "11px",
                                          fontWeight: "800",
                                          textTransform: "uppercase",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "4px",
                                        }}
                                      >
                                        {getStatusIcon(student.status)}
                                        {getStatusText(student.status)}
                                      </span>
                                    </div>

                                    <div style={{ background: "#ffffff", padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                                        <BookOpen size={14} color="#f37021" /> Mã đề tài: {student.topicCode}
                                      </div>
                                      <div style={{ fontSize: "14px", fontWeight: "800", color: "#1e293b", lineHeight: "1.4" }}>
                                        {student.topicTitle}
                                      </div>
                                    </div>

                                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: "20px" }}>
                                      <div>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", fontSize: "12px" }}>
                                          <span style={{ color: "#64748b", fontWeight: "700" }}>Tiến độ lộ trình:</span>
                                          <span style={{ color: "#0f172a", fontWeight: "900" }}>{student.progress}%</span>
                                        </div>
                                        <div style={{ height: "6px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
                                          <div style={{ height: "100%", width: `${student.progress}%`, background: "linear-gradient(90deg, #10b981 0%, #059669 100%)", borderRadius: "3px", transition: "width 0.5s ease" }} />
                                        </div>
                                      </div>

                                      <div style={{ display: "flex", gap: "10px" }}>
                                        <div style={{ textAlign: "center", padding: "4px 8px", background: "#f0fdf4", border: "1px solid #dcfce7", borderRadius: "8px" }} title="Tỷ lệ nộp báo cáo đúng hạn">
                                          <div style={{ fontSize: "9px", color: "#166534", fontWeight: "800", textTransform: "uppercase" }}>Đúng hạn</div>
                                          <div style={{ fontSize: "12px", color: "#15803d", fontWeight: "900" }}>{student.stats.onTimeRate}%</div>
                                        </div>
                                        <div style={{ textAlign: "center", padding: "4px 8px", background: "#fff7ed", border: "1px solid #ffedd5", borderRadius: "8px" }} title="Số lần cần sửa đổi báo cáo">
                                          <div style={{ fontSize: "9px", color: "#9a3412", fontWeight: "800", textTransform: "uppercase" }}>Số lần sửa</div>
                                          <div style={{ fontSize: "12px", color: "#c2410c", fontWeight: "900" }}>{student.stats.revisionCount}</div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div style={{ padding: "60px", textAlign: "center", color: "#94a3b8", fontSize: "14px", background: "#f8fafc", borderRadius: "20px", border: "1px solid #e2e8f0" }}>
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                                    <Archive size={40} strokeWidth={1} color="#cbd5e1" />
                                    Giảng viên này chưa hướng dẫn sinh viên nào trong đợt này.
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* --- RIGHT: LECTURER PROFILE (3 cols) --- */}
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
                          {detailModal.lecturer.profileImage ? (
                            <img
                              src={getAvatarUrl(detailModal.lecturer.profileImage)}
                              alt={detailModal.lecturer.fullName}
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
                        {detailModal.lecturer.fullName}
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
                          Mã GV: {detailModal.lecturer.lecturerCode}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: "12px" }}>
                      {[
                        {
                          icon: <Mail size={16} />,
                          label: "Email giảng viên",
                          value: detailModal.lecturer.email || "---",
                        },
                        {
                          icon: <Phone size={16} />,
                          label: "Số điện thoại",
                          value: detailModal.lecturer.phone || "---",
                        },
                        {
                          icon: <BookOpen size={16} />,
                          label: "Bộ môn / Khoa",
                          value: detailModal.lecturer.departmentCode || "---",
                        },
                        {
                          icon: <UserCheck size={16} />,
                          label: "Học vị / Học hàm",
                          value: detailModal.lecturer.degree || "---",
                        },
                        {
                          icon: <TrendingUp size={16} />,
                          label: "Chỉ tiêu hướng dẫn",
                          value: `${detailModal.lecturer.currentGuidingCount}/${detailModal.lecturer.guideQuota}`,
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

DefenseTermLecturersSection.displayName = "DefenseTermLecturersSection";

export default DefenseTermLecturersSection;
