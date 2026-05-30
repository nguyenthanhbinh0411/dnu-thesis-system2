using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OfficeOpenXml;
using ThesisManagement.Api.DTOs.DataExchange;
using ThesisManagement.Api.Models;
using ThesisManagement.Api.Data;

namespace ThesisManagement.Api.Services.DataExchange
{
    public class DataExchangeService : IDataExchangeService
    {
        private readonly IUnitOfWork _uow;
        private readonly ICodeGenerator _codeGenerator;
        private readonly IAuthService _authService;
        private readonly ApplicationDbContext _db;

        public DataExchangeService(IUnitOfWork uow, ICodeGenerator codeGenerator, IAuthService authService, ApplicationDbContext db)
        {
            _uow = uow;
            _codeGenerator = codeGenerator;
            _authService = authService;
            _db = db;
            ExcelPackage.License.SetNonCommercialPersonal("ThesisManagement.Api");
        }

        public async Task<DataImportResultDto> ImportAsync(string module, IFormFile file, string? format)
        {
            var normalizedModule = NormalizeModule(module);
            var normalizedFormat = NormalizeFormat(format, file.FileName);
            var rows = await ReadRowsAsync(file, normalizedFormat);

            var result = new DataImportResultDto
            {
                Module = normalizedModule,
                Format = normalizedFormat,
                TotalRows = rows.Count
            };

            foreach (var (row, index) in rows.Select((value, i) => (value, i + 2)))
            {
                try
                {
                    var (upsertResult, code) = await UpsertRowAsync(normalizedModule, row);
                    if (upsertResult == UpsertAction.Created)
                    {
                        result.CreatedCount++;
                        if (!string.IsNullOrWhiteSpace(code))
                        {
                            result.CreatedCodes.Add(code);
                        }
                    }
                    else if (upsertResult == UpsertAction.Updated)
                    {
                        result.UpdatedCount++;
                    }
                    else
                    {
                        result.FailedCount++;
                        result.Errors.Add($"Row {index}: no changes applied");
                    }
                }
                catch (Exception ex)
                {
                    result.FailedCount++;
                    result.Errors.Add($"Row {index}: {ex.Message}");
                }
            }

            return result;
        }

        public async Task RollbackAsync(string module, List<string> createdCodes)
        {
            if (createdCodes == null || createdCodes.Count == 0)
                return;

            var normalizedModule = NormalizeModule(module);
            switch (normalizedModule)
            {
                case "students":
                    var students = await _uow.StudentProfiles.Query()
                        .Where(x => createdCodes.Contains(x.StudentCode))
                        .ToListAsync();
                    foreach (var s in students)
                    {
                        _uow.StudentProfiles.Remove(s);
                    }
                    break;

                case "lecturers":
                    var lecturers = await _uow.LecturerProfiles.Query()
                        .Where(x => createdCodes.Contains(x.LecturerCode))
                        .ToListAsync();
                    var lecturerIds = lecturers.Select(x => x.LecturerProfileID).ToList();
                    var lecturerTags = await _uow.LecturerTags.Query()
                        .Where(x => lecturerIds.Contains(x.LecturerProfileID))
                        .ToListAsync();
                    foreach (var lt in lecturerTags)
                    {
                        _uow.LecturerTags.Remove(lt);
                    }
                    foreach (var l in lecturers)
                    {
                        _uow.LecturerProfiles.Remove(l);
                    }
                    break;

                case "departments":
                    var departments = await _uow.Departments.Query()
                        .Where(x => createdCodes.Contains(x.DepartmentCode!))
                        .ToListAsync();
                    foreach (var d in departments)
                    {
                        _uow.Departments.Remove(d);
                    }
                    break;

                case "catalogtopics":
                    var catalogs = await _uow.CatalogTopics.Query()
                        .Where(x => createdCodes.Contains(x.CatalogTopicCode))
                        .ToListAsync();
                    var catalogIds = catalogs.Select(x => x.CatalogTopicID).ToList();
                    var topicTags = await _uow.CatalogTopicTags.Query()
                        .Where(x => catalogIds.Contains(x.CatalogTopicID))
                        .ToListAsync();
                    foreach (var tt in topicTags)
                    {
                        _uow.CatalogTopicTags.Remove(tt);
                    }
                    foreach (var c in catalogs)
                    {
                        _uow.CatalogTopics.Remove(c);
                    }
                    break;

                case "topics":
                    var topics = await _uow.Topics.Query()
                        .Where(x => createdCodes.Contains(x.TopicCode))
                        .ToListAsync();
                    foreach (var t in topics)
                    {
                        _uow.Topics.Remove(t);
                    }
                    break;

                case "tags":
                    var tags = await _uow.Tags.Query()
                        .Where(x => createdCodes.Contains(x.TagCode))
                        .ToListAsync();
                    foreach (var tg in tags)
                    {
                        _uow.Tags.Remove(tg);
                    }
                    break;
            }

            await _uow.SaveChangesAsync();
        }

        public Task<DataExportResultDto> ExportAsync(string module, string? format)
        {
            var normalizedModule = NormalizeModule(module);
            var normalizedFormat = NormalizeFormat(format, null);

            var rows = normalizedModule switch
            {
                "students" => ExportStudentRows(),
                "lecturers" => ExportLecturerRows(),
                "departments" => ExportDepartmentRows(),
                "catalogtopics" => ExportCatalogTopicRows(),
                "topics" => ExportTopicRows(),
                "tags" => ExportTagRows(),
                _ => throw new InvalidOperationException("Unsupported module")
            };

            var fileBytes = normalizedFormat switch
            {
                "json" => ExportJson(rows),
                "csv" => ExportCsv(rows),
                "xlsx" => ExportXlsx(rows, normalizedModule),
                _ => throw new InvalidOperationException("Unsupported export format")
            };

            var extension = normalizedFormat;
            var fileName = $"{normalizedModule}-export-{DateTime.UtcNow:yyyyMMddHHmmss}.{extension}";
            var contentType = normalizedFormat switch
            {
                "json" => "application/json",
                "csv" => "text/csv",
                "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                _ => "application/octet-stream"
            };

            return Task.FromResult(new DataExportResultDto
            {
                Module = normalizedModule,
                Format = normalizedFormat,
                FileName = fileName,
                TotalRows = rows.Count,
                Content = fileBytes,
                ContentType = contentType
            });
        }

        private async Task<(UpsertAction Action, string Code)> UpsertRowAsync(string module, Dictionary<string, string> row)
        {
            return module switch
            {
                "students" => await UpsertStudentAsync(row),
                "lecturers" => await UpsertLecturerAsync(row),
                "departments" => await UpsertDepartmentAsync(row),
                "catalogtopics" => await UpsertCatalogTopicAsync(row),
                "topics" => await UpsertTopicAsync(row),
                "tags" => await UpsertTagAsync(row),
                _ => (UpsertAction.Failed, string.Empty)
            };
        }

