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

        private static readonly ConcurrentDictionary<string, (int CommitteeId, string UserCode)> _activeConnections =
            new ConcurrentDictionary<string, (int CommitteeId, string UserCode)>();

        public DefenseHub(IUnitOfWork uow)
        {
            _uow = uow;
        }

        public static string CommitteeGroup(int committeeId) => $"defense-committee-{committeeId}";

        private string? GetUserCode()
        {
            var claim = Context.User?.FindFirst("userCode")
                        ?? Context.User?.FindFirst(ClaimTypes.Name)
                        ?? Context.User?.FindFirst(ClaimTypes.NameIdentifier);
            return claim?.Value;
        }

        public async Task JoinCommittee(int committeeId)
        {
            if (committeeId <= 0)
            {
                return;
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, CommitteeGroup(committeeId));

            var userCode = GetUserCode();
            if (!string.IsNullOrWhiteSpace(userCode))
            {
                _activeConnections[Context.ConnectionId] = (committeeId, userCode);

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
            }
        }

        public async Task LeaveCommittee(int committeeId)
        {
            if (committeeId <= 0)
            {
                return;
            }

            await Groups.RemoveFromGroupAsync(Context.ConnectionId, CommitteeGroup(committeeId));

            var userCode = GetUserCode();
            if (!string.IsNullOrWhiteSpace(userCode))
            {
                _activeConnections.TryRemove(Context.ConnectionId, out _);

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
            }
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            if (_activeConnections.TryRemove(Context.ConnectionId, out var connectionInfo))
            {
                int committeeId = connectionInfo.CommitteeId;
                string userCode = connectionInfo.UserCode;

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
