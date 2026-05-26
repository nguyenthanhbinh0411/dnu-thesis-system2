using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using ThesisManagement.Api.Application.Command.Auth;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.DTOs.Users.Command;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Controllers
{
    public class AuthController : BaseApiController
    {
        private readonly ILoginCommand _loginCommand;
        private readonly IResetPasswordCommand _resetPasswordCommand;
        private readonly IResetDefaultPasswordCommand _resetDefaultPasswordCommand;
        private readonly IForgotPasswordCommand _forgotPasswordCommand;
        private readonly IVerifyOtpResetCommand _verifyOtpResetCommand;
        private readonly IMemoryCache _cache;

        public AuthController(
            IUnitOfWork uow,
            ICodeGenerator codeGen,
            IMapper mapper,
            ILoginCommand loginCommand,
            IResetPasswordCommand resetPasswordCommand,
            IResetDefaultPasswordCommand resetDefaultPasswordCommand,
            IForgotPasswordCommand forgotPasswordCommand,
            IVerifyOtpResetCommand verifyOtpResetCommand,
            IMemoryCache cache)
            : base(uow, codeGen, mapper)
        {
            _loginCommand = loginCommand;
            _resetPasswordCommand = resetPasswordCommand;
            _resetDefaultPasswordCommand = resetDefaultPasswordCommand;
            _forgotPasswordCommand = forgotPasswordCommand;
            _verifyOtpResetCommand = verifyOtpResetCommand;
            _cache = cache;
        }

        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login([FromBody] LoginDto loginDto)
        {
            var result = await _loginCommand.ExecuteAsync(loginDto);
            if (!result.Success)
            {
                var username = loginDto.Username?.Trim().ToLower() ?? "";
                _cache.TryGetValue($"failed_login_{username}", out int failedCount);
                var isCaptchaRequired = failedCount >= 3;

                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(
                    result.ErrorMessage ?? "Request failed", 
                    result.StatusCode,
                    code: isCaptchaRequired ? "REQUIRES_CAPTCHA" : null));
            }

            return Ok(new
            {
                success = true,
                userCode = result.Data!.UserCode,
                role = result.Data.Role,
                accessToken = result.Data.AccessToken,
                tokenType = result.Data.TokenType,
                expiresAt = result.Data.ExpiresAt,
                data = result.Data.Data
            });
        }

        [HttpPost("reset-password")]
        [Authorize]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
        {
            var result = await _resetPasswordCommand.ExecuteAsync(dto);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return Ok(ApiResponse<object>.SuccessResponse(result.Data));
        }

        [HttpPost("reset-password-default")]
        [Authorize]
        public async Task<IActionResult> ResetPasswordDefault([FromBody] ResetDefaultPasswordDto dto)
        {
            var result = await _resetDefaultPasswordCommand.ExecuteAsync(dto);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return Ok(ApiResponse<object>.SuccessResponse(result.Data));
        }

        [HttpPost("forgot-password")]
        [AllowAnonymous]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
        {
            var result = await _forgotPasswordCommand.ExecuteAsync(dto);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return Ok(ApiResponse<object>.SuccessResponse(result.Data));
        }

        [HttpPost("verify-otp-reset")]
        [AllowAnonymous]
        public async Task<IActionResult> VerifyOtpReset([FromBody] VerifyOtpResetDto dto)
        {
            var result = await _verifyOtpResetCommand.ExecuteAsync(dto);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return Ok(ApiResponse<object>.SuccessResponse(result.Data));
        }

        [HttpGet("captcha")]
        [AllowAnonymous]
        public IActionResult GetCaptcha()
        {
            var sessionId = Guid.NewGuid().ToString("N");
            
            // Generate a random 4-character alphanumeric code
            var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // exclude confusing chars like O, 0, I, 1
            var random = new Random();
            var code = new string(Enumerable.Repeat(chars, 4)
                .Select(s => s[random.Next(s.Length)]).ToArray());

            // Cache it for 5 minutes
            _cache.Set($"captcha_{sessionId}", code, TimeSpan.FromMinutes(5));

            // Generate the SVG captcha image
            var width = 120;
            var height = 40;
            var svg = $"<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{height}' viewBox='0 0 {width} {height}'>";
            svg += "<rect width='100%' height='100%' fill='#F3F4F6'/>";
            
            // Noise lines
            for (int i = 0; i < 4; i++)
            {
                var x1 = random.Next(width);
                var y1 = random.Next(height);
                var x2 = random.Next(width);
                var y2 = random.Next(height);
                svg += $"<line x1='{x1}' y1='{y1}' x2='{x2}' y2='{y2}' stroke='rgba(243,112,33,0.15)' stroke-width='2'/>";
            }

            // Noise circles
            for (int i = 0; i < 5; i++)
            {
                var cx = random.Next(width);
                var cy = random.Next(height);
                var r = random.Next(2, 5);
                svg += $"<circle cx='{cx}' cy='{cy}' r='{r}' fill='rgba(0,40,85,0.1)'/>";
            }

            // Distorted Text
            for (int i = 0; i < code.Length; i++)
            {
                var character = code[i];
                var x = 15 + i * 24 + random.Next(-3, 3);
                var y = 28 + random.Next(-3, 3);
                var angle = random.Next(-15, 15);
                svg += $"<text x='{x}' y='{y}' fill='#002855' font-size='24' font-weight='bold' font-family='Courier New, monospace' transform='rotate({angle} {x} {y})'>{character}</text>";
            }
            svg += "</svg>";

            var bytes = System.Text.Encoding.UTF8.GetBytes(svg);
            var base64Svg = Convert.ToBase64String(bytes);
            var captchaImage = $"data:image/svg+xml;base64,{base64Svg}";

            return Ok(ApiResponse<object>.SuccessResponse(new
            {
                CaptchaSessionId = sessionId,
                CaptchaImage = captchaImage
            }));
        }
    }
}
