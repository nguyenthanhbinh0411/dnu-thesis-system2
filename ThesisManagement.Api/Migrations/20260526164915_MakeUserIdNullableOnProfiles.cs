using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ThesisManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class MakeUserIdNullableOnProfiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DECLARE
    v_count NUMBER;
BEGIN
    -- Drop ForeignKey if exists
    FOR r IN (
        SELECT uc.constraint_name 
        FROM user_constraints uc
        JOIN user_cons_columns ucc ON uc.constraint_name = ucc.constraint_name
        WHERE uc.table_name = 'STUDENTPROFILES' 
          AND uc.constraint_type = 'R'
          AND ucc.column_name = 'USERID'
    ) LOOP
        EXECUTE IMMEDIATE 'ALTER TABLE ""STUDENTPROFILES"" DROP CONSTRAINT ""' || r.constraint_name || '""';
    END LOOP;

    -- Drop Index if exists
    SELECT COUNT(*) INTO v_count FROM user_indexes WHERE index_name = 'IX_STUDENTPROFILES_USERID';
    IF v_count > 0 THEN
        EXECUTE IMMEDIATE 'DROP INDEX ""IX_STUDENTPROFILES_USERID""';
    END IF;

    -- Clean up invalid USERID references (orphaned rows that don't exist in Users)
    EXECUTE IMMEDIATE 'UPDATE ""STUDENTPROFILES"" SET ""USERID"" = NULL WHERE ""USERID"" IS NOT NULL AND ""USERID"" NOT IN (SELECT ""USERID"" FROM ""Users"")';

    -- Clean up duplicate USERID values in STUDENTPROFILES (keep the first, set others to NULL)
    EXECUTE IMMEDIATE '
        MERGE INTO ""STUDENTPROFILES"" target
        USING (
            SELECT ROWID as rid,
                   ROW_NUMBER() OVER (PARTITION BY ""USERID"" ORDER BY ""STUDENTPROFILEID"") as rn
            FROM ""STUDENTPROFILES""
            WHERE ""USERID"" IS NOT NULL
        ) source
        ON (target.ROWID = source.rid AND source.rn > 1)
        WHEN MATCHED THEN
            UPDATE SET target.""USERID"" = NULL
    ';

    COMMIT;
END;
");

            migrationBuilder.AlterColumn<int>(
                name: "USERID",
                table: "STUDENTPROFILES",
                type: "NUMBER(10)",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "NUMBER(10)");

            migrationBuilder.AlterColumn<decimal>(
                name: "GPA",
                table: "STUDENTPROFILES",
                type: "DECIMAL(18, 2)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "DECIMAL(18,2)",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "USERID",
                table: "LECTURERPROFILES",
                type: "NUMBER(10)",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "NUMBER(10)");

            migrationBuilder.CreateIndex(
                name: "IX_STUDENTPROFILES_USERID",
                table: "STUDENTPROFILES",
                column: "USERID",
                unique: true,
                filter: "\"USERID\" IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_STUDENTPROFILES_Users_USERID",
                table: "STUDENTPROFILES",
                column: "USERID",
                principalTable: "Users",
                principalColumn: "USERID",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DECLARE
    v_count NUMBER;
BEGIN
    -- Drop ForeignKey if exists
    FOR r IN (
        SELECT uc.constraint_name 
        FROM user_constraints uc
        JOIN user_cons_columns ucc ON uc.constraint_name = ucc.constraint_name
        WHERE uc.table_name = 'STUDENTPROFILES' 
          AND uc.constraint_type = 'R'
          AND ucc.column_name = 'USERID'
    ) LOOP
        EXECUTE IMMEDIATE 'ALTER TABLE ""STUDENTPROFILES"" DROP CONSTRAINT ""' || r.constraint_name || '""';
    END LOOP;

    -- Drop Index if exists
    SELECT COUNT(*) INTO v_count FROM user_indexes WHERE index_name = 'IX_STUDENTPROFILES_USERID';
    IF v_count > 0 THEN
        EXECUTE IMMEDIATE 'DROP INDEX ""IX_STUDENTPROFILES_USERID""';
    END IF;
END;
");

            migrationBuilder.AlterColumn<int>(
                name: "USERID",
                table: "STUDENTPROFILES",
                type: "NUMBER(10)",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "NUMBER(10)",
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "GPA",
                table: "STUDENTPROFILES",
                type: "DECIMAL(18,2)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "DECIMAL(18, 2)",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "USERID",
                table: "LECTURERPROFILES",
                type: "NUMBER(10)",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "NUMBER(10)",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_STUDENTPROFILES_USERID",
                table: "STUDENTPROFILES",
                column: "USERID",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_STUDENTPROFILES_Users_USERID",
                table: "STUDENTPROFILES",
                column: "USERID",
                principalTable: "Users",
                principalColumn: "USERID",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
