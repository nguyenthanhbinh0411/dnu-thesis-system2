using AutoMapper;
using ThesisManagement.Api.Application.Common;
using ThesisManagement.Api.Application.Validate.MilestoneTemplates;
using ThesisManagement.Api.DTOs.MilestoneTemplates.Command;
using ThesisManagement.Api.Application.Command.Notifications;
using ThesisManagement.Api.DTOs.MilestoneTemplates.Query;
using ThesisManagement.Api.Models;
using ThesisManagement.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace ThesisManagement.Api.Application.Command.MilestoneTemplates
{
    public interface IUpdateMilestoneTemplateCommand
    {
        Task<OperationResult<MilestoneTemplateReadDto>> ExecuteAsync(int id, MilestoneTemplateUpdateDto dto);
    }

    public class UpdateMilestoneTemplateCommand : IUpdateMilestoneTemplateCommand
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;
        private readonly INotificationEventPublisher _notificationEventPublisher;

        public UpdateMilestoneTemplateCommand(IUnitOfWork uow, IMapper mapper, INotificationEventPublisher notificationEventPublisher)
        {
            _uow = uow;
            _mapper = mapper;
            _notificationEventPublisher = notificationEventPublisher;
        }

        public async Task<OperationResult<MilestoneTemplateReadDto>> ExecuteAsync(int id, MilestoneTemplateUpdateDto dto)
        {
            var validationError = MilestoneTemplateCommandValidator.ValidateUpdate(dto);
            if (!string.IsNullOrWhiteSpace(validationError))
                return OperationResult<MilestoneTemplateReadDto>.Failed(validationError, 400);

            var entity = await _uow.MilestoneTemplates.GetByIdAsync(id);
            if (entity == null)
                return OperationResult<MilestoneTemplateReadDto>.Failed("Milestone template not found", 404);

            if (!string.IsNullOrWhiteSpace(dto.Name))
                entity.Name = dto.Name.Trim();

            if (dto.Description != null)
                entity.Description = dto.Description;

            if (dto.Ordinal.HasValue)
                entity.Ordinal = dto.Ordinal.Value;

            if (dto.Deadline.HasValue)
                entity.Deadline = dto.Deadline.Value;

            entity.LastUpdated = DateTime.UtcNow;

            _uow.MilestoneTemplates.Update(entity);
            await _uow.SaveChangesAsync();

            // Notify participants in active periods
            await NotifyActivePeriodsAsync(entity);

            return OperationResult<MilestoneTemplateReadDto>.Succeeded(_mapper.Map<MilestoneTemplateReadDto>(entity));
        }

        private async Task NotifyActivePeriodsAsync(MilestoneTemplate milestone)
        {
            var activeStatuses = new[] { "Registration", "Assignment", "ProgressTracking", "CommitteePreparation", "Running", "ScoringLocked" };
            var activePeriods = await _uow.DefenseTerms.Query()
                .Where(x => activeStatuses.Contains(x.Status))
                .Select(x => new { x.DefenseTermId, x.Name })
                .ToListAsync();

            foreach (var period in activePeriods)
            {
                var studentUserCodes = await _uow.DefenseTermStudents.Query()
                    .Where(x => x.DefenseTermId == period.DefenseTermId && !string.IsNullOrWhiteSpace(x.UserCode))
                    .Select(x => x.UserCode!)
                    .ToListAsync();

                var lecturerUserCodes = await _uow.DefenseTermLecturers.Query()
                    .Where(x => x.DefenseTermId == period.DefenseTermId && !string.IsNullOrWhiteSpace(x.UserCode))
                    .Select(x => x.UserCode!)
                    .ToListAsync();

                var allTargetCodes = studentUserCodes.Concat(lecturerUserCodes).Distinct().ToList();

                if (allTargetCodes.Count > 0)
                {
                    await _notificationEventPublisher.PublishAsync(new NotificationEventRequest(
                        "ROADMAP",
                        $"Cập nhật lộ trình: {milestone.Name}",
                        $"Mốc thời gian '{milestone.Name}' trong đợt {period.Name} đã được cập nhật. Vui lòng kiểm tra lại thời hạn.",
                        "HIGH",
                        "NAVIGATE",
                        "/defense-periods",
                        "MilestoneTemplate",
                        milestone.MilestoneTemplateCode,
                        milestone.MilestoneTemplateID,
                        false,
                        allTargetCodes
                    ));
                }
            }
        }
    }
}
