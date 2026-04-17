import React, { useState, useEffect } from "react";
import { AdminHeader } from "../../components/AdminHeader";
import { AdminSidebar } from "../../components/AdminSidebar";
import { useNavigate } from "react-router";
import { usePortalPrefix } from "../../lib/usePortalPrefix";
import { useTheme } from "../../lib/ThemeContext";
import { supabase } from "../../lib/supabase";
import { mapSupabaseCaseToLocal } from "../../lib/caseMappers";
import { Trophy, Award, Star, TrendingUp, Clock, CheckCircle, Target } from "lucide-react";
import { useUnifiedLayout } from "../../components/UnifiedLayout";

interface AgentStats {
  agentId: string;
  agentName: string;
  totalCases: number;
  completedCases: number;
  successRate: number;
  avgProcessingTime: number;
  totalRevenue: number;
  rank: number;
}

export function AdminLeaderboard() {
  const { darkMode, isUrdu, t } = useTheme();
  const navigate = useNavigate();
  const prefix = usePortalPrefix();
  const [leaderboard, setLeaderboard] = useState<AgentStats[]>([]);
  const [sortBy, setSortBy] = useState<"cases" | "revenue" | "successRate">("cases");
  const { insideUnifiedLayout } = useUnifiedLayout();

  useEffect(() => {
    loadLeaderboard();
  }, [sortBy]);

  const loadLeaderboard = async () => {
    const { data, error } = await supabase.from('cases').select('*');
    const cases = error ? [] : (data || []).map((r: any) => mapSupabaseCaseToLocal(r));
    const agentMap = new Map<string, AgentStats>();

    cases.forEach(c => {
      const key = c.agentName;
      if (!agentMap.has(key)) {
        agentMap.set(key, {
          agentId: c.agentId,
          agentName: c.agentName,
          totalCases: 0,
          completedCases: 0,
          successRate: 0,
          avgProcessingTime: 0,
          totalRevenue: 0,
          rank: 0,
        });
      }

      const stats = agentMap.get(key)!;
      stats.totalCases++;
      if (c.status === "completed") stats.completedCases++;
      stats.totalRevenue += c.paidAmount;
    });

    const statsArray = Array.from(agentMap.values()).map(stats => ({
      ...stats,
      successRate: stats.totalCases > 0 ? Math.round((stats.completedCases / stats.totalCases) * 100) : 0,
      avgProcessingTime: Math.floor(Math.random() * 20) + 10, // Mock data
    }));

    // Sort based on selected criteria
    statsArray.sort((a, b) => {
      if (sortBy === "cases") return b.totalCases - a.totalCases;
      if (sortBy === "revenue") return b.totalRevenue - a.totalRevenue;
      return b.successRate - a.successRate;
    });

    // Assign ranks
    statsArray.forEach((s, idx) => {
      s.rank = idx + 1;
    });

    setLeaderboard(statsArray);
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Award className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Star className="w-6 h-6 text-amber-600" />;
    return <span className={`font-bold ${darkMode ? "text-gray-400" : "text-gray-600"}`}>#{rank}</span>;
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-r from-yellow-400 to-yellow-600";
    if (rank === 2) return "bg-gradient-to-r from-gray-300 to-gray-500";
    if (rank === 3) return "bg-gradient-to-r from-amber-400 to-amber-600";
    return darkMode ? "bg-gray-800" : "bg-white";
  };

  return (
    <div className={`${insideUnifiedLayout ? "" : "flex min-h-screen"} ${darkMode ? "bg-gray-950" : "bg-gray-50"}`}>
      {!insideUnifiedLayout && <AdminSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AdminHeader />}
        <main className="p-3 sm:p-4 md:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
                {isUrdu ? "ایجنٹ لیڈر بورڈ" : "Agent Leaderboard"}
              </h1>
              <p className={`text-sm mt-1 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                {isUrdu ? "کارکردگی اور درجہ بندی" : "Performance rankings and statistics"}
              </p>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className={`px-4 py-2 rounded-lg border ${darkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"}`}
            >
              <option value="cases">{isUrdu ? "کیسز کے لحاظ سے" : "Sort by Cases"}</option>
              <option value="revenue">{isUrdu ? "آمدنی کے لحاظ سے" : "Sort by Revenue"}</option>
              <option value="successRate">{isUrdu ? "کامیابی کی شرح" : "Sort by Success Rate"}</option>
            </select>
          </div>

          {/* Top 3 Podium */}
          {leaderboard.length >= 3 && (
            <div className="grid grid-cols-3 gap-4 mb-6 max-w-4xl mx-auto">
              {/* 2nd Place */}
              <div className="pt-12">
                <div className={`p-4 rounded-lg text-center ${getRankBadge(2)}`}>
                  <div className="flex justify-center mb-2">
                    <Award className="w-10 h-10 text-white" />
                  </div>
                  <p className="text-white font-bold text-lg">{leaderboard[1].agentName}</p>
                  <p className="text-white/80 text-sm">{leaderboard[1].totalCases} cases</p>
                  <p className="text-white/80 text-xs">PKR {(leaderboard[1].totalRevenue / 1000).toFixed(0)}K</p>
                </div>
              </div>

              {/* 1st Place */}
              <div>
                <div className={`p-6 rounded-lg text-center ${getRankBadge(1)}`}>
                  <div className="flex justify-center mb-3">
                    <Trophy className="w-14 h-14 text-white" />
                  </div>
                  <p className="text-white font-bold text-xl">{leaderboard[0].agentName}</p>
                  <p className="text-white/90 text-base">{leaderboard[0].totalCases} cases</p>
                  <p className="text-white/90 text-sm">PKR {(leaderboard[0].totalRevenue / 1000).toFixed(0)}K</p>
                </div>
              </div>

              {/* 3rd Place */}
              <div className="pt-16">
                <div className={`p-4 rounded-lg text-center ${getRankBadge(3)}`}>
                  <div className="flex justify-center mb-2">
                    <Star className="w-9 h-9 text-white" />
                  </div>
                  <p className="text-white font-bold text-lg">{leaderboard[2].agentName}</p>
                  <p className="text-white/80 text-sm">{leaderboard[2].totalCases} cases</p>
                  <p className="text-white/80 text-xs">PKR {(leaderboard[2].totalRevenue / 1000).toFixed(0)}K</p>
                </div>
              </div>
            </div>
          )}

          {/* Full Leaderboard Table */}
          <div className={`p-6 rounded-lg ${darkMode ? "bg-gray-800" : "bg-white"} border ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
            <h3 className={`text-lg font-semibold mb-4 ${darkMode ? "text-white" : "text-gray-900"}`}>
              {isUrdu ? "مکمل درجہ بندی" : "Complete Rankings"}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                    <th className={`text-left py-3 px-4 text-sm font-semibold ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                      {isUrdu ? "رینک" : "Rank"}
                    </th>
                    <th className={`text-left py-3 px-4 text-sm font-semibold ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                      {isUrdu ? "ایجنٹ" : "Agent"}
                    </th>
                    <th className={`text-center py-3 px-4 text-sm font-semibold ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                      {isUrdu ? "کل کیسز" : "Total Cases"}
                    </th>
                    <th className={`text-center py-3 px-4 text-sm font-semibold ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                      {isUrdu ? "مکمل شدہ" : "Completed"}
                    </th>
                    <th className={`text-center py-3 px-4 text-sm font-semibold ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                      {isUrdu ? "کامیابی کی شرح" : "Success Rate"}
                    </th>
                    <th className={`text-right py-3 px-4 text-sm font-semibold ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                      {isUrdu ? "آمدنی" : "Revenue"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((agent, idx) => (
                    <tr
                      key={agent.agentName}
                      onClick={() => navigate(`${prefix}/team`, { state: { highlightAgent: agent.agentName } })}
                      className={`border-b cursor-pointer active:opacity-80 touch-manipulation transition-colors ${darkMode ? "border-gray-700 hover:bg-gray-700/50" : "border-gray-100 hover:bg-gray-50"} ${
                        agent.rank <= 3 ? (darkMode ? "bg-gray-700/30" : "bg-blue-50/50") : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center w-10">
                          {getRankIcon(agent.rank)}
                        </div>
                      </td>
                      <td className={`py-3 px-4 text-sm font-medium ${darkMode ? "text-gray-200" : "text-gray-900"}`}>
                        {agent.agentName}
                      </td>
                      <td className={`py-3 px-4 text-sm text-center ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                        <div className="flex items-center justify-center gap-1">
                          <Target className="w-4 h-4 text-blue-500" />
                          {agent.totalCases}
                        </div>
                      </td>
                      <td className={`py-3 px-4 text-sm text-center ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                        <div className="flex items-center justify-center gap-1">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          {agent.completedCases}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          agent.successRate >= 80 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                          agent.successRate >= 60 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                          "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        }`}>
                          {agent.successRate}%
                        </span>
                      </td>
                      <td className={`py-3 px-4 text-sm text-right font-bold ${darkMode ? "text-blue-400" : "text-blue-600"}`}>
                        PKR {(agent.totalRevenue / 1000).toFixed(0)}K
                      </td>
                    </tr>
                  ))}
                  {leaderboard.length === 0 && (
                    <tr>
                      <td colSpan={6} className={`py-8 text-center text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                        {isUrdu ? "کوئی ڈیٹا دستیاب نہیں" : "No data available"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}