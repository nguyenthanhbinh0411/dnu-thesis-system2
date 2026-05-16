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

            var finalFields = fields?.Count > 0 ? fields : new List<string> { "StudentCode", "FullName", "ClassCode", "GPA", "AcademicStanding", "StudentEmail" };
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

            var finalFields = fields?.Count > 0 ? fields : new List<string> { "LecturerCode", "FullName", "Degree", "DepartmentCode", "GuideQuota", "Email" };
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

            using var workbook = new XLWorkbook();
            var ws = workbook.AddWorksheet("DeTaiPhanCong");
            int row = 1;

            WriteInstitutionalHeader(ws, ref row, "DANH SÁCH PHÂN CÔNG ĐỀ TÀI & GVHD", period.Description ?? period.TermCode);

            var finalFields = fields?.Count > 0 ? fields : new List<string> { "TopicCode", "Title", "ProposerName", "SupervisorName", "DepartmentCode", "Status" };
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
                .ToListAsync(cancellationToken);

            var proposerCodes = topics.Select(x => x.ProposerStudentCode).Where(x => x != null).Distinct().ToList();
            var studentMap = await _db.StudentProfiles
                .Where(x => proposerCodes.Contains(x.StudentCode))
                .ToDictionaryAsync(x => x.StudentCode!, x => x.FullName ?? x.StudentCode!, cancellationToken);

            var supervisorCodes = topics.Select(x => x.SupervisorLecturerCode).Where(x => x != null).Distinct().ToList();
            var lecturerMap = await _db.LecturerProfiles
                .Where(x => supervisorCodes.Contains(x.LecturerCode))
                .ToDictionaryAsync(x => x.LecturerCode!, x => x, cancellationToken);

            var grouped = topics.GroupBy(x => x.SupervisorLecturerCode).ToList();

            using var workbook = new XLWorkbook();
            var ws = workbook.AddWorksheet("HuongDanGop");
            int row = 1;

            WriteInstitutionalHeader(ws, ref row, "DANH SÁCH HƯỚNG DẪN CHI TIẾT THEO GIẢNG VIÊN", period.Description ?? period.TermCode);

            var headers = new List<string> { "STT", "Giảng viên hướng dẫn", "SL đang HD", "Mã đề tài", "Tên đề tài", "Sinh viên thực hiện", "Trạng thái" };
            WriteTableHeader(ws, row, headers);
            row++;

            int stt = 1;
            foreach (var group in grouped)
            {
                var lecturer = group.Key != null ? lecturerMap.GetValueOrDefault(group.Key) : null;
                var lecturerDisplay = lecturer != null ? $"{lecturer.FullName}\n({lecturer.LecturerCode})" : (group.Key ?? "N/A");
                var guidingCount = lecturer?.CurrentGuidingCount ?? group.Count();
                
                int startRow = row;
                foreach (var t in group)
                {
                    var studentName = t.ProposerStudentCode != null ? studentMap.GetValueOrDefault(t.ProposerStudentCode, t.ProposerUserCode ?? t.ProposerStudentCode) : "-";
                    var studentDisplay = $"{studentName} ({t.ProposerStudentCode})";

                    var values = new List<object> 
                    { 
                        stt++, 
                        lecturerDisplay, 
                        guidingCount, 
                        t.TopicCode, 
                        t.Title, 
                        studentDisplay, 
                        t.Status 
                    };

                    WriteDataRow(ws, row, values);
                    row++;
                }

                if (group.Count() > 1)
                {
                    // Merge Lecturer info and Count
                    ws.Range(startRow, 2, row - 1, 2).Merge().Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
                    ws.Range(startRow, 2, row - 1, 2).Style.Alignment.WrapText = true;
                    ws.Range(startRow, 3, row - 1, 3).Merge().Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
                }
            }

            ApplyFormatting(ws, row - 1, headers.Count);

            using var ms = new MemoryStream();
            workbook.SaveAs(ms);
            return ApiResponse<(byte[] Content, string FileName, string ContentType)>.SuccessResponse(
                (ms.ToArray(), $"HuongDanGopGV_{period.TermCode}_{DateTime.Now:yyyyMMdd}.xlsx", XlsxContentType));
        }

        private void WriteInstitutionalHeader(IXLWorksheet ws, ref int row, string title, string subTitle)
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
            subRange.Merge().Value = subTitle;
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
            return key switch
            {
                "StudentCode" => "Mã sinh viên",
                "FullName" => "Họ và tên",
                "Gender" => "Giới tính",
                "DateOfBirth" => "Ngày sinh",
                "FacultyCode" => "Khoa",
                "DepartmentCode" => "Bộ môn",
                "ClassCode" => "Lớp",
                "EnrollmentYear" => "Khóa học",
                "GraduationYear" => "Năm tốt nghiệp",
                "GPA" => "Điểm TB",
                "AcademicStanding" => "Xếp loại",
                "ParticipationStatus" => "Trạng thái",
                "StudentEmail" => "Email",
                "PhoneNumber" => "Số điện thoại",
                "LecturerCode" => "Mã giảng viên",
                "Degree" => "Học hàm/Học vị",
                "Organization" => "Cơ quan công tác",
                "Email" => "Email",
                "GuideQuota" => "Định mức HD",
                "CurrentGuidingCount" => "Đang HD",
                "RemainingGuideQuota" => "Còn lại",
                "Status" => "Trạng thái",
                "TopicCode" => "Mã đề tài",
                "Title" => "Tên đề tài",
                "Type" => "Loại đề tài",
                "ProposerStudentCode" => "Mã SV",
                "ProposerName" => "Sinh viên thực hiện",
                "SupervisorLecturerCode" => "Mã GVHD",
                "SupervisorName" => "Giảng viên hướng dẫn",
                "Score" => "Điểm số",
                _ => key
            };
        }

        private object ResolveStudentValue(StudentProfile s, DefenseTermStudent? reg, Topic? topic, string key)
        {
            return key switch
            {
                "StudentCode" => s.StudentCode,
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
                _ => string.Empty
            };
        }

        private object ResolveLecturerValue(LecturerProfile l, string key)
        {
            return key switch
            {
                "LecturerCode" => l.LecturerCode,
                "FullName" => l.FullName ?? string.Empty,
                "Degree" => l.Degree ?? string.Empty,
                "Gender" => l.Gender ?? string.Empty,
                "DepartmentCode" => l.DepartmentCode ?? string.Empty,
                "Organization" => l.Organization ?? string.Empty,
                "Email" => l.Email ?? string.Empty,
                "PhoneNumber" => l.PhoneNumber ?? string.Empty,
                "GuideQuota" => l.GuideQuota ?? 0,
                "CurrentGuidingCount" => l.CurrentGuidingCount,
                "RemainingGuideQuota" => (l.GuideQuota ?? 0) - l.CurrentGuidingCount,
                "Status" => "Hoạt động",
                _ => string.Empty
            };
        }

        private object ResolveTopicValue(Topic t, string key)
        {
            return key switch
            {
                "TopicCode" => t.TopicCode,
                "Title" => t.Title,
                "Type" => t.Type,
                "ProposerStudentCode" => t.ProposerStudentCode ?? string.Empty,
                "ProposerName" => t.ProposerStudentCode ?? string.Empty, // Will be overridden in main loops if possible
                "SupervisorLecturerCode" => t.SupervisorLecturerCode ?? string.Empty,
                "SupervisorName" => t.SupervisorUserCode ?? string.Empty, // Simplified for now
                "DepartmentCode" => t.DepartmentCode ?? string.Empty,
                "Score" => t.Score?.ToString("0.0") ?? string.Empty,
                "Status" => t.Status,
                _ => string.Empty
            };
        }
    }
}
