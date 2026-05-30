using System;
using Oracle.ManagedDataAccess.Client;

class Program
{
    static void Main()
    {
        string connStr = "User Id=thesis;Password=Thanhbinh12;Data Source=(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=LAPTOP-GA77N5KA)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=thesis)))";
        using var conn = new OracleConnection(connStr);
        try
        {
            conn.Open();
            Console.WriteLine("Connected to database successfully.");

            // 1. Query SYNCAUDITLOGS count
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT COUNT(*) FROM \"SYNCAUDITLOGS\"";
                var count = cmd.ExecuteScalar();
                Console.WriteLine($"SYNCAUDITLOGS count: {count}");
            }

            // 2. Query SYSTEMACTIVITYLOGS count
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT COUNT(*) FROM \"SYSTEMACTIVITYLOGS\"";
                var count = cmd.ExecuteScalar();
                Console.WriteLine($"SYSTEMACTIVITYLOGS count: {count}");
            }

            // 3. Print last 5 SYSTEMACTIVITYLOGS
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT \"LOGID\", \"ACTIONTYPE\", \"ACTIONDESCRIPTION\", \"MODULE\", \"PERFORMEDAT\" FROM \"SYSTEMACTIVITYLOGS\" ORDER BY \"PERFORMEDAT\" DESC FETCH FIRST 5 ROWS ONLY";
                using var reader = cmd.ExecuteReader();
                Console.WriteLine("\nLast 5 SYSTEMACTIVITYLOGS:");
                while (reader.Read())
                {
                    Console.WriteLine($"ID: {reader[0]}, ActionType: {reader[1]}, Module: {reader[3]}, Date: {reader[4]}\\nDescription: {reader[2]}\\n");
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("Error: " + ex.Message);
        }
    }
}
