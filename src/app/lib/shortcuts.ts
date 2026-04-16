// Keyboard Shortcuts & Command Palette System
import { useEffect } from "react";
import { useNavigate } from "react-router";

export interface Shortcut {
  id: string;
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  description: string;
  category: "navigation" | "actions" | "search" | "general";
  handler: () => void;
}

export interface Command {
  id: string;
  title: string;
  description?: string;
  category: string;
  keywords: string[];
  icon?: string;
  action: () => void;
  shortcut?: string;
}

// Global keyboard shortcuts hook
export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      shortcuts.forEach((shortcut) => {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrlKey ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.altKey ? event.altKey : !event.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault();
          shortcut.handler();
        }
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}

// Command palette system
export class CommandPalette {
  private static commands: Command[] = [];

  static registerCommands(commands: Command[]) {
    this.commands = [...this.commands, ...commands];
  }

  static searchCommands(query: string): Command[] {
    const lowerQuery = query.toLowerCase();
    return this.commands
      .filter(
        (cmd) =>
          cmd.title.toLowerCase().includes(lowerQuery) ||
          cmd.description?.toLowerCase().includes(lowerQuery) ||
          cmd.keywords.some((kw) => kw.toLowerCase().includes(lowerQuery))
      )
      .slice(0, 10);
  }

  static getCommandsByCategory(category: string): Command[] {
    return this.commands.filter((cmd) => cmd.category === category);
  }

  static getAllCommands(): Command[] {
    return this.commands;
  }

  static clearCommands() {
    this.commands = [];
  }
}

// Generate default commands
export function generateDefaultCommands(navigate: any, prefix: string = "/admin"): Command[] {
  return [
    // Navigation Commands
    {
      id: "nav-dashboard",
      title: "Go to Dashboard",
      description: "Navigate to admin dashboard",
      category: "navigation",
      keywords: ["home", "main", "dashboard", "overview"],
      action: () => navigate(prefix),
      shortcut: "Ctrl+H",
    },
    {
      id: "nav-cases",
      title: "Go to Case Management",
      description: "View and manage all cases",
      category: "navigation",
      keywords: ["cases", "customers", "manage"],
      action: () => navigate(`${prefix}/cases`),
      shortcut: "Ctrl+K",
    },
    {
      id: "nav-team",
      title: "Go to Team Management",
      description: "Manage agents and team",
      category: "navigation",
      keywords: ["team", "agents", "staff", "employees"],
      action: () => navigate(`${prefix}/team`),
      shortcut: "Ctrl+T",
    },
    {
      id: "nav-reports",
      title: "Go to Reports",
      description: "View analytics and reports",
      category: "navigation",
      keywords: ["reports", "analytics", "insights", "statistics"],
      action: () => navigate(`${prefix}/reports`),
      shortcut: "Ctrl+R",
    },
    {
      id: "nav-bi",
      title: "Go to Business Intelligence",
      description: "Advanced analytics and predictions",
      category: "navigation",
      keywords: ["bi", "intelligence", "analytics", "predictions"],
      action: () => navigate(`${prefix}/business-intelligence`),
      shortcut: "Ctrl+B",
    },
    {
      id: "nav-attendance",
      title: "Go to Attendance",
      description: "Manage attendance and leaves",
      category: "navigation",
      keywords: ["attendance", "leaves", "time"],
      action: () => navigate(`${prefix}/attendance`),
      shortcut: "Ctrl+A",
    },
    {
      id: "nav-financials",
      title: "Go to Financials",
      description: "View financial transactions",
      category: "navigation",
      keywords: ["money", "payments", "finance", "revenue"],
      action: () => navigate(`${prefix}/financials`),
      shortcut: "Ctrl+F",
    },
    {
      id: "nav-settings",
      title: "Go to Settings",
      description: "Configure system settings",
      category: "navigation",
      keywords: ["settings", "config", "preferences"],
      action: () => navigate(`${prefix}/settings`),
      shortcut: "Ctrl+,",
    },

    // Action Commands
    {
      id: "action-new-case",
      title: "Create New Case",
      description: "Open new case creation modal",
      category: "actions",
      keywords: ["new", "create", "case", "customer", "add"],
      action: () => {
        // This will be implemented in the component
        const event = new CustomEvent("open-new-case-modal");
        window.dispatchEvent(event);
      },
      shortcut: "Ctrl+N",
    },
    {
      id: "action-add-agent",
      title: "Add New Agent",
      description: "Add a new team member",
      category: "actions",
      keywords: ["add", "agent", "employee", "staff", "new"],
      action: () => {
        const event = new CustomEvent("open-add-agent-modal");
        window.dispatchEvent(event);
      },
      shortcut: "Ctrl+Shift+A",
    },
    {
      id: "action-export-data",
      title: "Export Data",
      description: "Export current view to Excel/PDF",
      category: "actions",
      keywords: ["export", "download", "excel", "pdf", "save"],
      action: () => {
        const event = new CustomEvent("export-data");
        window.dispatchEvent(event);
      },
      shortcut: "Ctrl+E",
    },
    {
      id: "action-refresh",
      title: "Refresh Data",
      description: "Reload current page data",
      category: "actions",
      keywords: ["refresh", "reload", "update", "sync"],
      action: () => {
        window.location.reload();
      },
      shortcut: "Ctrl+Shift+R",
    },
    {
      id: "action-search",
      title: "Quick Search",
      description: "Search cases, customers, agents",
      category: "search",
      keywords: ["search", "find", "lookup", "query"],
      action: () => {
        const event = new CustomEvent("open-search");
        window.dispatchEvent(event);
      },
      shortcut: "Ctrl+/",
    },

    // General Commands
    {
      id: "general-help",
      title: "Show Keyboard Shortcuts",
      description: "Display all available shortcuts",
      category: "general",
      keywords: ["help", "shortcuts", "commands", "keys"],
      action: () => {
        const event = new CustomEvent("show-shortcuts");
        window.dispatchEvent(event);
      },
      shortcut: "Ctrl+?",
    },
    {
      id: "general-logout",
      title: "Logout",
      description: "Sign out of the application",
      category: "general",
      keywords: ["logout", "signout", "exit", "quit"],
      action: () => navigate("/"),
      shortcut: "Ctrl+Shift+Q",
    },
  ];
}

