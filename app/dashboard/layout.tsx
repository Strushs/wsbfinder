"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation"; // Import useRouter
import { MessageSquare, User, Users, LogOut, Menu, X } from "lucide-react"; // Import Menu and X icons
import { cn } from "@/lib/utils";
import { useSupabaseClient } from "@supabase/auth-helpers-react"; // Import Supabase client hook
import { Button } from "@/components/ui/button"; // Import Button component

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter(); // Get router instance
  const supabase = useSupabaseClient(); // Get Supabase client
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Default to closed on small screens

  const navigation = [
    { name: "Match", href: "/dashboard/match", icon: Users },
    { name: "Chat", href: "/dashboard/chat", icon: MessageSquare },
    { name: "Profile", href: "/dashboard/profile", icon: User },
  ];

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error);
      // Optionally display an error message to the user
    } else {
      router.push("/"); // Redirect to main page
      router.refresh(); // Optional: Force refresh to clear state
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-black to-purple-900">
      {/* Header for mobile toggle */}
      <div className="md:hidden flex justify-between items-center p-4 bg-blue-950/20 border-b border-blue-500/20">
        <h2 className="text-xl font-bold text-blue-400">WSB Finder</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          {isSidebarOpen ? (
            <X className="h-6 w-6 text-blue-400" />
          ) : (
            <Menu className="h-6 w-6 text-blue-400" />
          )}
        </Button>
      </div>

      <div className="flex h-screen">
        {/* Sidebar */}
        {/* Add conditional classes for collapsing */}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-30 w-64 bg-blue-950/20 border-r border-blue-500/20 flex flex-col transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full" // Slide in/out on small screens
          )}
        >
          {/* Sidebar Header (hidden on mobile, shown in main header) */}
          <div className="hidden md:flex h-16 items-center px-6">
            <h2 className="text-xl font-bold text-blue-400">WSB Finder</h2>
          </div>
          {/* Navigation */}
          <nav className="flex-1 px-4 space-y-2 mt-4 md:mt-0">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsSidebarOpen(false)} // Close sidebar on navigation click (mobile)
                  className={cn(
                    "flex items-center gap-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-500/20 text-blue-400"
                      : "text-gray-400 hover:bg-blue-500/10 hover:text-blue-300"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          {/* Sign Out Button */}
          <div className="p-4">
            <Button
              onClick={handleSignOut}
              variant="ghost"
              className="w-full justify-start flex items-center gap-x-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-blue-500/10 hover:text-blue-300 transition-colors"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Overlay for mobile */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/50 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          ></div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
