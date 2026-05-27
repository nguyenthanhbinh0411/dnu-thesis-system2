using System.Threading.Tasks;
using ThesisManagement.Api.DTOs.Classes.Command;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Application.Query.Classes
{
    public interface IGetClassUpdateQuery
    {
        Task<ClassUpdateDto?> ExecuteAsync(int id);
    }

    public class GetClassUpdateQuery : IGetClassUpdateQuery
    {
        private readonly IUnitOfWork _uow;

        public GetClassUpdateQuery(IUnitOfWork uow)
        {
            _uow = uow;
        }

        public async Task<ClassUpdateDto?> ExecuteAsync(int id)
        {
            var item = await _uow.Classes.GetByIdAsync(id);
            return item == null ? null : new ClassUpdateDto(
                item.ClassName,
                item.DepartmentID,
                item.CohortCode,
                item.EnrollmentYear,
                item.Status
            );
        }
    }
}
