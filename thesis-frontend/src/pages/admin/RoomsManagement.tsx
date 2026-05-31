import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  Download,
  Eye,
  Pencil,
  PieChart,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  AlertTriangle,
  Building,
  FileDown,
  FileUp,
} from "lucide-react";
import { fetchData, FetchDataError, normalizeUrl } from "../../api/fetchData";
import { getAccessToken } from "../../services/auth-session.service";
import { useToast } from "../../context/useToast";
import type { ApiResponse } from "../../types/api";
import {
  pickCaseInsensitiveValue,
  readEnvelopeData,
  readEnvelopeErrorMessages,
  readEnvelopeMessage,
  readEnvelopeSuccess,
  readEnvelopeTotalCount,
  readEnvelopeWarningMessages,
} from "../../utils/api-envelope";

// --- Types ---

type RoomStatusLabel = "Đang hoạt động" | "Bảo trì" | "Ngưng sử dụng";

interface RoomRow {
  roomID: number;
  roomCode: string;
  status: string;
  createdAt: string;
  lastUpdated: string;
}

interface RoomStatusSummaryItem {
  status: string;
  count: number;
}

interface RoomImportRow {
  rowNumber: number;
  roomCode: string;
  status: string;
  result: string;
  message: string;
}

interface RoomImportResult {
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
  rows: RoomImportRow[];
}

// --- Helpers ---

