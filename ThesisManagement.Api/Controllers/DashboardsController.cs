using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ThesisManagement.Api.Application.Query.Dashboards;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.DTOs.Dashboards.Query;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Controllers
{
    public class DashboardsController : BaseApiController
    {
        private readonly IDashboardQueryProcessor _dashboardQueryProcessor;

        public DashboardsController(
            IUnitOfWork uow,
            ICodeGenerator codeGen,
            IMapper mapper,
            IDashboardQueryProcessor dashboardQueryProcessor)
            : base(uow, codeGen, mapper)
        {
            _dashboardQueryProcessor = dashboardQueryProcessor;
        }

        [HttpGet("lecturer/overview")]
        [Authorize(Roles = "Lecturer,Head,Admin")]
        public Task<IActionResult> GetLecturerOverview([FromQuery] LecturerDashboardFilter filter)
            => ExecuteAsync(() => _dashboardQueryProcessor.GetLecturerOverviewAsync(filter.LecturerCode, filter.DefenseTermId));

        [HttpGet("lecturer/review-queue")]
        [Authorize(Roles = "Lecturer,Head,Admin")]
        public Task<IActionResult> GetLecturerReviewQueue([FromQuery] LecturerDashboardFilter filter)
            => ExecuteAsync(() => _dashboardQueryProcessor.GetLecturerReviewQueueAsync(filter.LecturerCode, filter.Limit, filter.DefenseTermId));

        [HttpGet("lecturer/scoring-progress")]
        [Authorize(Roles = "Lecturer,Head,Admin")]
        public Task<IActionResult> GetLecturerScoringProgress([FromQuery] LecturerDashboardFilter filter)
            => ExecuteAsync(() => _dashboardQueryProcessor.GetLecturerScoringProgressAsync(filter.LecturerCode, filter.Limit, filter.DefenseTermId));

        [HttpGet("lecturer/deadline-risk")]
        [Authorize(Roles = "Lecturer,Head,Admin")]
        public Task<IActionResult> GetLecturerDeadlineRisk([FromQuery] LecturerDashboardFilter filter)
            => ExecuteAsync(() => _dashboardQueryProcessor.GetLecturerDeadlineRiskAsync(filter.LecturerCode, filter.Limit, filter.DefenseTermId));

        [HttpGet("lecturer/defense-schedule")]
        [Authorize(Roles = "Lecturer,Head,Admin")]
        public Task<IActionResult> GetLecturerDefenseSchedule([FromQuery] LecturerDashboardFilter filter)
            => ExecuteAsync(() => _dashboardQueryProcessor.GetLecturerDefenseScheduleAsync(filter.LecturerCode, filter.Limit, filter.DefenseTermId));

        [HttpGet("lecturer/committees")]
        [Authorize(Roles = "Lecturer,Head,Admin")]
        public Task<IActionResult> GetLecturerCommittees([FromQuery] LecturerDashboardFilter filter)
            => ExecuteAsync(() => _dashboardQueryProcessor.GetLecturerCommitteesAsync(filter.LecturerCode, filter.Limit, filter.DefenseTermId));

        [HttpGet("lecturer/progress-status-breakdown")]
        [Authorize(Roles = "Lecturer,Head,Admin")]
        public Task<IActionResult> GetLecturerProgressStatusBreakdown([FromQuery] LecturerDashboardFilter filter)
            => ExecuteAsync(() => _dashboardQueryProcessor.GetLecturerProgressStatusBreakdownAsync(filter.LecturerCode, filter.DefenseTermId));

        [HttpGet("lecturer/overdue-trend")]
        [Authorize(Roles = "Lecturer,Head,Admin")]
        public Task<IActionResult> GetLecturerOverdueTrend([FromQuery] LecturerDashboardFilter filter)
            => ExecuteAsync(() => _dashboardQueryProcessor.GetLecturerOverdueTrendAsync(filter.LecturerCode, filter.Days ?? 30, filter.DefenseTermId));

        [HttpGet("lecturer/topic-type-breakdown")]
        [Authorize(Roles = "Lecturer,Head,Admin")]
        public Task<IActionResult> GetLecturerTopicTypeBreakdown([FromQuery] LecturerDashboardFilter filter)
            => ExecuteAsync(() => _dashboardQueryProcessor.GetLecturerTopicTypeBreakdownAsync(filter.LecturerCode, filter.DefenseTermId));

        [HttpGet("lecturer/review-status-breakdown")]
        [Authorize(Roles = "Lecturer,Head,Admin")]
        public Task<IActionResult> GetLecturerReviewStatusBreakdown([FromQuery] LecturerDashboardFilter filter)
            => ExecuteAsync(() => _dashboardQueryProcessor.GetLecturerReviewStatusBreakdownAsync(filter.LecturerCode, filter.DefenseTermId));

        [HttpGet("student-service/overview")]
        [Authorize(Roles = "StudentService,Secretary,Head,Admin")]
        public Task<IActionResult> GetStudentServiceOverview([FromQuery] StudentServiceDashboardFilter filter)
            => ExecuteAsync(() => _dashboardQueryProcessor.GetStudentServiceOverviewAsync(filter.DefenseTermId));

        [HttpGet("student-service/at-risk")]
        [Authorize(Roles = "StudentService,Secretary,Head,Admin")]
        public Task<IActionResult> GetStudentServiceAtRisk([FromQuery] StudentServiceDashboardFilter filter)
            => ExecuteAsync(() => _dashboardQueryProcessor.GetStudentServiceAtRiskAsync(filter.Limit, filter.DefenseTermId));

        [HttpGet("student-service/backlog")]
        [Authorize(Roles = "StudentService,Secretary,Head,Admin")]
        public Task<IActionResult> GetStudentServiceBacklog([FromQuery] StudentServiceDashboardFilter filter)
            => ExecuteAsync(() => _dashboardQueryProcessor.GetStudentServiceBacklogAsync(filter.DefenseTermId));

        [HttpGet("student-service/department-breakdown")]
        [Authorize(Roles = "StudentService,Secretary,Head,Admin")]
        public Task<IActionResult> GetStudentServiceDepartmentBreakdown([FromQuery] StudentServiceDashboardFilter filter)
            => ExecuteAsync(() => _dashboardQueryProcessor.GetStudentServiceDepartmentBreakdownAsync(filter.DefenseTermId));

        [HttpGet("admin/overview")]
        [Authorize(Roles = "Admin,Head")]
        public Task<IActionResult> GetAdminOverview([FromQuery] AdminDashboardFilter filter)
            => ExecuteAsync(() => _dashboardQueryProcessor.GetAdminOverviewAsync(filter.DefenseTermId));

        [HttpGet("admin/period-funnel")]
        [Authorize(Roles = "Admin,Head")]
        public Task<IActionResult> GetAdminPeriodFunnel([FromQuery] AdminDashboardFilter filter)
            => ExecuteAsync(() => _dashboardQueryProcessor.GetAdminPeriodFunnelAsync(filter.Limit, filter.DefenseTermId));

        [HttpGet("admin/council-capacity")]
        [Authorize(Roles = "Admin,Head")]
        public Task<IActionResult> GetAdminCouncilCapacity([FromQuery] AdminDashboardFilter filter)
            => ExecuteAsync(() => _dashboardQueryProcessor.GetAdminCouncilCapacityAsync(filter.Limit, filter.DefenseTermId));

        [HttpGet("admin/score-quality")]
        [Authorize(Roles = "Admin,Head")]
        public Task<IActionResult> GetAdminScoreQuality([FromQuery] AdminDashboardFilter filter)
            => ExecuteAsync(() => _dashboardQueryProcessor.GetAdminScoreQualityAsync(filter.DefenseTermId));

        [HttpGet("admin/sla-bottleneck")]
        [Authorize(Roles = "Admin,Head")]
        public Task<IActionResult> GetAdminSlaBottleneck([FromQuery] AdminDashboardFilter filter)
            => ExecuteAsync(() => _dashboardQueryProcessor.GetAdminSlaBottleneckAsync(filter.Days, filter.DefenseTermId));

        [HttpGet("admin/security-audit")]
        [Authorize(Roles = "Admin,Head")]
        public Task<IActionResult> GetAdminSecurityAudit([FromQuery] AdminDashboardFilter filter)
            => ExecuteAsync(() => _dashboardQueryProcessor.GetAdminSecurityAuditAsync(filter.Days, filter.Limit, filter.DefenseTermId));

        [HttpGet("snapshots/daily-kpi-by-role")]
        [Authorize(Roles = "Admin,Head")]
        public Task<IActionResult> GetDailyKpiByRole([FromQuery] AdminDashboardFilter filter)
            => ExecuteAsync(() => _dashboardQueryProcessor.GetDailyKpiByRoleAsync(filter.RoleName, filter.Days));

        [HttpGet("snapshots/period")]
        [Authorize(Roles = "Admin,Head")]
        public Task<IActionResult> GetPeriodSnapshot([FromQuery] AdminDashboardFilter filter)
            => ExecuteAsync(() => _dashboardQueryProcessor.GetPeriodSnapshotAsync(filter.Days));

        [HttpGet("snapshots/sla-breach-daily")]
        [Authorize(Roles = "Admin,Head")]
        public Task<IActionResult> GetSlaBreachDaily([FromQuery] AdminDashboardFilter filter)
            => ExecuteAsync(() => _dashboardQueryProcessor.GetSlaBreachDailyAsync(filter.Days));

        [HttpGet("snapshots/lecturer-workload")]
        [Authorize(Roles = "Admin,Head,Lecturer")]
        public Task<IActionResult> GetLecturerWorkloadDaily([FromQuery] AdminDashboardFilter filter)
            => ExecuteAsync(() => _dashboardQueryProcessor.GetLecturerWorkloadDailyAsync(filter.LecturerCode, filter.Days));

        private async Task<IActionResult> ExecuteAsync(Func<Task<IReadOnlyList<Dictionary<string, object?>>>> executor)
        {
            try
            {
                var rows = await executor();
                return Ok(ApiResponse<IEnumerable<Dictionary<string, object?>>>.SuccessResponse(rows, rows.Count));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.Fail($"Dashboard query failed: {ex.Message}", 500));
            }
        }
    }
}
