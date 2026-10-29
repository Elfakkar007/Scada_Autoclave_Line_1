"use client";

import { useState, useRef, useEffect, useMemo } from "react";

/**
 * SearchableCombobox — Dropdown pencarian yang juga mendukung input teks manual.
 *
 * Props:
 *   value        string                       — Nilai teks saat ini
 *   onChange     (val: string) => void        — Handler perubahan teks
 *   options      Array<string | { label, value }> — Daftar opsi master
 *   placeholder  string                       — Placeholder input
 *   disabled     boolean                      — Mode disabled
 *   className    string                       — Kelas styling tambahan
 */
export default function SearchableCombobox({
    value = "",
    onChange,
    options = [],
    placeholder = "Pilih atau ketik...",
    disabled = false,
    className = "",
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    // Normalisasi opsi menjadi array { label: string, value: string }
    const normalizedOptions = useMemo(() => {
        return options.map((opt) => {
            if (typeof opt === "string") {
                return { label: opt, value: opt };
            }
            return {
                label: opt.label ?? opt.name ?? opt.spec ?? String(opt.value ?? ""),
                value: opt.value ?? opt.name ?? opt.spec ?? opt.label ?? "",
            };
        });
    }, [options]);

    // Filter opsi berdasarkan teks yang diketik (case-insensitive)
    const filteredOptions = useMemo(() => {
        const query = (value ?? "").trim().toLowerCase();
        if (!query) return normalizedOptions;
        return normalizedOptions.filter((opt) =>
            opt.label.toLowerCase().includes(query)
        );
    }, [normalizedOptions, value]);

    // Tutup dropdown saat klik di luar komponen
    useEffect(() => {
        function handleClickOutside(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Scroll otomatis ke item yang di-highlight saat navigasi keyboard
    useEffect(() => {
        if (isOpen && highlightedIndex >= 0 && listRef.current) {
            const el = listRef.current.children[highlightedIndex];
            if (el) {
                el.scrollIntoView({ block: "nearest" });
            }
        }
    }, [highlightedIndex, isOpen]);

    function handleSelect(optValue) {
        onChange?.(optValue);
        setIsOpen(false);
        setHighlightedIndex(-1);
    }

    function handleKeyDown(e) {
        if (disabled) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!isOpen) {
                setIsOpen(true);
                setHighlightedIndex(0);
            } else {
                setHighlightedIndex((prev) =>
                    prev < filteredOptions.length - 1 ? prev + 1 : 0
                );
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (!isOpen) {
                setIsOpen(true);
                setHighlightedIndex(filteredOptions.length - 1);
            } else {
                setHighlightedIndex((prev) =>
                    prev > 0 ? prev - 1 : filteredOptions.length - 1
                );
            }
        } else if (e.key === "Enter") {
            if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
                e.preventDefault();
                handleSelect(filteredOptions[highlightedIndex].value);
            } else {
                setIsOpen(false);
            }
        } else if (e.key === "Escape") {
            setIsOpen(false);
        }
    }

    return (
        <div ref={containerRef} className={`relative w-full ${className}`}>
            <div className="relative flex items-center">
                <input
                    ref={inputRef}
                    type="text"
                    disabled={disabled}
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => {
                        onChange?.(e.target.value);
                        if (!isOpen) setIsOpen(true);
                        setHighlightedIndex(-1);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-white border border-[#D8DEDC] rounded-[3px] pl-2.5 pr-8 py-1.5 text-sm text-[#1E2A2E] focus:outline-none focus:border-[#1C6E74] transition-colors placeholder:text-[#B8C0BE]"
                />

                {/* Tombol toggle panah dropdown di sebelah kanan */}
                <button
                    type="button"
                    tabIndex={-1}
                    disabled={disabled}
                    onClick={() => {
                        setIsOpen((prev) => !prev);
                        if (!isOpen) inputRef.current?.focus();
                    }}
                    className="absolute right-1.5 p-1 text-[#5C6B6A] hover:text-[#1E2A2E] transition-colors"
                    aria-label="Toggle dropdown"
                >
                    <svg
                        className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </div>

            {/* Menu Pop-over Opsi */}
            {isOpen && !disabled && (
                <div
                    ref={listRef}
                    className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#D8DEDC] rounded-[3px] shadow-lg max-h-52 overflow-y-auto z-50 py-1"
                >
                    {filteredOptions.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-[#5C6B6A] italic bg-[#F9FAFB]">
                            {value.trim()
                                ? `"${value}" tidak ada di master (tekan Enter untuk memakai nilai ini)`
                                : "Tidak ada opsi"}
                        </div>
                    ) : (
                        filteredOptions.map((opt, idx) => {
                            const isSelected = opt.value === value;
                            const isHighlighted = idx === highlightedIndex;
                            return (
                                <div
                                    key={`${opt.value}-${idx}`}
                                    onMouseDown={(e) => {
                                        // Pakai onMouseDown agar tidak kalah cepat dari blur input
                                        e.preventDefault();
                                        handleSelect(opt.value);
                                    }}
                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                    className={`px-3 py-1.5 text-xs cursor-pointer transition-colors flex items-center justify-between ${
                                        isHighlighted
                                            ? "bg-[#F0FDF4] text-[#1C6E74] font-medium"
                                            : isSelected
                                                ? "bg-[#E6F4F1] text-[#1C6E74] font-semibold"
                                                : "text-[#1E2A2E] hover:bg-[#F5F7F6]"
                                    }`}
                                >
                                    <span className="truncate">{opt.label}</span>
                                    {isSelected && (
                                        <svg className="w-3.5 h-3.5 text-[#1C6E74] shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}

