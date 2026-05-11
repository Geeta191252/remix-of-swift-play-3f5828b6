import { motion, AnimatePresence } from "framer-motion";
import { X, Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getTelegram, requestInvoice } from "@/lib/telegram";
import { useBalanceContext } from "@/contexts/BalanceContext";
import { useEffect, useState } from "react";
import OfferCard3D from "@/components/OfferCard3D";

interface MarketScreenProps {
  onGoToWallet?: () => void;
}

interface BackendOffer {
  _id: string;
  title: string;
  payAmount: number;
  payCurrency: "star" | "dollar";
  getAmount: number;
  bonusLabel?: string;
  valueLabel?: string;
}

const apiBase = import.meta.env.VITE_API_BASE_URL || "https://broken-bria-chetan1-ea890b93.koyeb.app/api";

const cryptoApiTicker: Record<string, string> = { usdt: "usdttrc20" };
const CRYPTO_OPTIONS: Array<{ id: string; label: string; emoji: string }> = [
  { id: "btc", label: "BTC", emoji: "₿" },
  { id: "ltc", label: "LTC", emoji: "Ł" },
  { id: "usdt", label: "USDT", emoji: "₮" },
  { id: "ton", label: "TON", emoji: "💎" },
  { id: "sol", label: "SOL", emoji: "◎" },
  { id: "trx", label: "TRX", emoji: "🔺" },
  { id: "doge", label: "DOGE", emoji: "🐕" },
];

const gradientFor = (idx: number) => {
  const list = [
    "linear-gradient(135deg, hsl(280 75% 45%), hsl(310 70% 40%))",
    "linear-gradient(135deg, hsl(140 65% 38%), hsl(170 60% 35%))",
    "linear-gradient(135deg, hsl(25 90% 45%), hsl(45 95% 45%))",
    "linear-gradient(135deg, hsl(200 75% 45%), hsl(220 70% 40%))",
  ];
  return list[idx % list.length];
};
const badgeFor = (idx: number) => {
  const list = [
    "linear-gradient(135deg, hsl(45 95% 55%), hsl(35 90% 50%))",
    "linear-gradient(135deg, hsl(0 80% 55%), hsl(15 80% 50%))",
    "linear-gradient(135deg, hsl(280 70% 55%), hsl(310 65% 50%))",
    "linear-gradient(135deg, hsl(140 70% 45%), hsl(170 60% 40%))",
  ];
  return list[idx % list.length];
};

