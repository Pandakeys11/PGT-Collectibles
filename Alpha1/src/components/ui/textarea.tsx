import { cn } from "@/lib/cn";

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-[8.5rem] w-full rounded-xl border border-border-subtle bg-panel-raised px-3.5 py-3 text-base text-primary placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 sm:min-h-28 sm:rounded-lg sm:px-3 sm:py-2 sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}
