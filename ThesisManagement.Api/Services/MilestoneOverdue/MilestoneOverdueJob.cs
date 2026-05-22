using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ThesisManagement.Api.Application.Command.Notifications;
using ThesisManagement.Api.Data;
using ThesisManagement.Api.DTOs.Notifications.Command;
using ThesisManagement.Api.Models;

namespace ThesisManagement.Api.Services.MilestoneOverdue
{
    /// <summary>
    /// Background job chạy hàng ngày để phát hiện mốc tiến độ quá hạn và đánh dấu FAILED.
    /// Cũng gửi thông báo nhắc nhở khi deadline sắp đến.
    /// </summary>
    public class MilestoneOverdueJob : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<MilestoneOverdueJob> _logger;
        private readonly MilestoneOverdueOptions _options;

        // Các trạng thái topic bị hủy — không xử lý overdue cho các topic này
        private static readonly HashSet<string> SkippedTopicStatuses = new(StringComparer.OrdinalIgnoreCase)
        {
            "Từ chối", "Hủy", "Đã hủy", "Rejected", "Cancelled", "Canceled"
        };

        // Trạng thái milestone đã kết thúc — không cần xử lý nữa
        private static readonly HashSet<string> TerminalMilestoneStates = new(StringComparer.OrdinalIgnoreCase)
        {
            "Completed", "FAILED", "EXEMPTED"
        };

        public MilestoneOverdueJob(
            IServiceScopeFactory scopeFactory,
            ILogger<MilestoneOverdueJob> logger,
            IOptions<MilestoneOverdueOptions> options)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
            _options = options.Value;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("[MilestoneOverdueJob] Background job started. GracePeriodDays={GracePeriod}", _options.GracePeriodDays);

            while (!stoppingToken.IsCancellationRequested)
            {
                // Tính thời gian chờ đến lần chạy tiếp theo: 01:00 sáng hàng ngày
                var now = DateTime.Now;
                var nextRun = now.Date.AddDays(1).AddHours(1); // 01:00 sáng ngày mai
                var delay = nextRun - now;

                // Lần đầu chạy: nếu chưa đến 01:00 sáng thì đợi đến lúc đó
                // Nhưng trong môi trường dev, chạy ngay sau 5 giây để dễ test
                if (delay.TotalHours > 23)
                    delay = TimeSpan.FromSeconds(5); // lần đầu tiên chạy sau 5 giây

                _logger.LogInformation("[MilestoneOverdueJob] Next run in {Minutes} minutes at {NextRun:HH:mm dd/MM/yyyy}",
                    (int)delay.TotalMinutes, nextRun);

                try
                {
                    await Task.Delay(delay, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }

                await RunCheckAsync(stoppingToken);

                // Sau lần đầu chạy ngay, reset về cycle 24h
                delay = TimeSpan.FromHours(24);
            }

            _logger.LogInformation("[MilestoneOverdueJob] Background job stopped.");
        }

        /// <summary>
        /// Thực thi một lần kiểm tra toàn bộ milestone quá hạn.
        /// </summary>
        public async Task RunCheckAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("[MilestoneOverdueJob] Starting overdue check at {Time:HH:mm:ss dd/MM/yyyy}", DateTime.Now);

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var notificationPublisher = scope.ServiceProvider.GetRequiredService<INotificationEventPublisher>();

            var graceCutoff = DateTime.UtcNow.AddDays(-_options.GracePeriodDays);

            // Lấy tất cả milestone chưa hoàn thành, đã quá deadline + grace period
            var overdueMilestones = await db.ProgressMilestones
                .Include(m => m.Topic)
                .Where(m =>
                    m.Deadline != null &&
                    m.Deadline < graceCutoff &&
                    m.State != null &&
                    !TerminalMilestoneStates.Contains(m.State) &&
                    m.Topic != null &&
                    !SkippedTopicStatuses.Contains(m.Topic.Status ?? ""))
                .ToListAsync(stoppingToken);

            _logger.LogInformation("[MilestoneOverdueJob] Found {Count} overdue milestone(s) to process.", overdueMilestones.Count);

            var processedCount = 0;
            var skippedPendingReview = 0;

