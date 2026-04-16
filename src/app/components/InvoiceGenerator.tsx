import React from "react";
import { Case } from "../lib/mockData";
import { Download, Printer, X } from "lucide-react";
import { useTheme } from "../lib/ThemeContext";

interface InvoiceGeneratorProps {
  caseData: Case;
  onClose: () => void;
}

export function InvoiceGenerator({ caseData, onClose }: InvoiceGeneratorProps) {
  const { darkMode, isUrdu } = useTheme();

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    alert("Invoice download functionality would be implemented here");
  };

  const invoiceDate = new Date().toLocaleDateString("en-GB");
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB");

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`${darkMode ? "bg-gray-800" : "bg-white"} rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto`}>
        {/* Header Actions */}
        <div className={`flex items-center justify-between p-4 border-b ${darkMode ? "border-gray-700" : "border-gray-200"} print:hidden`}>
          <h2 className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>
            {isUrdu ? "رسید" : "Invoice"}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${darkMode ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
            >
              <Printer className="w-4 h-4" />
              {isUrdu ? "پرنٹ" : "Print"}
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              {isUrdu ? "ڈاؤن لوڈ" : "Download"}
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
            >
              <X className={`w-5 h-5 ${darkMode ? "text-gray-400" : "text-gray-600"}`} />
            </button>
          </div>
        </div>

        {/* Invoice Content */}
        <div className="p-8">
          {/* Company Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold text-blue-600">Emerald Visa Consultancy</h1>
              <p className={`text-sm mt-2 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                Professional Visa & Immigration Services
              </p>
              <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                📍 Main Office, Islamabad, Pakistan
              </p>
              <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                📞 +92-XXX-XXXXXXX | ✉ info@emeraldvisa.pk
              </p>
            </div>
            <div className="text-right">
              <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>Invoice #</p>
              <p className={`text-2xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>INV-{caseData.id}</p>
              <p className={`text-xs mt-2 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>Date: {invoiceDate}</p>
              <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}>Due: {dueDate}</p>
            </div>
          </div>

          {/* Bill To */}
          <div className="mb-8">
            <p className={`text-xs font-semibold mb-2 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>BILL TO:</p>
            <p className={`text-lg font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>{caseData.customerName}</p>
            <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>📞 {caseData.phone}</p>
            <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>📧 {caseData.email || "N/A"}</p>
            <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>CNIC: {caseData.cnic || "N/A"}</p>
          </div>

          {/* Invoice Details */}
          <table className="w-full mb-8">
            <thead>
              <tr className={`border-b-2 ${darkMode ? "border-gray-700" : "border-gray-300"}`}>
                <th className={`text-left py-3 px-2 text-sm font-semibold ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  Description
                </th>
                <th className={`text-center py-3 px-2 text-sm font-semibold ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  Qty
                </th>
                <th className={`text-right py-3 px-2 text-sm font-semibold ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className={`border-b ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                <td className={`py-3 px-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  <p className="font-medium">Visa Processing Fee</p>
                  <p className="text-xs text-gray-500">
                    {caseData.country} - {caseData.jobType}
                  </p>
                </td>
                <td className={`text-center py-3 px-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>1</td>
                <td className={`text-right py-3 px-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  PKR {caseData.totalFee.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-64">
              <div className="flex justify-between py-2">
                <span className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>Subtotal:</span>
                <span className={`text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  PKR {caseData.totalFee.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>Paid Amount:</span>
                <span className="text-sm font-medium text-green-600">
                  PKR {caseData.paidAmount.toLocaleString()}
                </span>
              </div>
              <div className={`flex justify-between py-3 border-t ${darkMode ? "border-gray-700" : "border-gray-300"}`}>
                <span className={`font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>Balance Due:</span>
                <span className={`font-bold text-lg ${caseData.totalFee - caseData.paidAmount > 0 ? "text-red-600" : "text-green-600"}`}>
                  PKR {(caseData.totalFee - caseData.paidAmount).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className={`p-4 rounded-lg ${darkMode ? "bg-gray-700/50" : "bg-gray-50"} mb-8`}>
            <p className={`text-sm font-semibold mb-2 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
              Payment Information:
            </p>
            <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
              Bank: Meezan Bank | Account: 01234567890 | Branch: I-9 Islamabad
            </p>
            <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
              EasyPaisa/JazzCash: 03XX-XXXXXXX
            </p>
          </div>

          {/* Footer */}
          <div className="text-center">
            <p className={`text-xs ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
              Thank you for choosing Emerald Visa Consultancy Service!
            </p>
            <p className={`text-xs mt-1 ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
              For queries, contact us at info@emeraldvisa.pk
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}