const MarketScreen = ({ onGoToWallet }: MarketScreenProps) => {
  const { refreshBalance } = useBalanceContext();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [offers, setOffers] = useState<BackendOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [coinPickerOffer, setCoinPickerOffer] = useState<BackendOffer | null>(null);
  const [cryptoPayment, setCryptoPayment] = useState<{
    payAddress: string;
    payAmount: number;
    payCurrency: string;
    orderId: string;
    offerLabel: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${apiBase}/offers`);
        const d = await r.json();
        setOffers(d.offers || []);
      } catch {
        setOffers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const claimStarOffer = async (offer: BackendOffer) => {
    setBusyId(offer._id);
    try {
      const tg = getTelegram();
      if (!tg) {
        throw new Error("Please open this app inside Telegram to make payments.");
      }
      const invoiceUrl = await requestInvoice("deposit", "star", offer.payAmount);
      // Clear busy immediately so the button is responsive while invoice is open
      setBusyId(null);
      tg.openInvoice(invoiceUrl, (status) => {
        if (status === "paid") {
          toast({ title: "Offer paid! 🎁", description: `${offer.bonusLabel || "Bonus"} will be credited by admin shortly.` });
          refreshBalance();
        } else if (status === "cancelled") {
          toast({ title: "Cancelled", description: "Offer payment cancelled." });
        } else if (status === "failed") {
          toast({ title: "Payment failed", description: "Please try again.", variant: "destructive" });
        }
      });
    } catch (err: any) {
      setBusyId(null);
      toast({ title: "Error", description: err?.message || "Could not start payment.", variant: "destructive" });
    }
  };

  const claimDollarOffer = (offer: BackendOffer) => {
    // Open coin picker first — user picks BTC/LTC/USDT/etc., then we create payment directly
    setCoinPickerOffer(offer);
  };

  const startCryptoPayment = async (offer: BackendOffer, coinId: string) => {
    setBusyId(offer._id);
    setCoinPickerOffer(null);
    try {
      const tg = getTelegram();
      const userId = tg?.initDataUnsafe?.user?.id || "demo";
      const apiCurrency = cryptoApiTicker[coinId] || coinId;
      const res = await fetch(`${apiBase}/crypto/create-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amount: offer.payAmount, currency: apiCurrency }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create payment");
      if (!data.payAddress) throw new Error("No payment address returned");
      setCryptoPayment({
        payAddress: data.payAddress,
        payAmount: data.payAmount,
        payCurrency: data.payCurrency,
        orderId: data.orderId,
        offerLabel: `${offer.title} • Get $${offer.getAmount}`,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Could not start offer.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const claim = (offer: BackendOffer) =>
    offer.payCurrency === "star" ? claimStarOffer(offer) : claimDollarOffer(offer);

  return (
    <div className="relative z-10 px-3 pt-3 pb-24 space-y-4">
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

      {loading ? (
        <p className="text-center text-sm py-8" style={{ color: "hsl(260 30% 70%)" }}>Loading offers…</p>
      ) : offers.length === 0 ? (
        <div className="rounded-2xl p-6 text-center" style={{
          background: "hsla(260, 40%, 25%, 0.5)",
          border: "1px dashed hsla(280, 50%, 50%, 0.3)",
        }}>
          <div className="text-4xl mb-2">📭</div>
          <p className="text-sm font-bold" style={{ color: "hsl(45 90% 70%)" }}>No active offers right now</p>
          <p className="text-[11px] mt-1" style={{ color: "hsl(260 30% 70%)" }}>Check back soon for special deals!</p>
        </div>
      ) : (
        offers.map((offer, idx) => (
          <motion.div
            key={offer._id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
          >
            <OfferCard3D
              offer={offer}
              onClaim={() => claim(offer)}
              busy={busyId === offer._id}
            />
          </motion.div>
        ))
      )}

      {offers.length > 0 && (
        <p className="text-center text-[10px] px-4" style={{ color: "hsl(260 25% 65%)" }}>
          After payment, bonus will be credited automatically by admin.
        </p>
      )}

      {/* Coin picker dialog for $ offers */}
      <AnimatePresence>
        {coinPickerOffer && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: "hsla(260, 50%, 8%, 0.85)" }}
            onClick={() => setCoinPickerOffer(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25 }}
              className="w-full max-w-md rounded-2xl p-4 max-h-[85vh] overflow-y-auto"
              style={{ background: "linear-gradient(180deg, hsl(260 45% 18%), hsl(270 50% 12%))", border: "1px solid hsla(280, 60%, 45%, 0.4)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-black text-base" style={{ color: "hsl(45 95% 70%)" }}>Pay ${coinPickerOffer.payAmount} with…</h3>
                <button onClick={() => setCoinPickerOffer(null)}>
                  <X className="h-5 w-5" style={{ color: "hsl(260 30% 70%)" }} />
                </button>
              </div>
              <p className="text-xs mb-3" style={{ color: "hsl(260 30% 75%)" }}>
                Choose a crypto. Bonus: {coinPickerOffer.bonusLabel || `Get $${coinPickerOffer.getAmount}`}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {CRYPTO_OPTIONS.map((c) => (
                  <motion.button
                    key={c.id}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => startCryptoPayment(coinPickerOffer, c.id)}
                    className="rounded-xl py-3 font-black flex flex-col items-center gap-1"
                    style={{
                      background: "linear-gradient(135deg, hsl(280 60% 35%), hsl(300 55% 30%))",
                      border: "1px solid hsla(280, 70%, 50%, 0.5)",
                      color: "hsl(0 0% 100%)",
                    }}
                  >
                    <span className="text-2xl">{c.emoji}</span>
                    <span className="text-xs">{c.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Crypto payment address dialog */}
      <AnimatePresence>
        {cryptoPayment && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: "hsla(260, 50%, 8%, 0.9)" }}
            onClick={() => setCryptoPayment(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25 }}
              className="w-full max-w-md rounded-2xl p-4 max-h-[85vh] overflow-y-auto"
              style={{ background: "linear-gradient(180deg, hsl(260 45% 18%), hsl(270 50% 12%))", border: "1px solid hsla(280, 60%, 45%, 0.4)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-black text-base" style={{ color: "hsl(45 95% 70%)" }}>Send Payment</h3>
                <button onClick={() => setCryptoPayment(null)}>
                  <X className="h-5 w-5" style={{ color: "hsl(260 30% 70%)" }} />
                </button>
              </div>
              <p className="text-[11px] mb-3" style={{ color: "hsl(260 30% 75%)" }}>{cryptoPayment.offerLabel}</p>

              <div className="rounded-2xl p-4 mb-3" style={{ background: "hsla(0, 0%, 0%, 0.4)", border: "1px solid hsla(45, 70%, 55%, 0.35)" }}>
                <p className="text-[11px] mb-1" style={{ color: "hsl(260 30% 75%)" }}>Send exactly</p>
                <p className="font-black text-xl" style={{ color: "hsl(45 95% 70%)" }}>
                  {cryptoPayment.payAmount} {cryptoPayment.payCurrency.toUpperCase()}
                </p>
              </div>

              <div className="rounded-2xl p-3 mb-3" style={{ background: "hsla(0, 0%, 0%, 0.4)", border: "1px solid hsla(280, 50%, 50%, 0.3)" }}>
                <p className="text-[11px] mb-1" style={{ color: "hsl(260 30% 75%)" }}>{cryptoPayment.payCurrency.toUpperCase()} Address</p>
                <p className="text-xs font-mono break-all select-all" style={{ color: "hsl(0 0% 100%)" }}>{cryptoPayment.payAddress}</p>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(cryptoPayment.payAddress);
                  toast({ title: "Copied!", description: "Address copied to clipboard." });
                }}
                className="w-full rounded-xl py-3 font-bold flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, hsl(140 75% 45%), hsl(150 70% 40%))",
                  color: "hsl(0 0% 100%)",
                  boxShadow: "0 4px 14px hsla(140, 70%, 40%, 0.4)",
                }}
              >
                <Copy className="h-4 w-4" /> Copy Address
              </button>
              <p className="text-[10px] text-center mt-3" style={{ color: "hsl(260 25% 65%)" }}>
                Bonus auto-credited after blockchain confirmation.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MarketScreen;
