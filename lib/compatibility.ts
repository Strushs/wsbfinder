// Define the structure of a student profile for compatibility calculation
export interface StudentProfile {
  user_id: string;
  name: string; // Keep name for potential future use or display
  field_of_study: string | null;
  year_of_study: number | null;
  avatar_url?: string | null; // Add optional avatar_url
  // Add other relevant fields here in the future (e.g., interests, study_habits)
}

/**
 * Calculates a compatibility score between two student profiles.
 * @param profile1 - The profile of the first student.
 * @param profile2 - The profile of the second student.
 * @returns A numerical compatibility score. Higher is better.
 */
export function calculateCompatibility(
  profile1: StudentProfile,
  profile2: StudentProfile
): number {
  let score = 0;

  // Score based on field of study
  if (
    profile1.field_of_study &&
    profile2.field_of_study &&
    profile1.field_of_study === profile2.field_of_study
  ) {
    score += 5; // Major points for same field of study
  }

  // Score based on year of study
  if (profile1.year_of_study && profile2.year_of_study) {
    const yearDiff = Math.abs(profile1.year_of_study - profile2.year_of_study);
    if (yearDiff === 0) {
      score += 3; // Good points for same year
    } else if (yearDiff === 1) {
      score += 1; // Minor points for adjacent years
    }
  }

  // Add more scoring criteria here based on other fields (e.g., interests)

  return score;
}

// Example of how to extend with interests (if you add an 'interests' array field)
/*
  if (profile1.interests && profile2.interests) {
    const commonInterests = profile1.interests.filter(interest =>
      profile2.interests.includes(interest)
    );
    score += commonInterests.length * 1; // 1 point per common interest
  }
*/
