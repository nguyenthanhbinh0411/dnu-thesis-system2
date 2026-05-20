using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using ThesisManagement.Api.Application.Query.SystemActivityLogs;
using ThesisManagement.Api.DTOs;
using ThesisManagement.Api.DTOs.SystemActivityLogs.Query;
using ThesisManagement.Api.Services;
using System.IO;
using OfficeOpenXml;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Colors = QuestPDF.Helpers.Colors;

namespace ThesisManagement.Api.Controllers
{
    /// <summary>
    /// API quản lý logs hoạt động hệ thống - Chỉ đọc (Read-only)
    /// </summary>
    public class SystemActivityLogsController : BaseApiController
    {
        private readonly IGetSystemActivityLogsListQuery _getSystemActivityLogsListQuery;
        private readonly IGetSystemActivityLogDetailQuery _getSystemActivityLogDetailQuery;
        private readonly IGetSystemActivityLogsByEntityQuery _getSystemActivityLogsByEntityQuery;
        private readonly IGetSystemActivityLogsByUserQuery _getSystemActivityLogsByUserQuery;
        private readonly IGetSystemActivityLogsByModuleQuery _getSystemActivityLogsByModuleQuery;
        private readonly IGetSystemActivityLogStatsQuery _getSystemActivityLogStatsQuery;

        public SystemActivityLogsController(
            IUnitOfWork uow,
            ICodeGenerator codeGen,
            IMapper mapper,
            IGetSystemActivityLogsListQuery getSystemActivityLogsListQuery,
            IGetSystemActivityLogDetailQuery getSystemActivityLogDetailQuery,
            IGetSystemActivityLogsByEntityQuery getSystemActivityLogsByEntityQuery,
            IGetSystemActivityLogsByUserQuery getSystemActivityLogsByUserQuery,
            IGetSystemActivityLogsByModuleQuery getSystemActivityLogsByModuleQuery,
            IGetSystemActivityLogStatsQuery getSystemActivityLogStatsQuery)
            : base(uow, codeGen, mapper)
        {
            _getSystemActivityLogsListQuery = getSystemActivityLogsListQuery;
            _getSystemActivityLogDetailQuery = getSystemActivityLogDetailQuery;
            _getSystemActivityLogsByEntityQuery = getSystemActivityLogsByEntityQuery;
            _getSystemActivityLogsByUserQuery = getSystemActivityLogsByUserQuery;
            _getSystemActivityLogsByModuleQuery = getSystemActivityLogsByModuleQuery;
            _getSystemActivityLogStatsQuery = getSystemActivityLogStatsQuery;
        }

        /// <summary>
        /// Lấy danh sách activity logs với filter và phân trang
        /// </summary>
        /// <param name="filter">Bộ lọc: EntityName, ActionType, UserCode, Module, Status, PerformedFrom/To...</param>
        /// <returns>Danh sách logs</returns>
        [HttpGet("get-list")]
        public async Task<IActionResult> GetList([FromQuery] SystemActivityLogFilter filter)
        {
            var result = await _getSystemActivityLogsListQuery.ExecuteAsync(filter);
            return Ok(ApiResponse<IEnumerable<SystemActivityLogReadDto>>.SuccessResponse(result.Items, result.TotalCount));
        }

        /// <summary>
        /// Lấy chi tiết một activity log theo ID
        /// </summary>
        /// <param name="id">LogID</param>
        /// <returns>Chi tiết log</returns>
        [HttpGet("get-detail/{id}")]
        public async Task<IActionResult> GetDetail(int id)
        {
            var dto = await _getSystemActivityLogDetailQuery.ExecuteAsync(id);
            if (dto == null)
                return NotFound(ApiResponse<object>.Fail("Activity log not found", 404));

            return Ok(ApiResponse<SystemActivityLogReadDto>.SuccessResponse(dto));
        }

        /// <summary>
        /// Lấy logs của một entity cụ thể
        /// </summary>
        /// <param name="entityName">Tên entity (VD: "Topic", "StudentProfile")</param>
        /// <param name="entityId">ID hoặc Code của entity</param>
        /// <param name="filter">Bộ lọc bổ sung</param>
        /// <returns>Danh sách logs của entity</returns>
        [HttpGet("by-entity")]
        public async Task<IActionResult> GetByEntity(
            [FromQuery] string entityName, 
            [FromQuery] string entityId,
            [FromQuery] SystemActivityLogFilter filter)
        {
            var result = await _getSystemActivityLogsByEntityQuery.ExecuteAsync(entityName, entityId, filter);
            return Ok(ApiResponse<IEnumerable<SystemActivityLogReadDto>>.SuccessResponse(result.Items, result.TotalCount));
        }

