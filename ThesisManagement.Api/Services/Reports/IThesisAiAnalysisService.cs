using System.Collections.Generic;
using System.Threading.Tasks;
using ThesisManagement.Api.DTOs.Reports.Command;

namespace ThesisManagement.Api.Services.Reports
{
    public interface IThesisAiAnalysisService
    {
        Task<ThesisAiAnalysisResult> AnalyzeThesisAsync(string title, string description, string techStack, string major);
        Task<ProgressReportAiAnalysisResult> AnalyzeProgressReportAsync(
            string milestoneCode, 
            string milestoneName, 
            string reportTitle, 
            string reportDescription, 
            string? fileUrl = null,
            List<string>? fileUrls = null,
            List<ExternalLinkDto>? externalLinks = null);
    }
}
