import { Navigate, Route, Routes } from "react-router-dom";
import { DesignSystemPage } from "./pages/DesignSystemPage.js";

function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground">
      <div>
        <p className="text-sm text-muted-foreground">This page is unavailable.</p>
        <a
          className="mt-3 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline"
          href="/"
        >
          Return to FolioAgent
        </a>
      </div>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/design" element={import.meta.env.DEV ? <DesignSystemPage /> : <NotFound />} />
      <Route
        path="/"
        element={import.meta.env.DEV ? <Navigate to="/design" replace /> : <NotFound />}
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
