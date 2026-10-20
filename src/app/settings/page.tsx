import { redirect } from "next/navigation";

interface SettingsPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function SettingsRedirectPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const tab = params?.tab || "appearance";
  
  // Map settings tabs to account tabs
  let mappedTab = "preferences";
  if (tab === "profile" || tab === "edit-profile") mappedTab = "profile";
  else if (tab === "security") mappedTab = "security";
  else if (tab === "privacy") mappedTab = "privacy";
  else if (tab === "bookings") mappedTab = "bookings";

  redirect(`/account?tab=${mappedTab}`);
}
