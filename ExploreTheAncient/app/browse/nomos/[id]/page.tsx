"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createEmptyNomos, Nomos, readData, saveData } from "../../places";

export default function EditNomosPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [nomos, setNomos] = useState<Nomos | null>(null);

  useEffect(() => {
    const data = readData();
    setNomos(data.nomoi.find((item) => item.id === params.id) ?? createEmptyNomos(params.id));
  }, [params.id]);

  function updateField(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setNomos((current) => current ? { ...current, [name]: value } : current);
  }

  function saveNomos(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nomos) return;

    const data = readData();
    const exists = data.nomoi.some((item) => item.id === nomos.id);
    saveData({
      ...data,
      nomoi: exists
        ? data.nomoi.map((item) => item.id === nomos.id ? nomos : item)
        : [...data.nomoi, nomos],
    });
    router.push("/browse");
  }

  function deleteNomos() {
    if (!nomos) return;

    const data = readData();
    const placeCount = data.places.filter(
      (place) => place.nomosId === nomos.id,
    ).length;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${nomos.name || "this νομός"}"? ` +
        `${placeCount} ${placeCount === 1 ? "place" : "places"} inside will also be deleted. ` +
        "This cannot be undone.",
    );
    if (!confirmed) return;

    saveData({
      regions: data.regions,
      nomoi: data.nomoi.filter((item) => item.id !== nomos.id),
      places: data.places.filter((place) => place.nomosId !== nomos.id),
    });
    router.push("/browse");
  }

  if (!nomos) return null;

  return (
    <main className="editPage">
      <h1>Edit Νομός</h1>
      <form className="editForm" onSubmit={saveNomos}>
        <label>
          Name
          <input name="name" value={nomos.name} onChange={updateField} />
        </label>
        <label>
          Folder picture URL
          <input
            name="image"
            value={nomos.image}
            onChange={updateField}
            placeholder="/picture.jpg or https://..."
          />
        </label>
        {nomos.image && (
          <div
            className="editImagePreview"
            role="img"
            aria-label={`${nomos.name || "Νομός"} preview`}
            style={{ backgroundImage: `url("${nomos.image}")` }}
          />
        )}
        <div className="editActions">
          <button type="button" className="dangerButton" onClick={deleteNomos}>
            Delete Νομός
          </button>
          <span className="editActionSpacer" />
          <button type="button" className="secondaryButton" onClick={() => router.push("/browse")}>
            Cancel
          </button>
          <button type="submit" className="addAncientButton">Save Νομός</button>
        </div>
      </form>
    </main>
  );
}
