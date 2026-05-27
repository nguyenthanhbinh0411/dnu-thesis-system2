using AutoMapper;
using Microsoft.EntityFrameworkCore;
using ThesisManagement.Api.Data;
using ThesisManagement.Api.DTOs.LecturerProfiles.Query;
using ThesisManagement.Api.Helpers;
using ThesisManagement.Api.Models;
using ThesisManagement.Api.Services;

namespace ThesisManagement.Api.Application.Query.LecturerProfiles
{
    public interface IGetLecturerProfilesListQuery
    {
        Task<(IEnumerable<LecturerProfileReadDto> Items, int TotalCount)> ExecuteAsync(LecturerProfileFilter filter);
    }

    public class GetLecturerProfilesListQuery : IGetLecturerProfilesListQuery
    {
        private readonly IUnitOfWork _uow;
        private readonly IMapper _mapper;
        private readonly ApplicationDbContext _db;

        public GetLecturerProfilesListQuery(IUnitOfWork uow, IMapper mapper, ApplicationDbContext db)
        {
            _uow = uow;
            _mapper = mapper;
            _db = db;
        }

        public async Task<(IEnumerable<LecturerProfileReadDto> Items, int TotalCount)> ExecuteAsync(LecturerProfileFilter filter)
        {
            bool useJunctionTable = false;
            if (filter.DefenseTermId.HasValue)
            {
                // Kiểm tra xem trong bảng DEFENSETERMLECTURERS có dữ liệu gán giảng viên cho đợt này không
                useJunctionTable = await _db.DefenseTermLecturers
                    .AnyAsync(dtl => dtl.DefenseTermId == filter.DefenseTermId.Value);
            }

            var tagCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (filter.TagCodes != null)
            {
                foreach (var code in filter.TagCodes)
                {
                    if (!string.IsNullOrWhiteSpace(code))
                    {
                        var values = code.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries);
                        foreach (var value in values)
                        {
                            var normalized = value.Trim();
                            if (!string.IsNullOrWhiteSpace(normalized))
                            {
                                tagCodes.Add(normalized);
                            }
                        }
                    }
                }
            }

            if (!string.IsNullOrEmpty(filter.Tags))
            {
                var tagValues = filter.Tags.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (var tag in tagValues)
                {
                    var value = tag.Trim();
                    if (!string.IsNullOrWhiteSpace(value))
                        tagCodes.Add(value);
                }
            }

            IEnumerable<LecturerProfile> items;
            int totalCount;

