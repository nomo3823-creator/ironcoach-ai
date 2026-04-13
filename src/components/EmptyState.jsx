export default function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center space-y-4">
      {Icon && <Icon className="h-10 w-10 text-muted-foreground mx-auto" />}
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {body && <p className="text-xs text-muted-foreground mt-1">{body}</p>}
      </div>
      {action}
    </div>
  );
}