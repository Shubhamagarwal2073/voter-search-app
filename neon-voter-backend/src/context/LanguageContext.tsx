"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Language = "en" | "hi";

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  t: (enText: string, hiText: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");

  // Optional: load from localStorage if we want persistence
  useEffect(() => {
    const saved = localStorage.getItem("voter-lang");
    if (saved === "hi") {
      setLanguage("hi");
    }
  }, []);

  const toggleLanguage = () => {
    setLanguage((prev) => {
      const next = prev === "en" ? "hi" : "en";
      localStorage.setItem("voter-lang", next);
      return next;
    });
  };

  // Helper function to pick the translated string
  const t = (enText: string, hiText: string) => {
    return language === "hi" ? hiText : enText;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
