import React from "react";

type Props = {
  id?: string;
  children: React.ReactNode;
  headerHeight?: number;
  className?: string;
};

export default function SnapSection({
  id,
  children,
  headerHeight = 56,
  className,
}: Props) {
  return (
    <section
      id={id}
      data-snap
      className={className ?? ""}
      style={{ minHeight: `calc(100dvh - ${headerHeight}px)` }}
    >
      {children}
    </section>
  );
}