        private async Task<(UpsertAction Action, string Code)> UpsertCatalogTopicAsync(Dictionary<string, string> row)
        {
            var catalogTopicCode = Get(row, "catalogTopicCode");
            var title = Required(row, "title");
            var tagColumnNames = new[] { "tagCodes", "tags", "tag", "tag_codes", "tag code", "tag codes" };
            var tagCodesKey = tagColumnNames.FirstOrDefault(k => row.ContainsKey(k));
            var hasTagCodesColumn = tagCodesKey != null;
            var rawTagCodes = tagCodesKey != null ? row[tagCodesKey] : string.Empty;
            var incomingTagCodes = ParseCodeList(rawTagCodes)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            // Business rule: if any tagCode does not exist, reject the whole row
            // and do not write to both CatalogTopics and CatalogTopicTags.
            var existingTagMap = new Dictionary<string, Tag>(StringComparer.OrdinalIgnoreCase);
            foreach (var tagCode in incomingTagCodes)
            {
                var tag = await _uow.Tags.GetByCodeAsync(tagCode);
                if (tag == null)
                {
                    throw new InvalidOperationException($"tagCode '{tagCode}' does not exist");
                }

                existingTagMap[tagCode] = tag;
            }

            CatalogTopic? entity = null;
            if (!string.IsNullOrWhiteSpace(catalogTopicCode))
            {
                var trimmedCode = catalogTopicCode.Trim();
                var local = _db.CatalogTopics.Local
                    .FirstOrDefault(x => string.Equals(x.CatalogTopicCode, trimmedCode, StringComparison.OrdinalIgnoreCase));
                if (local != null)
                {
                    entity = local;
                }
                else
                {
                    entity = await _uow.CatalogTopics.GetByCodeAsync(trimmedCode);
                }
            }

            var departmentCode = Get(row, "departmentCode");
            var department = !string.IsNullOrWhiteSpace(departmentCode)
                ? await _uow.Departments.GetByCodeAsync(departmentCode)
                : null;

            var lecturerCodeVal = Get(row, "lecturerCode") ?? Get(row, "lecturer_code");
            var lecturerNameVal = Get(row, "lecturerName") ?? Get(row, "lecturer_name") ?? Get(row, "fullName") ?? Get(row, "full_name");
            LecturerProfile? lecturer = null;
            if (!string.IsNullOrWhiteSpace(lecturerCodeVal))
            {
                lecturer = await _uow.LecturerProfiles.GetByCodeAsync(lecturerCodeVal.Trim());
            }

            var finalLecturerCode = lecturer?.LecturerCode ?? lecturerCodeVal;
            var finalLecturerName = lecturer?.FullName ?? lecturerNameVal;

            var activePeriod = await _uow.DefenseTerms.Query()
                .Where(x => x.Status != "Closed" && x.Status != "Archived")
                .OrderByDescending(x => x.DefenseTermId)
                .FirstOrDefaultAsync();

            var defenseTermIdStr = Get(row, "defenseTermId") ?? Get(row, "defense_term_id");
            var defenseTermCodeVal = Get(row, "defenseTermCode") ?? Get(row, "defense_term_code") ?? Get(row, "termCode") ?? Get(row, "term_code");
            int? parsedDefenseTermId = null;

            if (!string.IsNullOrWhiteSpace(defenseTermIdStr) && int.TryParse(defenseTermIdStr, out var idVal))
            {
                parsedDefenseTermId = idVal;
            }
            else if (!string.IsNullOrWhiteSpace(defenseTermCodeVal))
            {
                var term = await _uow.DefenseTerms.Query()
                    .FirstOrDefaultAsync(x => x.TermCode == defenseTermCodeVal.Trim());
                if (term != null)
                {
                    parsedDefenseTermId = term.DefenseTermId;
                }
            }

            if (parsedDefenseTermId == null && activePeriod != null)
            {
                parsedDefenseTermId = activePeriod.DefenseTermId;
            }

            var action = UpsertAction.Updated;

            if (entity == null)
            {
                entity = new CatalogTopic
                {
                    CatalogTopicCode = string.IsNullOrWhiteSpace(catalogTopicCode)
                        ? _codeGenerator.Generate("CT")
                        : catalogTopicCode,
                    Title = title,
                    Summary = Get(row, "summary"),
                    DepartmentCode = department?.DepartmentCode,
                    DepartmentID = department?.DepartmentID,
                    AssignedStatus = Get(row, "assignedStatus"),
                    AssignedAt = ParseDate(Get(row, "assignedAt")),
                    LecturerCode = finalLecturerCode,
                    LecturerName = finalLecturerName,
                    DefenseTermId = parsedDefenseTermId,
                    CreatedAt = DateTime.UtcNow,
                    LastUpdated = DateTime.UtcNow
                };

                await _uow.CatalogTopics.AddAsync(entity);
                await _uow.SaveChangesAsync();
                action = UpsertAction.Created;
            }
            else
            {
                entity.Title = title;
                entity.Summary = Get(row, "summary") ?? entity.Summary;
                entity.DepartmentCode = department?.DepartmentCode;
                entity.DepartmentID = department?.DepartmentID;
                entity.AssignedStatus = Get(row, "assignedStatus") ?? entity.AssignedStatus;
                entity.AssignedAt = ParseDate(Get(row, "assignedAt")) ?? entity.AssignedAt;
                if (!string.IsNullOrWhiteSpace(finalLecturerCode))
                {
                    entity.LecturerCode = finalLecturerCode;
                }
                if (!string.IsNullOrWhiteSpace(finalLecturerName))
                {
                    entity.LecturerName = finalLecturerName;
                }
                entity.DefenseTermId = parsedDefenseTermId ?? entity.DefenseTermId;
                entity.LastUpdated = DateTime.UtcNow;
                await _uow.SaveChangesAsync();
            }

            if (hasTagCodesColumn)
            {
                await SyncCatalogTopicTagsAsync(entity.CatalogTopicID, incomingTagCodes, existingTagMap);
            }

            return (action, entity.CatalogTopicCode);
        }

