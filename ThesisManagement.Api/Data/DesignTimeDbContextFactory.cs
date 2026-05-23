using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using ThesisManagement.Api.Data;

namespace ThesisManagement.Api.Data;

/// <summary>
/// Design-time factory for creating DbContext during migrations.
/// This allows 'dotnet ef' commands to work without a running application.
/// </summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();

        // Default connection string for migrations - can be overridden via environment
        var connectionString = Environment.GetEnvironmentVariable("DB_CONNECTION_STRING")
            ?? "User Id=dev;Password=Abcd@123;Data Source=localhost:1521/XEPDB1;";
        
        optionsBuilder.UseOracle(
            connectionString,
            b => b.UseOracleSQLCompatibility(OracleSQLCompatibility.DatabaseVersion19));

        return new ApplicationDbContext(optionsBuilder.Options);
    }
}
