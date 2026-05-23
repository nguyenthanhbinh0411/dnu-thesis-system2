using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ThesisManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDefenseTermIdToRequestsAndFiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DEFENSETERMID",
                table: "TOPIC_RENAME_REQUESTS",
                type: "NUMBER(10)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DEFENSETERMID",
                table: "SUBMISSIONFILES",
                type: "NUMBER(10)",
                nullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "GPA",
                table: "STUDENTPROFILES",
                type: "DECIMAL(18, 2)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "DECIMAL(18,2)",
                oldNullable: true);

            migrationBuilder.AlterColumn<bool>(
                name: "ALLOWLATESUBMIT",
                table: "PROGRESSMILESTONES",
                type: "NUMBER(1)",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "BOOLEAN");

            migrationBuilder.CreateIndex(
                name: "IX_TOPIC_RENAME_REQUESTS_DEFENSETERMID",
                table: "TOPIC_RENAME_REQUESTS",
                column: "DEFENSETERMID");

            migrationBuilder.CreateIndex(
                name: "IX_SUBMISSIONFILES_DEFENSETERMID",
                table: "SUBMISSIONFILES",
                column: "DEFENSETERMID");

            migrationBuilder.AddForeignKey(
                name: "FK_SUBMISSIONFILES_DEFENSETERMS_DEFENSETERMID",
                table: "SUBMISSIONFILES",
                column: "DEFENSETERMID",
                principalTable: "DEFENSETERMS",
                principalColumn: "DEFENSETERMID");

            migrationBuilder.AddForeignKey(
                name: "FK_TOPIC_RENAME_REQUESTS_DEFENSETERMS_DEFENSETERMID",
                table: "TOPIC_RENAME_REQUESTS",
                column: "DEFENSETERMID",
                principalTable: "DEFENSETERMS",
                principalColumn: "DEFENSETERMID");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SUBMISSIONFILES_DEFENSETERMS_DEFENSETERMID",
                table: "SUBMISSIONFILES");

            migrationBuilder.DropForeignKey(
                name: "FK_TOPIC_RENAME_REQUESTS_DEFENSETERMS_DEFENSETERMID",
                table: "TOPIC_RENAME_REQUESTS");

            migrationBuilder.DropIndex(
                name: "IX_TOPIC_RENAME_REQUESTS_DEFENSETERMID",
                table: "TOPIC_RENAME_REQUESTS");

            migrationBuilder.DropIndex(
                name: "IX_SUBMISSIONFILES_DEFENSETERMID",
                table: "SUBMISSIONFILES");

            migrationBuilder.DropColumn(
                name: "DEFENSETERMID",
                table: "TOPIC_RENAME_REQUESTS");

            migrationBuilder.DropColumn(
                name: "DEFENSETERMID",
                table: "SUBMISSIONFILES");

            migrationBuilder.AlterColumn<decimal>(
                name: "GPA",
                table: "STUDENTPROFILES",
                type: "DECIMAL(18,2)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "DECIMAL(18, 2)",
                oldNullable: true);

            migrationBuilder.AlterColumn<bool>(
                name: "ALLOWLATESUBMIT",
                table: "PROGRESSMILESTONES",
                type: "BOOLEAN",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "NUMBER(1)");
        }
    }
}
