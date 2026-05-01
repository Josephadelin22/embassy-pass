import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserCheck, Star, Briefcase, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Stats = {
  total: number;
  presents: number;
  vip: number;
  exposants: number;
};

export default function LiveDashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, presents: 0, vip: 0, exposants: 0 });

  useEffect(() => {
    // 1. Initial Load
    async function load() {
      const { data: invs, error } = await supabase
        .from("invitations")
        .select("status, participants(category)");
      
      if (error) return;

      const newStats = { total: invs.length, presents: 0, vip: 0, exposants: 0 };
      
      invs.forEach(inv => {
        if (inv.status === "utilise") {
          newStats.presents++;
          const cat = (inv.participants as any)?.category;
          if (cat === "vip") newStats.vip++;
          if (cat === "exposant") newStats.exposants++;
        }
      });
      setStats(newStats);
    }
    void load();

    // 2. Realtime Subscriptions
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'invitations' },
        (payload) => {
          if (payload.new.status === 'utilise' && payload.old.status !== 'utilise') {
            // Need to fetch the category or just refresh everything
            // For simplicity and to keep it 100% accurate, we just reload the stats
            void load();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'invitations' },
        () => { void load(); }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const percentage = stats.total > 0 ? Math.round((stats.presents / stats.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col p-6">
      <header className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" className="text-zinc-400 hover:text-white hover:bg-zinc-800">
            <Link to="/"><ArrowLeft className="h-5 w-5 mr-2" /> Retour</Link>
          </Button>
          <h1 className="text-3xl font-display font-black tracking-tight text-white">Embassy Pass <span className="text-zinc-500 font-normal">LIVE</span></h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-full font-medium">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          Synchronisé
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full gap-8">
        
        {/* Main Jauge */}
        <div className="text-center mb-8">
          <div className="text-[12rem] font-black leading-none tracking-tighter bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">
            {stats.presents}
          </div>
          <h2 className="text-3xl font-medium text-zinc-400 mt-2 uppercase tracking-widest">Invités Présents</h2>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full">
          <Card className="bg-zinc-900 border-zinc-800 p-6 flex flex-col items-center justify-center text-center shadow-2xl">
            <Users className="h-8 w-8 text-blue-400 mb-4" />
            <p className="text-4xl font-bold text-white mb-1">{stats.total}</p>
            <p className="text-sm text-zinc-500 uppercase tracking-wider font-semibold">Total Inscrits</p>
          </Card>
          
          <Card className="bg-zinc-900 border-zinc-800 p-6 flex flex-col items-center justify-center text-center shadow-2xl">
            <UserCheck className="h-8 w-8 text-emerald-400 mb-4" />
            <p className="text-4xl font-bold text-emerald-400 mb-1">{percentage}%</p>
            <p className="text-sm text-zinc-500 uppercase tracking-wider font-semibold">Taux de présence</p>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800 p-6 flex flex-col items-center justify-center text-center shadow-2xl">
            <Star className="h-8 w-8 text-amber-400 mb-4" />
            <p className="text-4xl font-bold text-white mb-1">{stats.vip}</p>
            <p className="text-sm text-zinc-500 uppercase tracking-wider font-semibold">VIP Présents</p>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800 p-6 flex flex-col items-center justify-center text-center shadow-2xl">
            <Briefcase className="h-8 w-8 text-purple-400 mb-4" />
            <p className="text-4xl font-bold text-white mb-1">{stats.exposants}</p>
            <p className="text-sm text-zinc-500 uppercase tracking-wider font-semibold">Exposants Présents</p>
          </Card>
        </div>
      </main>
    </div>
  );
}
