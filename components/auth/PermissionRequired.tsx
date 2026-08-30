type Props = {
  scope: string;
  compact?: boolean;
};

export function PermissionRequired({ scope, compact = false }: Props) {
  return (
    <span
      className={compact
        ? "text-[10px] text-muted-foreground"
        : "inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300"}
      title={`Requires permission: ${scope}`}
    >
      Requires permission: <code className="ml-1 font-mono">{scope}</code>
    </span>
  );
}
