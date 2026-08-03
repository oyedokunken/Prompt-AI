import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

export function Container({ children, className }: ContainerProps) {
  return (
    <div
      className={cn(
        "max-w-[1280px] mx-auto px-6 md:px-10 lg:px-16",
        className
      )}
    >
      {children}
    </div>
  );
}
