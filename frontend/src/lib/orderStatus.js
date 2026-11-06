/** Order status names + admin badge tones, shared by the orders board/list
 * and the order detail page so they always say the same thing. */
export const ORDER_STATUS = {
  pending: { label: "Not paid yet", tone: "neutral" },
  payment_pending: { label: "Awaiting payment", tone: "warn" },
  payment_failed: { label: "Payment failed", tone: "warn" },
  paid: { label: "Paid", tone: "info" },
  processing: { label: "Processing", tone: "admin" },
  shipped: { label: "Shipped", tone: "good" },
  delivered: { label: "Delivered", tone: "good" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};
