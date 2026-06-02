import { Outlet, createRootRoute, Link } from "@tanstack/react-router";
import { AppProvider } from "@/context/AppContext";
import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-serif font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex mt-6 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Go to Procurement Dashboard
        </Link>
      </div>
    </div>
  );
}

function RootComponent() {
  return (
    <AppProvider>
      <Outlet />
      <Toaster position="top-right" richColors />
    </AppProvider>
  );
}
