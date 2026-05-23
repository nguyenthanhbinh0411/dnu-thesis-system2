using ThesisManagement.Api.Application.Common;
using ThesisManagement.Api.DTOs.ProgressMilestones.Command;
using ThesisManagement.Api.DTOs.ProgressMilestones.Query;
using ThesisManagement.Api.Services;
using AutoMapper;

namespace ThesisManagement.Api.Application.Command.ProgressMilestones
{
    public interface IOverrideMilestoneFailureCommand
    {
        Task<OperationResult<ProgressMilestoneReadDto>> ExecuteAsync(int milestoneId, OverrideMilestoneFailureDto dto);
    }

    /// <summary>
    /// Cho phép GV/Admin gia hạn deadline (EXTEND_DEADLINE) hoặc miễn trừ (EXEMPT) một milestone bị FAILED.
    /// Ghi lại ai đã override và lý do để tạo audit trail.
    /// </summary>
    public class OverrideMilestoneFailureCommand : IOverrideMilestoneFailureCommand
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;

        public OverrideMilestoneFailureCommand(IUnitOfWork uow, IMapper mapper)
        {
            _uow = uow;
            _mapper = mapper;
        }

        public async Task<OperationResult<ProgressMilestoneReadDto>> ExecuteAsync(int milestoneId, OverrideMilestoneFailureDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Action))
                return OperationResult<ProgressMilestoneReadDto>.Failed("Action is required (EXTEND_DEADLINE | EXEMPT)", 400);

            var action = dto.Action.Trim().ToUpperInvariant();
            if (action is not ("EXTEND_DEADLINE" or "EXEMPT" or "MARK_INELIGIBLE"))
                return OperationResult<ProgressMilestoneReadDto>.Failed("Invalid action. Must be 'EXTEND_DEADLINE', 'EXEMPT', or 'MARK_INELIGIBLE'", 400);

            var milestone = await _uow.ProgressMilestones.GetByIdAsync(milestoneId);
            if (milestone == null)
                return OperationResult<ProgressMilestoneReadDto>.Failed("Milestone not found", 404);

            var overriddenBy = string.IsNullOrWhiteSpace(dto.OverriddenByUserCode) ? "SYSTEM" : dto.OverriddenByUserCode.Trim();

            switch (action)
            {
                case "EXTEND_DEADLINE":
                    if (dto.NewDeadline == null)
                        return OperationResult<ProgressMilestoneReadDto>.Failed("NewDeadline is required for EXTEND_DEADLINE", 400);
                    if (dto.NewDeadline <= DateTime.UtcNow)
                        return OperationResult<ProgressMilestoneReadDto>.Failed("NewDeadline must be in the future", 400);

                    // Reset milestone về trạng thái active
                    milestone.Deadline = dto.NewDeadline;
                    milestone.State = "Pending";
                    milestone.FailureReason = null;
                    milestone.FailedAt = null;
                    milestone.LastUpdated = DateTime.UtcNow;

                    // Reset topic status nếu đang là "Không đủ điều kiện bảo vệ"
                    await ResetTopicStatusIfNeededAsync(milestone);
                    break;

                case "EXEMPT":
                    // Miễn trừ — SV không cần pass mốc này nhưng vẫn ghi nhận lý do
                    var reasonSuffix = string.IsNullOrWhiteSpace(dto.Reason) ? "" : $" | {dto.Reason.Trim()}";
                    milestone.FailureReason = $"EXEMPTED_BY:{overriddenBy}{reasonSuffix}";
                    milestone.State = "EXEMPTED";
                    milestone.LastUpdated = DateTime.UtcNow;

                    // Khi được miễn trừ, đặt CompletedAt cho ordinal này = now để pipeline tiếp tục
                    SetCompletedAt(milestone);

                    // Reset topic status nếu đang là "Không đủ điều kiện bảo vệ"
                    await ResetTopicStatusIfNeededAsync(milestone);
                    break;

                case "MARK_INELIGIBLE":
                    // GV chủ động xét SV không đủ điều kiện bảo vệ
                    // Đánh dấu milestone là FAILED với lý do do GV quyết định
                    var ineligibleReason = string.IsNullOrWhiteSpace(dto.Reason)
                        ? $"MARKED_INELIGIBLE_BY:{overriddenBy}"
                        : $"MARKED_INELIGIBLE_BY:{overriddenBy} | {dto.Reason.Trim()}";
                    milestone.FailureReason = ineligibleReason;
                    milestone.State = "FAILED";
                    milestone.FailedAt = DateTime.UtcNow;
                    milestone.LastUpdated = DateTime.UtcNow;

                    // Cập nhật topic sang "Không đủ điều kiện bảo vệ"
                    await MarkTopicIneligibleAsync(milestone);
                    break;
            }

            _uow.ProgressMilestones.Update(milestone);
            await _uow.SaveChangesAsync();

            return OperationResult<ProgressMilestoneReadDto>.Succeeded(_mapper.Map<ProgressMilestoneReadDto>(milestone));
        }

        /// <summary>
        /// Nếu topic đang ở trạng thái "Không đủ điều kiện bảo vệ" do milestone này gây ra,
        /// reset về trạng thái trước đó (Đang thực hiện).
        /// </summary>
        private async Task ResetTopicStatusIfNeededAsync(Models.ProgressMilestone milestone)
        {
            if (milestone.TopicID <= 0) return;
            var topic = await _uow.Topics.GetByIdAsync(milestone.TopicID);
            if (topic == null) return;

            if (string.Equals(topic.Status, "Không đủ điều kiện bảo vệ", StringComparison.OrdinalIgnoreCase))
            {
                topic.Status = "Đang thực hiện";
                topic.LastUpdated = DateTime.UtcNow;
                _uow.Topics.Update(topic);
            }
        }

        /// <summary>
        /// Cập nhật topic sang trạng thái "Không đủ điều kiện bảo vệ" khi GV xét thủ công.
        /// </summary>
        private async Task MarkTopicIneligibleAsync(Models.ProgressMilestone milestone)
        {
            if (milestone.TopicID <= 0) return;
            var topic = await _uow.Topics.GetByIdAsync(milestone.TopicID);
            if (topic == null) return;

            topic.Status = "Không đủ điều kiện bảo vệ";
            topic.LastUpdated = DateTime.UtcNow;
            _uow.Topics.Update(topic);
        }

        private static void SetCompletedAt(Models.ProgressMilestone milestone)
        {
            var now = DateTime.UtcNow;
            switch (milestone.Ordinal)
            {
                case 1: if (milestone.CompletedAt1 == null) milestone.CompletedAt1 = now; break;
                case 2: if (milestone.CompletedAt2 == null) milestone.CompletedAt2 = now; break;
                case 3: if (milestone.CompletedAt3 == null) milestone.CompletedAt3 = now; break;
                case 4: if (milestone.CompletedAt4 == null) milestone.CompletedAt4 = now; break;
                case 5: if (milestone.CompletedAt5 == null) milestone.CompletedAt5 = now; break;
            }
        }
    }
}
