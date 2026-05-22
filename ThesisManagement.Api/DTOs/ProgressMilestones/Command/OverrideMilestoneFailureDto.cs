namespace ThesisManagement.Api.DTOs.ProgressMilestones.Command
{
    /// <summary>
    /// DTO để GV/Admin override một milestone thất bại.
    /// </summary>
    /// <param name="Action">"EXTEND_DEADLINE" để gia hạn, "EXEMPT" để miễn trừ hoàn toàn</param>
    /// <param name="NewDeadline">Deadline mới (chỉ dùng khi Action = EXTEND_DEADLINE)</param>
    /// <param name="Reason">Lý do override — sẽ được ghi vào FailureReason để audit</param>
    /// <param name="OverriddenByUserCode">UserCode của GV/Admin thực hiện override</param>
    public record OverrideMilestoneFailureDto(
        string Action,
        DateTime? NewDeadline,
        string? Reason,
        string? OverriddenByUserCode);
}
