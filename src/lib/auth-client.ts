/** Client-safe copy of the RBAC permission catalogue (no node crypto imports). */
export const PERMISSIONS: { key: string; label: string }[] = [
  { key: "all", label: "كامل الصلاحية" },
  { key: "finance", label: "المالية والعمولات" },
  { key: "operations", label: "العمليات والتوصيل" },
  { key: "users", label: "المستخدمون والمتاجر" },
  { key: "cms", label: "المحتوى والواجهة" },
];
