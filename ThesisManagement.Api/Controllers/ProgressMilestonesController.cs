using System;
using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using ThesisManagement.Api.Application.Command.ProgressMilestones;
using ThesisManagement.Api.Application.Query.ProgressMilestones;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.DTOs.ProgressMilestones.Command;
using ThesisManagement.Api.DTOs.ProgressMilestones.Query;
using ThesisManagement.Api.Services;
using ThesisManagement.Api.Services.MilestoneOverdue;

namespace ThesisManagement.Api.Controllers
{
    public class ProgressMilestonesController : BaseApiController
    {
        private readonly IGetProgressMilestonesListQuery _getProgressMilestonesListQuery;
        private readonly IGetProgressMilestoneDetailQuery _getProgressMilestoneDetailQuery;
        private readonly IGetProgressMilestoneCreateQuery _getProgressMilestoneCreateQuery;
        private readonly IGetProgressMilestoneUpdateQuery _getProgressMilestoneUpdateQuery;
        private readonly ICreateProgressMilestoneCommand _createProgressMilestoneCommand;
        private readonly IUpdateProgressMilestoneCommand _updateProgressMilestoneCommand;
        private readonly IDeleteProgressMilestoneCommand _deleteProgressMilestoneCommand;
        private readonly IOverrideMilestoneFailureCommand _overrideMilestoneFailureCommand;
        private readonly MilestoneOverdueJob _overdueJob;

        public ProgressMilestonesController(
            IUnitOfWork uow,
            ICodeGenerator codeGen,
            IMapper mapper,
            IGetProgressMilestonesListQuery getProgressMilestonesListQuery,
            IGetProgressMilestoneDetailQuery getProgressMilestoneDetailQuery,
            IGetProgressMilestoneCreateQuery getProgressMilestoneCreateQuery,
            IGetProgressMilestoneUpdateQuery getProgressMilestoneUpdateQuery,
            ICreateProgressMilestoneCommand createProgressMilestoneCommand,
            IUpdateProgressMilestoneCommand updateProgressMilestoneCommand,
            IDeleteProgressMilestoneCommand deleteProgressMilestoneCommand,
            IOverrideMilestoneFailureCommand overrideMilestoneFailureCommand,
            MilestoneOverdueJob overdueJob) : base(uow, codeGen, mapper)
        {
            _getProgressMilestonesListQuery = getProgressMilestonesListQuery;
            _getProgressMilestoneDetailQuery = getProgressMilestoneDetailQuery;
            _getProgressMilestoneCreateQuery = getProgressMilestoneCreateQuery;
            _getProgressMilestoneUpdateQuery = getProgressMilestoneUpdateQuery;
            _createProgressMilestoneCommand = createProgressMilestoneCommand;
            _updateProgressMilestoneCommand = updateProgressMilestoneCommand;
            _deleteProgressMilestoneCommand = deleteProgressMilestoneCommand;
            _overrideMilestoneFailureCommand = overrideMilestoneFailureCommand;
            _overdueJob = overdueJob;
        }

        [HttpGet("get-list")]
        public async Task<IActionResult> GetList([FromQuery] ProgressMilestoneFilter filter)
        {
            var result = await _getProgressMilestonesListQuery.ExecuteAsync(filter);
            return Ok(ApiResponse<IEnumerable<ProgressMilestoneReadDto>>.SuccessResponse(result.Items, result.TotalCount));
        }

        [HttpGet("get-detail/{code}")]
        public async Task<IActionResult> GetDetail(string code)
        {
            var dto = await _getProgressMilestoneDetailQuery.ExecuteAsync(code);
            if (dto == null)
                return NotFound(ApiResponse<object>.Fail("Milestone not found", 404));

            return Ok(ApiResponse<ProgressMilestoneReadDto>.SuccessResponse(dto));
        }

        [HttpGet("get-create")]
        public async Task<IActionResult> GetCreate()
        {
            var sample = await _getProgressMilestoneCreateQuery.ExecuteAsync();
            return Ok(ApiResponse<ProgressMilestoneCreateDto>.SuccessResponse(sample));
        }

