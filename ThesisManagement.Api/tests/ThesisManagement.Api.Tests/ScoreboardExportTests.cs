using System.Text.Json;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.FileProviders;
using ThesisManagement.Api.Application.Query.DefensePeriods;
using ThesisManagement.Api.Data;
using ThesisManagement.Api.DTOs.DocumentExports;
using ThesisManagement.Api.Models;
using ThesisManagement.Api.Services.DocumentExports;
using Xunit;

namespace ThesisManagement.Api.Tests;

public class ScoreboardExportTests
{
    [Fact]
    public async Task BuildReportAsync_Scoreboard_ShouldMapKhoaFromCohortCode_AndKeepAllRowFields()
    {
        await using var db = CreateDbContext();
        SeedScoreboardScenario(db);
        var captureExportService = new CaptureDocumentExportService();
        var processor = new DefensePeriodQueryProcessor(db, captureExportService);

        var response = await processor.BuildReportAsync(
            periodId: 1,
            reportType: "scoreboard",
            format: "word",
            councilId: 11,
            cancellationToken: CancellationToken.None);

        response.Success.Should().BeTrue();
        captureExportService.LastReportData.Should().NotBeNull();

        var json = captureExportService.LastReportData!.AdditionalTokens["StudentRowsJson"];
        json.Should().NotBeNullOrWhiteSpace();
        var rows = JsonSerializer.Deserialize<List<Dictionary<string, string>>>(json!);
        rows.Should().NotBeNull();
        rows!.Should().HaveCount(1);

        var row = rows![0];
        row["CohortCode"].Should().Be("K16");
        row["ClassName"].Should().Be("K16");
        row["ClassCode"].Should().Be("CNTT16A");
        row["Supervisor"].Should().Be("TS. Giang Vien Huong Dan");
        row["ScoreGVHD"].Should().BeOneOf("8.5", "8,5");
        row["ScoreCT"].Should().BeOneOf("8.0", "8", "8,0");
        row["ScoreTK"].Should().BeOneOf("8.2", "8,2");
        row["ScorePB"].Should().BeOneOf("8.1", "8,1");
        row["FinalScore"].Should().BeOneOf("8.2", "8,2");
    }

    [Fact]
    public async Task ExportWordAsync_BangDiem_ShouldExpandRows_AndReplaceAllRequiredTokens()
    {
        var root = Path.Combine(Path.GetTempPath(), $"scoreboard-export-{Guid.NewGuid():N}");
        var templates = Path.Combine(root, "Templates");
        Directory.CreateDirectory(templates);

        var templatePath = Path.Combine(templates, "BẢNG ĐIỂM GHI KẾT QUẢ BẢO VỆ.docx");
        CreateScoreboardTemplate(templatePath);

        var service = new DocumentExportService(new FakeWebHostEnvironment(root));
        var rows = new List<object>();
        for (var i = 1; i <= 14; i++)
        {
            rows.Add(new
            {
                RowNumber = i.ToString(),
                StudentCode = $"SV{i:000}",
                StudentName = $"Sinh Vien {i}",
                CohortCode = "K16",
                ClassName = "CNTT 16-01",
                ClassCode = "CNTT16A",
                Supervisor = "TS. Nguyen Van A",
                ScoreGVHD = "8.5",
                ScoreCT = "8.0",
                ScoreTK = "8.2",
                ScorePB = "8.1",
                FinalScore = "8.2",
                TopicTitle = $"De tai {i}"
            });
        }

        var report = new ReportData
        {
            CommitteeCode = "HD-01",
            DefenseDate = "16/05/2026",
            DefenseDay = "16",
            DefenseMonth = "05",
            DefenseYear = "2026",
            ChairMemberDisplay = "PGS.TS. Chu Tich",
            SecretaryMemberDisplay = "TS. Thu Ky",
            ReviewerMemberDisplay = "TS. Phan Bien"
        };
        report.AdditionalTokens["StudentRowsJson"] = JsonSerializer.Serialize(rows);

        var export = await service.ExportWordAsync(DocumentExportType.BangDiem, report);

        export.Content.Should().NotBeNullOrEmpty();

        using var ms = new MemoryStream(export.Content);
        using var doc = WordprocessingDocument.Open(ms, false);
        var body = doc.MainDocumentPart!.Document!.Body!;

        // Verify title and header tokens are replaced and preserved.
        var fullText = string.Concat(body.Descendants<Text>().Select(t => t.Text));
        fullText.Should().Contain("BẢNG ĐIỂM GHI KẾT QUẢ BẢO VỆ ĐỒ ÁN");
        fullText.Should().Contain("HỘI ĐỒNG SỐ: HD-01");
        fullText.Should().Contain("NGÀY BẢO VỆ: 16/05/2026");
        fullText.Should().Contain("Hà Nội, ngày 16tháng 05năm 2026");
        fullText.Should().Contain("PGS.TS. Chu Tich");
        fullText.Should().Contain("TS. Thu Ky");
        fullText.Should().Contain("TS. Phan Bien");

        var scoreTable = body.Descendants<Table>()
            .First(t => t.Descendants<Text>().Any(x => x.Text.Contains("MSSV")));

        // One header row + 14 expanded rows (marker row removed).
        scoreTable.Elements<TableRow>().Count().Should().Be(15);

        var scoreRows = scoreTable.Elements<TableRow>().Skip(1).ToList();
        scoreRows.First().InnerText.Should().Contain("SV001");
        scoreRows.First().InnerText.Should().Contain("K16");
        scoreRows.First().InnerText.Should().Contain("CNTT 16-01");
        scoreRows.Last().InnerText.Should().Contain("SV014");

        // Ensure row marker token has been fully removed.
        fullText.Should().NotContain("{{RowNumber}}");
    }

