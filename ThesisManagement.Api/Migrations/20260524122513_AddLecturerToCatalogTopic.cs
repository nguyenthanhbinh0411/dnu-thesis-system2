using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ThesisManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLecturerToCatalogTopic : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "GPA",
                table: "STUDENTPROFILES",
                type: "DECIMAL(18, 2)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "DECIMAL(18,2)",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LECTURERCODE",
                table: "CATALOGTOPICS",
                type: "VARCHAR2(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LECTURERNAME",
                table: "CATALOGTOPICS",
                type: "NVARCHAR2(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_CATALOGTOPICS_LECTURERCODE",
                table: "CATALOGTOPICS",
                column: "LECTURERCODE");

            migrationBuilder.AddForeignKey(
                name: "FK_CATALOGTOPICS_LECTURERPROFILES_LECTURERCODE",
                table: "CATALOGTOPICS",
                column: "LECTURERCODE",
                principalTable: "LECTURERPROFILES",
                principalColumn: "LECTURERCODE",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CATALOGTOPICS_LECTURERPROFILES_LECTURERCODE",
                table: "CATALOGTOPICS");

            migrationBuilder.DropIndex(
                name: "IX_CATALOGTOPICS_LECTURERCODE",
                table: "CATALOGTOPICS");

            migrationBuilder.DropColumn(
                name: "LECTURERCODE",
                table: "CATALOGTOPICS");

            migrationBuilder.DropColumn(
                name: "LECTURERNAME",
                table: "CATALOGTOPICS");

            migrationBuilder.AlterColumn<decimal>(
                name: "GPA",
                table: "STUDENTPROFILES",
                type: "DECIMAL(18,2)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "DECIMAL(18, 2)",
                oldNullable: true);
        }
    }
}
