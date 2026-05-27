using System;
using System.Threading.Tasks;
using AutoMapper;
using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.Application.Common;
using ThesisManagement.Api.Application.Validate.Classes;
using ThesisManagement.Api.DTOs.Classes.Command;
using ThesisManagement.Api.DTOs.Classes.Query;
using ThesisManagement.Api.Services;
using ThesisManagement.Api.Models;

namespace ThesisManagement.Api.Application.Command.Classes
{
    public interface IUpdateClassCommand
    {
        Task<OperationResult<ClassReadDto>> ExecuteAsync(int id, ClassUpdateDto dto);
    }

    public class UpdateClassCommand : IUpdateClassCommand
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;

        public UpdateClassCommand(IUnitOfWork uow, IMapper mapper)
        {
            _uow = uow;
            _mapper = mapper;
        }

        public async Task<OperationResult<ClassReadDto>> ExecuteAsync(int id, ClassUpdateDto dto)
        {
            var validationError = ClassCommandValidator.ValidateUpdate(dto);
            if (!string.IsNullOrWhiteSpace(validationError))
                return OperationResult<ClassReadDto>.Failed(validationError, 400);

            var entity = await _uow.Classes.GetByIdAsync(id);
            if (entity == null)
                return OperationResult<ClassReadDto>.Failed("Class not found", 404);

            // Resolve Department to get DepartmentCode
            var department = await _uow.Departments.GetByIdAsync(dto.DepartmentID);
            if (department == null)
                return OperationResult<ClassReadDto>.Failed("Department not found", 400);

            // Fetch cohort details from DB to sync fields manually
            Cohort? cohort = null;
            if (!string.IsNullOrWhiteSpace(dto.CohortCode))
            {
                cohort = await _uow.Cohorts.Query()
                    .FirstOrDefaultAsync(x => x.CohortCode.Trim() == dto.CohortCode.Trim());
            }

            entity.ClassName = dto.ClassName.Trim();
            entity.DepartmentID = dto.DepartmentID;
            entity.DepartmentCode = department.DepartmentCode;
            entity.CohortCode = cohort?.CohortCode ?? dto.CohortCode?.Trim();
            entity.CohortID = cohort?.Id;
            entity.CohortName = cohort?.CohortName;
            entity.EnrollmentYear = dto.EnrollmentYear;
            entity.Status = dto.Status ?? "Đang hoạt động";
            entity.LastUpdated = DateTime.UtcNow;

            _uow.Classes.Update(entity);
            await _uow.SaveChangesAsync();

            // Reload Class including Department relationship for mapper
            var reloaded = await _uow.Classes.Query()
                .Include(x => x.Department)
                .FirstOrDefaultAsync(x => x.ClassID == entity.ClassID);

            return OperationResult<ClassReadDto>.Succeeded(_mapper.Map<ClassReadDto>(reloaded), 200);
        }
    }
}