            foreach (var milestone in overdueMilestones)
            {
                if (stoppingToken.IsCancellationRequested) break;

                // Kiểm tra CompletedAt của ordinal hiện tại
                var alreadyCompleted = IsCurrentOrdinalCompleted(milestone);
                if (alreadyCompleted)
                {
                    // Milestone đã hoàn thành nhưng State chưa cập nhật — tự sửa
                    milestone.State = "Completed";
                    db.ProgressMilestones.Update(milestone);
                    continue;
                }

                // Lấy submission mới nhất cho ordinal này
                var latestSubmission = await db.ProgressSubmissions
                    .Where(s =>
                        s.MilestoneID == milestone.MilestoneID &&
                        s.Ordinal == milestone.Ordinal)
                    .OrderByDescending(s => s.SubmittedAt)
                    .ThenByDescending(s => s.SubmissionID)
                    .FirstOrDefaultAsync(stoppingToken);

                string failureReason;

                if (latestSubmission == null)
                {
                    // Không có submission nào → sinh viên cố tình không nộp
                    failureReason = "ABSENT";
                }
                else
                {
                    var state = (latestSubmission.LecturerState ?? "").Trim().ToUpperInvariant();

                    if (state == "PENDING" || string.IsNullOrWhiteSpace(state))
                    {
                        // SV đã nộp nhưng GV chưa kịp duyệt → KHÔNG fail milestone
                        // Thay vào đó gửi nhắc nhở cho GV
                        await NotifyLecturerPendingReviewAsync(notificationPublisher, milestone, latestSubmission);
                        skippedPendingReview++;
                        continue;
                    }
                    else if (state is "REVISION_REQUIRED" or "REJECTED" or "NEEDS_REVISION")
                    {
                        // GV yêu cầu sửa, SV không sửa lại → bỏ sửa
                        failureReason = "ABANDONED_REVISION";
                    }
                    else
                    {
                        // Trạng thái khác (APPROVED đã được xử lý ở trên) — bỏ qua
                        continue;
                    }
                }

                // Đánh dấu milestone FAILED
                milestone.State = "FAILED";
                milestone.FailureReason = failureReason;
                milestone.FailedAt = DateTime.UtcNow;
                milestone.LastUpdated = DateTime.UtcNow;
                db.ProgressMilestones.Update(milestone);

                // Đánh dấu topic không đủ điều kiện bảo vệ
                if (milestone.Topic != null)
                {
                    var topic = milestone.Topic;
                    // Chỉ set nếu topic chưa bị hủy
                    if (!SkippedTopicStatuses.Contains(topic.Status ?? ""))
                    {
                        topic.Status = "Không đủ điều kiện bảo vệ";
                        topic.LastUpdated = DateTime.UtcNow;
                        db.Topics.Update(topic);
                    }
                }

                // Gửi thông báo cho sinh viên và giảng viên
                await NotifyMilestoneFailedAsync(notificationPublisher, milestone, failureReason);

                processedCount++;
                _logger.LogWarning(
                    "[MilestoneOverdueJob] Milestone {Code} (Ordinal={Ordinal}, Topic={TopicCode}) marked FAILED. Reason={Reason}",
                    milestone.MilestoneCode, milestone.Ordinal, milestone.TopicCode, failureReason);
            }

            await db.SaveChangesAsync(stoppingToken);

