using System.Globalization;
using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.Data;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.Models;
using ThesisManagement.Api.Services.DefenseOperationsExport.Internal;

namespace ThesisManagement.Api.Services.DefenseOperationsExport
{
    public class DefenseModularExportService : IDefenseModularExportService
    {
        private readonly ApplicationDbContext _db;
        private readonly DefenseExportBrandingOptions _branding = new();
        private const string XlsxContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

        public DefenseModularExportService(ApplicationDbContext db)
        {
            _db = db;
        }

        public async Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportStudentsAsync(
            int periodId,
            string format,
            List<string>? fields = null,
            CancellationToken cancellationToken = default)
        {
            var period = await _db.DefenseTerms.FirstOrDefaultAsync(x => x.DefenseTermId == periodId, cancellationToken);
            if (period == null) return ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail("Không tìm thấy đợt đồ án.", 404);

            var students = await _db.StudentProfiles
                .AsNoTracking()
                .Include(x => x.Class)
                .Where(x => _db.DefenseTermStudents.Any(r => r.DefenseTermId == periodId && r.StudentCode == x.StudentCode))
                .ToListAsync(cancellationToken);

            var registrationMap = await _db.DefenseTermStudents
                .Where(r => r.DefenseTermId == periodId)
                .ToDictionaryAsync(x => x.StudentCode, x => x, cancellationToken);

            var topicMap = await _db.Topics
                .Where(t => t.DefenseTermId == periodId)
                .ToDictionaryAsync(x => x.ProposerStudentCode ?? string.Empty, x => x, cancellationToken);

            using var workbook = new XLWorkbook();
            var ws = workbook.AddWorksheet("SinhVien");
            int row = 1;

            WriteInstitutionalHeader(ws, ref row, "DANH SÁCH SINH VIÊN THEO ĐỢT", period.Description ?? period.TermCode);

            var finalFields = fields?.Count > 0 ? fields : new List<string> { "StudentCode", "UserCode", "FullName", "Gender", "DateOfBirth", "FacultyCode", "DepartmentCode", "ClassCode", "EnrollmentYear", "GraduationYear", "GPA", "AcademicStanding", "ParticipationStatus", "StudentEmail", "PhoneNumber", "Address", "Status" };
            var headers = finalFields.Select(GetLabel).ToList();
            headers.Insert(0, "STT");

            WriteTableHeader(ws, row, headers);
            row++;

            int stt = 1;
            foreach (var s in students)
            {
                var reg = registrationMap.GetValueOrDefault(s.StudentCode);
                var topic = topicMap.GetValueOrDefault(s.StudentCode);
                
                var values = new List<object> { stt++ };
                foreach (var f in finalFields)
                {
                    values.Add(ResolveStudentValue(s, reg, topic, f));
                }
                WriteDataRow(ws, row, values);
                row++;
            }

            ApplyFormatting(ws, row - 1, headers.Count);

            using var ms = new MemoryStream();
            workbook.SaveAs(ms);
            return ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse(
                (ms.ToArray(), $"DanhSachSinhVien_{period.TermCode}_{DateTime.Now:yyyyMMdd}.xlsx", XlsxContentType));
        }

        public async Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportLecturersAsync(
            int periodId,
            string format,
            List<string>? fields = null,
            CancellationToken cancellationToken = default)
        {
            var period = await _db.DefenseTerms.FirstOrDefaultAsync(x => x.DefenseTermId == periodId, cancellationToken);
            if (period == null) return ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail("Không tìm thấy đợt đồ án.", 404);

            var lecturers = await _db.LecturerProfiles
                .AsNoTracking()
                .Where(x => _db.DefenseTermLecturers.Any(p => p.DefenseTermId == periodId && p.LecturerCode == x.LecturerCode))
                .ToListAsync(cancellationToken);

            using var workbook = new XLWorkbook();
            var ws = workbook.AddWorksheet("GiangVien");
            int row = 1;

            WriteInstitutionalHeader(ws, ref row, "DANH SÁCH GIẢNG VIÊN THEO ĐỢT", period.Description ?? period.TermCode);

            var finalFields = fields?.Count > 0 ? fields : new List<string> { "LecturerCode", "UserCode", "FullName", "Degree", "Gender", "DepartmentCode", "Organization", "Email", "PhoneNumber", "GuideQuota", "DefenseQuota", "CurrentGuidingCount", "RemainingGuideQuota", "Specialties", "Address", "Status" };
            var headers = finalFields.Select(GetLabel).ToList();
            headers.Insert(0, "STT");

            WriteTableHeader(ws, row, headers);
            row++;

            int stt = 1;
            foreach (var l in lecturers)
            {
                var values = new List<object> { stt++ };
                foreach (var f in finalFields)
                {
                    values.Add(ResolveLecturerValue(l, f));
                }
                WriteDataRow(ws, row, values);
                row++;
            }

            ApplyFormatting(ws, row - 1, headers.Count);

            using var ms = new MemoryStream();
            workbook.SaveAs(ms);
            return ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse(
                (ms.ToArray(), $"DanhSachGiangVien_{period.TermCode}_{DateTime.Now:yyyyMMdd}.xlsx", XlsxContentType));
        }

