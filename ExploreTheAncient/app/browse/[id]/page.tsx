"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AncientPlace,
  createEmptyPlace,
  readPlaces,
  savePlaces,
} from "../places";

export default function EditAncientPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const [place, setPlace] = useState<AncientPlace | null>(null);

  useEffect(() => {
    const places = readPlaces();
    setPlace(places.find((candidate) => candidate.id === id) ?? createEmptyPlace(id));
  }, [id]);

  function updateField(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;
    setPlace((currentPlace) =>
      currentPlace ? { ...currentPlace, [name]: value } : currentPlace,
    );
  }

  function savePlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!place) {
      return;
    }

    const places = readPlaces();
    const exists = places.some((candidate) => candidate.id === place.id);
    const updatedPlaces = exists
      ? places.map((candidate) => (candidate.id === place.id ? place : candidate))
      : [...places, place];

    savePlaces(updatedPlaces);
    router.push("/browse");
  }

  function deletePlace() {
    if (!place) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${place.name || "this ancient place"}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    savePlaces(readPlaces().filter((candidate) => candidate.id !== place.id));
    router.push("/browse");
  }

  if (!place) {
    return null;
  }

  const mapQuery =
    place.latitude && place.longitude
      ? `${place.latitude},${place.longitude}`
      : place.location || "Greece";
  const mapSource = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=14&output=embed`;

  return (
    <main className="editPage">
      <h1>Edit Ancient Place</h1>

      <form className="editForm" onSubmit={savePlace}>
        <label>
          Name
          <input name="name" value={place.name} onChange={updateField} />
        </label>

        <label>
          Location
          <input
            name="location"
            value={place.location}
            onChange={updateField}
            placeholder="Enter the full address"
          />
        </label>

        <label>
          Altitude
          <input name="altitude" value={place.altitude} onChange={updateField} />
        </label>

        <label>
          Picture URL
          <input
            name="image"
            type="text"
            value={place.image}
            onChange={updateField}
            placeholder="/ancient-place.svg or https://..."
          />
        </label>

        <label>
          Description
          <textarea
            name="description"
            rows={6}
            value={place.description}
            onChange={updateField}
          />
        </label>

        <fieldset className="mapEditor">
          <legend>Google Maps location</legend>
          <p>Enter coordinates to position the pin accurately.</p>

          <div className="coordinateFields">
            <label>
              Latitude
              <input
                name="latitude"
                type="number"
                step="any"
                min="-90"
                max="90"
                value={place.latitude}
                onChange={updateField}
                placeholder="38.4824"
              />
            </label>
            <label>
              Longitude
              <input
                name="longitude"
                type="number"
                step="any"
                min="-180"
                max="180"
                value={place.longitude}
                onChange={updateField}
                placeholder="22.5010"
              />
            </label>
          </div>

          <iframe
            className="mapFrame"
            title={`Map location for ${place.name || "ancient place"}`}
            src={mapSource}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </fieldset>

        {place.image && (
          <div
            className="editImagePreview"
            role="img"
            aria-label="Place preview"
            style={{ backgroundImage: `url("${place.image}")` }}
          />
        )}

        <div className="editActions">
          <button type="button" className="dangerButton" onClick={deletePlace}>
            Delete Place
          </button>
          <span className="editActionSpacer" />
          <button type="button" className="secondaryButton" onClick={() => router.push("/browse")}>
            Cancel
          </button>
          <button type="submit" className="addAncientButton">
            Save Place
          </button>
        </div>
      </form>
    </main>
  );
}
