using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ThesisManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAllowLateSubmitToProgressMilestone : Migration
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
                name: "ALLOWLATESUBMIT",
                table: "PROGRESSMILESTONES",
                type: "NUMBER(1)",
                nullable: false,
                defaultValueSql: "0");

            migrationBuilder.AddColumn<DateTime>(
                name: "LATESUBMITGRANTEDAT",
                table: "PROGRESSMILESTONES",
                type: "TIMESTAMP(7)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LATESUBMITGRANTEDBY",
                table: "PROGRESSMILESTONES",
                type: "NVARCHAR2(2000)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ALLOWLATESUBMIT",
                table: "PROGRESSMILESTONES");

            migrationBuilder.DropColumn(
                name: "LATESUBMITGRANTEDAT",
                table: "PROGRESSMILESTONES");

            migrationBuilder.DropColumn(
                name: "LATESUBMITGRANTEDBY",
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
