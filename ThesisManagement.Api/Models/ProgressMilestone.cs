using System;
using System.Collections.Generic;

namespace ThesisManagement.Api.Models
{
    public class ProgressMilestone
    {
        public int MilestoneID { get; set; }
        public string MilestoneCode { get; set; } = null!;
        public int TopicID { get; set; }
        public string? TopicCode { get; set; } // New: reference by code
        public string? MilestoneTemplateCode { get; set; }
        public int? Ordinal { get; set; }
        public DateTime? Deadline { get; set; }
        public string? State { get; set; }
        public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt1 { get; set; }
    public DateTime? CompletedAt2 { get; set; }
    public DateTime? CompletedAt3 { get; set; }
    public DateTime? CompletedAt4 { get; set; }
    public DateTime? CompletedAt5 { get; set; }
        /// <summary>
        /// Lý do thất bại. Giá trị: "ABSENT" (không nộp), "ABANDONED_REVISION" (bỏ sửa), "EXEMPTED_BY:{lecturerCode}" (được miễn trừ).
        /// Null nếu milestone chưa thất bại.
        /// </summary>
        public string? FailureReason { get; set; }

        /// <summary>
        /// Thời điểm hệ thống tự động đánh dấu milestone thất bại (do background job).
        /// Null nếu chưa thất bại.
        /// </summary>
        public DateTime? FailedAt { get; set; }

        /// <summary>
        /// GV cho phép SV nộp muộn cho mốc này (dù đã quá deadline).
        /// Tự động reset về false sau khi SV nộp thành công.
        /// </summary>
        public bool AllowLateSubmit { get; set; } = false;

        /// <summary>
        /// Thời điểm GV cấp phép nộp muộn.
        /// </summary>
        public DateTime? LateSubmitGrantedAt { get; set; }

        /// <summary>
        /// UserCode của GV đã cấp phép nộp muộn.
        /// </summary>
        public string? LateSubmitGrantedBy { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime LastUpdated { get; set; }

        public Topic? Topic { get; set; }
        public ICollection<ProgressSubmission>? ProgressSubmissions { get; set; }
        public MilestoneTemplate? MilestoneTemplate { get; set; }
        public ICollection<ProgressMilestoneStep>? ProgressMilestoneSteps { get; set; }
    }
}