            _logger.LogInformation(
                "[MilestoneOverdueJob] Check complete. Marked FAILED: {Failed}, Skipped (pending review): {Skipped}",
                processedCount, skippedPendingReview);
        }

        // ─────────────────────────────────────────────────────────────────
        // Helpers
        // ─────────────────────────────────────────────────────────────────

        private static bool IsCurrentOrdinalCompleted(ProgressMilestone m)
        {
            return m.Ordinal switch
            {
                1 => m.CompletedAt1 != null,
                2 => m.CompletedAt2 != null,
                3 => m.CompletedAt3 != null,
                4 => m.CompletedAt4 != null,
                5 => m.CompletedAt5 != null,
                _ => false
            };
        }

        private async Task NotifyMilestoneFailedAsync(
            INotificationEventPublisher publisher,
            ProgressMilestone milestone,
            string failureReason)
        {
            if (milestone.Topic == null) return;

            var milestoneLabel = GetMilestoneLabel(milestone.Ordinal);
            var reasonText = failureReason == "ABSENT"
                ? "không nộp báo cáo trước deadline"
                : "không nộp lại báo cáo sau khi giảng viên yêu cầu sửa đổi";

            var body = $"Mốc tiến độ \"{milestoneLabel}\" của đề tài {milestone.TopicCode} đã bị đánh dấu THẤT BẠI do {reasonText}. "
                     + "Đề tài hiện không đủ điều kiện bảo vệ. "
                     + "Liên hệ giảng viên hướng dẫn để được xem xét.";

            // Thông báo cho sinh viên (qua ProposerUserCode của topic)
            var studentUserCode = milestone.Topic.ProposerUserCode;
            if (!string.IsNullOrWhiteSpace(studentUserCode))
            {
                await publisher.PublishAsync(new NotificationEventRequest(
                    NotifCategory: "MILESTONE_FAILED",
                    NotifTitle: $"⚠️ Mốc tiến độ thất bại: {milestoneLabel}",
                    NotifBody: body,
                    NotifPriority: "HIGH",
                    ActionType: "OPEN_PROGRESS",
                    ActionUrl: $"/progress/{milestone.TopicCode}",
                    RelatedEntityName: "PROGRESS_MILESTONE",
                    RelatedEntityCode: milestone.MilestoneCode,
                    RelatedEntityID: milestone.MilestoneID,
                    IsGlobal: false,
                    TargetUserCodes: new List<string> { studentUserCode }));
            }

            // Thông báo cho giảng viên hướng dẫn
            var lecturerUserCode = milestone.Topic.SupervisorUserCode;
            if (!string.IsNullOrWhiteSpace(lecturerUserCode))
            {
                await publisher.PublishAsync(new NotificationEventRequest(
                    NotifCategory: "MILESTONE_FAILED",
                    NotifTitle: $"Sinh viên thất bại mốc tiến độ: {milestoneLabel}",
                    NotifBody: $"Sinh viên {studentUserCode} đã thất bại mốc \"{milestoneLabel}\" (đề tài {milestone.TopicCode}). "
                             + $"Lý do: {reasonText}. Bạn có thể gia hạn hoặc miễn trừ mốc này trong hệ thống.",
                    NotifPriority: "NORMAL",
                    ActionType: "OPEN_STUDENT_PROGRESS",
                    ActionUrl: $"/lecturer/students",
                    RelatedEntityName: "PROGRESS_MILESTONE",
                    RelatedEntityCode: milestone.MilestoneCode,
                    RelatedEntityID: milestone.MilestoneID,
                    IsGlobal: false,
                    TargetUserCodes: new List<string> { lecturerUserCode }));
            }
        }

        private async Task NotifyLecturerPendingReviewAsync(
            INotificationEventPublisher publisher,
            ProgressMilestone milestone,
            ProgressSubmission submission)
        {
            if (milestone.Topic == null) return;

            var milestoneLabel = GetMilestoneLabel(milestone.Ordinal);
            var lecturerUserCode = milestone.Topic.SupervisorUserCode;

            if (string.IsNullOrWhiteSpace(lecturerUserCode)) return;

            await publisher.PublishAsync(new NotificationEventRequest(
                NotifCategory: "MILESTONE_PENDING_REVIEW_ALERT",
                NotifTitle: $"⏰ Cần duyệt báo cáo gấp: {milestoneLabel}",
                NotifBody: $"Báo cáo {submission.SubmissionCode} của sinh viên {submission.StudentUserCode} "
                         + $"cho mốc \"{milestoneLabel}\" (đề tài {milestone.TopicCode}) đã quá hạn deadline "
                         + "nhưng chưa được đánh giá. Vui lòng xem xét sớm để tránh ảnh hưởng đến tiến độ sinh viên.",
                NotifPriority: "HIGH",
                ActionType: "OPEN_SUBMISSION",
                ActionUrl: $"/reports/submissions/{submission.SubmissionID}",
                RelatedEntityName: "PROGRESS_SUBMISSION",
                RelatedEntityCode: submission.SubmissionCode,
                RelatedEntityID: submission.SubmissionID,
                IsGlobal: false,
                TargetUserCodes: new List<string> { lecturerUserCode }));
        }

        private static string GetMilestoneLabel(int? ordinal) => ordinal switch
        {
            1 => "Đăng ký đề tài",
            2 => "Báo cáo tiến độ lần 1",
            3 => "Báo cáo tiến độ lần 2",
            4 => "Hoàn thiện khóa luận",
            5 => "Bảo vệ luận văn",
            _ => $"Mốc {ordinal}"
        };
    }
}
