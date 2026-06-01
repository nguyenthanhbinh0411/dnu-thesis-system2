using System.Reflection;
using System.Text.Json;
using Aspose.Words;
using ThesisManagement.Api.DTOs.DocumentExports;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using OpenXmlParagraph = DocumentFormat.OpenXml.Wordprocessing.Paragraph;
using AsposeWordDocument = Aspose.Words.Document;

namespace ThesisManagement.Api.Services.DocumentExports;

public sealed class DocumentExportService : IDocumentExportService
{
    private static readonly IReadOnlyDictionary<DocumentExportType, string> TemplateNames = new Dictionary<DocumentExportType, string>
    {
        [DocumentExportType.BangDiem] = "BẢNG ĐIỂM GHI KẾT QUẢ BẢO VỆ.docx",
        [DocumentExportType.BienBan] = "BIÊN BẢN HỌP.docx",
        [DocumentExportType.NhanXet] = "NHẬN XÉT CỦA NGƯỜI PHẢN BIỆN.docx"
    };

    private readonly IWebHostEnvironment _environment;

    public DocumentExportService(IWebHostEnvironment environment)
    {
        _environment = environment;
    }

    public async Task<ExportFileResult> ExportWordAsync(DocumentExportType type, ReportData reportData, CancellationToken cancellationToken = default)
    {
        var templatePath = GetTemplatePath(type);
        var templateBytes = await ReadTemplateBytesWithRetryAsync(templatePath, cancellationToken);
        var tokens = BuildTokenMap(reportData);
        var resultBytes = ReplaceTokensInDocx(type, templateBytes, tokens, reportData);

        return new ExportFileResult(
            resultBytes,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            BuildFileName(type, "docx"));
    }

    public async Task<ExportFileResult> ExportPdfAsync(DocumentExportType type, ReportData reportData, CancellationToken cancellationToken = default)
    {
        var wordExport = await ExportWordAsync(type, reportData, cancellationToken);

        using var input = new MemoryStream(wordExport.Content);
        var wordDocument = new AsposeWordDocument(input);
        using var output = new MemoryStream();
        wordDocument.Save(output, SaveFormat.Pdf);

        return new ExportFileResult(output.ToArray(), "application/pdf", BuildFileName(type, "pdf"));
    }

