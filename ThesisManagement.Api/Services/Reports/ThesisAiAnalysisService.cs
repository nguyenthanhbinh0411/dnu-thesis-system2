using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using ThesisManagement.Api.Helpers;
using ThesisManagement.Api.Services.Chat;
using ThesisManagement.Api.DTOs.Reports.Command;

namespace ThesisManagement.Api.Services.Reports
{
    public class ThesisAiAnalysisService : IThesisAiAnalysisService
    {
        private readonly IGroqService _groqService;
        private readonly IReportContentExtractor _extractor;

        public ThesisAiAnalysisService(IGroqService groqService, IReportContentExtractor extractor)
        {
            _groqService = groqService;
            _extractor = extractor;
        }

        public async Task<ThesisAiAnalysisResult> AnalyzeThesisAsync(string title, string description, string techStack, string major)
        {
            var userMessage = $@"
[CHUYÊN NGÀNH]: {major}
[ĐỀ TÀI]: {title}
[MÔ TẢ]: {description}
[CÔNG NGHỆ]: {techStack}
";

            string jsonResponse = string.Empty;
            try
            {
                jsonResponse = await _groqService.GetRawCompletionAsync(
                    AiPrompts.ThesisReviewerSystemPrompt, 
                    userMessage, 
                    useJsonMode: true);

                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };
                var result = JsonSerializer.Deserialize<ThesisAiAnalysisResult>(jsonResponse, options);
                return result ?? GetFallbackResult("AI trả về kết quả rỗng.");
            }
            catch (Exception ex)
            {
                // Log error here if needed
                return GetFallbackResult($"Lỗi khi phân tích dữ liệu AI: {ex.Message}");
            }
        }

        public async Task<ProgressReportAiAnalysisResult> AnalyzeProgressReportAsync(
            string milestoneCode, 
            string milestoneName, 
            string reportTitle, 
            string reportDescription,

            string? fileUrl = null,
            List<string>? fileUrls = null,
            List<ExternalLinkDto>? externalLinks = null)
        {
            var filesToProcess = new List<string>();
            if (fileUrls != null && fileUrls.Count > 0)
            {
                filesToProcess.AddRange(fileUrls);
            }
            else if (!string.IsNullOrEmpty(fileUrl))
            {
                filesToProcess.Add(fileUrl);
            }

            var sbContent = new System.Text.StringBuilder();

            if (filesToProcess.Count > 0)
            {
                for (int i = 0; i < filesToProcess.Count; i++)
                {
                    var url = filesToProcess[i];
                    string fileName = $"Tệp #{i + 1}";
                    try
                    {
                        var uri = new Uri(url);
                        var decodedPath = System.Web.HttpUtility.UrlDecode(uri.AbsolutePath);
                        var name = System.IO.Path.GetFileName(decodedPath);
                        if (!string.IsNullOrEmpty(name)) fileName = name;
                    }
                    catch { }

                    string text = await _extractor.ExtractTextAsync(url, reportDescription);
                    if (!string.IsNullOrWhiteSpace(text))
                    {
                        sbContent.AppendLine($"\n--- NỘI DUNG TỪ TỆP: {fileName} ---");
                        sbContent.AppendLine(text);
                        sbContent.AppendLine($"--- HẾT NỘI DUNG TỆP: {fileName} ---\n");
                    }
                }
            }

            string extractedContent = sbContent.ToString();
            if (string.IsNullOrWhiteSpace(extractedContent))
            {
                extractedContent = filesToProcess.Count > 0 
                    ? "Không thể trích xuất nội dung từ các tệp đính kèm (có thể file lỗi hoặc không chứa text)." 
                    : "Không có tệp đính kèm.";
            }

            // Xử lý thông tin liên kết ngoài
            var sbLinks = new System.Text.StringBuilder();
            if (externalLinks != null && externalLinks.Count > 0)
            {
                sbLinks.AppendLine("\n--- CÁC LIÊN KẾT NGOÀI ĐÍNH KÈM ---");
                foreach (var link in externalLinks)
                {
                    sbLinks.AppendLine($"- [{link.Name}]: {link.Url}");
                }
                sbLinks.AppendLine("----------------------------------\n");
            }
            string linksContent = sbLinks.ToString();
            string? fileUrl = null)
        {
            string extractedContent = "Không có tệp đính kèm hoặc không thể trích xuất nội dung.";
            
            if (!string.IsNullOrEmpty(fileUrl))
            {
                extractedContent = await _extractor.ExtractTextAsync(fileUrl, reportDescription);
                if (string.IsNullOrWhiteSpace(extractedContent))
                {
                    extractedContent = "Không thể trích xuất nội dung từ tệp (có thể file bị lỗi hoặc không có chữ).";
                }
            }

            var userMessage = $@"
[MỐC TIẾN ĐỘ]: {milestoneCode} - {milestoneName}
[TIÊU ĐỀ BÁO CÁO]: {reportTitle}
[MÔ TẢ CỦA SINH VIÊN]: {reportDescription}
{linksContent}
[NỘI DUNG THỰC TẾ TRÍCH XUẤT TỪ CÁC FILE]: 

[NỘI DUNG THỰC TẾ TRÍCH XUẤT TỪ FILE]: 

--- BẮT ĐẦU NỘI DUNG FILE ---
{extractedContent}
--- KẾT THÚC NỘI DUNG FILE ---

NHIỆM VỤ: Hãy đối chiếu mô tả của sinh viên, các liên kết ngoài đã nộp và nội dung thực tế trích xuất từ file. Xác định xem sinh viên có trung thực và báo cáo có đạt chất lượng không.
";

            try
            {
                var jsonResponse = await _groqService.GetRawCompletionAsync(
                    AiPrompts.ProgressReportSystemPrompt,
                    userMessage,
                    useJsonMode: true);

                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var result = JsonSerializer.Deserialize<ProgressReportAiAnalysisResult>(jsonResponse, options);
                
                return result ?? GetProgressFallbackResult("AI trả về kết quả rỗng.");
            }
            catch (Exception ex)
            {
                return GetProgressFallbackResult($"Lỗi khi phân tích báo cáo: {ex.Message}");
            }
        }

        private ProgressReportAiAnalysisResult GetProgressFallbackResult(string errorMessage)
        {
            return new ProgressReportAiAnalysisResult
            {
                Summary = $"Không thể lấy kết quả phân tích từ AI. Chi tiết: {errorMessage}",
                RiskLevel = "Không xác định",
                RecommendedAction = "Kiểm tra thủ công",
                SuggestedFeedback = "Vui lòng xem trực tiếp báo cáo của sinh viên."
            };
        }

        private ThesisAiAnalysisResult GetFallbackResult(string errorMessage)
        {
            return new ThesisAiAnalysisResult
            {
                OverallScore = 0,
                Status = "Lỗi hệ thống",
                Summary = $"Không thể lấy kết quả phân tích từ AI. Chi tiết: {errorMessage}",
                Criteria = new List<CriterionRating>
                {
                    new CriterionRating { Name = "Lỗi", Score = 0, Comment = "Vui lòng thử lại sau hoặc liên hệ quản trị viên." }
                }
            };
        }
    }
}
