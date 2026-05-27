using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.Application.Common;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Application.Command.Classes
{
    public interface IDeleteClassCommand
    {
        Task<OperationResult<bool>> ExecuteAsync(int id);
    }

    public class DeleteClassCommand : IDeleteClassCommand
    {
        private readonly IUnitOfWork _uow;

        public DeleteClassCommand(IUnitOfWork uow)
        {
            _uow = uow;
        }

        public async Task<OperationResult<bool>> ExecuteAsync(int id)
        {
            var entity = await _uow.Classes.GetByIdAsync(id);
            if (entity == null)
                return OperationResult<bool>.Failed("Class not found", 404);

            // Check if any student profiles are linked to this class
            var hasLinkedStudents = await _uow.StudentProfiles.Query()
                .AnyAsync(x => x.ClassID == id);
            if (hasLinkedStudents)
                return OperationResult<bool>.Failed("Cannot delete class because it has linked student profiles", 400);

            _uow.Classes.Remove(entity);
            await _uow.SaveChangesAsync();

            return OperationResult<bool>.Succeeded(true, 200);
        }
    }
}
