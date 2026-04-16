/**
 * SearchableCountrySelect — A searchable dropdown for country selection.
 * Shows popular Gulf destinations first, then full alphabetical list.
 * Supports dark mode, Urdu, and mobile-optimized touch targets.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Search, ChevronDown, X, Globe, Check } from "lucide-react";
import { ALL_COUNTRIES, POPULAR_COUNTRIES } from "../constants/countries";

interface Props {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  labelUrdu?: string;
  placeholder?: string;
  className?: string;
  darkMode?: boolean;
  isUrdu?: boolean;
  disabled?: boolean;
}

export function SearchableCountrySelect({
  value,
  onChange,
  label,
  labelUrdu,
  placeholder,
  className = "",
  darkMode: dc = false,
  isUrdu = false,
  disabled = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const filteredCountries = useCallback(() => {
    const term = search.toLowerCase().trim();
    if (!term) {
      // Show popular first, then rest
      const rest = ALL_COUNTRIES.filter(c => !POPULAR_COUNTRIES.includes(c));
      return { popular: POPULAR_COUNTRIES, rest };
    }
    const matchedPopular = POPULAR_COUNTRIES.filter(c => c.toLowerCase().includes(term));
    const matchedRest = ALL_COUNTRIES
      .filter(c => !POPULAR_COUNTRIES.includes(c))
      .filter(c => c.toLowerCase().includes(term));
    return { popular: matchedPopular, rest: matchedRest };
  }, [search]);

  const { popular, rest } = filteredCountries();
  const hasResults = popular.length > 0 || rest.length > 0;

  const handleSelect = (country: string) => {
    onChange(country);
    setIsOpen(false);
    setSearch("");
  };

  const inputBg = dc
    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
    : "bg-white border-gray-300 text-gray-900 placeholder-gray-400";

  const dropBg = dc ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const hoverBg = dc ? "hover:bg-gray-700" : "hover:bg-blue-50";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-500";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className={`block text-xs font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`}>
          {isUrdu ? labelUrdu || label : label}
        </label>
      )}

      {/* Selected Value Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 border rounded-xl text-sm transition-all ${inputBg} ${
          isOpen ? "ring-2 ring-blue-500 border-blue-500" : ""
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className="flex items-center gap-2 truncate">
          <Globe className="w-4 h-4 flex-shrink-0 text-blue-500" />
          <span className={value ? txt : sub}>
            {value || placeholder || (isUrdu ? "ملک منتخب کریں" : "Select country...")}
          </span>
        </span>
        <div className="flex items-center gap-1">
          {value && !disabled && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setSearch("");
              }}
              className={`p-0.5 rounded-full ${dc ? "hover:bg-gray-600" : "hover:bg-gray-200"} transition-colors`}
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""} ${sub}`} />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className={`absolute z-50 mt-1 w-full ${dropBg} border rounded-xl shadow-xl overflow-hidden`}>
          {/* Search Input */}
          <div className={`p-2 border-b ${dc ? "border-gray-700" : "border-gray-200"}`}>
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${sub}`} />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isUrdu ? "ملک تلاش کریں..." : "Search countries..."}
                className={`w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${inputBg}`}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full ${dc ? "hover:bg-gray-600" : "hover:bg-gray-200"}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Country List */}
          <div ref={listRef} className="max-h-60 overflow-y-auto overscroll-contain">
            {!hasResults ? (
              <div className={`px-4 py-6 text-center ${sub} text-sm`}>
                {isUrdu ? "کوئی ملک نہیں ملا" : "No countries found"}
              </div>
            ) : (
              <>
                {/* Popular Destinations */}
                {popular.length > 0 && (
                  <>
                    {!search && (
                      <div className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${sub} ${dc ? "bg-gray-900/50" : "bg-gray-50"}`}>
                        {isUrdu ? "مقبول مقامات" : "Popular Destinations"}
                      </div>
                    )}
                    {popular.map((country) => (
                      <button
                        key={country}
                        type="button"
                        onClick={() => handleSelect(country)}
                        className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between ${hoverBg} transition-colors ${
                          value === country ? (dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-700") : txt
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-base">🌍</span>
                          {country}
                        </span>
                        {value === country && <Check className="w-4 h-4 text-blue-500" />}
                      </button>
                    ))}
                  </>
                )}

                {/* All Countries */}
                {rest.length > 0 && (
                  <>
                    {!search && popular.length > 0 && (
                      <div className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${sub} ${dc ? "bg-gray-900/50" : "bg-gray-50"} border-t ${dc ? "border-gray-700" : "border-gray-200"}`}>
                        {isUrdu ? "تمام ممالک" : "All Countries"}
                      </div>
                    )}
                    {rest.map((country) => (
                      <button
                        key={country}
                        type="button"
                        onClick={() => handleSelect(country)}
                        className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between ${hoverBg} transition-colors ${
                          value === country ? (dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-700") : txt
                        }`}
                      >
                        <span>{country}</span>
                        {value === country && <Check className="w-4 h-4 text-blue-500" />}
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
