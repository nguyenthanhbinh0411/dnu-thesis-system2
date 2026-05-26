import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  Send,
  Users,
  User,
  AlertTriangle,
  Info,
  CheckCircle,
  X,
  Loader2,
  Search,
  Filter,
} from "lucide-react";
import { fetchData } from "../../api/fetchData";
import { readEnvelopeData } from "../../utils/api-envelope";
import { useToast } from "../../context/useToast";
import type { ApiResponse } from "../../types/api";

// Types for notification
interface NotificationRecipient {
  id: string;
  name: string;
  type: "student" | "lecturer" | "admin";
  code: string;
  defenseTermId?: number | null;
}

interface DefensePeriod {
  defenseTermId: number;
  termCode?: string;
  name: string;
  academicYear?: string;
  semester?: string;
}

interface NotificationTemplate {
  id: string;
  name: string;
  title: string;
  content: string;
  type: "info" | "warning" | "success" | "error";
}

// Mock notification templates
const notificationTemplates: NotificationTemplate[] = [
  {
    id: "1",
    name: "Thông báo deadline nộp đề tài",
    title: "Deadline nộp đề tài luận văn",
    content:
      "Kính gửi sinh viên,\n\nNhắc nhở về deadline nộp đề tài luận văn vào ngày [ngày]. Vui lòng hoàn thành và nộp đúng hạn.\n\nTrân trọng,\nBan quản lý",
    type: "warning",
  },
  {
    id: "2",
    name: "Thông báo lịch bảo vệ",
    title: "Lịch bảo vệ luận văn",
    content:
      "Kính gửi sinh viên và giảng viên,\n\nThông báo lịch bảo vệ luận văn của sinh viên [tên sinh viên] sẽ diễn ra vào [thời gian] tại [địa điểm].\n\nTrân trọng,\nBan quản lý",
    type: "info",
  },
  {
    id: "3",
    name: "Thông báo kết quả bảo vệ",
    title: "Kết quả bảo vệ luận văn",
    content:
      "Kính gửi sinh viên,\n\nKết quả bảo vệ luận văn của bạn là [điểm]. Chi tiết sẽ được thông báo sau.\n\nTrân trọng,\nBan quản lý",
    type: "success",
  },
];