        private async Task SyncCatalogTopicTagsAsync(
            int catalogTopicId,
            IReadOnlyList<string> incomingTagCodes,
            IReadOnlyDictionary<string, Tag> existingTagMap)
        {
            var tagIds = new HashSet<int>();
            foreach (var tagCode in incomingTagCodes)
            {
                if (!existingTagMap.TryGetValue(tagCode, out var tag))
                    throw new InvalidOperationException($"tagCode '{tagCode}' does not exist");
                tagIds.Add(tag.TagID);
            }

            var existingLinks = _uow.CatalogTopicTags.Query()
                .Where(x => x.CatalogTopicID == catalogTopicId)
                .ToList();

            foreach (var link in existingLinks)
            {
                if (!tagIds.Contains(link.TagID))
                {
                    _uow.CatalogTopicTags.Remove(link);
                }
            }

            var catalogTopic = await _uow.CatalogTopics.GetByIdAsync(catalogTopicId);
            var catalogTopicCode = catalogTopic?.CatalogTopicCode;

            foreach (var tagId in tagIds)
            {
                if (existingLinks.Any(x => x.TagID == tagId))
                    continue;

                var tag = existingTagMap.Values.FirstOrDefault(x => x.TagID == tagId);
                var tagCode = tag?.TagCode;

                await _uow.CatalogTopicTags.AddAsync(new CatalogTopicTag
                {
                    CatalogTopicID = catalogTopicId,
                    TagID = tagId,
                    CatalogTopicCode = catalogTopicCode,
                    TagCode = tagCode,
                    CreatedAt = DateTime.UtcNow
                });
            }

            await _uow.SaveChangesAsync();
        }

        private async Task<(UpsertAction Action, string Code)> UpsertTagAsync(Dictionary<string, string> row)
        {
            var tagCode = Get(row, "tagCode");
            var tagName = Required(row, "tagName");

            Tag? entity = null;
            if (!string.IsNullOrWhiteSpace(tagCode))
            {
                var trimmedCode = tagCode.Trim();
                var local = _db.Tags.Local
                    .FirstOrDefault(x => string.Equals(x.TagCode, trimmedCode, StringComparison.OrdinalIgnoreCase));
                if (local != null)
                {
                    entity = local;
                }
                else
                {
                    entity = await _uow.Tags.GetByCodeAsync(trimmedCode);
                }
            }

            if (entity == null)
            {
                entity = new Tag
                {
                    TagCode = string.IsNullOrWhiteSpace(tagCode) ? _codeGenerator.Generate("TAG") : tagCode,
                    TagName = tagName,
                    Description = Get(row, "description"),
                    CreatedAt = DateTime.UtcNow
                };

                await _uow.Tags.AddAsync(entity);
                await _uow.SaveChangesAsync();
                return (UpsertAction.Created, entity.TagCode);
            }

            entity.TagName = tagName;
            entity.Description = Get(row, "description") ?? entity.Description;

            await _uow.SaveChangesAsync();
            return (UpsertAction.Updated, entity.TagCode);
        }

        private async Task<(UpsertAction Action, string Code)> UpsertStudentAsync(Dictionary<string, string> row)
        {
            var studentCode = Get(row, "studentCode");
            var effectiveStudentCode = string.IsNullOrWhiteSpace(studentCode) ? _codeGenerator.Generate("STU") : studentCode!.Trim();

            var departmentCode = Get(row, "departmentCode");
            var department = !string.IsNullOrWhiteSpace(departmentCode)
                ? await _uow.Departments.GetByCodeAsync(departmentCode)
                : null;

            var activePeriod = await _uow.DefenseTerms.Query()
                .Where(x => x.Status != "Closed" && x.Status != "Archived")
                .OrderByDescending(x => x.DefenseTermId)
                .FirstOrDefaultAsync();

            // Resolve ClassID and ClassCode from row
            var classCode = Get(row, "classCode") ?? Get(row, "class_code") ?? Get(row, "class");
            var classIdVal = ParseInt(Get(row, "classID")) ?? ParseInt(Get(row, "classId"));
            Class? studentClass = null;

            if (classIdVal != null)
            {
                studentClass = await _uow.Classes.Query().FirstOrDefaultAsync(x => x.ClassID == classIdVal.Value);
            }
            else if (!string.IsNullOrWhiteSpace(classCode))
            {
                studentClass = await _uow.Classes.Query().FirstOrDefaultAsync(x => x.ClassCode == classCode);
            }

            var finalClassId = studentClass?.ClassID;
            var finalClassCode = studentClass?.ClassCode ?? classCode;

            // Resolve DefenseTermId from row with fallback to activePeriod
            var rowDefenseTermId = ParseInt(Get(row, "defenseTermId")) ?? ParseInt(Get(row, "defenseTermID"));
            var targetDefenseTermId = rowDefenseTermId;
            if (targetDefenseTermId == null && activePeriod != null)
            {
                targetDefenseTermId = activePeriod.DefenseTermId;
            }

            var defenseTerm = targetDefenseTermId != null
                ? await _uow.DefenseTerms.GetByIdAsync(targetDefenseTermId.Value)
                : null;
            var finalDefenseTermId = defenseTerm?.DefenseTermId;

            StudentProfile? entity = null;
            if (!string.IsNullOrWhiteSpace(studentCode))
            {
                var trimmedCode = studentCode.Trim();
                var local = _db.StudentProfiles.Local
                    .FirstOrDefault(x => string.Equals(x.StudentCode, trimmedCode, StringComparison.OrdinalIgnoreCase));
                if (local != null)
                {
                    entity = local;
                }
                else
                {
                    entity = await _uow.StudentProfiles.GetByCodeAsync(trimmedCode);
                }
            }

            if (entity == null)
            {
                entity = new StudentProfile
                {
                    StudentCode = effectiveStudentCode,
                    UserCode = null,
                    UserID = null,
                    DepartmentCode = department?.DepartmentCode,
                    DepartmentID = department?.DepartmentID,
                    ClassID = finalClassId,
                    ClassCode = finalClassCode,
                    FullName = Get(row, "fullName"),
                    StudentEmail = Get(row, "studentEmail"),
                    PhoneNumber = Get(row, "phoneNumber"),
                    EnrollmentYear = ParseInt(Get(row, "enrollmentYear")),
                    GraduationYear = ParseInt(Get(row, "graduationYear")),
                    Status = Get(row, "status") ?? "Đang học",
                    Gender = Get(row, "gender"),
                    DateOfBirth = ParseDate(Get(row, "dateOfBirth")),
                    GPA = ParseDecimal(Get(row, "gpa")),
                    Address = Get(row, "address"),
                    Notes = Get(row, "notes"),
                    DefenseTermId = finalDefenseTermId,
                    CreatedAt = DateTime.UtcNow,
                    LastUpdated = DateTime.UtcNow
                };

                await _uow.StudentProfiles.AddAsync(entity);
                await _uow.SaveChangesAsync();

                return (UpsertAction.Created, entity.StudentCode);
            }

            // Duplicate student code: overwrite all data and update to the resolved defense term
            entity.DepartmentCode = department?.DepartmentCode;
            entity.DepartmentID = department?.DepartmentID;
            entity.ClassID = finalClassId;
            entity.ClassCode = finalClassCode;
            entity.FullName = Get(row, "fullName") ?? entity.FullName;
            entity.StudentEmail = Get(row, "studentEmail") ?? entity.StudentEmail;
            entity.PhoneNumber = Get(row, "phoneNumber") ?? entity.PhoneNumber;

            var enrollmentYearVal = ParseInt(Get(row, "enrollmentYear"));
            if (enrollmentYearVal != null)
            {
                entity.EnrollmentYear = enrollmentYearVal.Value;
            }

            var graduationYearVal = ParseInt(Get(row, "graduationYear"));
            if (graduationYearVal != null)
            {
                entity.GraduationYear = graduationYearVal.Value;
            }

            entity.Status = Get(row, "status") ?? entity.Status ?? "Đang học";
            entity.Gender = Get(row, "gender") ?? entity.Gender;
            entity.DateOfBirth = ParseDate(Get(row, "dateOfBirth")) ?? entity.DateOfBirth;
            entity.GPA = ParseDecimal(Get(row, "gpa")) ?? entity.GPA;
            entity.Address = Get(row, "address") ?? entity.Address;
            entity.Notes = Get(row, "notes") ?? entity.Notes;
            entity.DefenseTermId = finalDefenseTermId ?? entity.DefenseTermId;
            entity.LastUpdated = DateTime.UtcNow;

            await _uow.SaveChangesAsync();

            return (UpsertAction.Updated, entity.StudentCode);
        }