// Advanced search functionality
export interface SearchResult {
  id: string;
  type: "case" | "customer" | "agent" | "payment" | "document";
  title: string;
  subtitle: string;
  description?: string;
  metadata?: Record<string, any>;
  url: string;
  score: number;
}

export class AdvancedSearch {
  // Search across all data types
  static search(query: string, data: any): SearchResult[] {
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    // Search cases
    if (data.cases) {
      data.cases.forEach((caseItem: any) => {
        let score = 0;
        const searchText = `${caseItem.id} ${caseItem.customerName} ${caseItem.phone} ${caseItem.email} ${caseItem.passport} ${caseItem.country} ${caseItem.jobType}`.toLowerCase();

        if (searchText.includes(lowerQuery)) {
          // Exact ID match gets highest score
          if (caseItem.id.toLowerCase().includes(lowerQuery)) score += 100;
          // Name match
          if (caseItem.customerName.toLowerCase().includes(lowerQuery)) score += 50;
          // Phone match
          if (caseItem.phone.includes(query)) score += 40;
          // Email match
          if (caseItem.email.toLowerCase().includes(lowerQuery)) score += 30;
          // Other fields
          score += 10;

          results.push({
            id: caseItem.id,
            type: "case",
            title: `${caseItem.id} - ${caseItem.customerName}`,
            subtitle: `${caseItem.country} • ${caseItem.status}`,
            description: `${caseItem.jobType} • ${caseItem.phone}`,
            metadata: caseItem,
            url: `/admin/cases/${caseItem.id}`,
            score,
          });
        }
      });
    }

    // Search agents
    if (data.agents) {
      data.agents.forEach((agent: any) => {
        let score = 0;
        const searchText = `${agent.name} ${agent.email} ${agent.phone} ${agent.role}`.toLowerCase();

        if (searchText.includes(lowerQuery)) {
          if (agent.name.toLowerCase().includes(lowerQuery)) score += 50;
          if (agent.email.toLowerCase().includes(lowerQuery)) score += 30;
          if (agent.phone.includes(query)) score += 40;
          score += 10;

          results.push({
            id: agent.id,
            type: "agent",
            title: agent.name,
            subtitle: agent.role,
            description: `${agent.email} • ${agent.phone}`,
            metadata: agent,
            url: `/admin/team`,
            score,
          });
        }
      });
    }

    // Sort by score (highest first)
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, 20);
  }

  // Fuzzy search (for typos)
  static fuzzySearch(query: string, data: any): SearchResult[] {
    // Simple implementation - can be enhanced with Levenshtein distance
    const results = this.search(query, data);
    
    // Add partial matches
    const partialQuery = query.split(" ").filter(w => w.length > 2);
    partialQuery.forEach(part => {
      const partialResults = this.search(part, data);
      partialResults.forEach(result => {
        if (!results.find(r => r.id === result.id)) {
          result.score *= 0.5; // Reduce score for partial matches
          results.push(result);
        }
      });
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 20);
  }

  // Search suggestions based on recent activity
  static getSearchSuggestions(recentSearches: string[]): string[] {
    const suggestions = [
      "EMR-2024-",
      "pending cases",
      "overdue payments",
      "active agents",
      "saudi arabia",
      "completed this month",
      "urgent priority",
      "documents pending",
    ];

    return [...recentSearches.slice(0, 3), ...suggestions].slice(0, 8);
  }
}

