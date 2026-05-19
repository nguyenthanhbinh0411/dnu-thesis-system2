using System.Threading;
using System.Threading.Tasks;

namespace ThesisManagement.Api.Services
{
    public interface ISystemActivityLogger
    {
        Task WriteLogAsync(
            string? entityName,
            string? entityId,
            string actionType,
            string? actionDescription,
            int? actorUserId,
            string? module = null,
            string? status = "SUCCESS",
            string? relatedRecordCode = null,
            string? comment = null,
            string? oldValue = null,
            string? newValue = null,
            CancellationToken cancellationToken = default);
    }
}