        private async Task<(UpsertAction Action, string Code)> UpsertLecturerAsync(Dictionary<string, string> row)
        {
            var lecturerCode = Get(row, "lecturerCode");
            var effectiveLecturerCode = string.IsNullOrWhiteSpace(lecturerCode) ? _codeGenerator.Generate("LEC") : lecturerCode!.Trim();

            // Robust column detection for tags (support multiple aliases)
            var tagColumnNames = new[] { "tagCodes", "tags", "tag", "tag_codes", "tag code", "tag codes" };
            var tagCodesKey = tagColumnNames.FirstOrDefault(k => row.ContainsKey(k));
            var hasTagCodesColumn = tagCodesKey != null;
            var rawTagCodes = tagCodesKey != null ? row[tagCodesKey] : string.Empty;
            var incomingTagCodes = ParseCodeList(rawTagCodes)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            // Business rule: if any tagCode does not exist, reject the row.
            // This avoids FE calling many APIs and keeps import behavior consistent.
            var existingTagMap = new Dictionary<string, Tag>(StringComparer.OrdinalIgnoreCase);
            foreach (var tagCode in incomingTagCodes)
            {
                var tag = await _uow.Tags.GetByCodeAsync(tagCode);
                if (tag == null)
                {
                    throw new InvalidOperationException($"tagCode '{tagCode}' does not exist");
                }

                existingTagMap[tagCode] = tag;
            }

            var departmentCode = Get(row, "departmentCode");
            var department = !string.IsNullOrWhiteSpace(departmentCode)
                ? await _uow.Departments.GetByCodeAsync(departmentCode)
                : null;

            var activePeriod = await _uow.DefenseTerms.Query()
                .Where(x => x.Status != "Closed" && x.Status != "Archived")
                .OrderByDescending(x => x.DefenseTermId)
                .FirstOrDefaultAsync();

            // Resolve DefenseTermId from row with fallback to activePeriod
            var rowDefenseTermId = ParseInt(Get(row, "defenseTermId")) ?? ParseInt(Get(row, "defenseTermID"));
            var targetDefenseTermId = rowDefenseTermId;
            if (targetDefenseTermId == null && activePeriod != null)
            {
                targetDefenseTermId = activePeriod.DefenseTermId;
            }

            var defenseTerm = targetDefenseTermId != null
                ? await _uow.DefenseTerms.GetByIdAsync(targetDefenseTermId.Value)
                : null;
            var finalDefenseTermId = defenseTerm?.DefenseTermId;

            LecturerProfile? entity = null;
            if (!string.IsNullOrWhiteSpace(lecturerCode))
            {
                var trimmedCode = lecturerCode.Trim();
                var local = _db.LecturerProfiles.Local
                    .FirstOrDefault(x => string.Equals(x.LecturerCode, trimmedCode, StringComparison.OrdinalIgnoreCase));
                if (local != null)
                {
                    entity = local;
                }
                else
                {
                    entity = await _uow.LecturerProfiles.GetByCodeAsync(trimmedCode);
                }
            }

            if (entity == null)
            {
                entity = new LecturerProfile
                {
                    LecturerCode = effectiveLecturerCode,
                    UserCode = null,
                    UserID = null,
                    DepartmentCode = department?.DepartmentCode,
                    DepartmentID = department?.DepartmentID,
                    FullName = Get(row, "fullName"),
                    Degree = Get(row, "degree"),
                    Email = Get(row, "email"),
                    PhoneNumber = Get(row, "phoneNumber"),
                    GuideQuota = ParseInt(Get(row, "guideQuota")) ?? 10,
                    DefenseQuota = ParseInt(Get(row, "defenseQuota")) ?? 8,
                    CurrentGuidingCount = ParseInt(Get(row, "currentGuidingCount")) ?? 0,
                    Gender = Get(row, "gender"),
                    DateOfBirth = ParseDate(Get(row, "dateOfBirth")),
                    Address = Get(row, "address"),
                    Specialties = Get(row, "specialties"),
                    Organization = Get(row, "organization"),
                    Notes = Get(row, "notes"),
                    DefenseTermId = finalDefenseTermId,
                    CreatedAt = DateTime.UtcNow,
                    LastUpdated = DateTime.UtcNow
                };

                await _uow.LecturerProfiles.AddAsync(entity);
                await _uow.SaveChangesAsync();

                if (hasTagCodesColumn)
                {
                    await SyncLecturerTagsAsync(entity.LecturerProfileID, entity.LecturerCode, incomingTagCodes, existingTagMap, Get(row, "assignedByUserCode"));
                }

                return (UpsertAction.Created, entity.LecturerCode);
            }

            // Duplicate lecturer code: overwrite all data and update to the resolved defense term
            entity.DepartmentCode = department?.DepartmentCode;
            entity.DepartmentID = department?.DepartmentID;
            entity.FullName = Get(row, "fullName") ?? entity.FullName;
            entity.Degree = Get(row, "degree") ?? entity.Degree;
            entity.Email = Get(row, "email") ?? entity.Email;
            entity.PhoneNumber = Get(row, "phoneNumber") ?? entity.PhoneNumber;

            var guideQuotaVal = ParseInt(Get(row, "guideQuota"));
            if (guideQuotaVal != null)
            {
                entity.GuideQuota = guideQuotaVal.Value;
            }

            var defenseQuotaVal = ParseInt(Get(row, "defenseQuota"));
            if (defenseQuotaVal != null)
            {
                entity.DefenseQuota = defenseQuotaVal.Value;
            }

            var currentGuidingCountVal = ParseInt(Get(row, "currentGuidingCount"));
            if (currentGuidingCountVal != null)
            {
                entity.CurrentGuidingCount = currentGuidingCountVal.Value;
            }
            else if (finalDefenseTermId != null && entity.DefenseTermId != finalDefenseTermId)
            {
                entity.CurrentGuidingCount = 0;
            }

            entity.Gender = Get(row, "gender") ?? entity.Gender;
            entity.DateOfBirth = ParseDate(Get(row, "dateOfBirth")) ?? entity.DateOfBirth;
            entity.Address = Get(row, "address") ?? entity.Address;
            entity.Specialties = Get(row, "specialties") ?? entity.Specialties;
            entity.Organization = Get(row, "organization") ?? entity.Organization;
            entity.Notes = Get(row, "notes") ?? entity.Notes;
            entity.DefenseTermId = finalDefenseTermId ?? entity.DefenseTermId;
            entity.LastUpdated = DateTime.UtcNow;

            await _uow.SaveChangesAsync();

            if (hasTagCodesColumn)
            {
                await SyncLecturerTagsAsync(entity.LecturerProfileID, entity.LecturerCode, incomingTagCodes, existingTagMap, Get(row, "assignedByUserCode"));
            }

            return (UpsertAction.Updated, entity.LecturerCode);
        }

