import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, ShieldCheck, GraduationCap, ArrowLeft, Mail, KeyRound, Lock, Timer } from "lucide-react";
import {
  login as loginApi,
  parseLoginResponse,
  forgotPassword,
  verifyOtpReset,
  getCaptcha,
} from "../../services/auth.service";
import { useAuth } from "../../hooks/useAuth";
import { RolePaths } from "../../utils/role";
import type { ApiResponse } from "../../types/api";
import {
  AuthSessionKeys,
  clearAuthSession,
  consumeSessionExpiredMessage,
  getRoleClaimFromAccessToken,
  getAllRolesFromAccessToken,
  setLecturerCode,
  setAuthSession,
  setStudentCode,
} from "../../services/auth-session.service";
import { normalizeRole, ROLE_LECTURER, ROLE_STUDENT } from "../../utils/role";
import { FetchDataError, fetchData } from "../../api/fetchData";
import type { StudentProfile } from "../../types/studentProfile";
import type { LecturerProfile } from "../../types/lecturer-profile";
import {
  fetchCurrentDefensePeriod,
  fetchCurrentLecturerDefenseAccess,
} from "../../services/current-defense-period.service";

type LoginApiResponse = ApiResponse<unknown> & {
  userCode?: string;
  role?: string;
  accessToken?: string;
  tokenType?: string;
  expiresAt?: string;
};

async function cacheRoleProfileCode(
  role: string,
  userCode: string,
): Promise<void> {
  const normalizedRole = normalizeRole(role);
  const normalizedUserCode = userCode.trim();
  if (!normalizedUserCode) return;

  try {
    if (normalizedRole === ROLE_STUDENT) {
      const studentProfileResponse = await fetchData<
        ApiResponse<StudentProfile[]>
      >(
        `/StudentProfiles/get-list?UserCode=${encodeURIComponent(normalizedUserCode)}`,
      );
      const studentCode =
        studentProfileResponse.data?.[0]?.studentCode?.trim() || null;
      setStudentCode(studentCode);
      setLecturerCode(null);
      return;
    }

    if (normalizedRole === ROLE_LECTURER) {
      const lecturerProfileResponse = await fetchData<
        ApiResponse<LecturerProfile[]>
      >(
        `/LecturerProfiles/get-list?UserCode=${encodeURIComponent(normalizedUserCode)}`,
      );
      const lecturerCode =
        lecturerProfileResponse.data?.[0]?.lecturerCode?.trim() || null;
      setLecturerCode(lecturerCode);
      setStudentCode(null);
      return;
    }

    setStudentCode(null);
    setLecturerCode(null);
  } catch (profileError) {
    console.warn("Failed to cache role profile code after login", profileError);
  }
}

