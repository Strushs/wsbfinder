"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react"; // Import Supabase client hook
import { useRouter } from "next/navigation"; // Import Next.js router

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("");
  const [error, setError] = useState<string | null>(null); // Add error state
  const supabase = useSupabaseClient(); // Get Supabase client
  const router = useRouter(); // Get router instance

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); // Clear previous errors

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
      {
        email,
        password,
      }
    );

    if (signUpError) {
      console.error("Sign up error:", signUpError);
      setError(signUpError.message);
      return;
    }

    // Check if sign up was successful and we have user data
    if (!signUpData.user) {
      console.error("Sign up succeeded but no user data returned.");
      setError(
        "An unexpected error occurred during sign up. Please try again."
      );
      return;
    }

    // Insert user details into the students table, including the user_id
    const { error: insertError } = await supabase.from("students").insert({
      user_id: signUpData.user.id, // Add this line
      name,
      email,
      field_of_study: fieldOfStudy,
      year_of_study: parseInt(yearOfStudy, 10), // Ensure year is stored as integer
    });

    if (insertError) {
      console.error("Error inserting into students table:", insertError);
      setError("Failed to save user details. Please try again.");
      return;
    }

    // Redirect immediately on successful sign-up
    router.push("/dashboard/match");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Link
          href="/"
          className="inline-flex items-center text-blue-400 hover:text-blue-300 mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to home
        </Link>

        <Card className="border-blue-500/20 bg-black">
          <CardHeader>
            <CardTitle className="text-2xl">Create your account</CardTitle>
            <CardDescription>
              Join WSB Finder to connect with fellow students
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-blue-500/20 bg-blue-950/20"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-blue-500/20 bg-blue-950/20"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fieldOfStudy">Field of Study</Label>
                <Select
                  value={fieldOfStudy}
                  onValueChange={setFieldOfStudy}
                  required
                >
                  <SelectTrigger className="border-blue-500/20 bg-blue-950/20">
                    <SelectValue placeholder="Select your field of study" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="computer-science">
                      Computer Science
                    </SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="engineering">Engineering</SelectItem>
                    <SelectItem value="medicine">Medicine</SelectItem>
                    <SelectItem value="arts">Arts</SelectItem>
                    <SelectItem value="law">Law</SelectItem>
                    <SelectItem value="science">Science</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="yearOfStudy">Year of Study</Label>
                <Select
                  value={yearOfStudy}
                  onValueChange={setYearOfStudy}
                  required
                >
                  <SelectTrigger className="border-blue-500/20 bg-blue-950/20">
                    <SelectValue placeholder="Select your year of study" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">First Year</SelectItem>
                    <SelectItem value="2">Second Year</SelectItem>
                    <SelectItem value="3">Third Year</SelectItem>
                    <SelectItem value="4">Fourth Year</SelectItem>
                    <SelectItem value="5">Fifth Year</SelectItem>
                    <SelectItem value="postgrad">Postgraduate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-blue-500/20 bg-blue-950/20"
                  required
                />
              </div>
              {error && (
                <p className="text-red-500 text-sm">{error}</p> // Display error message
              )}
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                className="w-full bg-blue-500 hover:bg-blue-600"
              >
                Create Account
              </Button>
              <p className="text-sm text-gray-400">
                Already have an account?{" "}
                <Link
                  href="/signin"
                  className="text-blue-400 hover:text-blue-300"
                >
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
