import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { FiImage, FiFileText, FiDownloadCloud, FiCheckCircle, FiAward } from "react-icons/fi";
import { AuthContext } from "../../context/AuthContext.jsx";
import auctionService from "../../utils/auctionService";
import { formatMoney } from "../../utils/auctionFormat";
import AuctionShell from "./AuctionShell.jsx";
import { Button, Spinner, toast, confirmDialog } from "../../components/auction/ui.jsx";

export default function AuctionResults() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const cardRef = useRef(null);

  const load = async () => {
    try {
      const data = await auctionService.get(id, user.token);
      if (data && data.isAdmin === false) { navigate(`/auctions/${id}/team`, { replace: true }); return; }
      setState(data);
    }
    catch (e) { setState(null); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (user?.token) load(); /* eslint-disable-next-line */ }, [id, user?.token]);

  const d = useMemo(() => {
    if (!state?.auction) return null;
    const a = state.auction;
    const money = (n) => formatMoney(n, { symbol: a.currencySymbol, format: a.currencyFormat });
    const teams = state.teams.map((t) => {
      const squad = state.players.filter((p) => String(p.soldTo) === String(t._id)).sort((x, y) => (y.soldPrice || 0) - (x.soldPrice || 0));
      const spent = squad.reduce((s, p) => s + (p.soldPrice || 0), 0);
      return { ...t, squad, spent, remaining: Math.max(0, t.purse - spent) };
    });
    const sold = state.players.filter((p) => p.status === "sold");
    const unsold = state.players.filter((p) => p.status === "unsold");
    const totalSpend = sold.reduce((s, p) => s + (p.soldPrice || 0), 0);
    const priciest = sold.slice().sort((x, y) => (y.soldPrice || 0) - (x.soldPrice || 0))[0] || null;
    return { a, money, teams, sold, unsold, totalSpend, priciest };
  }, [state]);

  const complete = async () => {
    const ok = await confirmDialog({ title: "Complete this auction?", message: "This marks the auction as finished. You can still view and export the results.", confirmText: "Mark completed" });
    if (!ok) return;
    try { await auctionService.update(id, { status: "completed" }, user.token); toast.success("Auction marked completed."); load(); }
    catch (e) { toast.error("Could not update the auction."); }
  };

  const snapshot = async () => {
    const node = cardRef.current;
    if (!node) return null;
    return toPng(node, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true });
  };
  const downloadImage = async () => {
    try {
      setBusy("img");
      const url = await snapshot();
      if (url) { const link = document.createElement("a"); link.download = `${d.a.name}-results.png`; link.href = url; link.click(); toast.success("Image downloaded."); }
    } catch (e) { toast.error("Could not create the image."); } finally { setBusy(""); }
  };
  const downloadPdf = async () => {
    try {
      setBusy("pdf");
      const url = await snapshot();
      if (!url) return;
      const img = new Image();
      img.onload = () => {
        const pdf = new jsPDF({ orientation: img.width > img.height ? "l" : "p", unit: "px", format: [img.width, img.height] });
        pdf.addImage(url, "PNG", 0, 0, img.width, img.height);
        pdf.save(`${d.a.name}-results.pdf`);
        toast.success("PDF downloaded.");
        setBusy("");
      };
      img.src = url;
    } catch (e) { toast.error("Could not create the PDF."); setBusy(""); }
  };
  const exportCsv = () => {
    const rows = [["Team", "Player", "Role", "Category", "Price"]];
    d.teams.forEach((t) => t.squad.forEach((p) => rows.push([t.name, p.name, p.role || "", p.category || "", p.soldPrice || 0])));
    d.unsold.forEach((p) => rows.push(["(Unsold)", p.name, p.role || "", p.category || "", ""]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${d.a.name}-results.csv`;
    link.click();
    toast.success("CSV exported.");
  };

  if (loading) return <Center text={<Spinner size={28} className="text-indigo-500" />} />;
  if (!d) return <Center text="Auction not found." />;
  const { a, money, teams, sold, unsold, totalSpend, priciest } = d;

  const exportButtons = (
    <div className="flex items-center gap-2">
      <Button variant="soft" icon={FiFileText} onClick={exportCsv} className="px-3 py-2">CSV</Button>
      <Button variant="soft" icon={FiImage} loading={busy === "img"} onClick={downloadImage} className="px-3 py-2">Image</Button>
      <Button icon={FiDownloadCloud} loading={busy === "pdf"} onClick={downloadPdf} className="px-3 py-2">PDF</Button>
    </div>
  );

  return (
    <AuctionShell active="results" auctionId={id} auctionName={a.name} shareId={a.shareId} title="Results" status={a.status} right={exportButtons}>
      {/* Top stats + complete */}
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <StatCard label="Players sold" value={`${sold.length}`} />
        <StatCard label="Total spend" value={money(totalSpend)} accent />
        <StatCard label="Unsold" value={`${unsold.length}`} />
        <StatCard label="Priciest buy" value={priciest ? `${priciest.name}` : "—"} sub={priciest ? money(priciest.soldPrice) : ""} />
      </div>

      {a.status !== "completed" ? (
        <div className="mb-5"><Button variant="success" icon={FiCheckCircle} onClick={complete}>Mark auction completed</Button></div>
      ) : (
        <div className="mb-5 inline-flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-black text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><FiCheckCircle /> Auction completed</div>
      )}

      {/* Exportable results card (kept light for clean exports) */}
      <div ref={cardRef} className="overflow-hidden rounded-3xl bg-white text-slate-900 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-violet-700 px-6 py-5 text-white">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-white/70">Auction Results</div>
            <div className="text-2xl font-black">{a.name}</div>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 text-xl font-black">C</div>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
          {teams.map((t) => (
            <div key={t._id} className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-2 flex items-center gap-2">
                {t.logoUrl ? <img src={t.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" /> : <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-xs font-black text-white">{t.name[0]}</div>}
                <div className="flex-1">
                  <div className="font-black">{t.name}</div>
                  <div className="text-[11px] font-semibold text-slate-500">{t.squad.length} players · Spent {money(t.spent)} · Left {money(t.remaining)}</div>
                </div>
              </div>
              {t.squad.length === 0 ? (
                <div className="py-3 text-center text-xs text-slate-400">No players bought</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {t.squad.map((p) => (
                    <div key={p._id} className="flex items-center gap-2 py-1.5 text-sm">
                      <span className="flex-1 truncate font-semibold">{p.name}</span>
                      {p.role ? <span className="text-[10px] font-bold text-slate-400">{p.role}</span> : null}
                      <span className="font-black text-emerald-600">{money(p.soldPrice)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {unsold.length > 0 && (
          <div className="border-t border-slate-100 px-6 py-4">
            <div className="mb-1 text-xs font-black uppercase tracking-wide text-slate-400">Unsold ({unsold.length})</div>
            <div className="flex flex-wrap gap-1.5">
              {unsold.map((p) => <span key={p._id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{p.name}</span>)}
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 bg-slate-900 py-3 text-xs font-semibold text-white/70">
          <FiAward size={13} /> Generated with <span className="font-black text-white">CricZone</span>
        </div>
      </div>
    </AuctionShell>
  );
}

const StatCard = ({ label, value, sub, accent }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
    <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</div>
    <div className={`truncate text-xl font-black ${accent ? "text-emerald-600" : ""}`}>{value}</div>
    {sub ? <div className="text-xs font-bold text-slate-400">{sub}</div> : null}
  </div>
);
const Center = ({ text }) => <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-400 dark:bg-slate-950">{text}</div>;