        /// <summary>
        /// Lấy logs của một user cụ thể
        /// </summary>
        /// <param name="userCode">Mã người dùng</param>
        /// <param name="filter">Bộ lọc bổ sung</param>
        /// <returns>Danh sách logs của user</returns>
        [HttpGet("by-user/{userCode}")]
        public async Task<IActionResult> GetByUser(
            string userCode,
            [FromQuery] SystemActivityLogFilter filter)
        {
            var result = await _getSystemActivityLogsByUserQuery.ExecuteAsync(userCode, filter);
            return Ok(ApiResponse<IEnumerable<SystemActivityLogReadDto>>.SuccessResponse(result.Items, result.TotalCount));
        }

        /// <summary>
        /// Lấy logs theo module/phân hệ
        /// </summary>
        /// <param name="module">Module: Topic, Milestone, Defense, Committee...</param>
        /// <param name="filter">Bộ lọc bổ sung</param>
        /// <returns>Danh sách logs theo module</returns>
        [HttpGet("by-module/{module}")]
        public async Task<IActionResult> GetByModule(
            string module,
            [FromQuery] SystemActivityLogFilter filter)
        {
            var result = await _getSystemActivityLogsByModuleQuery.ExecuteAsync(module, filter);
            return Ok(ApiResponse<IEnumerable<SystemActivityLogReadDto>>.SuccessResponse(result.Items, result.TotalCount));
        }

        /// <summary>
        /// Thống kê số lượng logs theo ActionType
        /// </summary>
        /// <param name="from">Từ ngày (optional)</param>
        /// <param name="to">Đến ngày (optional)</param>
        /// <returns>Thống kê số lượng theo từng loại action</returns>
        [HttpGet("stats/by-action-type")]
        public async Task<IActionResult> GetStatsByActionType(
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to)
        {
            var stats = await _getSystemActivityLogStatsQuery.GetByActionTypeAsync(from, to);
            return Ok(ApiResponse<object>.SuccessResponse(stats, stats.Count));
        }

        /// <summary>
        /// Thống kê số lượng logs theo Module
        /// </summary>
        /// <param name="from">Từ ngày (optional)</param>
        /// <param name="to">Đến ngày (optional)</param>
        /// <returns>Thống kê số lượng theo từng module</returns>
        [HttpGet("stats/by-module")]
        public async Task<IActionResult> GetStatsByModule(
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to)
        {
            var stats = await _getSystemActivityLogStatsQuery.GetByModuleAsync(from, to);
            return Ok(ApiResponse<object>.SuccessResponse(stats, stats.Count));
        }

