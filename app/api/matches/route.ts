import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";

// Assuming Database type might be defined elsewhere or inferred
// import type { Database } from '@/types_db';

export async function GET(request: Request) {
  // Pass the cookies function directly
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    // Handle session errors or lack of session
    if (sessionError) {
      console.error("Session Error:", sessionError.message);
      throw new Error(`Authentication error: ${sessionError.message}`);
    }
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = session.user.id;
    console.log(`Fetching matches for user: ${currentUserId}`);

    // Fetch matches involving the current user
    // Renamed variables to avoid redeclaration errors
    const { data: matchesResult, error: matchesFetchError } = await supabase
      .from("matches")
      .select("student1_user_id, student2_user_id")
      .or(
        `student1_user_id.eq.${currentUserId},student2_user_id.eq.${currentUserId}`
      );

    if (matchesFetchError) {
      // Use renamed variable
      console.error("Match Fetch Error:", matchesFetchError.message);
      throw new Error(
        `Database error fetching matches: ${matchesFetchError.message}`
      );
    }

    // Handle case where no matches are found
    if (!matchesResult || matchesResult.length === 0) {
      // Use renamed variable
      console.log(`No matches found for user: ${currentUserId}`);
      return NextResponse.json([]);
    }

    // Extract the IDs of the other users in the matches
    const matchedUserIds = matchesResult // Use renamed variable
      .map((match) =>
        match.student1_user_id === currentUserId
          ? match.student2_user_id
          : match.student1_user_id
      )
      .filter((id) => id !== currentUserId && id != null); // Ensure not self and ID is not null

    // Handle case where no other users are found in matches
    if (matchedUserIds.length === 0) {
      console.log(`No other users found in matches for user: ${currentUserId}`);
      return NextResponse.json([]);
    }

    // Fetch profile details for the matched users
    const { data: profilesResult, error: profilesFetchError } = await supabase
      .from("students") // Ensure this is your profiles table name
      .select("user_id, name, avatar_url") // Select avatar_url
      .in("user_id", matchedUserIds);

    if (profilesFetchError) {
      // Use renamed variable
      console.error("Profile Fetch Error:", profilesFetchError.message);
      throw new Error(
        `Database error fetching profiles: ${profilesFetchError.message}`
      );
    }

    // Format the response with profile details
    const matchesWithDetails =
      profilesResult?.map((profile) => ({
        // Use renamed variable
        id: profile.user_id,
        name: profile.name || "Unnamed User", // Provide a default name if null
        avatar_url: profile.avatar_url, // Add avatar_url to the response
      })) || [];

    // Return the formatted list of matches
    return NextResponse.json(matchesWithDetails);
  } catch (error: any) {
    // Catch any errors thrown in the try block
    console.error("Failed to fetch matches:", error.message || error);
    // Return a generic error response
    return NextResponse.json(
      {
        error: "Failed to fetch matches",
        details: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
