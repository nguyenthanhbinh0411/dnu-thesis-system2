using System.Collections.Generic;

namespace ThesisManagement.Api.DTOs.Reports.Command
{
    public record ExternalLinkDto(string Name, string Url);

    public record StudentProgressSubmitFormDto(
        string TopicCode,
        string MilestoneCode,
        string StudentUserCode,
        string? StudentProfileCode,
        string? LecturerCode,
        string? ReportTitle,
        string? ReportDescription,
        int? AttemptNumber,
        List<ExternalLinkDto>? ExternalLinks = null);
}
