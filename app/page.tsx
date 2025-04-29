"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, Users } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <motion.div 
        initial="hidden"
        animate="visible"
        className="min-h-screen flex flex-col items-center justify-center p-4 relative"
      >
        <div className="max-w-3xl w-full text-center space-y-8">
          <motion.div 
            variants={fadeIn}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            <div className="flex justify-center">
              <motion.div 
                className="bg-blue-900/30 p-4 rounded-full"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Users className="w-12 h-12 text-blue-400" />
              </motion.div>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              WSB Finder
            </h1>
            <p className="text-lg md:text-xl text-gray-400">
              Connect with fellow students. Match. Study. Succeed together.
            </p>
          </motion.div>

          <motion.div 
            variants={fadeIn}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/signin">
              <Button
                variant="default"
                size="lg"
                className="bg-blue-500 text-white hover:bg-blue-600 transition-colors w-full sm:w-auto"
              >
                Sign In
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/signup">
              <Button
                variant="outline"
                size="lg"
                className="border-blue-500/20 hover:bg-blue-500/10 text-blue-400 transition-colors w-full sm:w-auto"
              >
                Create Account
              </Button>
            </Link>
          </motion.div>
        </div>

        <motion.div 
          variants={fadeIn}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="absolute bottom-12 left-0 right-0 text-center"
        >
          <p className="text-sm text-gray-500">
            Join thousands of students finding their perfect study partners
          </p>
        </motion.div>
      </motion.div>

      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-blue-900/20 to-transparent" />
    </main>
  );
}