using System.Collections.Concurrent;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using ThesisManagement.Api.Models;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Hubs
{
    [Authorize]
    public class DefenseHub : Hub
    {
        private readonly IUnitOfWork _uow;
        private readonly ISystemActivityLogger _systemActivityLogger;

        private static readonly ConcurrentDictionary<string, (int CommitteeId, string UserCode, int UserId, string UserRole)> _activeConnections =
            new ConcurrentDictionary<string, (int CommitteeId, string UserCode, int UserId, string UserRole)>();

        public DefenseHub(IUnitOfWork uow, ISystemActivityLogger systemActivityLogger)
        {
            _uow = uow;
            _systemActivityLogger = systemActivityLogger;
        }

        public static string CommitteeGroup(int committeeId) => $"defense-committee-{committeeId}";

        private string? GetUserCode()
        {
            var claim = Context.User?.FindFirst("userCode")
                        ?? Context.User?.FindFirst(ClaimTypes.Name)
                        ?? Context.User?.FindFirst(ClaimTypes.NameIdentifier);
            return claim?.Value;
        }

        private int? GetUserId()
        {
            var claim = Context.User?.FindFirst(ClaimTypes.NameIdentifier);
            if (claim != null && int.TryParse(claim.Value, out var userId))
            {
                return userId;
            }
            return null;
        }

        private string? GetUserRole()
        {
            return Context.User?.FindFirst(ClaimTypes.Role)?.Value;
        }

        public async Task JoinCommittee(int committeeId)
        {
            if (committeeId <= 0)
            {
                return;
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, CommitteeGroup(committeeId));

            var userCode = GetUserCode();
            var userIdVal = GetUserId() ?? 0;
            var userRoleVal = GetUserRole() ?? "Lecturer";
            if (!string.IsNullOrWhiteSpace(userCode))
            {
                _activeConnections[Context.ConnectionId] = (committeeId, userCode, userIdVal, userRoleVal);

                // Broadcast online status to the group
                await Clients.Group(CommitteeGroup(committeeId)).SendAsync("MemberOnlineStatusChanged", new
                {
                    committeeId = committeeId,
                    lecturerCode = userCode,
                    status = "ONLINE"
                });

                // Write log to DB
                var logDetails = System.Text.Json.JsonSerializer.Serialize(new
                {
                    ActionType = "ENTER_ROOM",
                    Details = new { CommitteeId = committeeId, ConnectionId = Context.ConnectionId },
                    Actor = new { UserCode = userCode }
                });

                await _uow.SyncAuditLogs.AddAsync(new SyncAuditLog
                {
                    Action = "LECTURER_ENTER_ROOM",
                    Result = "SUCCESS",
                    Records = logDetails,
                    Timestamp = DateTime.UtcNow
                });
                await _uow.SaveChangesAsync();

                // Write main activity log
                try
                {
                    var committee = await _uow.Committees.GetByIdAsync(committeeId);
                    var committeeCode = committee?.CommitteeCode ?? $"#{committeeId}";
                    var committeeName = committee?.Name ?? committeeCode;

                    await _systemActivityLogger.WriteLogAsync(
                        entityName: "Committee",
                        entityId: committeeId.ToString(),
                        actionType: "ENTER_ROOM",
                        actionDescription: $"Giảng viên {userCode} vào phòng hội đồng {committeeName}",
                        actorUserId: userIdVal > 0 ? userIdVal : null,
                        module: "Committee",
                        status: "SUCCESS",
                        relatedRecordCode: committeeCode,
                        comment: $"Vào phòng hội đồng. ConnectionId: {Context.ConnectionId}"
                    );
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[DefenseHub ENTER ERROR] {ex.Message}\n{ex.StackTrace}");
                    if (ex.InnerException != null)
                    {
                        Console.Error.WriteLine($"[DefenseHub ENTER INNER ERROR] {ex.InnerException.Message}");
                    }
                }
            }
        }

        public async Task LeaveCommittee(int committeeId)
        {
            if (committeeId <= 0)
            {
                return;
            }

            await Groups.RemoveFromGroupAsync(Context.ConnectionId, CommitteeGroup(committeeId));

            if (_activeConnections.TryRemove(Context.ConnectionId, out var connectionInfo))
            {
                string userCode = connectionInfo.UserCode;
                int userId = connectionInfo.UserId;
                string userRole = connectionInfo.UserRole;

                // Check if there are other connections of the same user in this committee
                bool stillConnected = _activeConnections.Values.Any(x => x.CommitteeId == committeeId && x.UserCode == userCode);
                if (!stillConnected)
                {
                    await Clients.Group(CommitteeGroup(committeeId)).SendAsync("MemberOnlineStatusChanged", new
                    {
                        committeeId = committeeId,
                        lecturerCode = userCode,
                        status = "OFFLINE"
                    });
                }

                // Write log to DB
                var logDetails = System.Text.Json.JsonSerializer.Serialize(new
                {
                    ActionType = "LEAVE_ROOM",
                    Details = new { CommitteeId = committeeId, ConnectionId = Context.ConnectionId },
                    Actor = new { UserCode = userCode }
                });

                await _uow.SyncAuditLogs.AddAsync(new SyncAuditLog
                {
                    Action = "LECTURER_LEAVE_ROOM",
                    Result = "SUCCESS",
                    Records = logDetails,
                    Timestamp = DateTime.UtcNow
                });
                await _uow.SaveChangesAsync();

                // Write main activity log
                try
                {
                    var committee = await _uow.Committees.GetByIdAsync(committeeId);
                    var committeeCode = committee?.CommitteeCode ?? $"#{committeeId}";
                    var committeeName = committee?.Name ?? committeeCode;

                    await _systemActivityLogger.WriteLogAsync(
                        entityName: "Committee",
                        entityId: committeeId.ToString(),
                        actionType: "LEAVE_ROOM",
                        actionDescription: $"Giảng viên {userCode} thoát phòng hội đồng {committeeName}",
                        actorUserId: userId > 0 ? userId : null,
                        module: "Committee",
                        status: "SUCCESS",
                        relatedRecordCode: committeeCode,
                        comment: $"Rời phòng hội đồng. ConnectionId: {Context.ConnectionId}"
                    );
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[DefenseHub LEAVE ERROR] {ex.Message}\n{ex.StackTrace}");
                    if (ex.InnerException != null)
                    {
                        Console.Error.WriteLine($"[DefenseHub LEAVE INNER ERROR] {ex.InnerException.Message}");
                    }
                }
            }
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            if (_activeConnections.TryRemove(Context.ConnectionId, out var connectionInfo))
            {
                int committeeId = connectionInfo.CommitteeId;
                string userCode = connectionInfo.UserCode;
                int userId = connectionInfo.UserId;
                string userRole = connectionInfo.UserRole;

                bool stillConnected = _activeConnections.Values.Any(x => x.CommitteeId == committeeId && x.UserCode == userCode);
                if (!stillConnected)
                {
                    await Clients.Group(CommitteeGroup(committeeId)).SendAsync("MemberOnlineStatusChanged", new
                    {
                        committeeId = committeeId,
                        lecturerCode = userCode,
                        status = "OFFLINE"
                    });
                }

                // Write log to DB
                var logDetails = System.Text.Json.JsonSerializer.Serialize(new
                {
                    ActionType = "DISCONNECT_LEAVE_ROOM",
                    Details = new { CommitteeId = committeeId, ConnectionId = Context.ConnectionId, Error = exception?.Message },
                    Actor = new { UserCode = userCode }
                });

                await _uow.SyncAuditLogs.AddAsync(new SyncAuditLog
                {
                    Action = "LECTURER_DISCONNECT_LEAVE_ROOM",
                    Result = "SUCCESS",
                    Records = logDetails,
                    Timestamp = DateTime.UtcNow
                });
                await _uow.SaveChangesAsync();

                // Write main activity log
                try
                {
                    var committee = await _uow.Committees.GetByIdAsync(committeeId);
                    var committeeCode = committee?.CommitteeCode ?? $"#{committeeId}";
                    var committeeName = committee?.Name ?? committeeCode;

                    await _systemActivityLogger.WriteLogAsync(
                        entityName: "Committee",
                        entityId: committeeId.ToString(),
                        actionType: "LEAVE_ROOM",
                        actionDescription: $"Giảng viên {userCode} mất kết nối/thoát phòng hội đồng {committeeName}",
                        actorUserId: userId > 0 ? userId : null,
                        module: "Committee",
                        status: "SUCCESS",
                        relatedRecordCode: committeeCode,
                        comment: $"Mất kết nối/Thoát phòng. ConnectionId: {Context.ConnectionId}. Lỗi: {exception?.Message}"
                    );
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[DefenseHub DISCONNECT ERROR] {ex.Message}\n{ex.StackTrace}");
                    if (ex.InnerException != null)
                    {
                        Console.Error.WriteLine($"[DefenseHub DISCONNECT INNER ERROR] {ex.InnerException.Message}");
                    }
                }
            }

            await base.OnDisconnectedAsync(exception);
        }

        public Task<List<string>> GetOnlineMembers(int committeeId)
        {
            var onlineUsers = _activeConnections.Values
                .Where(x => x.CommitteeId == committeeId)
                .Select(x => x.UserCode)
                .Distinct()
                .ToList();
            return Task.FromResult(onlineUsers);
        }
    }
}
