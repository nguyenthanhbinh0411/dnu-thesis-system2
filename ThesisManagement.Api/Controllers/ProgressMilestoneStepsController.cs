using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.Services;
using ThesisManagement.Api.Models;

namespace ThesisManagement.Api.Controllers
{
    public class ProgressMilestoneStepsController : BaseApiController
    {
        public ProgressMilestoneStepsController(IUnitOfWork uow, ICodeGenerator codeGen, IMapper mapper) 
            : base(uow, codeGen, mapper)
        {
        }

        [HttpGet("get-list")]
        public async Task<IActionResult> GetList([FromQuery] int? milestoneId)
        {
            if (!milestoneId.HasValue)
            {
                return BadRequest(ApiResponse<object>.Fail("MilestoneId query parameter is required.", 400));
            }

            var steps = await _uow.ProgressMilestoneSteps.Query()
                .AsNoTracking()
                .Where(x => x.MilestoneID == milestoneId.Value)
                .OrderBy(x => x.Ordinal)
                .Select(x => new {
                    stepID = x.StepID,
                    milestoneID = x.MilestoneID,
                    milestoneTemplateCode = x.MilestoneTemplateCode,
                    ordinal = x.Ordinal,
                    state = x.State,
                    completedAt = x.CompletedAt,
                    createdAt = x.CreatedAt,
                    lastUpdated = x.LastUpdated
                })
                .ToListAsync();

            return Ok(ApiResponse<object>.SuccessResponse(steps, steps.Count));
        }
    }
}
