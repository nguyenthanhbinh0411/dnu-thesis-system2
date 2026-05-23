using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using ThesisManagement.Api.DTOs;

namespace ThesisManagement.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class TemplatesController : ControllerBase
    {
        private readonly IWebHostEnvironment _environment;

        public TemplatesController(IWebHostEnvironment environment)
        {
            _environment = environment;
        }

        [HttpGet("list")]
        public IActionResult GetList()
        {
            try
            {
                var templatesFolder = Path.Combine(_environment.ContentRootPath, "Templates");
                if (!Directory.Exists(templatesFolder))
                {
                    return Ok(ApiResponse<IEnumerable<TemplateFileItem>>.SuccessResponse(Enumerable.Empty<TemplateFileItem>()));
                }

                // Retrieve docx and doc files, filter out temporary Word files (prefix with ~$)
                var files = Directory.GetFiles(templatesFolder, "*.docx")
                    .Concat(Directory.GetFiles(templatesFolder, "*.doc"))
                    .Select(filePath => new FileInfo(filePath))
                    .Where(fileInfo => !fileInfo.Name.StartsWith("~$"))
                    .Select(fileInfo => new TemplateFileItem(
                        fileInfo.Name,
                        fileInfo.Length,
                        fileInfo.LastWriteTimeUtc
                    ))
                    .OrderBy(f => f.FileName)
                    .ToList();

                return Ok(ApiResponse<IEnumerable<TemplateFileItem>>.SuccessResponse(files));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.Fail($"Lỗi khi lấy danh sách file template: {ex.Message}", 500));
            }
        }

        [HttpGet("download")]
        [HttpGet("download/{fileName}")]
        public IActionResult DownloadTemplate([FromQuery] string? fileName, [FromRoute] string? fileNameRoute)
        {
            var targetFileName = fileName ?? fileNameRoute;
            if (string.IsNullOrWhiteSpace(targetFileName))
            {
                return BadRequest(ApiResponse<object>.Fail("Tên file không hợp lệ.", 400));
            }

            // Path traversal prevention: Only extract the file name part
            var cleanFileName = Path.GetFileName(targetFileName);
            var templatesFolder = Path.Combine(_environment.ContentRootPath, "Templates");
            var filePath = Path.Combine(templatesFolder, cleanFileName);

            if (!System.IO.File.Exists(filePath))
            {
                return NotFound(ApiResponse<object>.Fail("Không tìm thấy file template.", 404));
            }

            var contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            if (cleanFileName.EndsWith(".doc", StringComparison.OrdinalIgnoreCase))
            {
                contentType = "application/msword";
            }

            var fileBytes = System.IO.File.ReadAllBytes(filePath);
            return File(fileBytes, contentType, cleanFileName);
        }
    }

    public record TemplateFileItem(string FileName, long SizeBytes, DateTime LastModified);
}
