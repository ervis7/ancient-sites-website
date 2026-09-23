"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { readData, Region, saveData } from "../../places";

export default function EditRegionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [region, setRegion] = useState<Region | null>(null);

  useEffect(() => {
    const data = readData();
    setRegion(data.regions.find((item) => item.id === params.id) ?? null);
  }, [params.id]);

  function updateField(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setRegion((current) => current ? { ...current, [name]: value } : current);
  }

  function saveRegion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!region) return;
    const data = readData();
    saveData({
      ...data,
      regions: data.regions.map((item) => item.id === region.id ? region : item),
    });
    router.push("/browse");
  }

  if (!region) return null;

  return (
    <main className="editPage">
      <h1>Edit Region</h1>
      <form className="editForm" onSubmit={saveRegion}>
        <label>
          Name
          <input name="name" value={region.name} onChange={updateField} required />
        </label>
        <label>
          Background picture URL
          <input
            name="image"
            type="url"
            value={region.image}
            onChange={updateField}
            placeholder="https://..."
          />
        </label>
        {region.image && (
          <div
            className="editImagePreview regionImagePreview"
            role="img"
            aria-label={`${region.name} background preview`}
            style={{ backgroundImage: `url("${region.image}")` }}
          />
        )}
        <div className="editActions">
          <button type="button" className="secondaryButton" onClick={() => router.push("/browse")}>
            Cancel
          </button>
          <button type="submit" className="addAncientButton">Save Region</button>
        </div>
      </form>
    </main>
  );
}
