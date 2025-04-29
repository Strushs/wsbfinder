"use client"; // Add this line

import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { useState } from "react"; // Add this import
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs"; // Add this import
import { SessionContextProvider, Session } from "@supabase/auth-helpers-react"; // Add this import
// Assuming you might create a types_db.ts for database types later
// import { Database } from '@/lib/types_db';

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: // initialSession, // If using server-side session fetching later
{
  children: React.ReactNode;
  // initialSession: Session | null; // If using server-side session fetching later
}) {
  // Create a new supabase client for each session
  const [supabaseClient] = useState(
    () => createPagesBrowserClient()
    // { supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!, supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! } // Use environment variables
  );

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={inter.className}>
        <SessionContextProvider
          supabaseClient={supabaseClient}
          // initialSession={initialSession} // Pass initial session if fetched server-side
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </SessionContextProvider>
      </body>
    </html>
  );
}