    private static async Task<byte[]> ReadTemplateBytesWithRetryAsync(string templatePath, CancellationToken cancellationToken)
    {
        const int maxAttempts = 5;
        IOException? lastIOException = null;

        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                await using var stream = new FileStream(
                    templatePath,
                    FileMode.Open,
                    FileAccess.Read,
                    FileShare.ReadWrite | FileShare.Delete,
                    bufferSize: 64 * 1024,
                    options: FileOptions.Asynchronous | FileOptions.SequentialScan);

                using var memory = new MemoryStream();
                await stream.CopyToAsync(memory, cancellationToken);
                return memory.ToArray();
            }
            catch (IOException ex) when (attempt < maxAttempts)
            {
                lastIOException = ex;
                await Task.Delay(120 * attempt, cancellationToken);
            }
            catch (IOException ex)
            {
                lastIOException = ex;
                break;
            }
        }

        throw new IOException(
            $"Không thể đọc file template: {Path.GetFileName(templatePath)}. Vui lòng đóng file Word đang mở và thử lại.",
            lastIOException);
    }

    private static byte[] ReplaceTokensInDocx(
        DocumentExportType type,
        byte[] templateBytes,
        IReadOnlyDictionary<string, string?> tokenMap,
        ReportData reportData)
    {
        using var stream = new MemoryStream();
        stream.Write(templateBytes, 0, templateBytes.Length);
        stream.Position = 0;

        using (var wordDoc = WordprocessingDocument.Open(stream, true))
        {
            var mainPart = wordDoc.MainDocumentPart;
            if (mainPart == null)
            {
                return templateBytes;
            }

            // For BangDiem, expand row markers before global replacement so row-level tokens are preserved.
            if (type == DocumentExportType.BangDiem)
            {
                ExpandBangDiemRows(mainPart, reportData);
            }

            ReplaceTokensInPart(mainPart, tokenMap);

            foreach (var headerPart in mainPart.HeaderParts)
            {
                ReplaceTokensInPart(headerPart, tokenMap);
            }

            foreach (var footerPart in mainPart.FooterParts)
            {
                ReplaceTokensInPart(footerPart, tokenMap);
            }

            if (mainPart.FootnotesPart != null)
            {
                ReplaceTokensInPart(mainPart.FootnotesPart, tokenMap);
            }

            if (mainPart.EndnotesPart != null)
            {
                ReplaceTokensInPart(mainPart.EndnotesPart, tokenMap);
            }

            mainPart.Document?.Save();
        }

        stream.Position = 0;
        using var outMs = new MemoryStream();
        stream.CopyTo(outMs);
        return outMs.ToArray();
    }

    private static void ExpandBangDiemRows(MainDocumentPart mainPart, ReportData reportData)
    {
        if (!reportData.AdditionalTokens.TryGetValue("StudentRowsJson", out var rowsJson) || string.IsNullOrWhiteSpace(rowsJson))
        {
            return;
        }

        var rows = JsonSerializer.Deserialize<List<ScoreboardRowTokenData>>(rowsJson) ?? new List<ScoreboardRowTokenData>();
        if (rows.Count == 0)
        {
            return;
        }

        var table = mainPart.Document?.Body?.Descendants<Table>()
            .FirstOrDefault(t => t.Descendants<Text>().Any(text =>
                text.Text.Contains("{{RowNumber}}", StringComparison.OrdinalIgnoreCase)
                || text.Text.Contains("{{StudentCode}}", StringComparison.OrdinalIgnoreCase)
                || text.Text.Contains("{{StudentName}}", StringComparison.OrdinalIgnoreCase)));

        if (table == null)
        {
            return;
        }

        var markerRow = table.Elements<TableRow>()
            .FirstOrDefault(tr => tr.Descendants<Text>().Any(text =>
                text.Text.Contains("{{RowNumber}}", StringComparison.OrdinalIgnoreCase)
                || text.Text.Contains("{{StudentCode}}", StringComparison.OrdinalIgnoreCase)
                || text.Text.Contains("{{StudentName}}", StringComparison.OrdinalIgnoreCase)));

        if (markerRow == null)
        {
            return;
        }

        foreach (var row in rows)
        {
            var clone = (TableRow)markerRow.CloneNode(true);
            var rowTokens = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
            {
                ["{{RowNumber}}"] = row.RowNumber,
                ["{{StudentCode}}"] = row.StudentCode,
                ["{{StudentName}}"] = row.StudentName,
                ["{{ClassName}}"] = row.ClassName,
                ["{{CohortCode}}"] = row.CohortCode,
                ["{{Khoa}}"] = row.CohortCode,
                ["{{ClassCode}}"] = row.ClassCode,
                ["{{Supervisor}}"] = row.Supervisor,
                ["{{ScoreGVHD}}"] = row.ScoreGVHD,
                ["{{ScoreCT}}"] = row.ScoreCT,
                ["{{ScoreTK}}"] = row.ScoreTK,
                ["{{ScorePB}}"] = row.ScorePB,
                ["{{FinalScore}}"] = row.FinalScore,
                ["{{TopicTitle}}"] = row.TopicTitle,
            };

            ReplaceTokensInElement(clone, rowTokens);
            markerRow.InsertBeforeSelf(clone);
        }

        markerRow.Remove();
    }

    private static void ReplaceTokensInElement(OpenXmlElement element, IReadOnlyDictionary<string, string?> tokenMap)
    {
        foreach (var paragraph in element.Descendants<OpenXmlParagraph>())
        {
            var texts = paragraph.Descendants<Text>().ToList();
            if (texts.Count == 0)
            {
                continue;
            }

            var original = string.Concat(texts.Select(x => x.Text));
            var modified = original;

            foreach (var kv in tokenMap)
            {
                if (modified.Contains(kv.Key, StringComparison.OrdinalIgnoreCase))
                {
                    modified = modified.Replace(kv.Key, kv.Value ?? string.Empty, StringComparison.OrdinalIgnoreCase);
                }
            }

            if (!string.Equals(original, modified, StringComparison.Ordinal))
            {
                if (modified.Contains('\n'))
                {
                    var lines = modified.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);
                    var parentRun = texts[0].Parent;
                    if (parentRun != null)
                    {
                        foreach (var txt in texts)
                        {
                            txt.Remove();
                        }
                        for (int i = 0; i < lines.Length; i++)
                        {
                            if (i > 0)
                            {
                                parentRun.AppendChild(new Break());
                            }
                            parentRun.AppendChild(new Text(lines[i]) { Space = SpaceProcessingModeValues.Preserve });
                        }
                    }
                    else
                    {
                        texts[0].Text = modified;
                        for (var i = 1; i < texts.Count; i++)
                        {
                            texts[i].Text = string.Empty;
                        }
                    }
                }
                else
                {
                    texts[0].Text = modified;
                    for (var i = 1; i < texts.Count; i++)
                    {
                        texts[i].Text = string.Empty;
                    }
                }
            }
        }
    }

    private sealed class ScoreboardRowTokenData
    {
        public string RowNumber { get; set; } = string.Empty;
        public string StudentCode { get; set; } = string.Empty;
        public string StudentName { get; set; } = string.Empty;
        public string ClassName { get; set; } = string.Empty;
        public string CohortCode { get; set; } = string.Empty;
        public string ClassCode { get; set; } = string.Empty;
        public string Supervisor { get; set; } = string.Empty;
        public string ScoreGVHD { get; set; } = string.Empty;
        public string ScoreCT { get; set; } = string.Empty;
        public string ScoreTK { get; set; } = string.Empty;
        public string ScorePB { get; set; } = string.Empty;
        public string FinalScore { get; set; } = string.Empty;
        public string TopicTitle { get; set; } = string.Empty;
    }

    private static void ReplaceTokensInPart(OpenXmlPart? part, IReadOnlyDictionary<string, string?> tokenMap)
    {
        if (part?.RootElement == null)
        {
            return;
        }

        foreach (var paragraph in part.RootElement.Descendants<OpenXmlParagraph>())
        {
            var texts = paragraph.Descendants<Text>().ToList();
            if (texts.Count == 0)
            {
                continue;
            }

            var original = string.Concat(texts.Select(x => x.Text));
            var modified = original;

            foreach (var kv in tokenMap)
            {
                // Replace all tokens, even if value is empty string or whitespace
                // This ensures tokens are removed or replaced with empty content
                if (modified.Contains(kv.Key, StringComparison.OrdinalIgnoreCase))
                {
                    modified = modified.Replace(kv.Key, kv.Value ?? string.Empty, StringComparison.OrdinalIgnoreCase);
                }
            }

            if (!string.Equals(original, modified, StringComparison.Ordinal))
            {
                if (modified.Contains('\n'))
                {
                    var lines = modified.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);
                    var parentRun = texts[0].Parent;
                    if (parentRun != null)
                    {
                        foreach (var txt in texts)
                        {
                            txt.Remove();
                        }
                        for (int i = 0; i < lines.Length; i++)
                        {
                            if (i > 0)
                            {
                                parentRun.AppendChild(new Break());
                            }
                            parentRun.AppendChild(new Text(lines[i]) { Space = SpaceProcessingModeValues.Preserve });
                        }
                    }
                    else
                    {
                        texts[0].Text = modified;
                        for (var i = 1; i < texts.Count; i++)
                        {
                            texts[i].Text = string.Empty;
                        }
                    }
                }
                else
                {
                    texts[0].Text = modified;
                    for (var i = 1; i < texts.Count; i++)
                    {
                        texts[i].Text = string.Empty;
                    }
                }
            }
        }
    }

    private static Dictionary<string, string?> BuildTokenMap(ReportData reportData)
    {
        var tokens = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);

        // Include ALL string properties from ReportData, even if empty
        // This ensures score fields and other important tokens are always present
        foreach (var property in typeof(ReportData).GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            if (property.PropertyType != typeof(string))
            {
                continue;
            }

            var value = property.GetValue(reportData) as string;
            // Always include the token, even if value is empty (will replace with empty string)
            tokens[$"{{{{{property.Name}}}}}"] = value ?? string.Empty;
        }

        SetIfMissing(tokens, "StudentCode", reportData.Student?.StudentCode);
        SetIfMissing(tokens, "StudentFullName", reportData.Student?.FullName);
        SetIfMissing(tokens, "ClassName", reportData.Student?.ClassName);
        SetIfMissing(tokens, "CourseName", reportData.Student?.CourseName);
        SetIfMissing(tokens, "TopicTitle", reportData.Student?.TopicTitle ?? reportData.TopicTitle);
        SetIfMissing(tokens, "MajorName", reportData.Student?.MajorName ?? reportData.MajorName);

        SetIfMissing(tokens, "ChairMemberDisplay", reportData.ChairMemberDisplay ?? reportData.ChairMember?.GetDisplayName());
        SetIfMissing(tokens, "ReviewerMemberDisplay", reportData.ReviewerMemberDisplay ?? reportData.ReviewerMember?.GetDisplayName());
        SetIfMissing(tokens, "SecretaryMemberDisplay", reportData.SecretaryMemberDisplay ?? reportData.SecretaryMember?.GetDisplayName());
        SetIfMissing(tokens, "SupervisorDisplay", reportData.SupervisorDisplay ?? reportData.Supervisor?.GetDisplayName());
        SetIfMissing(tokens, "ReviewerDisplay", reportData.ReviewerDisplay ?? reportData.ReviewerMember?.GetDisplayName());

        SetIfMissing(tokens, "Chapter1Content", reportData.Chapter1Content);
        SetIfMissing(tokens, "Chapter2Content", reportData.Chapter2Content);
        SetIfMissing(tokens, "Chapter3Content", reportData.Chapter3Content);
        SetIfMissing(tokens, "ChapterNContent", reportData.ChapterNContent);

        var chapters = reportData.ChapterContents.Where(content => !string.IsNullOrWhiteSpace(content)).Select(content => content.Trim()).ToList();
        if (chapters.Count > 0)
        {
            SetIfMissing(tokens, "Chapter1Content", chapters.ElementAtOrDefault(0));
            SetIfMissing(tokens, "Chapter2Content", chapters.ElementAtOrDefault(1));
            SetIfMissing(tokens, "Chapter3Content", chapters.ElementAtOrDefault(2));

            if (chapters.Count > 3)
            {
                SetIfMissing(tokens, "ChapterNContent", string.Join(Environment.NewLine + Environment.NewLine, chapters.Skip(3)));
            }
        }

        foreach (var additionalToken in reportData.AdditionalTokens)
        {
            tokens[$"{{{{{additionalToken.Key}}}}}"] = additionalToken.Value;
        }

        return tokens;
    }

    private string GetTemplatePath(DocumentExportType type)
    {
        if (!TemplateNames.TryGetValue(type, out var fileName))
        {
            throw new ArgumentOutOfRangeException(nameof(type), type, "Unsupported export type.");
        }

        var templatePath = Path.Combine(_environment.ContentRootPath, "Templates", fileName);
        if (!File.Exists(templatePath))
        {
            throw new FileNotFoundException($"Template file was not found: {fileName}", templatePath);
        }

        return templatePath;
    }

    private static void SetIfMissing(IDictionary<string, string?> tokens, string tokenName, string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return;
        }

        var tokenKey = $"{{{{{tokenName}}}}}";
        if (!tokens.ContainsKey(tokenKey))
        {
            tokens[tokenKey] = value;
        }
    }

    private static string BuildFileName(DocumentExportType type, string extension)
    {
        var baseName = type switch
        {
            DocumentExportType.BangDiem => "bang-diem",
            DocumentExportType.BienBan => "bien-ban",
            DocumentExportType.NhanXet => "nhan-xet",
            _ => "export"
        };

        return $"{baseName}-{DateTime.UtcNow:yyyyMMdd-HHmmss}.{extension}";
    }
}