        public async Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportAssignedTopicsAsync(
            int periodId,
            string format,
            List<string>? fields = null,
            CancellationToken cancellationToken = default)
        {
            var period = await _db.DefenseTerms.FirstOrDefaultAsync(x => x.DefenseTermId == periodId, cancellationToken);
            if (period == null) return ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail("Không tìm thấy đợt đồ án.", 404);

            var topics = await _db.Topics
                .AsNoTracking()
                .Include(x => x.ProposerUser)
                .Where(x => x.DefenseTermId == periodId)
                .ToListAsync(cancellationToken);

            var proposerCodes = topics.Select(x => x.ProposerStudentCode).Where(x => x != null).Distinct().ToList();
            var studentMap = await _db.StudentProfiles
                .Where(x => proposerCodes.Contains(x.StudentCode))
                .ToDictionaryAsync(x => x.StudentCode!, x => x.FullName ?? x.StudentCode!, cancellationToken);

            var topicIds = topics.Select(x => x.TopicID).ToList();
            var supervisorCodes = topics.Select(x => x.SupervisorLecturerCode).Where(x => x != null).Distinct().ToList();
            var lecturerMap = await _db.LecturerProfiles
                .Where(x => supervisorCodes.Contains(x.LecturerCode))
                .ToDictionaryAsync(x => x.LecturerCode!, x => x.FullName ?? x.LecturerCode!, cancellationToken);

            var topicCodes = topics.Select(x => x.TopicCode).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList();
            var topicTagMap = await (from topicTag in _db.TopicTags.AsNoTracking()
                                     where topicTag.TopicCode != null && topicCodes.Contains(topicTag.TopicCode)
                                     join tag in _db.Tags.AsNoTracking() on topicTag.TagID equals tag.TagID
                                     select new { topicTag.TopicCode, tag.TagName })
                .ToListAsync(cancellationToken);
            var topicTagLookup = topicTagMap
                .GroupBy(x => x.TopicCode!)
                .ToDictionary(g => g.Key, g => string.Join(", ", g.Select(x => x.TagName).Distinct()));

            using var workbook = new XLWorkbook();
            var ws = workbook.AddWorksheet("DeTaiPhanCong");
            int row = 1;

            WriteInstitutionalHeader(ws, ref row, "DANH SÁCH PHÂN CÔNG ĐỀ TÀI & GVHD", period.Description ?? period.TermCode);

            var finalFields = fields?.Count > 0 ? fields : new List<string> { "TopicCode", "CatalogTopicCode", "Title", "Type", "TopicTags", "ProposerStudentCode", "ProposerName", "SupervisorLecturerCode", "SupervisorName", "DepartmentCode", "Score", "Status", "ResubmitCount", "LecturerComment" };
            var headers = finalFields.Select(GetLabel).ToList();
            headers.Insert(0, "STT");

            WriteTableHeader(ws, row, headers);
            row++;

            int stt = 1;
            foreach (var t in topics)
            {
                var values = new List<object> { stt++ };
                foreach (var f in finalFields)
                {
                    if (f == "TopicTags")
                    {
                        values.Add(!string.IsNullOrWhiteSpace(t.TopicCode) && topicTagLookup.TryGetValue(t.TopicCode, out var tags) ? tags : "-");
                        continue;
                    }

                    if (f == "SupervisorName")
                    {
                        values.Add(t.SupervisorLecturerCode != null ? lecturerMap.GetValueOrDefault(t.SupervisorLecturerCode, t.SupervisorUserCode ?? t.SupervisorLecturerCode) : "-");
                    }
                    else if (f == "ProposerName")
                    {
                        values.Add(t.ProposerStudentCode != null ? studentMap.GetValueOrDefault(t.ProposerStudentCode, t.ProposerUserCode ?? t.ProposerStudentCode) : "-");
                    }
                    else
                    {
                        values.Add(ResolveTopicValue(t, f));
                    }
                }
                WriteDataRow(ws, row, values);
                row++;
            }

            ApplyFormatting(ws, row - 1, headers.Count);

            using var ms = new MemoryStream();
            workbook.SaveAs(ms);
            return ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse(
                (ms.ToArray(), $"PhanCongDeTai_{period.TermCode}_{DateTime.Now:yyyyMMdd}.xlsx", XlsxContentType));
        }

