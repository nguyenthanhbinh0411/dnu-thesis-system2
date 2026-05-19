using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.Models;

namespace ThesisManagement.Api.Services.DefenseOperationsExport
{
    public interface IDefenseModularExportService
    {
        Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportStudentsAsync(
            int periodId,
            string format,
            List<string>? fields = null,
            CancellationToken cancellationToken = default);

        Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportLecturersAsync(
            int periodId,
            string format,
            List<string>? fields = null,
            CancellationToken cancellationToken = default);

        Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportAssignedTopicsAsync(
            int periodId,
            string format,
            List<string>? fields = null,
            CancellationToken cancellationToken = default);

        Task<ApiResponse<(byte[] Content, string FileName, string ContentType)>> ExportGroupedLecturerReportAsync(
            int periodId,
            string format,
            List<string>? fields = null,
            CancellationToken cancellationToken = default);
    }
}
