import { HardHat } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AuthShellProps {
  title: string;
  children: React.ReactNode;
}

export function AuthShell({ title, children }: AuthShellProps) {
  return (
    <div className="blueprint-grid relative flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="hazard-stripe absolute inset-x-0 top-0 h-2" />
      <div className="animate-fade-up w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-md">
            <HardHat className="h-8 w-8" aria-hidden />
          </span>
          <p className="font-display text-2xl font-bold uppercase tracking-widest">
            Construction Log
          </p>
          <p className="text-sm text-muted-foreground">
            Daily site records — signed, synced, on file
          </p>
        </div>
        <Card className="border-t-4 border-t-primary shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-2xl uppercase">{title}</CardTitle>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
