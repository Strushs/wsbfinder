"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Import Avatar components
import { X, Heart, User } from "lucide-react"; // Import User icon
import { useEffect, useState } from "react";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { calculateCompatibility, StudentProfile } from "@/lib/compatibility"; // Import the function and interface

// Extend Student interface to include compatibility score
interface PotentialMatch extends StudentProfile {
  compatibilityScore: number;
}

export default function MatchPage() {
  const supabase = useSupabaseClient();
  const [potentialMatches, setPotentialMatches] = useState<PotentialMatch[]>(
    []
  ); // State holds PotentialMatch objects
  const [currentUserProfile, setCurrentUserProfile] =
    useState<StudentProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Loading state

  useEffect(() => {
    const fetchCurrentUserAndMatches = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // 1. Get the current user session and UUID
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session?.user) {
          setError("User not logged in.");
          setIsLoading(false);
          return;
        }
        const userUuid = session.user.id;

        // 2. Fetch current user's profile including avatar_url
        const { data: currentUserData, error: currentUserError } =
          await supabase
            .from("students")
            .select("user_id, name, field_of_study, year_of_study, avatar_url") // Add avatar_url
            .eq("user_id", userUuid)
            .maybeSingle(); // Use maybeSingle() instead of single()

        // Handle potential error fetching profile
        if (currentUserError) {
          // Log the specific error but don't necessarily throw,
          // as maybeSingle() returns null for no rows, not an error.
          // Throw only if it's not the expected "no rows" or "multiple rows" error handled by maybeSingle
          if (currentUserError.code !== "PGRST116") {
            // PGRST116: "multiple (or no) rows returned"
            throw currentUserError;
          }
          // If it IS PGRST116 and data is null, it means no profile found, which we handle next.
          // If it IS PGRST116 and data is NOT null, it means multiple rows (data integrity issue), maybeSingle would have thrown.
        }

        // Handle case where profile doesn't exist
        if (!currentUserData) {
          setError(
            "Your student profile could not be found. Please complete your profile first."
          );
          setIsLoading(false);
          // Clear potential matches and profile state if profile is missing
          setPotentialMatches([]);
          setCurrentUserProfile(null);
          return; // Stop execution if profile is missing
        }
        setCurrentUserProfile(currentUserData); // Profile found, set it

        // 3. Fetch existing matches AND likes for the current user
        const { data: existingMatchesData, error: existingMatchesError } =
          await supabase
            .from("matches")
            .select("student1_user_id, student2_user_id")
            .or(
              `student1_user_id.eq.${userUuid},student2_user_id.eq.${userUuid}`
            );
        if (existingMatchesError) throw existingMatchesError;

        const { data: existingLikesData, error: existingLikesError } =
          await supabase
            .from("likes")
            .select("liked_user_id") // Select users the current user has liked
            .eq("liker_user_id", userUuid);
        if (existingLikesError) throw existingLikesError;

        // Create a set of user IDs the current user has already matched with or liked
        const excludedUserIds = new Set<string>();
        (existingMatchesData || []).forEach((match) => {
          if (match.student1_user_id !== userUuid) {
            excludedUserIds.add(match.student1_user_id);
          }
          if (match.student2_user_id !== userUuid) {
            excludedUserIds.add(match.student2_user_id);
          }
        });
        (existingLikesData || []).forEach((like) => {
          excludedUserIds.add(like.liked_user_id);
        });

        // 4. Fetch potential matches including avatar_url
        let query = supabase
          .from("students")
          .select("user_id, name, field_of_study, year_of_study, avatar_url") // Add avatar_url
          .neq("user_id", userUuid); // Exclude self

        // Add exclusion for already matched or liked users if any exist
        if (excludedUserIds.size > 0) {
          query = query.not(
            "user_id",
            "in",
            `(${Array.from(excludedUserIds).join(",")})`
          );
        }

        const { data: otherStudentsData, error: matchesError } = await query;

        if (matchesError) throw matchesError;

        // 5. Calculate compatibility and sort
        const scoredMatches = (otherStudentsData || [])
          .map(
            (student: StudentProfile): PotentialMatch => ({
              // Explicitly type the student and return value
              ...student,
              compatibilityScore: calculateCompatibility(
                currentUserData, // Current user's profile
                student // Potential match's profile
              ),
            })
          )
          .sort((a, b) => b.compatibilityScore - a.compatibilityScore); // Sort descending by score

        setPotentialMatches(scoredMatches);
      } catch (err: any) {
        setError(
          `Failed to load data: ${err.message || "An unknown error occurred."}`
        );
        // Clear matches and profile on error
        setPotentialMatches([]);
        setCurrentUserProfile(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCurrentUserAndMatches();
  }, [supabase]);

  const handleLike = async (likedUserUuid: string) => {
    // Renamed from handleMatch
    if (!currentUserProfile?.user_id) {
      setError("Current user UUID not found. Cannot process like.");
      return;
    }
    const likerUserId = currentUserProfile.user_id;

    try {
      // 1. Insert the like into the 'likes' table
      const { error: likeInsertError } = await supabase.from("likes").insert({
        liker_user_id: likerUserId,
        liked_user_id: likedUserUuid,
      });

      // Handle potential unique constraint violation gracefully (user already liked this person)
      if (likeInsertError && likeInsertError.code !== "23505") {
        // 23505 is unique_violation
        throw likeInsertError;
      }

      // 2. Check if the liked user has also liked the current user (mutual like)
      const { data: mutualLikeData, error: mutualLikeError } = await supabase
        .from("likes")
        .select("id") // Just need to know if a row exists
        .eq("liker_user_id", likedUserUuid)
        .eq("liked_user_id", likerUserId)
        .maybeSingle(); // Check if the other user liked back

      if (mutualLikeError) throw mutualLikeError;

      // 3. If it's a mutual like, insert into the 'matches' table
      if (mutualLikeData) {
        console.log(
          `Mutual like detected between ${likerUserId} and ${likedUserUuid}. Creating match.`
        );
        const { error: matchInsertError } = await supabase
          .from("matches")
          .insert({
            student1_user_id: likerUserId, // Ensure consistent order or handle potential duplicates
            student2_user_id: likedUserUuid,
          });

        // Handle potential unique constraint violation for matches
        if (matchInsertError && matchInsertError.code !== "23505") {
          console.error("Failed to insert match:", matchInsertError);
          throw new Error(
            `Failed to create match record: ${matchInsertError.message}`
          );
        } else if (matchInsertError?.code === "23505") {
          console.warn(
            `Match between ${likerUserId} and ${likedUserUuid} already exists.`
          );
        } else if (!matchInsertError) {
          console.log("Match successfully created!");
          // Optionally, show a "You matched!" notification here
        }

        // 3.1. Delete the corresponding likes from the likes table after a match is made
        // We only proceed with deletion if the match insertion was successful or if the match already existed (code 23505)
        if (!matchInsertError || matchInsertError?.code === "23505") {
          console.log(
            `Deleting like entries for match between ${likerUserId} and ${likedUserUuid}`
          );
          // Delete the like from current user to the liked user
          const { error: deleteLikerLikeError } = await supabase
            .from("likes")
            .delete()
            .eq("liker_user_id", likerUserId)
            .eq("liked_user_id", likedUserUuid);

          if (deleteLikerLikeError) {
            console.error(
              `Failed to delete like from ${likerUserId} to ${likedUserUuid}:`,
              deleteLikerLikeError
            );
          }

          // Delete the like from the liked user to the current user
          const { error: deleteLikedLikeError } = await supabase
            .from("likes")
            .delete()
            .eq("liker_user_id", likedUserUuid)
            .eq("liked_user_id", likerUserId);

          if (deleteLikedLikeError) {
            console.error(
              `Failed to delete like from ${likedUserUuid} to ${likerUserId}:`,
              deleteLikedLikeError
            );
          }
        }
      }

      // 4. Remove the liked user from the potential matches list in the UI
      setPotentialMatches((prev) =>
        prev.filter((match) => match.user_id !== likedUserUuid)
      );
    } catch (err: any) {
      setError(`Failed to process like: ${err.message}`);
      console.error("Error in handleLike:", err);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">
        Find Study Partners
      </h1>

      {isLoading && <p className="text-gray-400">Loading matches...</p>}
      {error && <p className="text-red-500 mb-4">{error}</p>}

      {/* Display only the first potential match if available */}
      {!isLoading && potentialMatches.length > 0
        ? (() => {
            const match = potentialMatches[0]; // Get the first match
            // Extract the first letter of the name for the fallback
            const fallbackName = match.name?.charAt(0).toUpperCase() || "?";
            return (
              <div key={match.user_id} className="max-w-md mx-auto mb-4">
                <Card className="bg-blue-950/20 border-blue-500/20">
                  <CardContent className="p-6">
                    <div className="text-center space-y-4">
                      {/* Use Avatar component */}
                      <Avatar className="w-24 h-24 mx-auto border-2 border-blue-500/30">
                        <AvatarImage src={match.avatar_url ?? undefined} alt={match.name ?? 'User avatar'} />
                        <AvatarFallback className="text-4xl bg-blue-500/20 text-blue-300">
                          {/* Display User icon as fallback content if no name */}
                          {match.name ? fallbackName : <User className="w-12 h-12" />}
                        </AvatarFallback>
                      </Avatar>
                      <h2 className="text-xl font-semibold text-white">
                        {match.name}
                      </h2>
                      <p className="text-gray-400">
                        {`${match.field_of_study || "N/A"} \u2022 Year ${
                          match.year_of_study || "N/A"
                        }`}
                      </p>
                      <p className="text-sm text-blue-300">
                        Compatibility: {match.compatibilityScore}
                      </p>
                    </div>

                    <div className="flex justify-center gap-4 mt-6">
                      {/* Reject button (optional) */}
                      {/* <Button variant="outline" size="icon" className="h-12 w-12 rounded-full border-red-500/20 hover:bg-red-500/10 hover:text-red-400">
                    <X className="h-6 w-6" />
                  </Button> */}
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 rounded-full border-green-500/20 hover:bg-green-500/10 hover:text-green-400"
                        onClick={() => handleLike(match.user_id)} // Use handleLike now
                      >
                        <Heart className="h-6 w-6" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })()
        : !isLoading && (
            <p className="text-gray-400">No potential matches found.</p>
          )}
    </div>
  );
}
