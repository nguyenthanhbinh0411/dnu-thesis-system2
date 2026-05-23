using System.Collections.Generic;

namespace ThesisManagement.Api.DTOs.Topics.Command
{
    public class AutoAssignRequestDto
    {
        public int DefenseTermId { get; set; }
    }

    public class AutoAssignPreviewDto
    {
        public string StudentCode { get; set; } = string.Empty;
        public string StudentName { get; set; } = string.Empty;
        public string StudentDepartment { get; set; } = string.Empty;
        public string CatalogTopicCode { get; set; } = string.Empty;
        public string TopicTitle { get; set; } = string.Empty;
        public string SupervisorLecturerCode { get; set; } = string.Empty;
        public string SupervisorLecturerName { get; set; } = string.Empty;
        public int MatchTagsCount { get; set; }
        public bool IsFallback { get; set; }
        public List<string> CommonTags { get; set; } = new();
    }

    public class AutoAssignAssignmentDto
    {
        public string StudentCode { get; set; } = string.Empty;
        public string CatalogTopicCode { get; set; } = string.Empty;
        public string TopicTitle { get; set; } = string.Empty;
        public string SupervisorLecturerCode { get; set; } = string.Empty;
    }
}
