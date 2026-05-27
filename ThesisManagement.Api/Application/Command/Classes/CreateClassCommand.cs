using System;
using System.Threading.Tasks;
using AutoMapper;
using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.Application.Common;
using ThesisManagement.Api.Application.Validate.Classes;
using ThesisManagement.Api.DTOs.Classes.Command;
using ThesisManagement.Api.DTOs.Classes.Query;
using ThesisManagement.Api.Models;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Application.Command.Classes
{
    public interface ICreateClassCommand
    {
        Task<OperationResult<ClassReadDto>> ExecuteAsync(ClassCreateDto dto);
    }

    public class CreateClassCommand : ICreateClassCommand
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;

        public CreateClassCommand(IUnitOfWork uow, IMapper mapper)
        {
            _uow = uow;
            _mapper = mapper;
        }

        public async Task<OperationResult<ClassReadDto>> ExecuteAsync(ClassCreateDto dto)
        {
            var validationError = ClassCommandValidator.ValidateCreate(dto);
            if (!string.IsNullOrWhiteSpace(validationError))
                return OperationResult<ClassReadDto>.Failed(validationError, 400);

            // Verify if ClassCode already exists
            var existingCode = await _uow.Classes.Query()
                .AnyAsync(x => x.ClassCode == dto.ClassCode.Trim());
            if (existingCode)
                return OperationResult<ClassReadDto>.Failed("Class code already exists", 400);

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

            var entity = new Class
            {
                ClassCode = dto.ClassCode.Trim(),
                ClassName = dto.ClassName.Trim(),
                DepartmentID = dto.DepartmentID,
                DepartmentCode = department.DepartmentCode,
                CohortCode = cohort?.CohortCode ?? dto.CohortCode?.Trim(),
                CohortID = cohort?.Id,
                CohortName = cohort?.CohortName,
                EnrollmentYear = dto.EnrollmentYear,
                Status = dto.Status ?? "Đang hoạt động",
                CreatedAt = DateTime.UtcNow,
                LastUpdated = DateTime.UtcNow
            };

            await _uow.Classes.AddAsync(entity);
            await _uow.SaveChangesAsync();

            // Reload Class including Department relationship for mapper
            var reloaded = await _uow.Classes.Query()
                .Include(x => x.Department)
                .FirstOrDefaultAsync(x => x.ClassID == entity.ClassID);

            return OperationResult<ClassReadDto>.Succeeded(_mapper.Map<ClassReadDto>(reloaded), 201);
        }
    }
}
