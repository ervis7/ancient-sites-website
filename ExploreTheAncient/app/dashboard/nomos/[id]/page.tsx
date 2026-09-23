import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { initialNomoi } from "@/app/browse/places";
import { createClient } from "@/lib/supabase/server";
import { updatePrivateNomos } from "../../actions";

export default async function EditPrivateNomosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const nomos = initialNomoi.find((item) => item.id === id);
  if (!nomos) notFound();

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/login");

  const [{ data: currentProfile }, { data: preference }] = await Promise.all([
    supabase.from("profiles").select("is_admin").eq("id", authData.user.id).maybeSingle(),
    supabase
    .from("global_nomoi")
    .select("display_name,image_url")
    .eq("nomos_id", id)
    .maybeSingle(),
  ]);
  if (currentProfile?.is_admin !== true) redirect("/dashboard");

  return (
    <main className="editPage">
      <h1>Edit Νομός</h1>
      <form action={updatePrivateNomos.bind(null, id)} className="editForm">
        <label>
          Display name
          <input
            name="displayName"
            defaultValue={preference?.display_name || nomos.name}
            required
          />
        </label>
        <label>
          Folder picture URL
          <input
            name="imageUrl"
            defaultValue={preference?.image_url ?? ""}
            placeholder="/picture.jpg or https://..."
          />
        </label>
        {preference?.image_url && (
          <div
            className="editImagePreview"
            role="img"
            aria-label={`${nomos.name} folder preview`}
            style={{ backgroundImage: `url("${preference.image_url}")` }}
          />
        )}
        <div className="editActions">
          <Link href="/dashboard" className="secondaryButton">Cancel</Link>
          <button className="addAncientButton">Save Νομός</button>
        </div>
      </form>
    </main>
  );
}