        /// <summary>
        /// Xuất file PDF hoặc XLSX nhật ký hoạt động hệ thống
        /// </summary>
        [HttpGet("export")]
        public async Task<IActionResult> Export([FromQuery] SystemActivityLogFilter filter, [FromQuery] string format = "xlsx")
        {
            filter.Page = 1;
            filter.PageSize = 100000; // Lấy toàn bộ logs khớp filter
            var result = await _getSystemActivityLogsListQuery.ExecuteAsync(filter);
            var logs = result.Items.ToList();

            if (string.Equals(format, "pdf", StringComparison.OrdinalIgnoreCase))
            {
                var pdfBytes = GeneratePdfReport(logs);
                var fileName = $"system-activity-logs-{DateTime.Now:yyyyMMddHHmmss}.pdf";
                return File(pdfBytes, "application/pdf", fileName);
            }
            else if (string.Equals(format, "csv", StringComparison.OrdinalIgnoreCase))
            {
                var csvBytes = GenerateCsvReport(logs);
                var fileName = $"system-activity-logs-{DateTime.Now:yyyyMMddHHmmss}.csv";
                return File(csvBytes, "text/csv; charset=utf-8", fileName);
            }
            else
            {
                var excelBytes = GenerateExcelReport(logs);
                var fileName = $"system-activity-logs-{DateTime.Now:yyyyMMddHHmmss}.xlsx";
                return File(excelBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
            }
        }

        /// <summary>
        /// Xuất file PDF, XLSX hoặc CSV nhật ký hoạt động hệ thống (POST)
        /// </summary>
        [HttpPost("export")]
        public async Task<IActionResult> ExportPost([FromBody] SystemActivityLogExportRequest request)
        {
            var filter = request.Filters ?? new SystemActivityLogFilter();
            filter.Page = 1;
            filter.PageSize = 100000; // Lấy toàn bộ logs khớp filter
            var result = await _getSystemActivityLogsListQuery.ExecuteAsync(filter);
            var logs = result.Items.ToList();

            var format = request.Format ?? "xlsx";
            if (string.Equals(format, "pdf", StringComparison.OrdinalIgnoreCase))
            {
                var pdfBytes = GeneratePdfReport(logs);
                var fileName = $"system-activity-logs-{DateTime.Now:yyyyMMddHHmmss}.pdf";
                return File(pdfBytes, "application/pdf", fileName);
            }
            else if (string.Equals(format, "csv", StringComparison.OrdinalIgnoreCase))
            {
                var csvBytes = GenerateCsvReport(logs);
                var fileName = $"system-activity-logs-{DateTime.Now:yyyyMMddHHmmss}.csv";
                return File(csvBytes, "text/csv; charset=utf-8", fileName);
            }
            else
            {
                var excelBytes = GenerateExcelReport(logs);
                var fileName = $"system-activity-logs-{DateTime.Now:yyyyMMddHHmmss}.xlsx";
                return File(excelBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
            }
        }

        private byte[] GenerateExcelReport(List<SystemActivityLogReadDto> logs)
        {
            ExcelPackage.License.SetNonCommercialPersonal("ThesisManagement.Api");
            using var package = new ExcelPackage();
            var sheet = package.Workbook.Worksheets.Add("Lịch sử Hoạt động");

            // Title block
            sheet.Cells["A1:G1"].Merge = true;
            sheet.Cells["A1"].Value = "NHẬT KÝ HOẠT ĐỘNG HỆ THỐNG";
            sheet.Cells["A1"].Style.Font.Size = 16;
            sheet.Cells["A1"].Style.Font.Bold = true;
            sheet.Cells["A1"].Style.Font.Color.SetColor(System.Drawing.Color.White);
            sheet.Cells["A1"].Style.Fill.PatternType = OfficeOpenXml.Style.ExcelFillStyle.Solid;
            sheet.Cells["A1"].Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.FromArgb(15, 23, 42)); // Slate 900
            sheet.Cells["A1"].Style.HorizontalAlignment = OfficeOpenXml.Style.ExcelHorizontalAlignment.Center;
            sheet.Cells["A1"].Style.VerticalAlignment = OfficeOpenXml.Style.ExcelVerticalAlignment.Center;
            sheet.Row(1).Height = 40;

            sheet.Cells["A2:G2"].Merge = true;
            sheet.Cells["A2"].Value = $"Thời gian trích xuất: {DateTime.Now:dd/MM/yyyy HH:mm:ss}";
            sheet.Cells["A2"].Style.Font.Italic = true;
            sheet.Cells["A2"].Style.HorizontalAlignment = OfficeOpenXml.Style.ExcelHorizontalAlignment.Center;
            sheet.Row(2).Height = 20;

            // Headers
            var headers = new[] { "Thời gian", "Tài khoản (Vai trò)", "Phân hệ", "Hành động", "Mô tả chi tiết", "Trạng thái", "IP / Thiết bị" };
            sheet.Row(4).Height = 25;
            for (int i = 0; i < headers.Length; i++)
            {
                var cell = sheet.Cells[4, i + 1];
                cell.Value = headers[i];
                cell.Style.Font.Bold = true;
                cell.Style.Fill.PatternType = OfficeOpenXml.Style.ExcelFillStyle.Solid;
                cell.Style.Fill.BackgroundColor.SetColor(System.Drawing.Color.FromArgb(30, 41, 59)); // Slate 800
                cell.Style.Font.Color.SetColor(System.Drawing.Color.White);
                cell.Style.HorizontalAlignment = OfficeOpenXml.Style.ExcelHorizontalAlignment.Center;
                cell.Style.VerticalAlignment = OfficeOpenXml.Style.ExcelVerticalAlignment.Center;
            }

            // Data rows
            int rowIdx = 5;
            foreach (var log in logs)
            {
                sheet.Cells[rowIdx, 1].Value = log.PerformedAt.ToString("dd/MM/yyyy HH:mm:ss");
                sheet.Cells[rowIdx, 2].Value = $"{log.UserCode} ({log.UserRole})";
                sheet.Cells[rowIdx, 3].Value = log.Module;
                sheet.Cells[rowIdx, 4].Value = log.ActionType;
                sheet.Cells[rowIdx, 5].Value = log.ActionDescription;
                sheet.Cells[rowIdx, 6].Value = string.Equals(log.Status, "SUCCESS", StringComparison.OrdinalIgnoreCase) ? "Thành công" : "Lỗi";
                sheet.Cells[rowIdx, 7].Value = $"{log.IPAddress} / {log.DeviceInfo}";

                // Alignments
                sheet.Cells[rowIdx, 1].Style.HorizontalAlignment = OfficeOpenXml.Style.ExcelHorizontalAlignment.Center;
                sheet.Cells[rowIdx, 3].Style.HorizontalAlignment = OfficeOpenXml.Style.ExcelHorizontalAlignment.Center;
                sheet.Cells[rowIdx, 4].Style.HorizontalAlignment = OfficeOpenXml.Style.ExcelHorizontalAlignment.Center;
                sheet.Cells[rowIdx, 6].Style.HorizontalAlignment = OfficeOpenXml.Style.ExcelHorizontalAlignment.Center;

                // Colors for Status
                if (string.Equals(log.Status, "SUCCESS", StringComparison.OrdinalIgnoreCase))
                {
                    sheet.Cells[rowIdx, 6].Style.Font.Color.SetColor(System.Drawing.Color.FromArgb(22, 163, 74)); // Green 600
                }
                else
                {
                    sheet.Cells[rowIdx, 6].Style.Font.Color.SetColor(System.Drawing.Color.FromArgb(220, 38, 38)); // Red 600
                }

                // Apply borders
                for (int col = 1; col <= 7; col++)
                {
                    sheet.Cells[rowIdx, col].Style.Border.Bottom.Style = OfficeOpenXml.Style.ExcelBorderStyle.Thin;
                    sheet.Cells[rowIdx, col].Style.Border.Bottom.Color.SetColor(System.Drawing.Color.FromArgb(226, 232, 240)); // Slate 200
                }
                
                rowIdx++;
            }

            sheet.Cells[1, 1, rowIdx - 1, 7].AutoFitColumns();
            return package.GetAsByteArray();
        }

        private byte[] GeneratePdfReport(List<SystemActivityLogReadDto> logs)
        {
            return Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Margin(20);
                    page.Size(PageSizes.A4.Landscape());
                    page.DefaultTextStyle(x => x.FontSize(9).FontFamily("Times New Roman"));

                    page.Header().Column(column =>
                    {
                        column.Spacing(2);
                        column.Item().Row(row =>
                        {
                            row.RelativeItem().Column(left =>
                            {
                                left.Item().Text("TRƯỜNG ĐẠI HỌC ĐẠI NAM").Bold().FontSize(10);
                                left.Item().Text("KHOA CÔNG NGHỆ THÔNG TIN").Bold().FontSize(10);
                            });

                            row.RelativeItem().AlignRight().Column(right =>
                            {
                                right.Item().AlignCenter().Text("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM").Bold().FontSize(10);
                                right.Item().AlignCenter().Text("Độc lập - Tự do - Hạnh phúc").Bold().FontSize(10);
                                right.Item().AlignCenter().PaddingTop(2).Width(80).LineHorizontal(1).LineColor(Colors.Black);
                            });
                        });

                        column.Item().PaddingTop(15).AlignCenter().Text("NHẬT KÝ HOẠT ĐỘNG HỆ THỐNG").Bold().FontSize(14);
                        column.Item().AlignCenter().Text($"Thời gian trích xuất: {DateTime.Now:dd/MM/yyyy HH:mm:ss}").Italic().FontSize(9);
                    });

                    page.Content().PaddingTop(15).Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.ConstantColumn(110); // Thời gian
                            columns.ConstantColumn(120); // Tài khoản
                            columns.ConstantColumn(70);  // Phân hệ
                            columns.ConstantColumn(70);  // Hành động
                            columns.RelativeColumn();    // Mô tả chi tiết
                            columns.ConstantColumn(70);  // Trạng thái
                            columns.ConstantColumn(140); // IP/Thiết bị
                        });