        private async Task SyncLecturerTagsAsync(
            int lecturerProfileId,
            string lecturerCode,
            IReadOnlyList<string> incomingTagCodes,
            IReadOnlyDictionary<string, Tag> existingTagMap,
            string? assignedByUserCode)
        {
            var tagIds = new HashSet<int>();
            foreach (var tagCode in incomingTagCodes)
            {
                if (!existingTagMap.TryGetValue(tagCode, out var tag))
                    throw new InvalidOperationException($"tagCode '{tagCode}' does not exist");

                tagIds.Add(tag.TagID);
            }

            int? assignedByUserId = null;
            string? normalizedAssignedByUserCode = null;
            if (!string.IsNullOrWhiteSpace(assignedByUserCode))
            {
                normalizedAssignedByUserCode = assignedByUserCode.Trim();
                var assignedByUser = await _uow.Users.GetByCodeAsync(normalizedAssignedByUserCode);
                if (assignedByUser == null)
                {
                    throw new InvalidOperationException($"assignedByUserCode '{normalizedAssignedByUserCode}' does not exist");
                }

                assignedByUserId = assignedByUser.UserID;
            }

            var existingLinks = _uow.LecturerTags.Query()
                .Where(x => x.LecturerProfileID == lecturerProfileId)
                .ToList();

            foreach (var link in existingLinks)
            {
                if (!tagIds.Contains(link.TagID))
                {
                    _uow.LecturerTags.Remove(link);
                }
            }

            foreach (var tagId in tagIds)
            {
                var tag = existingTagMap.Values.FirstOrDefault(t => t.TagID == tagId);
                if (tag == null) continue;

                var existing = existingLinks.FirstOrDefault(x => x.TagID == tagId);
                if (existing != null)
                {
                    existing.LecturerCode = lecturerCode;
                    existing.TagCode = tag.TagCode;
                    existing.AssignedByUserID = assignedByUserId;
                    existing.AssignedByUserCode = normalizedAssignedByUserCode;
                    existing.AssignedAt = DateTime.UtcNow;
                    _uow.LecturerTags.Update(existing);
                }
                else
                {
                    await _uow.LecturerTags.AddAsync(new LecturerTag
                    {
                        LecturerProfileID = lecturerProfileId,
                        LecturerCode = lecturerCode,
                        TagID = tagId,
                        TagCode = tag.TagCode,
                        AssignedAt = DateTime.UtcNow,
                        AssignedByUserID = assignedByUserId,
                        AssignedByUserCode = normalizedAssignedByUserCode
                    });
                }
            }

            await _uow.SaveChangesAsync();
        }

        private async Task<User> EnsureImportUserAsync(string userCode, string passwordSeed, string expectedRole)
        {
            if (string.IsNullOrWhiteSpace(userCode))
                throw new InvalidOperationException("UserCode is required");

            var normalizedCode = userCode.Trim();
            var user = await _uow.Users.Query()
                .FirstOrDefaultAsync(x => x.UserCode == normalizedCode);

            if (user == null)
            {
                user = new User
                {
                    UserCode = normalizedCode,
                    PasswordHash = _authService.HashPassword(System.Guid.NewGuid().ToString("N")),
                    Role = expectedRole,
                    CreatedAt = DateTime.UtcNow,
                    LastUpdated = DateTime.UtcNow
                };

                await _uow.Users.AddAsync(user);
                await _uow.SaveChangesAsync();
                return user;
            }

            if (!string.Equals(user.Role, expectedRole, StringComparison.OrdinalIgnoreCase))
            {
                user.Role = expectedRole;
                user.LastUpdated = DateTime.UtcNow;
                _uow.Users.Update(user);
                await _uow.SaveChangesAsync();
            }

            return user;
        }

        private async Task<(UpsertAction Action, string Code)> UpsertDepartmentAsync(Dictionary<string, string> row)
        {
            var departmentCode = Get(row, "departmentCode");
            var name = Required(row, "name");

            Department? entity = null;
            if (!string.IsNullOrWhiteSpace(departmentCode))
            {
                var trimmedCode = departmentCode.Trim();
                var local = _db.Departments.Local
                    .FirstOrDefault(x => string.Equals(x.DepartmentCode, trimmedCode, StringComparison.OrdinalIgnoreCase));
                if (local != null)
                {
                    entity = local;
                }
                else
                {
                    entity = await _uow.Departments.GetByCodeAsync(trimmedCode);
                }
            }

            if (entity == null)
            {
                entity = new Department
                {
                    DepartmentCode = string.IsNullOrWhiteSpace(departmentCode) ? _codeGenerator.Generate("DEP") : departmentCode,
                    Name = name,
                    Description = Get(row, "description"),
                    CreatedAt = DateTime.UtcNow,
                    LastUpdated = DateTime.UtcNow
                };

                await _uow.Departments.AddAsync(entity);
                await _uow.SaveChangesAsync();
                return (UpsertAction.Created, entity.DepartmentCode);
            }

            entity.Name = name;
            entity.Description = Get(row, "description") ?? entity.Description;
            entity.LastUpdated = DateTime.UtcNow;

            await _uow.SaveChangesAsync();
            return (UpsertAction.Updated, entity.DepartmentCode);
        }

