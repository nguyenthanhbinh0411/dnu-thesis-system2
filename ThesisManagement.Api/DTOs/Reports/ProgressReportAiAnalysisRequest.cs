using System.Collections.Generic;
using ThesisManagement.Api.DTOs.Reports.Command;

namespace ThesisManagement.Api.DTOs.Reports
{
    public class ProgressReportAiAnalysisRequest
    {
        public string MilestoneCode { get; set; } = string.Empty;
        public string MilestoneName { get; set; } = string.Empty;
        public string ReportTitle { get; set; } = string.Empty;
        public string ReportDescription { get; set; } = string.Empty;
        public string? FileUrl { get; set; }
        public List<string>? FileUrls { get; set; }
        public List<ExternalLinkDto>? ExternalLinks { get; set; }
    }
}