        public async Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportGroupedLecturerReportAsync(
            int periodId,
            string format,
            List<string>? fields = null,
            CancellationToken cancellationToken = default)
        {
            var period = await _db.DefenseTerms.FirstOrDefaultAsync(x => x.DefenseTermId == periodId, cancellationToken);
            if (period == null) return ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail("Không tìm thấy đợt đồ án.", 404);

            var topics = await _db.Topics
                .AsNoTracking()
                .Where(x => x.DefenseTermId == periodId && x.SupervisorLecturerCode != null)
                .OrderBy(x => x.SupervisorLecturerCode)
                .ThenBy(x => x.TopicCode)
                .ToListAsync(cancellationToken);

            var proposerCodes = topics.Select(x => x.ProposerStudentCode).Where(x => x != null).Distinct().ToList();
            var studentMap = await _db.StudentProfiles
                .Where(x => proposerCodes.Contains(x.StudentCode))
                .ToDictionaryAsync(x => x.StudentCode!, x => x.FullName ?? x.StudentCode!, cancellationToken);

            var supervisorCodes = topics.Select(x => x.SupervisorLecturerCode).Where(x => x != null).Distinct().ToList();
            var lecturerMap = await _db.LecturerProfiles
                .Where(x => supervisorCodes.Contains(x.LecturerCode))
                .ToDictionaryAsync(x => x.LecturerCode!, x => x, cancellationToken);

            var topicCodes = topics.Select(x => x.TopicCode).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList();
            var topicTagMap = await (from topicTag in _db.TopicTags.AsNoTracking()
                                     where topicTag.TopicCode != null && topicCodes.Contains(topicTag.TopicCode)
                                     join tag in _db.Tags.AsNoTracking() on topicTag.TagID equals tag.TagID
                                     select new { topicTag.TopicCode, tag.TagName })
                .ToListAsync(cancellationToken);
            var topicTagLookup = topicTagMap
                .GroupBy(x => x.TopicCode!)
                .ToDictionary(g => g.Key, g => string.Join(", ", g.Select(x => x.TagName).Distinct()));

            var grouped = topics.GroupBy(x => x.SupervisorLecturerCode).ToList();

            using var workbook = new XLWorkbook();
            var ws = workbook.AddWorksheet("HuongDanGop");
            int row = 1;

            WriteInstitutionalHeader(ws, ref row, "DANH SÁCH GIẢNG VIÊN HƯỚNG DẪN", period.Description ?? period.TermCode);

            var finalFields = fields?.Count > 0
                ? fields.Where(x => !string.Equals(x, "LecturerCode", StringComparison.OrdinalIgnoreCase) && !string.Equals(x, "FullName", StringComparison.OrdinalIgnoreCase)).ToList()
                : new List<string> { "TopicCode", "CatalogTopicCode", "Title", "Type", "TopicTags", "ProposerStudentCode", "ProposerName", "DepartmentCode", "Score", "Status", "LecturerComment" };

            var headers = new List<string> { "STT", "Mã giảng viên", "Giảng viên hướng dẫn" };
            headers.AddRange(finalFields.Select(GetLabel));
            WriteTableHeader(ws, row, headers);
            row++;

            int stt = 1;
            foreach (var group in grouped)
            {
                var lecturer = group.Key != null ? lecturerMap.GetValueOrDefault(group.Key) : null;
                var lecturerCode = lecturer?.LecturerCode ?? group.Key ?? "-";
                var lecturerDisplay = lecturer?.FullName ?? lecturerCode;

                int startRow = row;
                foreach (var t in group.OrderBy(x => x.TopicCode))
                {
                    var studentCode = t.ProposerStudentCode ?? "-";
                    var studentName = !string.IsNullOrWhiteSpace(t.ProposerStudentCode) && studentMap.TryGetValue(t.ProposerStudentCode, out var mappedStudentName)
                        ? mappedStudentName
                        : (t.ProposerUserCode ?? studentCode);

                    var values = new List<object> { stt++, lecturerCode, lecturerDisplay };
                    foreach (var field in finalFields)
                    {
                        if (field == "TopicTags")
                        {
                            values.Add(!string.IsNullOrWhiteSpace(t.TopicCode) && topicTagLookup.TryGetValue(t.TopicCode, out var tags) ? tags : "-");
                            continue;
                        }

                        if (field == "ProposerName")
                        {
                            values.Add(studentName);
                            continue;
                        }

                        if (field == "ProposerStudentCode")
                        {
                            values.Add(studentCode);
                            continue;
                        }

                        if (field == "DepartmentCode")
                        {
                            values.Add(t.DepartmentCode ?? lecturer?.DepartmentCode ?? "-");
                            continue;
                        }

                        if (field == "Score")
                        {
                            values.Add(t.Score?.ToString("0.0") ?? "-");
                            continue;
                        }

                        values.Add(ResolveTopicValue(t, field));
                    }

                    WriteDataRow(ws, row, values);
                    row++;
                }

                if (row - startRow > 1)
                {
                    var lecturerCodeRange = ws.Range(startRow, 2, row - 1, 2);
                    lecturerCodeRange.Merge();
                    lecturerCodeRange.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
                    lecturerCodeRange.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                    lecturerCodeRange.Style.Alignment.WrapText = true;

                    var lecturerNameRange = ws.Range(startRow, 3, row - 1, 3);
                    lecturerNameRange.Merge();
                    lecturerNameRange.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
                    lecturerNameRange.Style.Alignment.WrapText = true;
                }
            }

            ApplyFormatting(ws, row - 1, headers.Count);

            using var ms = new MemoryStream();
            workbook.SaveAs(ms);
            return ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse(
                (ms.ToArray(), $"HuongDanGopGV_{period.TermCode}_{DateTime.Now:yyyyMMdd}.xlsx", XlsxContentType));
        }

