import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { MotionConfig } from "framer-motion";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import "@/index.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RouteErrorFallback } from "@/components/RouteErrorFallback";
import { Toaster } from "@/components/Toaster";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { queryClient } from "@/lib/queryClient";
import { QueryProvider } from "@/providers/QueryProvider";
import { registerServiceWorker } from "@/pwa/registerServiceWorker";

registerServiceWorker();

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  defaultErrorComponent: RouteErrorFallback,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <MotionConfig reducedMotion="user">
          <QueryProvider>
            <RouterProvider router={router} />
            <Toaster />
            <UpdatePrompt />
          </QueryProvider>
        </MotionConfig>
      </ErrorBoundary>
    </StrictMode>,
  );
}
