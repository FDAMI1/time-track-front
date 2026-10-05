// Maps the reference MCQ platform's ADMIN / TEACHER / STUDENT roles onto this
// application's built-in roles. Must stay in sync with track-back/utils/mcq/scope.js.
export const MCQ_ADMIN_ROLES = ["org_admin"];
export const MCQ_STAFF_ROLES = ["org_admin", "teacher", "manager"];
export const MCQ_TAKER_ROLES = ["student", "employee"];

export const isMcqAdmin = (role?: string | null) => !!role && MCQ_ADMIN_ROLES.includes(role);
export const isMcqStaff = (role?: string | null) => !!role && MCQ_STAFF_ROLES.includes(role);
export const isMcqTaker = (role?: string | null) => !!role && MCQ_TAKER_ROLES.includes(role);