        private void WriteInstitutionalHeader(IXLWorksheet ws, ref int row, string title, string? subTitle)
        {
            ws.Cell(row, 1).Value = _branding.Institution;
            ws.Cell(row, 1).Style.Font.Bold = true;
            ws.Cell(row, 1).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;
            
            ws.Cell(row, 6).Value = _branding.MottoLine1;
            ws.Cell(row, 6).Style.Font.Bold = true;
            ws.Cell(row, 6).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            row++;

            ws.Cell(row, 1).Value = _branding.Department;
            ws.Cell(row, 1).Style.Font.Bold = true;
            ws.Cell(row, 1).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;

            ws.Cell(row, 6).Value = _branding.MottoLine2;
            ws.Cell(row, 6).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            row += 2;

            var titleRange = ws.Range(row, 1, row, 10);
            titleRange.Merge().Value = title;
            titleRange.Style.Font.Bold = true;
            titleRange.Style.Font.FontSize = 14;
            titleRange.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            row++;

            var subRange = ws.Range(row, 1, row, 10);
            subRange.Merge().Value = subTitle ?? string.Empty;
            subRange.Style.Font.Bold = true;
            subRange.Style.Font.FontSize = 12;
            subRange.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            row += 2;
        }

        private void WriteTableHeader(IXLWorksheet ws, int row, List<string> headers)
        {
            for (int i = 0; i < headers.Count; i++)
            {
                var cell = ws.Cell(row, i + 1);
                cell.Value = headers[i];
                cell.Style.Font.Bold = true;
                cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#E2E8F0");
                cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            }
        }

        private void WriteDataRow(IXLWorksheet ws, int row, List<object> values)
        {
            for (int i = 0; i < values.Count; i++)
            {
                var cell = ws.Cell(row, i + 1);
                cell.Value = values[i]?.ToString() ?? string.Empty;
                cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
                if (i == 0) cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            }
        }

        private void ApplyFormatting(IXLWorksheet ws, int lastRow, int colCount)
        {
            ws.Columns(1, colCount).AdjustToContents();
            ws.Style.Font.FontName = "Times New Roman";
            ws.Style.Font.FontSize = 11;

            // Signature
            int row = lastRow + 3;
            ws.Cell(row, 2).Value = "Người lập biểu";
            ws.Cell(row, 2).Style.Font.Bold = true;
            ws.Cell(row, 8).Value = $"{_branding.Location}, ngày {DateTime.Now:dd} tháng {DateTime.Now:MM} năm {DateTime.Now:yyyy}";
            row++;
            ws.Cell(row, 8).Value = _branding.Signatory2Role;
            ws.Cell(row, 8).Style.Font.Bold = true;
        }