            if (tagCodes.Count > 0)
            {
                var normalizedTagCodes = tagCodes
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Select(x => x.Trim().ToUpperInvariant())
                    .ToHashSet();

                var filteredLecturers = await _uow.LecturerProfiles.Query()
                    .Where(lp => _uow.LecturerTags.Query()
                        .Any(lt =>
                            (lt.LecturerProfileID == lp.LecturerProfileID || lt.LecturerCode == lp.LecturerCode) &&
                            (
                                (lt.TagCode != null && normalizedTagCodes.Contains(lt.TagCode.ToUpper())) ||
                                (lt.Tag != null && lt.Tag.TagCode != null && normalizedTagCodes.Contains(lt.Tag.TagCode.ToUpper()))
                            )))
                    .ToListAsync();

                var tempFilter = new LecturerProfileFilter
                {
                    Page = filter.Page,
                    PageSize = filter.PageSize,
                    Search = filter.Search,
                    UserCode = filter.UserCode,
                    DepartmentCode = filter.DepartmentCode,
                    LecturerCode = filter.LecturerCode,
                    Degree = filter.Degree,
                    MinGuideQuota = filter.MinGuideQuota,
                    MaxGuideQuota = filter.MaxGuideQuota,
                    MinDefenseQuota = filter.MinDefenseQuota,
                    MaxDefenseQuota = filter.MaxDefenseQuota,
                    TagCodes = null,
                    Tags = null,
                    DefenseTermId = useJunctionTable ? null : filter.DefenseTermId, // Nếu bảng liên kết có dữ liệu thì bypass lọc tĩnh, ngược lại thì lọc tĩnh trên Profiles
                    FromDate = filter.FromDate,
                    ToDate = filter.ToDate,
                    SortBy = filter.SortBy
                };

                var lecturerIds = filteredLecturers.Select(fl => fl.LecturerProfileID).ToList();
                var result = await _uow.LecturerProfiles.GetPagedWithFilterAsync(filter.Page, filter.PageSize, tempFilter,
                    (query, f) => 
                    {
                        var filteredQuery = query.Where(lp => lecturerIds.Contains(lp.LecturerProfileID)).ApplyFilter(f);
                        if (filter.DefenseTermId.HasValue && useJunctionTable) // Chỉ lọc qua bảng liên kết nếu bảng liên kết có dữ liệu
                        {
                            var termLecturerProfileIds = _uow.DefenseTermLecturers.Query().AsNoTracking()
                                .Where(dtl => dtl.DefenseTermId == filter.DefenseTermId.Value)
                                .Select(dtl => dtl.LecturerProfileID);
                            
                            filteredQuery = filteredQuery.Where(lp => termLecturerProfileIds.Contains(lp.LecturerProfileID));
                        }
                        if (filter.ExcludeDefenseTermId.HasValue)
                        {
                             var excludedLecturerProfileIds = _uow.DefenseTermLecturers.Query().AsNoTracking()
                                .Where(dtl => dtl.DefenseTermId == filter.ExcludeDefenseTermId.Value)
                                .Select(dtl => dtl.LecturerProfileID);
                            
                            filteredQuery = filteredQuery.Where(lp => !excludedLecturerProfileIds.Contains(lp.LecturerProfileID));
                        }
                        return filteredQuery;
                    });

                items = result.Items;
                totalCount = result.TotalCount;
            }
            else
            {
                var tempFilter = new LecturerProfileFilter
                {
                    Page = filter.Page,
                    PageSize = filter.PageSize,
                    Search = filter.Search,
                    UserCode = filter.UserCode,
                    DepartmentCode = filter.DepartmentCode,
                    LecturerCode = filter.LecturerCode,
                    Degree = filter.Degree,
                    MinGuideQuota = filter.MinGuideQuota,
                    MaxGuideQuota = filter.MaxGuideQuota,
                    MinDefenseQuota = filter.MinDefenseQuota,
                    MaxDefenseQuota = filter.MaxDefenseQuota,
                    TagCodes = filter.TagCodes,
                    Tags = filter.Tags,
                    DefenseTermId = useJunctionTable ? null : filter.DefenseTermId, // Nếu bảng liên kết có dữ liệu thì bypass lọc tĩnh, ngược lại thì lọc tĩnh trên Profiles
                    FromDate = filter.FromDate,
                    ToDate = filter.ToDate,
                    SortBy = filter.SortBy
                };

                var result = await _uow.LecturerProfiles.GetPagedWithFilterAsync(filter.Page, filter.PageSize, tempFilter,
                    (query, f) =>
                    {
                        var filteredQuery = query.ApplyFilter(f);
                        if (filter.DefenseTermId.HasValue && useJunctionTable) // Chỉ lọc qua bảng liên kết nếu bảng liên kết có dữ liệu
                        {
                            var termLecturerProfileIds = _uow.DefenseTermLecturers.Query().AsNoTracking()
                                .Where(dtl => dtl.DefenseTermId == filter.DefenseTermId.Value)
                                .Select(dtl => dtl.LecturerProfileID);
                            
                            filteredQuery = filteredQuery.Where(lp => termLecturerProfileIds.Contains(lp.LecturerProfileID));
                        }
                        if (f.ExcludeDefenseTermId.HasValue)
                        {
                            var excludedLecturerProfileIds = _uow.DefenseTermLecturers.Query().AsNoTracking()
                                .Where(dtl => dtl.DefenseTermId == f.ExcludeDefenseTermId.Value)
                                .Select(dtl => dtl.LecturerProfileID);
                            
                            filteredQuery = filteredQuery.Where(lp => !excludedLecturerProfileIds.Contains(lp.LecturerProfileID));
                        }
                        return filteredQuery;
                    });

                items = result.Items;
                totalCount = result.TotalCount;
            }

            var itemList = items.ToList();
            var pageLecturerIds = itemList.Select(x => x.LecturerProfileID).Distinct().ToList();

            Dictionary<int, int> countMap;
            if (pageLecturerIds.Count == 0)
            {
                countMap = new Dictionary<int, int>();
            }
            else if (filter.DefenseTermId.HasValue)
            {
                // Đếm động số lượng đề tài thực tế đang gán hướng dẫn cho từng giảng viên trong cùng đợt lọc
                countMap = await _db.Topics
                    .Where(t => t.SupervisorLecturerProfileID.HasValue && 
                                pageLecturerIds.Contains(t.SupervisorLecturerProfileID.Value) &&
                                t.DefenseTermId == filter.DefenseTermId.Value)
                    .GroupBy(t => t.SupervisorLecturerProfileID!.Value)
                    .Select(g => new { LecturerProfileID = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.LecturerProfileID, x => x.Count);
            }
            else
            {
                // Nhánh dự phòng: Lấy từ CSDL View nếu không có bộ lọc đợt
                countMap = await _db.LecturerDashboardView
                    .Where(x => pageLecturerIds.Contains(x.LecturerProfileID))
                    .Select(x => new { x.LecturerProfileID, x.CurrentGuidingCount })
                    .ToDictionaryAsync(x => x.LecturerProfileID, x => x.CurrentGuidingCount);
            }

            var mappedItems = itemList
                .Select(x =>
                {
                    var dto = _mapper.Map<LecturerProfileReadDto>(x);
                    var count = countMap.TryGetValue(x.LecturerProfileID, out var viewCount)
                        ? viewCount
                        : 0;
                    return dto with { CurrentGuidingCount = count };
                })
                .ToList();

            return (mappedItems, totalCount);
        }
    }
}