    private static void CreateScoreboardTemplate(string filePath)
    {
        using var doc = WordprocessingDocument.Create(filePath, DocumentFormat.OpenXml.WordprocessingDocumentType.Document);
        var main = doc.AddMainDocumentPart();
        main.Document = new Document();
        var body = main.Document.AppendChild(new Body());

        body.AppendChild(new Paragraph(new Run(new Text("BẢNG ĐIỂM GHI KẾT QUẢ BẢO VỆ ĐỒ ÁN"))));
        body.AppendChild(new Paragraph(new Run(new Text("HỘI ĐỒNG SỐ: {{CommitteeCode}}   NGÀY BẢO VỆ: {{DefenseDate}}"))));

        var scoreTable = new Table();
        scoreTable.AppendChild(new TableRow(
            new TableCell(new Paragraph(new Run(new Text("STT")))),
            new TableCell(new Paragraph(new Run(new Text("MSSV")))),
            new TableCell(new Paragraph(new Run(new Text("Họ và tên sinh viên")))),
            new TableCell(new Paragraph(new Run(new Text("Khoá")))),
            new TableCell(new Paragraph(new Run(new Text("Lớp")))),
            new TableCell(new Paragraph(new Run(new Text("Họ và tên giảng viên hướng dẫn")))),
            new TableCell(new Paragraph(new Run(new Text("Điểm GVHD")))),
            new TableCell(new Paragraph(new Run(new Text("CT")))),
            new TableCell(new Paragraph(new Run(new Text("UVTK")))),
            new TableCell(new Paragraph(new Run(new Text("UVPB")))),
            new TableCell(new Paragraph(new Run(new Text("Tổng"))))
        ));

        scoreTable.AppendChild(new TableRow(
            new TableCell(new Paragraph(new Run(new Text("{{RowNumber}}")))),
            new TableCell(new Paragraph(new Run(new Text("{{StudentCode}}")))),
            new TableCell(new Paragraph(new Run(new Text("{{StudentName}}")))),
            new TableCell(new Paragraph(new Run(new Text("{{CohortCode}}")))),
            new TableCell(new Paragraph(new Run(new Text("{{ClassName}}")))),
            new TableCell(new Paragraph(new Run(new Text("{{Supervisor}}")))),
            new TableCell(new Paragraph(new Run(new Text("{{ScoreGVHD}}")))),
            new TableCell(new Paragraph(new Run(new Text("{{ScoreCT}}")))),
            new TableCell(new Paragraph(new Run(new Text("{{ScoreTK}}")))),
            new TableCell(new Paragraph(new Run(new Text("{{ScorePB}}")))),
            new TableCell(new Paragraph(new Run(new Text("{{FinalScore}}"))))
        ));

        body.AppendChild(scoreTable);

        body.AppendChild(new Paragraph(new Run(new Text("Hà Nội, ngày {{DefenseDay}}tháng {{DefenseMonth}}năm {{DefenseYear}}"))));

        var memberTable = new Table();
        memberTable.AppendChild(new TableRow(
            new TableCell(new Paragraph(new Run(new Text("1")))),
            new TableCell(new Paragraph(new Run(new Text("CHỦ TỊCH")))),
            new TableCell(new Paragraph(new Run(new Text("{{ChairMemberDisplay}}"))))
        ));
        memberTable.AppendChild(new TableRow(
            new TableCell(new Paragraph(new Run(new Text("2")))),
            new TableCell(new Paragraph(new Run(new Text("UỶ VIÊN THƯ KÝ")))),
            new TableCell(new Paragraph(new Run(new Text("{{SecretaryMemberDisplay}}"))))
        ));
        memberTable.AppendChild(new TableRow(
            new TableCell(new Paragraph(new Run(new Text("3")))),
            new TableCell(new Paragraph(new Run(new Text("UỶ VIÊN PHẢN BIỆN")))),
            new TableCell(new Paragraph(new Run(new Text("{{ReviewerMemberDisplay}}"))))
        ));

        body.AppendChild(memberTable);
        main.Document.Save();
    }

