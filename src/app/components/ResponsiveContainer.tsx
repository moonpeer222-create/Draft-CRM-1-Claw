import { ReactNode } from "react";
import { useTheme } from "../lib/ThemeContext";

interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function ResponsiveContainer({ children, className = "", noPadding = false }: ResponsiveContainerProps) {
  const { darkMode } = useTheme();

  return (
    <div
      className={`w-full min-h-screen min-h-[100dvh] ${!noPadding ? "pb-24 lg:pb-0" : ""} ${
        darkMode ? "bg-gray-900" : "bg-gray-50"
      } ${className}`}
      style={{ paddingBottom: noPadding ? undefined : "calc(env(safe-area-inset-bottom, 0px) + 5rem)" }}
    >
      {children}
    </div>
  );
}

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className = "" }: PageContainerProps) {
  return (
    <div className={`px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 md:py-6 lg:py-8 ${className}`}>
      {children}
    </div>
  );
}

interface CardGridProps {
  children: ReactNode;
  cols?: 1 | 2 | 3 | 4;
  className?: string;
}

export function CardGrid({ children, cols = 4, className = "" }: CardGridProps) {
  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={`grid ${gridCols[cols]} gap-4 sm:gap-6 ${className}`}>
      {children}
    </div>
  );
}

interface ResponsiveTableProps {
  headers: string[];
  rows: ReactNode[][];
  mobileCardRenderer?: (row: ReactNode[], index: number) => ReactNode;
  className?: string;
}

export function ResponsiveTable({ headers, rows, mobileCardRenderer, className = "" }: ResponsiveTableProps) {
  const { darkMode } = useTheme();

  return (
    <>
      {/* Desktop Table View */}
      <div className={`hidden lg:block overflow-x-auto ${className}`}>
        <table className="w-full">
          <thead>
            <tr className={`border-b ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
              {headers.map((header, idx) => (
                <th
                  key={idx}
                  className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                    darkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className={`border-b ${
                  darkMode ? "border-gray-800 hover:bg-gray-800/50" : "border-gray-100 hover:bg-gray-50"
                } transition-colors`}
              >
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx} className="px-4 py-4">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {mobileCardRenderer
          ? rows.map((row, idx) => mobileCardRenderer(row, idx))
          : rows.map((row, rowIdx) => (
              <div
                key={rowIdx}
                className={`p-4 rounded-xl border ${
                  darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                }`}
              >
                {row.map((cell, cellIdx) => (
                  <div key={cellIdx} className="mb-2 last:mb-0">
                    <div className={`text-xs font-semibold mb-1 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                      {headers[cellIdx]}
                    </div>
                    <div>{cell}</div>
                  </div>
                ))}
              </div>
            ))}
      </div>
    </>
  );
}

interface ResponsiveModalProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  fullScreenOnMobile?: boolean;
}

export function ResponsiveModal({
  children,
  isOpen,
  onClose,
  title,
  fullScreenOnMobile = true,
}: ResponsiveModalProps) {
  const { darkMode, isUrdu } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full h-[95vh] sm:h-auto sm:max-w-2xl sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl ${darkMode ? "bg-gray-900" : "bg-white"} overflow-hidden shadow-2xl`}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {/* Drag handle - mobile only */}
        <div className="w-full flex justify-center py-2 sm:hidden" onClick={onClose}>
          <div className={`w-12 h-1.5 rounded-full ${darkMode ? "bg-gray-600" : "bg-gray-300"}`} />
        </div>
        {title && (
          <div
            className={`px-4 sm:px-6 py-4 border-b ${
              darkMode ? "border-gray-800" : "border-gray-200"
            }`}
          >
            <h2 className={`text-lg font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
              {title}
            </h2>
          </div>
        )}
        <div className="overflow-y-auto overscroll-contain max-h-[calc(95vh-64px)] sm:max-h-[calc(90vh-64px)]">
          {children}
        </div>
      </div>
    </div>
  );
}