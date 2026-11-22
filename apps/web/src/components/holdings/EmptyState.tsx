import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onAdd: () => void;
  onImport: () => void;
}

export function EmptyState({ onAdd, onImport }: EmptyStateProps) {
  return (
    <div className="py-16 text-center">
      <p className="text-base font-medium text-foreground">
        No holdings yet. Add a holding manually or import from a CSV to track your positions.
      </p>
      <div className="mt-5 flex items-center justify-center gap-3">
        <Button onClick={onAdd}>Add holding</Button>
        <Button variant="outline" onClick={onImport}>
          Import CSV
        </Button>
      </div>
    </div>
  );
}
