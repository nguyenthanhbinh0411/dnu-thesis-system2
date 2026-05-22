using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ThesisManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMilestoneFailureTracking : Migration
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

            migrationBuilder.AddColumn<DateTime>(
                name: "FAILEDAT",
                table: "PROGRESSMILESTONES",
                type: "TIMESTAMP(7)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FAILUREREASON",
                table: "PROGRESSMILESTONES",
                type: "NVARCHAR2(2000)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FAILEDAT",
                table: "PROGRESSMILESTONES");

            migrationBuilder.DropColumn(
                name: "FAILUREREASON",
                table: "PROGRESSMILESTONES");

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
