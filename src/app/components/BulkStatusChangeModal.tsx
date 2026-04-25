import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from '../lib/toast';
import { useTheme } from '../lib/ThemeContext';
import { CRMDataStore, getStageLabel, LEAD_PIPELINE_STAGES, VISA_PIPELINE_STAGES } from '../lib/mockData';
import { Case } from '../lib/mockData';

interface BulkStatusChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: Set<string>;
  onSuccess: () => void;
}

export function BulkStatusChangeModal({ isOpen, onClose, selectedIds, onSuccess }: BulkStatusChangeModalProps) {
  const { darkMode, isUrdu } = useTheme();
  const dc = darkMode;
  const txt = dc ? "text-white" : "text-gray-900";
  
  const [bulkTargetStatus, setBulkTargetStatus] = useState<Case["status"]>("document_collection");

  if (!isOpen) return null;

  const handleApply = async () => {
    const ids = Array.from(selectedIds);
    let updated = 0;
    const lt = toast.loading(`Updating ${ids.length} cases...`);
    
    for (const cid of ids) {
      const result = CRMDataStore.updateCaseStatus(cid, bulkTargetStatus);
      if (result) updated++;
    }
    
    toast.dismiss(lt);
    toast.success(`${updated} cases updated to ${getStageLabel(bulkTargetStatus)}`);
    onSuccess();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-2xl shadow-2xl ${dc ? "bg-gray-800" : "bg-white"} overflow-hidden`}
          >
            <div className="bg-gradient-to-r from-blue-600 to-indigo-500 px-6 py-4 text-white">
              <h3 className="text-lg font-bold">Bulk Status Change</h3>
              <p className="text-sm text-white/80">{selectedIds.size} cases selected</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${txt}`}>New Status</label>
                <select
                  value={bulkTargetStatus}
                  onChange={(e) => setBulkTargetStatus(e.target.value as Case["status"])}
                  className={`w-full px-4 py-3 rounded-xl border ${dc ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"}`}
                >
                  <optgroup label="Lead Pipeline">
                    {LEAD_PIPELINE_STAGES.filter(s => s.stageNumber > 0).map(s => (
                      <option key={s.key} value={s.key}>{s.label} ({isUrdu ? s.labelUrdu : `Stage ${s.stageNumber}`})</option>
                    ))}
                  </optgroup>
                  <optgroup label="Visa Pipeline">
                    {VISA_PIPELINE_STAGES.filter(s => s.stageNumber > 0).map(s => (
                      <option key={s.key} value={s.key}>{s.label} ({isUrdu ? s.labelUrdu : `Stage ${s.stageNumber}`})</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleApply}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold text-sm"
                >
                  Apply to {selectedIds.size} Cases
                </button>
                <button
                  onClick={onClose}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium ${dc ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
