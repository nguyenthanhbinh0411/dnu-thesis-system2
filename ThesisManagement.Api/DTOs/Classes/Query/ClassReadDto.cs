using System;

namespace ThesisManagement.Api.DTOs.Classes.Query
{
    public record ClassReadDto(
        int ClassID,
        string ClassCode,
        string ClassName,
        int DepartmentID,
        string? DepartmentCode,
        string? DepartmentName,
        string? CohortCode,
        int? EnrollmentYear,
        string? Status,
        DateTime? CreatedAt,
        DateTime? LastUpdated
    );
}
