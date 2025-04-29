"use client";

import { useState, useEffect, ChangeEvent, FormEvent } from "react"; // Added FormEvent
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Import Select components
import { toast } from "sonner";
import { User as LucideUser, Edit, X, Save } from "lucide-react"; // Added Edit, X, Save icons

// Define the profile data structure
interface ProfileData {
  name: string;
  email: string; // Email is usually not editable by the user directly
  field_of_study: string | null;
  year_of_study: number | null;
  avatar_url: string | null;
}

// Define structure for form data during editing
interface FormData {
  name: string;
  field_of_study: string; // Use string for input, handle null conversion on save
  year_of_study: string; // Use string for input, handle number/null conversion on save
}

// Define options for dropdowns - Updated to match sign-up page
const fieldOfStudyOptions = [
  "computer-science",
  "business",
  "engineering",
  "medicine",
  "arts",
  "law",
  "science",
  "other",
];
const yearOfStudyOptions = ["1", "2", "3", "4", "5", "6+"];

export default function ProfilePage() {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // State for edit mode
  const [isSaving, setIsSaving] = useState(false); // State for save operation
  const [formData, setFormData] = useState<FormData>({
    // State for form inputs
    name: "",
    field_of_study: "",
    year_of_study: "",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: profileError } = await supabase
          .from("students")
          .select("name, email, field_of_study, year_of_study, avatar_url")
          .eq("user_id", user.id)
          .single();

        if (profileError) throw profileError;
        if (data) {
          setProfile(data);
          // Initialize formData when profile loads
          setFormData({
            name: data.name || "",
            field_of_study: data.field_of_study || "",
            year_of_study: data.year_of_study?.toString() || "",
          });
        } else {
          setError("Profile not found."); // Should ideally not happen if user is logged in
        }
      } catch (err: any) {
        console.error("Error fetching profile:", err);
        setError(err.message || "Failed to load profile.");
        toast.error("Failed to load profile data.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [supabase, user]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user || !profile) {
      toast.warning("Please select an image file first.");
      return;
    }

    setIsUploading(true);
    const fileExt = selectedFile.name.split(".").pop();
    const newFilePath = `${user.id}/avatar-${Date.now()}.${fileExt}`; // Unique path per user
    const oldAvatarUrl = profile.avatar_url; // Store old URL before potential update

    try {
      // 1. Upload new image to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("avatars") // Ensure this bucket exists and has correct policies
        .upload(newFilePath, selectedFile, {
          cacheControl: "3600",
          upsert: false, // Set upsert to false to avoid overwriting if the exact same name somehow generated
        });

      if (uploadError) {
        throw new Error(`Storage Upload Error: ${uploadError.message}`);
      }

      // 2. Get public URL for the *new* image
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(newFilePath); // Use the newFilePath

      if (!urlData?.publicUrl) {
        // Attempt to clean up the uploaded file if we can't get URL
        await supabase.storage.from("avatars").remove([newFilePath]);
        throw new Error("Could not get public URL for the uploaded image.");
      }
      const newPublicUrl = urlData.publicUrl;

      // 3. Update avatar_url in the students table with the *new* URL
      const { error: updateError } = await supabase
        .from("students")
        .update({ avatar_url: newPublicUrl }) // Use the newPublicUrl
        .eq("user_id", user.id);

      if (updateError) {
        // Attempt to clean up the uploaded file if DB update fails
        await supabase.storage.from("avatars").remove([newFilePath]);
        throw new Error(`Database Update Error: ${updateError.message}`);
      }

      // 4. Delete the *old* avatar from storage if it existed
      if (oldAvatarUrl) {
        try {
          // Extract the file path from the old URL
          // Example URL: https://<project-ref>.supabase.co/storage/v1/object/public/avatars/user-id/avatar-123.jpg
          // We need the path: user-id/avatar-123.jpg
          const bucketName = "avatars"; // Make sure this matches your bucket name
          const urlParts = oldAvatarUrl.split(`/${bucketName}/`);
          if (urlParts.length === 2) {
            const oldFilePath = urlParts[1];
            console.log("Attempting to remove old avatar:", oldFilePath);
            const { error: removeError } = await supabase.storage
              .from(bucketName)
              .remove([oldFilePath]);
            if (removeError) {
              // Log the error but don't block the success message for the new upload
              console.error("Failed to remove old avatar:", removeError);
              toast.warning(
                "New avatar uploaded, but failed to remove the old one."
              );
            } else {
              console.log("Old avatar removed successfully.");
            }
          } else {
            console.warn(
              "Could not parse old avatar URL to extract file path:",
              oldAvatarUrl
            );
          }
        } catch (removeErr: any) {
          // Log unexpected errors during removal
          console.error("Error during old avatar removal process:", removeErr);
          toast.warning(
            "New avatar uploaded, but encountered an error removing the old one."
          );
        }
      }

      // 5. Update local state to reflect change immediately
      setProfile({ ...profile, avatar_url: newPublicUrl });
      setSelectedFile(null); // Clear selection after successful upload
      toast.success("Profile picture updated successfully!");
    } catch (err: any) {
      console.error("Upload failed:", err);
      toast.error(`Upload failed: ${err.message}`);
      // No need to clean up here, as cleanup attempts are done within the try block on specific failures
    } finally {
      setIsUploading(false);
    }
  };

  // Handle changes in form inputs
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  // Handle changes in Select components
  const handleSelectChange = (name: keyof FormData) => (value: string) => {
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  // Toggle edit mode
  const handleEditToggle = () => {
    if (!profile) return;
    if (!isEditing) {
      // Entering edit mode, initialize form with current profile data
      setFormData({
        name: profile.name || "",
        field_of_study: profile.field_of_study || "",
        year_of_study: profile.year_of_study?.toString() || "",
      });
    }
    setIsEditing(!isEditing);
  };

  // Handle cancelling edit
  const handleCancelEdit = () => {
    setIsEditing(false);
    // Optionally reset formData to original profile values if needed,
    // but handleEditToggle already does this when entering edit mode.
  };

  // Handle saving profile changes
  const handleSave = async (event: FormEvent) => {
    event.preventDefault(); // Prevent default form submission
    if (!user || !profile) return;

    setIsSaving(true);
    setError(null); // Clear previous save errors

    // Prepare data for update, converting types as needed
    const yearNum = parseInt(formData.year_of_study, 10);
    const updateData: Partial<ProfileData> = {
      name: formData.name.trim() || profile.name, // Keep original if empty
      field_of_study: formData.field_of_study.trim() || null, // Set to null if empty
      year_of_study: !isNaN(yearNum) && yearNum > 0 ? yearNum : null, // Set to null if invalid or empty
    };

    try {
      const { error: updateError } = await supabase
        .from("students")
        .update(updateData)
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      // Update local profile state on success
      setProfile((prevProfile) =>
        prevProfile ? { ...prevProfile, ...updateData } : null
      );
      setIsEditing(false); // Exit edit mode
      toast.success("Profile updated successfully!");
    } catch (err: any) {
      console.error("Error updating profile:", err);
      setError(err.message || "Failed to update profile."); // Set save error state
      toast.error("Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const fallbackName = profile?.name?.charAt(0).toUpperCase() || "?";

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Your Profile</h1>
        {/* Edit/Cancel Button */}
        {profile && !isLoading && (
          <Button
            variant="outline"
            size="icon"
            onClick={handleEditToggle}
            disabled={isSaving || isUploading}
          >
            {isEditing ? (
              <X className="h-4 w-4" />
            ) : (
              <Edit className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {isLoading && <p className="text-gray-400">Loading profile...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {/* Ensure conditional rendering block is correctly structured */}
      {profile && !isLoading && (
        <form onSubmit={handleSave}>
          {" "}
          {/* Wrap content in a form for saving */}
          <div className="space-y-4 bg-blue-950/10 p-6 rounded-lg border border-blue-500/20">
            {/* Avatar Display and Upload */}
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="w-32 h-32 border-4 border-blue-500/30">
                <AvatarImage
                  src={profile.avatar_url ?? undefined}
                  alt={profile.name ?? "User avatar"}
                />
                <AvatarFallback className="text-6xl bg-blue-500/20 text-blue-300">
                  {profile.name ? (
                    fallbackName
                  ) : (
                    <LucideUser className="w-16 h-16" />
                  )}
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-col items-center space-y-2 w-full max-w-xs">
                <Label htmlFor="picture" className="text-gray-300">
                  Update Profile Picture
                </Label>
                <Input
                  id="picture"
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleFileChange}
                  // Enhanced styling for better appearance
                  className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-6 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:transition-colors file:duration-200 cursor-pointer border border-blue-500/30 rounded-lg bg-blue-950/20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent p-2 h-14"
                  disabled={isUploading || isEditing} // Disable avatar upload while editing profile fields
                />
                {selectedFile && (
                  <Button
                    type="button" // Prevent form submission
                    onClick={handleUpload}
                    disabled={isUploading || isEditing}
                    className="mt-2 w-full"
                  >
                    {isUploading ? "Uploading..." : "Upload Image"}
                  </Button>
                )}
              </div>
            </div>

            {/* Profile Details */}
            <div className="space-y-2">
              <div>
                <Label className="text-gray-400">Name</Label>
                {isEditing ? (
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="mt-1 text-white bg-blue-950/20 border-blue-500/30"
                    disabled={isSaving}
                    required
                  />
                ) : (
                  <p className="text-white text-lg">{profile.name}</p>
                )}
              </div>
              <div>
                <Label className="text-gray-400">Email</Label>
                <p className="text-white text-lg">{profile.email}</p>
              </div>
              <div>
                <Label htmlFor="field_of_study" className="text-gray-400">
                  Field of Study
                </Label>
                {isEditing ? (
                  <Select
                    name="field_of_study"
                    value={formData.field_of_study} // Ensure value is controlled
                    onValueChange={handleSelectChange("field_of_study")} // Use select handler
                    disabled={isSaving}
                  >
                    <SelectTrigger className="mt-1 text-white bg-blue-950/20 border-blue-500/30">
                      <SelectValue placeholder="Select field of study" />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldOfStudyOptions.map((option) => (
                        // Display a more readable version if the value is hyphenated
                        <SelectItem key={option} value={option}>
                          {option.includes("-")
                            ? option
                                .split("-")
                                .map(
                                  (word) =>
                                    word.charAt(0).toUpperCase() + word.slice(1)
                                )
                                .join(" ")
                            : option.charAt(0).toUpperCase() + option.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  // Display a more readable version if the value is hyphenated
                  <p className="text-white text-lg">
                    {profile.field_of_study
                      ? profile.field_of_study.includes("-")
                        ? profile.field_of_study
                            .split("-")
                            .map(
                              (word) =>
                                word.charAt(0).toUpperCase() + word.slice(1)
                            )
                            .join(" ")
                        : profile.field_of_study.charAt(0).toUpperCase() +
                          profile.field_of_study.slice(1)
                      : "Not set"}
                  </p>
                )}
              </div>
              <div>
                <Label className="text-gray-400">Year of Study</Label>
                {isEditing ? (
                  <Select
                    name="year_of_study"
                    value={formData.year_of_study} // Ensure value is controlled
                    onValueChange={handleSelectChange("year_of_study")} // Use select handler
                    disabled={isSaving}
                    required // Make year required if needed
                  >
                    <SelectTrigger className="mt-1 text-white bg-blue-950/20 border-blue-500/30">
                      <SelectValue placeholder="Select year of study" />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOfStudyOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-white text-lg">
                    {profile.year_of_study || "Not set"}
                  </p>
                )}
              </div>
              {/* Display saving error */}
              {isEditing && error && (
                <p className="text-red-500 text-sm">{error}</p>
              )}
            </div>

            {/* Save Button */}
            {isEditing && (
              <div className="flex justify-end pt-4 border-t border-blue-500/10">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="mr-2"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    "Saving..."
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" /> Save Changes
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
