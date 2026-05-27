using System;

namespace ThesisManagement.Api.DTOs.CatalogTopics.Query
{
    public record CatalogTopicReadDto(
        int CatalogTopicID,
        string CatalogTopicCode,
        string Title,
        string? Summary,
        string? DepartmentCode,
        string? AssignedStatus,
        DateTime? AssignedAt,
        string? LecturerCode,
        string? LecturerName,
        int? DefenseTermId,
        DateTime? CreatedAt,
        DateTime? LastUpdated);
}