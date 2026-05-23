export interface ProgressMilestone {
  milestoneID: number;
  milestoneCode: string;
  topicID: number;
  topicCode: string;
  milestoneTemplateCode: string | null;
  ordinal: number | null;
  deadline: string | null;
  state: string;
  startedAt: string | null;
  completedAt1: string | null;
  completedAt2: string | null;
  completedAt3: string | null;
  completedAt4: string | null;
  completedAt5: string | null;
  /** Lý do milestone bị FAILED: "ABSENT" | "ABANDONED_REVISION" | "EXEMPTED_BY:..." */
  failureReason: string | null;
  /** Thời điểm milestone bị đánh dấu FAILED */
  failedAt: string | null;
  /** GV đã cấp phép SV nộp muộn */
  allowLateSubmit: boolean;
  /** Thời điểm GV cấp phép nộp muộn */
  lateSubmitGrantedAt: string | null;
  /** UserCode GV cấp phép */
  lateSubmitGrantedBy: string | null;
  createdAt: string;
  lastUpdated: string;
}

export interface ApiResponseProgressMilestones {
  data: ProgressMilestone[];
}