    private static ApplicationDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"scoreboard-export-{Guid.NewGuid():N}")
            .Options;

        return new ApplicationDbContext(options);
    }

    private static void SeedScoreboardScenario(ApplicationDbContext db)
    {
        var now = DateTime.UtcNow;

        db.DefenseTerms.Add(new DefenseTerm
        {
            DefenseTermId = 1,
            Name = "Dot 1",
            StartDate = now.Date,
            Status = "Ready",
            ConfigJson = "{}",
            CreatedAt = now,
            LastUpdated = now
        });

        db.Committees.Add(new Committee
        {
            CommitteeID = 11,
            CommitteeCode = "CMT-11",
            Name = "Hoi dong 11",
            DefenseDate = new DateTime(2026, 5, 16),
            Status = "Ready",
            CreatedAt = now,
            LastUpdated = now
        });

        db.Classes.Add(new Class
        {
            ClassID = 1,
            ClassCode = "CNTT16A",
            ClassName = "CNTT16A",
            DepartmentID = 1,
            CohortCode = "K16",
            EnrollmentYear = 2022,
            CreatedAt = now,
            LastUpdated = now
        });

        db.StudentProfiles.Add(new StudentProfile
        {
            StudentProfileID = 1,
            StudentCode = "SV001",
            UserID = 1,
            FullName = "Sinh Vien 1",
            ClassID = 1,
            ClassCode = "CNTT16A",
            CreatedAt = now,
            LastUpdated = now
        });

        db.Topics.Add(new Topic
        {
            TopicID = 1,
            TopicCode = "TP001",
            Title = "De tai 1",
            ProposerStudentCode = "SV001",
            SupervisorLecturerCode = "GV001",
            Type = "Research",
            Status = "Eligible",
            ProposerUserID = 1,
            CreatedAt = now,
            LastUpdated = now
        });

        db.DefenseAssignments.Add(new DefenseAssignment
        {
            AssignmentID = 101,
            AssignmentCode = "ASG001",
            CommitteeID = 11,
            CommitteeCode = "CMT-11",
            TopicCode = "TP001",
            TopicID = 1,
            OrderIndex = 1,
            Session = 1,
            CreatedAt = now,
            LastUpdated = now
        });

        db.DefenseResults.Add(new DefenseResult
        {
            AssignmentId = 101,
            ScoreGvhd = 8.5m,
            ScoreCt = 8.0m,
            ScoreUvtk = 8.2m,
            ScoreUvpb = 8.1m,
            FinalScoreNumeric = 8.2m,
            FinalScoreText = "B+",
            IsLocked = true,
            IsPassed = true,
            CreatedAt = now,
            LastUpdated = now
        });

        db.LecturerProfiles.AddRange(
            new LecturerProfile { LecturerProfileID = 1, LecturerCode = "GV001", FullName = "TS. Giang Vien Huong Dan" },
            new LecturerProfile { LecturerProfileID = 2, LecturerCode = "CT001", FullName = "PGS. Chu Tich" },
            new LecturerProfile { LecturerProfileID = 3, LecturerCode = "TK001", FullName = "TS. Thu Ky" },
            new LecturerProfile { LecturerProfileID = 4, LecturerCode = "PB001", FullName = "TS. Phan Bien" }
        );

        db.CommitteeMembers.AddRange(
            new ThesisManagement.Api.Models.CommitteeMember { CommitteeMemberID = 1, CommitteeID = 11, CommitteeCode = "CMT-11", MemberLecturerCode = "CT001", Role = "CT", CreatedAt = now, LastUpdated = now },
            new ThesisManagement.Api.Models.CommitteeMember { CommitteeMemberID = 2, CommitteeID = 11, CommitteeCode = "CMT-11", MemberLecturerCode = "TK001", Role = "UVTK", CreatedAt = now, LastUpdated = now },
            new ThesisManagement.Api.Models.CommitteeMember { CommitteeMemberID = 3, CommitteeID = 11, CommitteeCode = "CMT-11", MemberLecturerCode = "PB001", Role = "UVPB", CreatedAt = now, LastUpdated = now }
        );

        db.SaveChanges();
    }

    private sealed class CaptureDocumentExportService : IDocumentExportService
    {
        public ReportData? LastReportData { get; private set; }

        public Task<ExportFileResult> ExportWordAsync(DocumentExportType type, ReportData reportData, CancellationToken cancellationToken = default)
        {
            LastReportData = reportData;
            return Task.FromResult(new ExportFileResult(new byte[] { 1, 2, 3 }, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "scoreboard.docx"));
        }

        public Task<ExportFileResult> ExportPdfAsync(DocumentExportType type, ReportData reportData, CancellationToken cancellationToken = default)
        {
            LastReportData = reportData;
            return Task.FromResult(new ExportFileResult(new byte[] { 1, 2, 3 }, "application/pdf", "scoreboard.pdf"));
        }
    }

    private sealed class FakeWebHostEnvironment : IWebHostEnvironment
    {
        public FakeWebHostEnvironment(string contentRootPath)
        {
            ContentRootPath = contentRootPath;
            WebRootPath = contentRootPath;
            ContentRootFileProvider = new PhysicalFileProvider(contentRootPath);
            WebRootFileProvider = new PhysicalFileProvider(contentRootPath);
        }

        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "ThesisManagement.Api.Tests";
        public string WebRootPath { get; set; }
        public IFileProvider WebRootFileProvider { get; set; }
        public string ContentRootPath { get; set; }
        public IFileProvider ContentRootFileProvider { get; set; }
    }
}
