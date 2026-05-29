using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ThesisManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDefenseTermIdToMilestoneTemplate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DEFENSETERMID",
                table: "MILESTONETEMPLATES",
                type: "NUMBER(10)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_MILESTONETEMPLATES_DEFENSETERMID",
                table: "MILESTONETEMPLATES",
                column: "DEFENSETERMID");

            migrationBuilder.AddForeignKey(
                name: "FK_MILESTONETEMPLATES_DEFENSETERMS_DEFENSETERMID",
                table: "MILESTONETEMPLATES",
                column: "DEFENSETERMID",
                principalTable: "DEFENSETERMS",
                principalColumn: "DEFENSETERMID",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MILESTONETEMPLATES_DEFENSETERMS_DEFENSETERMID",
                table: "MILESTONETEMPLATES");

            migrationBuilder.DropIndex(
                name: "IX_MILESTONETEMPLATES_DEFENSETERMID",
                table: "MILESTONETEMPLATES");

            migrationBuilder.DropColumn(
                name: "DEFENSETERMID",
                table: "MILESTONETEMPLATES");
        }
    }
}