        private string GetLabel(string key)
        {
            return key.ToLowerInvariant() switch
            {
                "studentcode" => "Mã sinh viên",
                "usercode" => "Mã user",
                "fullname" => "Họ và tên",
                "gender" => "Giới tính",
                "dateofbirth" => "Ngày sinh",
                "facultycode" => "Khoa viện",
                "departmentcode" => "Mã khoa",
                "classcode" => "Mã lớp",
                "enrollmentyear" => "Khóa học",
                "graduationyear" => "Năm tốt nghiệp",
                "gpa" => "Điểm TB",
                "academicstanding" => "Xếp loại",
                "participationstatus" => "Trạng thái tham gia",
                "studentemail" => "Email",
                "phonenumber" => "Số điện thoại",
                "address" => "Địa chỉ",
                "status" => "Trạng thái",
                "notes" => "Ghi chú",
                "lecturercode" => "Mã giảng viên",
                "profileimage" => "Ảnh hồ sơ",
                "degree" => "Học hàm/Học vị",
                "organization" => "Cơ quan công tác",
                "email" => "Email",
                "guidequota" => "Định mức HD",
                "defensequota" => "Định mức bảo vệ",
                "currentguidingcount" => "Đang HD",
                "remainingguidequota" => "Còn lại",
                "specialties" => "Chuyên môn",
                "topiccode" => "Mã đề tài",
                "catalogtopiccode" => "Mã đề tài mẫu",
                "title" => "Tên đề tài",
                "type" => "Loại đề tài",
                "summary" => "Tóm tắt",
                "proposerstudentcode" => "Mã SV",
                "proposername" => "Sinh viên thực hiện",
                "proposerusercode" => "Mã user SV",
                "supervisorlecturercode" => "Mã GVHD",
                "supervisorname" => "Giảng viên hướng dẫn",
                "supervisorusercode" => "Mã user GVHD",
                "score" => "Điểm số",
                "topictags" => "Tag đề tài",
                "lecturercomment" => "Nhận xét giảng viên",
                "resubmitcount" => "Số lần nộp lại",
                "numchapters" => "Số chương",
                "numpages" => "Số trang",
                "numtables" => "Số bảng",
                "numfigures" => "Số hình",
                "numreferences" => "Tài liệu tham khảo",
                "numvietnamesereferences" => "Tài liệu tiếng Việt",
                "numforeignreferences" => "Tài liệu tiếng Anh",
                
                // New system management fields
                "name" => "Tên",
                "description" => "Mô tả",
                "classid" => "ID lớp học",
                "classname" => "Tên lớp",
                "tagcode" => "Mã Tag",
                "tagname" => "Tên Tag",
                "assignedstatus" => "Trạng thái",
                "tagcodes" => "Các thẻ (Tag)",
                "roomcode" => "Mã phòng bảo vệ",
                "createdat" => "Thời gian khởi tạo",
                "lastupdated" => "Cập nhật cuối",
                "userid" => "ID tài khoản",
                "username" => "Tên đăng nhập",
                "role" => "Vai trò / Quyền",
                "isactive" => "Trạng thái hoạt động",
                _ => key
            };
        }

        private object ResolveStudentValue(StudentProfile s, DefenseTermStudent? reg, Topic? topic, string key)
        {
            return key switch
            {
                "StudentCode" => s.StudentCode,
                "UserCode" => s.UserCode ?? string.Empty,
                "FullName" => s.FullName ?? string.Empty,
                "Gender" => s.Gender ?? string.Empty,
                "DateOfBirth" => s.DateOfBirth?.ToString("dd/MM/yyyy") ?? string.Empty,
                "FacultyCode" => s.FacultyCode ?? string.Empty,
                "DepartmentCode" => s.DepartmentCode ?? string.Empty,
                "ClassCode" => s.Class?.ClassCode ?? string.Empty,
                "EnrollmentYear" => s.EnrollmentYear?.ToString() ?? string.Empty,
                "GraduationYear" => s.GraduationYear?.ToString() ?? string.Empty,
                "GPA" => s.GPA?.ToString("0.00") ?? string.Empty,
                "AcademicStanding" => s.AcademicStanding ?? string.Empty,
                "StudentEmail" => s.StudentEmail ?? string.Empty,
                "PhoneNumber" => s.PhoneNumber ?? string.Empty,
                "ParticipationStatus" => "Đã đăng ký",
                "Address" => s.Address ?? string.Empty,
                "Status" => s.Status ?? string.Empty,
                "Notes" => s.Notes ?? string.Empty,
                _ => string.Empty
            };
        }

        private object ResolveLecturerValue(LecturerProfile l, string key)
        {
            return key switch
            {
                "LecturerCode" => l.LecturerCode,
                "UserCode" => l.UserCode ?? string.Empty,
                "FullName" => l.FullName ?? string.Empty,
                "Degree" => l.Degree ?? string.Empty,
                "ProfileImage" => l.ProfileImage ?? string.Empty,
                "Gender" => l.Gender ?? string.Empty,
                "DepartmentCode" => l.DepartmentCode ?? string.Empty,
                "Organization" => l.Organization ?? string.Empty,
                "Email" => l.Email ?? string.Empty,
                "PhoneNumber" => l.PhoneNumber ?? string.Empty,
                "GuideQuota" => l.GuideQuota ?? 0,
                "DefenseQuota" => l.DefenseQuota ?? 0,
                "CurrentGuidingCount" => l.CurrentGuidingCount,
                "RemainingGuideQuota" => (l.GuideQuota ?? 0) - l.CurrentGuidingCount,
                "Specialties" => l.Specialties ?? string.Empty,
                "Address" => l.Address ?? string.Empty,
                "Notes" => l.Notes ?? string.Empty,
                _ => string.Empty
            };
        }

