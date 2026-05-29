using System;

namespace ThesisManagement.Api.Models
{
    public class ProgressMilestoneStep
    {
        public int StepID { get; set; }
        public int MilestoneID { get; set; }
        public string MilestoneTemplateCode { get; set; } = null!;
        public int Ordinal { get; set; }
        public string State { get; set; } = "Pending";
        public DateTime? CompletedAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime LastUpdated { get; set; } = DateTime.UtcNow;

        public ProgressMilestone? Milestone { get; set; }
    }
}
