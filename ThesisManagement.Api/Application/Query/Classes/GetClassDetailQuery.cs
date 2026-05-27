using System.Threading.Tasks;
using AutoMapper;
using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.DTOs.Classes.Query;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Application.Query.Classes
{
    public interface IGetClassDetailQuery
    {
        Task<ClassReadDto?> ExecuteAsync(string code);
    }

    public class GetClassDetailQuery : IGetClassDetailQuery
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;

        public GetClassDetailQuery(IUnitOfWork uow, IMapper mapper)
        {
            _uow = uow;
            _mapper = mapper;
        }

        public async Task<ClassReadDto?> ExecuteAsync(string code)
        {
            if (string.IsNullOrWhiteSpace(code)) return null;

            var item = await _uow.Classes.Query()
                .Include(x => x.Department)
                .FirstOrDefaultAsync(x => x.ClassCode == code.Trim());

            return item == null ? null : _mapper.Map<ClassReadDto>(item);
        }
    }
}
