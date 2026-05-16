import { fetchData } from "../api/fetchData";
import { API_BASE_PATH } from "../utils/apiConfig";
import type { ApiResponse } from "../types/api";
import type {
  NotificationFeedQuery,
  NotificationPreferenceDto,
  NotificationRecipientDto,
  NotificationUnreadCountDto,
  UpdateNotificationPreferenceInput,
} from "../types/notification";

function toQueryString(params: NotificationFeedQuery): string {
  const query = new URLSearchParams();

  if (typeof params.page === "number") {
    query.set("page", String(params.page));
  }
  if (typeof params.pageSize === "number") {
    query.set("pageSize", String(params.pageSize));
  }
  if (typeof params.isRead === "boolean") {
    query.set("isRead", String(params.isRead));
  }
  if (params.notifCategory) {
    query.set("notifCategory", params.notifCategory);
  }
  if (params.notifPriority) {
    query.set("notifPriority", params.notifPriority);
  }
  if (typeof params.includeDismissed === "boolean") {
    query.set("includeDismissed", String(params.includeDismissed));
  }

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export async function getMyNotifications(
  params: NotificationFeedQuery,
): Promise<ApiResponse<NotificationRecipientDto[]>> {
  const queryString = toQueryString(params);
  return await fetchData<ApiResponse<NotificationRecipientDto[]>>(
    `/Notifications/my${queryString}`,
  );
}

export async function getMyUnreadCount(): Promise<
  ApiResponse<NotificationUnreadCountDto>
> {
  return await fetchData<ApiResponse<NotificationUnreadCountDto>>(
    "/Notifications/my/unread-count",
  );
}

export async function markNotificationAsRead(
  recipientId: number,
): Promise<ApiResponse<NotificationUnreadCountDto>> {
  return await fetchData<ApiResponse<NotificationUnreadCountDto>>(
    `/Notifications/my/${recipientId}/read`,
    {
      method: "PUT",
    },
  );
}

export async function markAllNotificationsAsRead(
  notifCategory?: string,
): Promise<ApiResponse<NotificationUnreadCountDto>> {
  return await fetchData<ApiResponse<NotificationUnreadCountDto>>(
    "/Notifications/my/read-all",
    {
      method: "PUT",
      body: {
        notifCategory: notifCategory || null,
      },
    },
  );
}

export async function getMyNotificationPreferences(): Promise<
  ApiResponse<NotificationPreferenceDto[]>
> {
  return await fetchData<ApiResponse<NotificationPreferenceDto[]>>(
    "/Notifications/preferences/my",
  );
}

export async function updateMyNotificationPreference(
  notifCategory: string,
  payload: UpdateNotificationPreferenceInput,
): Promise<ApiResponse<NotificationPreferenceDto>> {
  return await fetchData<ApiResponse<NotificationPreferenceDto>>(
    `/Notifications/preferences/my/${encodeURIComponent(notifCategory)}`,
    {
      method: "PUT",
      body: payload,
    },
  );
}

function getNormalizedBaseUrl(): string {
  // VITE_API_BASE_URL is always a path prefix like /api.
  // The browser uses relative URL /hubs/notifications via the same proxy.
  return API_BASE_PATH;
}

export function getNotificationsHubUrl(): string {
  return `${getNormalizedBaseUrl()}/hubs/notifications`;
}
