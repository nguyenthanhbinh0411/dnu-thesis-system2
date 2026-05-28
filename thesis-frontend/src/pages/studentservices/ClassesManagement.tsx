import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Edit, Eye, Filter, Plus, Search, Trash2, Users } from "lucide-react";
import { fetchData } from "../../api/fetchData";
import TablePagination from "../../components/TablePagination/TablePagination";
import { useToast } from "../../context/useToast";
import type { ApiResponse } from "../../types/api";

type RecordData = Record<string, any>;

interface DepartmentOption {
  departmentID: number;
  departmentCode: string;
  name: string;
}

interface CohortOption {
  id: number;
  cohortCode: string;
  cohortName: string;
}

interface StudentProfileSummary {
  studentProfileID: number;
  studentCode: string;
  fullName: string;
  studentEmail?: string;
  phoneNumber?: string;
  gpa?: number;
  status?: string;
}

const DEEP_BLUE_PRIMARY = "#1e3a5f";
const ORANGE_ACCENT = "#f37021";

export const ClassesManagement: React.FC = () => {
  const { addToast } = useToast();
  const [rows, setRows] = useState<RecordData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeModal, setActiveModal] = useState<"detail" | "create" | "edit" | null>(null);
  const [selectedRow, setSelectedRow] = useState<RecordData | null>(null);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [isCohortSelectorOpen, setIsCohortSelectorOpen] = useState(false);
  const [cohortSearch, setCohortSearch] = useState("");
  
  // Detail Modal tabs
  const [detailTab, setDetailTab] = useState<"info" | "students">("info");
  const [students, setStudents] = useState<StudentProfileSummary[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  // Form Fields State
  const [classCode, setClassCode] = useState("");
  const [className, setClassName] = useState("");
  const [departmentId, setDepartmentId] = useState<number>(0);
  const [cohortCode, setCohortCode] = useState("");
  const [enrollmentYear, setEnrollmentYear] = useState<string>("");
  const [status, setStatus] = useState("Đang hoạt động");

  // Filter States
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [filterClassCode, setFilterClassCode] = useState("");
  const [filterClassName, setFilterClassName] = useState("");
  const [filterDeptCode, setFilterDeptCode] = useState("");
  const [filterCohortCode, setFilterCohortCode] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize))),
    [pageSize, totalCount]
  );

  const filteredCohorts = useMemo(() => {
    if (!cohortSearch.trim()) return cohorts;
    const query = cohortSearch.toLowerCase().trim();
    return cohorts.filter(c => 
      c.cohortName.toLowerCase().includes(query) || 
      c.cohortCode.toLowerCase().includes(query)
    );
  }, [cohorts, cohortSearch]);

  // Sync Search Keyword with Debounce
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchKeyword(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  // Load Departments for dropdowns
  const fetchDepartments = useCallback(async () => {
    try {
      const response = await fetchData<ApiResponse<DepartmentOption[]>>(
        "/api/Departments/get-list?pageSize=200"
      );
      if (response?.success && Array.isArray(response.data)) {
        setDepartments(response.data);
      }
    } catch (err: any) {
      console.error("Failed to load departments:", err);
    }
  }, []);

  const fetchCohorts = useCallback(async () => {
    try {
      const response = await fetchData<ApiResponse<CohortOption[]>>(
        "/api/Cohorts/get-list?pageSize=200"
      );
      if (response?.success && Array.isArray(response.data)) {
        setCohorts(response.data);
      }
    } catch (err: any) {
      console.error("Failed to load cohorts:", err);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
    fetchCohorts();
  }, [fetchDepartments, fetchCohorts]);

  // Fetch Classes List
  const fetchClasses = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("pageSize", pageSize.toString());

      if (searchKeyword) params.append("search", searchKeyword);
      if (filterClassCode) params.append("classCode", filterClassCode.trim());
      if (filterClassName) params.append("className", filterClassName.trim());
      if (filterDeptCode) params.append("departmentCode", filterDeptCode.trim());
      if (filterCohortCode) params.append("cohortCode", filterCohortCode.trim());
      if (filterStatus) params.append("status", filterStatus);

      const response = await fetchData<ApiResponse<RecordData[]>>(
        `/api/Classes/get-list?${params.toString()}`
      );

      if (response?.success) {
        setRows(response.data || []);
        setTotalCount(response.totalCount || 0);
      } else {
        addToast(response?.message || "Không thể tải danh sách lớp học", "error");
      }
    } catch (err: any) {
      addToast(err?.message || "Lỗi kết nối máy chủ", "error");
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, searchKeyword, filterClassCode, filterClassName, filterDeptCode, filterCohortCode, filterStatus, addToast]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  // Fetch Students of specific class (for detail view)
  const fetchClassStudents = useCallback(async (code: string) => {
    setStudentsLoading(true);
    try {
      const response = await fetchData<ApiResponse<StudentProfileSummary[]>>(
        `/api/StudentProfiles/get-list?pageSize=500&classCode=${encodeURIComponent(code)}`
      );
      if (response?.success && Array.isArray(response.data)) {
        setStudents(response.data);
      } else {
        setStudents([]);
      }
    } catch (err: any) {
      console.error(err);
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRow && detailTab === "students") {
      fetchClassStudents(selectedRow.classCode);
    }
  }, [selectedRow, detailTab, fetchClassStudents]);

  // CRUD Actions
  const handleOpenCreate = () => {
    setClassCode("");
    setClassName("");
    setDepartmentId(departments[0]?.departmentID || 0);
    setCohortCode("");
    setEnrollmentYear("");
    setStatus("Đang hoạt động");
    setActiveModal("create");
  };

  const handleOpenEdit = (row: RecordData) => {
    setSelectedRow(row);
    setClassName(row.className || "");
    setDepartmentId(row.departmentID || 0);
    setCohortCode(row.cohortCode || "");
    setEnrollmentYear(row.enrollmentYear?.toString() || "");
    setStatus(row.status || "Đang hoạt động");
    setActiveModal("edit");
  };

  const handleOpenDetail = (row: RecordData) => {
    setSelectedRow(row);
    setDetailTab("info");
    setStudents([]);
    setActiveModal("detail");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classCode.trim() || !className.trim() || !departmentId) {
      addToast("Vui lòng nhập đầy đủ thông tin bắt buộc", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        classCode: classCode.trim(),
        className: className.trim(),
        departmentID: Number(departmentId),
        cohortCode: cohortCode.trim() || null,
        enrollmentYear: enrollmentYear ? Number(enrollmentYear) : null,
        status: status
      };

      const response = await fetchData<ApiResponse<RecordData>>("/api/Classes/create", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" }
      });

      if (response?.success) {
        addToast("Tạo lớp học thành công!", "success");
        setActiveModal(null);
        fetchClasses();
      } else {
        addToast(response?.message || "Tạo lớp học thất bại", "error");
      }
    } catch (err: any) {
      addToast(err?.message || "Lỗi máy chủ", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRow) return;
    if (!className.trim() || !departmentId) {
      addToast("Vui lòng nhập đầy đủ thông tin bắt buộc", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        className: className.trim(),
        departmentID: Number(departmentId),
        cohortCode: cohortCode.trim() || null,
        enrollmentYear: enrollmentYear ? Number(enrollmentYear) : null,
        status: status
      };

      const response = await fetchData<ApiResponse<RecordData>>(
        `/api/Classes/update/${selectedRow.classID}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" }
        }
      );

      if (response?.success) {
        addToast("Cập nhật lớp học thành công!", "success");
        setActiveModal(null);
        fetchClasses();
      } else {
        addToast(response?.message || "Cập nhật lớp học thất bại", "error");
      }
    } catch (err: any) {
      addToast(err?.message || "Lỗi máy chủ", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, code: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa lớp học "${code}"?`)) return;

    try {
      const response = await fetchData<ApiResponse<any>>(`/api/Classes/delete/${id}`, {
        method: "DELETE"
      });

      if (response?.success) {
        addToast("Xóa lớp học thành công!", "success");
        fetchClasses();
      } else {
        addToast(response?.message || "Không thể xóa lớp học do có dữ liệu liên kết", "error");
      }
    } catch (err: any) {
      addToast(err?.message || "Lỗi máy chủ", "error");
    }
  };

  const handleResetFilters = () => {
    setFilterClassCode("");
    setFilterClassName("");
    setFilterDeptCode("");
    setFilterCohortCode("");
    setFilterStatus("");
    setSearchInput("");
    setPage(1);
  };

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      {/* Top action bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        {/* Search */}
        <div style={{ position: "relative", minWidth: "300px", maxWidth: "450px", flex: 1 }}>
          <Search size={18} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
          <input
            type="text"
            placeholder="Tìm theo tên hoặc mã lớp..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 16px 10px 42px",
              border: "1px solid #cbd5e1",
              borderRadius: "12px",
              fontSize: "14px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
              outline: "none"
            }}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              border: `1px solid ${showAdvancedFilters ? DEEP_BLUE_PRIMARY : "#cbd5e1"}`,
              background: showAdvancedFilters ? "#f0f6ff" : "white",
              color: DEEP_BLUE_PRIMARY,
              fontWeight: 600,
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer"
            }}
          >
            <Filter size={16} /> Bộ lọc
          </button>

          <button
            onClick={handleOpenCreate}
            style={{
              padding: "10px 18px",
              borderRadius: "12px",
              border: "none",
              background: `linear-gradient(135deg, ${DEEP_BLUE_PRIMARY}, #2b4c7e)`,
              color: "white",
              fontWeight: 700,
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(30,58,95,0.15)"
            }}
          >
            <Plus size={18} /> Tạo lớp mới
          </button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          padding: "20px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.02)"
        }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Mã lớp</label>
            <input
              type="text"
              value={filterClassCode}
              onChange={(e) => setFilterClassCode(e.target.value)}
              placeholder="Ví dụ: D18PM01"
              style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Tên lớp</label>
            <input
              type="text"
              value={filterClassName}
              onChange={(e) => setFilterClassName(e.target.value)}
              placeholder="Ví dụ: Công nghệ phần mềm 1"
              style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Khoa</label>
            <select
              value={filterDeptCode}
              onChange={(e) => setFilterDeptCode(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px" }}
            >
              <option value="">Tất cả</option>
              {departments.map((dept) => (
                <option key={dept.departmentID} value={dept.departmentCode}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Khóa học (Cohort)</label>
            <select
              value={filterCohortCode}
              onChange={(e) => setFilterCohortCode(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px" }}
            >
              <option value="">Tất cả</option>
              {cohorts.map((cohort) => (
                <option key={cohort.id} value={cohort.cohortCode}>
                  {cohort.cohortName} ({cohort.cohortCode})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Trạng thái</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px" }}
            >
              <option value="">Tất cả</option>
              <option value="Đang hoạt động">Đang hoạt động</option>
              <option value="Đã khóa">Đã khóa</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
            <button
              onClick={() => setPage(1)}
              style={{
                flex: 1,
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                background: DEEP_BLUE_PRIMARY,
                color: "white",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer"
              }}
            >
              Áp dụng
            </button>
            <button
              onClick={handleResetFilters}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "white",
                color: "#64748b",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer"
              }}
            >
              Đặt lại
            </button>
          </div>
        </div>
      )}

      {/* Main Table view */}
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "16px", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.01)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <th style={{ padding: "16px 20px", color: "#475569", fontWeight: 700 }}>Mã lớp</th>
              <th style={{ padding: "16px 20px", color: "#475569", fontWeight: 700 }}>Tên lớp học</th>
              <th style={{ padding: "16px 20px", color: "#475569", fontWeight: 700 }}>Khoa</th>
              <th style={{ padding: "16px 20px", color: "#475569", fontWeight: 700 }}>Khóa học</th>
              <th style={{ padding: "16px 20px", color: "#475569", fontWeight: 700 }}>Năm nhập học</th>
              <th style={{ padding: "16px 20px", color: "#475569", fontWeight: 700 }}>Trạng thái</th>
              <th style={{ padding: "16px 20px", color: "#475569", fontWeight: 700, textAlign: "right" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                  Đang tải danh sách lớp học...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                  Không tìm thấy lớp học nào khớp điều kiện.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.classID} style={{ borderBottom: "1px solid #f1f5f9" }} className="table-row-hover">
                  <td style={{ padding: "16px 20px", fontWeight: 700, color: DEEP_BLUE_PRIMARY }}>{row.classCode}</td>
                  <td style={{ padding: "16px 20px", fontWeight: 600, color: "#0f172a" }}>{row.className}</td>
                  <td style={{ padding: "16px 20px", color: "#475569" }}>{row.departmentName || row.departmentCode || "--"}</td>
                  <td style={{ padding: "16px 20px", color: "#475569" }}>{row.cohortCode || "--"}</td>
                  <td style={{ padding: "16px 20px", color: "#475569" }}>{row.enrollmentYear || "--"}</td>
                  <td style={{ padding: "16px 20px" }}>
                    <span style={{
                      display: "inline-flex",
                      fontSize: "12px",
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: "999px",
                      background: row.status === "Đang hoạt động" ? "#e6f4ea" : "#fce8e6",
                      color: row.status === "Đang hoạt động" ? "#137333" : "#c5221f"
                    }}>
                      {row.status || "Đang hoạt động"}
                    </span>
                  </td>
                  <td style={{ padding: "16px 20px", textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "6px" }}>
                      <button
                        onClick={() => handleOpenDetail(row)}
                        title="Xem chi tiết"
                        style={{ padding: "6px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "white", color: DEEP_BLUE_PRIMARY, cursor: "pointer" }}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(row)}
                        title="Chỉnh sửa"
                        style={{ padding: "6px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "white", color: "#f37021", cursor: "pointer" }}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(row.classID, row.classCode)}
                        title="Xóa lớp"
                        style={{ padding: "6px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "white", color: "#d93025", cursor: "pointer" }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalCount > 0 && (
          <div style={{ padding: "16px 20px", borderTop: "1px solid #e2e8f0" }}>
            <TablePagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              pageCount={pageCount}
              isLoading={isLoading}
              onPageChange={setPage}
              onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
            />
          </div>
        )}
      </div>

      {/* Modal Detail */}
      {activeModal === "detail" && selectedRow && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15,23,42,0.4)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999
        }}>
          <div style={{
            background: "white",
            borderRadius: "20px",
            width: "90%",
            maxWidth: "800px",
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)"
          }}>
            {/* Modal Header */}
            <div style={{
              background: `linear-gradient(135deg, ${DEEP_BLUE_PRIMARY}, #2b4c7e)`,
              color: "white",
              padding: "24px 32px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800 }}>Chi tiết lớp học</h2>
                <p style={{ margin: "4px 0 0 0", color: "rgba(255,255,255,0.7)", fontSize: "13px" }}>{selectedRow.className}</p>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                style={{ background: "none", border: "none", color: "white", fontSize: "24px", cursor: "pointer", fontWeight: 300 }}
              >
                &times;
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", padding: "0 24px" }}>
              <button
                onClick={() => setDetailTab("info")}
                style={{
                  padding: "16px 20px",
                  background: "none",
                  border: "none",
                  borderBottom: `3px solid ${detailTab === "info" ? DEEP_BLUE_PRIMARY : "transparent"}`,
                  color: detailTab === "info" ? DEEP_BLUE_PRIMARY : "#64748b",
                  fontWeight: detailTab === "info" ? 800 : 600,
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                Thông tin chung
              </button>
              <button
                onClick={() => setDetailTab("students")}
                style={{
                  padding: "16px 20px",
                  background: "none",
                  border: "none",
                  borderBottom: `3px solid ${detailTab === "students" ? DEEP_BLUE_PRIMARY : "transparent"}`,
                  color: detailTab === "students" ? DEEP_BLUE_PRIMARY : "#64748b",
                  fontWeight: detailTab === "students" ? 800 : 600,
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                <Users size={16} /> Danh sách sinh viên
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "32px", overflowY: "auto", flex: 1 }}>
              {detailTab === "info" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "4px" }}>Mã lớp học</label>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: DEEP_BLUE_PRIMARY }}>{selectedRow.classCode}</div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "4px" }}>Tên lớp học</label>
                    <div style={{ fontSize: "15px", fontWeight: 600, color: "#0f172a" }}>{selectedRow.className}</div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "4px" }}>Khoa</label>
                    <div style={{ fontSize: "15px", color: "#334155" }}>{selectedRow.departmentName || selectedRow.departmentCode || "--"}</div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "4px" }}>Khóa học</label>
                    <div style={{ fontSize: "15px", color: "#334155" }}>{selectedRow.cohortCode || "--"}</div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "4px" }}>Năm tuyển sinh</label>
                    <div style={{ fontSize: "15px", color: "#334155" }}>{selectedRow.enrollmentYear || "--"}</div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#64748b", marginBottom: "4px" }}>Trạng thái</label>
                    <div>
                      <span style={{
                        display: "inline-flex",
                        fontSize: "12px",
                        fontWeight: 700,
                        padding: "4px 10px",
                        borderRadius: "999px",
                        background: selectedRow.status === "Đang hoạt động" ? "#e6f4ea" : "#fce8e6",
                        color: selectedRow.status === "Đang hoạt động" ? "#137333" : "#c5221f"
                      }}>
                        {selectedRow.status || "Đang hoạt động"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {studentsLoading ? (
                    <div style={{ color: "#64748b", padding: "20px 0" }}>Đang tải danh sách sinh viên...</div>
                  ) : students.length === 0 ? (
                    <div style={{ color: "#64748b", padding: "20px 0" }}>Không có sinh viên nào trong lớp này.</div>
                  ) : (
                    <div style={{ border: "1px solid #cbd5e1", borderRadius: "12px", overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                        <thead>
                          <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1", textAlign: "left" }}>
                            <th style={{ padding: "10px 16px", color: "#475569", fontWeight: 700 }}>Mã sinh viên</th>
                            <th style={{ padding: "10px 16px", color: "#475569", fontWeight: 700 }}>Họ và tên</th>
                            <th style={{ padding: "10px 16px", color: "#475569", fontWeight: 700 }}>Email</th>
                            <th style={{ padding: "10px 16px", color: "#475569", fontWeight: 700 }}>GPA</th>
                            <th style={{ padding: "10px 16px", color: "#475569", fontWeight: 700 }}>Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((student) => (
                            <tr key={student.studentProfileID} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "10px 16px", fontWeight: 700, color: DEEP_BLUE_PRIMARY }}>{student.studentCode}</td>
                              <td style={{ padding: "10px 16px", fontWeight: 600 }}>{student.fullName}</td>
                              <td style={{ padding: "10px 16px", color: "#64748b" }}>{student.studentEmail || "--"}</td>
                              <td style={{ padding: "10px 16px", fontWeight: 700 }}>{student.gpa || "--"}</td>
                              <td style={{ padding: "10px 16px" }}>
                                <span style={{
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  background: "#f1f5f9",
                                  padding: "2px 8px",
                                  borderRadius: "10px"
                                }}>
                                  {student.status || "Đang học"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: "20px 32px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", textAlign: "right" }}>
              <button
                onClick={() => setActiveModal(null)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  background: "white",
                  color: "#334155",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer"
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modals */}
      {(activeModal === "create" || activeModal === "edit") && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15,23,42,0.4)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999
        }}>
          <form
            onSubmit={activeModal === "create" ? handleCreate : handleEdit}
            style={{
              background: "white",
              borderRadius: "20px",
              width: "90%",
              maxWidth: "600px",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
              overflow: "hidden"
            }}
          >
            {/* Header */}
            <div style={{
              background: `linear-gradient(135deg, ${DEEP_BLUE_PRIMARY}, #2b4c7e)`,
              color: "white",
              padding: "24px 32px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800 }}>
                  {activeModal === "create" ? "Tạo lớp học mới" : "Chỉnh sửa lớp học"}
                </h2>
                <p style={{ margin: "4px 0 0 0", color: "rgba(255,255,255,0.7)", fontSize: "13px" }}>
                  {activeModal === "create" ? "Nhập thông tin chi tiết lớp học theo schema chuẩn" : `Đang chỉnh sửa lớp ${selectedRow?.classCode}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                style={{ background: "none", border: "none", color: "white", fontSize: "24px", cursor: "pointer" }}
              >
                &times;
              </button>
            </div>

            {/* Form Inputs */}
            <div style={{ padding: "32px", display: "grid", gap: "20px" }}>
              {activeModal === "create" && (
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>Mã lớp học <span style={{ color: "#d93025" }}>*</span></label>
                  <input
                    type="text"
                    required
                    value={classCode}
                    onChange={(e) => setClassCode(e.target.value)}
                    placeholder="Ví dụ: D18PM01"
                    style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: "10px", fontSize: "14px", outline: "none" }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>Tên lớp học <span style={{ color: "#d93025" }}>*</span></label>
                <input
                  type="text"
                  required
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="Ví dụ: Công nghệ phần mềm K18 1"
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: "10px", fontSize: "14px", outline: "none" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>Khoa <span style={{ color: "#d93025" }}>*</span></label>
                  <select
                    required
                    value={departmentId}
                    onChange={(e) => setDepartmentId(Number(e.target.value))}
                    style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: "10px", fontSize: "14px", outline: "none" }}
                  >
                    <option value={0} disabled>Chọn Khoa</option>
                    {departments.map((dept) => (
                      <option key={dept.departmentID} value={dept.departmentID}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>Khóa học</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      readOnly
                      value={cohortCode ? `${cohorts.find(c => c.cohortCode === cohortCode)?.cohortName || cohortCode} (${cohortCode})` : "Chưa chọn khóa học"}
                      style={{
                        flex: 1,
                        padding: "10px 14px",
                        border: "1px solid #cbd5e1",
                        borderRadius: "10px",
                        fontSize: "14px",
                        background: "#f8fafc",
                        color: cohortCode ? "#0f172a" : "#64748b",
                        fontWeight: cohortCode ? 600 : 400,
                        outline: "none"
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCohortSearch("");
                        setIsCohortSelectorOpen(true);
                      }}
                      style={{
                        padding: "10px 16px",
                        borderRadius: "10px",
                        border: `1px solid ${DEEP_BLUE_PRIMARY}`,
                        background: "white",
                        color: DEEP_BLUE_PRIMARY,
                        fontWeight: 600,
                        fontSize: "13px",
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                      }}
                    >
                      Chọn khóa
                    </button>
                    {cohortCode && (
                      <button
                        type="button"
                        onClick={() => setCohortCode("")}
                        style={{
                          padding: "10px 12px",
                          borderRadius: "10px",
                          border: "1px solid #cbd5e1",
                          background: "#fee2e2",
                          color: "#991b1b",
                          fontWeight: 600,
                          fontSize: "13px",
                          cursor: "pointer"
                        }}
                        title="Hủy chọn"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>Năm nhập học</label>
                  <input
                    type="number"
                    value={enrollmentYear}
                    onChange={(e) => setEnrollmentYear(e.target.value)}
                    placeholder="Ví dụ: 2026"
                    style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: "10px", fontSize: "14px", outline: "none" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>Trạng thái</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: "10px", fontSize: "14px", outline: "none" }}
                  >
                    <option value="Đang hoạt động">Đang hoạt động</option>
                    <option value="Đã khóa">Đã khóa</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "20px 32px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", textAlign: "right", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  background: "white",
                  color: "#334155",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer"
                }}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: "10px 22px",
                  borderRadius: "10px",
                  border: "none",
                  background: `linear-gradient(135deg, ${DEEP_BLUE_PRIMARY}, #2b4c7e)`,
                  color: "white",
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(30,58,95,0.1)"
                }}
              >
                {isSubmitting ? "Đang xử lý..." : activeModal === "create" ? "Tạo lớp học" : "Lưu thay đổi"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cohort Selector Secondary Modal */}
      {isCohortSelectorOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15,23,42,0.5)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000
        }}>
          <div style={{
            background: "white",
            borderRadius: "20px",
            width: "90%",
            maxWidth: "500px",
            maxHeight: "75vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)"
          }}>
            {/* Modal Header */}
            <div style={{
              background: `linear-gradient(135deg, ${DEEP_BLUE_PRIMARY}, #2b4c7e)`,
              color: "white",
              padding: "20px 24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>Chọn khóa học (Cohort)</h3>
                <p style={{ margin: "4px 0 0 0", color: "rgba(255,255,255,0.7)", fontSize: "12px" }}>Chọn khóa học để liên kết với lớp</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCohortSelectorOpen(false)}
                style={{ background: "none", border: "none", color: "white", fontSize: "20px", cursor: "pointer" }}
              >
                &times;
              </button>
            </div>

            {/* Search Cohort */}
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ position: "relative" }}>
                <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                <input
                  type="text"
                  placeholder="Tìm theo tên hoặc mã khóa học..."
                  value={cohortSearch}
                  onChange={(e) => setCohortSearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px 8px 36px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "13px",
                    outline: "none"
                  }}
                />
              </div>
            </div>

            {/* Cohorts List */}
            <div style={{ padding: "16px 24px", overflowY: "auto", flex: 1, display: "grid", gap: "10px" }}>
              {filteredCohorts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px", color: "#64748b", fontSize: "13px" }}>
                  Không tìm thấy khóa học nào khớp.
                </div>
              ) : (
                filteredCohorts.map((cohort) => (
                  <div
                    key={cohort.id}
                    onClick={() => {
                      setCohortCode(cohort.cohortCode);
                      setIsCohortSelectorOpen(false);
                    }}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      borderRadius: "12px",
                      border: `1px solid ${cohortCode === cohort.cohortCode ? DEEP_BLUE_PRIMARY : "#e2e8f0"}`,
                      background: cohortCode === cohort.cohortCode ? "#f0f6ff" : "white",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "14px", color: DEEP_BLUE_PRIMARY }}>
                        {cohort.cohortName}
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                        Mã khóa: {cohort.cohortCode}
                      </div>
                    </div>
                    <button
                      type="button"
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        border: "none",
                        background: cohortCode === cohort.cohortCode ? DEEP_BLUE_PRIMARY : "#f1f5f9",
                        color: cohortCode === cohort.cohortCode ? "white" : "#334155",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      {cohortCode === cohort.cohortCode ? "Đang chọn" : "Chọn"}
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", textAlign: "right" }}>
              <button
                type="button"
                onClick={() => setIsCohortSelectorOpen(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "white",
                  color: "#334155",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer"
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassesManagement;
