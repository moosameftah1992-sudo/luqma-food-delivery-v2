export const PAYMENT_METHODS = ["card", "benefitpay", "cash"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_LABELS: Record<PaymentMethod, { ar: string; en: string }> = {
  card: { ar: "بطاقة ائتمانية / خصم", en: "Debit / credit card" },
  benefitpay: { ar: "بنفت باي", en: "BenefitPay" },
  cash: { ar: "الدفع نقداً عند الاستلام", en: "Cash on delivery" },
};
