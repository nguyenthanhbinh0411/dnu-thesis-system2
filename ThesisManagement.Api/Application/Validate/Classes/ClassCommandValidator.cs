using ThesisManagement.Api.DTOs.Classes.Command;

namespace ThesisManagement.Api.Application.Validate.Classes
{
    public static class ClassCommandValidator
    {
        public static string? ValidateCreate(ClassCreateDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.ClassCode))
                return "Class code is required";

            if (string.IsNullOrWhiteSpace(dto.ClassName))
                return "Class name is required";

            if (dto.DepartmentID <= 0)
                return "Department is required";

            return null;
        }

        public static string? ValidateUpdate(ClassUpdateDto dto)
        {
            if (dto.ClassName is not null && string.IsNullOrWhiteSpace(dto.ClassName))
                return "Class name cannot be empty";

            if (dto.DepartmentID <= 0)
                return "Department is required";

            return null;
        }
    }
}
