using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Moq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using ThesisManagement.Api.Controllers;
using ThesisManagement.Api.DTOs;
using Xunit;

namespace ThesisManagement.Api.Tests
{
    public class TemplatesControllerTests
    {
        private readonly Mock<IWebHostEnvironment> _mockEnvironment;
        private readonly string _tempTemplatesPath;

        public TemplatesControllerTests()
        {
            _mockEnvironment = new Mock<IWebHostEnvironment>();
            
            // Create a temporary directory for Templates testing
            _tempTemplatesPath = Path.Combine(Path.GetTempPath(), Path.GetRandomFileName(), "Templates");
            Directory.CreateDirectory(_tempTemplatesPath);
            
            _mockEnvironment.Setup(m => m.ContentRootPath).Returns(Path.GetDirectoryName(_tempTemplatesPath)!);
        }

        [Fact]
        public void GetList_ShouldReturnWordFiles_ExcludingTemporaryFiles()
        {
            // Arrange
            File.WriteAllText(Path.Combine(_tempTemplatesPath, "BienBanHop.docx"), "dummy content");
            File.WriteAllText(Path.Combine(_tempTemplatesPath, "MauDeCuong.doc"), "dummy content");
            File.WriteAllText(Path.Combine(_tempTemplatesPath, "~$LockFile.docx"), "dummy content");
            File.WriteAllText(Path.Combine(_tempTemplatesPath, "readme.txt"), "dummy text file");

            var controller = new TemplatesController(_mockEnvironment.Object);

            // Act
            var result = controller.GetList();

            // Assert
            var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
            var apiResponse = okResult.Value.Should().BeOfType<ApiResponse<IEnumerable<TemplateFileItem>>>().Subject;
            
            apiResponse.Success.Should().BeTrue();
            apiResponse.Data.Should().NotBeNull();
            
            var files = apiResponse.Data!.ToList();
            files.Should().HaveCount(2);
            files.Select(f => f.FileName).Should().Contain("BienBanHop.docx");
            files.Select(f => f.FileName).Should().Contain("MauDeCuong.doc");
            files.Select(f => f.FileName).Should().NotContain("~$LockFile.docx");
            files.Select(f => f.FileName).Should().NotContain("readme.txt");

            // Clean up
            Directory.Delete(Path.GetDirectoryName(_tempTemplatesPath)!, true);
        }

        [Fact]
        public void DownloadTemplate_ShouldReturnFile_WhenExists()
        {
            // Arrange
            var fileName = "TestTemplate.docx";
            var fileContent = "hello world";
            var filePath = Path.Combine(_tempTemplatesPath, fileName);
            File.WriteAllText(filePath, fileContent);

            var controller = new TemplatesController(_mockEnvironment.Object);

            // Act
            var result = controller.DownloadTemplate(fileName, null);

            // Assert
            var fileResult = result.Should().BeOfType<FileContentResult>().Subject;
            fileResult.FileDownloadName.Should().Be(fileName);
            fileResult.ContentType.Should().Be("application/vnd.openxmlformats-officedocument.wordprocessingml.document");

            // Clean up
            Directory.Delete(Path.GetDirectoryName(_tempTemplatesPath)!, true);
        }

        [Fact]
        public void DownloadTemplate_ShouldReturnNotFound_WhenFileDoesNotExist()
        {
            // Arrange
            var controller = new TemplatesController(_mockEnvironment.Object);

            // Act
            var result = controller.DownloadTemplate("NonExistent.docx", null);

            // Assert
            var notFoundResult = result.Should().BeOfType<NotFoundObjectResult>().Subject;
            var apiResponse = notFoundResult.Value.Should().BeOfType<ApiResponse<object>>().Subject;
            apiResponse.Success.Should().BeFalse();
            apiResponse.HttpStatusCode.Should().Be(404);

            // Clean up
            Directory.Delete(Path.GetDirectoryName(_tempTemplatesPath)!, true);
        }
    }
}
