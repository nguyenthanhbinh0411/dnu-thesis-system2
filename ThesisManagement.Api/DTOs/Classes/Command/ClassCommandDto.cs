namespace ThesisManagement.Api.DTOs.Classes.Command
{
    public record ClassCreateDto(
        string ClassCode,
        string ClassName,
        int DepartmentID,
        string? CohortCode,
        int? EnrollmentYear,
        string? Status
    );

    public record ClassUpdateDto(
        string ClassName,
        int DepartmentID,
        string? CohortCode,
        int? EnrollmentYear,
        string? Status
    );
}
