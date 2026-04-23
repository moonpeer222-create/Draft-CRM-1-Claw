const fs = require('fs');

const state = fs.readFileSync('new_case_state.txt', 'utf8');
const logic = fs.readFileSync('new_case_logic.txt', 'utf8');
const jsx = fs.readFileSync('new_case_jsx.txt', 'utf8');

const content = `import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Home, Briefcase, GraduationCap, Heart, CheckCircle2, CloudUpload, ShieldCheck, X, FileText, Image, File as FileIcon, Trash2, Paperclip } from 'lucide-react';
import { toast } from '../../lib/toast';
import { useTheme } from '../../lib/ThemeContext';
import { createCase } from '../../lib/caseApi';
import { NotificationService } from '../../lib/notifications';
import { AuditLogService } from '../../lib/auditLog';
import { DataSyncService } from '../../lib/dataSync';
import { modalVariants } from '../../lib/animations';
import { SearchableCountrySelect } from '../../components/SearchableCountrySelect';
import { Case } from '../../lib/mockData';

export function NewCaseModal({ isOpen, onClose, adminName, onSuccess }) {
  const { darkMode, isUrdu, fontClass } = useTheme();
  const dc = darkMode;
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";
  const inputCls = \`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all \${dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"}\`;
  const labelCls = \`block text-sm font-medium mb-1.5 \${dc ? "text-gray-300" : "text-gray-700"}\`;
  const [isLoading, setIsLoading] = useState(false);

${state}

${logic.replace(/setShowNewCaseModal\(false\)/g, 'onClose()').replace(/loadCases\(\)/g, 'onSuccess()')}

  if (!isOpen) return null;

  return (
${jsx.replace(/showNewCaseModal/g, 'isOpen').replace(/setShowNewCaseModal\(false\)/g, 'onClose()')}
  );
}
`;

fs.writeFileSync('src/app/components/NewCaseModal.tsx', content);
console.log('NewCaseModal.tsx created successfully');

