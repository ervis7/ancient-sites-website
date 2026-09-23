import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { initialRegions } from "@/app/browse/places";
import { createClient } from "@/lib/supabase/server";
import { updatePrivateRegion } from "../../actions";

export default async function EditPrivateRegionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const region = initialRegions.find((item) => item.id === id);
  if (!region) notFound();

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/login");

  const [{ data: currentProfile }, { data: preference }] = await Promise.all([
    supabase.from("profiles").select("is_admin").eq("id", authData.user.id).maybeSingle(),
    supabase
    .from("global_regions")
    .select("display_name,image_url")
    .eq("region_id", id)
    .maybeSingle(),
  ]);
  if (currentProfile?.is_admin !== true) redirect("/dashboard");

  return (
    <main className="editPage">
      <h1>Edit Region</h1>
      <form action={updatePrivateRegion.bind(null, id)} className="editForm">
        <label>
          Display name
          <input
            name="displayName"
            defaultValue={preference?.display_name || region.name}
            required
          />
        </label>
        <label>
          Background picture URL
          <input
            name="imageUrl"
            type="url"
            defaultValue={preference?.image_url ?? ""}
            placeholder="https://..."
          />
        </label>
        {preference?.image_url && (
          <div
            className="editImagePreview regionImagePreview"
            role="img"
            aria-label={`${region.name} background preview`}
            style={{ backgroundImage: `url("${preference.image_url}")` }}
          />
        )}
        <div className="editActions">
          <Link href="/dashboard" className="secondaryButton">Cancel</Link>
          <button className="addAncientButton">Save Region</button>
        </div>
      </form>
    </main>
  );
}
