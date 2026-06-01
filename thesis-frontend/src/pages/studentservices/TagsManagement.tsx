import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Edit, Eye, Filter, Plus, Search, Trash2, X, BookOpen } from "lucide-react";
import { fetchData } from "../../api/fetchData";
import ManagementFormSection, {
  type ManagementFormField,
} from "../../components/admin/ManagementFormSection";
import { useToast } from "../../context/useToast";
import type { ApiResponse } from "../../types/api";
import "../admin/Dashboard.css";
import "./TagsManagement.css";

type RecordData = Record<string, unknown>;

type ModalType = "detail" | "create" | "edit" | null;

type TagReadDto = {
  tagID: number;
  tagCode: string;
  tagName: string;
  description?: string;
  createdAt: string;
};

const tagFormFields: ManagementFormField[] = [
  { name: "tagCode", label: "Mã Tag (tùy chọn)" },
  { name: "tagName", label: "Tên Tag", required: true },
  { name: "description", label: "Mô tả", type: "textarea" },
];

function toDisplay(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function normalizeList(payload: unknown): {
  items: TagReadDto[];
  fallbackTotal: number;
} {
  if (Array.isArray(payload)) {
    return { items: payload as TagReadDto[], fallbackTotal: payload.length };
  }

  if (payload && typeof payload === "object") {
    const source = payload as Record<string, unknown>;
    const candidates = [
      source.items,
      source.records,
      source.result,
      source.data,
      source.list,
    ];
    const arr = candidates.find((candidate) => Array.isArray(candidate));
    if (Array.isArray(arr)) {
      return {
        items: arr as TagReadDto[],
        fallbackTotal: Number(
          source.totalCount ?? source.total ?? source.count ?? arr.length,
        ),
      };
    }
  }

  return { items: [], fallbackTotal: 0 };
}

function normalizeSuggestions(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const source = item as Record<string, unknown>;
          const code = toDisplay(source.tagCode).trim();
          const name = toDisplay(source.tagName).trim();
          return [code, name].filter(Boolean).join(" - ");
        }
        return "";
      })
      .filter(Boolean)
      .slice(0, 8);
  }
  return [];
}

function formatDate(value: unknown): string {
  const raw = toDisplay(value);
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString("vi-VN");
}

async function requestApiData<T>(
  path: string,
  options?: Parameters<typeof fetchData>[1],
  fallback = "Không thể xử lý yêu cầu.",
): Promise<{ data: T; totalCount: number; message: string | null }> {
  const response = await fetchData<ApiResponse<T>>(path, options);
  if (!response?.success) {
    throw new Error(response.message || response.title || fallback);
  }
  return {
    data: response.data as T,
    totalCount: Number(response.totalCount || 0),
    message: response.message || null,
  };
}

