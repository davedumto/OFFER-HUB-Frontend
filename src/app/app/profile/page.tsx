"use client";

import { useState, useEffect, useMemo } from "react";
import { Country } from "country-state-city";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/stores/auth-store";
import { Icon, ICON_PATHS, LoadingSpinner } from "@/components/ui/Icon";
import {
  NEUMORPHIC_CARD,
  NEUMORPHIC_INPUT,
  INPUT_ERROR_STYLES,
  PRIMARY_BUTTON,
} from "@/lib/styles";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { getProfile, updateProfile } from "@/lib/api/profile";
import { uploadImage } from "@/lib/api/upload";

interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  bio: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  username?: string;
  bio?: string;
}

interface FormInputProps {
  label: string;
  name: keyof ProfileFormData;
  type?: string;
  value: string;
  placeholder: string;
  error?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

function FormInput({
  label,
  name,
  type = "text",
  value,
  placeholder,
  error,
  onChange,
  className,
}: FormInputProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-text-primary mb-2">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className={cn(NEUMORPHIC_INPUT, error && INPUT_ERROR_STYLES)}
        placeholder={placeholder}
      />
      {error && <p className="mt-1 text-sm text-error">{error}</p>}
    </div>
  );
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_USERNAME_LENGTH = 3;
const MAX_BIO_LENGTH = 500;
const SUCCESS_MESSAGE_DURATION = 3000;

const INITIAL_FORM_DATA: ProfileFormData = {
  firstName: "",
  lastName: "",
  email: "",
  username: "",
  bio: "",
};

function validateProfileForm(formData: ProfileFormData): FormErrors {
  const errors: FormErrors = {};

  if (!formData.firstName.trim()) {
    errors.firstName = "First name is required";
  }

  if (!formData.lastName.trim()) {
    errors.lastName = "Last name is required";
  }

  if (!formData.email.trim()) {
    errors.email = "Email is required";
  } else if (!EMAIL_REGEX.test(formData.email)) {
    errors.email = "Please enter a valid email address";
  }

  if (!formData.username.trim()) {
    errors.username = "Username is required";
  } else if (formData.username.length < MIN_USERNAME_LENGTH) {
    errors.username = `Username must be at least ${MIN_USERNAME_LENGTH} characters`;
  }

  if (formData.bio.length > MAX_BIO_LENGTH) {
    errors.bio = `Bio must be less than ${MAX_BIO_LENGTH} characters`;
  }

  return errors;
}

export default function ProfilePage() {
  const token = useAuthStore((state) => state.token);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formData, setFormData] = useState<ProfileFormData>(INITIAL_FORM_DATA);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Get all countries - simple list without flags
  const countries = useMemo(() => Country.getAllCountries(), []);

  // Wait for Zustand to hydrate from localStorage
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    async function loadProfile() {
      // Wait for hydration before checking token
      if (!isHydrated || !token) {
        if (isHydrated) {
          setIsFetching(false);
        }
        return;
      }

      try {
        const profile = await getProfile(token);

        setFormData({
          firstName: profile.firstName || "",
          lastName: profile.lastName || "",
          email: profile.email || "",
          username: profile.username || "",
          bio: profile.bio || "",
        });

        // Set avatar URL, but filter out invalid blob URLs from database
        setAvatarUrl(profile.avatarUrl?.startsWith('blob:') ? null : profile.avatarUrl);

        // Set country from profile
        if (profile.country) {
          const country = Country.getAllCountries().find(
            c => c.name.toLowerCase() === profile.country?.toLowerCase()
          );
          if (country) {
            setSelectedCountry(country.isoCode);
          }
        }
      } catch (error) {
        console.error("Failed to load profile:", error);
      } finally {
        setIsFetching(false);
      }
    }

