using System;

namespace ThesisManagement.Api.DTOs.ProgressMilestones.Query
{
    public record ProgressMilestoneReadDto(
        int MilestoneID,
        string MilestoneCode,
        int? TopicID,
        string? TopicCode,
        string? MilestoneTemplateCode,
        int? Ordinal,
        DateTime? Deadline,
        string? State,
        DateTime? StartedAt,
        DateTime? CompletedAt1,
        DateTime? CompletedAt2,
        DateTime? CompletedAt3,
        DateTime? CompletedAt4,
        DateTime? CompletedAt5,
        /// <summary>Lý do thất bại: ABSENT, ABANDONED_REVISION, EXEMPTED_BY:...</summary>
        string? FailureReason,
        /// <summary>Thời điểm background job ghi nhận thất bại</summary>
        DateTime? FailedAt,
        /// <summary>GV đã cấp phép SV nộp muộn cho mốc này</summary>
        bool AllowLateSubmit,
        /// <summary>Thời điểm GV cấp phép nộp muộn</summary>
        DateTime? LateSubmitGrantedAt,
        /// <summary>UserCode GV cấp phép</summary>
        string? LateSubmitGrantedBy,
        DateTime CreatedAt,
        DateTime LastUpdated);
}