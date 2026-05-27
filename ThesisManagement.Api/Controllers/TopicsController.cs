using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.Application.Command.Topics;
using ThesisManagement.Api.Application.Query.Topics;
using ThesisManagement.Api.Data;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.DTOs.Topics.Command;
using ThesisManagement.Api.DTOs.Topics.Query;
using ThesisManagement.Api.Models;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Controllers
{
    public class TopicsController : BaseApiController
    {
        private readonly IGetTopicsListQuery _getTopicsListQuery;
        private readonly IGetTopicDetailQuery _getTopicDetailQuery;
        private readonly IGetTopicCreateQuery _getTopicCreateQuery;
        private readonly IGetTopicUpdateQuery _getTopicUpdateQuery;
        private readonly ICreateTopicCommand _createTopicCommand;
        private readonly IUpdateTopicCommand _updateTopicCommand;
        private readonly IDeleteTopicCommand _deleteTopicCommand;
        private readonly ApplicationDbContext _context;
        private readonly ITopicCodeGenerator _topicCodeGenerator;

        public TopicsController(
            IUnitOfWork uow,
            ICodeGenerator codeGen,
            IMapper mapper,
            IGetTopicsListQuery getTopicsListQuery,
            IGetTopicDetailQuery getTopicDetailQuery,
            IGetTopicCreateQuery getTopicCreateQuery,
            IGetTopicUpdateQuery getTopicUpdateQuery,
            ICreateTopicCommand createTopicCommand,
            IUpdateTopicCommand updateTopicCommand,
            IDeleteTopicCommand deleteTopicCommand,
            ApplicationDbContext context,
            ITopicCodeGenerator topicCodeGenerator) : base(uow, codeGen, mapper)
        {
            _getTopicsListQuery = getTopicsListQuery;
            _getTopicDetailQuery = getTopicDetailQuery;
            _getTopicCreateQuery = getTopicCreateQuery;
            _getTopicUpdateQuery = getTopicUpdateQuery;
            _createTopicCommand = createTopicCommand;
            _updateTopicCommand = updateTopicCommand;
            _deleteTopicCommand = deleteTopicCommand;
            _context = context;
            _topicCodeGenerator = topicCodeGenerator;
        }

        [HttpGet("get-list")]
        public async Task<IActionResult> GetList([FromQuery] TopicFilter filter)
        {
            var result = await _getTopicsListQuery.ExecuteAsync(filter);
            return Ok(ApiResponse<IEnumerable<TopicReadDto>>.SuccessResponse(result.Items, result.TotalCount));
        }

        [HttpGet("get-detail/{code}")]
        public async Task<IActionResult> GetDetail(string code)
        {
            var dto = await _getTopicDetailQuery.ExecuteAsync(code);
            if (dto == null)
                return NotFound(ApiResponse<object>.Fail("Topic not found", 404));

            return Ok(ApiResponse<TopicReadDto>.SuccessResponse(dto));
        }

        [HttpGet("get-create")]
        public async Task<IActionResult> GetCreate()
        {
            var sample = await _getTopicCreateQuery.ExecuteAsync();
            return Ok(ApiResponse<TopicCreateDto>.SuccessResponse(sample));
        }

        [HttpPost("create")]
        public async Task<IActionResult> Create([FromBody] TopicCreateDto dto)
        {
            var result = await _createTopicCommand.ExecuteAsync(dto);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return StatusCode(201, ApiResponse<TopicReadDto>.SuccessResponse(result.Data, 1, 201));
        }

        [HttpGet("get-update/{id}")]
        public async Task<IActionResult> GetUpdate(int id)
        {
            var dto = await _getTopicUpdateQuery.ExecuteAsync(id);
            if (dto == null)
                return NotFound(ApiResponse<object>.Fail("Topic not found", 404));

            return Ok(ApiResponse<TopicUpdateDto>.SuccessResponse(dto));
        }

        [HttpPut("update/{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] TopicUpdateDto dto)
        {
            var result = await _updateTopicCommand.ExecuteAsync(id, dto);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return Ok(ApiResponse<TopicReadDto>.SuccessResponse(result.Data));
        }

        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _deleteTopicCommand.ExecuteAsync(id);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return Ok(ApiResponse<object>.SuccessResponse(result.Data));
        }

        [HttpPost("auto-assign/preview")]
        public async Task<IActionResult> AutoAssignPreview([FromBody] AutoAssignRequestDto request)
        {
            if (request.DefenseTermId <= 0)
                return BadRequest(ApiResponse<object>.Fail("DefenseTermId không hợp lệ.", 400));

            var termExists = await _context.DefenseTerms.AnyAsync(dt => dt.DefenseTermId == request.DefenseTermId);
            if (!termExists)
                return NotFound(ApiResponse<object>.Fail("Đợt bảo vệ không tồn tại.", 404));

            // 1. Get late students: in term but have no topics
            var lateStudents = await _context.StudentProfiles
                .Where(s => s.DefenseTermId == request.DefenseTermId)
                .Where(s => !_context.Topics.Any(t => t.DefenseTermId == request.DefenseTermId && t.ProposerStudentCode == s.StudentCode))
                .ToListAsync();

            if (lateStudents.Count == 0)
                return Ok(ApiResponse<List<AutoAssignPreviewDto>>.SuccessResponse(new List<AutoAssignPreviewDto>()));

            // 2. Get unused catalog topics (only exclude those already used in the current defense term)
            // Note: AssignedStatus is NOT filtered here because it may be "Đã giao" from a previous term's
            // auto-assign and cannot be reset while a term is active. The only relevant check is whether
            // this catalog topic is already assigned to a topic in the CURRENT defense term.
            var unusedCatalogTopics = await _context.CatalogTopics
                .Where(c => !_context.Topics.Any(t => t.CatalogTopicCode == c.CatalogTopicCode
                                                   && t.DefenseTermId == request.DefenseTermId))
                .ToListAsync();

            // 3. Get term lecturers with remaining quota
            var termLecturers = await _context.DefenseTermLecturers
                .Where(dtl => dtl.DefenseTermId == request.DefenseTermId)
                .Join(_context.LecturerProfiles,
                      dtl => dtl.LecturerCode,
                      lp => lp.LecturerCode,
                      (dtl, lp) => lp)
                .ToListAsync();

            var lecturerVirtualLoads = termLecturers.ToDictionary(l => l.LecturerCode, l => l.CurrentGuidingCount);
            var lecturerQuotas = termLecturers.ToDictionary(l => l.LecturerCode, l => l.GuideQuota ?? 10);

            // Preload tag maps
            var catalogTopicTagsList = await _context.CatalogTopicTags
                .Include(ctt => ctt.Tag)
                .ToListAsync();
            var catalogTopicTagsMap = catalogTopicTagsList
                .Where(ctt => ctt.CatalogTopicCode != null && ctt.Tag != null)
                .GroupBy(ctt => ctt.CatalogTopicCode!)
                .ToDictionary(g => g.Key, g => g.Select(ctt => ctt.Tag!).ToList());

            var lecturerTagsList = await _context.LecturerTags
                .Include(lt => lt.Tag)
                .ToListAsync();
            var lecturerTagsMap = lecturerTagsList
                .Where(lt => lt.LecturerCode != null && lt.Tag != null)
                .GroupBy(lt => lt.LecturerCode!)
                .ToDictionary(g => g.Key, g => g.Select(lt => lt.Tag!).ToList());

            var previewResults = new List<AutoAssignPreviewDto>();
            var usedCatalogTopicCodes = new HashSet<string>();

            foreach (var student in lateStudents)
            {
                // Find unused catalog topic in same department, or fallback
                var catalogTopic = unusedCatalogTopics
                    .Where(c => !usedCatalogTopicCodes.Contains(c.CatalogTopicCode))
                    .OrderByDescending(c => c.DepartmentCode == student.DepartmentCode)
                    .FirstOrDefault();

                if (catalogTopic != null)
                {
                    usedCatalogTopicCodes.Add(catalogTopic.CatalogTopicCode);
                }

                var studentTopicTags = catalogTopic != null && catalogTopicTagsMap.ContainsKey(catalogTopic.CatalogTopicCode)
                    ? catalogTopicTagsMap[catalogTopic.CatalogTopicCode]
                    : new List<Tag>();

                // Get candidates with remaining quota, fallback to all if none
                var candidates = termLecturers
                    .Where(l => lecturerVirtualLoads[l.LecturerCode] < lecturerQuotas[l.LecturerCode])
                    .ToList();

                if (candidates.Count == 0)
                {
                    candidates = termLecturers;
                }

                if (candidates.Count == 0)
                {
                    // No active lecturers in the period
                    continue;
                }

                // Match quality scoring and ordering
                var scoredCandidates = candidates.Select(l =>
                {
                    var lecturerTags = lecturerTagsMap.ContainsKey(l.LecturerCode)
                        ? lecturerTagsMap[l.LecturerCode]
                        : new List<Tag>();

                    var common = studentTopicTags
                        .Select(t => t.TagCode)
                        .Intersect(lecturerTags.Select(t => t.TagCode), StringComparer.OrdinalIgnoreCase)
                        .ToList();

                    var commonTagNames = studentTopicTags
                        .Where(t => common.Contains(t.TagCode, StringComparer.OrdinalIgnoreCase))
                        .Select(t => t.TagName)
                        .ToList();

                    return new
                    {
                        Lecturer = l,
                        MatchCount = common.Count,
                        CommonTagNames = commonTagNames,
                        IsSameDept = l.DepartmentCode == student.DepartmentCode,
                        Load = lecturerVirtualLoads[l.LecturerCode]
                    };
                })
                .OrderByDescending(x => studentTopicTags.Count == 0 || x.MatchCount > 0)
                .ThenByDescending(x => x.IsSameDept)
                .ThenByDescending(x => x.MatchCount)
                .ThenBy(x => x.Load)
                .First();

                var bestLecturer = scoredCandidates.Lecturer;
                lecturerVirtualLoads[bestLecturer.LecturerCode]++;

                var isFallback = catalogTopic == null || scoredCandidates.MatchCount == 0;

                previewResults.Add(new AutoAssignPreviewDto
                {
                    StudentCode = student.StudentCode,
                    StudentName = student.FullName ?? string.Empty,
                    StudentDepartment = student.DepartmentCode ?? string.Empty,
                    CatalogTopicCode = catalogTopic?.CatalogTopicCode ?? string.Empty,
                    TopicTitle = catalogTopic?.Title ?? $"Đề tài tốt nghiệp - {student.FullName}",
                    SupervisorLecturerCode = bestLecturer.LecturerCode,
                    SupervisorLecturerName = bestLecturer.FullName ?? string.Empty,
                    MatchTagsCount = scoredCandidates.MatchCount,
                    IsFallback = isFallback,
                    CommonTags = scoredCandidates.CommonTagNames
                });
            }

            return Ok(ApiResponse<List<AutoAssignPreviewDto>>.SuccessResponse(previewResults));
        }

        [HttpPost("auto-assign/confirm")]
        public async Task<IActionResult> AutoAssignConfirm([FromBody] List<AutoAssignAssignmentDto> assignments)
        {
            if (assignments == null || assignments.Count == 0)
                return BadRequest(ApiResponse<object>.Fail("Danh sách phân công trống.", 400));

            var studentCodes = assignments.Select(a => a.StudentCode).ToList();
            var lecturerCodes = assignments.Select(a => a.SupervisorLecturerCode).ToList();
            var catalogCodes = assignments.Select(a => a.CatalogTopicCode).Where(c => !string.IsNullOrEmpty(c)).ToList();

            var students = await _context.StudentProfiles.Where(s => studentCodes.Contains(s.StudentCode)).ToDictionaryAsync(s => s.StudentCode);
            var lecturers = await _context.LecturerProfiles.Where(l => lecturerCodes.Contains(l.LecturerCode)).ToDictionaryAsync(l => l.LecturerCode);
            var catalogs = await _context.CatalogTopics.Where(c => catalogCodes.Contains(c.CatalogTopicCode)).ToDictionaryAsync(c => c.CatalogTopicCode);

            // Preload tags mapping for copying catalog tags to new topics
            var catalogTopicTagsList = await _context.CatalogTopicTags
                .Where(ctt => ctt.CatalogTopicCode != null && catalogCodes.Contains(ctt.CatalogTopicCode))
                .ToListAsync();
            var catalogTopicTagsMap = catalogTopicTagsList
                .GroupBy(ctt => ctt.CatalogTopicCode!)
                .ToDictionary(g => g.Key, g => g.ToList());

            // Sequence counters for ID and Code generation
            var maxMilestoneId = await _context.ProgressMilestones.Select(x => (int?)x.MilestoneID).MaxAsync() ?? 0;
            var nextMilestoneId = maxMilestoneId + 1;

            var now = DateTime.UtcNow;
            var codePrefix = $"MS{now:yyMMdd}";
            var recentCodes = await _context.ProgressMilestones
                .Where(x => x.MilestoneCode.StartsWith(codePrefix))
                .OrderByDescending(x => x.MilestoneCode)
                .Take(1)
                .Select(x => x.MilestoneCode)
                .ToListAsync();

            var lastCode = recentCodes.FirstOrDefault();
            var sequence = 1;
            if (!string.IsNullOrWhiteSpace(lastCode) && lastCode.Length >= codePrefix.Length + 3)
            {
                var suffix = lastCode.Substring(codePrefix.Length, 3);
                if (int.TryParse(suffix, out var parsed))
                    sequence = parsed + 1;
            }

            var today = DateTime.Now.ToString("yyyyMMdd");
            var topicPrefix = $"TOP{today}";
            var lastTopic = await _context.Topics
                .Where(t => t.TopicCode.StartsWith(topicPrefix))
                .OrderByDescending(t => t.TopicCode)
                .FirstOrDefaultAsync();

            var nextTopicNumber = 1;
            if (lastTopic != null)
            {
                var lastCodeTopic = lastTopic.TopicCode;
                if (lastCodeTopic.Length > topicPrefix.Length && int.TryParse(lastCodeTopic.Substring(topicPrefix.Length), out var lastNum))
                {
                    nextTopicNumber = lastNum + 1;
                }
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                foreach (var assignment in assignments)
                {
                    if (!students.TryGetValue(assignment.StudentCode, out var student) ||
                        !lecturers.TryGetValue(assignment.SupervisorLecturerCode, out var lecturer))
                    {
                        continue;
                    }

                    var topicCode = $"{topicPrefix}{nextTopicNumber++:D3}";
                    var catalogTopic = !string.IsNullOrEmpty(assignment.CatalogTopicCode) && catalogs.TryGetValue(assignment.CatalogTopicCode, out var cat)
                        ? cat
                        : null;

                    var topicEntity = new Topic
                    {
                        TopicCode = topicCode,
                        Title = assignment.TopicTitle,
                        Summary = catalogTopic?.Summary,
                        Type = catalogTopic == null ? "SELF" : "CATALOG",
                        ProposerUserID = student.UserID ?? 0,
                        ProposerUserCode = student.UserCode,
                        ProposerStudentProfileID = student.StudentProfileID,
                        ProposerStudentCode = student.StudentCode,
                        SupervisorUserID = lecturer.UserID ?? 0,
                        SupervisorUserCode = lecturer.UserCode,
                        SupervisorLecturerProfileID = lecturer.LecturerProfileID,
                        SupervisorLecturerCode = lecturer.LecturerCode,
                        CatalogTopicID = catalogTopic?.CatalogTopicID,
                        CatalogTopicCode = catalogTopic?.CatalogTopicCode,
                        DepartmentID = student.DepartmentID,
                        DepartmentCode = student.DepartmentCode,
                        DefenseTermId = student.DefenseTermId,
                        Status = "Đã duyệt",
                        CreatedAt = DateTime.UtcNow,
                        LastUpdated = DateTime.UtcNow
                    };

                    _context.Topics.Add(topicEntity);
                    await _context.SaveChangesAsync(); // populated TopicID

                    // 1. Initial Milestone Link (MS_PROG1 because registration is auto-approved)
                    var milestoneEntity = new ProgressMilestone
                    {
                        MilestoneID = nextMilestoneId++,
                        MilestoneCode = $"{codePrefix}{sequence++:D3}",
                        TopicID = topicEntity.TopicID,
                        TopicCode = topicEntity.TopicCode,
                        MilestoneTemplateCode = "MS_PROG1",
                        Ordinal = 2,
                        State = "Đang thực hiện",
                        CompletedAt1 = DateTime.UtcNow,
                        CreatedAt = DateTime.UtcNow,
                        LastUpdated = DateTime.UtcNow
                    };
                    _context.ProgressMilestones.Add(milestoneEntity);

                    // 2. Primary TopicLecturer link
                    var topicLecturer = new TopicLecturer
                    {
                        TopicID = topicEntity.TopicID,
                        TopicCode = topicEntity.TopicCode,
                        LecturerProfileID = lecturer.LecturerProfileID,
                        LecturerCode = lecturer.LecturerCode,
                        IsPrimary = true,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.TopicLecturers.Add(topicLecturer);

                    // 3. Copy Tags from catalog topic to TopicTags
                    if (catalogTopic != null && catalogTopicTagsMap.TryGetValue(catalogTopic.CatalogTopicCode, out var tags))
                    {
                        foreach (var tag in tags)
                        {
                            var topicTag = new TopicTag
                            {
                                TopicCode = topicEntity.TopicCode,
                                CatalogTopicCode = null,
                                TagID = tag.TagID,
                                TagCode = tag.TagCode,
                                CreatedAt = DateTime.UtcNow
                            };
                            _context.TopicTags.Add(topicTag);
                        }
                    }

                    // 4. Update guiding capacity
                    lecturer.CurrentGuidingCount++;
                    _context.LecturerProfiles.Update(lecturer);

                    // 5. Update catalog topic status
                    if (catalogTopic != null)
                    {
                        catalogTopic.AssignedStatus = "Đã giao";
                        catalogTopic.AssignedAt = DateTime.UtcNow;
                        _context.CatalogTopics.Update(catalogTopic);
                    }
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(ApiResponse<object>.SuccessResponse(new { message = "Phân công đề tài tự động thành công." }));
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, ApiResponse<object>.Fail($"Lỗi khi lưu phân công: {ex.Message}", 500));
            }
        }
    }
}
