using System;

namespace ThesisManagement.Api.DTOs.CatalogTopics.Command
{
    public record CatalogTopicCreateDto(
        string Title,
        string? Summary,
        string? DepartmentCode,
        string? AssignedStatus,
        DateTime? AssignedAt,
        string? LecturerCode = null,
        string? LecturerName = null);

    public record CatalogTopicUpdateDto(
        string? Title,
        string? Summary,
        string? DepartmentCode,
        string? AssignedStatus,
        DateTime? AssignedAt,
        IEnumerable<int>? TagIDs = null,
        IEnumerable<string>? TagCodes = null,
        string? LecturerCode = null,
        string? LecturerName = null);
}