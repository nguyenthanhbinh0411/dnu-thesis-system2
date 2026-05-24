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
            Console.WriteLine("Connected to database for cleanup.");

            using var cmd1 = conn.CreateCommand();
            cmd1.CommandText = "ALTER TABLE \"CATALOGTOPICS\" DROP COLUMN \"LECTURERCODE\"";
            try {
                cmd1.ExecuteNonQuery();
                Console.WriteLine("Dropped LECTURERCODE column.");
            } catch (Exception ex) {
                Console.WriteLine("LECTURERCODE drop failed/already dropped: " + ex.Message);
            }

            using var cmd2 = conn.CreateCommand();
            cmd2.CommandText = "ALTER TABLE \"CATALOGTOPICS\" DROP COLUMN \"LECTURERNAME\"";
            try {
                cmd2.ExecuteNonQuery();
                Console.WriteLine("Dropped LECTURERNAME column.");
            } catch (Exception ex) {
                Console.WriteLine("LECTURERNAME drop failed/already dropped: " + ex.Message);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("Error: " + ex.Message);
        }
    }
}
