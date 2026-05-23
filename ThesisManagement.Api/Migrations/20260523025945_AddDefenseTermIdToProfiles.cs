using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ThesisManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDefenseTermIdToProfiles : Migration
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
                table: "STUDENTPROFILES",
                type: "NUMBER(10)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DEFENSETERMID",
                table: "LECTURERPROFILES",
                type: "NUMBER(10)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_STUDENTPROFILES_DEFENSETERMID",
                table: "STUDENTPROFILES",
                column: "DEFENSETERMID");

            migrationBuilder.CreateIndex(
                name: "IX_LECTURERPROFILES_DEFENSETERMID",
                table: "LECTURERPROFILES",
                column: "DEFENSETERMID");

            migrationBuilder.AddForeignKey(
                name: "FK_LECTURERPROFILES_DEFENSETERMS_DEFENSETERMID",
                table: "LECTURERPROFILES",
                column: "DEFENSETERMID",
                principalTable: "DEFENSETERMS",
                principalColumn: "DEFENSETERMID",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_STUDENTPROFILES_DEFENSETERMS_DEFENSETERMID",
                table: "STUDENTPROFILES",
                column: "DEFENSETERMID",
                principalTable: "DEFENSETERMS",
                principalColumn: "DEFENSETERMID",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_LECTURERPROFILES_DEFENSETERMS_DEFENSETERMID",
                table: "LECTURERPROFILES");

            migrationBuilder.DropForeignKey(
                name: "FK_STUDENTPROFILES_DEFENSETERMS_DEFENSETERMID",
                table: "STUDENTPROFILES");

            migrationBuilder.DropIndex(
                name: "IX_STUDENTPROFILES_DEFENSETERMID",
                table: "STUDENTPROFILES");

            migrationBuilder.DropIndex(
                name: "IX_LECTURERPROFILES_DEFENSETERMID",
                table: "LECTURERPROFILES");

            migrationBuilder.DropColumn(
                name: "DEFENSETERMID",
                table: "STUDENTPROFILES");

            migrationBuilder.DropColumn(
                name: "DEFENSETERMID",
                table: "LECTURERPROFILES");

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
