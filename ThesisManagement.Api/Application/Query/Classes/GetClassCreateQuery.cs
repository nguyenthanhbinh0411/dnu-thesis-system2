namespace ThesisManagement.Api.Application.Query.Classes
{
    public interface IGetClassCreateQuery
    {
        object Execute();
    }

    public class GetClassCreateQuery : IGetClassCreateQuery
    {
        public object Execute() => new 
        { 
            ClassCode = "", 
            ClassName = "", 
            DepartmentID = 0, 
            CohortCode = "", 
            EnrollmentYear = (int?)null, 
            Status = "Đang hoạt động" 
        };
    }
}
