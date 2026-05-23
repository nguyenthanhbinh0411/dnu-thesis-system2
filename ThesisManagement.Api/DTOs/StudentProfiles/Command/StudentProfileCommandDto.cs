using System;

namespace ThesisManagement.Api.DTOs.StudentProfiles.Command
{
    public record StudentProfileCreateDto(
        string UserCode,
        string? DepartmentCode,
        string? ClassCode,
        string? FacultyCode,
        string? StudentImage,
        decimal? GPA,
        string? AcademicStanding,
        string? Gender,
        DateTime? DateOfBirth,
        string? PhoneNumber,
        string? StudentEmail,
        string? Address,
        int? EnrollmentYear,
        string? Status,
        int? GraduationYear,
        string? Notes,
        string? FullName,
        /// <summary>Đợt bảo vệ mà sinh viên được import vào. Nếu StudentCode đã tồn tại, chỉ cập nhật DefenseTermId.</summary>
        int? DefenseTermId = null);

    public record StudentProfileUpdateDto(
        string? StudentCode,
        string? UserCode,
        string? DepartmentCode,
        string? ClassCode,
        string? FacultyCode,
        decimal? GPA,
        string? AcademicStanding,
        string? Gender,
        DateTime? DateOfBirth,
        string? PhoneNumber,
        string? StudentEmail,
        string? Address,
        int? EnrollmentYear,
        string? Status,
        int? GraduationYear,
        string? Notes,
        string? FullName,
        int? DefenseTermId = null);
}