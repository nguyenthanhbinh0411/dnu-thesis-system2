using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.Data;
using ThesisManagement.Api.Models;

namespace ThesisManagement.Api.Services
{
    public class SystemActivityLogger : ISystemActivityLogger
    {
        private readonly ApplicationDbContext _db;
        private readonly ICurrentUserService _currentUserService;

        public SystemActivityLogger(ApplicationDbContext db, ICurrentUserService currentUserService)
        {
            _db = db;
            _currentUserService = currentUserService;
        }

        public async Task WriteLogAsync(
            string? entityName,
            string? entityId,
            string actionType,
            string? actionDescription,
            int? actorUserId,
            string? module = null,
            string? status = "SUCCESS",
            string? relatedRecordCode = null,
            string? comment = null,
            string? oldValue = null,
            string? newValue = null,
            CancellationToken cancellationToken = default)
        {
            try
            {
                string? userCode = null;
                string? userRole = null;

                if (actorUserId.HasValue && actorUserId.Value > 0)
                {
                    var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserID == actorUserId.Value, cancellationToken);
                    if (user != null)
                    {
                        userCode = user.UserCode;
                        userRole = user.Role;
                    }
                }

                if (string.IsNullOrEmpty(userCode))
                {
                    userCode = _currentUserService.GetUserCode() ?? "System";
                }
                if (string.IsNullOrEmpty(userRole))
                {
                    userRole = _currentUserService.GetUserRole() ?? "System";
                }

                var log = new SystemActivityLog
                {
                    EntityName = entityName,
                    EntityID = entityId,
                    ActionType = actionType,
                    ActionDescription = actionDescription,
                    UserID = actorUserId ?? _currentUserService.GetUserId(),
                    UserCode = userCode,
                    UserRole = userRole,
                    IPAddress = _currentUserService.GetIpAddress(),
                    DeviceInfo = _currentUserService.GetDeviceInfo(),
                    Module = module,
                    PerformedAt = DateTime.UtcNow,
                    Status = status,
                    RelatedRecordCode = relatedRecordCode,
                    Comment = comment,
                    OldValue = oldValue,
                    NewValue = newValue
                };

                await _db.SystemActivityLogs.AddAsync(log, cancellationToken);
                await _db.SaveChangesAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[SystemActivityLogger ERROR] {ex.Message}\n{ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    Console.Error.WriteLine($"[SystemActivityLogger INNER ERROR] {ex.InnerException.Message}");
                }
            }
        }
    }
}
