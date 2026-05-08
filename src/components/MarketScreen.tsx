import { motion } from "framer-motion";
import { Clock, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { initiatePayment, getTelegram } from "@/lib/telegram";
import { useBalanceContext } from "@/contexts/BalanceContext";
import { useState } from "react";

interface MarketScreenProps {
  onGoToWallet?: () => void;
}

interface Offer {
  id: string;
  title: string;
  pay: string;
  get: string;
  bonus: string;
  valuePct: string;
  gradient: string;
  badge: string;
  timer: string;
  action: () => Promise<void>;
}

const MarketScreen = ({ onGoToWallet }: MarketScreenProps) => {
  const { refreshBalance } = useBalanceContext();
  const [busyId, setBusyId] = useState<string | null>(null);
  const apiBase = import.meta.env.VITE_API_BASE_URL || "https://broken-bria-chetan1-ea890b93.koyeb.app/api";

  // Offer 1: 500 Stars → 600 Stars (Telegram Stars invoice)
  const buyStarOffer = async () => {
    setBusyId("stars");
    try {
      await initiatePayment("deposit", "star", 500, (status) => {
        setBusyId(null);
        if (status === "paid") {
          toast({ title: "Offer claimed! 🎁", description: "500 ⭐ paid + 100 ⭐ bonus credited!" });
          refreshBalance();
        } else if (status === "cancelled") {
          toast({ title: "Cancelled", description: "Offer payment cancelled." });
        }
      });
    } catch (err: any) {
      setBusyId(null);
      toast({ title: "Error", description: err?.message || "Could not start payment.", variant: "destructive" });
    }
  };

  // Offer 2 & 3: USD via NOWPayments crypto
  const buyDollarOffer = async (usd: number, label: string, bonus: string) => {
    setBusyId(label);
    try {
      const tg = getTelegram();
      const userId = tg?.initDataUnsafe?.user?.id || "demo";
      const res = await fetch(`${apiBase}/crypto/create-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amount: usd, currency: "btc" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create payment");
      toast({
        title: "Offer Started! 🪙",
        description: `Pay ${data.payAmount} BTC in Wallet → Crypto. ${bonus} bonus on confirmation.`,
      });
      onGoToWallet?.();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Could not start offer.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const offers: Offer[] = [
    {
      id: "stars",
      title: "STAR BOOST",
      pay: "500 ⭐",
      get: "600 ⭐",
      bonus: "+100 ⭐",
      valuePct: "120% VALUE",
      timer: "Limited",
      gradient: "linear-gradient(135deg, hsl(280 75% 45%), hsl(310 70% 40%))",
      badge: "linear-gradient(135deg, hsl(45 95% 55%), hsl(35 90% 50%))",
      action: buyStarOffer,
    },
    {
      id: "usd100",
      title: "MEGA DEAL",
      pay: "$100",
      get: "$110",
      bonus: "+$10",
      valuePct: "110% VALUE",
      timer: "48m",
      gradient: "linear-gradient(135deg, hsl(140 65% 38%), hsl(170 60% 35%))",
      badge: "linear-gradient(135deg, hsl(0 80% 55%), hsl(15 80% 50%))",
      action: () => buyDollarOffer(100, "usd100", "$10"),
    },
    {
      id: "btc50",
      title: "BTC SPECIAL",
      pay: "$50 BTC",
      get: "$55 BTC",
      bonus: "+$5",
      valuePct: "110% VALUE",
      timer: "1h",
      gradient: "linear-gradient(135deg, hsl(25 90% 45%), hsl(45 95% 45%))",
      badge: "linear-gradient(135deg, hsl(280 70% 55%), hsl(310 65% 50%))",
      action: () => buyDollarOffer(50, "btc50", "$5"),
    },
  ];

  return (
    <div className="relative z-10 px-3 pt-3 pb-24 space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-3 flex items-center gap-3"
        style={{
          background: "linear-gradient(135deg, hsla(45, 90%, 55%, 0.25), hsla(25, 80%, 50%, 0.2), hsla(0, 75%, 50%, 0.15))",
          border: "1px solid hsla(45, 70%, 55%, 0.25)",
        }}
      >
        <span className="text-3xl">🏪</span>
        <div>
          <h2 className="font-bold text-base" style={{ color: "hsl(45 95% 70%)" }}>Market — Special Offers</h2>
          <p className="text-[11px]" style={{ color: "hsl(260 30% 75%)" }}>Add more, get more!</p>
        </div>
      </motion.div>

      {offers.map((offer, idx) => (
        <motion.div
          key={offer.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="rounded-3xl p-1"
          style={{
            background: "linear-gradient(135deg, hsl(45 95% 55%), hsl(25 85% 50%), hsl(0 75% 55%))",
            boxShadow: "0 10px 30px hsla(25, 85%, 45%, 0.4)",
          }}
        >
          <div className="rounded-[22px] overflow-hidden" style={{ background: offer.gradient }}>
            {/* Title banner */}
            <div className="text-center py-2.5" style={{
              background: "linear-gradient(135deg, hsl(45 95% 55%), hsl(35 90% 50%))",
              borderBottom: "2px solid hsl(25 85% 40%)",
            }}>
              <h3 className="font-black text-lg tracking-wide" style={{
                color: "hsl(0 0% 100%)",
                textShadow: "2px 2px 0 hsl(25 85% 35%), -1px -1px 0 hsl(25 85% 35%)",
                fontFamily: "var(--font-game, system-ui)",
              }}>
                {offer.title}
              </h3>
            </div>

            {/* Timer */}
            <div className="flex justify-center -mt-1 mb-2">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{
                background: "hsla(0, 0%, 0%, 0.4)",
                border: "1px solid hsla(45, 80%, 55%, 0.4)",
              }}>
                <Clock className="h-3 w-3" style={{ color: "hsl(45 90% 65%)" }} />
                <span className="text-[11px] font-bold" style={{ color: "hsl(45 90% 75%)" }}>{offer.timer}</span>
              </div>
            </div>

            {/* Pay + Get boxes */}
            <div className="flex items-center justify-center gap-2 px-4 pb-3 relative">
              <div className="flex-1 rounded-2xl py-3 text-center" style={{
                background: "hsla(0, 0%, 0%, 0.35)",
                border: "1px solid hsla(0, 0%, 100%, 0.1)",
              }}>
                <div className="text-2xl mb-1">💰</div>
                <div className="font-black text-base" style={{ color: "hsl(0 0% 100%)" }}>{offer.pay}</div>
                <div className="text-[10px] opacity-70" style={{ color: "hsl(0 0% 100%)" }}>You Pay</div>
              </div>
              <div className="text-2xl font-black" style={{ color: "hsl(45 95% 60%)" }}>+</div>
              <div className="flex-1 rounded-2xl py-3 text-center relative" style={{
                background: "hsla(0, 0%, 0%, 0.35)",
                border: "1px solid hsla(45, 80%, 55%, 0.4)",
              }}>
                <div className="text-2xl mb-1">⭐</div>
                <div className="font-black text-base" style={{ color: "hsl(45 95% 70%)" }}>{offer.get}</div>
                <div className="text-[10px] opacity-70" style={{ color: "hsl(0 0% 100%)" }}>You Get</div>
                <div className="absolute -right-1 -top-1 px-2 py-0.5 rounded-md text-[9px] font-black" style={{
                  background: offer.badge,
                  color: "hsl(0 0% 100%)",
                  boxShadow: "0 2px 8px hsla(0, 0%, 0%, 0.3)",
                }}>
                  {offer.valuePct}
                </div>
              </div>
            </div>

            {/* Bonus tag */}
            <div className="text-center pb-2">
              <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: "hsl(45 95% 70%)" }}>
                <Sparkles className="h-3.5 w-3.5" />
                Bonus {offer.bonus} extra!
              </span>
            </div>

            {/* Buy button */}
            <div className="px-4 pb-4">
              <motion.button
                whileTap={{ scale: 0.95 }}
                disabled={busyId === offer.id}
                onClick={offer.action}
                className="w-full rounded-2xl py-3 font-black text-base disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, hsl(140 75% 45%), hsl(150 70% 40%))",
                  color: "hsl(0 0% 100%)",
                  textShadow: "1px 1px 0 hsla(0, 0%, 0%, 0.3)",
                  boxShadow: "0 6px 20px hsla(140, 70%, 40%, 0.5), inset 0 -3px 0 hsla(0, 0%, 0%, 0.25)",
                }}
              >
                {busyId === offer.id ? "Processing..." : `Buy ${offer.pay} → Get ${offer.get}`}
              </motion.button>
            </div>
          </div>
        </motion.div>
      ))}

      <p className="text-center text-[10px] px-4" style={{ color: "hsl(260 25% 65%)" }}>
        After payment, bonus will be credited automatically by admin.
      </p>
    </div>
  );
};

export default MarketScreen;
