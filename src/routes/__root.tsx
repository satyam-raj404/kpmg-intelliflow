import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AppProvider } from "@/context/AppContext";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "KPMG IntelliSource — Procurement Process Optimization" },
      {
        name: "description",
        content:
          "KPMG IntelliSource is a centralized procurement management platform delivering real-time P2P visibility, ABAC compliance, and leadership dashboards.",
      },
      { name: "author", content: "KPMG" },
      { property: "og:title", content: "KPMG IntelliSource — Procurement Process Optimization" },
      { property: "og:description", content: "IntelliSource Dashboard provides a unified view of procurement operations for enhanced decision-making." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "KPMG IntelliSource — Procurement Process Optimization" },
      { name: "description", content: "IntelliSource Dashboard provides a unified view of procurement operations for enhanced decision-making." },
      { name: "twitter:description", content: "IntelliSource Dashboard provides a unified view of procurement operations for enhanced decision-making." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b46bca56-c946-4ca5-9734-548b11160bdb/id-preview-0dc3b9a6--8a9f8a6b-685e-4b98-9a6a-823f6b6b2390.lovable.app-1776950000276.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b46bca56-c946-4ca5-9734-548b11160bdb/id-preview-0dc3b9a6--8a9f8a6b-685e-4b98-9a6a-823f6b6b2390.lovable.app-1776950000276.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      // Replace with KPMG official licensed fonts before production
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
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
        <a
          href="/"
          className="inline-flex mt-6 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-dark"
        >
          Go to Procurement Dashboard
        </a>
      </div>
    </div>
  );
}

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
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