function asString(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  const next = String(value).trim();
  return next || fallback;
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function formatDateTime(value: unknown): string {
  const raw = asString(value);
  if (!raw) return "--";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString("vi-VN");
}

function normalizeStatusLabel(value: unknown): string {
  const raw = asString(value);
  if (!raw) return "Đang hoạt động";
  const normalized = raw.toLowerCase();
  if (normalized === "active" || normalized === "available" || normalized.includes("đang hoạt")) return "Đang hoạt động";
  if (normalized === "maintenance" || normalized.includes("bảo trì")) return "Bảo trì";
  if (normalized === "inactive" || normalized === "disabled" || normalized.includes("ngưng")) return "Ngưng sử dụng";
  return raw;
}

function getStatusTone(status?: string): string {
  const value = normalizeStatusLabel(status);
  if (value === "Đang hoạt động") return "approved";
  if (value === "Bảo trì") return "pending";
  return "rejected";
}

function parseRoom(item: Record<string, unknown>): RoomRow | null {
  const roomID = asNumber(pickCaseInsensitiveValue(item, ["roomID", "roomId", "id"], null));
  const roomCode = asString(pickCaseInsensitiveValue(item, ["roomCode", "code"], "")).toUpperCase();
  if (!roomID || !roomCode) return null;
  return {
    roomID,
    roomCode,
    status: normalizeStatusLabel(pickCaseInsensitiveValue(item, ["status", "roomStatus"], "Đang hoạt động")),
    createdAt: formatDateTime(pickCaseInsensitiveValue(item, ["createdAt", "createdDate"], "")),
    lastUpdated: formatDateTime(pickCaseInsensitiveValue(item, ["lastUpdated", "updatedAt", "lastModified"], "")),
  };
}

// --- Styles ---

const INJECTED_STYLES = `
.rooms-module {
  padding: 16px;
  max-width: 1400px;
  margin: 0 auto;
  background: transparent;
}

.rooms-header {
  margin-bottom: 18px;
}

.rooms-header h1 {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 700;
  color: #1a1a1a;
  display: flex;
  align-items: center;
  gap: 10px;
}

.rooms-header p {
  margin: 0;
  color: #667085;
  font-size: 12px;
}

.rooms-toolbar {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  padding: 12px;
  margin-bottom: 14px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
}

.rooms-search-wrap {
  position: relative;
  flex: 1 1 360px;
}

.rooms-search-wrap svg {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
}

.rooms-search-wrap input {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 8px 10px 8px 36px;
  font-size: 12px;
  outline: none;
}

.rooms-search-wrap input:focus {
  border-color: #1e3a5f;
  box-shadow: 0 0 0 3px rgba(30, 58, 95, 0.12);
}

.rooms-actions-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.rooms-btn {
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  padding: 7px 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.rooms-btn-primary {
  background: #1e3a5f;
  color: #fff;
}

.rooms-btn-primary:hover {
  background: #162d4c;
}

.rooms-btn-secondary {
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #334155;
}

.rooms-btn-secondary:hover {
  background: #f8fafc;
}

.rooms-filter-panel {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px;
  display: grid;
  gap: 10px;
  background: #f8fafc;
  margin-bottom: 14px;
}

.rooms-filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}

.rooms-filter-field {
  display: grid;
  gap: 6px;
}

.rooms-filter-field span {
  font-size: 13px;
  color: #334155;
  font-weight: 600;
}

.rooms-filter-field input,
.rooms-filter-field select {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 10px;
  background: #fff;
  font-size: 13px;
}

.rooms-table-wrap {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  overflow-x: auto;
}

.rooms-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 800px;
}

.rooms-table th {
  padding: 12px 14px;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
  color: #243b53;
  font-size: 12px;
  font-weight: 700;
  background: #f8fafc;
}

.rooms-table td {
  padding: 10px 14px;
  border-bottom: 1px solid #edf2f7;
  font-size: 13px;
  color: #1e293b;
}

.rooms-table tr:hover {
  background: #fcfcfd;
}

.rooms-badge {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.rooms-badge-approved { background: #dcfce7; color: #16a34a; border: 1px solid #bbf7d0; }
.rooms-badge-pending { background: #fef3c7; color: #d97706; border: 1px solid #fde68a; }
.rooms-badge-rejected { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }

.rooms-icon-btn {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 6px;
  background: #fff;
  color: #334155;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.rooms-icon-btn-danger {
  border-color: #fecaca;
  color: #b91c1c;
}

.rooms-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 10005;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.rooms-modal {
  width: 100%;
  max-width: 500px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.18);
  overflow: hidden;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.rooms-modal-header {
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.rooms-modal-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.rooms-modal-body {
  padding: 20px;
  overflow-y: auto;
}

.rooms-modal-footer {
  padding: 14px 20px;
  background: #f8fafc;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
}

.rooms-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.rooms-stat-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.rooms-stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rooms-stat-info {
  display: flex;
  flex-direction: column;
}

.rooms-stat-label {
  font-size: 11px;
  font-weight: 600;
  color: #667085;
}

.rooms-stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
}

.import-results-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.import-results-table th {
  background: #f1f5f9;
  padding: 8px;
  text-align: left;
  border: 1px solid #e2e8f0;
}

.import-results-table td {
  padding: 8px;
  border: 1px solid #e2e8f0;
}
`;

// --- Main Component ---

const RoomsManagement: React.FC = () => {
  const { addToast } = useToast();

  // State
  const [rooms, setRows] = useState<RoomRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [statusSummary, setStatusSummary] = useState<RoomStatusSummaryItem[]>([]);
  
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [showFilters, setShowFilters] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [formState, setFormState] = useState({ roomCode: "", status: "Đang hoạt động" });
  const [isSaving, setIsSaving] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<RoomImportResult | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Load Data
  const loadRows = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword.trim()) params.set("keyword", keyword.trim());
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const response = await fetchData<ApiResponse<unknown>>(`/rooms/get-list?${params.toString()}`, { method: "GET" });
      if (!readEnvelopeSuccess(response)) throw new Error(readEnvelopeMessage(response) || "Không tải được danh sách phòng.");

      const payload = readEnvelopeData<unknown>(response);
      const items = Array.isArray(payload) ? payload : (payload as any)?.items || [];
      const nextRows = items.map((item: any) => parseRoom(item)).filter(Boolean) as RoomRow[];
      
      setRows(nextRows);
      const count = readEnvelopeTotalCount(response);
      setTotalCount(count > 0 ? count : nextRows.length);
    } catch (error: any) {
      addToast(error.message || "Lỗi tải dữ liệu", "error");
    } finally {
      setIsLoading(false);
    }
  }, [keyword, page, pageSize, addToast]);

  const loadSummary = useCallback(async () => {
    try {
      const response = await fetchData<ApiResponse<unknown>>("/rooms/status-summary", { method: "GET" });
      if (readEnvelopeSuccess(response)) {
        const payload = readEnvelopeData<any[]>(response);
        if (payload) {
          setStatusSummary(payload.map(item => ({
            status: normalizeStatusLabel(pickCaseInsensitiveValue(item, ["status"], "")),
            count: asNumber(pickCaseInsensitiveValue(item, ["count"], 0)) ?? 0,
          })));
        }
      }
    } catch (err) {
      console.error("Summary error:", err);
    }
  }, []);

  useEffect(() => {
    void loadRows();
    void loadSummary();
  }, [loadRows, loadSummary]);

  // Actions
  const handleSave = async () => {
    const roomCode = formState.roomCode.trim().toUpperCase();
    if (!roomCode) {
      addToast("Mã phòng không được để trống.", "warning");
      return;
    }

    setIsSaving(true);
    try {
      const body = { roomCode, status: formState.status };
      const response = editingRoomId
        ? await fetchData<ApiResponse<unknown>>(`/rooms/update/${editingRoomId}`, { method: "PUT", body })
        : await fetchData<ApiResponse<unknown>>("/rooms/create", { method: "POST", body });

      if (!readEnvelopeSuccess(response)) throw new Error(readEnvelopeMessage(response) || "Lỗi lưu dữ liệu");

      addToast(editingRoomId ? "Cập nhật thành công." : "Tạo mới thành công.", "success");
      setShowForm(false);
      void loadRows();
      void loadSummary();
    } catch (error: any) {
      addToast(error.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (room: RoomRow) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa phòng ${room.roomCode}?`)) return;

    try {
      const response = await fetchData<ApiResponse<unknown>>(`/rooms/delete/${room.roomID}`, { method: "DELETE" });
      if (!readEnvelopeSuccess(response)) throw new Error(readEnvelopeMessage(response) || "Lỗi xóa phòng");

      addToast("Xóa phòng thành công.", "success");
      void loadRows();
      void loadSummary();
    } catch (error: any) {
      addToast(error.message, "error");
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const token = getAccessToken();
      const response = await fetch(normalizeUrl("/api/rooms/export-excel"), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Không thể xuất file.");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Danh_Sach_Phong_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      addToast("Xuất file thành công.", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadSample = async () => {
    try {
      const token = getAccessToken();
      const response = await fetch(normalizeUrl("/api/rooms/sample-excel"), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Không thể tải mẫu.");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Mau_Import_Phong.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      addToast(err.message, "error");
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      addToast("Vui lòng chọn file.", "warning");
      return;
    }
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      
      const token = getAccessToken();
      const response = await fetch(normalizeUrl("/api/rooms/import-excel?upsert=true"), {
        method: "POST",
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const result = await response.json() as ApiResponse<unknown>;
      if (!readEnvelopeSuccess(result)) throw new Error(readEnvelopeMessage(result) || "Lỗi import.");

      const data = readEnvelopeData<any>(result);
      // Parse result rows
      const rowsRaw = pickCaseInsensitiveValue<unknown>(data, ["rows"], []);
      const rows = Array.isArray(rowsRaw) ? rowsRaw.map(r => ({
        rowNumber: asNumber(pickCaseInsensitiveValue(r, ["rowNumber"], 0)) ?? 0,
        roomCode: asString(pickCaseInsensitiveValue(r, ["roomCode"], "-")),
        status: normalizeStatusLabel(pickCaseInsensitiveValue(r, ["status"], "")),
        result: asString(pickCaseInsensitiveValue(r, ["result"], "")),
        message: asString(pickCaseInsensitiveValue(r, ["message"], ""))
      })) : [];

      setImportResult({
        totalRows: asNumber(pickCaseInsensitiveValue(data, ["totalRows"], 0)) ?? 0,
        createdCount: asNumber(pickCaseInsensitiveValue(data, ["createdCount"], 0)) ?? 0,
        updatedCount: asNumber(pickCaseInsensitiveValue(data, ["updatedCount"], 0)) ?? 0,
        failedCount: asNumber(pickCaseInsensitiveValue(data, ["failedCount"], 0)) ?? 0,
        rows
      });
      
      addToast("Import hoàn tất.", "success");
      void loadRows();
      void loadSummary();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setIsImporting(false);
    }
  };

  // Filters
  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return rooms;
    return rooms.filter(r => normalizeStatusLabel(r.status) === normalizeStatusLabel(statusFilter));
  }, [rooms, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const map = new Map(statusSummary.map(s => [s.status, s.count]));
    return {
      total: statusSummary.reduce((acc, s) => acc + s.count, 0) || totalCount,
      active: map.get("Đang hoạt động") || 0,
      maintenance: map.get("Bảo trì") || 0,
      inactive: map.get("Ngưng sử dụng") || 0,
    };
  }, [statusSummary, totalCount]);

  return (
    <div className="rooms-module">
      <style>{INJECTED_STYLES}</style>

      <header className="rooms-header">
        <h1><Building2 size={24} color="#1e3a5f" /> Quản lý Phòng bảo vệ</h1>
        <p>Quản lý danh sách các phòng học được sử dụng làm hội đồng bảo vệ khóa luận.</p>
      </header>

      <div className="rooms-stats-grid">
        <div className="rooms-stat-card">
          <div className="rooms-stat-icon" style={{ background: "#f0f9ff", color: "#0284c7" }}><Building size={20} /></div>
          <div className="rooms-stat-info">
            <span className="rooms-stat-label">Tổng số phòng</span>
            <span className="rooms-stat-value">{stats.total}</span>
          </div>
        </div>
        <div className="rooms-stat-card">
          <div className="rooms-stat-icon" style={{ background: "#f0fdf4", color: "#16a34a" }}><RefreshCw size={20} /></div>
          <div className="rooms-stat-info">
            <span className="rooms-stat-label">Đang hoạt động</span>
            <span className="rooms-stat-value">{stats.active}</span>
          </div>
        </div>
        <div className="rooms-stat-card">
          <div className="rooms-stat-icon" style={{ background: "#fffbeb", color: "#d97706" }}><AlertTriangle size={20} /></div>
          <div className="rooms-stat-info">
            <span className="rooms-stat-label">Bảo trì</span>
            <span className="rooms-stat-value">{stats.maintenance}</span>
          </div>
        </div>
        <div className="rooms-stat-card">
          <div className="rooms-stat-icon" style={{ background: "#fef2f2", color: "#dc2626" }}><Trash2 size={20} /></div>
          <div className="rooms-stat-info">
            <span className="rooms-stat-label">Ngưng sử dụng</span>
            <span className="rooms-stat-value">{stats.inactive}</span>
          </div>
        </div>
      </div>

      <div className="rooms-toolbar">
        <div className="rooms-search-wrap">
          <Search size={16} />
          <input 
            type="text" 
            placeholder="Tìm kiếm mã phòng..." 
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(page); }}
          />
        </div>
        <div className="rooms-actions-wrap">
          <button className="rooms-btn rooms-btn-secondary" onClick={() => setShowFilters(!showFilters)}>
            <PieChart size={14} /> Bộ lọc
          </button>
          <button className="rooms-btn rooms-btn-secondary" onClick={() => setShowImport(true)}>
            <FileUp size={14} /> Import
          </button>
          <button className="rooms-btn rooms-btn-primary" onClick={() => { setEditingRoomId(null); setFormState({ roomCode: "", status: "Đang hoạt động" }); setShowForm(true); }}>
            <Plus size={14} /> Thêm phòng
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="rooms-filter-panel">
          <div className="rooms-filter-grid">
            <div className="rooms-filter-field">
              <span>Trạng thái</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">Tất cả trạng thái</option>
                <option value="Đang hoạt động">Đang hoạt động</option>
                <option value="Bảo trì">Bảo trì</option>
                <option value="Ngưng sử dụng">Ngưng sử dụng</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="rooms-table-wrap">
        <table className="rooms-table">
          <thead>
            <tr>
              <th style={{ width: "25%" }}>MÃ PHÒNG</th>
              <th style={{ width: "25%" }}>TRẠNG THÁI</th>
              <th style={{ width: "20%" }}>NGÀY TẠO</th>
              <th style={{ width: "20%" }}>CẬP NHẬT</th>
              <th style={{ width: "10%", textAlign: "center" }}>THAO TÁC</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: "40px" }}>Đang tải dữ liệu...</td></tr>
            ) : filteredRows.length > 0 ? (
              filteredRows.map(room => (
                <tr key={room.roomID}>
                  <td style={{ fontWeight: 600 }}>{room.roomCode}</td>
                  <td>
                    <span className={`rooms-badge rooms-badge-${getStatusTone(room.status)}`}>
                      {room.status}
                    </span>
                  </td>
                  <td>{room.createdAt}</td>
                  <td>{room.lastUpdated}</td>
                  <td style={{ textAlign: "center" }}>
                    <div className="rooms-action-btns" style={{ justifyContent: "center", display: "flex", gap: "8px" }}>
                      <button className="rooms-icon-btn" onClick={() => { setEditingRoomId(room.roomID); setFormState({ roomCode: room.roomCode, status: room.status }); setShowForm(true); }}>
                        <Pencil size={12} />
                      </button>
                      <button className="rooms-icon-btn rooms-icon-btn-danger" onClick={() => handleDelete(room)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: "40px" }}>Không tìm thấy phòng nào.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="rooms-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="rooms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rooms-modal-header">
              <h2>{editingRoomId ? "Cập nhật phòng" : "Thêm phòng mới"}</h2>
              <button className="rooms-icon-btn" onClick={() => setShowForm(false)}>&times;</button>
            </div>
            <div className="rooms-modal-body">
              <div className="rooms-form-group">
                <label>Mã phòng</label>
                <input 
                  type="text" 
                  value={formState.roomCode} 
                  onChange={(e) => setFormState({ ...formState, roomCode: e.target.value })}
                  placeholder="VD: P.101"
                />
              </div>
              <div className="rooms-form-group">
                <label>Trạng thái</label>
                <select 
                  value={formState.status} 
                  onChange={(e) => setFormState({ ...formState, status: e.target.value })}
                >
                  <option value="Đang hoạt động">Đang hoạt động</option>
                  <option value="Bảo trì">Bảo trì</option>
                  <option value="Ngưng sử dụng">Ngưng sử dụng</option>
                </select>
              </div>
            </div>
            <div className="rooms-modal-footer">
              <button className="rooms-btn rooms-btn-secondary" onClick={() => setShowForm(false)} disabled={isSaving}>Hủy</button>
              <button className="rooms-btn rooms-btn-primary" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="rooms-modal-overlay" onClick={() => { if (!isImporting) setShowImport(false); }}>
          <div className="rooms-modal" style={{ maxWidth: "800px" }} onClick={(e) => e.stopPropagation()}>
            <div className="rooms-modal-header">
              <h2>Import danh sách phòng học</h2>
              <button className="rooms-icon-btn" onClick={() => setShowImport(false)}>&times;</button>
            </div>
            <div className="rooms-modal-body">
              {!importResult ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <p style={{ fontSize: "13px", color: "#64748b" }}>
                    Tải file Excel mẫu tại đây: 
                    <button className="rooms-btn rooms-btn-secondary" style={{ marginLeft: "8px" }} onClick={handleDownloadSample}>
                      <FileDown size={14} /> Tải file mẫu
                    </button>
                  </p>
                  <div style={{ padding: "24px", border: "2px dashed #e2e8f0", borderRadius: "12px", textAlign: "center" }}>
                    <input 
                      type="file" 
                      accept=".xlsx, .xls" 
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      style={{ marginBottom: "12px" }}
                    />
                    {importFile && <p style={{ fontSize: "12px", color: "#1e293b" }}>File đã chọn: <strong>{importFile.name}</strong></p>}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
                    <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", textAlign: "center" }}>
                      <span style={{ display: "block", fontSize: "11px", color: "#64748b" }}>Tổng số</span>
                      <strong style={{ fontSize: "18px" }}>{importResult.totalRows}</strong>
                    </div>
                    <div style={{ background: "#f0fdf4", padding: "12px", borderRadius: "8px", textAlign: "center" }}>
                      <span style={{ display: "block", fontSize: "11px", color: "#16a34a" }}>Tạo mới</span>
                      <strong style={{ fontSize: "18px", color: "#16a34a" }}>{importResult.createdCount}</strong>
                    </div>
                    <div style={{ background: "#eff6ff", padding: "12px", borderRadius: "8px", textAlign: "center" }}>
                      <span style={{ display: "block", fontSize: "11px", color: "#2563eb" }}>Cập nhật</span>
                      <strong style={{ fontSize: "18px", color: "#2563eb" }}>{importResult.updatedCount}</strong>
                    </div>
                    <div style={{ background: "#fef2f2", padding: "12px", borderRadius: "8px", textAlign: "center" }}>
                      <span style={{ display: "block", fontSize: "11px", color: "#dc2626" }}>Lỗi</span>
                      <strong style={{ fontSize: "18px", color: "#dc2626" }}>{importResult.failedCount}</strong>
                    </div>
                  </div>
                  
                  <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                    <table className="import-results-table">
                      <thead>
                        <tr>
                          <th>Dòng</th>
                          <th>Mã phòng</th>
                          <th>Kết quả</th>
                          <th>Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResult.rows.map((r, i) => (
                          <tr key={i}>
                            <td>{r.rowNumber}</td>
                            <td>{r.roomCode}</td>
                            <td>
                              <span style={{ color: r.result.includes("Success") ? "#16a34a" : "#dc2626", fontWeight: "600" }}>
                                {r.result}
                              </span>
                            </td>
                            <td>{r.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="rooms-modal-footer">
              <button 
                className="rooms-btn rooms-btn-secondary" 
                onClick={() => { setShowImport(false); setImportResult(null); setImportFile(null); }}
              >
                Đóng
              </button>
              {!importResult && (
                <button 
                  className="rooms-btn rooms-btn-primary" 
                  onClick={handleImport} 
                  disabled={isImporting || !importFile}
                >
                  {isImporting ? "Đang xử lý..." : "Bắt đầu Import"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomsManagement;
