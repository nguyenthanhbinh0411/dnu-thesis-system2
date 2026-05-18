using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.Data;
using ThesisManagement.Api.Models;

namespace ThesisManagement.Api.Helpers;

public static class DbSeeder
{
    public static async Task SeedAdminAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();

        var db = scope.ServiceProvider
            .GetRequiredService<ApplicationDbContext>();

        const string adminUserCode = "admin";

        // Seed only the specific admin account; other existing users should not block this.
        var existingAdmin = await db.Users
            .FirstOrDefaultAsync(u => u.UserCode == adminUserCode);

        if (existingAdmin != null)
        {
            if (existingAdmin.Role != "Admin")
            {
                existingAdmin.Role = "Admin";
                existingAdmin.LastUpdated = DateTime.UtcNow;
                await db.SaveChangesAsync();
                Console.WriteLine("[Seeder] Existing admin user updated to Admin.");
            }
            else
            {
                Console.WriteLine("[Seeder] Admin user already exists, skipping seed.");
            }

            return;
        }

        var admin = new User
        {
            UserCode = adminUserCode,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("12345"),
            Role = "Admin",
            CreatedAt = DateTime.UtcNow,
            LastUpdated = DateTime.UtcNow
        };

        db.Users.Add(admin);

        await db.SaveChangesAsync();

        Console.WriteLine("[Seeder] Admin user created successfully!");
        Console.WriteLine($"[Seeder] UserCode: {admin.UserCode}, Password: 12345");
    }
}
