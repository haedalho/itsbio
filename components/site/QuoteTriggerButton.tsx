"use client";

export default function QuoteTriggerButton({
  product,
  className = "",
  children = "Request a Quote",
}: {
  product?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(new CustomEvent("itsbio:open-quote", {
          detail: { product: String(product || "").trim() },
        }));
      }}
      className={className}
    >
      {children}
    </button>
  );
}