        private object ResolveTopicValue(Topic t, string key)
        {
            return key switch
            {
                "TopicCode" => t.TopicCode,
                "CatalogTopicCode" => t.CatalogTopicCode ?? string.Empty,
                "Title" => t.Title,
                "Type" => t.Type,
                "Summary" => t.Summary ?? string.Empty,
                "ProposerStudentCode" => t.ProposerStudentCode ?? string.Empty,
                "ProposerName" => t.ProposerStudentCode ?? string.Empty, // Will be overridden in main loops if possible
                "ProposerUserCode" => t.ProposerUserCode ?? string.Empty,
                "SupervisorLecturerCode" => t.SupervisorLecturerCode ?? string.Empty,
                "SupervisorName" => t.SupervisorUserCode ?? string.Empty, // Simplified for now
                "SupervisorUserCode" => t.SupervisorUserCode ?? string.Empty,
                "DepartmentCode" => t.DepartmentCode ?? string.Empty,
                "LecturerComment" => t.LecturerComment ?? string.Empty,
                "ResubmitCount" => t.ResubmitCount?.ToString() ?? string.Empty,
                "NumChapters" => t.NumChapters?.ToString() ?? string.Empty,
                "NumPages" => t.NumPages?.ToString() ?? string.Empty,
                "NumTables" => t.NumTables?.ToString() ?? string.Empty,
                "NumFigures" => t.NumFigures?.ToString() ?? string.Empty,
                "NumReferences" => t.NumReferences?.ToString() ?? string.Empty,
                "NumVietnameseReferences" => t.NumVietnameseReferences?.ToString() ?? string.Empty,
                "NumForeignReferences" => t.NumForeignReferences?.ToString() ?? string.Empty,
                "Score" => t.Score?.ToString("0.0") ?? string.Empty,
                "Status" => t.Status,
                "TopicTags" => string.Empty,
                _ => string.Empty
            };
        }

        public async Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportDepartmentsAsync(
            int periodId,
            string format,
            List<string>? fields = null,
            CancellationToken cancellationToken = default)
        {
            var period = await _db.DefenseTerms.FirstOrDefaultAsync(x => x.DefenseTermId == periodId, cancellationToken);
            if (period == null) return ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail("Không tìm thấy đợt đồ án.", 404);

            var items = await _db.Departments.AsNoTracking().OrderBy(x => x.DepartmentCode).ToListAsync(cancellationToken);

            using var workbook = new XLWorkbook();
            var ws = workbook.AddWorksheet("Khoa");
            int row = 1;

            WriteInstitutionalHeader(ws, ref row, "DANH SÁCH KHOA HỆ THỐNG", period.Description ?? period.TermCode);

            var finalFields = fields?.Count > 0 ? fields : new List<string> { "DepartmentCode", "Name", "Description" };
            var headers = finalFields.Select(GetLabel).ToList();
            headers.Insert(0, "STT");

            WriteTableHeader(ws, row, headers);
            row++;

            int stt = 1;
            foreach (var d in items)
            {
                var values = new List<object> { stt++ };
                foreach (var f in finalFields)
                {
                    values.Add(ResolveDepartmentValue(d, f));
                }
                WriteDataRow(ws, row, values);
                row++;
            }

            ApplyFormatting(ws, row - 1, headers.Count);

            using var ms = new MemoryStream();
            workbook.SaveAs(ms);
            return ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse(
                (ms.ToArray(), $"DanhSachKhoa_{period.TermCode}_{DateTime.Now:yyyyMMdd}.xlsx", XlsxContentType));
        }

        public async Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportClassesAsync(
            int periodId,
            string format,
            List<string>? fields = null,
            CancellationToken cancellationToken = default)
        {
            var period = await _db.DefenseTerms.FirstOrDefaultAsync(x => x.DefenseTermId == periodId, cancellationToken);
            if (period == null) return ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail("Không tìm thấy đợt đồ án.", 404);

            var items = await _db.Classes
                .AsNoTracking()
                .Include(x => x.Department)
                .OrderBy(x => x.ClassCode)
                .ToListAsync(cancellationToken);

            using var workbook = new XLWorkbook();
            var ws = workbook.AddWorksheet("LopHoc");
            int row = 1;

            WriteInstitutionalHeader(ws, ref row, "DANH SÁCH LỚP HỌC HỆ THỐNG", period.Description ?? period.TermCode);

            var finalFields = fields?.Count > 0 ? fields : new List<string> { "ClassID", "ClassCode", "Name", "DepartmentCode" };
            var headers = finalFields.Select(GetLabel).ToList();
            headers.Insert(0, "STT");

            WriteTableHeader(ws, row, headers);
            row++;

            int stt = 1;
            foreach (var c in items)
            {
                var values = new List<object> { stt++ };
                foreach (var f in finalFields)
                {
                    values.Add(ResolveClassValue(c, f));
                }
                WriteDataRow(ws, row, values);
                row++;
            }

            ApplyFormatting(ws, row - 1, headers.Count);

            using var ms = new MemoryStream();
            workbook.SaveAs(ms);
            return ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse(
                (ms.ToArray(), $"DanhSachLopHoc_{period.TermCode}_{DateTime.Now:yyyyMMdd}.xlsx", XlsxContentType));
        }

