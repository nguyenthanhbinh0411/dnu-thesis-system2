namespace ThesisManagement.Api.DTOs.Users.Command
{
    public record UserCreateDto(string UserCode, string Password, string Role);
    public record UserUpdateDto(string? Role);
    public record LoginDto(string Username, string Password, string? CaptchaCode = null, string? CaptchaSessionId = null);
    public record ResetPasswordDto(string UserCode, string NewPassword);
    public record ResetDefaultPasswordDto(string UserCode);
    public record ForgotPasswordDto(string StudentCode);
    public record VerifyOtpResetDto(string StudentCode, string Otp, string NewPassword);
}