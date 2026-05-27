import React, { useState } from "react";
import {
  Users,
  GraduationCap,
  Building2,
  BookOpen,
  ClipboardList,
  UserCheck,
} from "lucide-react";
import StudentProfilesManagement from "../studentservices/StudentProfilesManagement";
import LecturerProfilesManagement from "../studentservices/LecturerProfilesManagement";
import DepartmentsManagement from "../studentservices/DepartmentsManagement";
import ClassesManagement from "../studentservices/ClassesManagement";
import TagsManagement from "../studentservices/TagsManagement";
import CatalogTopicsWarehousePage from "../studentservices/CatalogTopicsWarehousePage";
import RoomsManagement from "./RoomsManagement";
import UsersManagement from "./UsersManagement";

const DEEP_BLUE_PRIMARY = "#1e3a5f";

const InfoManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "students" | "lecturers" | "departments" | "classes" | "tags" | "catalogtopics" | "rooms" | "users"
  >("students");

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
            Xem, thêm mới, cập nhật và quản lý cơ sở dữ liệu hệ thống bao gồm Sinh viên, Giảng viên, Khoa/Bộ môn, Tags, Đề tài và Phòng bảo vệ.
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
              { id: "departments", label: "Khoa/Bộ môn", icon: <Building2 size={18} /> },
              { id: "classes", label: "Lớp", icon: <Building2 size={18} /> },
              { id: "tags", label: "Tags", icon: <BookOpen size={18} /> },
              { id: "catalogtopics", label: "Kho đề tài", icon: <ClipboardList size={18} /> },
              { id: "rooms", label: "Phòng bảo vệ", icon: <Building2 size={18} /> },
              { id: "users", label: "Tài khoản", icon: <UserCheck size={18} /> },
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default InfoManagement;
