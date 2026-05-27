using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;

namespace ThesisManagement.Api.Models
{
    public class Class
    {
        public int ClassID { get; set; }
        public string ClassCode { get; set; } = null!;
        public string ClassName { get; set; } = null!;
        public int DepartmentID { get; set; }
        public string? DepartmentCode { get; set; }
        public string? CohortCode { get; set; }

        [Column("COHORT_ID")]
        public int? CohortID { get; set; }

        [Column("COHORT_NAME")]
        public string? CohortName { get; set; }

        public int? EnrollmentYear { get; set; }
        public string? Status { get; set; }
        public DateTime? CreatedAt { get; set; }
        public DateTime? LastUpdated { get; set; }

        public Department? Department { get; set; }
        public ICollection<StudentProfile>? StudentProfiles { get; set; }
    }
}