const TagsManagement: React.FC = () => {
  const { addToast } = useToast();

  const [rows, setRows] = useState<TagReadDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedRow, setSelectedRow] = useState<TagReadDto | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState({
    tagCode: "",
    tagName: "",
  });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  const [formValues, setFormValues] = useState({
    tagCode: "",
    tagName: "",
    description: "",
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchKeyword(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const q = searchInput.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        const { data } = await requestApiData<unknown>(
          `/Tags/search?q=${encodeURIComponent(q)}`,
          { method: "GET" },
          "Không thể tải gợi ý Tag.",
        );
        if (cancelled) return;
        setSuggestions(normalizeSuggestions(data));
      } catch {
        if (cancelled) return;
        setSuggestions([]);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [searchInput]);

  const queryObject = useMemo(
    () => ({
      page,
      pageSize,
      search: searchKeyword,
      tagCode: filters.tagCode,
      tagName: filters.tagName,
    }),
    [filters.tagCode, filters.tagName, page, pageSize, searchKeyword],
  );

  const buildListQuery = useCallback(() => {
    const params = new URLSearchParams();
    Object.entries(queryObject).forEach(([key, value]) => {
      const normalized = String(value ?? "").trim();
      if (!normalized) return;
      params.append(key, normalized);
    });
    const query = params.toString();
    return query ? `?${query}` : "";
  }, [queryObject]);

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = buildListQuery();
      const { data, totalCount: apiTotal } = await requestApiData<unknown>(
        `/Tags/list${query}`,
        { method: "GET" },
        "Không thể tải danh sách Tag.",
      );
      const normalized = normalizeList(data);
      setRows(normalized.items);
      setTotalCount(apiTotal > 0 ? apiTotal : normalized.fallbackTotal);
    } catch (error) {
      addToast(
        error instanceof Error
          ? error.message
          : "Không thể tải danh sách Tag.",
        "error",
      );
      setRows([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [addToast, buildListQuery]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize))),
    [pageSize, totalCount],
  );

  const openCreate = () => {
    setSelectedRow(null);
    setFormValues({ tagCode: "", tagName: "", description: "" });
    setActiveModal("create");
  };

  const openEdit = async (row: TagReadDto) => {
    const id = Number(row.tagID || 0);
    if (!id) {
      addToast("Không xác định được tagID để cập nhật.", "error");
      return;
    }

    try {
      const { data } = await requestApiData<RecordData>(
        `/Tags/get-update/${id}`,
        { method: "GET" },
        "Không thể tải dữ liệu cập nhật Tag.",
      );
      setFormValues({
        tagCode: toDisplay(data.tagCode || row.tagCode),
        tagName: toDisplay(data.tagName || row.tagName),
        description: toDisplay(data.description ?? row.description ?? ""),
      });
      setSelectedRow(row);
      setActiveModal("edit");
    } catch (error) {
      addToast(
        error instanceof Error
          ? error.message
          : "Không thể tải dữ liệu cập nhật Tag.",
        "error",
      );
    }
  };

  const openDetail = async (row: TagReadDto) => {
    const code = String(row.tagCode || "").trim();
    if (!code) {
      setSelectedRow(row);
      setActiveModal("detail");
      return;
    }

    try {
      const { data } = await requestApiData<TagReadDto>(
        `/Tags/get-by-code/${encodeURIComponent(code)}`,
        { method: "GET" },
        "Không thể tải chi tiết Tag.",
      );
      setSelectedRow(data || row);
    } catch {
      setSelectedRow(row);
    }
    setActiveModal("detail");
  };

  const handleDelete = async (row: TagReadDto) => {
    const id = Number(row.tagID || 0);
    if (!id) {
      addToast("Không xác định được ID để xóa Tag.", "error");
      return;
    }

    if (!window.confirm(`Bạn có chắc chắn muốn xóa Tag ${row.tagCode}?`)) return;

    setIsSubmitting(true);
    try {
      await requestApiData<unknown>(
        `/Tags/delete/${id}`,
        { method: "DELETE" },
        "Không thể xóa Tag.",
      );
      addToast("Xóa Tag thành công.", "success");
      await loadRows();
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Không thể xóa Tag.",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!formValues.tagName.trim()) {
      addToast("Tên Tag là bắt buộc.", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      if (activeModal === "create") {
        await requestApiData<unknown>(
          "/Tags/create",
          {
            method: "POST",
            body: {
              tagCode: formValues.tagCode.trim(),
              tagName: formValues.tagName.trim(),
              description: formValues.description.trim(),
            },
          },
          "Không thể tạo Tag.",
        );
        addToast("Tạo Tag thành công.", "success");
      }

      if (activeModal === "edit" && selectedRow) {
        const id = Number(selectedRow.tagID || 0);
        await requestApiData<unknown>(
          `/Tags/update/${id}`,
          {
            method: "PUT",
            body: {
              tagName: formValues.tagName.trim(),
              description: formValues.description.trim(),
            },
          },
          "Không thể cập nhật Tag.",
        );
        addToast("Cập nhật Tag thành công.", "success");
      }

      setActiveModal(null);
      await loadRows();
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Không thể lưu Tag.",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetFilters = () => {
    setSearchInput("");
    setSearchKeyword("");
    setFilters({ tagCode: "", tagName: "" });
    setPage(1);
  };

  return (
    <div className="tags-module admin-dashboard">
      <div className="dashboard-header">
        <h1>
          <BookOpen size={28} color="#1e3a5f" /> Quản lý tag chuyên môn
        </h1>
        <p>Danh mục các tag, nhãn khoa học phân loại lĩnh vực chuyên môn và hướng nghiên cứu.</p>
      </div>

      <div className="tags-toolbar">
        <div
          style={{
            display: "flex",
            gap: 10,
            flex: "1 1 460px",
            flexWrap: "wrap",
          }}
        >
          <div className="tags-search-wrap">
            <Search size={16} />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tìm theo mã/tên Tag..."
            />
            {suggestions.length > 0 && searchInput.trim() ? (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  right: 0,
                  zIndex: 20,
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  background: "#fff",
                  boxShadow: "0 8px 18px rgba(15,23,42,0.12)",
                  maxHeight: 220,
                  overflowY: "auto",
                }}
              >
                {suggestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setSearchInput(item);
                      setSuggestions([]);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      background: "#fff",
                      padding: "10px 12px",
                      cursor: "pointer",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setShowAdvancedFilters((prev) => !prev)}
            className="tags-btn tags-btn-secondary"
            style={{
              background: showAdvancedFilters ? "#f0f6ff" : "#fff",
            }}
          >
            <Filter size={14} /> Bộ lọc
          </button>

          <button
            type="button"
            onClick={() => {
              setPage(1);
              void loadRows();
            }}
            className="tags-btn tags-btn-secondary"
          >
            Tìm kiếm
          </button>
        </div>

        <div className="tags-actions-wrap">
          <button
            type="button"
            onClick={openCreate}
            className="tags-create-btn"
          >
            <Plus size={14} /> Tạo Tag
          </button>
        </div>
      </div>

      {showAdvancedFilters && (
        <div className="tags-filter-panel">
          <div className="tags-filter-grid">
            <label className="tags-filter-field">
              <span>Mã Tag</span>
              <input
                value={filters.tagCode}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, tagCode: event.target.value }))
                }
                placeholder="Lọc theo mã Tag"
              />
            </label>
            <label className="tags-filter-field">
              <span>Tên Tag</span>
              <input
                value={filters.tagName}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, tagName: event.target.value }))
                }
                placeholder="Lọc theo tên Tag"
              />
            </label>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              onClick={resetFilters}
              className="tags-btn tags-btn-secondary"
            >
              Xóa bộ lọc
            </button>
          </div>
        </div>
      )}

      <div className="recent-topics-section" style={{ overflowX: "auto" }}>
        <table className="topics-table">
          <thead>
            <tr>
              <th>Mã Tag</th>
              <th>Tên Tag</th>
              <th>Mô tả</th>
              <th>Ngày tạo</th>
              <th style={{ textAlign: "center" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5}>Đang tải dữ liệu...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5}>Không có dữ liệu Tag.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.tagID}-${row.tagCode}`}>
                  <td>{row.tagCode}</td>
                  <td>{row.tagName}</td>
                  <td>{row.description || ""}</td>
                  <td>{formatDate(row.createdAt)}</td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => void openDetail(row)}
                        title="Chi tiết"
                        style={{
                          border: "1px solid #cbd5e1",
                          background: "#fff",
                          borderRadius: 8,
                          padding: 6,
                        }}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void openEdit(row)}
                        title="Cập nhật"
                        style={{
                          border: "1px solid #cbd5e1",
                          background: "#fff",
                          borderRadius: 8,
                          padding: 6,
                        }}
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(row)}
                        title="Xóa"
                        disabled={isSubmitting}
                        style={{
                          border: "1px solid #fecaca",
                          background: "#fff",
                          color: "#b91c1c",
                          borderRadius: 8,
                          padding: 6,
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div
          style={{
            marginTop: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <div style={{ color: "#64748b", fontSize: 13 }}>
            Tổng số Tag: <strong>{totalCount}</strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "6px 8px",
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <button
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "6px 10px",
                background: "#fff",
              }}
            >
              Trước
            </button>
            <span style={{ minWidth: 94, textAlign: "center", fontSize: 13 }}>
              Trang {page} / {pageCount}
            </span>
            <button
              type="button"
              disabled={page >= pageCount || isLoading}
              onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "6px 10px",
                background: "#fff",
              }}
            >
              Sau
            </button>
          </div>
        </div>
      </div>

      {activeModal && (
        <div className="tags-modal-overlay">
          <div className="tags-detail-modal">
            <div className="tags-modal-header">
              <h3>
                {activeModal === "create"
                  ? "Tạo Tag"
                  : activeModal === "edit"
                    ? "Cập nhật Tag"
                    : "Chi tiết Tag"}
              </h3>
              <button
                type="button"
                className="tags-modal-close-btn"
                onClick={() => setActiveModal(null)}
                aria-label="Đóng"
              >
                <X size={16} />
              </button>
            </div>

            {activeModal === "detail" ? (
              <div className="tags-modal-body">
                {/* Hero Badge Tag */}
                <div className="tags-detail-hero">
                  <div className="tags-detail-badge">
                    🏷️ {selectedRow?.tagName || "Chưa đặt tên Tag"}
                  </div>
                  <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>
                    Mã Tag: {selectedRow?.tagCode || "--"}
                  </span>
                </div>

                <div className="tags-detail-grid">
                  <div className="tags-detail-card">
                    <div className="tags-card-title">Thông tin chi tiết</div>
                    
                    <div className="tags-info-row">
                      <span className="tags-info-label">Tag ID</span>
                      <span className="tags-info-value">{selectedRow?.tagID ?? "--"}</span>
                    </div>

                    <div className="tags-info-row">
                      <span className="tags-info-label">Mã Tag</span>
                      <span className="tags-info-value">{selectedRow?.tagCode ?? "--"}</span>
                    </div>

                    <div className="tags-info-row">
                      <span className="tags-info-label">Tên Tag</span>
                      <span className="tags-info-value">{selectedRow?.tagName ?? "--"}</span>
                    </div>

                    <div className="tags-info-row">
                      <span className="tags-info-label">Ngày tạo</span>
                      <span className="tags-info-value">
                        {selectedRow?.createdAt ? formatDate(selectedRow.createdAt) : "--"}
                      </span>
                    </div>
                  </div>

                  <div className="tags-detail-card">
                    <div className="tags-card-title">Mô tả chi tiết</div>
                    {selectedRow?.description ? (
                      <div className="tags-description-box">
                        {selectedRow.description}
                      </div>
                    ) : (
                      <span style={{ color: "#64748b", fontSize: 13, fontStyle: "italic" }}>
                        Không có mô tả cho Tag này.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <ManagementFormSection
                fields={tagFormFields}
                values={formValues}
                onFieldChange={(name, value) =>
                  setFormValues((prev) => ({ ...prev, [name]: value }))
                }
                onSubmit={() => void handleSubmit()}
                onClose={() => setActiveModal(null)}
                isSubmitting={isSubmitting}
                note={
                  activeModal === "create"
                    ? "Nhập thông tin Tag mới theo schema chuẩn. Mã Tag có thể để trống nếu backend tự sinh hoặc map theo quy ước hiện có."
                    : "Chỉnh sửa tên và mô tả Tag. Mã Tag được giữ nguyên để đồng bộ với các dữ liệu liên quan."
                }
                disabledFields={activeModal === "edit" ? ["tagCode"] : []}
                showActions={false}
                showCloseButton={false}
              />
            )}

            <div className="tags-modal-footer">
              <button
                type="button"
                className="tags-footer-btn-close"
                onClick={() => setActiveModal(null)}
                disabled={isSubmitting}
                style={{
                  background: activeModal === "detail" ? "#1e3a5f" : "transparent",
                  color: activeModal === "detail" ? "#fff" : "#334155",
                  border: activeModal === "detail" ? "none" : "1px solid #cbd5e1",
                  borderRadius: 10,
                  padding: "10px 24px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {activeModal === "detail" ? "Đóng" : "Hủy"}
              </button>
              {activeModal !== "detail" && (
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={isSubmitting}
                  style={{
                    border: "none",
                    background: "#1e3a5f",
                    color: "#fff",
                    borderRadius: 10,
                    padding: "10px 24px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {isSubmitting
                    ? "Đang lưu..."
                    : activeModal === "create"
                      ? "Tạo Tag"
                      : "Lưu cập nhật"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TagsManagement;
