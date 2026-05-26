import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Eye,
  Filter,
  Loader2,
  PencilLine,
  Search,
  Trash2,
  X,
  PlusCircle,
  Archive,
  BookOpen,
  CheckCircle,
  Building,
  Tag as TagIcon,
  ChevronRight,
} from "lucide-react";
import { fetchData, FetchDataError } from "../../api/fetchData";
import { useToast } from "../../context/useToast";
import { getLecturerCode } from "../../services/auth-session.service";
import type { ApiResponse } from "../../types/api";
import type { Department } from "../../types/department";

type CatalogTopicTagDto = {
  tagID: number;
  tagCode: string;
  tagName: string;
};

type CatalogTopicWithTagsDto = {
  catalogTopicID: number;
  catalogTopicCode: string;
  title: string;
  summary: string;
  departmentCode: string;
  assignedStatus: string;
  assignedAt: string;
  lecturerCode?: string | null;
  lecturerName?: string | null;
  createdAt: string;
  lastUpdated: string;
  tags: CatalogTopicTagDto[];
};

type CatalogTopicEligibleLecturerDto = {
  lecturerProfileID: number;
  lecturerCode: string;
  userCode: string;
  departmentCode: string;
  degree: string;
  guideQuota: number;
  defenseQuota: number;
  currentGuidingCount: number;
  fullName: string;
  email: string;
  phoneNumber: string;
  tags: CatalogTopicTagDto[];
};

type CatalogTopicDetailDto = CatalogTopicWithTagsDto & {
  eligibleLecturers: CatalogTopicEligibleLecturerDto[];
};

type TagLookupDto = {
  tagID: number;
  tagCode: string;
  tagName: string;
  description?: string;
};

type ProposalForm = {
  title: string;
  summary: string;
  departmentCode: string;
  tagCodes: string[];
};

type LecturerFilters = {
  title: string;
  catalogTopicCode: string;
  departmentCode: string;
  tagCode: string;
};

type SortableField =
  | "catalogTopicCode"
  | "title"
  | "departmentCode"
  | "assignedStatus"
  | "createdAt"
  | "lastUpdated";

const sectionCardStyle = {
  background: "#ffffff",
  borderRadius: "16px",
  border: "1px solid rgba(226, 232, 240, 0.8)",
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.03)",
  padding: "24px",
  display: "grid",
  gap: "16px",
};

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  fontSize: "14px",
  outline: "none",
  transition: "all 0.2s ease",
  background: "#fff",
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("vi-VN") + " " + date.toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' });
}

