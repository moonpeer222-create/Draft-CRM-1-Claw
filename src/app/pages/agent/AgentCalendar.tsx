import { AgentSidebar } from "../../components/AgentSidebar";
import { AgentHeader } from "../../components/AgentHeader";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useState } from "react";
import { useTheme } from "../../lib/ThemeContext";
import { toast } from "../../lib/toast";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import { motion, AnimatePresence } from "motion/react";
import { modalVariants } from "../../lib/animations";
import { Clock } from "lucide-react";

export function AgentCalendar() {
  const { darkMode, isUrdu, fontClass, t } = useTheme();
  const dc = darkMode;
  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    type: "medical",
    date: "",
    time: "",
    customer: "",
  });

  const [events, setEvents] = useState([
    { id: 1, time: "09:00 AM", title: "Medical Appointment - Ahmed Khan", type: "medical", color: "orange", customer: "Ahmed Khan" },
    { id: 2, time: "11:00 AM", title: "Document Review - Fatima Bibi", type: "documents", color: "blue", customer: "Fatima Bibi" },
    { id: 3, time: "02:00 PM", title: "Payment Follow-up - Ali Raza", type: "payment", color: "green", customer: "Ali Raza" },
    { id: 4, time: "04:00 PM", title: "Pre-Departure Briefing - Usman Malik", type: "meeting", color: "purple", customer: "Usman Malik" },
  ]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const handleCreateEvent = () => {
    if (!newEvent.title || !newEvent.date || !newEvent.time) {
      toast.error("Please fill all required fields");
      return;
    }
    const colorMap: Record<string, string> = { medical: "orange", documents: "blue", payment: "green", meeting: "purple" };
    const created = {
      id: events.length + 1,
      time: newEvent.time,
      title: `${newEvent.title}${newEvent.customer ? ` - ${newEvent.customer}` : ""}`,
      type: newEvent.type,
      color: colorMap[newEvent.type] || "gray",
      customer: newEvent.customer,
    };
    setEvents([...events, created]);
    toast.success(`Event "${newEvent.title}" created for ${newEvent.date}!`);
    setShowNewEventModal(false);
    setNewEvent({ title: "", type: "medical", date: "", time: "", customer: "" });
  };

  const handleReschedule = (event: any) => {
    const lt = toast.loading(`Rescheduling "${event.title}"...`);
    setTimeout(() => {
      toast.dismiss(lt);
      toast.success(`"${event.title}" rescheduled to tomorrow`);
    }, 1000);
  };

  const handleDeleteEvent = (eventId: number) => {
    setEvents(events.filter(e => e.id !== eventId));
    setSelectedEvent(null);
    toast.success("Event deleted");
  };

  const { insideUnifiedLayout } = useUnifiedLayout();

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <AgentSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AgentHeader />}
        
        <main className="p-3 sm:p-4 md:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
            <div>
              <h1 className={`text-xl md:text-2xl font-bold mb-2 ${txt}`}>{t("agentCalendar.title")}</h1>
              <p className={sub}>{t("agentCalendar.subtitle")}</p>
            </div>
            <button
              onClick={() => setShowNewEventModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              New Event
            </button>
          </div>

          {/* Calendar Controls */}
          <div className={`${card} rounded-xl shadow-sm p-4 mb-6`}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 sm:gap-4">
                <button
                  onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
                  className={`p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
                >
                  <ChevronLeft className={`w-5 h-5 ${dc ? "text-gray-300" : "text-gray-700"}`} />
                </button>
                <div className="flex items-center gap-2">
                  <CalendarIcon className={`w-5 h-5 ${dc ? "text-gray-400" : "text-gray-700"}`} />
                  <h2 className={`text-base sm:text-lg font-semibold ${txt}`}>February 2026</h2>
                </div>
                <button
                  onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
                  className={`p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
                >
                  <ChevronRight className={`w-5 h-5 ${dc ? "text-gray-300" : "text-gray-700"}`} />
                </button>
              </div>

              <div className="flex gap-1 sm:gap-2">
                <button
                  onClick={() => setViewMode("day")}
                  className={`px-3 sm:px-4 py-2 min-h-[44px] rounded-lg text-sm ${
                    viewMode === "day" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : `${dc ? "text-gray-300 hover:bg-gray-700" : "text-gray-700 hover:bg-gray-100"}`
                  }`}
                >
                  Day
                </button>
                <button
                  onClick={() => setViewMode("week")}
                  className={`px-3 sm:px-4 py-2 min-h-[44px] rounded-lg text-sm ${
                    viewMode === "week" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : `${dc ? "text-gray-300 hover:bg-gray-700" : "text-gray-700 hover:bg-gray-100"}`
                  }`}
                >
                  Week
                </button>
                <button
                  onClick={() => setViewMode("month")}
                  className={`px-3 sm:px-4 py-2 min-h-[44px] rounded-lg text-sm ${
                    viewMode === "month" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : `${dc ? "text-gray-300 hover:bg-gray-700" : "text-gray-700 hover:bg-gray-100"}`
                  }`}
                >
                  Month
                </button>
              </div>
            </div>
          </div>

          {/* Calendar View */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Events List */}
            <div className={`lg:col-span-3 ${card} rounded-xl shadow-sm p-4 md:p-6`}>
              <h3 className={`text-lg font-semibold mb-4 ${txt}`}>{t("agentCalendar.todaySchedule")}</h3>
              <div className="space-y-3">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-4 rounded-lg border-l-4 cursor-pointer transition-all ${
                      event.color === "orange"
                        ? `border-orange-500 ${dc ? "bg-orange-900/20 hover:bg-orange-900/30" : "bg-orange-50 hover:bg-orange-100"}`
                        : event.color === "blue"
                        ? `border-blue-500 ${dc ? "bg-blue-900/20 hover:bg-blue-900/30" : "bg-blue-50 hover:bg-blue-100"}`
                        : event.color === "green"
                        ? `border-green-500 ${dc ? "bg-green-900/20 hover:bg-green-900/30" : "bg-green-50 hover:bg-green-100"}`
                        : `border-purple-500 ${dc ? "bg-purple-900/20 hover:bg-purple-900/30" : "bg-purple-50 hover:bg-purple-100"}`
                    }`}
                  >
                    <div className="text-center min-w-[80px] hidden sm:block">
                      <p className={`text-sm font-semibold ${txt}`}>{event.time}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 sm:hidden mb-1">
                        <Clock className={`w-3.5 h-3.5 ${sub}`} />
                        <span className={`text-xs font-semibold ${txt}`}>{event.time}</span>
                      </div>
                      <h4 className={`font-semibold mb-1 text-sm sm:text-base ${txt}`}>{event.title}</h4>
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          event.color === "orange"
                            ? "bg-orange-200 text-orange-800"
                            : event.color === "blue"
                            ? "bg-blue-200 text-blue-800"
                            : event.color === "green"
                            ? "bg-green-200 text-green-800"
                            : "bg-purple-200 text-purple-800"
                        }`}
                      >
                        {event.type}
                      </span>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => handleReschedule(event)}
                        className={`flex-1 sm:flex-none px-3 py-2 min-h-[44px] text-sm border rounded-lg ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-600" : "border-gray-300 text-gray-700 hover:bg-white"}`}
                      >
                        Reschedule
                      </button>
                      <button
                        onClick={() => { setSelectedEvent(event); toast.info(`Viewing ${event.title}`); }}
                        className="flex-1 sm:flex-none px-3 py-2 min-h-[44px] text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mini Calendar */}
            <div className={`${card} rounded-xl shadow-sm p-4 md:p-6`}>
              <h3 className={`text-lg font-semibold mb-4 ${txt}`}>{t("agentCalendar.miniCalendar")}</h3>
              <div className="grid grid-cols-7 gap-1 mb-4">
                {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => (
                  <div key={idx} className={`text-center text-xs font-semibold py-2 ${sub}`}>
                    {day}
                  </div>
                ))}
                {Array.from({ length: 28 }, (_, i) => (
                  <div
                    key={i}
                    className={`aspect-square flex items-center justify-center text-sm rounded-lg cursor-pointer ${
                      i === 26
                        ? "bg-blue-600 text-white font-bold"
                        : i % 7 === 0 || i % 7 === 6
                        ? `${dc ? "text-gray-500 hover:bg-gray-700" : "text-gray-400 hover:bg-gray-100"}`
                        : `${dc ? "text-gray-300 hover:bg-gray-700" : "text-gray-700 hover:bg-gray-100"}`
                    }`}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>

              <div className="space-y-2 text-xs">
                <h4 className={`font-semibold mb-2 ${txt}`}>Event Types</h4>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded"></div>
                  <span className={dc ? "text-gray-300" : "text-gray-700"}>Medical</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span className={dc ? "text-gray-300" : "text-gray-700"}>Documents</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className={dc ? "text-gray-300" : "text-gray-700"}>Payment</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-500 rounded"></div>
                  <span className={dc ? "text-gray-300" : "text-gray-700"}>Meeting</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* New Event Modal */}
      {showNewEventModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className={`${dc ? "bg-gray-800" : "bg-white"} rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-2xl max-h-[95dvh] sm:max-h-[90vh] overflow-y-auto`}>
            <div className={`flex items-center justify-between p-4 sm:p-6 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
              <h2 className={`text-lg sm:text-xl font-bold ${txt}`}>{t("agentCalendar.createEvent")}</h2>
              <button onClick={() => setShowNewEventModal(false)} className={`p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}>
                <X className={`w-5 h-5 ${dc ? "text-gray-400" : "text-gray-600"}`} />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${dc ? "text-gray-300" : "text-gray-700"}`}>Event Title *</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className={`w-full px-3 py-3 sm:py-2 text-base sm:text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 ${dc ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`}
                  placeholder="E.g., Medical Appointment"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${dc ? "text-gray-300" : "text-gray-700"}`}>Event Type *</label>
                  <select
                    value={newEvent.type}
                    onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value })}
                    className={`w-full px-3 py-3 sm:py-2 text-base sm:text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 ${dc ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`}
                  >
                    <option value="medical">Medical</option>
                    <option value="documents">Documents</option>
                    <option value="payment">Payment</option>
                    <option value="meeting">Meeting</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${dc ? "text-gray-300" : "text-gray-700"}`}>Customer</label>
                  <input
                    type="text"
                    value={newEvent.customer}
                    onChange={(e) => setNewEvent({ ...newEvent, customer: e.target.value })}
                    className={`w-full px-3 py-3 sm:py-2 text-base sm:text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 ${dc ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`}
                    placeholder="Customer name"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${dc ? "text-gray-300" : "text-gray-700"}`}>Date *</label>
                  <input
                    type="date"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    className={`w-full px-3 py-3 sm:py-2 text-base sm:text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 ${dc ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${dc ? "text-gray-300" : "text-gray-700"}`}>Time *</label>
                  <input
                    type="time"
                    value={newEvent.time}
                    onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                    className={`w-full px-3 py-3 sm:py-2 text-base sm:text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 ${dc ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`}
                  />
                </div>
              </div>
            </div>
            <div className={`flex gap-3 justify-end p-4 sm:p-6 border-t ${dc ? "border-gray-700" : "border-gray-200"}`}>
              <button
                onClick={() => setShowNewEventModal(false)}
                className={`px-4 py-2.5 min-h-[44px] border rounded-lg ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEvent}
                className="px-4 py-2.5 min-h-[44px] bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Details Modal */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4"
          >
            <div className={`${dc ? "bg-gray-800" : "bg-white"} rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-2xl`}>
              <div className={`flex items-center justify-between p-4 sm:p-6 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <h2 className={`text-lg sm:text-xl font-bold ${txt}`}>{selectedEvent.title}</h2>
                <button onClick={() => setSelectedEvent(null)} className={`p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg ${dc ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}>
                  <X className={`w-5 h-5 ${dc ? "text-gray-400" : "text-gray-600"}`} />
                </button>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${dc ? "text-gray-300" : "text-gray-700"}`}>Event Type</label>
                  <p className={`text-sm ${dc ? "text-gray-300" : "text-gray-700"}`}>{selectedEvent.type}</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${dc ? "text-gray-300" : "text-gray-700"}`}>Customer</label>
                  <p className={`text-sm ${dc ? "text-gray-300" : "text-gray-700"}`}>{selectedEvent.customer}</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${dc ? "text-gray-300" : "text-gray-700"}`}>Date</label>
                  <p className={`text-sm ${dc ? "text-gray-300" : "text-gray-700"}`}>{selectedEvent.date}</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${dc ? "text-gray-300" : "text-gray-700"}`}>Time</label>
                  <p className={`text-sm ${dc ? "text-gray-300" : "text-gray-700"}`}>{selectedEvent.time}</p>
                </div>
              </div>
              <div className={`flex gap-3 justify-end p-4 sm:p-6 border-t ${dc ? "border-gray-700" : "border-gray-200"}`}>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className={`px-4 py-2.5 min-h-[44px] border rounded-lg ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                >
                  Close
                </button>
                <button
                  onClick={() => handleDeleteEvent(selectedEvent.id)}
                  className="px-4 py-2.5 min-h-[44px] bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete Event
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}