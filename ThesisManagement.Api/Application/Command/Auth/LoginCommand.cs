using System;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Memory;
using ThesisManagement.Api.Application.Common;
using ThesisManagement.Api.Application.Validate.Auth;
using ThesisManagement.Api.DTOs.Users.Command;
using ThesisManagement.Api.DTOs.Users.Query;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Application.Command.Auth
{
    public sealed record LoginCommandResponse(
        string UserCode,
        string Role,
        string AccessToken,
        string TokenType,
        DateTime ExpiresAt,
        LoginResponseDto Data);

    public interface ILoginCommand
    {
        Task<OperationResult<LoginCommandResponse>> ExecuteAsync(LoginDto loginDto);
    }

    public class LoginCommand : ILoginCommand
    {
        private readonly IAuthService _authService;
        private readonly ICurrentUserService _currentUserService;
        private readonly IJwtTokenService _jwtTokenService;
        private readonly IMemoryCache _cache;

        public LoginCommand(
            IAuthService authService,
            ICurrentUserService currentUserService,
            IJwtTokenService jwtTokenService,
            IMemoryCache cache)
        {
            _authService = authService;
            _currentUserService = currentUserService;
            _jwtTokenService = jwtTokenService;
            _cache = cache;
        }

        public async Task<OperationResult<LoginCommandResponse>> ExecuteAsync(LoginDto loginDto)
        {
            var validationError = LoginCommandValidator.Validate(loginDto);
            if (!string.IsNullOrWhiteSpace(validationError))
                return OperationResult<LoginCommandResponse>.Failed(validationError, 400);

            var username = loginDto.Username.Trim().ToLower();
            var failedKey = $"failed_login_{username}";

            // 1. Check if captcha is required
            _cache.TryGetValue(failedKey, out int failedCount);
            bool requiresCaptcha = failedCount >= 3;

            if (requiresCaptcha)
            {
                if (string.IsNullOrWhiteSpace(loginDto.CaptchaCode) || string.IsNullOrWhiteSpace(loginDto.CaptchaSessionId))
                {
                    return OperationResult<LoginCommandResponse>.Failed("Đăng nhập sai quá 3 lần. Vui lòng nhập mã captcha.", 400);
                }

                var captchaKey = $"captcha_{loginDto.CaptchaSessionId}";
                if (!_cache.TryGetValue(captchaKey, out string? cachedCaptcha))
                {
                    return OperationResult<LoginCommandResponse>.Failed("Mã captcha đã hết hạn. Vui lòng lấy mã captcha mới.", 400);
                }

                if (!string.Equals(cachedCaptcha, loginDto.CaptchaCode.Trim(), StringComparison.OrdinalIgnoreCase))
                {
                    return OperationResult<LoginCommandResponse>.Failed("Mã captcha không chính xác.", 400);
                }

                // Remove used captcha
                _cache.Remove(captchaKey);
            }

            var user = await _authService.GetUserByUsernameAsync(loginDto.Username);
            if (user == null)
            {
                failedCount++;
                _cache.Set(failedKey, failedCount, TimeSpan.FromMinutes(15));
                return OperationResult<LoginCommandResponse>.Failed("Tài khoản không tồn tại.", 401);
            }

            if (!_authService.VerifyPassword(loginDto.Password, user.PasswordHash))
            {
                failedCount++;
                _cache.Set(failedKey, failedCount, TimeSpan.FromMinutes(15));
                return OperationResult<LoginCommandResponse>.Failed("Mật khẩu không đúng.", 401);
            }

            // Success: clear failed count
            _cache.Remove(failedKey);

            _currentUserService.SetCurrentUser(user.UserID, user.UserCode, user.Role);

            var accessToken = _jwtTokenService.GenerateToken(user);
            var expiresAt = _jwtTokenService.GetTokenExpiryUtc();

            var data = new LoginResponseDto(user.UserID, user.UserCode, user.Role, user.CreatedAt);
            var response = new LoginCommandResponse(
                user.UserCode,
                user.Role,
                accessToken,
                "Bearer",
                expiresAt,
                data);

            return OperationResult<LoginCommandResponse>.Succeeded(response);
        }
    }
}
