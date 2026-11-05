// MCQ is an academy-only module. Role mapping must stay in sync with
// track-back/utils/mcq/scope.js.
export const MCQ_ADMIN_ROLES = ["org_admin"];
export const MCQ_STAFF_ROLES = ["org_admin", "teacher"];
export const MCQ_TAKER_ROLES = ["student"];

interface McqUser {
  role?: string;
  organizationId?: { type?: string } | null;
  toolAccess?: { mcq?: boolean };
}

// A "member" account opens MCQ only when its admin ticked it.
export const hasMcqAccess = (user?: McqUser | null) =>
  user?.organizationId?.type === "academy" && (user.role !== "member" || user.toolAccess?.mcq === true);

export const isMcqAdmin = (role?: string | null) => !!role && MCQ_ADMIN_ROLES.includes(role);
// Member access to MCQ makes anyone except a student MCQ staff, like a teacher.
export const isMcqStaff = (user?: McqUser | null) =>
  !!user?.role && (MCQ_STAFF_ROLES.includes(user.role) || (user.role !== "student" && user.toolAccess?.mcq === true));
export const isMcqTaker = (role?: string | null) => !!role && MCQ_TAKER_ROLES.includes(role);
