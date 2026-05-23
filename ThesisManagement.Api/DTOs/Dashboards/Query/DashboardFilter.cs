namespace ThesisManagement.Api.DTOs.Dashboards.Query
{
    public class LecturerDashboardFilter
    {
        public string? LecturerCode { get; set; }
        public int Limit { get; set; } = 100;
        public int? Days { get; set; } = 30;
        /// <summary>Lọc dashboard giảng viên theo đợt bảo vệ cụ thể.</summary>
        public int? DefenseTermId { get; set; }
    }

    public class StudentServiceDashboardFilter
    {
        public int Limit { get; set; } = 200;
        /// <summary>Lọc dashboard công tác sinh viên theo đợt bảo vệ cụ thể.</summary>
        public int? DefenseTermId { get; set; }
    }

    public class AdminDashboardFilter
    {
        public string? RoleName { get; set; }
        public string? LecturerCode { get; set; }
        public int Days { get; set; } = 30;
        public int Limit { get; set; } = 200;
        /// <summary>Lọc dashboard admin theo đợt bảo vệ cụ thể.</summary>
        public int? DefenseTermId { get; set; }
    }
}