        private async Task<(UpsertAction Action, string Code)> UpsertTopicAsync(Dictionary<string, string> row)
        {
            var topicCode = Get(row, "topicCode");
            var title = Required(row, "title");
            var type = Get(row, "type") ?? "SELF";

            Topic? entity = null;
            if (!string.IsNullOrWhiteSpace(topicCode))
            {
                var trimmedCode = topicCode.Trim();
                var local = _db.Topics.Local
                    .FirstOrDefault(x => string.Equals(x.TopicCode, trimmedCode, StringComparison.OrdinalIgnoreCase));
                if (local != null)
                {
                    entity = local;
                }
                else
                {
                    entity = await _uow.Topics.GetByCodeAsync(trimmedCode);
                }
            }

            var proposerUserCode = Get(row, "proposerUserCode");
            var proposerUserId = ParseInt(Get(row, "proposerUserID"));
            if (proposerUserId == null && !string.IsNullOrWhiteSpace(proposerUserCode))
            {
                proposerUserId = (await _uow.Users.GetByCodeAsync(proposerUserCode))?.UserID;
            }

            if (entity == null)
            {
                if (proposerUserId == null)
                    throw new InvalidOperationException("proposerUserID or proposerUserCode is required for new topic");

                entity = new Topic
                {
                    TopicCode = string.IsNullOrWhiteSpace(topicCode) ? await BuildTopicCodeAsync() : topicCode,
                    Title = title,
                    Summary = Get(row, "summary"),
                    Type = type,
                    ProposerUserID = proposerUserId.Value,
                    ProposerUserCode = proposerUserCode,
                    ProposerStudentCode = Get(row, "proposerStudentCode"),
                    ProposerStudentProfileID = ParseInt(Get(row, "proposerStudentProfileID")),
                    SupervisorUserID = ParseInt(Get(row, "supervisorUserID")),
                    SupervisorUserCode = Get(row, "supervisorUserCode"),
                    SupervisorLecturerProfileID = ParseInt(Get(row, "supervisorLecturerProfileID")),
                    SupervisorLecturerCode = Get(row, "supervisorLecturerCode"),
                    CatalogTopicID = ParseInt(Get(row, "catalogTopicID")),
                    CatalogTopicCode = Get(row, "catalogTopicCode"),
                    DepartmentID = ParseInt(Get(row, "departmentID")),
                    DepartmentCode = Get(row, "departmentCode"),
                    Status = Get(row, "status") ?? "DRAFT",
                    ResubmitCount = ParseInt(Get(row, "resubmitCount")) ?? 0,
                    CreatedAt = DateTime.UtcNow,
                    LastUpdated = DateTime.UtcNow,
                    LecturerComment = Get(row, "lecturerComment")
                };

                await _uow.Topics.AddAsync(entity);
                await _uow.SaveChangesAsync();
                return (UpsertAction.Created, entity.TopicCode);
            }

            entity.Title = title;
            entity.Summary = Get(row, "summary") ?? entity.Summary;
            entity.Type = type;
            entity.ProposerUserID = proposerUserId ?? entity.ProposerUserID;
            entity.ProposerUserCode = proposerUserCode ?? entity.ProposerUserCode;
            entity.ProposerStudentCode = Get(row, "proposerStudentCode") ?? entity.ProposerStudentCode;
            entity.ProposerStudentProfileID = ParseInt(Get(row, "proposerStudentProfileID")) ?? entity.ProposerStudentProfileID;
            entity.SupervisorUserID = ParseInt(Get(row, "supervisorUserID")) ?? entity.SupervisorUserID;
            entity.SupervisorUserCode = Get(row, "supervisorUserCode") ?? entity.SupervisorUserCode;
            entity.SupervisorLecturerProfileID = ParseInt(Get(row, "supervisorLecturerProfileID")) ?? entity.SupervisorLecturerProfileID;
            entity.SupervisorLecturerCode = Get(row, "supervisorLecturerCode") ?? entity.SupervisorLecturerCode;
            entity.CatalogTopicID = ParseInt(Get(row, "catalogTopicID")) ?? entity.CatalogTopicID;
            entity.CatalogTopicCode = Get(row, "catalogTopicCode") ?? entity.CatalogTopicCode;
            entity.DepartmentID = ParseInt(Get(row, "departmentID")) ?? entity.DepartmentID;
            entity.DepartmentCode = Get(row, "departmentCode") ?? entity.DepartmentCode;
            entity.Status = Get(row, "status") ?? entity.Status;
            entity.ResubmitCount = ParseInt(Get(row, "resubmitCount")) ?? entity.ResubmitCount;
            entity.LecturerComment = Get(row, "lecturerComment") ?? entity.LecturerComment;
            entity.LastUpdated = DateTime.UtcNow;

            await _uow.SaveChangesAsync();
            return (UpsertAction.Updated, entity.TopicCode);
        }

        private List<Dictionary<string, string>> ExportStudentRows()
        {
            var entities = _uow.StudentProfiles.Query()
                .OrderBy(x => x.StudentCode)
                .ToList();

            return entities.Select(x => new Dictionary<string, string>
                {
                    ["studentCode"] = x.StudentCode,
                    ["userCode"] = x.UserCode ?? string.Empty,
                    ["departmentCode"] = x.DepartmentCode ?? string.Empty,
                    ["fullName"] = x.FullName ?? string.Empty,
                    ["studentEmail"] = x.StudentEmail ?? string.Empty,
                    ["phoneNumber"] = x.PhoneNumber ?? string.Empty,
                    ["status"] = x.Status ?? string.Empty,
                    ["enrollmentYear"] = x.EnrollmentYear?.ToString() ?? string.Empty,
                    ["graduationYear"] = x.GraduationYear?.ToString() ?? string.Empty,
                    ["gender"] = x.Gender ?? string.Empty,
                    ["dateOfBirth"] = x.DateOfBirth?.ToString("yyyy-MM-dd") ?? string.Empty,
                    ["gpa"] = x.GPA?.ToString(CultureInfo.InvariantCulture) ?? string.Empty,
                    ["address"] = x.Address ?? string.Empty,
                    ["notes"] = x.Notes ?? string.Empty
                })
                .ToList();
        }

        private List<Dictionary<string, string>> ExportLecturerRows()
        {
            var entities = _uow.LecturerProfiles.Query()
                .OrderBy(x => x.LecturerCode)
                .ToList();

            var lecturerTags = _uow.LecturerTags.Query().ToList();
            var tags = _uow.Tags.Query().ToList();

            var tagCodeById = tags.ToDictionary(x => x.TagID, x => x.TagCode);
            var tagCodesByLecturerProfileId = lecturerTags
                .GroupBy(x => x.LecturerProfileID)
                .ToDictionary(
                    x => x.Key,
                    x => string.Join(",", x
                        .Select(link => tagCodeById.TryGetValue(link.TagID, out var code) ? code : null)
                        .Where(code => !string.IsNullOrWhiteSpace(code))
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .OrderBy(code => code, StringComparer.OrdinalIgnoreCase)));

            return entities.Select(x => new Dictionary<string, string>
                {
                    ["lecturerCode"] = x.LecturerCode,
                    ["userCode"] = x.UserCode ?? string.Empty,
                    ["departmentCode"] = x.DepartmentCode ?? string.Empty,
                    ["fullName"] = x.FullName ?? string.Empty,
                    ["degree"] = x.Degree ?? string.Empty,
                    ["email"] = x.Email ?? string.Empty,
                    ["phoneNumber"] = x.PhoneNumber ?? string.Empty,
                    ["guideQuota"] = x.GuideQuota?.ToString() ?? string.Empty,
                    ["defenseQuota"] = x.DefenseQuota?.ToString() ?? string.Empty,
                    ["currentGuidingCount"] = x.CurrentGuidingCount.ToString(),
                    ["gender"] = x.Gender ?? string.Empty,
                    ["dateOfBirth"] = x.DateOfBirth?.ToString("yyyy-MM-dd") ?? string.Empty,
                    ["address"] = x.Address ?? string.Empty,
                    ["notes"] = x.Notes ?? string.Empty,
                    ["tagCodes"] = tagCodesByLecturerProfileId.TryGetValue(x.LecturerProfileID, out var tagCodes)
                        ? tagCodes
                        : string.Empty
                })
                .ToList();
        }

