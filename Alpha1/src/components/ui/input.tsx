import { cn } from "@/lib/cn";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-xl border border-border-subtle/80 bg-panel-raised/50 px-3.5 text-base text-primary placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 sm:h-10 sm:rounded-lg sm:px-3 sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}