// Autocomplete system
export interface AutocompleteOption {
  value: string;
  label: string;
  category?: string;
  metadata?: any;
}

export class AutocompleteService {
  static getCountryOptions(): AutocompleteOption[] {
    return [
      { value: "saudi-arabia", label: "Saudi Arabia", category: "countries" },
      { value: "uae", label: "United Arab Emirates", category: "countries" },
      { value: "qatar", label: "Qatar", category: "countries" },
      { value: "kuwait", label: "Kuwait", category: "countries" },
      { value: "oman", label: "Oman", category: "countries" },
      { value: "bahrain", label: "Bahrain", category: "countries" },
    ];
  }

  static getJobTypeOptions(): AutocompleteOption[] {
    return [
      { value: "driver", label: "Driver", category: "jobs" },
      { value: "construction", label: "Construction Worker", category: "jobs" },
      { value: "hospitality", label: "Hospitality", category: "jobs" },
      { value: "healthcare", label: "Healthcare", category: "jobs" },
      { value: "security", label: "Security Guard", category: "jobs" },
      { value: "factory", label: "Factory Worker", category: "jobs" },
      { value: "cleaner", label: "Cleaner", category: "jobs" },
    ];
  }

  static getAgentOptions(agents: any[]): AutocompleteOption[] {
    return agents.map(agent => ({
      value: agent.id,
      label: agent.name,
      category: "agents",
      metadata: agent,
    }));
  }

  static getStatusOptions(): AutocompleteOption[] {
    return [
      { value: "document_collection", label: "Document Collection", category: "status" },
      { value: "selection_call", label: "Selection Call", category: "status" },
      { value: "medical_token", label: "Medical Token", category: "status" },
      { value: "check_medical", label: "Check Medical", category: "status" },
      { value: "biometric", label: "Biometric", category: "status" },
      { value: "payment_confirmation", label: "Payment Confirmation", category: "status" },
      { value: "original_documents", label: "Original Documents", category: "status" },
      { value: "submitted_to_manager", label: "Submitted to Manager", category: "status" },
      { value: "approved", label: "Approved", category: "status" },
      { value: "remaining_amount", label: "Remaining Amount", category: "status" },
      { value: "ticket_booking", label: "Ticket Booking", category: "status" },
      { value: "completed", label: "Completed", category: "status" },
      { value: "rejected", label: "Rejected", category: "status" },
    ];
  }
}