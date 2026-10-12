// MCQ is an academy-only module. Role mapping must stay in sync with
// track-back/utils/mcq/scope.js.
export const MCQ_ADMIN_ROLES = ["org_admin"];
export const MCQ_STAFF_ROLES = ["org_admin", "teacher"];
export const MCQ_TAKER_ROLES = ["student"];

export const hasMcqAccess = (user?: { organizationId?: { type?: string } | null } | null) =>
  user?.organizationId?.type === "academy";

export const isMcqAdmin = (role?: string | null) => !!role && MCQ_ADMIN_ROLES.includes(role);
export const isMcqStaff = (role?: string | null) => !!role && MCQ_STAFF_ROLES.includes(role);
export const isMcqTaker = (role?: string | null) => !!role && MCQ_TAKER_ROLES.includes(role);
