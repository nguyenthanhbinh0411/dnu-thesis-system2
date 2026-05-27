using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.DTOs.Classes.Query;
using ThesisManagement.Api.Helpers;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Application.Query.Classes
{
    public interface IGetClassesListQuery
    {
        Task<(IEnumerable<ClassReadDto> Items, int TotalCount)> ExecuteAsync(ClassFilter filter);
    }

    public class GetClassesListQuery : IGetClassesListQuery
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;

        public GetClassesListQuery(IUnitOfWork uow, IMapper mapper)
        {
            _uow = uow;
            _mapper = mapper;
        }

        public async Task<(IEnumerable<ClassReadDto> Items, int TotalCount)> ExecuteAsync(ClassFilter filter)
        {
            var result = await _uow.Classes.GetPagedWithFilterAsync(filter.Page, filter.PageSize, filter,
                (query, f) => query.Include(x => x.Department).ApplyFilter(f));

            var items = result.Items.Select(x => _mapper.Map<ClassReadDto>(x));
            return (items, result.TotalCount);
        }
    }
}