    loadProfile();
  }, [token, isHydrated]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  async function handleImageUpload(files: File[]) {
    if (files.length === 0 || !token) return;

    const file = files[0];

    // Create a local preview URL for immediate feedback
    const previewUrl = URL.createObjectURL(file);
    setAvatarUrl(previewUrl);
    setIsUploadingImage(true);

    try {
      // Upload image to Cloudinary via backend
      const result = await uploadImage(file, token, "avatars");

      // Replace preview URL with the actual uploaded URL
      URL.revokeObjectURL(previewUrl);
      setAvatarUrl(result.url);

      console.log("Image uploaded successfully:", result.url);

      // Immediately save the avatar URL to the database
      await updateProfile(token, {
        avatarUrl: result.url,
      });

      console.log("Avatar URL saved to profile");
    } catch (error) {
      console.error("Failed to upload image:", error);

      // Revert to previous avatar on error
      URL.revokeObjectURL(previewUrl);
      setAvatarUrl(null);

      setErrors({ firstName: error instanceof Error ? error.message : "Failed to upload image" });
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationErrors = validateProfileForm(formData);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    if (!token) {
      setErrors({ firstName: "Authentication token not found. Please log in again." });
      return;
    }

    setIsLoading(true);

    try {
      // Find country name from code
      const countryName = countries.find(c => c.isoCode === selectedCountry)?.name || "";

      // Don't send blob URLs to backend - they're not persistent
      const avatarToSend = avatarUrl?.startsWith('blob:') ? undefined : avatarUrl || undefined;

      await updateProfile(token, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        username: formData.username,
        bio: formData.bio,
        country: countryName,
        avatarUrl: avatarToSend,
      });

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), SUCCESS_MESSAGE_DURATION);
    } catch (error) {
      console.error("Failed to update profile:", error);
      setErrors({ firstName: error instanceof Error ? error.message : "Failed to update profile" });
    } finally {
      setIsLoading(false);
    }
  }

  if (isFetching) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner />
          <p className="text-text-secondary">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Profile Settings</h1>
          <p className="text-text-secondary text-sm">
            Manage your account information
          </p>
        </div>
        {showSuccess && (
          <div
            className={cn(
              "px-4 py-2 rounded-xl",
              "bg-success/10 border border-success/20",
              "animate-scale-in"
            )}
          >
            <div className="flex items-center gap-2">
              <Icon path={ICON_PATHS.check} size="sm" className="text-success flex-shrink-0" />
              <p className="text-sm text-success font-medium">Profile updated!</p>
            </div>
          </div>
        )}
      </div>

      <div className={NEUMORPHIC_CARD}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <ImageUpload
            variant="single"
            label="Profile Photo"
            currentImage={avatarUrl || undefined}
            onUpload={handleImageUpload}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormInput
              label="First Name"
              name="firstName"
              value={formData.firstName}
              placeholder="John"
              error={errors.firstName}
              onChange={handleChange}
            />
            <FormInput
              label="Last Name"
              name="lastName"
              value={formData.lastName}
              placeholder="Doe"
              error={errors.lastName}
              onChange={handleChange}
            />
            <FormInput
              label="Username"
              name="username"
              value={formData.username}
              placeholder="johndoe"
              error={errors.username}
              onChange={handleChange}
            />
            <FormInput
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              placeholder="john@example.com"
              error={errors.email}
              onChange={handleChange}
            />
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Country</label>
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className={cn(NEUMORPHIC_INPUT, "pr-10")}
              >
                <option value="">Select country...</option>
                {countries.map((country) => (
                  <option key={country.isoCode} value={country.isoCode}>
                    {country.flag} {country.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-text-primary mb-1">Bio (Optional)</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                rows={3}
                className={cn(NEUMORPHIC_INPUT, "resize-none", errors.bio && INPUT_ERROR_STYLES)}
                placeholder="Tell us about yourself..."
              />
              <div className="flex justify-between mt-1">
                {errors.bio && <p className="text-xs text-error">{errors.bio}</p>}
                <p className="text-xs text-text-secondary ml-auto">
                  {formData.bio.length}/{MAX_BIO_LENGTH}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={isLoading} className={cn(PRIMARY_BUTTON, "py-2 px-5")}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner />
                  Saving...
                </span>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