        public async Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportTagsAsync(
            int periodId,
            string format,
            List<string>? fields = null,
            CancellationToken cancellationToken = default)
        {
            var period = await _db.DefenseTerms.FirstOrDefaultAsync(x => x.DefenseTermId == periodId, cancellationToken);
            if (period == null) return ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail("Không tìm thấy đợt đồ án.", 404);

            var items = await _db.Tags.AsNoTracking().OrderBy(x => x.TagCode).ToListAsync(cancellationToken);

            using var workbook = new XLWorkbook();
            var ws = workbook.AddWorksheet("TagLinhVuc");
            int row = 1;

            WriteInstitutionalHeader(ws, ref row, "DANH SÁCH LĨNH VỰC / TAG HỆ THỐNG", period.Description ?? period.TermCode);

            var finalFields = fields?.Count > 0 ? fields : new List<string> { "TagCode", "TagName", "Description" };
            var headers = finalFields.Select(GetLabel).ToList();
            headers.Insert(0, "STT");

            WriteTableHeader(ws, row, headers);
            row++;

            int stt = 1;
            foreach (var t in items)
            {
                var values = new List<object> { stt++ };
                foreach (var f in finalFields)
                {
                    values.Add(ResolveTagValue(t, f));
                }
                WriteDataRow(ws, row, values);
                row++;
            }

            ApplyFormatting(ws, row - 1, headers.Count);

            using var ms = new MemoryStream();
            workbook.SaveAs(ms);
            return ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse(
                (ms.ToArray(), $"DanhSachTagLinhVuc_{period.TermCode}_{DateTime.Now:yyyyMMdd}.xlsx", XlsxContentType));
        }

        public async Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportCatalogTopicsAsync(
            int periodId,
            string format,
            List<string>? fields = null,
            CancellationToken cancellationToken = default)
        {
            var period = await _db.DefenseTerms.FirstOrDefaultAsync(x => x.DefenseTermId == periodId, cancellationToken);
            if (period == null) return ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail("Không tìm thấy đợt đồ án.", 404);

            var items = await _db.CatalogTopics
                .AsNoTracking()
                .Include(x => x.CatalogTopicTags!)
                    .ThenInclude(xt => xt.Tag)
                .OrderBy(x => x.CatalogTopicCode)
                .ToListAsync(cancellationToken);

            using var workbook = new XLWorkbook();
            var ws = workbook.AddWorksheet("KhoDeTaiMau");
            int row = 1;

            WriteInstitutionalHeader(ws, ref row, "DANH SÁCH ĐỀ TÀI MẪU HỆ THỐNG", period.Description ?? period.TermCode);

            var finalFields = fields?.Count > 0 ? fields : new List<string> { "CatalogTopicCode", "Title", "Summary", "DepartmentCode", "AssignedStatus", "TagCodes" };
            var headers = finalFields.Select(GetLabel).ToList();
            headers.Insert(0, "STT");

            WriteTableHeader(ws, row, headers);
            row++;

            int stt = 1;
            foreach (var ct in items)
            {
                var values = new List<object> { stt++ };
                foreach (var f in finalFields)
                {
                    values.Add(ResolveCatalogTopicValue(ct, f));
                }
                WriteDataRow(ws, row, values);
                row++;
            }

            ApplyFormatting(ws, row - 1, headers.Count);

            using var ms = new MemoryStream();
            workbook.SaveAs(ms);
            return ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse(
                (ms.ToArray(), $"DanhSachDeTaiMau_{period.TermCode}_{DateTime.Now:yyyyMMdd}.xlsx", XlsxContentType));
        }

        public async Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportRoomsAsync(
            int periodId,
            string format,
            List<string>? fields = null,
            CancellationToken cancellationToken = default)
        {
            var period = await _db.DefenseTerms.FirstOrDefaultAsync(x => x.DefenseTermId == periodId, cancellationToken);
            if (period == null) return ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail("Không tìm thấy đợt đồ án.", 404);

            var items = await _db.Rooms.AsNoTracking().OrderBy(x => x.RoomCode).ToListAsync(cancellationToken);

            using var workbook = new XLWorkbook();
            var ws = workbook.AddWorksheet("PhongBaoVe");
            int row = 1;

            WriteInstitutionalHeader(ws, ref row, "DANH SÁCH PHÒNG BẢO VỆ HỘI ĐỒNG", period.Description ?? period.TermCode);

            var finalFields = fields?.Count > 0 ? fields : new List<string> { "RoomCode", "Status", "CreatedAt", "LastUpdated" };
            var headers = finalFields.Select(GetLabel).ToList();
            headers.Insert(0, "STT");

            WriteTableHeader(ws, row, headers);
            row++;

            int stt = 1;
            foreach (var r in items)
            {
                var values = new List<object> { stt++ };
                foreach (var f in finalFields)
                {
                    values.Add(ResolveRoomValue(r, f));
                }
                WriteDataRow(ws, row, values);
                row++;
            }

            ApplyFormatting(ws, row - 1, headers.Count);

            using var ms = new MemoryStream();
            workbook.SaveAs(ms);
            return ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse(
                (ms.ToArray(), $"DanhSachPhongBaoVe_{period.TermCode}_{DateTime.Now:yyyyMMdd}.xlsx", XlsxContentType));
        }