        private List<Dictionary<string, string>> ExportDepartmentRows()
        {
            var entities = _uow.Departments.Query()
                .OrderBy(x => x.DepartmentCode)
                .ToList();

            return entities.Select(x => new Dictionary<string, string>
                {
                    ["departmentCode"] = x.DepartmentCode,
                    ["name"] = x.Name,
                    ["description"] = x.Description ?? string.Empty
                })
                .ToList();
        }

        private List<Dictionary<string, string>> ExportCatalogTopicRows()
        {
            var entities = _uow.CatalogTopics.Query()
                .OrderBy(x => x.CatalogTopicCode)
                .ToList();

            var links = _uow.CatalogTopicTags.Query().ToList();
            var tags = _uow.Tags.Query().ToList();

            var tagCodeById = tags.ToDictionary(x => x.TagID, x => x.TagCode);
            var tagCodesByCatalogTopicId = links
                .GroupBy(x => x.CatalogTopicID)
                .ToDictionary(
                    x => x.Key,
                    x => string.Join(",", x
                        .Select(link => tagCodeById.TryGetValue(link.TagID, out var code) ? code : null)
                        .Where(code => !string.IsNullOrWhiteSpace(code))
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .OrderBy(code => code, StringComparer.OrdinalIgnoreCase)));

            return entities.Select(x => new Dictionary<string, string>
                {
                    ["catalogTopicCode"] = x.CatalogTopicCode,
                    ["title"] = x.Title,
                    ["summary"] = x.Summary ?? string.Empty,
                    ["departmentCode"] = x.DepartmentCode ?? string.Empty,
                    ["assignedStatus"] = x.AssignedStatus ?? string.Empty,
                    ["assignedAt"] = x.AssignedAt?.ToString("yyyy-MM-dd") ?? string.Empty,
                    ["lecturerCode"] = x.LecturerCode ?? string.Empty,
                    ["lecturerName"] = x.LecturerName ?? string.Empty,
                    ["defenseTermId"] = x.DefenseTermId?.ToString() ?? string.Empty,
                    ["tagCodes"] = tagCodesByCatalogTopicId.TryGetValue(x.CatalogTopicID, out var tagCodes)
                        ? tagCodes
                        : string.Empty
                })
                .ToList();
        }

        private List<Dictionary<string, string>> ExportTopicRows()
        {
            var entities = _uow.Topics.Query()
                .OrderBy(x => x.TopicCode)
                .ToList();

            return entities.Select(x => new Dictionary<string, string>
                {
                    ["topicCode"] = x.TopicCode,
                    ["title"] = x.Title,
                    ["summary"] = x.Summary ?? string.Empty,
                    ["type"] = x.Type,
                    ["proposerUserID"] = x.ProposerUserID.ToString(),
                    ["proposerUserCode"] = x.ProposerUserCode ?? string.Empty,
                    ["proposerStudentProfileID"] = x.ProposerStudentProfileID?.ToString() ?? string.Empty,
                    ["proposerStudentCode"] = x.ProposerStudentCode ?? string.Empty,
                    ["supervisorUserID"] = x.SupervisorUserID?.ToString() ?? string.Empty,
                    ["supervisorUserCode"] = x.SupervisorUserCode ?? string.Empty,
                    ["supervisorLecturerProfileID"] = x.SupervisorLecturerProfileID?.ToString() ?? string.Empty,
                    ["supervisorLecturerCode"] = x.SupervisorLecturerCode ?? string.Empty,
                    ["catalogTopicID"] = x.CatalogTopicID?.ToString() ?? string.Empty,
                    ["catalogTopicCode"] = x.CatalogTopicCode ?? string.Empty,
                    ["departmentID"] = x.DepartmentID?.ToString() ?? string.Empty,
                    ["departmentCode"] = x.DepartmentCode ?? string.Empty,
                    ["status"] = x.Status,
                    ["resubmitCount"] = x.ResubmitCount?.ToString() ?? string.Empty,
                    ["lecturerComment"] = x.LecturerComment ?? string.Empty
                })
                .ToList();
        }

        private List<Dictionary<string, string>> ExportTagRows()
        {
            var entities = _uow.Tags.Query()
                .OrderBy(x => x.TagCode)
                .ToList();

            return entities.Select(x => new Dictionary<string, string>
                {
                    ["tagCode"] = x.TagCode,
                    ["tagName"] = x.TagName,
                    ["description"] = x.Description ?? string.Empty
                })
                .ToList();
        }

        private static string NormalizeModule(string module)
        {
            var normalized = (module ?? string.Empty).Trim().ToLowerInvariant();
            return normalized switch
            {
                "students" or "studentprofiles" => "students",
                "lecturers" or "lecturerprofiles" => "lecturers",
                "departments" => "departments",
                "catalogtopics" or "catalogtopic" => "catalogtopics",
                "topics" => "topics",
                "tags" => "tags",
                _ => throw new InvalidOperationException("Unsupported module. Allowed modules: students, lecturers, departments, catalogtopics, topics, tags")
            };
        }

        private static string NormalizeFormat(string? format, string? fileName)
        {
            var candidate = (format ?? string.Empty).Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(candidate) && !string.IsNullOrWhiteSpace(fileName))
            {
                candidate = Path.GetExtension(fileName).TrimStart('.').ToLowerInvariant();
            }

            return candidate switch
            {
                "xlsx" => "xlsx",
                "csv" => "csv",
                "json" => "json",
                _ => throw new InvalidOperationException("Unsupported format. Allowed formats: xlsx, csv, json")
            };
        }

        private static async Task<List<Dictionary<string, string>>> ReadRowsAsync(IFormFile file, string format)
        {
            using var stream = new MemoryStream();
            await file.CopyToAsync(stream);
            stream.Position = 0;

            return format switch
            {
                "json" => ReadJson(stream),
                "csv" => ReadCsv(stream),
                "xlsx" => ReadXlsx(stream),
                _ => throw new InvalidOperationException("Unsupported import format")
            };
        }

