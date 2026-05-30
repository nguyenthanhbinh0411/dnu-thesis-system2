import React, { useState, useEffect } from "react";
import {
  Activity,
  Search,
  Clock,
  User,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  BarChart3,
  TrendingUp,
  Shield,
  ChevronDown,
  ChevronRight,
  Code,
  Download,
  Filter,
  Grid,
  Plus,
  Lock,
  CheckSquare,
  PlayCircle,
  CalendarDays,
  Users,
  BookOpen,
  Send,
} from "lucide-react";
import { fetchData } from "../../api/fetchData";
import type {
  SystemActivityLog,
  ApiResponseSystemActivityLogs,
} from "../../types/systemActivityLog";
import "../admin/Dashboard.css";

const SystemActivityLogs: React.FC = () => {
  const [logs, setLogs] = useState<SystemActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLog, setSelectedLog] = useState<SystemActivityLog | null>(
    null
  );
  const [showOldValue, setShowOldValue] = useState(true);
  const [showNewValue, setShowNewValue] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"excel" | "pdf" | "csv">("excel");
  const pageSize = 15;
  const [isModuleMenuOpen, setIsModuleMenuOpen] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

  const [globalStats, setGlobalStats] = useState({
    total: 0,
    success: 0,
    update: 0,
    delete: 0,
  });

  const loadGlobalStats = async () => {
    try {
      const [allRes, updateRes, deleteRes] = await Promise.all([
        fetchData("/SystemActivityLogs/get-list?Page=1&PageSize=1"),
        fetchData("/SystemActivityLogs/get-list?Page=1&PageSize=1&ActionType=UPDATE"),
        fetchData("/SystemActivityLogs/get-list?Page=1&PageSize=1&ActionType=DELETE")
      ]);

      const total = (allRes as any)?.totalCount || 0;
      const update = (updateRes as any)?.totalCount || 0;
      const deleteCount = (deleteRes as any)?.totalCount || 0;

      setGlobalStats({
        total,
        success: total,
        update,
        delete: deleteCount
      });
    } catch (err) {
      console.error("Error loading global stats:", err);
    }
  };

  useEffect(() => {
    void loadGlobalStats();
  }, []);

  const handleExportLogs = async () => {
    try {
      setIsExporting(true);
      setExportError(null);
      const apiFormat = exportFormat === "excel" ? "xlsx" : exportFormat;
      const payload = {
        format: apiFormat,
        filters: {
          search: searchTerm.trim() || undefined,
          module: moduleFilter !== "all" ? moduleFilter : undefined,
          actionType: actionFilter !== "all" ? actionFilter : undefined,
        }
      };

      const acceptHeader =
        exportFormat === "pdf"
          ? "application/pdf"
          : exportFormat === "csv"
          ? "text/csv"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      const arrayBuffer = await fetchData<ArrayBuffer>(
        `/SystemActivityLogs/export`,
        { 
          method: "POST",
          body: payload,
          timeoutMs: 300000,
          headers: { Accept: acceptHeader }
        }
      );

      if (!arrayBuffer) {
        throw new Error("Không nhận được dữ liệu file từ server.");
      }

      const mimeType =
        exportFormat === "pdf"
          ? "application/pdf"
          : exportFormat === "csv"
          ? "text/csv; charset=utf-8"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      const ext = exportFormat === "excel" ? "xlsx" : exportFormat;

      const blob = new Blob([arrayBuffer], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `system-activity-logs-${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setExportModalOpen(false);
    } catch (err) {
      console.error("Export error:", err);
      setExportError("Không thể xuất lịch sử hoạt động hệ thống. Vui lòng thử lại hoặc giảm phạm vi lọc.");
    } finally {
      setIsExporting(false);
    }
  };

  const loadLogs = async (page: number = 1) => {
    try {
      setLoading(true);
      setLoadError(null);

      const params = new URLSearchParams();
      params.set("Page", String(page));
      params.set("PageSize", String(pageSize));
      params.set("SortBy", "PerformedAt");
      params.set("SortDescending", "true");

      if (searchTerm.trim()) {
        params.set("Search", searchTerm.trim());
      }
      if (actionFilter !== "all") {
        params.set("ActionType", actionFilter);
      }
      if (moduleFilter !== "all") {
        params.set("Module", moduleFilter);
      }

      const response = await fetchData(
        `/SystemActivityLogs/get-list?${params.toString()}`
      );

      const data = (response as ApiResponseSystemActivityLogs).data || [];
      setLogs(data);
      setTotalCount(
        (response as ApiResponseSystemActivityLogs).totalCount || 0
      );
    } catch (err) {
      setLoadError("Không thể tải lịch sử hoạt động hệ thống");
      console.error("Error loading system activity logs:", err);
    } finally {
      setLoading(false);
    }
  };

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, actionFilter, moduleFilter]);

  // Load logs when page or filters change with small debounce to prevent double requests
  useEffect(() => {
    const handler = setTimeout(() => {
      loadLogs(currentPage);
    }, 250);
    return () => clearTimeout(handler);
  }, [currentPage, searchTerm, actionFilter, moduleFilter]);

  useEffect(() => {
    if (selectedLog) {
      setShowOldValue(true);
      setShowNewValue(true);
    }
  }, [selectedLog]);

  const filteredLogs = logs;

  // Calculate statistics
  const stats = {
    total: filteredLogs.length,
    success: filteredLogs.filter((log) => log.status === "SUCCESS").length,
    failed: filteredLogs.filter((log) => log.status === "FAILED").length,
    warning: filteredLogs.filter((log) => log.status === "WARNING").length,
    create: filteredLogs.filter((log) => log.actionType === "CREATE").length,
    update: filteredLogs.filter((log) => log.actionType === "UPDATE").length,
    delete: filteredLogs.filter((log) => log.actionType === "DELETE").length,
  };

  const getActionColor = (actionType: string) => {
    switch (actionType.toUpperCase()) {
      case "CREATE":
        return "#10B981"; // Emerald green
      case "UPDATE":
        return "#F59E0B"; // Amber yellow
      case "DELETE":
        return "#EF4444"; // Red
      case "LOGIN":
        return "#3B82F6"; // Blue
      case "ENTER_ROOM":
        return "#10B981"; // Emerald green
      case "LEAVE_ROOM":
        return "#EF4444"; // Red
      case "PUBLISH":
        return "#6366F1"; // Indigo
      case "LOCK":
        return "#8B5CF6"; // Purple
      case "SUBMIT":
        return "#06B6D4"; // Cyan
      case "APPROVE":
        return "#10B981"; // Emerald
      case "REJECT":
        return "#EF4444"; // Red
      case "OPEN_SESSION":
        return "#10B981"; // Emerald
      case "CLOSE_SESSION":
        return "#6B7280"; // Gray
      default:
        return "#4F46E5"; // Indigo default
    }
  };

  const getActionIcon = (actionType: string) => {
    const color = getActionColor(actionType);
    switch (actionType.toUpperCase()) {
      case "CREATE":
        return <CheckCircle size={16} color={color} />;
      case "UPDATE":
        return <FileText size={16} color={color} />;
      case "DELETE":
        return <XCircle size={16} color={color} />;
      case "LOGIN":
        return <Shield size={16} color={color} />;
      case "ENTER_ROOM":
        return <PlayCircle size={16} color={color} />;
      case "LEAVE_ROOM":
        return <XCircle size={16} color={color} />;
      case "PUBLISH":
        return <Shield size={16} color={color} />; // fallback standard Send or Shield
      case "LOCK":
        return <Lock size={16} color={color} />;
      case "SUBMIT":
        return <CheckSquare size={16} color={color} />;
      case "APPROVE":
        return <CheckCircle size={16} color={color} />;
      case "REJECT":
        return <XCircle size={16} color={color} />;
      case "OPEN_SESSION":
        return <PlayCircle size={16} color={color} />;
      case "CLOSE_SESSION":
        return <XCircle size={16} color={color} />;
      default:
        return <Activity size={16} color={color} />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toUpperCase()) {
      case "SUCCESS":
        return <CheckCircle size={16} color="#10B981" />;
      case "FAILED":
        return <XCircle size={16} color="#EF4444" />;
      case "WARNING":
        return <AlertCircle size={16} color="#F59E0B" />;
      default:
        return <Clock size={16} color="#6B7280" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "SUCCESS":
        return "#10B981";
      case "FAILED":
        return "#EF4444";
      case "WARNING":
        return "#F59E0B";
      default:
        return "#6B7280";
    }
  };

  const getModuleColor = (moduleName: string) => {
    switch (moduleName) {
      case "Committee":
        return "#8B5CF6"; // Purple
      case "Defense":
        return "#3B82F6"; // Blue
      case "Topic":
        return "#F59E0B"; // Orange
      case "Submission":
        return "#EC4899"; // Pink
      case "Department":
        return "#0D9488"; // Teal
      case "Milestone":
        return "#EF4444"; // Red
      case "System":
        return "#6B7280"; // Gray
      default:
        return "#6B7280";
    }
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "-";
    let str = String(dateString);
    const hasTimezone = /Z$|[+-]\d{2}:?\d{2}$/.test(str);
    if (!hasTimezone) {
      str = str + "Z";
    }
    return new Date(str).toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + "...";
  };

  const renderValue = (
    value: string,
    type: "old" | "new",
    compareValue?: string
  ) => {
    try {
      const parsed = JSON.parse(value);
      const compareParsed = compareValue ? JSON.parse(compareValue) : null;

      if (Array.isArray(parsed)) {
        // Render array as a nice list with comparison
        return (
          <div style={{ display: "grid", gap: "8px" }}>
            {parsed.map((item, index) => {
              const isNew =
                compareParsed &&
                Array.isArray(compareParsed) &&
                (!compareParsed[index] ||
                  JSON.stringify(compareParsed[index]) !==
                  JSON.stringify(item));

              return (
                <div
                  key={index}
                  style={{
                    backgroundColor: type === "old" ? "#FEF7F7" : "#F7FEF7",
                    border: `1px solid ${type === "old" ? "#FECACA" : "#BBF7D0"
                      }`,
                    borderRadius: "6px",
                    padding: "12px",
                    fontSize: "13px",
                    color: type === "old" ? "#DC2626" : "#047857",
                  }}
                >
                  <div style={{ fontWeight: "600", marginBottom: "4px" }}>
                    Item {index + 1}:
                  </div>
                  {typeof item === "object" ? (
                    <div style={{ marginLeft: "12px" }}>
                      {Object.entries(item).map(([key, val]) => (
                        <div key={key} style={{ marginBottom: "2px" }}>
                          <span style={{ fontWeight: "500" }}>{key}:</span>{" "}
                          {isNew && type === "new" && (
                            <span
                              style={{
                                display: "inline-block",
                                marginRight: "4px",
                                background:
                                  "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                                color: "white",
                                padding: "1px 4px",
                                borderRadius: "8px",
                                fontSize: "9px",
                                fontWeight: "600",
                                verticalAlign: "middle",
                                boxShadow: "0 1px 3px rgba(16, 185, 129, 0.3)",
                                animation:
                                  "newLabelPulse 2s ease-in-out infinite",
                                transition: "all 0.2s ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = "scale(1.1)";
                                e.currentTarget.style.boxShadow =
                                  "0 3px 6px rgba(16, 185, 129, 0.4)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "scale(1)";
                                e.currentTarget.style.boxShadow =
                                  "0 1px 3px rgba(16, 185, 129, 0.3)";
                              }}
                            >
                              NEW
                            </span>
                          )}
                          <span>{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span>
                      {isNew && type === "new" && (
                        <span
                          style={{
                            display: "inline-block",
                            marginRight: "4px",
                            background:
                              "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                            color: "white",
                            padding: "1px 4px",
                            borderRadius: "8px",
                            fontSize: "9px",
                            fontWeight: "600",
                            verticalAlign: "middle",
                            boxShadow: "0 1px 3px rgba(16, 185, 129, 0.3)",
                            animation: "newLabelPulse 2s ease-in-out infinite",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "scale(1.1)";
                            e.currentTarget.style.boxShadow =
                              "0 3px 6px rgba(16, 185, 129, 0.4)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "scale(1)";
                            e.currentTarget.style.boxShadow =
                              "0 1px 3px rgba(16, 185, 129, 0.3)";
                          }}
                        >
                          NEW
                        </span>
                      )}
                      {String(item)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      } else if (typeof parsed === "object" && parsed !== null) {
        // Render object as key-value pairs with comparison
        const allKeys = new Set([
          ...Object.keys(parsed),
          ...(compareParsed && typeof compareParsed === "object"
            ? Object.keys(compareParsed)
            : []),
        ]);

        return (
          <div style={{ display: "grid", gap: "6px" }}>
            {Array.from(allKeys).map((key) => {
              const oldVal =
                compareParsed && typeof compareParsed === "object"
                  ? compareParsed[key]
                  : undefined;
              const newVal = parsed[key];
              const isNew = oldVal === undefined && newVal !== undefined;
              const isChanged =
                oldVal !== undefined &&
                newVal !== undefined &&
                JSON.stringify(oldVal) !== JSON.stringify(newVal);

              return (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    backgroundColor: type === "old" ? "#FEF7F7" : "#F7FEF7",
                    border: `1px solid ${type === "old" ? "#FECACA" : "#BBF7D0"
                      }`,
                    borderRadius: "6px",
                    fontSize: "13px",
                  }}
                >
                  <span style={{ fontWeight: "600", color: "#374151" }}>
                    {key}:
                  </span>
                  <span
                    style={{
                      color: type === "old" ? "#DC2626" : "#047857",
                      textAlign: "right",
                      flex: 1,
                      marginLeft: "12px",
                      fontWeight: isChanged || isNew ? "600" : "400",
                    }}
                  >
                    {(isNew || isChanged) && type === "new" && (
                      <span
                        style={{
                          display: "inline-block",
                          marginRight: "8px",
                          background:
                            "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                          color: "white",
                          padding: "2px 6px",
                          borderRadius: "10px",
                          fontSize: "10px",
                          fontWeight: "600",
                          verticalAlign: "middle",
                          boxShadow: "0 2px 4px rgba(16, 185, 129, 0.3)",
                          animation: "newLabelPulse 2s ease-in-out infinite",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.1)";
                          e.currentTarget.style.boxShadow =
                            "0 4px 8px rgba(16, 185, 129, 0.4)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                          e.currentTarget.style.boxShadow =
                            "0 2px 4px rgba(16, 185, 129, 0.3)";
                        }}
                      >
                        NEW
                      </span>
                    )}
                    {typeof newVal === "object"
                      ? JSON.stringify(newVal)
                      : String(newVal)}
                  </span>
                </div>
              );
            })}
          </div>
        );
      }
    } catch {
      // Not JSON, render as plain text
    }

    // Default: render as formatted text
    return (
      <div
        style={{
          fontSize: "13px",
          color: type === "old" ? "#DC2626" : "#047857",
          lineHeight: "1.6",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    );
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                backgroundColor: "#e0e7ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #c7d2fe",
              }}
            >
              <Activity size={24} color="#1e3a5f" />
            </div>
            <div>
              <h1
                style={{
                  margin: 0,
                  color: "#0f172a",
                  fontSize: "32px",
                  fontWeight: "900",
                  lineHeight: "1.2",
                }}
              >
                Lịch sử hoạt động hệ thống
              </h1>
              <p
                style={{
                  margin: "4px 0 0 0",
                  color: "#64748b",
                  fontSize: "15px",
                }}
              >
                Theo dõi và giám sát tất cả hoạt động trong hệ thống
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setExportError(null);
              setExportModalOpen(true);
            }}
            disabled={isExporting}
            style={{
              padding: "10px 18px",
              borderRadius: "12px",
              border: "1px solid #1e3a5f",
              backgroundColor: "#1e3a5f",
              color: "white",
              fontWeight: "800",
              fontSize: "14px",
              cursor: isExporting ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 4px 12px rgba(30, 58, 95, 0.2)",
              opacity: isExporting ? 0.7 : 1,
              transition: "all 0.2s",
            }}
          >
            <Download size={18} />
            {isExporting ? "Đang xuất..." : "Tải xuống"}
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "20px",
          marginBottom: "32px",
        }}
      >
        <section
          style={{
            background: "white",
            borderRadius: "24px",
            padding: "24px",
            border: "1px solid #e2e8f0",
            borderLeft: "6px solid #1e3a5f",
            boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.04)",
            display: "flex",
            alignItems: "center",
            gap: "20px",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
            cursor: "default",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-3px)";
            e.currentTarget.style.boxShadow =
              "0 12px 24px -4px rgba(15, 23, 42, 0.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "none";
            e.currentTarget.style.boxShadow =
              "0 4px 20px -2px rgba(15, 23, 42, 0.04)";
          }}
        >
          <div
            style={{
              width: "54px",
              height: "54px",
              borderRadius: "16px",
              background: "#f0f4f8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1e3a5f",
            }}
          >
            <BarChart3 size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "13px",
                fontWeight: "700",
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Tổng hoạt động
            </div>
            <div
              style={{
                fontSize: "32px",
                fontWeight: "900",
                color: "#1e3a5f",
                lineHeight: "1.2",
                margin: "4px 0",
              }}
            >
              {totalCount}
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
              Khớp bộ lọc hiện tại
            </p>
          </div>
        </section>

        <section
          style={{
            background: "white",
            borderRadius: "24px",
            padding: "24px",
            border: "1px solid #e2e8f0",
            borderLeft: "6px solid #10b981",
            boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.04)",
            display: "flex",
            alignItems: "center",
            gap: "20px",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
            cursor: "default",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-3px)";
            e.currentTarget.style.boxShadow =
              "0 12px 24px -4px rgba(15, 23, 42, 0.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "none";
            e.currentTarget.style.boxShadow =
              "0 4px 20px -2px rgba(15, 23, 42, 0.04)";
          }}
        >
          <div
            style={{
              width: "54px",
              height: "54px",
              borderRadius: "16px",
              background: "#ecfdf5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#10b981",
            }}
          >
            <CheckCircle size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "13px",
                fontWeight: "700",
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Thành công
            </div>
            <div
              style={{
                fontSize: "32px",
                fontWeight: "900",
                color: "#10b981",
                lineHeight: "1.2",
                margin: "4px 0",
              }}
            >
              {totalCount}
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
              Các thao tác hợp lệ
            </p>
          </div>
        </section>

        <section
          style={{
            background: "white",
            borderRadius: "24px",
            padding: "24px",
            border: "1px solid #e2e8f0",
            borderLeft: "6px solid #f59e0b",
            boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.04)",
            display: "flex",
            alignItems: "center",
            gap: "20px",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
            cursor: "default",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-3px)";
            e.currentTarget.style.boxShadow =
              "0 12px 24px -4px rgba(15, 23, 42, 0.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "none";
            e.currentTarget.style.boxShadow =
              "0 4px 20px -2px rgba(15, 23, 42, 0.04)";
          }}
        >
          <div
            style={{
              width: "54px",
              height: "54px",
              borderRadius: "16px",
              background: "#fffbeb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#f59e0b",
            }}
          >
            <TrendingUp size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "13px",
                fontWeight: "700",
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Tổng Cập nhật
            </div>
            <div
              style={{
                fontSize: "32px",
                fontWeight: "900",
                color: "#f59e0b",
                lineHeight: "1.2",
                margin: "4px 0",
              }}
            >
              {globalStats.update}
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
              Toàn bộ hệ thống
            </p>
          </div>
        </section>

        <section
          style={{
            background: "white",
            borderRadius: "24px",
            padding: "24px",
            border: "1px solid #e2e8f0",
            borderLeft: "6px solid #ef4444",
            boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.04)",
            display: "flex",
            alignItems: "center",
            gap: "20px",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
            cursor: "default",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-3px)";
            e.currentTarget.style.boxShadow =
              "0 12px 24px -4px rgba(15, 23, 42, 0.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "none";
            e.currentTarget.style.boxShadow =
              "0 4px 20px -2px rgba(15, 23, 42, 0.04)";
          }}
        >
          <div
            style={{
              width: "54px",
              height: "54px",
              borderRadius: "16px",
              background: "#fef2f2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ef4444",
            }}
          >
            <XCircle size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "13px",
                fontWeight: "700",
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Tổng Xóa
            </div>
            <div
              style={{
                fontSize: "32px",
                fontWeight: "900",
                color: "#ef4444",
                lineHeight: "1.2",
                margin: "4px 0",
              }}
            >
              {globalStats.delete}
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
              Toàn bộ hệ thống
            </p>
          </div>
        </section>
      </div>

      {/* Filters */}
      <div
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "24px",
          padding: "32px",
          marginBottom: "24px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 10px 30px -5px rgba(0,0,0,0.03), 0 5px 15px -3px rgba(0,0,0,0.02)",
        }}
      >
        <h3
          style={{
            margin: "0 0 20px 0",
            color: "#0f172a",
            fontSize: "20px",
            fontWeight: "900",
            letterSpacing: "-0.02em",
          }}
        >
          Bộ lọc và tìm kiếm
        </h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "16px",
            alignItems: "end",
          }}
        >
          {/* Search */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                color: "#374151",
                fontSize: "14px",
                fontWeight: "700",
              }}
            >
              Tìm kiếm
            </label>
            <div style={{ position: "relative" }}>
              <Search
                size={18}
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                }}
              />
              <input
                type="text"
                placeholder="Tìm kiếm theo người dùng, hành động hoặc thực thể..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "11px 16px 11px 42px",
                  borderRadius: "14px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px",
                  outline: "none",
                  background: "#f8fafc",
                  transition: "all 0.2s ease",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#1e3a5f";
                  e.target.style.background = "#ffffff";
                  e.target.style.boxShadow = "0 0 0 3px rgba(30, 58, 95, 0.1)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#cbd5e1";
                  e.target.style.background = "#f8fafc";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
          </div>

          {/* Action Filter */}
          <div style={{ position: "relative" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                color: "#374151",
                fontSize: "14px",
                fontWeight: "700",
              }}
            >
              Hành động
            </label>
            <button
              type="button"
              onClick={() => {
                setIsActionMenuOpen(!isActionMenuOpen);
                setIsModuleMenuOpen(false);
              }}
              style={{
                width: "100%",
                padding: "11px 38px 11px 16px",
                borderRadius: "14px",
                border: isActionMenuOpen ? "1px solid #1e3a5f" : "1px solid #cbd5e1",
                fontSize: "14px",
                fontWeight: "700",
                color: "#1e293b",
                background: "linear-gradient(to bottom, #ffffff, #f8fafc)",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
                outline: "none",
                textAlign: "left",
                position: "relative",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => { if (!isActionMenuOpen) e.currentTarget.style.borderColor = "#94a3b8"; }}
              onMouseLeave={(e) => { if (!isActionMenuOpen) e.currentTarget.style.borderColor = "#cbd5e1"; }}
            >
              <Activity size={14} color="#64748b" style={{ minWidth: "14px" }} />
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{
                actionFilter === "all" ? "Tất cả Hành động" :
                actionFilter === "LOGIN" ? "Đăng nhập" :
                actionFilter === "CREATE" ? "Tạo mới (CREATE)" :
                actionFilter === "UPDATE" ? "Cập nhật (UPDATE)" :
                actionFilter === "DELETE" ? "Xóa (DELETE)" :
                actionFilter === "ENTER_ROOM" ? "Vào phòng (ENTER_ROOM)" :
                actionFilter === "LEAVE_ROOM" ? "Rời/Thoát phòng (LEAVE_ROOM)" :
                actionFilter === "PUBLISH" ? "Công bố (PUBLISH)" :
                actionFilter === "LOCK" ? "Khóa điểm (LOCK)" :
                actionFilter === "SUBMIT" ? "Nhập điểm/Nộp (SUBMIT)" :
                actionFilter === "APPROVE" ? "Phê duyệt (APPROVE)" :
                actionFilter === "REJECT" ? "Từ chối (REJECT)" :
                actionFilter === "OPEN_SESSION" ? "Mở phiên (OPEN_SESSION)" : "Đóng phiên (CLOSE_SESSION)"
              }</span>
              <ChevronDown size={16} color="#64748b" style={{ position: "absolute", right: 14, transform: isActionMenuOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>
            
            {isActionMenuOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={() => setIsActionMenuOpen(false)} />
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, marginTop: 8,
                  background: "rgba(255, 255, 255, 0.96)",
                  backdropFilter: "blur(12px)",
                  borderRadius: 18,
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 20px 40px -10px rgba(15, 23, 42, 0.15), 0 10px 20px -5px rgba(15, 23, 42, 0.08)",
                  padding: 8, display: "grid", gap: 4, zIndex: 1000, maxHeight: 320, overflowY: "auto", animation: "fadeIn 0.2s ease"
                }}>
                  {[
                    { value: "all", label: "Tất cả Hành động", color: "#64748b", icon: <Grid size={14} /> },
                    { value: "LOGIN", label: "Đăng nhập", color: "#3b82f6", icon: <Shield size={14} /> },
                    { value: "CREATE", label: "Tạo mới (CREATE)", color: "#16a34a", icon: <Plus size={14} /> },
                    { value: "UPDATE", label: "Cập nhật (UPDATE)", color: "#f59e0b", icon: <FileText size={14} /> },
                    { value: "DELETE", label: "Xóa (DELETE)", color: "#ef4444", icon: <XCircle size={14} /> },
                    { value: "ENTER_ROOM", label: "Vào phòng (ENTER_ROOM)", color: "#10b981", icon: <PlayCircle size={14} /> },
                    { value: "LEAVE_ROOM", label: "Rời/Thoát phòng (LEAVE_ROOM)", color: "#ef4444", icon: <XCircle size={14} /> },
                    { value: "PUBLISH", label: "Công bố (PUBLISH)", color: "#4f46e5", icon: <Send size={14} /> },
                    { value: "LOCK", label: "Khóa điểm (LOCK)", color: "#d97706", icon: <Lock size={14} /> },
                    { value: "SUBMIT", label: "Nhập điểm/Nộp (SUBMIT)", color: "#2563eb", icon: <CheckSquare size={14} /> },
                    { value: "APPROVE", label: "Phê duyệt (APPROVE)", color: "#10b981", icon: <CheckCircle size={14} /> },
                    { value: "REJECT", label: "Từ chối (REJECT)", color: "#ef4444", icon: <XCircle size={14} /> },
                    { value: "OPEN_SESSION", label: "Mở phiên (OPEN_SESSION)", color: "#10b981", icon: <PlayCircle size={14} /> },
                    { value: "CLOSE_SESSION", label: "Đóng phiên (CLOSE)", color: "#64748b", icon: <XCircle size={14} /> }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setActionFilter(opt.value);
                        setCurrentPage(1);
                        setIsActionMenuOpen(false);
                      }}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "none",
                        background: actionFilter === opt.value ? "#1e3a5f0e" : "transparent",
                        color: actionFilter === opt.value ? "#1e3a5f" : "#334155",
                        fontSize: 13,
                        fontWeight: actionFilter === opt.value ? 800 : 600,
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        transition: "all 0.15s ease",
                        width: "100%"
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = actionFilter === opt.value ? "#1e3a5f16" : "#f1f5f9"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = actionFilter === opt.value ? "#1e3a5f0e" : "transparent"; }}
                    >
                      <span style={{ color: opt.color, display: "inline-flex", alignItems: "center" }}>{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Module Filter */}
          <div style={{ position: "relative" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                color: "#374151",
                fontSize: "14px",
                fontWeight: "700",
              }}
            >
              Phân hệ (Module)
            </label>
            <button
              type="button"
              onClick={() => {
                setIsModuleMenuOpen(!isModuleMenuOpen);
                setIsActionMenuOpen(false);
              }}
              style={{
                width: "100%",
                padding: "11px 38px 11px 16px",
                borderRadius: "14px",
                border: isModuleMenuOpen ? "1px solid #1e3a5f" : "1px solid #cbd5e1",
                fontSize: "14px",
                fontWeight: "700",
                color: "#1e293b",
                background: "linear-gradient(to bottom, #ffffff, #f8fafc)",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
                outline: "none",
                textAlign: "left",
                position: "relative",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => { if (!isModuleMenuOpen) e.currentTarget.style.borderColor = "#94a3b8"; }}
              onMouseLeave={(e) => { if (!isModuleMenuOpen) e.currentTarget.style.borderColor = "#cbd5e1"; }}
            >
              <Filter size={14} color="#64748b" style={{ minWidth: "14px" }} />
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{
                moduleFilter === "all" ? "Tất cả Phân hệ" :
                moduleFilter === "System" ? "System (Hệ thống)" :
                moduleFilter === "Catalog" ? "Catalog (Danh mục)" :
                moduleFilter === "Department" ? "Department (Khoa/Bộ môn)" :
                moduleFilter === "Submission" ? "Submission (Nộp bài)" :
                moduleFilter === "Defense" ? "Lịch & Đợt bảo vệ" :
                moduleFilter === "Committee" ? "Quản lý Hội đồng" :
                moduleFilter === "Milestone" ? "Milestone (Mốc tiến độ)" :
                moduleFilter === "Topic" ? "Đề tài & Hồ sơ" : "Tài khoản (Authentication)"
              }</span>
              <ChevronDown size={16} color="#64748b" style={{ position: "absolute", right: 14, transform: isModuleMenuOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>
            
            {isModuleMenuOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={() => setIsModuleMenuOpen(false)} />
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, marginTop: 8,
                  background: "rgba(255, 255, 255, 0.96)",
                  backdropFilter: "blur(12px)",
                  borderRadius: 18,
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 20px 40px -10px rgba(15, 23, 42, 0.15), 0 10px 20px -5px rgba(15, 23, 42, 0.08)",
                  padding: 8, display: "grid", gap: 4, zIndex: 1000, animation: "fadeIn 0.2s ease"
                }}>
                  {[
                    { value: "all", label: "Tất cả Phân hệ", color: "#64748b", icon: <Grid size={14} /> },
                    { value: "System", label: "System (Hệ thống)", color: "#64748b", icon: <Code size={14} /> },
                    { value: "Catalog", label: "Catalog (Danh mục)", color: "#64748b", icon: <Grid size={14} /> },
                    { value: "Department", label: "Department (Khoa/Bộ môn)", color: "#0d9488", icon: <Grid size={14} /> },
                    { value: "Submission", label: "Submission (Nộp bài)", color: "#db2777", icon: <FileText size={14} /> },
                    { value: "Defense", label: "Lịch & Đợt bảo vệ", color: "#0284c7", icon: <CalendarDays size={14} /> },
                    { value: "Committee", label: "Quản lý Hội đồng", color: "#6d28d9", icon: <Users size={14} /> },
                    { value: "Milestone", label: "Milestone (Mốc tiến độ)", color: "#ea580c", icon: <Clock size={14} /> },
                    { value: "Topic", label: "Đề tài & Hồ sơ", color: "#d97706", icon: <BookOpen size={14} /> },
                    { value: "Authentication", label: "Tài khoản", color: "#2563eb", icon: <User size={14} /> }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setModuleFilter(opt.value);
                        setCurrentPage(1);
                        setIsModuleMenuOpen(false);
                      }}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "none",
                        background: moduleFilter === opt.value ? "#1e3a5f0e" : "transparent",
                        color: moduleFilter === opt.value ? "#1e3a5f" : "#334155",
                        fontSize: 13,
                        fontWeight: moduleFilter === opt.value ? 800 : 600,
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        transition: "all 0.15s ease",
                        width: "100%"
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = moduleFilter === opt.value ? "#1e3a5f16" : "#f1f5f9"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = moduleFilter === opt.value ? "#1e3a5f0e" : "transparent"; }}
                    >
                      <span style={{ color: opt.color, display: "inline-flex", alignItems: "center" }}>{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "64px",
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E5E7EB",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                border: "4px solid #E5E7EB",
                borderTop: "4px solid #F37021",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                margin: "0 auto 20px",
              }}
            ></div>
            <p
              style={{
                margin: 0,
                color: "#6B7280",
                fontSize: "16px",
                fontWeight: "500",
              }}
            >
              Đang tải lịch sử hoạt động...
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {loadError && (
        <div
          style={{
            padding: "32px",
            backgroundColor: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: "16px",
            textAlign: "center",
            boxShadow: "0 4px 12px rgba(239, 68, 68, 0.1)",
          }}
        >
          <AlertCircle
            size={32}
            color="#EF4444"
            style={{ marginBottom: "12px" }}
          />
          <h3
            style={{
              margin: "0 0 8px 0",
              color: "#DC2626",
              fontSize: "18px",
              fontWeight: "600",
            }}
          >
            Lỗi tải dữ liệu
          </h3>
          <p style={{ margin: 0, color: "#DC2626", fontSize: "14px" }}>
            {loadError}
          </p>
        </div>
      )}

      {/* Activity Logs Table */}
      {!loading && !loadError && (
        <>
          <section
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "28px",
              padding: "32px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 10px 30px -5px rgba(0,0,0,0.03), 0 5px 15px -3px rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "28px",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    color: "#0f172a",
                    fontSize: "20px",
                    fontWeight: "950",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Danh sách hoạt động ({filteredLogs.length} / {totalCount})
                </h3>
                <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                  Nhật ký các thao tác thay đổi trạng thái, tạo sửa thông tin trong toàn bộ hệ thống
                </p>
              </div>
              <div style={{ fontSize: "14px", color: "#6B7280", fontWeight: "600" }}>
                Trang {currentPage} / {totalPages}
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "64px 24px",
                  color: "#6B7280",
                }}
              >
                <Activity
                  size={64}
                  color="#D1D5DB"
                  style={{ marginBottom: "20px" }}
                />
                <h3
                  style={{
                    margin: "0 0 8px 0",
                    color: "#374151",
                    fontSize: "18px",
                    fontWeight: "600",
                  }}
                >
                  Không tìm thấy hoạt động nào
                </h3>
                <p style={{ margin: 0, fontSize: "14px" }}>
                  Thử điều chỉnh bộ lọc để tìm kiếm kết quả phù hợp hơn
                </p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 10px" }}>
                  <thead>
                    <tr style={{ color: "#475569", fontSize: "12px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      <th style={{ padding: "12px 20px", textAlign: "left" }}>Thời gian</th>
                      <th style={{ padding: "12px 20px", textAlign: "left" }}>Tài khoản</th>
                      <th style={{ padding: "12px 20px", textAlign: "left" }}>Phân hệ</th>
                      <th style={{ padding: "12px 20px", textAlign: "left" }}>Hành động</th>
                      <th style={{ padding: "12px 20px", textAlign: "left" }}>Mô tả chi tiết</th>
                      <th style={{ padding: "12px 20px", textAlign: "center" }}>Trạng thái</th>
                      <th style={{ padding: "12px 20px", textAlign: "right" }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log) => {
                      const isSuccess = String(log.status || "").toUpperCase() === "SUCCESS";
                      const leftBorderColor = getModuleColor(log.module);

                      return (
                        <tr
                          key={log.logID}
                          style={{
                            background: "#f8fafc",
                            transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#ffffff";
                            e.currentTarget.style.boxShadow = "0 4px 16px rgba(15, 23, 42, 0.05)";
                            e.currentTarget.style.transform = "translateY(-1px)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#f8fafc";
                            e.currentTarget.style.boxShadow = "none";
                            e.currentTarget.style.transform = "none";
                          }}
                        >
                          <td
                            style={{
                              padding: "16px 20px",
                              borderRadius: "16px 0 0 16px",
                              whiteSpace: "nowrap",
                              fontSize: "13px",
                              fontWeight: "700",
                              color: "#334155",
                              borderLeft: `5px solid ${leftBorderColor}`,
                            }}
                          >
                            {formatDateTime(log.performedAt)}
                          </td>
                          <td style={{ padding: "16px 20px" }}>
                            <div style={{ fontWeight: "800", color: "#1e293b", fontSize: "14px" }}>
                              {log.userCode || "Hệ thống"}
                            </div>
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: "700",
                                color: "#64748b",
                                background: "#e2e8f0",
                                padding: "2px 6px",
                                borderRadius: "6px",
                                marginTop: "4px",
                                display: "inline-block",
                              }}
                            >
                              {log.userRole || "-"}
                            </span>
                          </td>
                          <td style={{ padding: "16px 20px" }}>
                            <span
                              style={{
                                padding: "4px 10px",
                                borderRadius: "8px",
                                fontSize: "11px",
                                fontWeight: "800",
                                background:
                                  log.module === "Defense" ? "#e0f2fe" :
                                  log.module === "Committee" ? "#f5f3ff" :
                                  log.module === "Topic" ? "#fef3c7" : "#f1f5f9",
                                color:
                                  log.module === "Defense" ? "#0369a1" :
                                  log.module === "Committee" ? "#6d28d9" :
                                  log.module === "Topic" ? "#b45309" : "#475569",
                                border: `1px solid ${
                                  log.module === "Defense" ? "#bae6fd" :
                                  log.module === "Committee" ? "#ddd6fe" :
                                  log.module === "Topic" ? "#fde68a" : "#cbd5e1"
                                }`,
                              }}
                            >
                              {log.module || "Hệ thống"}
                            </span>
                          </td>
                          <td style={{ padding: "16px 20px" }}>
                            <span
                              style={{
                                padding: "5px 10px",
                                borderRadius: "8px",
                                fontSize: "10px",
                                fontWeight: "900",
                                background:
                                  log.actionType === "CREATE" ? "#dcfce7" :
                                  log.actionType === "UPDATE" ? "#eff6ff" :
                                  log.actionType === "DELETE" ? "#fee2e2" :
                                  log.actionType === "LOCK" ? "#fef3c7" :
                                  log.actionType === "PUBLISH" ? "#e0e7ff" :
                                  log.actionType === "APPROVE" ? "#d1fae5" :
                                  log.actionType === "REJECT" ? "#ffe4e6" :
                                  log.actionType === "SUBMIT" ? "#dbeafe" :
                                  log.actionType === "OPEN_SESSION" ? "#ecfdf5" :
                                  log.actionType === "CLOSE_SESSION" ? "#fef9c3" :
                                  log.actionType === "ENTER_ROOM" ? "#dcfce7" :
                                  log.actionType === "LEAVE_ROOM" ? "#fee2e2" : "#f1f5f9",
                                color:
                                  log.actionType === "CREATE" ? "#15803d" :
                                  log.actionType === "UPDATE" ? "#1d4ed8" :
                                  log.actionType === "DELETE" ? "#991b1b" :
                                  log.actionType === "LOCK" ? "#b45309" :
                                  log.actionType === "PUBLISH" ? "#4338ca" :
                                  log.actionType === "APPROVE" ? "#047857" :
                                  log.actionType === "REJECT" ? "#be123c" :
                                  log.actionType === "SUBMIT" ? "#1e40af" :
                                  log.actionType === "OPEN_SESSION" ? "#059669" :
                                  log.actionType === "CLOSE_SESSION" ? "#a16207" :
                                  log.actionType === "ENTER_ROOM" ? "#15803d" :
                                  log.actionType === "LEAVE_ROOM" ? "#be123c" : "#475569",
                              }}
                            >
                              {log.actionType}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "16px 20px",
                              fontSize: "13px",
                              maxWidth: "350px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <span
                              title={log.actionDescription}
                              style={{ color: "#475569", fontWeight: "500" }}
                            >
                              {log.actionDescription || "-"}
                            </span>
                          </td>
                          <td style={{ padding: "16px 20px", textAlign: "center" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "4px 10px",
                                borderRadius: "99px",
                                fontSize: "11px",
                                fontWeight: "800",
                                background: isSuccess ? "#ecfdf5" : "#fef2f2",
                                color: isSuccess ? "#047857" : "#b91c1c",
                                border: `1px solid ${isSuccess ? "#a7f3d0" : "#fecaca"}`,
                              }}
                            >
                              <span
                                style={{
                                  width: "6px",
                                  height: "6px",
                                  borderRadius: "50%",
                                  background: isSuccess ? "#10b981" : "#ef4444",
                                  display: "inline-block",
                                  boxShadow: isSuccess
                                    ? "0 0 6px #10b981"
                                    : "0 0 6px #ef4444",
                                }}
                              />
                              {isSuccess ? "Thành công" : "Thất bại"}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "16px 20px",
                              textAlign: "right",
                              borderRadius: "0 16px 16px 0",
                            }}
                          >
                            <button
                              onClick={() => setSelectedLog(log)}
                              style={{
                                background: "#ffffff",
                                border: "1px solid #e2e8f0",
                                padding: "8px",
                                borderRadius: "10px",
                                cursor: "pointer",
                                color: "#1e3a5f",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.2s ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#1e3a5f";
                                e.currentTarget.style.color = "#ffffff";
                                e.currentTarget.style.borderColor = "#1e3a5f";
                                e.currentTarget.style.boxShadow =
                                  "0 4px 10px rgba(30, 58, 95, 0.25)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "#ffffff";
                                e.currentTarget.style.color = "#1e3a5f";
                                e.currentTarget.style.borderColor = "#e2e8f0";
                                e.currentTarget.style.boxShadow = "none";
                              }}
                              title="Xem chi tiết"
                            >
                              <Eye size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "24px",
                padding: "12px 8px 0 8px",
                borderTop: "1px solid #f1f5f9",
              }}
            >
              <div style={{ fontSize: "13px", color: "#64748b", fontWeight: "600" }}>
                Hiển thị <span style={{ color: "#0f172a", fontWeight: "700" }}>{(currentPage - 1) * pageSize + 1}</span> - <span style={{ color: "#0f172a", fontWeight: "700" }}>{Math.min(currentPage * pageSize, totalCount)}</span> trên tổng số <span style={{ color: "#1e3a5f", fontWeight: "800" }}>{totalCount}</span> kết quả
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    background: "white",
                    fontWeight: "700",
                    fontSize: "13px",
                    color: "#475569",
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    opacity: currentPage === 1 ? 0.5 : 1,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (currentPage !== 1) {
                      e.currentTarget.style.background = "#f8fafc";
                      e.currentTarget.style.borderColor = "#94a3b8";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentPage !== 1) {
                      e.currentTarget.style.background = "white";
                      e.currentTarget.style.borderColor = "#cbd5e1";
                    }
                  }}
                >
                  Trước
                </button>

                <div
                  style={{
                    display: "flex",
                    gap: "6px",
                    alignItems: "center",
                  }}
                >
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum =
                      Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                    if (pageNum > totalPages) return null;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        style={{
                          padding: "8px 14px",
                          border: "1px solid",
                          borderColor:
                            currentPage === pageNum ? "#1e3a5f" : "#cbd5e1",
                          borderRadius: "10px",
                          backgroundColor:
                            currentPage === pageNum ? "#1e3a5f" : "#FFFFFF",
                          color: currentPage === pageNum ? "#FFFFFF" : "#475569",
                          cursor: "pointer",
                          fontSize: "13px",
                          fontWeight: "700",
                          minWidth: "38px",
                          transition: "all 0.2s",
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage === totalPages}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    background: "white",
                    fontWeight: "700",
                    fontSize: "13px",
                    color: "#475569",
                    cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                    opacity: currentPage === totalPages ? 0.5 : 1,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (currentPage !== totalPages) {
                      e.currentTarget.style.background = "#f8fafc";
                      e.currentTarget.style.borderColor = "#94a3b8";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentPage !== totalPages) {
                      e.currentTarget.style.background = "white";
                      e.currentTarget.style.borderColor = "#cbd5e1";
                    }
                  }}
                >
                  Tiếp theo
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedLog && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            animation: "fadeIn 0.25s ease",
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "24px",
              width: "100%",
              maxWidth: "800px",
              boxShadow: "0 30px 60px -15px rgba(15, 23, 42, 0.3)",
              overflow: "hidden",
              border: "1px solid #e2e8f0",
              animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "24px 32px",
                borderBottom: "1px solid #f1f5f9",
                background: "linear-gradient(to right, #f8fafc, #ffffff)",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    color: "#0f172a",
                    fontSize: "18px",
                    fontWeight: "900",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Chi tiết Nhật ký Hoạt động
                </h3>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: "12px",
                    color: "#64748b",
                    fontFamily: "monospace",
                    fontWeight: "600",
                  }}
                >
                  Log ID: #{selectedLog.logID}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#475569",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#e2e8f0";
                  e.currentTarget.style.color = "#0f172a";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#f1f5f9";
                  e.currentTarget.style.color = "#475569";
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div
              style={{
                padding: "32px",
                display: "grid",
                gap: "20px",
                maxHeight: "calc(100vh - 220px)",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "170px 1fr",
                  gap: "16px 20px",
                  fontSize: "14px",
                  alignItems: "center",
                }}
              >
                <div style={{ fontWeight: "800", color: "#64748b" }}>Thời gian:</div>
                <div style={{ color: "#0f172a", fontWeight: "600" }}>
                  {formatDateTime(selectedLog.performedAt)}
                </div>

                <div style={{ fontWeight: "800", color: "#64748b" }}>
                  Tài khoản thực hiện:
                </div>
                <div style={{ color: "#0f172a" }}>
                  <span style={{ fontWeight: "800", color: "#1e3a5f" }}>
                    {selectedLog.userCode || "Hệ thống"}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      color: "#475569",
                      background: "#e2e8f0",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      marginLeft: "8px",
                    }}
                  >
                    {selectedLog.userRole || "-"}
                  </span>
                </div>

                <div style={{ fontWeight: "800", color: "#64748b" }}>
                  IP & Thiết bị:
                </div>
                <div style={{ color: "#334155", fontSize: "13px", fontWeight: "500" }}>
                  <code
                    style={{
                      background: "#f1f5f9",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontFamily: "monospace",
                      fontWeight: "700",
                    }}
                  >
                    {selectedLog.ipAddress || "-"}
                  </code>
                  <span style={{ color: "#64748b", marginLeft: "8px" }}>
                    ({selectedLog.deviceInfo || "-"})
                  </span>
                </div>

                <div style={{ fontWeight: "800", color: "#64748b" }}>
                  Phân hệ & Thao tác:
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <span
                    style={{
                      padding: "3px 8px",
                      borderRadius: "6px",
                      background: "#f1f5f9",
                      fontSize: "12px",
                      fontWeight: "800",
                      color: "#475569",
                    }}
                  >
                    {selectedLog.module}
                  </span>
                  <span
                    style={{
                      padding: "3px 8px",
                      borderRadius: "6px",
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      fontSize: "12px",
                      fontWeight: "800",
                    }}
                  >
                    {selectedLog.actionType}
                  </span>
                </div>

                <div style={{ fontWeight: "800", color: "#64748b" }}>
                  Mô tả chi tiết:
                </div>
                <div style={{ color: "#0f172a", lineHeight: "1.5", fontWeight: "600" }}>
                  {selectedLog.actionDescription || "-"}
                </div>

                <div style={{ fontWeight: "800", color: "#64748b" }}>Trạng thái:</div>
                <div>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "4px 10px",
                      borderRadius: "99px",
                      fontSize: "12px",
                      fontWeight: "800",
                      background:
                        String(selectedLog.status || "").toUpperCase() === "SUCCESS"
                          ? "#ecfdf5"
                          : "#fef2f2",
                      color:
                        String(selectedLog.status || "").toUpperCase() === "SUCCESS"
                          ? "#047857"
                          : "#b91c1c",
                      border: `1px solid ${
                        String(selectedLog.status || "").toUpperCase() === "SUCCESS"
                          ? "#a7f3d0"
                          : "#fecaca"
                      }`,
                    }}
                  >
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background:
                          String(selectedLog.status || "").toUpperCase() === "SUCCESS"
                            ? "#10b981"
                            : "#ef4444",
                        display: "inline-block",
                        boxShadow:
                          String(selectedLog.status || "").toUpperCase() === "SUCCESS"
                            ? "0 0 6px #10b981"
                            : "0 0 6px #ef4444",
                      }}
                    />
                    {String(selectedLog.status || "").toUpperCase() === "SUCCESS"
                      ? "Thành công"
                      : "Thất bại"}
                  </span>
                </div>
              </div>

              {/* Old vs New Values */}
              {(selectedLog.oldValue || selectedLog.newValue) && (
                <div
                  style={{
                    borderTop: "1px solid #f1f5f9",
                    marginTop: "8px",
                    paddingTop: "20px",
                  }}
                >
                  <div
                    style={{
                      fontWeight: "800",
                      color: "#475569",
                      marginBottom: "12px",
                      fontSize: "14px",
                    }}
                  >
                    Thay đổi dữ liệu chi tiết:
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: "800",
                          color: "#ef4444",
                          marginBottom: "8px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: "#ef4444",
                          }}
                        />{" "}
                        Dữ liệu trước thay đổi:
                      </div>
                      <div
                        style={{
                          margin: 0,
                          padding: "14px",
                          background: "#fef2f2",
                          borderRadius: "12px",
                          border: "1px solid #fee2e2",
                          maxHeight: "220px",
                          overflowY: "auto",
                        }}
                      >
                        {renderValue(
                          selectedLog.oldValue || "",
                          "old",
                          selectedLog.newValue || undefined
                        )}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: "800",
                          color: "#16a34a",
                          marginBottom: "8px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: "#16a34a",
                          }}
                        />{" "}
                        Dữ liệu sau thay đổi:
                      </div>
                      <div
                        style={{
                          margin: 0,
                          padding: "14px",
                          background: "#f0fdf4",
                          borderRadius: "12px",
                          border: "1px solid #dcfce7",
                          maxHeight: "220px",
                          overflowY: "auto",
                        }}
                      >
                        {renderValue(
                          selectedLog.newValue || "",
                          "new",
                          selectedLog.oldValue || undefined
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                padding: "16px 32px",
                borderTop: "1px solid #f1f5f9",
                background: "#f8fafc",
              }}
            >
              <button
                onClick={() => setSelectedLog(null)}
                style={{
                  padding: "10px 22px",
                  borderRadius: "12px",
                  border: "1px solid #cbd5e1",
                  background: "white",
                  cursor: "pointer",
                  fontWeight: "700",
                  color: "#475569",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f1f5f9";
                  e.currentTarget.style.borderColor = "#94a3b8";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "white";
                  e.currentTarget.style.borderColor = "#cbd5e1";
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Format Selection Export Modal */}
      {exportModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: "20px",
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "24px",
              width: "480px",
              padding: "32px",
              boxShadow: "0 30px 60px -15px rgba(15, 23, 42, 0.3)",
              border: "1px solid #e2e8f0",
              animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <h3 style={{ margin: "0 0 12px 0", fontSize: "18px", fontWeight: "900", color: "#1e3a5f" }}>Tải xuống Nhật ký Hoạt động</h3>
            <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#64748b", fontWeight: "600" }}>Chọn định dạng file bạn muốn tải xuống:</p>

            {exportError && (
              <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", fontSize: 14, lineHeight: 1.5 }}>
                {exportError}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "28px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px", fontWeight: "700", color: "#334155" }}>
                <input type="radio" name="exportFormat" checked={exportFormat === "excel"} onChange={() => setExportFormat("excel")} style={{ width: "18px", height: "18px", accentColor: "#1e3a5f" }} />
                <span>Excel (.xlsx)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px", fontWeight: "700", color: "#334155" }}>
                <input type="radio" name="exportFormat" checked={exportFormat === "pdf"} onChange={() => setExportFormat("pdf")} style={{ width: "18px", height: "18px", accentColor: "#1e3a5f" }} />
                <span>PDF Document (.pdf)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px", fontWeight: "700", color: "#334155" }}>
                <input type="radio" name="exportFormat" checked={exportFormat === "csv"} onChange={() => setExportFormat("csv")} style={{ width: "18px", height: "18px", accentColor: "#1e3a5f" }} />
                <span>CSV (Phân tách bằng dấu phẩy)</span>
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                onClick={() => {
                  setExportError(null);
                  setExportModalOpen(false);
                }}
                style={{
                  padding: "10px 22px",
                  borderRadius: "12px",
                  border: "1px solid #cbd5e1",
                  background: "white",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "700",
                  color: "#475569",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.borderColor = "#94a3b8"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
              >
                Hủy
              </button>
              <button
                onClick={handleExportLogs}
                disabled={isExporting}
                style={{
                  padding: "10px 24px",
                  borderRadius: "12px",
                  border: "none",
                  background: "#1e3a5f",
                  color: "white",
                  cursor: isExporting ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: "800",
                  boxShadow: "0 4px 12px rgba(30, 58, 95, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => { if (!isExporting) e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={(e) => { if (!isExporting) e.currentTarget.style.transform = "none"; }}
              >
                {isExporting ? "Đang xuất..." : "Tải xuống"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes newLabelPulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.05);
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default SystemActivityLogs;

