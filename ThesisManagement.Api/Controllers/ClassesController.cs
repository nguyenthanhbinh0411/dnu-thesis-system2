using System.Collections.Generic;
using System.Threading.Tasks;
using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using ThesisManagement.Api.Application.Command.Classes;
using ThesisManagement.Api.Application.Query.Classes;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.DTOs.Classes.Command;
using ThesisManagement.Api.DTOs.Classes.Query;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Controllers
{
    public class ClassesController : BaseApiController
    {
        private readonly IGetClassesListQuery _getClassesListQuery;
        private readonly IGetClassDetailQuery _getClassDetailQuery;
        private readonly IGetClassCreateQuery _getClassCreateQuery;
        private readonly IGetClassUpdateQuery _getClassUpdateQuery;
        private readonly ICreateClassCommand _createClassCommand;
        private readonly IUpdateClassCommand _updateClassCommand;
        private readonly IDeleteClassCommand _deleteClassCommand;

        public ClassesController(
            IUnitOfWork uow,
            ICodeGenerator codeGen,
            IMapper mapper,
            IGetClassesListQuery getClassesListQuery,
            IGetClassDetailQuery getClassDetailQuery,
            IGetClassCreateQuery getClassCreateQuery,
            IGetClassUpdateQuery getClassUpdateQuery,
            ICreateClassCommand createClassCommand,
            IUpdateClassCommand updateClassCommand,
            IDeleteClassCommand deleteClassCommand) : base(uow, codeGen, mapper)
        {
            _getClassesListQuery = getClassesListQuery;
            _getClassDetailQuery = getClassDetailQuery;
            _getClassCreateQuery = getClassCreateQuery;
            _getClassUpdateQuery = getClassUpdateQuery;
            _createClassCommand = createClassCommand;
            _updateClassCommand = updateClassCommand;
            _deleteClassCommand = deleteClassCommand;
        }

        [HttpGet("get-list")]
        public async Task<IActionResult> GetList([FromQuery] ClassFilter filter)
        {
            var result = await _getClassesListQuery.ExecuteAsync(filter);
            return Ok(ApiResponse<IEnumerable<ClassReadDto>>.SuccessResponse(result.Items, result.TotalCount));
        }

        [HttpGet("get-detail/{code}")]
        public async Task<IActionResult> GetDetail(string code)
        {
            var dto = await _getClassDetailQuery.ExecuteAsync(code);
            if (dto == null) return NotFound(ApiResponse<object>.Fail("Class not found", 404));
            return Ok(ApiResponse<ClassReadDto>.SuccessResponse(dto));
        }

        [HttpGet("get-create")]
        public IActionResult GetCreate()
        {
            var sample = _getClassCreateQuery.Execute();
            return Ok(ApiResponse<object>.SuccessResponse(sample));
        }

        [HttpPost("create")]
        public async Task<IActionResult> Create([FromBody] ClassCreateDto dto)
        {
            var result = await _createClassCommand.ExecuteAsync(dto);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return StatusCode(result.StatusCode, ApiResponse<ClassReadDto>.SuccessResponse(result.Data, 1, result.StatusCode));
        }

        [HttpGet("get-update/{id}")]
        public async Task<IActionResult> GetUpdate(int id)
        {
            var dto = await _getClassUpdateQuery.ExecuteAsync(id);
            if (dto == null) return NotFound(ApiResponse<object>.Fail("Class not found", 404));
            return Ok(ApiResponse<ClassUpdateDto>.SuccessResponse(dto));
        }

        [HttpPut("update/{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] ClassUpdateDto dto)
        {
            var result = await _updateClassCommand.ExecuteAsync(id, dto);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return Ok(ApiResponse<ClassReadDto>.SuccessResponse(result.Data));
        }

        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _deleteClassCommand.ExecuteAsync(id);
            if (!result.Success)
                return StatusCode(result.StatusCode, ApiResponse<object>.Fail(result.ErrorMessage ?? "Request failed", result.StatusCode));

            return Ok(ApiResponse<object>.SuccessResponse(null));
        }
    }
}