const CreateNotification: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [recipients, setRecipients] = useState<NotificationRecipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [periods, setPeriods] = useState<DefensePeriod[]>([]);
  const [isRecipientModalOpen, setIsRecipientModalOpen] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [recipientSearch, setRecipientSearch] = useState<string>("");
  const [recipientTab, setRecipientTab] = useState<"student" | "lecturer">("student");
  const [tempSelectedRecipients, setTempSelectedRecipients] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    type: "info" as "info" | "warning" | "success" | "error",
    priority: "normal" as "low" | "normal" | "high",
    recipientType: "all" as
      | "all"
      | "students"
      | "lecturers"
      | "admins"
      | "specific",
    selectedRecipients: [] as string[],
  });

  const [showPreview, setShowPreview] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadRecipients = async () => {
      setLoadingRecipients(true);
      try {
        const [studentsRes, lecturersRes, usersRes, periodsRes] = await Promise.allSettled([
          fetchData<ApiResponse<any[]>>("/StudentProfiles/get-list?pageSize=2000"),
          fetchData<ApiResponse<any[]>>("/LecturerProfiles/get-list?pageSize=2000"),
          fetchData<ApiResponse<any[]>>("/Users/get-list?pageSize=2000"),
          fetchData<ApiResponse<any[]>>("/defense-periods"),
        ]);

        const loaded: NotificationRecipient[] = [];

        if (studentsRes.status === "fulfilled") {
          const studentItems = readEnvelopeData<any[]>(studentsRes.value) || [];
          studentItems.forEach((s: any) => {
            if (s.userCode) {
              loaded.push({
                id: s.userCode,
                name: s.fullName || s.studentCode || "Sinh viên",
                type: "student",
                code: s.studentCode,
                defenseTermId: s.defenseTermId,
              });
            }
          });
        }

        if (lecturersRes.status === "fulfilled") {
          const lecturerItems = readEnvelopeData<any[]>(lecturersRes.value) || [];
          lecturerItems.forEach((l: any) => {
            if (l.userCode) {
              loaded.push({
                id: l.userCode,
                name: l.fullName || l.lecturerCode || "Giảng viên",
                type: "lecturer",
                code: l.lecturerCode,
                defenseTermId: l.defenseTermId,
              });
            }
          });
        }

        if (usersRes.status === "fulfilled") {
          const userItems = readEnvelopeData<any[]>(usersRes.value) || [];
          userItems.forEach((u: any) => {
            if (u.role === "ADMIN") {
              if (!loaded.some(x => x.id === u.userCode)) {
                loaded.push({
                  id: u.userCode,
                  name: `Admin - ${u.userCode}`,
                  type: "admin",
                  code: u.userCode,
                  defenseTermId: null,
                });
              }
            }
          });
        }

        if (periodsRes.status === "fulfilled") {
          const periodItems = readEnvelopeData<any[]>(periodsRes.value) || [];
          setPeriods(periodItems);
        }

        setRecipients(loaded);
      } catch (err) {
        console.error("Failed to load recipients", err);
        addToast("Không thể tải danh sách người nhận thực tế.", "error");
      } finally {
        setLoadingRecipients(false);
      }
    };

    void loadRecipients();
  }, [addToast]);

  const handleInputChange = (field: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleRecipientToggle = (recipientId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedRecipients: prev.selectedRecipients.includes(recipientId)
        ? prev.selectedRecipients.filter((id) => id !== recipientId)
        : [...prev.selectedRecipients, recipientId],
    }));
  };

  const handleTemplateSelect = (template: NotificationTemplate) => {
    setFormData((prev) => ({
      ...prev,
      title: template.title,
      content: template.content,
      type: template.type,
    }));
    setShowTemplates(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const isGlobal = formData.recipientType === "all";

    // Resolve TargetUserCodes
    let targetUserCodes: string[] | null = null;
    if (!isGlobal) {
      if (formData.recipientType === "students") {
        targetUserCodes = recipients.filter((r) => r.type === "student").map((r) => r.id);
      } else if (formData.recipientType === "lecturers") {
        targetUserCodes = recipients.filter((r) => r.type === "lecturer").map((r) => r.id);
      } else if (formData.recipientType === "admins") {
        targetUserCodes = recipients.filter((r) => r.type === "admin").map((r) => r.id);
      } else if (formData.recipientType === "specific") {
        targetUserCodes = formData.selectedRecipients;
      }
    }

    if (!isGlobal && (!targetUserCodes || targetUserCodes.length === 0)) {
      addToast("Vui lòng chọn ít nhất một người nhận.", "warning");
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        notifCategory: formData.type.toUpperCase(),
        notifTitle: formData.title,
        notifBody: formData.content,
        notifPriority: formData.priority.toUpperCase(),
        isGlobal: isGlobal,
        targetUserCodes: targetUserCodes,
        notifChannel: "IN_APP",
        actionType: null,
        actionUrl: null,
        imageUrl: null,
        relatedEntityName: null,
        relatedEntityCode: null,
        relatedEntityID: null,
      };

      const res = await fetchData<ApiResponse<any>>("/Notifications/create", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.success) {
        addToast("Gửi thông báo thành công!", "success");
        navigate("/admin");
      } else {
        throw new Error(res.message || "Gửi thất bại.");
      }
    } catch (err: any) {
      const errMsg = err.data?.message || err.data?.Message || err.message || "Không thể gửi thông báo. Vui lòng thử lại.";
      addToast(errMsg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "info":
        return <Info size={20} color="#3B82F6" />;
      case "warning":
        return <AlertTriangle size={20} color="#F59E0B" />;
      case "success":
        return <CheckCircle size={20} color="#10B981" />;
      case "error":
        return <X size={20} color="#EF4444" />;
      default:
        return <Info size={20} color="#6B7280" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "info":
        return "#3B82F6";
      case "warning":
        return "#F59E0B";
      case "success":
        return "#10B981";
      case "error":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  const getPeriodName = (termId?: number | null) => {
    if (!termId) return null;
    const p = periods.find((x) => x.defenseTermId === termId);
    return p ? p.name : null;
  };

  const filteredRecipients = recipients.filter((recipient) => {
    if (formData.recipientType === "all") return true;
    if (formData.recipientType === "students")
      return recipient.type === "student";
    if (formData.recipientType === "lecturers")
      return recipient.type === "lecturer";
    if (formData.recipientType === "admins") return recipient.type === "admin";
    return formData.selectedRecipients.includes(recipient.id);
  });

  return (
    <div style={{ padding: "32px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "32px",
          background: "#FFFFFF",
          padding: "24px",
          borderRadius: "12px",
          border: "1px solid #E5E7EB",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div>
          <button
            onClick={() => navigate("/admin")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              background: "#F3F4F6",
              color: "#374151",
              border: "1px solid #D1D5DB",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
              marginBottom: "16px",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#E5E7EB";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#F3F4F6";
            }}
          >
            <ArrowLeft size={18} />
            Quay lại
          </button>

          <h1
            style={{
              fontSize: "28px",
              fontWeight: "700",
              color: "#111827",
              marginBottom: "8px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <Bell size={32} color="#4F46E5" />
            Tạo thông báo mới
          </h1>
          <p
            style={{
              fontSize: "16px",
              color: "#6B7280",
              margin: 0,
            }}
          >
            Tạo và gửi thông báo đến sinh viên, giảng viên và quản trị viên
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => setShowTemplates(true)}
            style={{
              padding: "12px 20px",
              background: "#F3F4F6",
              color: "#374151",
              border: "1px solid #D1D5DB",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#E5E7EB";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#F3F4F6";
            }}
          >
            Sử dụng mẫu
          </button>
          <button
            onClick={() => setShowPreview(true)}
            style={{
              padding: "12px 20px",
              background: "#4F46E5",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#4338CA";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#4F46E5";
            }}
          >
            Xem trước
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "24px" }}>
        {/* Basic Information */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "12px",
            padding: "24px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3
            style={{
              fontSize: "18px",
              fontWeight: "600",
              color: "#111827",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Bell size={20} />
            Thông tin cơ bản
          </h3>

          <div style={{ display: "grid", gap: "16px" }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#374151",
                  marginBottom: "6px",
                }}
              >
                Tiêu đề thông báo *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#4F46E5")}
                onBlur={(e) => (e.target.style.borderColor = "#D1D5DB")}
                placeholder="Nhập tiêu đề thông báo..."
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#374151",
                  marginBottom: "6px",
                }}
              >
                Nội dung thông báo *
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => handleInputChange("content", e.target.value)}
                required
                rows={6}
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  resize: "vertical",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#4F46E5")}
                onBlur={(e) => (e.target.style.borderColor = "#D1D5DB")}
                placeholder="Nhập nội dung thông báo..."
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: "6px",
                  }}
                >
                  Loại thông báo
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => handleInputChange("type", e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid #D1D5DB",
                    borderRadius: "8px",
                    fontSize: "14px",
                    background: "white",
                  }}
                >
                  <option value="info">Thông tin</option>
                  <option value="warning">Cảnh báo</option>
                  <option value="success">Thành công</option>
                  <option value="error">Lỗi</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                    marginBottom: "6px",
                  }}
                >
                  Độ ưu tiên
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) =>
                    handleInputChange("priority", e.target.value)
                  }
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid #D1D5DB",
                    borderRadius: "8px",
                    fontSize: "14px",
                    background: "white",
                  }}
                >
                  <option value="low">Thấp</option>
                  <option value="normal">Bình thường</option>
                  <option value="high">Cao</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Recipients */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "12px",
            padding: "24px",
            border: "1px solid #E5E7EB",
          }}
        >
          <h3
            style={{
              fontSize: "18px",
              fontWeight: "600",
              color: "#111827",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Users size={20} />
            Người nhận
          </h3>

          <div style={{ display: "grid", gap: "16px" }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#374151",
                  marginBottom: "6px",
                }}
              >
                Loại người nhận
              </label>
              <select
                value={formData.recipientType}
                onChange={(e) =>
                  handleInputChange("recipientType", e.target.value)
                }
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  background: "white",
                }}
              >
                <option value="all">Tất cả</option>
                <option value="students">Chỉ sinh viên</option>
                <option value="lecturers">Chỉ giảng viên</option>
                <option value="admins">Chỉ quản trị viên</option>
                <option value="specific">Chọn cụ thể</option>
              </select>
            </div>

            {formData.recipientType === "specific" && (
              <div style={{ display: "grid", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#374151",
                    }}
                  >
                    Danh sách người nhận cụ thể: <span style={{ color: "#4F46E5", fontWeight: "800" }}>{formData.selectedRecipients.length}</span> người đã chọn
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setTempSelectedRecipients([...formData.selectedRecipients]);
                      setIsRecipientModalOpen(true);
                    }}
                    style={{
                      padding: "8px 16px",
                      background: "linear-gradient(135deg, #4f46e5, #4338ca)",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 2px 4px rgba(79, 70, 229, 0.15)"
                    }}
                  >
                    <Users size={14} /> Chọn danh sách...
                  </button>
                </div>
                {formData.selectedRecipients.length > 0 ? (
                  <div style={{
                    maxHeight: "150px",
                    overflowY: "auto",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "12px",
                    background: "#f8fafc",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px"
                  }}>
                    {formData.selectedRecipients.map((code) => {
                      const rc = recipients.find(r => r.id === code);
                      return (
                        <div key={code} style={{
                          background: "#fff",
                          border: "1px solid #cbd5e1",
                          borderRadius: "99px",
                          padding: "4px 12px",
                          fontSize: "12px",
                          fontWeight: "600",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px"
                        }}>
                          <span style={{ color: "#4f46e5", fontSize: "10px", fontWeight: "800" }}>
                            [{rc?.type === "student" ? "SV" : rc?.type === "lecturer" ? "GV" : "ADM"}]
                          </span>
                          <span>{rc?.name || code}</span>
                          <button
                            type="button"
                            onClick={() => handleInputChange("selectedRecipients", formData.selectedRecipients.filter(c => c !== code))}
                            style={{ border: "none", background: "none", color: "#6b7280", cursor: "pointer", padding: "0 2px", display: "flex", alignItems: "center" }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{
                    border: "1px dashed #cbd5e1",
                    borderRadius: "10px",
                    padding: "20px",
                    background: "#f8fafc",
                    color: "#6b7280",
                    textAlign: "center",
                    fontSize: "13px"
                  }}>
                    Chưa chọn người nhận nào. Vui lòng bấm "Chọn danh sách..." để bắt đầu chọn.
                  </div>
                )}
              </div>
            )}

            <div
              style={{
                padding: "16px",
                background: "#F9FAFB",
                borderRadius: "8px",
                border: "1px solid #E5E7EB",
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                Sẽ gửi đến: {filteredRecipients.length} người nhận
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                {filteredRecipients.slice(0, 5).map((recipient) => (
                  <span
                    key={recipient.id}
                    style={{
                      padding: "4px 8px",
                      background: "#E5E7EB",
                      color: "#374151",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "500",
                    }}
                  >
                    {recipient.name}
                  </span>
                ))}
                {filteredRecipients.length > 5 && (
                  <span
                    style={{
                      padding: "4px 8px",
                      background: "#E5E7EB",
                      color: "#374151",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "500",
                    }}
                  >
                    +{filteredRecipients.length - 5} người khác
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>


        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "flex-end",
            padding: "24px",
            background: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/admin")}
            style={{
              padding: "12px 24px",
              background: "#F3F4F6",
              color: "#374151",
              border: "1px solid #D1D5DB",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#E5E7EB";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#F3F4F6";
            }}
          >
            Hủy
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: "12px 24px",
              background: isSubmitting ? "#9CA3AF" : "#4F46E5",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "500",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              transition: "background-color 0.2s",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting)
                e.currentTarget.style.backgroundColor = "#4338CA";
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting)
                e.currentTarget.style.backgroundColor = "#4F46E5";
            }}
          >
            {isSubmitting ? (
              <>
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid #FFFFFF",
                    borderTop: "2px solid transparent",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
                Đang gửi...
              </>
            ) : (
              <>
                <Send size={16} />
                Gửi thông báo
              </>
            )}
          </button>
        </div>
      </form>

      {/* Preview Modal */}
      {showPreview && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "32px",
              maxWidth: "500px",
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  color: "#111827",
                  fontSize: "20px",
                  fontWeight: "600",
                }}
              >
                Xem trước thông báo
              </h2>
              <button
                onClick={() => setShowPreview(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#6B7280",
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                padding: "20px",
                border: `2px solid ${getTypeColor(formData.type)}`,
                borderRadius: "8px",
                background: "#F9FAFB",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "16px",
                }}
              >
                {getTypeIcon(formData.type)}
                <div>
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: "600",
                      color: "#111827",
                    }}
                  >
                    {formData.title || "Tiêu đề thông báo"}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#6B7280",
                      textTransform: "uppercase",
                      fontWeight: "500",
                    }}
                  >
                    {formData.type === "info"
                      ? "Thông tin"
                      : formData.type === "warning"
                      ? "Cảnh báo"
                      : formData.type === "success"
                      ? "Thành công"
                      : "Lỗi"}
                  </div>
                </div>
              </div>

              <div
                style={{
                  fontSize: "14px",
                  color: "#374151",
                  lineHeight: "1.6",
                  whiteSpace: "pre-wrap",
                }}
              >
                {formData.content || "Nội dung thông báo sẽ hiển thị ở đây..."}
              </div>

              <div
                style={{
                  marginTop: "16px",
                  paddingTop: "16px",
                  borderTop: "1px solid #E5E7EB",
                  fontSize: "12px",
                  color: "#6B7280",
                }}
              >
                Sẽ gửi đến: {filteredRecipients.length} người nhận
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                marginTop: "24px",
              }}
            >
              <button
                onClick={() => setShowPreview(false)}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "#4F46E5",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#4338CA";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#4F46E5";
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates Modal */}
      {showTemplates && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "32px",
              maxWidth: "600px",
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  color: "#111827",
                  fontSize: "20px",
                  fontWeight: "600",
                }}
              >
                Chọn mẫu thông báo
              </h2>
              <button
                onClick={() => setShowTemplates(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#6B7280",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "grid", gap: "16px" }}>
              {notificationTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  style={{
                    padding: "16px",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#4F46E5";
                    e.currentTarget.style.backgroundColor = "#F3F4F6";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#E5E7EB";
                    e.currentTarget.style.backgroundColor = "white";
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "8px",
                    }}
                  >
                    {getTypeIcon(template.type)}
                    <div>
                      <div
                        style={{
                          fontSize: "16px",
                          fontWeight: "600",
                          color: "#111827",
                        }}
                      >
                        {template.name}
                      </div>
                      <div
                        style={{
                          fontSize: "14px",
                          color: "#6B7280",
                        }}
                      >
                        {template.title}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      color: "#374151",
                      lineHeight: "1.5",
                    }}
                  >
                    {template.content.substring(0, 100)}...
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                marginTop: "24px",
              }}
            >
              <button
                onClick={() => setShowTemplates(false)}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "#F3F4F6",
                  color: "#374151",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recipient Selection Modal */}
      {isRecipientModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              width: "100%",
              maxWidth: "800px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              border: "1px solid #E2E8F0",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "20px 24px",
                borderBottom: "1px solid #E2E8F0",
                background: "linear-gradient(135deg, #1e3a8a, #3b82f6)",
                color: "#FFFFFF",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Chọn người nhận thông báo</h2>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#DBEAFE" }}>
                  Đang chọn <span style={{ fontWeight: "800", color: "#FDE047" }}>{tempSelectedRecipients.length}</span> người nhận
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRecipientModalOpen(false)}
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "none",
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#FFFFFF",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.2)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)")}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Filters */}
            <div
              style={{
                padding: "16px 24px",
                background: "#F8FAFC",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                {/* Search Input */}
                <div style={{ position: "relative" }}>
                  <Search
                    size={18}
                    color="#94A3B8"
                    style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}
                  />
                  <input
                    type="text"
                    placeholder="Tìm theo tên hoặc mã số..."
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px 10px 38px",
                      border: "1px solid #CBD5E1",
                      borderRadius: "8px",
                      fontSize: "14px",
                      outline: "none",
                    }}
                  />
                </div>

                {/* Period Select */}
                <div style={{ position: "relative" }}>
                  <Filter
                    size={16}
                    color="#94A3B8"
                    style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}
                  />
                  <select
                    value={selectedPeriodId}
                    onChange={(e) => setSelectedPeriodId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px 10px 34px",
                      border: "1px solid #CBD5E1",
                      borderRadius: "8px",
                      fontSize: "14px",
                      background: "#FFFFFF",
                      outline: "none",
                    }}
                  >
                    <option value="">Tất cả đợt bảo vệ</option>
                    {periods.map((p) => (
                      <option key={p.defenseTermId} value={String(p.defenseTermId)}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "4px" }}>
                  <button
                    type="button"
                    onClick={() => setRecipientTab("student")}
                    style={{
                      padding: "8px 16px",
                      background: recipientTab === "student" ? "#3B82F6" : "transparent",
                      color: recipientTab === "student" ? "#FFFFFF" : "#475569",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: "700",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    Sinh viên ({recipients.filter((r) => r.type === "student").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecipientTab("lecturer")}
                    style={{
                      padding: "8px 16px",
                      background: recipientTab === "lecturer" ? "#3B82F6" : "transparent",
                      color: recipientTab === "lecturer" ? "#FFFFFF" : "#475569",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: "700",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    Giảng viên & Admin ({recipients.filter((r) => r.type === "lecturer" || r.type === "admin").length})
                  </button>
                </div>

                {/* Bulk Actions */}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      const filteredIds = recipients
                        .filter((r) => {
                          const matchesSearch =
                            (r.name?.toLowerCase() || "").includes(recipientSearch.toLowerCase()) ||
                            (r.code?.toLowerCase() || "").includes(recipientSearch.toLowerCase());
                          const matchesPeriod = !selectedPeriodId || String(r.defenseTermId) === selectedPeriodId;
                          const matchesTab = r.type === recipientTab || (recipientTab === "lecturer" && r.type === "admin");
                          return matchesSearch && matchesPeriod && matchesTab;
                        })
                        .map((r) => r.id);

                      setTempSelectedRecipients((prev) => {
                        const next = [...prev];
                        filteredIds.forEach((id) => {
                          if (!next.includes(id)) next.push(id);
                        });
                        return next;
                      });
                    }}
                    style={{
                      padding: "6px 12px",
                      background: "#EFF6FF",
                      color: "#1D4ED8",
                      border: "1px solid #BFDBFE",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    Chọn tất cả đã lọc
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const filteredIds = recipients
                        .filter((r) => {
                          const matchesSearch =
                            (r.name?.toLowerCase() || "").includes(recipientSearch.toLowerCase()) ||
                            (r.code?.toLowerCase() || "").includes(recipientSearch.toLowerCase());
                          const matchesPeriod = !selectedPeriodId || String(r.defenseTermId) === selectedPeriodId;
                          const matchesTab = r.type === recipientTab || (recipientTab === "lecturer" && r.type === "admin");
                          return matchesSearch && matchesPeriod && matchesTab;
                        })
                        .map((r) => r.id);

                      setTempSelectedRecipients((prev) => prev.filter((id) => !filteredIds.includes(id)));
                    }}
                    style={{
                      padding: "6px 12px",
                      background: "#FEF2F2",
                      color: "#991B1B",
                      border: "1px solid #FCA5A5",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    Bỏ chọn tất cả đã lọc
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Body - Scrollable Candidate List */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "24px",
                background: "#FFFFFF",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                alignContent: "start",
                minHeight: "300px",
              }}
            >
              {loadingRecipients ? (
                <div style={{ gridColumn: "span 2", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      border: "3px solid #3B82F6",
                      borderTop: "3px solid transparent",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  <p style={{ marginTop: "12px", color: "#64748B", fontSize: "14px" }}>Đang tải danh sách người dùng...</p>
                </div>
              ) : (() => {
                const filtered = recipients.filter((r) => {
                  const matchesSearch =
                    (r.name?.toLowerCase() || "").includes(recipientSearch.toLowerCase()) ||
                    (r.code?.toLowerCase() || "").includes(recipientSearch.toLowerCase());
                  const matchesPeriod = !selectedPeriodId || String(r.defenseTermId) === selectedPeriodId;
                  const matchesTab = r.type === recipientTab || (recipientTab === "lecturer" && r.type === "admin");
                  return matchesSearch && matchesPeriod && matchesTab;
                });

                if (filtered.length === 0) {
                  return (
                    <div style={{ gridColumn: "span 2", textAlign: "center", padding: "60px 20px", color: "#64748B" }}>
                      <Users size={48} style={{ margin: "0 auto 16px auto", opacity: 0.4 }} />
                      <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: "600" }}>Không tìm thấy người nhận nào</h3>
                      <p style={{ margin: 0, fontSize: "13px" }}>Vui lòng thay đổi từ khóa tìm kiếm hoặc bộ lọc đợt bảo vệ.</p>
                    </div>
                  );
                }

                return filtered.map((r) => {
                  const isChecked = tempSelectedRecipients.includes(r.id);
                  const periodName = getPeriodName(r.defenseTermId);

                  return (
                    <div
                      key={r.id}
                      onClick={() => {
                        setTempSelectedRecipients((prev) =>
                          prev.includes(r.id) ? prev.filter((id) => id !== r.id) : [...prev, r.id]
                        );
                      }}
                      style={{
                        border: isChecked ? "2px solid #3B82F6" : "1px solid #E2E8F0",
                        background: isChecked ? "#F0F6FF" : "#FFFFFF",
                        borderRadius: "10px",
                        padding: "12px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        style={{
                          width: "18px",
                          height: "18px",
                          cursor: "pointer",
                        }}
                      />
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          background: r.type === "student" ? "#EFF6FF" : r.type === "lecturer" ? "#ECFDF5" : "#FFF7ED",
                          color: r.type === "student" ? "#2563EB" : r.type === "lecturer" ? "#059669" : "#D97706",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "700",
                          fontSize: "14px",
                        }}
                      >
                        {r.type === "student" ? "SV" : r.type === "lecturer" ? "GV" : "AD"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "14px", fontWeight: "600", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.name}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                          <span style={{ fontSize: "11px", color: "#64748B", fontWeight: "500" }}>Mã: {r.code}</span>
                          {periodName && (
                            <span
                              style={{
                                fontSize: "10px",
                                background: "#F1F5F9",
                                color: "#475569",
                                padding: "1px 6px",
                                borderRadius: "4px",
                                fontWeight: "600",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                maxWidth: "150px"
                              }}
                              title={periodName}
                            >
                              {periodName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #E2E8F0",
                background: "#F8FAFC",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: "13px", color: "#64748B", fontWeight: "500" }}>
                Đã chọn <span style={{ color: "#3B82F6", fontWeight: "700" }}>{tempSelectedRecipients.length}</span> người nhận
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => setIsRecipientModalOpen(false)}
                  style={{
                    padding: "10px 20px",
                    background: "#FFFFFF",
                    color: "#475569",
                    border: "1px solid #CBD5E1",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#F1F5F9")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleInputChange("selectedRecipients", tempSelectedRecipients);
                    setIsRecipientModalOpen(false);
                  }}
                  style={{
                    padding: "10px 24px",
                    background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 6px rgba(37, 99, 235, 0.3)")}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 2px 4px rgba(37, 99, 235, 0.2)")}
                >
                  Áp dụng ({tempSelectedRecipients.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateNotification;