        [HttpPost("create")]
        public async Task<IActionResult> Create([FromBody] ProgressMilestoneCreateDto dto)
        {
            var result = await _createProgressMilestoneCommand.ExecuteAsync(dto);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return StatusCode(201, ApiResponse<ProgressMilestoneReadDto>.SuccessResponse(result.Data, 1, 201));
        }

        [HttpGet("get-update/{topicId}")]
        public async Task<IActionResult> GetUpdate(int topicId)
        {
            var dto = await _getProgressMilestoneUpdateQuery.ExecuteAsync(topicId);
            if (dto == null)
                return NotFound(ApiResponse<object>.Fail("Milestone not found for the provided TopicID", 404));

            return Ok(ApiResponse<ProgressMilestoneUpdateDto>.SuccessResponse(dto));
        }

        [HttpPut("update/{topicId}")]
        public async Task<IActionResult> Update(int topicId, [FromBody] ProgressMilestoneUpdateDto dto)
        {
            var result = await _updateProgressMilestoneCommand.ExecuteAsync(topicId, dto);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return Ok(ApiResponse<ProgressMilestoneReadDto>.SuccessResponse(result.Data));
        }

        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _deleteProgressMilestoneCommand.ExecuteAsync(id);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return Ok(ApiResponse<object>.SuccessResponse(result.Data));
        }

        /// <summary>
        /// Cho phép GV/Admin xử lý một mốc bị FAILED.
        /// Action = "EXTEND_DEADLINE": gia hạn deadline và reset về trạng thái Pending.
        /// Action = "EXEMPT": miễn trừ mốc (ghi nhận lý do, SV không cần nộp lại).
        /// </summary>
        [HttpPut("override-failure/{milestoneId:int}")]
        public async Task<IActionResult> OverrideFailure(int milestoneId, [FromBody] OverrideMilestoneFailureDto dto)
        {
            var result = await _overrideMilestoneFailureCommand.ExecuteAsync(milestoneId, dto);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return Ok(ApiResponse<ProgressMilestoneReadDto>.SuccessResponse(result.Data));
        }

        /// <summary>
        /// Cho phép hoặc thu hồi phép nộp muộn cho một mốc cụ thể.
        /// GV dùng endpoint này sau khi nhận notification "Sinh viên yêu cầu nộp muộn".
        /// Allow = true: SV được phép nộp 1 lần dù quá deadline (tự reset sau khi nộp).
        /// Allow = false: Thu hồi phép (nếu GV đổi quyết định).
        /// </summary>
        [HttpPut("allow-late-submit/{milestoneId:int}")]
        public async Task<IActionResult> AllowLateSubmit(int milestoneId, [FromBody] AllowLateSubmitDto dto)
        {
            var milestone = await _uow.ProgressMilestones.GetByIdAsync(milestoneId);
            if (milestone == null)
                return NotFound(ApiResponse<object>.Fail("Milestone not found", 404));

            milestone.AllowLateSubmit = dto.Allow;
            if (dto.Allow)
            {
                milestone.LateSubmitGrantedAt = DateTime.UtcNow;
                milestone.LateSubmitGrantedBy = string.IsNullOrWhiteSpace(dto.GrantedByUserCode) ? "SYSTEM" : dto.GrantedByUserCode.Trim();
            }
            else
            {
                // Thu hồi: xóa thông tin cấp phép
                milestone.LateSubmitGrantedAt = null;
                milestone.LateSubmitGrantedBy = null;
            }
            milestone.LastUpdated = DateTime.UtcNow;

            _uow.ProgressMilestones.Update(milestone);
            await _uow.SaveChangesAsync();

            var readDto = _mapper.Map<ProgressMilestoneReadDto>(milestone);
            return Ok(ApiResponse<ProgressMilestoneReadDto>.SuccessResponse(readDto));
        }

        /// <summary>
        /// Trigger thủ công overdue check — dùng cho dev/admin để test mà không cần chờ 01:00 sáng.
        /// </summary>
        [HttpPost("trigger-overdue-check")]
        public async Task<IActionResult> TriggerOverdueCheck()
        {
            await _overdueJob.RunCheckAsync(HttpContext.RequestAborted);
            return Ok(ApiResponse<object>.SuccessResponse(null));
        }
    }
}
