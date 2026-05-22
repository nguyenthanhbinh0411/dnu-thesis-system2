namespace ThesisManagement.Api.Services.MilestoneOverdue
{
    /// <summary>
    /// Cấu hình cho hệ thống tự động phát hiện và xử lý mốc tiến độ quá hạn.
    /// Bind từ section "MilestoneOverdue" trong appsettings.json.
    /// </summary>
    public class MilestoneOverdueOptions
    {
        /// <summary>
        /// Số ngày buffer sau khi deadline trôi qua mới đánh dấu milestone là FAILED.
        /// Mặc định 3 ngày để tránh false-positive khi GV chậm duyệt.
        /// </summary>
        public int GracePeriodDays { get; set; } = 3;

        /// <summary>
        /// Bật/tắt tính năng chặn sinh viên nộp mốc N khi mốc N-1 chưa được duyệt (APPROVED).
        /// Khi bật, sinh viên phải hoàn thành mốc theo thứ tự.
        /// </summary>
        public bool EnableSequentialSubmissionGuard { get; set; } = true;
    }
}
