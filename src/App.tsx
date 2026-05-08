import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BalanceProvider } from "@/contexts/BalanceContext";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import Index from "./pages/Index";
import GreedyKingGame from "./pages/GreedyKingGame";
import DiceMasterGame from "./pages/DiceMasterGame";
import CarnivalSpinGame from "./pages/CarnivalSpinGame";
import MinesGame from "./pages/MinesGame";
import AviatorGame from "./pages/AviatorGame";
import AdminPanel from "./pages/AdminPanel";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;

const App = () => (
  <TonConnectUIProvider manifestUrl={manifestUrl}>
    <QueryClientProvider client={queryClient}>
      <BalanceProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/greedy-king" element={<GreedyKingGame />} />
              <Route path="/dice-master" element={<DiceMasterGame />} />
              <Route path="/carnival-spin" element={<CarnivalSpinGame />} />
              <Route path="/mines" element={<MinesGame />} />
              <Route path="/aviator" element={<AviatorGame />} />
              <Route path="/admin" element={<AdminPanel />} />
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </BalanceProvider>
    </QueryClientProvider>
  </TonConnectUIProvider>
);

export default App;