const LecturerCatalogTopicsPage: React.FC = () => {
  const { addToast } = useToast();
  const currentLecturerCode = getLecturerCode();

  // Tab State: "shared" = Kho đề tài dùng chung, "my-proposals" = Đề tài tôi đã đề xuất
  const [activeTab, setActiveTab] = useState<"shared" | "my-proposals">("shared");

  const [rows, setRows] = useState<CatalogTopicWithTagsDto[]>([]);
  const [tagLookup, setTagLookup] = useState<TagLookupDto[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [isLoadingDepts, setIsLoadingDepts] = useState(false);
  
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<LecturerFilters>({
    title: "",
    catalogTopicCode: "",
    departmentCode: "",
    tagCode: "",
  });

  const [sortBy, setSortBy] = useState<SortableField>("lastUpdated");
  const [sortDescending, setSortDescending] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Modal control
  const [modalMode, setModalMode] = useState<"detail" | "propose" | "edit" | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<CatalogTopicDetailDto | null>(null);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [isModalSaving, setIsModalSaving] = useState(false);

  // Form State
  const [proposalForm, setProposalForm] = useState<ProposalForm>({
    title: "",
    summary: "",
    departmentCode: "",
    tagCodes: [],
  });

  // Tag search within modal picker
  const [tagPickerSearch, setTagPickerSearch] = useState("");

  // Debounced search key
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchKeyword(searchInput.trim());
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize))),
    [pageSize, totalCount],
  );

  // Load departments
  const loadDepartments = useCallback(async () => {
    setIsLoadingDepts(true);
    try {
      const response = await fetchData<ApiResponse<Department[]>>("/Departments/get-list");
      if (response?.success && response.data) {
        setDepartments(response.data);
      }
    } catch (err) {
      console.error("Error loading departments:", err);
    } finally {
      setIsLoadingDepts(false);
    }
  }, []);

  // Load tag options
  const loadTags = useCallback(async () => {
    setIsLoadingTags(true);
    try {
      const response = await fetchData<ApiResponse<any>>("/Tags/list?Page=0&PageSize=200");
      if (response?.success && response.data) {
        const items = Array.isArray(response.data) ? response.data : (response.data.items || []);
        setTagLookup(items);
      }
    } catch (err) {
      console.error("Error loading tags:", err);
    } finally {
      setIsLoadingTags(false);
    }
  }, []);

  // Fetch topics list
  const loadRows = useCallback(async () => {
    setIsLoadingRows(true);
    try {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("pageSize", pageSize.toString());
      params.append("sortBy", sortBy);
      params.append("sortDescending", sortDescending.toString());

      if (searchKeyword) params.append("search", searchKeyword);
      if (filters.title) params.append("title", filters.title);
      if (filters.catalogTopicCode) params.append("catalogTopicCode", filters.catalogTopicCode);
      if (filters.departmentCode) params.append("departmentCode", filters.departmentCode);
      if (filters.tagCode) params.append("tagCode", filters.tagCode);

      // If activeTab is "my-proposals", only fetch topics proposed by current lecturer
      if (activeTab === "my-proposals" && currentLecturerCode) {
        params.append("lecturerCode", currentLecturerCode);
      }

      const response = await fetchData<ApiResponse<any>>(
        `/CatalogTopics/get-list-with-tags?${params.toString()}`,
        { method: "GET" }
      );

      if (response?.success && response.data) {
        const items = Array.isArray(response.data)
          ? response.data
          : (response.data.items || response.data.records || []);
        const total = response.totalCount ?? response.data.totalCount ?? items.length;
        
        setRows(items);
        setTotalCount(total);
      } else {
        setRows([]);
        setTotalCount(0);
      }
    } catch (error) {
      console.error("Error fetching topics:", error);
      addToast("Không thể tải danh sách đề tài.", "error");
      setRows([]);
      setTotalCount(0);
    } finally {
      setIsLoadingRows(false);
    }
  }, [activeTab, page, pageSize, sortBy, sortDescending, searchKeyword, filters, currentLecturerCode, addToast]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    void loadDepartments();
    void loadTags();
  }, [loadDepartments, loadTags]);

  const handleTabChange = (tab: "shared" | "my-proposals") => {
    setActiveTab(tab);
    setPage(1);
    setSearchInput("");
    setSearchKeyword("");
    setFilters({
      title: "",
      catalogTopicCode: "",
      departmentCode: "",
      tagCode: "",
    });
  };

  const updateFilter = (key: keyof LecturerFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const resetFilters = () => {
    setSearchInput("");
    setSearchKeyword("");
    setFilters({
      title: "",
      catalogTopicCode: "",
      departmentCode: "",
      tagCode: "",
    });
    setSortBy("lastUpdated");
    setSortDescending(true);
    setPage(1);
  };

  const toggleSort = (field: SortableField) => {
    setPage(1);
    if (sortBy === field) {
      setSortDescending((prev) => !prev);
    } else {
      setSortBy(field);
      setSortDescending(false);
    }
  };

  const openDetail = async (row: CatalogTopicWithTagsDto) => {
    setModalMode("detail");
    setSelectedTopic(null);
    setIsModalLoading(true);
    try {
      const response = await fetchData<ApiResponse<any>>(
        `/CatalogTopics/get-detail/${encodeURIComponent(row.catalogTopicCode)}`,
        { method: "GET" }
      );

      if (response?.success && response.data) {
        setSelectedTopic({
          ...row,
          ...response.data,
        });
      } else {
        setSelectedTopic({
          ...row,
          eligibleLecturers: [],
        });
      }
    } catch (error) {
      console.error("Error fetching details:", error);
      setSelectedTopic({
        ...row,
        eligibleLecturers: [],
      });
    } finally {
      setIsModalLoading(false);
    }
  };

  const openPropose = () => {
    // pre-populate department of current lecturer if possible
    setProposalForm({
      title: "",
      summary: "",
      departmentCode: "",
      tagCodes: [],
    });
    setModalMode("propose");
  };

  const openEdit = (row: CatalogTopicWithTagsDto) => {
    setSelectedTopic({
      ...row,
      eligibleLecturers: [],
    });
    setProposalForm({
      title: row.title,
      summary: row.summary || "",
      departmentCode: row.departmentCode || "",
      tagCodes: row.tags?.map((t) => t.tagCode) || [],
    });
    setModalMode("edit");
  };

  const saveProposal = async () => {
    if (!proposalForm.title.trim()) {
      addToast("Vui lòng nhập tên đề tài.", "warning");
      return;
    }
    if (!proposalForm.summary.trim()) {
      addToast("Vui lòng mô tả tóm tắt nội dung đề tài.", "warning");
      return;
    }

    setIsModalSaving(true);
    try {
      if (modalMode === "propose") {
        // Step 1: Submit new topic
        const createRes = await fetchData<ApiResponse<any>>("/CatalogTopics/lecturer-submit", {
          method: "POST",
          body: {
            title: proposalForm.title.trim(),
            summary: proposalForm.summary.trim(),
            departmentCode: proposalForm.departmentCode || null,
            assignedStatus: "Chưa giao",
            assignedAt: null,
          },
        });

        if (!createRes?.success || !createRes.data) {
          throw new Error(createRes?.message || "Đề xuất đề tài thất bại.");
        }

        const createdTopicCode = createRes.data.catalogTopicCode;

        // Step 2: If lecturer selected tags, update tags
        if (proposalForm.tagCodes.length > 0) {
          const selectedTagObjects = proposalForm.tagCodes
            .map((code) => tagLookup.find((t) => t.tagCode === code))
            .filter((t): t is TagLookupDto => !!t);

          await fetchData(`/CatalogTopics/update/${encodeURIComponent(createdTopicCode)}`, {
            method: "PUT",
            body: {
              title: proposalForm.title.trim(),
              summary: proposalForm.summary.trim(),
              departmentCode: proposalForm.departmentCode || null,
              assignedStatus: "Chưa giao",
              assignedAt: null,
              tagIDs: selectedTagObjects.map((t) => t.tagID),
              tagCodes: selectedTagObjects.map((t) => t.tagCode),
            },
          });
        }

        addToast("Đề xuất đề tài mới vào kho thành công!", "success");
      } else if (modalMode === "edit" && selectedTopic) {
        // Edit flow
        const selectedTagObjects = proposalForm.tagCodes
          .map((code) => tagLookup.find((t) => t.tagCode === code))
          .filter((t): t is TagLookupDto => !!t);

        const updateRes = await fetchData<ApiResponse<any>>(
          `/CatalogTopics/update/${encodeURIComponent(selectedTopic.catalogTopicCode)}`,
          {
            method: "PUT",
            body: {
              title: proposalForm.title.trim(),
              summary: proposalForm.summary.trim(),
              departmentCode: proposalForm.departmentCode || null,
              assignedStatus: "Chưa giao",
              assignedAt: null,
              tagIDs: selectedTagObjects.map((t) => t.tagID),
              tagCodes: selectedTagObjects.map((t) => t.tagCode),
            },
          }
        );

        if (!updateRes?.success) {
          throw new Error(updateRes?.message || "Cập nhật thất bại.");
        }

        addToast("Cập nhật đề tài thành công!", "success");
      }

      setModalMode(null);
      void loadRows();
    } catch (err) {
      console.error("Error saving catalog topic:", err);
      const msg = err instanceof Error ? err.message : "Đã xảy ra lỗi khi lưu đề tài.";
      addToast(msg, "error");
    } finally {
      setIsModalSaving(false);
    }
  };

  const removeTopic = async (row: CatalogTopicWithTagsDto) => {
    if (!window.confirm(`Bạn chắc chắn muốn xóa đề tài đề xuất "${row.title}"?`)) return;

    try {
      const response = await fetchData<ApiResponse<any>>(`/CatalogTopics/delete/${encodeURIComponent(row.catalogTopicCode)}`, {
        method: "DELETE",
      });

      if (response?.success || response === null) {
        addToast("Xóa đề xuất đề tài thành công.", "success");
        void loadRows();
      } else {
        throw new Error(response?.message || "Xóa đề tài thất bại.");
      }
    } catch (error) {
      console.error("Error deleting catalog topic:", error);
      const msg = error instanceof Error ? error.message : "Không thể xóa đề tài.";
      addToast(msg, "error");
    }
  };

  const toggleTagInForm = (tagCode: string) => {
    setProposalForm((prev) => {
      const alreadySelected = prev.tagCodes.includes(tagCode);
      const newTags = alreadySelected
        ? prev.tagCodes.filter((t) => t !== tagCode)
        : [...prev.tagCodes, tagCode];
      return { ...prev, tagCodes: newTags };
    });
  };

  const filteredTags = useMemo(() => {
    const term = tagPickerSearch.trim().toLowerCase();
    if (!term) return tagLookup;
    return tagLookup.filter(
      (t) =>
        t.tagCode.toLowerCase().includes(term) ||
        t.tagName.toLowerCase().includes(term)
    );
  }, [tagLookup, tagPickerSearch]);

  return (
    <div className="lecturer-catalog-topics-root" style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      <style>{`
        :root {
          --primary-navy: #002855;
          --primary-blue: #003d82;
          --accent-orange: #f37021;
          --accent-orange-light: #fff7ed;
          --accent-hover: #ea580c;
          --bg-light: #f8fafc;
          --border-color: rgba(226, 232, 240, 0.8);
          --radius-card: 16px;
        }

        .tab-btn {
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid transparent;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .tab-btn.active {
          background: linear-gradient(135deg, var(--primary-navy) 0%, var(--primary-blue) 100%);
          color: #ffffff;
          box-shadow: 0 4px 15px rgba(0, 40, 85, 0.2);
          border-color: var(--primary-navy);
        }

        .tab-btn:not(.active) {
          background: #ffffff;
          color: #475569;
          border-color: var(--border-color);
        }

        .tab-btn:not(.active):hover {
          background: var(--bg-light);
          color: var(--primary-navy);
          border-color: #cbd5e1;
        }

        .btn-propose {
          padding: 12px 24px;
          background: linear-gradient(135deg, var(--accent-orange) 0%, var(--accent-hover) 100%);
          color: #ffffff;
          border-radius: 12px;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 14px rgba(243, 112, 33, 0.35);
        }

        .btn-propose:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(243, 112, 33, 0.45);
        }

        .btn-propose:active {
          transform: translateY(0);
        }

        .topics-table-premium {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 14px;
        }

        .topics-table-premium th {
          background: #f8fafc;
          padding: 16px 12px;
          font-weight: 700;
          color: #334155;
          text-align: left;
          border-bottom: 2px solid #e2e8f0;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .topics-table-premium td {
          padding: 16px 12px;
          border-bottom: 1px solid #f1f5f9;
          color: #334155;
          vertical-align: middle;
        }

        .topics-table-premium tr:hover td {
          background-color: #fafbfc;
        }

        .badge-status {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 700;
          border-width: 1px;
          border-style: solid;
        }

        .badge-assigned {
          background: #fee2e2;
          color: #991b1b;
          border-color: #fecaca;
        }

        .badge-unassigned {
          background: #dcfce7;
          color: #166534;
          border-color: #bbf7d0;
        }

        .tag-pill {
          background: #f0f6ff;
          border: 1px solid #bfdbfe;
          color: #1e3a5f;
          border-radius: 999px;
          padding: 2px 8px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }

        .btn-icon-action {
          border: 1px solid #cbd5e1;
          background: #fff;
          border-radius: 8px;
          padding: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          color: #475569;
        }

        .btn-icon-action:hover {
          background: #f8fafc;
          border-color: var(--primary-navy);
          color: var(--primary-navy);
          transform: scale(1.05);
        }

        .btn-icon-edit:hover {
          border-color: #fcd34d;
          color: #b45309;
          background: #fffbeb;
        }

        .btn-icon-delete:hover {
          border-color: #fecaca;
          color: #b91c1c;
          background: #fef2f2;
        }

        .filter-input-label {
          display: grid;
          gap: 6px;
        }
        .filter-input-label span {
          font-size: 13px;
          font-weight: 700;
          color: #475569;
        }

        .dialog-backdrop {
          position: fixed;
          inset: 0;
          z-index: 150;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dialog-content {
          width: min(800px, 100%);
          max-height: 90vh;
          overflow: hidden;
          border-radius: 20px;
          background: #ffffff;
          border: 1px solid rgba(148, 163, 184, 0.2);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          display: grid;
          grid-template-rows: auto 1fr auto;
        }

        .dialog-header {
          padding: 20px 24px;
          border-bottom: 1px solid #f1f5f9;
          background: linear-gradient(135deg, rgba(0, 40, 85, 0.04), rgba(243, 112, 33, 0.02));
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .dialog-body {
          overflow-y: auto;
          padding: 24px;
          display: grid;
          gap: 20px;
        }

        .dialog-footer {
          padding: 16px 24px;
          border-top: 1px solid #f1f5f9;
          background: #f8fafc;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }
      `}</style>

      {/* Page Header */}
      <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1
            style={{
              fontSize: "30px",
              fontWeight: 800,
              color: "#002855",
              marginBottom: "8px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <Archive size={32} color="#f37021" />
            Kho đề tài có sẵn
          </h1>
          <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
            Khám phá danh sách đề tài mẫu dùng chung toàn hệ thống, hoặc đóng góp các ý tưởng đề tài mới của riêng bạn.
          </p>
        </div>

        <div>
          <button type="button" onClick={openPropose} className="btn-propose">
            <PlusCircle size={18} />
            Đề xuất đề tài mới
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div style={{ display: "flex", gap: "12px", borderBottom: "2px solid #e2e8f0", paddingBottom: "12px", marginBottom: "24px" }}>
        <button
          type="button"
          onClick={() => handleTabChange("shared")}
          className={`tab-btn ${activeTab === "shared" ? "active" : ""}`}
        >
          <BookOpen size={16} />
          Đề tài dùng chung
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("my-proposals")}
          className={`tab-btn ${activeTab === "my-proposals" ? "active" : ""}`}
        >
          <CheckCircle size={16} />
          Đề tài tôi đã đề xuất
        </button>
      </div>

      {/* Search and Filters Toolbar */}
      <div style={{ display: "grid", gap: "16px", marginBottom: "24px" }}>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          {/* Search Box */}
          <div style={{ flex: "1 1 400px", position: "relative" }}>
            <Search
              size={18}
              color="#94a3b8"
              style={{
                position: "absolute",
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
              }}
            />
            <input
              type="text"
              placeholder="Tìm kiếm theo tiêu đề, tóm tắt, mã đề tài..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{
                ...inputStyle,
                paddingLeft: "42px",
                borderColor: searchInput ? "var(--primary-navy)" : "#cbd5e1",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              className="tab-btn"
              style={{
                background: showFilters ? "var(--accent-orange-light)" : "#fff",
                borderColor: showFilters ? "var(--accent-orange)" : "var(--border-color)",
                color: showFilters ? "var(--accent-orange)" : "#475569",
              }}
            >
              <Filter size={16} />
              {showFilters ? "Ẩn bộ lọc" : "Bộ lọc nâng cao"}
            </button>

            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as SortableField);
                setPage(1);
              }}
              style={{ ...inputStyle, width: "auto" }}
            >
              <option value="lastUpdated">Mới cập nhật</option>
              <option value="createdAt">Ngày tạo</option>
              <option value="title">Tên đề tài</option>
              <option value="catalogTopicCode">Mã đề tài</option>
              <option value="departmentCode">Khoa</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setSortDescending((prev) => !prev);
                setPage(1);
              }}
              className="tab-btn"
              style={{ padding: "10px 14px", border: "1px solid var(--border-color)", background: "#fff" }}
            >
              {sortDescending ? <ArrowDownWideNarrow size={16} /> : <ArrowUpWideNarrow size={16} />}
              {sortDescending ? "Giảm dần" : "Tăng dần"}
            </button>
          </div>
        </div>

        {/* Extended Filter Panel */}
        {showFilters && (
          <div style={{ ...sectionCardStyle, background: "#f8fafc", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <label className="filter-input-label">
              <span>Mã đề tài</span>
              <input
                value={filters.catalogTopicCode}
                onChange={(e) => updateFilter("catalogTopicCode", e.target.value)}
                placeholder="Ví dụ: CAT001"
                style={inputStyle}
              />
            </label>

            <label className="filter-input-label">
              <span>Tiêu đề</span>
              <input
                value={filters.title}
                onChange={(e) => updateFilter("title", e.target.value)}
                placeholder="Tên đề tài..."
                style={inputStyle}
              />
            </label>

            <label className="filter-input-label">
              <span>Khoa/Bộ môn</span>
              <select
                value={filters.departmentCode}
                onChange={(e) => updateFilter("departmentCode", e.target.value)}
                style={inputStyle}
              >
                <option value="">-- Tất cả khoa --</option>
                {departments.map((dept) => (
                  <option key={dept.departmentCode} value={dept.departmentCode}>
                    {dept.name} ({dept.departmentCode})
                  </option>
                ))}
              </select>
            </label>

            <label className="filter-input-label">
              <span>Mã Tag</span>
              <select
                value={filters.tagCode}
                onChange={(e) => updateFilter("tagCode", e.target.value)}
                style={inputStyle}
              >
                <option value="">-- Tất cả tag --</option>
                {tagLookup.map((tag) => (
                  <option key={tag.tagCode} value={tag.tagCode}>
                    {tag.tagCode} - {tag.tagName}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={resetFilters}
                className="tab-btn"
                style={{ background: "#fff", borderColor: "#cbd5e1" }}
              >
                Xóa bộ lọc
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div style={sectionCardStyle}>
        <div style={{ overflowX: "auto" }}>
          <table className="topics-table-premium">
            <thead>
              <tr>
                <th style={{ width: "12%" }}>Mã đề tài</th>
                <th style={{ width: "25%" }}>Tiêu đề đề tài</th>
                <th style={{ width: "25%" }}>Nội dung tóm tắt</th>
                <th style={{ width: "10%" }}>Khoa</th>
                <th style={{ width: "13%" }}>Người đề xuất</th>
                <th style={{ width: "15%" }}>Tags liên quan</th>
                <th style={{ width: "10%", textAlign: "center" }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingRows ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`skeleton-${index}`}>
                    {Array.from({ length: 7 }).map((__, idx) => (
                      <td key={`skeleton-${index}-${idx}`}>
                        <div
                          style={{
                            height: 14,
                            borderRadius: 999,
                            background: "#e2e8f0",
                            width: idx % 2 === 0 ? "60%" : "90%",
                            animation: "pulse 1.5s infinite"
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "48px", color: "#64748b" }}>
                    Chưa có đề tài nào trong kho phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const isOwnProposal = currentLecturerCode && row.lecturerCode === currentLecturerCode;

                  return (
                    <tr key={`catalogtopic-${row.catalogTopicID}`}>
                      <td style={{ fontWeight: 700, color: "var(--primary-navy)" }}>{row.catalogTopicCode}</td>
                      <td style={{ fontWeight: 600, color: "#1e293b", wordBreak: "break-word" }}>{row.title}</td>
                      <td>
                        <div
                          title={row.summary || ""}
                          style={{
                            display: "-webkit-box",
                            WebkitBoxOrient: "vertical",
                            WebkitLineClamp: 2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "normal",
                            fontSize: "13px",
                            color: "#475569",
                            lineHeight: "1.5"
                          }}
                        >
                          {row.summary || "--"}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: "#475569" }}>
                          {row.departmentCode || "--"}
                        </span>
                      </td>
                      <td>
                        {row.lecturerCode ? (
                          <div style={{ display: "grid", gap: "2px" }}>
                            <span style={{ fontWeight: 600, color: "#334155", fontSize: "13px" }}>{row.lecturerName}</span>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>Mã: {row.lecturerCode}</span>
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8", fontStyle: "italic", fontSize: "13px" }}>Admin hệ thống</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {Array.isArray(row.tags) && row.tags.length > 0 ? (
                            row.tags.map((tag) => (
                              <span key={`${row.catalogTopicID}-${tag.tagID}`} className="tag-pill">
                                {tag.tagCode}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: "13px" }}>--</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={() => void openDetail(row)}
                            className="btn-icon-action"
                            title="Xem chi tiết"
                          >
                            <Eye size={14} />
                          </button>
                          
                          {isOwnProposal && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEdit(row)}
                                className="btn-icon-action btn-icon-edit"
                                title="Chỉnh sửa đề xuất"
                              >
                                <PencilLine size={14} />
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => void removeTopic(row)}
                                className="btn-icon-action btn-icon-delete"
                                title="Xóa đề xuất"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
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

        {/* Pagination bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, borderTop: "1px solid #f1f5f9", paddingTop: "16px" }}>
          <div style={{ color: "#64748b", fontSize: "13px" }}>
            Tổng số đề tài: <strong>{totalCount}</strong>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: "#64748b", fontSize: "13px" }}>Số hàng:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                style={{ ...inputStyle, width: "auto", padding: "4px 8px", borderRadius: "6px" }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>

            <button
              type="button"
              disabled={page <= 1 || isLoadingRows}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="tab-btn"
              style={{ padding: "6px 12px", border: "1px solid var(--border-color)", background: "#fff", opacity: page <= 1 ? 0.5 : 1 }}
            >
              Trước
            </button>

            <span style={{ fontSize: "13px", minWidth: "90px", textAlign: "center", fontWeight: "600" }}>
              Trang {page} / {pageCount}
            </span>

            <button
              type="button"
              disabled={page >= pageCount || isLoadingRows}
              onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
              className="tab-btn"
              style={{ padding: "6px 12px", border: "1px solid var(--border-color)", background: "#fff", opacity: page >= pageCount ? 0.5 : 1 }}
            >
              Sau
            </button>
          </div>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {modalMode === "detail" && selectedTopic && (
        <div className="dialog-backdrop" role="dialog" aria-modal="true">
          <div className="dialog-content" style={{ width: "min(1000px, 100%)" }}>
            <div className="dialog-header">
              <div>
                <span style={{ color: "var(--accent-orange)", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  MÃ ĐỀ TÀI: {selectedTopic.catalogTopicCode}
                </span>
                <h3 style={{ margin: "4px 0 0 0", fontSize: "22px", fontWeight: 800, color: "var(--primary-navy)" }}>
                  Chi tiết đề tài mẫu
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="dialog-body" style={{ gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              {/* Left col */}
              <div style={{ display: "grid", gap: "16px", height: "fit-content" }}>
                <div style={{ display: "grid", gap: "4px" }}>
                  <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Tên đề tài</span>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--primary-navy)", lineHeight: "1.4" }}>
                    {selectedTopic.title}
                  </div>
                </div>

                <div style={{ display: "grid", gap: "4px" }}>
                  <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Tóm tắt / Mô tả</span>
                  <div style={{ fontSize: "14px", color: "#334155", background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", lineHeight: "1.6", minHeight: "120px", whiteSpace: "pre-wrap" }}>
                    {selectedTopic.summary || "Không có tóm tắt chi tiết."}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Bộ môn/Khoa</div>
                    <div style={{ fontWeight: 700, color: "#1e293b", marginTop: "4px", display: "flex", alignItems: "center", gap: 6 }}>
                      <Building size={14} color="var(--accent-orange)" />
                      {selectedTopic.departmentCode || "--"}
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Trạng thái giao</div>
                    <div style={{ marginTop: "4px" }}>
                      {selectedTopic.assignedStatus === "Assigned" || selectedTopic.assignedStatus === "Đã giao" ? (
                        <span className="badge-status badge-assigned">Đã giao</span>
                      ) : (
                        <span className="badge-status badge-unassigned">Chưa giao</span>
                      )}
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Ngày tạo</div>
                    <div style={{ fontWeight: 600, color: "#334155", fontSize: "13px", marginTop: "4px" }}>
                      {formatDateTime(selectedTopic.createdAt)}
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Cập nhật lần cuối</div>
                    <div style={{ fontWeight: 600, color: "#334155", fontSize: "13px", marginTop: "4px" }}>
                      {formatDateTime(selectedTopic.lastUpdated)}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gap: "6px" }}>
                  <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Tags kỹ năng / Chủ đề</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {selectedTopic.tags?.length ? (
                      selectedTopic.tags.map((tag) => (
                        <span
                          key={tag.tagID}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 12px",
                            borderRadius: "999px",
                            background: "var(--accent-orange-light)",
                            border: "1px solid #fed7aa",
                            color: "var(--accent-orange)",
                            fontSize: "13px",
                            fontWeight: 700,
                          }}
                        >
                          <TagIcon size={12} />
                          {tag.tagCode}
                          <span style={{ color: "#475569", fontWeight: 600 }}>({tag.tagName})</span>
                        </span>
                      ))
                    ) : (
                      <span style={{ color: "#94a3b8", fontSize: "13px" }}>Chưa liên kết tag nào.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right col: Proposer & Eligible Lecturers */}
              <div style={{ display: "grid", gap: "16px" }}>
                <div style={{ background: "linear-gradient(135deg, rgba(0, 40, 85, 0.03), rgba(243, 112, 33, 0.03))", padding: "20px", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Giảng viên đề xuất
                  </span>
                  {selectedTopic.lecturerCode ? (
                    <div style={{ display: "flex", gap: "14px", marginTop: "10px", alignItems: "center" }}>
                      <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "var(--primary-navy)", display: "grid", placeItems: "center", color: "#fff", fontWeight: "bold" }}>
                        {selectedTopic.lecturerName?.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: "var(--primary-navy)" }}>{selectedTopic.lecturerName}</div>
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                          Mã giảng viên: <strong>{selectedTopic.lecturerCode}</strong>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "14px", marginTop: "10px", alignItems: "center" }}>
                      <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "#64748b", display: "grid", placeItems: "center", color: "#fff", fontWeight: "bold" }}>
                        A
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: "#334155" }}>Quản trị hệ thống (Admin)</div>
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                          Đề tài mẫu chuẩn dùng chung hệ thống
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ ...sectionCardStyle, border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                    Giảng viên phù hợp cùng chuyên môn
                  </span>
                  {isModalLoading ? (
                    <div style={{ display: "flex", gap: "8px", color: "#64748b", alignItems: "center", padding: "12px" }}>
                      <Loader2 size={16} className="animate-spin" /> Đang tải danh sách giảng viên...
                    </div>
                  ) : selectedTopic.eligibleLecturers?.length ? (
                    <div style={{ display: "grid", gap: "12px", maxHeight: "260px", overflowY: "auto", paddingRight: "4px" }}>
                      {selectedTopic.eligibleLecturers.map((lecturer) => (
                        <div
                          key={lecturer.lecturerProfileID}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "10px 14px",
                            background: "#f8fafc",
                            borderRadius: "10px",
                            border: "1px solid #f1f5f9"
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "13px" }}>{lecturer.fullName}</div>
                            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                              {lecturer.degree} · Khoa {lecturer.departmentCode}
                            </div>
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--accent-orange)", fontWeight: 700, background: "var(--accent-orange-light)", padding: "4px 8px", borderRadius: "6px" }}>
                            Đang HD: {lecturer.currentGuidingCount}/{lecturer.guideQuota}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: "#94a3b8", fontSize: "13px", padding: "8px" }}>
                      Không có giảng viên khác có tag chuyên môn trùng khớp.
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="dialog-footer">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="tab-btn"
                style={{ background: "#fff", borderColor: "#cbd5e1" }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROPOSE & EDIT MODAL */}
      {(modalMode === "propose" || modalMode === "edit") && (
        <div className="dialog-backdrop" role="dialog" aria-modal="true">
          <div className="dialog-content" style={{ width: "min(750px, 100%)" }}>
            <div className="dialog-header">
              <div>
                <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "var(--primary-navy)" }}>
                  {modalMode === "propose" ? "Đề xuất đề tài chuẩn mới" : "Chỉnh sửa đề tài đề xuất"}
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                  Điền các thông tin của đề tài dưới đây để đưa vào kho dùng chung.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="dialog-body">
              {/* Title input */}
              <div style={{ display: "grid", gap: "6px" }}>
                <label style={{ fontSize: "14px", fontWeight: 700, color: "#334155" }}>
                  Tên đề tài chuẩn <span style={{ color: "red" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Xây dựng hệ thống quản lý luận văn tốt nghiệp theo mô hình hướng dịch vụ"
                  value={proposalForm.title}
                  onChange={(e) => setProposalForm((prev) => ({ ...prev, title: e.target.value }))}
                  style={inputStyle}
                  required
                />
              </div>

              {/* Department input */}
              <div style={{ display: "grid", gap: "6px" }}>
                <label style={{ fontSize: "14px", fontWeight: 700, color: "#334155" }}>
                  Khoa/Bộ môn quản lý <span style={{ color: "red" }}>*</span>
                </label>
                <select
                  value={proposalForm.departmentCode}
                  onChange={(e) => setProposalForm((prev) => ({ ...prev, departmentCode: e.target.value }))}
                  style={inputStyle}
                  required
                >
                  <option value="">-- Chọn khoa phụ trách --</option>
                  {departments.map((d) => (
                    <option key={d.departmentCode} value={d.departmentCode}>
                      {d.name} ({d.departmentCode})
                    </option>
                  ))}
                </select>
              </div>

              {/* Summary Input */}
              <div style={{ display: "grid", gap: "6px" }}>
                <label style={{ fontSize: "14px", fontWeight: 700, color: "#334155" }}>
                  Tóm tắt & Mục tiêu đề tài <span style={{ color: "red" }}>*</span>
                </label>
                <textarea
                  placeholder="Mô tả tóm tắt nội dung nghiên cứu, các công nghệ dự kiến sử dụng và các kết quả cần đạt được của đề tài này..."
                  value={proposalForm.summary}
                  onChange={(e) => setProposalForm((prev) => ({ ...prev, summary: e.target.value }))}
                  style={{ ...inputStyle, minHeight: "130px", resize: "vertical", fontFamily: "inherit" }}
                  required
                />
              </div>

              {/* Tag Pickers */}
              <div style={{ display: "grid", gap: "8px" }}>
                <label style={{ fontSize: "14px", fontWeight: 700, color: "#334155", display: "flex", justifyContent: "space-between" }}>
                  <span>Tags chuyên môn liên quan ({proposalForm.tagCodes.length})</span>
                  <span style={{ fontSize: "12px", color: "var(--accent-orange)" }}>Chọn các chủ đề chuyên sâu của đề tài</span>
                </label>

                {/* Display currently selected tags */}
                {proposalForm.tagCodes.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", background: "#f8fafc", padding: "12px", borderRadius: "10px", border: "1px solid #f1f5f9" }}>
                    {proposalForm.tagCodes.map((code) => {
                      const tagObj = tagLookup.find((t) => t.tagCode === code);
                      return (
                        <span
                          key={code}
                          onClick={() => toggleTagInForm(code)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            background: "var(--accent-orange)",
                            color: "#fff",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                          title="Click để bỏ chọn"
                        >
                          {code} {tagObj && `(${tagObj.tagName})`}
                          <X size={12} />
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Tag Search inside modal */}
                <div style={{ position: "relative" }}>
                  <Search
                    size={16}
                    color="#94a3b8"
                    style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}
                  />
                  <input
                    type="text"
                    placeholder="Tìm kiếm nhanh tag (ví dụ: React, Java, IoT...)"
                    value={tagPickerSearch}
                    onChange={(e) => setTagPickerSearch(e.target.value)}
                    style={{ ...inputStyle, paddingLeft: "36px", height: "38px" }}
                  />
                </div>

                {/* Scrollable list of tag options */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", maxHeight: "150px", overflowY: "auto", padding: "6px", border: "1px solid #f1f5f9", borderRadius: "10px" }}>
                  {isLoadingTags ? (
                    <span style={{ fontSize: "12px", color: "#64748b" }}>Đang tải danh sách tag...</span>
                  ) : filteredTags.length === 0 ? (
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>Không tìm thấy tag phù hợp.</span>
                  ) : (
                    filteredTags.map((tag) => {
                      const isSelected = proposalForm.tagCodes.includes(tag.tagCode);
                      return (
                        <button
                          key={tag.tagID}
                          type="button"
                          onClick={() => toggleTagInForm(tag.tagCode)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.2s",
                            border: "1px solid",
                            borderColor: isSelected ? "var(--accent-orange)" : "#cbd5e1",
                            background: isSelected ? "var(--accent-orange-light)" : "#fff",
                            color: isSelected ? "var(--accent-orange)" : "#475569",
                          }}
                        >
                          {tag.tagCode} - {tag.tagName}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="dialog-footer">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="tab-btn"
                style={{ background: "#fff", borderColor: "#cbd5e1" }}
                disabled={isModalSaving}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void saveProposal()}
                className="btn-propose"
                style={{ opacity: isModalSaving ? 0.7 : 1, cursor: isModalSaving ? "not-allowed" : "pointer" }}
                disabled={isModalSaving}
              >
                {isModalSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  "Gửi đề xuất"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerCatalogTopicsPage;
