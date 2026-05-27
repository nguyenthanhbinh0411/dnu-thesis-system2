using ThesisManagement.Api.DTOs;

namespace ThesisManagement.Api.DTOs.Classes.Query
{
    public class ClassFilter : BaseFilter
    {
        public string? ClassName { get; set; }
        public string? ClassCode { get; set; }
        public string? DepartmentCode { get; set; }
        public string? CohortCode { get; set; }
        public string? Status { get; set; }
    }
}