        private static List<Dictionary<string, string>> ReadJson(Stream stream)
        {
            using var doc = JsonDocument.Parse(stream);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
                throw new InvalidOperationException("JSON import requires an array of objects");

            var rows = new List<Dictionary<string, string>>();
            foreach (var item in doc.RootElement.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.Object)
                    continue;

                var row = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                foreach (var property in item.EnumerateObject())
                {
                    row[property.Name] = property.Value.ToString();
                }
                rows.Add(row);
            }

            return rows;
        }

        private static List<Dictionary<string, string>> ReadCsv(Stream stream)
        {
            using var reader = new StreamReader(stream, Encoding.UTF8, true, leaveOpen: true);
            var allLines = new List<string>();
            while (!reader.EndOfStream)
            {
                allLines.Add(reader.ReadLine() ?? string.Empty);
            }

            if (allLines.Count == 0)
                return new List<Dictionary<string, string>>();

            var headers = ParseCsvLine(allLines[0]).Select(h => h.Trim()).ToList();
            var rows = new List<Dictionary<string, string>>();
            for (var i = 1; i < allLines.Count; i++)
            {
                var values = ParseCsvLine(allLines[i]);
                var row = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                for (var col = 0; col < headers.Count; col++)
                {
                    var key = headers[col];
                    var value = col < values.Count ? values[col].Trim() : string.Empty;
                    row[key] = value;
                }
                rows.Add(row);
            }

            return rows;
        }

        private static List<Dictionary<string, string>> ReadXlsx(Stream stream)
        {
            using var package = new ExcelPackage(stream);
            var sheet = package.Workbook.Worksheets.FirstOrDefault();
            if (sheet == null || sheet.Dimension == null)
                return new List<Dictionary<string, string>>();

            var columnCount = sheet.Dimension.End.Column;
            var rowCount = sheet.Dimension.End.Row;

            var headers = new List<string>();
            for (var col = 1; col <= columnCount; col++)
            {
                var header = sheet.Cells[1, col].Text?.Trim();
                headers.Add(string.IsNullOrWhiteSpace(header) ? $"column{col}" : header);
            }

            var rows = new List<Dictionary<string, string>>();
            for (var rowIndex = 2; rowIndex <= rowCount; rowIndex++)
            {
                var row = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                var hasAnyValue = false;
                for (var col = 1; col <= columnCount; col++)
                {
                    var value = sheet.Cells[rowIndex, col].Text?.Trim() ?? string.Empty;
                    if (!string.IsNullOrWhiteSpace(value))
                    {
                        hasAnyValue = true;
                    }
                    row[headers[col - 1]] = value;
                }

                if (hasAnyValue)
                {
                    rows.Add(row);
                }
            }

            return rows;
        }

        private static byte[] ExportJson(List<Dictionary<string, string>> rows)
        {
            return JsonSerializer.SerializeToUtf8Bytes(rows, new JsonSerializerOptions
            {
                WriteIndented = true
            });
        }

        private static byte[] ExportCsv(List<Dictionary<string, string>> rows)
        {
            if (rows.Count == 0)
                return Encoding.UTF8.GetBytes(string.Empty);

            var headers = rows.SelectMany(x => x.Keys).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            var builder = new StringBuilder();
            builder.AppendLine(string.Join(",", headers.Select(EscapeCsv)));

            foreach (var row in rows)
            {
                var values = headers.Select(header => row.TryGetValue(header, out var value) ? EscapeCsv(value) : string.Empty);
                builder.AppendLine(string.Join(",", values));
            }

            return Encoding.UTF8.GetBytes(builder.ToString());
        }

        private static byte[] ExportXlsx(List<Dictionary<string, string>> rows, string module)
        {
            using var package = new ExcelPackage();
            var sheet = package.Workbook.Worksheets.Add(module);

            if (rows.Count == 0)
            {
                sheet.Cells[1, 1].Value = "No data";
                return package.GetAsByteArray();
            }

            var headers = rows.SelectMany(x => x.Keys).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            for (var i = 0; i < headers.Count; i++)
            {
                sheet.Cells[1, i + 1].Value = headers[i];
            }

            for (var rowIndex = 0; rowIndex < rows.Count; rowIndex++)
            {
                for (var colIndex = 0; colIndex < headers.Count; colIndex++)
                {
                    var header = headers[colIndex];
                    rows[rowIndex].TryGetValue(header, out var value);
                    sheet.Cells[rowIndex + 2, colIndex + 1].Value = value;
                }
            }

            sheet.Cells[sheet.Dimension.Address].AutoFitColumns();
            return package.GetAsByteArray();
        }

        private static string EscapeCsv(string? value)
        {
            var safe = value ?? string.Empty;
            var escaped = safe.Replace("\"", "\"\"");
            return $"\"{escaped}\"";
        }

        private static List<string> ParseCodeList(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return new List<string>();

            return value
                .Split(new[] { ',', ';', '|', '\n', '\r', ' ' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(x => x.Trim())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .ToList();
        }

        private static List<string> ParseCsvLine(string line)
        {
            var result = new List<string>();
            var builder = new StringBuilder();
            var inQuotes = false;

            for (var i = 0; i < line.Length; i++)
            {
                var ch = line[i];
                if (ch == '"')
                {
                    if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                    {
                        builder.Append('"');
                        i++;
                    }
                    else
                    {
                        inQuotes = !inQuotes;
                    }
                    continue;
                }

                if (ch == ',' && !inQuotes)
                {
                    result.Add(builder.ToString());
                    builder.Clear();
                    continue;
                }

                builder.Append(ch);
            }

            result.Add(builder.ToString());
            return result;
        }

        private static string Required(IReadOnlyDictionary<string, string> row, string key)
        {
            var value = Get(row, key);
            if (string.IsNullOrWhiteSpace(value))
                throw new InvalidOperationException($"'{key}' is required");

            return value;
        }

        private static string? Get(IReadOnlyDictionary<string, string> row, string key)
        {
            return row.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value)
                ? value.Trim()
                : null;
        }

        private static int? ParseInt(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return null;

            return int.TryParse(value, out var parsed) ? parsed : null;
        }

        private static decimal? ParseDecimal(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return null;

            return decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed)
                ? parsed
                : null;
        }

        private static DateTime? ParseDate(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return null;

            return DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var parsed)
                ? parsed
                : null;
        }

        private async Task<string> BuildTopicCodeAsync()
        {
            var now = DateTime.UtcNow;
            var yy = now.Year % 100;
            var sequence = _uow.Topics.Query().Count(x => x.CreatedAt.HasValue && x.CreatedAt.Value.Year == now.Year) + 1;
            var candidate = $"DT{yy:D2}-{sequence:D3}";

            while (_uow.Topics.Query().Count(x => x.TopicCode == candidate) > 0)
            {
                sequence++;
                candidate = $"DT{yy:D2}-{sequence:D3}";
            }

            return await Task.FromResult(candidate);
        }

        private enum UpsertAction
        {
            Failed,
            Created,
            Updated
        }
    }
}