                        table.Header(header =>
                        {
                            header.Cell().Element(PdfHeaderStyle).Text("Thời gian");
                            header.Cell().Element(PdfHeaderStyle).Text("Tài khoản");
                            header.Cell().Element(PdfHeaderStyle).Text("Phân hệ");
                            header.Cell().Element(PdfHeaderStyle).Text("Hành động");
                            header.Cell().Element(PdfHeaderStyle).Text("Mô tả chi tiết");
                            header.Cell().Element(PdfHeaderStyle).Text("Trạng thái");
                            header.Cell().Element(PdfHeaderStyle).Text("IP / Thiết bị");
                        });

                        foreach (var log in logs)
                        {
                            table.Cell().Element(PdfCellStyle).AlignCenter().Text(log.PerformedAt.ToString("dd/MM/yyyy HH:mm:ss"));
                            table.Cell().Element(PdfCellStyle).Text($"{log.UserCode}\n({log.UserRole})");
                            table.Cell().Element(PdfCellStyle).AlignCenter().Text(log.Module ?? "-");
                            table.Cell().Element(PdfCellStyle).AlignCenter().Text(log.ActionType ?? "-");
                            table.Cell().Element(PdfCellStyle).Text(log.ActionDescription ?? "-");
                            
                            var isSuccess = string.Equals(log.Status, "SUCCESS", StringComparison.OrdinalIgnoreCase);
                            table.Cell().Element(PdfCellStyle).AlignCenter()
                                 .Text(isSuccess ? "Thành công" : "Lỗi")
                                 .FontColor(isSuccess ? Colors.Green.Medium : Colors.Red.Medium)
                                 .Bold();

                            table.Cell().Element(PdfCellStyle).Text($"{log.IPAddress ?? "-"}\n{log.DeviceInfo ?? "-"}");
                        }
                    });

                    page.Footer().AlignCenter().Text(x =>
                    {
                        x.Span("Trang ");
                        x.CurrentPageNumber();
                    });
                });
            }).GeneratePdf();
        }

        private static IContainer PdfHeaderStyle(IContainer container)
        {
            return container
                .Background(Colors.Grey.Lighten3)
                .Border(0.5f)
                .BorderColor(Colors.Grey.Lighten1)
                .DefaultTextStyle(x => x.Bold())
                .Padding(6)
                .AlignCenter();
        }

        private static IContainer PdfCellStyle(IContainer container)
        {
            return container
                .BorderBottom(0.5f)
                .BorderColor(Colors.Grey.Lighten2)
                .Padding(6)
                .AlignLeft();
        }

        private byte[] GenerateCsvReport(List<SystemActivityLogReadDto> logs)
        {
            using var ms = new MemoryStream();
            // Write UTF-8 BOM so Excel opens it with correct encoding
            ms.Write(new byte[] { 0xEF, 0xBB, 0xBF }, 0, 3);
            
            using (var writer = new StreamWriter(ms, new System.Text.UTF8Encoding(true)))
            {
                writer.WriteLine("Thời gian,Tài khoản,Vai trò,Phân hệ,Hành động,Mô tả chi tiết,Trạng thái,IP Address,Thiết bị");

                foreach (var log in logs)
                {
                    var performedAt = log.PerformedAt.ToString("dd/MM/yyyy HH:mm:ss");
                    var userCode = EscapeCsv(log.UserCode);
                    var userRole = EscapeCsv(log.UserRole);
                    var module = EscapeCsv(log.Module);
                    var actionType = EscapeCsv(log.ActionType);
                    var actionDescription = EscapeCsv(log.ActionDescription);
                    var status = string.Equals(log.Status, "SUCCESS", StringComparison.OrdinalIgnoreCase) ? "Thành công" : "Lỗi";
                    var ip = EscapeCsv(log.IPAddress);
                    var device = EscapeCsv(log.DeviceInfo);

                    writer.WriteLine($"{performedAt},{userCode},{userRole},{module},{actionType},{actionDescription},{status},{ip},{device}");
                }
            }
            return ms.ToArray();
        }

        private static string EscapeCsv(string? value)
        {
            if (value == null) return string.Empty;
            if (value.Contains(",") || value.Contains("\"") || value.Contains("\n") || value.Contains("\r"))
            {
                return $"\"{value.Replace("\"", "\"\"")}\"";
            }
            return value;
        }
    }

    /// <summary>
    /// Request model for exporting system activity logs
    /// </summary>
    public class SystemActivityLogExportRequest
    {
        public System.Collections.Generic.List<string>? Fields { get; set; }
        public string? Format { get; set; }
        public SystemActivityLogFilter? Filters { get; set; }
    }
}
