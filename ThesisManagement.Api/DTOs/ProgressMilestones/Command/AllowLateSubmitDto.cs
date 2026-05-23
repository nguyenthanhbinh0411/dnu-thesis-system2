namespace ThesisManagement.Api.DTOs.ProgressMilestones.Command
{
    /// <summary>
    /// DTO cho GV cấp phép / thu hồi phép nộp muộn.
    /// </summary>
    public record AllowLateSubmitDto(
        /// <summary>true = cấp phép, false = thu hồi</summary>
        bool Allow,
        /// <summary>UserCode của GV thực hiện</summary>
        string? GrantedByUserCode,
        /// <summary>Ghi chú lý do (optional)</summary>
        string? Note
    );
}