        public async Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportUsersAsync(
            int periodId,
            string format,
            List<string>? fields = null,
            CancellationToken cancellationToken = default)
        {
            var period = await _db.DefenseTerms.FirstOrDefaultAsync(x => x.DefenseTermId == periodId, cancellationToken);
            if (period == null) return ApiResponse<(byte[] Content, string FileName, string ContentType)>.Fail("Không tìm thấy đợt đồ án.", 404);

            var items = await _db.Users
                .AsNoTracking()
                .Include(x => x.StudentProfile)
                .Include(x => x.LecturerProfile)
                .OrderBy(x => x.UserCode)
                .ToListAsync(cancellationToken);

            using var workbook = new XLWorkbook();
            var ws = workbook.AddWorksheet("TaiKhoan");
            int row = 1;

            WriteInstitutionalHeader(ws, ref row, "DANH SÁCH TÀI KHOẢN NGƯỜI DÙNG HỆ THỐNG", period.Description ?? period.TermCode);

            var finalFields = fields?.Count > 0 ? fields : new List<string> { "UserID", "UserCode", "FullName", "Email", "Role", "IsActive" };
            var headers = finalFields.Select(GetLabel).ToList();
            headers.Insert(0, "STT");

            WriteTableHeader(ws, row, headers);
            row++;

            int stt = 1;
            foreach (var u in items)
            {
                var values = new List<object> { stt++ };
                foreach (var f in finalFields)
                {
                    values.Add(ResolveUserValue(u, f));
                }
                WriteDataRow(ws, row, values);
                row++;
            }

            ApplyFormatting(ws, row - 1, headers.Count);

            using var ms = new MemoryStream();
            workbook.SaveAs(ms);
            return ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse(
                (ms.ToArray(), $"DanhSachTaiKhoan_{period.TermCode}_{DateTime.Now:yyyyMMdd}.xlsx", XlsxContentType));
        }

        private object ResolveDepartmentValue(Department d, string key)
        {
            return key.ToLowerInvariant() switch
            {
                "departmentcode" => d.DepartmentCode,
                "name" => d.Name,
                "description" => d.Description ?? string.Empty,
                _ => string.Empty
            };
        }

        private object ResolveClassValue(Class c, string key)
        {
            return key.ToLowerInvariant() switch
            {
                "classid" => c.ClassID,
                "classcode" => c.ClassCode,
                "name" => c.ClassName,
                "classname" => c.ClassName,
                "departmentcode" => c.DepartmentCode ?? c.Department?.DepartmentCode ?? string.Empty,
                _ => string.Empty
            };
        }

        private object ResolveTagValue(Tag t, string key)
        {
            return key.ToLowerInvariant() switch
            {
                "tagcode" => t.TagCode,
                "tagname" => t.TagName,
                "description" => t.Description ?? string.Empty,
                _ => string.Empty
            };
        }

        private object ResolveCatalogTopicValue(CatalogTopic ct, string key)
        {
            return key.ToLowerInvariant() switch
            {
                "catalogtopiccode" => ct.CatalogTopicCode,
                "title" => ct.Title,
                "summary" => ct.Summary ?? string.Empty,
                "departmentcode" => ct.DepartmentCode ?? string.Empty,
                "assignedstatus" => ct.AssignedStatus ?? "Chưa phân công",
                "tagcodes" => ct.CatalogTopicTags != null 
                    ? string.Join(", ", ct.CatalogTopicTags.Select(x => x.Tag?.TagName ?? x.TagCode ?? string.Empty).Where(x => !string.IsNullOrEmpty(x)))
                    : string.Empty,
                _ => string.Empty
            };
        }

        private object ResolveRoomValue(Room r, string key)
        {
            return key.ToLowerInvariant() switch
            {
                "roomcode" => r.RoomCode,
                "status" => r.Status ?? "Hoạt động",
                "createdat" => r.CreatedAt.ToString("dd/MM/yyyy HH:mm:ss"),
                "lastupdated" => r.LastUpdated.ToString("dd/MM/yyyy HH:mm:ss"),
                _ => string.Empty
            };
        }

        private object ResolveUserValue(User u, string key)
        {
            return key.ToLowerInvariant() switch
            {
                "userid" => u.UserID,
                "usercode" => u.UserCode,
                "username" => u.UserCode,
                "fullname" => u.StudentProfile?.FullName ?? u.LecturerProfile?.FullName ?? "-",
                "email" => u.StudentProfile?.StudentEmail ?? u.LecturerProfile?.Email ?? "-",
                "role" => u.Role,
                "isactive" => u.StudentProfile?.Status ?? "Đang hoạt động",
                _ => string.Empty
            };
        }
    }
}