function getLoginErrorMessage(error: unknown): string {
  if (error instanceof FetchDataError) {
    const serverData = error.data as
      | {
          message?: string;
          Message?: string;
          errors?: Record<string, string[]>;
          Errors?: Record<string, string[]>;
          code?: string | number | null;
          Code?: string | number | null;
        }
      | null
      | undefined;

    const serverMessage =
      serverData?.message ||
      serverData?.Message ||
      Object.values(serverData?.errors ?? serverData?.Errors ?? {})[0]?.[0] ||
      "";

    const code = String(serverData?.code ?? serverData?.Code ?? "").trim().toUpperCase();
    const rawMessage = serverMessage || error.message || "";
    const normalizedMessage = rawMessage.trim();

    if (error.status === 400) {
      return normalizedMessage || "Tên đăng nhập và mật khẩu không được để trống.";
    }

    if (error.status === 401) {
      if (normalizedMessage) {
        return normalizedMessage;
      }
      if (code.includes("PASSWORD")) {
        return "Mật khẩu không đúng.";
      }
      if (code.includes("ACCOUNT") || code.includes("USER")) {
        return "Tài khoản không tồn tại.";
      }
      return "Tên đăng nhập hoặc mật khẩu không đúng.";
    }

    if (error.status === 403) {
      return normalizedMessage || "Tài khoản của bạn chưa được cấp quyền đăng nhập.";
    }

    if (error.status === 429) {
      return normalizedMessage || "Hệ thống đang quá tải hoặc bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.";
    }

    if (error.status === 408 || /aborted|timeout/i.test(normalizedMessage)) {
      return "Yêu cầu đăng nhập bị hủy hoặc quá thời gian chờ. Vui lòng thử lại.";
    }

    return normalizedMessage || "Không thể đăng nhập lúc này. Vui lòng thử lại.";
  }

  if (error instanceof Error) {
    if (/aborted|timeout/i.test(error.message)) {
      return "Yêu cầu đăng nhập bị hủy hoặc quá thời gian chờ. Vui lòng thử lại.";
    }
    return error.message || "Không thể đăng nhập lúc này.";
  }

  return "Không thể đăng nhập lúc này.";
}

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [tempUser, setTempUser] = useState<any>(null);
  
  // States for forgot password flow
  const [authMode, setAuthMode] = useState<"login" | "forgot_request" | "forgot_verify">("login");
  const [forgotStudentCode, setForgotStudentCode] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // States for captcha security
  const [requiresCaptcha, setRequiresCaptcha] = useState(false);
  const [captchaCode, setCaptchaCode] = useState("");
  const [captchaSessionId, setCaptchaSessionId] = useState("");
  const [captchaImage, setCaptchaImage] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);

  // States for OTP request countdown rate-limit
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  const auth = useAuth();
  const navigate = useNavigate();

  async function fetchCaptchaImage() {
    setCaptchaLoading(true);
    try {
      const resp = await getCaptcha();
      if (resp.success && resp.data) {
        setCaptchaSessionId(resp.data.captchaSessionId);
        setCaptchaImage(resp.data.captchaImage);
        setCaptchaCode("");
      }
    } catch (err) {
      console.error("Failed to load captcha", err);
    } finally {
      setCaptchaLoading(false);
    }
  }

  useEffect(() => {
    const expiredMessage = consumeSessionExpiredMessage();
    if (expiredMessage) {
      setError(expiredMessage);
    }
  }, []);

  async function handleForgotPasswordRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotStudentCode.trim()) {
      setError("Vui lòng nhập mã sinh viên.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const resp = await forgotPassword({ studentCode: forgotStudentCode.trim() });
      if (resp.success) {
        setSuccessMessage(resp.message || "Mã OTP đã được gửi đến email đăng ký.");
        setAuthMode("forgot_verify");
        setCountdown(60);
      } else {
        setError(resp.message || "Không thể yêu cầu đặt lại mật khẩu.");
      }
    } catch (err: unknown) {
      if (err instanceof FetchDataError) {
        const serverData = err.data as any;
        const msg = serverData?.message || serverData?.Message || err.message || "Lỗi yêu cầu gửi OTP.";
        setError(msg);
      } else if (err instanceof Error) {
        setError(err.message || "Lỗi yêu cầu gửi OTP.");
      } else {
        setError("Lỗi yêu cầu gửi OTP.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPasswordReset(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setError("Vui lòng điền đầy đủ các trường.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu mới và xác nhận mật khẩu không khớp.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const resp = await verifyOtpReset({
        studentCode: forgotStudentCode.trim(),
        otp: otp.trim(),
        newPassword: newPassword.trim(),
      });
      if (resp.success) {
        setSuccessMessage(resp.message || "Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.");
        // Auto fill username and go to login
        setUsername(forgotStudentCode.trim());
        setPassword("");
        setForgotStudentCode("");
        setOtp("");
        setNewPassword("");
        setConfirmPassword("");
        setAuthMode("login");
      } else {
        setError(resp.message || "Đặt lại mật khẩu thất bại.");
      }
    } catch (err: unknown) {
      if (err instanceof FetchDataError) {
        const serverData = err.data as any;
        const msg = serverData?.message || serverData?.Message || err.message || "Lỗi xác minh OTP đặt lại mật khẩu.";
        setError(msg);
      } else if (err instanceof Error) {
        setError(err.message || "Lỗi xác minh OTP đặt lại mật khẩu.");
      } else {
        setError("Lỗi xác minh OTP đặt lại mật khẩu.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleBackToLogin() {
    setAuthMode("login");
    setError(null);
    setSuccessMessage(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const resp = (await loginApi({ 
        username, 
        password,
        captchaCode: requiresCaptcha ? captchaCode : undefined,
        captchaSessionId: requiresCaptcha ? captchaSessionId : undefined
      })) as LoginApiResponse;

      if (!resp.success) {
        if (resp.code === "REQUIRES_CAPTCHA") {
          setRequiresCaptcha(true);
          fetchCaptchaImage();
        }
        setError(resp.message ?? "Đăng nhập thất bại");
        setLoading(false);
        return;
      }
      const parsed = parseLoginResponse(resp);
      const user = parsed.user ?? null;

      // nếu server trả về user info
      if (user) {
        try {
          // Reset previous auth data after successful login
          clearAuthSession();

          // Save full login response exactly as returned from backend
          window.localStorage.setItem("login_response", JSON.stringify(resp));

          // Save access token + expiresAt (memory first + storage fallback)
          setAuthSession({
            accessToken: resp.accessToken ?? null,
            expiresAt: resp.expiresAt ?? null,
          });

          // Save convenient auth payload for token-based usage
          window.localStorage.setItem(
            "auth_session",
            JSON.stringify({
              success: resp.success,
              userCode: resp.userCode,
              role: resp.role,
              accessToken: resp.accessToken,
              tokenType: resp.tokenType,
              expiresAt: resp.expiresAt,
              data: resp.data,
            }),
          );

          // Keep dedicated keys for compatibility
          if (resp.accessToken) {
            window.localStorage.setItem(
              AuthSessionKeys.ACCESS_TOKEN_KEY,
              resp.accessToken,
            );
          }
          if (resp.expiresAt) {
            window.localStorage.setItem(
              AuthSessionKeys.EXPIRES_AT_KEY,
              resp.expiresAt,
            );
          }
        } catch {
          // Ignore localStorage failures and continue auth flow
        }

        const roles = getAllRolesFromAccessToken(resp.accessToken);
        
        if (roles.length > 1) {
          setTempUser(user);
          setAvailableRoles(roles);
          setShowRoleSelector(true);
          setLoading(false);
          return;
        }

        const role = normalizeRole(roles[0] || user.role);
        user.role = role;
        user.roles = roles;
        user.activeRole = role;

        await cacheRoleProfileCode(role, user.userCode || "");

        // Reset failed login attempts states
        setRequiresCaptcha(false);
        setCaptchaCode("");

        auth.login(user);
        const redirect = RolePaths[role] ?? "/";
        navigate(redirect);
        return;
      }

      // fallback: nếu server không trả user nhưng trả redirect url
      if (resp.redirectUrl) {
        window.location.href = resp.redirectUrl;
        return;
      }

      setError("Không nhận được thông tin user từ server.");
    } catch (err: unknown) {
      if (err instanceof FetchDataError) {
        const serverData = err.data as any;
        if (serverData?.code === "REQUIRES_CAPTCHA" || serverData?.Code === "REQUIRES_CAPTCHA") {
          setRequiresCaptcha(true);
          fetchCaptchaImage();
        }
      }
      setError(getLoginErrorMessage(err));
    } finally {
      if (!showRoleSelector) {
        setLoading(false);
      }
    }
  }

  async function handleRoleSelect(role: string) {
    if (!tempUser) return;
    setLoading(true);
    
    const normalizedRole = normalizeRole(role);
    const userToLogin = {
      ...tempUser,
      role: normalizedRole,
      activeRole: normalizedRole,
      roles: availableRoles
    };

    await cacheRoleProfileCode(normalizedRole, userToLogin.userCode || "");
    
    auth.login(userToLogin);
    const redirect = RolePaths[normalizedRole] ?? "/";
    navigate(redirect);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#FFFFFF",
        fontFamily: "'Be Vietnam Pro', sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {showRoleSelector && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "linear-gradient(135deg, #001C3D 0%, #002855 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "500px",
              background: "#FFFFFF",
              borderRadius: "24px",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
              overflow: "hidden",
              animation: "slideUp 0.5s ease-out",
            }}
          >

            <div style={{ padding: "40px" }}>
              {/* Logo Area */}
              <div
                style={{
                  width: "100px",
                  height: "100px",
                  background: "#FFFFFF",
                  borderRadius: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 24px",
                  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
                  padding: "10px",
                }}
              >
                <img
                  src="/dnu_logo.png"
                  alt="DNU"
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </div>

              <h2
                style={{
                  fontSize: "26px",
                  fontWeight: 800,
                  color: "#001C3D",
                  marginBottom: "8px",
                  textAlign: "center",
                }}
              >
                Không gian làm việc
              </h2>
              <p
                style={{
                  fontSize: "15px",
                  color: "#64748B",
                  marginBottom: "32px",
                  textAlign: "center",
                  lineHeight: "1.6",
                }}
              >
                Vui lòng chọn vai trò để bắt đầu truy cập hệ thống
              </p>

              <div style={{ display: "grid", gap: "16px" }}>
                {availableRoles.map((role) => (
                  <button
                    key={role}
                    onClick={() => handleRoleSelect(role)}
                    style={{
                      position: "relative",
                      padding: "24px",
                      borderRadius: "16px",
                      border: "none",
                      background: role === "ADMIN" ? "#001C3D" : "#F37021",
                      display: "flex",
                      alignItems: "center",
                      gap: "20px",
                      cursor: "pointer",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      textAlign: "left",
                      width: "100%",
                      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
                      overflow: "hidden",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-4px)";
                      e.currentTarget.style.boxShadow = role === "ADMIN" 
                        ? "0 12px 30px rgba(0, 28, 61, 0.3)" 
                        : "0 12px 30px rgba(243, 112, 33, 0.3)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.12)";
                    }}
                  >
                    {/* Background Pattern */}
                    <div style={{
                      position: "absolute",
                      right: "-10px",
                      bottom: "-10px",
                      opacity: 0.1,
                      color: "#FFFFFF",
                      transform: "rotate(-15deg)"
                    }}>
                      {role === "ADMIN" ? <ShieldCheck size={100} /> : <GraduationCap size={100} />}
                    </div>

                    <div
                      style={{
                        width: "52px",
                        height: "52px",
                        borderRadius: "12px",
                        background: "rgba(255, 255, 255, 0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#FFFFFF",
                        flexShrink: 0,
                      }}
                    >
                      {role === "ADMIN" ? <ShieldCheck size={28} /> : <GraduationCap size={28} />}
                    </div>
                    <div style={{ flex: 1, zIndex: 1 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          color: "#FFFFFF",
                          fontSize: "18px",
                          marginBottom: "2px",
                        }}
                      >
                        {role === "ADMIN" ? "Quản trị viên" : "Giảng viên"}
                      </div>
                      <div style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.8)" }}>
                        {role === "ADMIN" ? "Quản lý & Phê duyệt hệ thống" : "Quản lý đồ án & Chấm điểm"}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  setShowRoleSelector(false);
                  clearAuthSession();
                }}
                style={{
                  marginTop: "32px",
                  background: "none",
                  border: "none",
                  color: "#001C3D",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "center",
                  opacity: 0.6,
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
              >
                Hủy và quay lại đăng nhập
              </button>
            </div>
          </div>
          <style>{`
            @keyframes slideUp {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}
      {/* Background decoration */}
      <div
        style={{
          position: "absolute",
          top: "-50%",
          left: "-50%",
          width: "200%",
          height: "200%",
          background:
            "radial-gradient(circle, rgba(243, 112, 33, 0.03) 0%, transparent 70%)",
          animation: "float 8s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-30%",
          right: "-30%",
          width: "60%",
          height: "60%",
          background:
            "radial-gradient(circle, rgba(0, 40, 85, 0.02) 0%, transparent 70%)",
          animation: "float 10s ease-in-out infinite reverse",
        }}
      />

      {/* Login Form */}
      <div
        className="login-form-container"
        style={{
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: "16px",
          padding: "3rem",
          width: "100%",
          maxWidth: "420px",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.08)",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Header */}
        <div
          className="login-header"
          style={{ textAlign: "center", marginBottom: "2.5rem" }}
        >
          <div
            style={{
              width: "100px",
              height: "100px",
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.5rem",
              border: "2px solid #F37021",
              boxShadow: "0 8px 24px rgba(243, 112, 33, 0.15)",
            }}
          >
            <img
              className="login-logo"
              src="/dnu_logo.png"
              alt="DNU Logo"
              style={{
                width: "70px",
                height: "70px",
                objectFit: "contain",
              }}
            />
          </div>
          <h1
            style={{
              color: "#002855",
              margin: "0 0 0.5rem 0",
              fontSize: "1.8rem",
              fontWeight: 700,
              letterSpacing: "0.5px",
            }}
          >
            {authMode === "login" && "Đăng nhập hệ thống"}
            {authMode === "forgot_request" && "Quên mật khẩu"}
            {authMode === "forgot_verify" && "Đặt lại mật khẩu"}
          </h1>
          <p
            style={{
              color: "#6B7280",
              margin: 0,
              fontSize: "0.95rem",
              fontWeight: 400,
              lineHeight: "1.4",
            }}
          >
            {authMode === "login" && "Hệ thống Quản lý Đồ án Tốt nghiệp - Đại học Đại Nam"}
            {authMode === "forgot_request" && "Nhập mã số tài khoản để nhận mã xác nhận OTP gửi về email liên kết."}
            {authMode === "forgot_verify" && `Nhập mã OTP đã gửi đến email của bạn và thiết lập mật khẩu mới.`}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              color: "#DC2626",
              padding: "1rem",
              borderRadius: "8px",
              marginBottom: "1.5rem",
              fontSize: "0.9rem",
              fontWeight: 500,
              lineHeight: "1.5",
            }}
          >
            {error}
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div
            style={{
              backgroundColor: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.2)",
              color: "#059669",
              padding: "1rem",
              borderRadius: "8px",
              marginBottom: "1.5rem",
              fontSize: "0.9rem",
              fontWeight: 500,
              lineHeight: "1.5",
            }}
          >
            {successMessage}
          </div>
        )}

        {/* Login Form */}
        {authMode === "login" && (
          <form onSubmit={handleSubmit} autoComplete="off">
            {/* Username Field */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label
                style={{
                  display: "block",
                  color: "#002855",
                  marginBottom: "0.5rem",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  letterSpacing: "0.3px",
                }}
              >
                Tên đăng nhập
              </label>
              <div
                style={{
                  position: "relative",
                  borderRadius: "8px",
                  overflow: "hidden",
                  backgroundColor:
                    focusedField === "username"
                      ? "rgba(243, 112, 33, 0.02)"
                      : "#FFFFFF",
                  border:
                    focusedField === "username"
                      ? "2px solid #F37021"
                      : "2px solid #E5E7EB",
                  transition: "all 0.3s ease",
                }}
              >
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocusedField("username")}
                  onBlur={() => setFocusedField(null)}
                  required
                  placeholder="Nhập tên đăng nhập"
                  autoComplete="off"
                  className="login-input"
                  style={{
                    width: "100%",
                    padding: "0.875rem 1rem",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "#002855",
                    fontSize: "1rem",
                    fontFamily: "inherit",
                    fontWeight: 400,
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  color: "#002855",
                  marginBottom: "0.5rem",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  letterSpacing: "0.3px",
                }}
              >
                Mật khẩu
              </label>
              <div
                style={{
                  position: "relative",
                  borderRadius: "8px",
                  overflow: "hidden",
                  backgroundColor:
                    focusedField === "password"
                      ? "rgba(243, 112, 33, 0.02)"
                      : "#FFFFFF",
                  border:
                    focusedField === "password"
                      ? "2px solid #F37021"
                      : "2px solid #E5E7EB",
                  transition: "all 0.3s ease",
                }}
              >
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  required
                  placeholder="Nhập mật khẩu"
                  autoComplete="off"
                  className="login-input"
                  style={{
                    width: "100%",
                    padding: "0.875rem 1rem",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "#002855",
                    fontSize: "1rem",
                    fontFamily: "inherit",
                    fontWeight: 400,
                  }}
                />
              </div>
            </div>

            {/* Captcha Field */}
            {requiresCaptcha && (
              <div style={{ marginBottom: "1.5rem" }}>
                <label
                  style={{
                    display: "block",
                    color: "#002855",
                    marginBottom: "0.5rem",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    letterSpacing: "0.3px",
                  }}
                >
                  Mã xác thực Captcha
                </label>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <div
                    style={{
                      flex: 1,
                      position: "relative",
                      borderRadius: "8px",
                      overflow: "hidden",
                      backgroundColor:
                        focusedField === "captcha"
                          ? "rgba(243, 112, 33, 0.02)"
                          : "#FFFFFF",
                      border:
                        focusedField === "captcha"
                          ? "2px solid #F37021"
                          : "2px solid #E5E7EB",
                      transition: "all 0.3s ease",
                    }}
                  >
                    <input
                      type="text"
                      maxLength={4}
                      value={captchaCode}
                      onChange={(e) => setCaptchaCode(e.target.value.toUpperCase())}
                      onFocus={() => setFocusedField("captcha")}
                      onBlur={() => setFocusedField(null)}
                      required
                      placeholder="Mã 4 ký tự"
                      autoComplete="off"
                      style={{
                        width: "100%",
                        padding: "0.875rem 1rem",
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        color: "#002855",
                        fontSize: "1rem",
                        fontFamily: "monospace",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "2px",
                      }}
                    />
                  </div>
                  
                  {/* Captcha Image */}
                  <div
                    onClick={fetchCaptchaImage}
                    title="Nhấp để đổi mã captcha mới"
                    style={{
                      height: "44px",
                      width: "120px",
                      borderRadius: "8px",
                      border: "2px solid #E5E7EB",
                      overflow: "hidden",
                      backgroundColor: "#F3F4F6",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                    }}
                  >
                    {captchaLoading ? (
                      <div
                        style={{
                          width: "16px",
                          height: "16px",
                          border: "2px solid rgba(0, 40, 85, 0.2)",
                          borderTop: "2px solid #002855",
                          borderRadius: "50%",
                          animation: "spin 1s linear infinite",
                        }}
                      />
                    ) : (
                      <img
                        src={captchaImage}
                        alt="Captcha"
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Forgot Password Link */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1.5rem" }}>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("forgot_request");
                  setError(null);
                  setSuccessMessage(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#F37021",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0,
                  transition: "color 0.2s ease",
                }}
                onMouseOver={(e) => (e.currentTarget.style.color = "#E55A1B")}
                onMouseOut={(e) => (e.currentTarget.style.color = "#F37021")}
              >
                Quên mật khẩu?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="login-button"
              style={{
                width: "100%",
                padding: "0.875rem 1rem",
                backgroundColor: loading ? "#E5E7EB" : "#F37021",
                color: loading ? "#6B7280" : "#FFFFFF",
                border: "none",
                borderRadius: "8px",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.3s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                boxShadow: loading
                  ? "none"
                  : "0 4px 12px rgba(243, 112, 33, 0.2)",
                transform: loading ? "none" : "translateY(0)",
                letterSpacing: "0.3px",
              }}
              onMouseOver={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = "#E55A1B";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow =
                    "0 6px 16px rgba(243, 112, 33, 0.25)";
                }
              }}
              onMouseOut={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = "#F37021";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 12px rgba(243, 112, 33, 0.2)";
                }
              }}
            >
              {loading ? (
                <>
                  <div
                    style={{
                      width: "18px",
                      height: "18px",
                      border: "2px solid rgba(107, 114, 128, 0.3)",
                      borderTop: "2px solid #6B7280",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  Đang đăng nhập...
                </>
              ) : (
                <>Đăng nhập</>
              )}
            </button>
          </form>
        )}

        {/* Forgot Password Request Form */}
        {authMode === "forgot_request" && (
          <form onSubmit={handleForgotPasswordRequest} autoComplete="off">
            <div style={{ marginBottom: "2rem" }}>
              <label
                style={{
                  display: "block",
                  color: "#002855",
                  marginBottom: "0.5rem",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  letterSpacing: "0.3px",
                }}
              >
                Mã sinh viên / Mã giảng viên
              </label>
              <div
                style={{
                  position: "relative",
                  borderRadius: "8px",
                  overflow: "hidden",
                  backgroundColor:
                    focusedField === "forgotStudentCode"
                      ? "rgba(243, 112, 33, 0.02)"
                      : "#FFFFFF",
                  border:
                    focusedField === "forgotStudentCode"
                      ? "2px solid #F37021"
                      : "2px solid #E5E7EB",
                  transition: "all 0.3s ease",
                }}
              >
                <input
                  type="text"
                  value={forgotStudentCode}
                  onChange={(e) => setForgotStudentCode(e.target.value)}
                  onFocus={() => setFocusedField("forgotStudentCode")}
                  onBlur={() => setFocusedField(null)}
                  required
                  placeholder="Nhập mã số tài khoản"
                  autoComplete="off"
                  style={{
                    width: "100%",
                    padding: "0.875rem 1rem",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "#002855",
                    fontSize: "1rem",
                    fontFamily: "inherit",
                    fontWeight: 400,
                  }}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.875rem 1rem",
                backgroundColor: loading ? "#E5E7EB" : "#F37021",
                color: loading ? "#6B7280" : "#FFFFFF",
                border: "none",
                borderRadius: "8px",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.3s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                boxShadow: loading
                  ? "none"
                  : "0 4px 12px rgba(243, 112, 33, 0.2)",
                letterSpacing: "0.3px",
                marginBottom: "1rem",
              }}
              onMouseOver={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = "#E55A1B";
                }
              }}
              onMouseOut={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = "#F37021";
                }
              }}
            >
              {loading ? "Đang gửi mã OTP..." : "Gửi mã OTP"}
            </button>

            {/* Back Button */}
            <button
              type="button"
              onClick={handleBackToLogin}
              style={{
                width: "100%",
                padding: "0.875rem 1rem",
                backgroundColor: "transparent",
                color: "#6B7280",
                border: "1px solid #E5E7EB",
                borderRadius: "8px",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.3s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = "#F9FAFB";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <ArrowLeft size={18} />
              Quay lại đăng nhập
            </button>
          </form>
        )}

        {/* Forgot Password Reset Form */}
        {authMode === "forgot_verify" && (
          <form onSubmit={handleForgotPasswordReset} autoComplete="off">
            {/* OTP field */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label
                style={{
                  display: "block",
                  color: "#002855",
                  marginBottom: "0.5rem",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  letterSpacing: "0.3px",
                }}
              >
                Mã xác thực OTP (6 số)
              </label>
              <div
                style={{
                  position: "relative",
                  borderRadius: "8px",
                  overflow: "hidden",
                  backgroundColor:
                    focusedField === "otp"
                      ? "rgba(243, 112, 33, 0.02)"
                      : "#FFFFFF",
                  border:
                    focusedField === "otp"
                      ? "2px solid #F37021"
                      : "2px solid #E5E7EB",
                  transition: "all 0.3s ease",
                }}
              >
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  onFocus={() => setFocusedField("otp")}
                  onBlur={() => setFocusedField(null)}
                  required
                  placeholder="Nhập 6 số OTP"
                  autoComplete="off"
                  style={{
                    width: "100%",
                    padding: "0.875rem 1rem",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "#002855",
                    fontSize: "1.2rem",
                    fontFamily: "inherit",
                    fontWeight: 700,
                    letterSpacing: "4px",
                    textAlign: "center",
                  }}
                />
              </div>
            </div>

            {/* New Password field */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label
                style={{
                  display: "block",
                  color: "#002855",
                  marginBottom: "0.5rem",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  letterSpacing: "0.3px",
                }}
              >
                Mật khẩu mới
              </label>
              <div
                style={{
                  position: "relative",
                  borderRadius: "8px",
                  overflow: "hidden",
                  backgroundColor:
                    focusedField === "newPassword"
                      ? "rgba(243, 112, 33, 0.02)"
                      : "#FFFFFF",
                  border:
                    focusedField === "newPassword"
                      ? "2px solid #F37021"
                      : "2px solid #E5E7EB",
                  transition: "all 0.3s ease",
                }}
              >
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onFocus={() => setFocusedField("newPassword")}
                  onBlur={() => setFocusedField(null)}
                  required
                  placeholder="Nhập mật khẩu mới"
                  autoComplete="off"
                  style={{
                    width: "100%",
                    padding: "0.875rem 1rem",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "#002855",
                    fontSize: "1rem",
                    fontFamily: "inherit",
                    fontWeight: 400,
                  }}
                />
              </div>
            </div>

            {/* Confirm Password field */}
            <div style={{ marginBottom: "2rem" }}>
              <label
                style={{
                  display: "block",
                  color: "#002855",
                  marginBottom: "0.5rem",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  letterSpacing: "0.3px",
                }}
              >
                Xác nhận mật khẩu mới
              </label>
              <div
                style={{
                  position: "relative",
                  borderRadius: "8px",
                  overflow: "hidden",
                  backgroundColor:
                    focusedField === "confirmPassword"
                      ? "rgba(243, 112, 33, 0.02)"
                      : "#FFFFFF",
                  border:
                    focusedField === "confirmPassword"
                      ? "2px solid #F37021"
                      : "2px solid #E5E7EB",
                  transition: "all 0.3s ease",
                }}
              >
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onFocus={() => setFocusedField("confirmPassword")}
                  onBlur={() => setFocusedField(null)}
                  required
                  placeholder="Xác nhận mật khẩu mới"
                  autoComplete="off"
                  style={{
                    width: "100%",
                    padding: "0.875rem 1rem",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "#002855",
                    fontSize: "1rem",
                    fontFamily: "inherit",
                    fontWeight: 400,
                  }}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.875rem 1rem",
                backgroundColor: loading ? "#E5E7EB" : "#F37021",
                color: loading ? "#6B7280" : "#FFFFFF",
                border: "none",
                borderRadius: "8px",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.3s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                boxShadow: loading
                  ? "none"
                  : "0 4px 12px rgba(243, 112, 33, 0.2)",
                letterSpacing: "0.3px",
                marginBottom: "1rem",
              }}
              onMouseOver={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = "#E55A1B";
                }
              }}
              onMouseOut={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = "#F37021";
                }
              }}
            >
              {loading ? "Đang xác nhận..." : "Xác nhận đổi mật khẩu"}
            </button>

            {/* Dual Action Buttons */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                disabled={loading || countdown > 0}
                onClick={() => {
                  forgotPassword({ studentCode: forgotStudentCode.trim() })
                    .then((resp) => {
                      if (resp.success) {
                        setSuccessMessage("Đã gửi lại mã OTP mới. Vui lòng kiểm tra email.");
                        setError(null);
                        setCountdown(60);
                      } else {
                        setError(resp.message || "Gửi lại OTP thất bại.");
                      }
                    })
                    .catch((err) => setError(err.message || "Lỗi gửi lại OTP."));
                }}
                style={{
                  flex: 1,
                  padding: "0.875rem 1rem",
                  backgroundColor: "transparent",
                  color: countdown > 0 ? "#9CA3AF" : "#F37021",
                  border: countdown > 0 ? "1px solid #E5E7EB" : "1px solid #F37021",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  cursor: countdown > 0 ? "not-allowed" : "pointer",
                  transition: "all 0.3s ease",
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
                onMouseOver={(e) => {
                  if (countdown <= 0) {
                    e.currentTarget.style.backgroundColor = "rgba(243, 112, 33, 0.05)";
                  }
                }}
                onMouseOut={(e) => {
                  if (countdown <= 0) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                {countdown > 0 ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}>
                    <Timer size={16} />
                    Gửi lại sau (00:{countdown.toString().padStart(2, "0")})
                  </span>
                ) : (
                  "Gửi lại OTP"
                )}
              </button>
              <button
                type="button"
                onClick={handleBackToLogin}
                style={{
                  flex: 1,
                  padding: "0.875rem 1rem",
                  backgroundColor: "transparent",
                  color: "#6B7280",
                  border: "1px solid #E5E7EB",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "#F9FAFB";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                Hủy bỏ
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: "2rem" }}>
          <p
            style={{
              color: "#6B7280",
              margin: 0,
              fontSize: "0.85rem",
              fontWeight: 400,
            }}
          >
            © 2025 Đại học Đại Nam - Khoa Công nghệ thông tin
          </p>
        </div>
      </div>

      {/* CSS Animations */}
      <style>
        {`
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-10px) rotate(2deg); }
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default LoginPage;
