using System.Linq;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using ThesisManagement.Api.Application.Command.Notifications;
using ThesisManagement.Api.Application.Query.Notifications;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.DTOs.Notifications.Command;
using ThesisManagement.Api.DTOs.Notifications.Query;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Controllers
{
    public class NotificationsController : BaseApiController
    {
        private readonly IGetMyNotificationsListQuery _getMyNotificationsListQuery;
        private readonly IGetMyUnreadCountQuery _getMyUnreadCountQuery;
        private readonly IGetMyNotificationPreferencesQuery _getMyNotificationPreferencesQuery;
        private readonly ICreateNotificationCommand _createNotificationCommand;
        private readonly IMarkNotificationReadCommand _markNotificationReadCommand;
        private readonly IMarkAllNotificationsReadCommand _markAllNotificationsReadCommand;
        private readonly IUpdateMyNotificationPreferenceCommand _updateMyNotificationPreferenceCommand;

        public NotificationsController(
            IUnitOfWork uow,
            ICodeGenerator codeGen,
            IMapper mapper,
            IGetMyNotificationsListQuery getMyNotificationsListQuery,
            IGetMyUnreadCountQuery getMyUnreadCountQuery,
            IGetMyNotificationPreferencesQuery getMyNotificationPreferencesQuery,
            ICreateNotificationCommand createNotificationCommand,
            IMarkNotificationReadCommand markNotificationReadCommand,
            IMarkAllNotificationsReadCommand markAllNotificationsReadCommand,
            IUpdateMyNotificationPreferenceCommand updateMyNotificationPreferenceCommand) : base(uow, codeGen, mapper)
        {
            _getMyNotificationsListQuery = getMyNotificationsListQuery;
            _getMyUnreadCountQuery = getMyUnreadCountQuery;
            _getMyNotificationPreferencesQuery = getMyNotificationPreferencesQuery;
            _createNotificationCommand = createNotificationCommand;
            _markNotificationReadCommand = markNotificationReadCommand;
            _markAllNotificationsReadCommand = markAllNotificationsReadCommand;
            _updateMyNotificationPreferenceCommand = updateMyNotificationPreferenceCommand;
        }

        [HttpGet("my")]
        public async Task<IActionResult> GetMy([FromQuery] NotificationFilter filter)
        {
            var result = await _getMyNotificationsListQuery.ExecuteAsync(filter);
            return Ok(ApiResponse<IEnumerable<NotificationRecipientReadDto>>.SuccessResponse(result.Items, result.TotalCount));
        }

        [HttpGet("my/unread-count")]
        public async Task<IActionResult> GetMyUnreadCount()
        {
            var dto = await _getMyUnreadCountQuery.ExecuteAsync();
            return Ok(ApiResponse<NotificationUnreadCountDto>.SuccessResponse(dto));
        }

        [HttpPut("my/{recipientId:int}/read")]
        public async Task<IActionResult> MarkRead(int recipientId)
        {
            var result = await _markNotificationReadCommand.ExecuteAsync(new MarkReadDto(recipientId));
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return Ok(ApiResponse<NotificationUnreadCountDto>.SuccessResponse(result.Data));
        }

        [HttpPut("my/read-all")]
        public async Task<IActionResult> MarkReadAll([FromBody] MarkReadAllDto dto)
        {
            var result = await _markAllNotificationsReadCommand.ExecuteAsync(dto);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return Ok(ApiResponse<NotificationUnreadCountDto>.SuccessResponse(result.Data));
        }

        [HttpGet("preferences/my")]
        public async Task<IActionResult> GetMyPreferences([FromQuery] NotificationPreferenceFilter filter)
        {
            var items = await _getMyNotificationPreferencesQuery.ExecuteAsync(filter);
            return Ok(ApiResponse<IEnumerable<NotificationPreferenceReadDto>>.SuccessResponse(items, items.Count()));
        }

        [HttpPut("preferences/my/{notifCategory}")]
        public async Task<IActionResult> UpdateMyPreference(string notifCategory, [FromBody] UpdateNotificationPreferenceDto dto)
        {
            var result = await _updateMyNotificationPreferenceCommand.ExecuteAsync(notifCategory, dto);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return Ok(ApiResponse<NotificationPreferenceReadDto>.SuccessResponse(result.Data));
        }

        [HttpPost("create")]
        public async Task<IActionResult> Create([FromBody] CreateNotificationDto dto)
        {
            var result = await _createNotificationCommand.ExecuteAsync(dto);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return StatusCode(result.StatusCode, ApiResponse<NotificationRecipientReadDto>.SuccessResponse(result.Data, 1, result.StatusCode));
        }

        [HttpPost("system-alerts/scan")]
        public async Task<IActionResult> ScanSystemAlerts([FromQuery] int periodId)
        {
            var adminSecUserCodes = await _uow.Users.Query()
                .Where(x => x.Role == "Admin" || x.Role == "Secretary")
                .Select(x => x.UserCode)
                .ToListAsync();

            if (adminSecUserCodes.Count == 0)
            {
                return Ok(ApiResponse<object>.SuccessResponse(new { message = "Không tìm thấy quản trị viên hoặc giáo vụ để nhận cảnh báo." }));
            }

            var alertsCreated = new List<string>();

            // Helper method to clear old alerts of the same category for target users to prevent duplicate spam
            async Task ClearOldAlertsAsync(string category, List<string> targetCodes)
            {
                var oldRecipients = await _uow.NotificationRecipients.Query()
                    .Include(x => x.Notification)
                    .Where(x => x.Notification != null && 
                                x.Notification.NotifCategory == category && 
                                targetCodes.Contains(x.TargetUserCode))
                    .ToListAsync();

                if (oldRecipients.Count > 0)
                {
                    foreach (var rec in oldRecipients)
                    {
                        _uow.NotificationRecipients.Remove(rec);
                    }
                    await _uow.SaveChangesAsync();
                }
            }

            // 1. Phân công (Assignment)
            var unassignedSupervisors = await _uow.Topics.Query()
                .Where(x => x.DefenseTermId == periodId && string.IsNullOrEmpty(x.SupervisorLecturerCode))
                .CountAsync();
            if (unassignedSupervisors > 0)
            {
                await ClearOldAlertsAsync("Assignment", adminSecUserCodes);
                var dto = new CreateNotificationDto(
                    NotifCategory: "Assignment",
                    NotifTitle: "Cảnh báo phân công hướng dẫn",
                    NotifBody: $"Có {unassignedSupervisors} đề tài chưa được phân công giảng viên hướng dẫn.",
                    NotifPriority: "HIGH",
                    ActionType: null,
                    ActionUrl: $"/admin/committees/operations?tab=lifecycle",
                    ImageUrl: null,
                    RelatedEntityName: null,
                    RelatedEntityCode: null,
                    RelatedEntityID: null,
                    IsGlobal: false,
                    TargetUserCodes: adminSecUserCodes,
                    NotifChannel: "IN_APP"
                );
                await _createNotificationCommand.ExecuteAsync(dto);
                alertsCreated.Add("Assignment");
            }

            // 2. Đăng ký (Registration)
            var pendingTopics = await _uow.Topics.Query()
                .Where(x => x.DefenseTermId == periodId && (x.Status == "Pending" || x.Status == "Submitted"))
                .CountAsync();
            if (pendingTopics > 0)
            {
                await ClearOldAlertsAsync("Registration", adminSecUserCodes);
                var dto = new CreateNotificationDto(
                    NotifCategory: "Registration",
                    NotifTitle: "Cảnh báo duyệt đề tài đăng ký",
                    NotifBody: $"Có {pendingTopics} đề tài đăng ký đang ở trạng thái chờ duyệt.",
                    NotifPriority: "HIGH",
                    ActionType: null,
                    ActionUrl: $"/admin/topic-review",
                    ImageUrl: null,
                    RelatedEntityName: null,
                    RelatedEntityCode: null,
                    RelatedEntityID: null,
                    IsGlobal: false,
                    TargetUserCodes: adminSecUserCodes,
                    NotifChannel: "IN_APP"
                );
                await _createNotificationCommand.ExecuteAsync(dto);
                alertsCreated.Add("Registration");
            }

            // 3. Tiến độ (Progress)
            var today = DateTime.UtcNow;
            var overdueMilestones = await _uow.ProgressMilestones.Query()
                .Where(x => x.MilestoneTemplate != null && x.MilestoneTemplate.DefenseTermId == periodId && x.MilestoneTemplate.Deadline < today && x.State != "Hoàn thành")
                .CountAsync();
            if (overdueMilestones > 0)
            {
                await ClearOldAlertsAsync("Progress", adminSecUserCodes);
                var dto = new CreateNotificationDto(
                    NotifCategory: "Progress",
                    NotifTitle: "Cảnh báo chậm trễ tiến độ",
                    NotifBody: $"Có {overdueMilestones} mốc tiến độ nộp bài đã quá hạn nộp nhưng chưa hoàn thành.",
                    NotifPriority: "HIGH",
                    ActionType: null,
                    ActionUrl: $"/admin/committees/operations?tab=lifecycle",
                    ImageUrl: null,
                    RelatedEntityName: null,
                    RelatedEntityCode: null,
                    RelatedEntityID: null,
                    IsGlobal: false,
                    TargetUserCodes: adminSecUserCodes,
                    NotifChannel: "IN_APP"
                );
                await _createNotificationCommand.ExecuteAsync(dto);
                alertsCreated.Add("Progress");
            }

            // 4. Điều hành hội đồng (Committee Operations)
            var todayDate = DateTime.UtcNow.Date;
            var overdueCommittees = await _uow.Committees.Query()
                .Where(x => x.DefenseTermId == periodId &&
                            x.DefenseDate.HasValue &&
                            x.DefenseDate.Value < todayDate &&
                            x.Status != "LOCKED" &&
                            x.Status != "COMPLETED" &&
                            x.Status != "FINALIZED" &&
                            x.Status != "PUBLISHED")
                .CountAsync();

            if (overdueCommittees > 0)
            {
                await ClearOldAlertsAsync("Committee", adminSecUserCodes);
                var dto = new CreateNotificationDto(
                    NotifCategory: "Committee",
                    NotifTitle: "Cảnh báo hội đồng quá ngày chưa đóng phiên",
                    NotifBody: $"Có {overdueCommittees} hội đồng quá hạn bảo vệ nhưng chưa chốt điểm hoặc chưa đóng phiên.",
                    NotifPriority: "HIGH",
                    ActionType: null,
                    ActionUrl: $"/admin/committees/operations?tab=lifecycle",
                    ImageUrl: null,
                    RelatedEntityName: null,
                    RelatedEntityCode: null,
                    RelatedEntityID: null,
                    IsGlobal: false,
                    TargetUserCodes: adminSecUserCodes,
                    NotifChannel: "IN_APP"
                );
                await _createNotificationCommand.ExecuteAsync(dto);
                alertsCreated.Add("Committee");
            }

            // 5. Điều hành chấm điểm (Grading Operations)
            var termScores = await _uow.DefenseScores.Query()
                .Where(x => x.IsSubmitted == true)
                .Join(_uow.DefenseAssignments.Query().Where(da => da.DefenseTermId == periodId),
                      ds => ds.AssignmentCode,
                      da => da.AssignmentCode,
                      (ds, da) => new { da.AssignmentCode, ds.Score })
                .ToListAsync();

            var highVarianceCount = termScores
                .GroupBy(x => x.AssignmentCode)
                .Select(g => new { Scores = g.Select(s => s.Score).ToList() })
                .Where(g => g.Scores.Count >= 2 && (g.Scores.Max() - g.Scores.Min() >= 2.0m))
                .Count();

            if (highVarianceCount > 0)
            {
                await ClearOldAlertsAsync("Grading", adminSecUserCodes);
                var dto = new CreateNotificationDto(
                    NotifCategory: "Grading",
                    NotifTitle: "Cảnh báo lệch điểm chấm thi",
                    NotifBody: $"Có {highVarianceCount} đề tài có độ lệch điểm chấm giữa các thành viên hội đồng >= 2.0.",
                    NotifPriority: "URGENT",
                    ActionType: null,
                    ActionUrl: $"/admin/committees/operations?tab=scoring",
                    ImageUrl: null,
                    RelatedEntityName: null,
                    RelatedEntityCode: null,
                    RelatedEntityID: null,
                    IsGlobal: false,
                    TargetUserCodes: adminSecUserCodes,
                    NotifChannel: "IN_APP"
                );
                await _createNotificationCommand.ExecuteAsync(dto);
                alertsCreated.Add("Grading");
            }

            // 6. Điều hành hậu bảo vệ (Post-Defense Operations)
            var termRevisions = await _uow.DefenseRevisions.Query()
                .Include(x => x.Assignment)
                    .ThenInclude(a => a != null ? a.Topic : null)
                .Where(x => x.Status == Models.RevisionStatus.StudentSubmitted &&
                            x.Assignment != null &&
                            x.Assignment.DefenseTermId == periodId)
                .ToListAsync();

            var pendingRevisionsCount = termRevisions.Count;
            if (pendingRevisionsCount > 0)
            {
                var supervisorCodes = termRevisions
                    .Select(x => x.Assignment?.Topic?.SupervisorLecturerCode)
                    .Where(c => !string.IsNullOrEmpty(c))
                    .Distinct()
                    .ToList();

                var postDefenseTargetUserCodes = adminSecUserCodes.Concat(supervisorCodes).Where(x => x != null).Select(x => x!).Distinct().ToList();

                await ClearOldAlertsAsync("PostDefense", postDefenseTargetUserCodes);
                var dto = new CreateNotificationDto(
                    NotifCategory: "PostDefense",
                    NotifTitle: "Cảnh báo sửa bài hậu bảo vệ",
                    NotifBody: $"Có {pendingRevisionsCount} bản sửa bài hậu bảo vệ của sinh viên đang chờ phê duyệt.",
                    NotifPriority: "HIGH",
                    ActionType: null,
                    ActionUrl: $"/admin/committees/operations?tab=post-defense",
                    ImageUrl: null,
                    RelatedEntityName: null,
                    RelatedEntityCode: null,
                    RelatedEntityID: null,
                    IsGlobal: false,
                    TargetUserCodes: postDefenseTargetUserCodes,
                    NotifChannel: "IN_APP"
                );
                await _createNotificationCommand.ExecuteAsync(dto);
                alertsCreated.Add("PostDefense");
            }

            return Ok(ApiResponse<object>.SuccessResponse(new
            {
                message = "Đã quét và phát hành cảnh báo thành công.",
                alertsCreated = alertsCreated
            }));
        }
    }
}
