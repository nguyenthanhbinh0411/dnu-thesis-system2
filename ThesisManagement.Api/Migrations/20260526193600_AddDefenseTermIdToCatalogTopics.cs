using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ThesisManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDefenseTermIdToCatalogTopics : Migration
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

            migrationBuilder.AddColumn<int>(
                name: "DEFENSETERMID",
                table: "CATALOGTOPICS",
                type: "NUMBER(10)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_CATALOGTOPICS_DEFENSETERMID",
                table: "CATALOGTOPICS",
                column: "DEFENSETERMID");

            migrationBuilder.AddForeignKey(
                name: "FK_CATALOGTOPICS_DEFENSETERMS_DEFENSETERMID",
                table: "CATALOGTOPICS",
                column: "DEFENSETERMID",
                principalTable: "DEFENSETERMS",
                principalColumn: "DEFENSETERMID",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CATALOGTOPICS_DEFENSETERMS_DEFENSETERMID",
                table: "CATALOGTOPICS");

            migrationBuilder.DropIndex(
                name: "IX_CATALOGTOPICS_DEFENSETERMID",
                table: "CATALOGTOPICS");

            migrationBuilder.DropColumn(
                name: "DEFENSETERMID",
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
