import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { FiImage, FiFileText, FiDownloadCloud, FiCheckCircle, FiAward } from "react-icons/fi";
import { AuthContext } from "../../context/AuthContext.jsx";
import auctionService from "../../utils/auctionService";
import { formatMoney, retainedEntries } from "../../utils/auctionFormat";
import AuctionShell from "./AuctionShell.jsx";
import AuctionSummaryBoard from "./AuctionSummaryBoard.jsx";
import { Button, Spinner, toast, confirmDialog } from "../../components/auction/ui.jsx";

export default function AuctionResults() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [sortBy, setSortBy] = useState("high"); // high | low — price sort within each team
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
      const bought = state.players.filter((p) => String(p.soldTo) === String(t._id)).sort((x, y) => (y.soldPrice || 0) - (x.soldPrice || 0));
      const spent = bought.reduce((s, p) => s + (p.soldPrice || 0), 0);
      // Retained players + manager first, then bought players.
      const squad = [...retainedEntries(t), ...bought];
      return { ...t, squad, spent, remaining: Math.max(0, t.purse - spent - (t.retainedCost || 0)) };
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

      {/* Filter / sort — reflected in the on-screen card and the download. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-black uppercase tracking-wide text-slate-400">Sort players by price</span>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-white/10 dark:bg-white/5">
          {[{ k: "high", t: "Highest first" }, { k: "low", t: "Lowest first" }].map((o) => (
            <button key={o.k} onClick={() => setSortBy(o.k)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${sortBy === o.k ? "bg-indigo-600 text-white shadow" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"}`}>
              {o.t}
            </button>
          ))}
        </div>
      </div>

      {/* Exportable results card — professional summary with logo + watermark
          (the same board used on the big screen / OBS when the auction finishes). */}
      <div ref={cardRef}>
        <AuctionSummaryBoard state={state} variant="export" sort={sortBy} className="rounded-3xl shadow-sm ring-1 ring-slate-200" />
      </div>

      {unsold.length > 0 && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">Unsold players ({unsold.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {unsold.map((p) => <span key={p._id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">{p.name}</span>)}
          </div>
        </div>
      )}
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
