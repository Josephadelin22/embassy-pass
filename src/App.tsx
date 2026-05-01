import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import Admin from "./pages/Admin.tsx";
import Participants from "./pages/Participants.tsx";
import NewParticipant from "./pages/NewParticipant.tsx";
import Scan from "./pages/Scan.tsx";
import { ProtectedRoute } from "./components/ProtectedRoute.tsx";

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter basename="/embassy-pass">
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireRole="admin">
              <Admin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/participants"
          element={
            <ProtectedRoute requireRole="admin">
              <Participants />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/participants/new"
          element={
            <ProtectedRoute requireRole="admin">
              <NewParticipant />
            </ProtectedRoute>
          }
        />
        <Route
          path="/scan"
          element={
            <ProtectedRoute requireRole="agent">
              <Scan />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;

