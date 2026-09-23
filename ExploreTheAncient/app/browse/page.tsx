"use client";

import {
  ChangeEvent,
  FormEvent,
  MouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import GreeceNomosMap from "./GreeceNomosMap";
import BrowseViewToggle, { BrowseView } from "./BrowseViewToggle";
import { DEFAULT_PLACE_IMAGE_URL } from "../placeImages";
import {
  AncientPlace,
  createEmptyNomos,
  createEmptyPlace,
  createSaveFile,
  initialData,
  Nomos,
  parseSaveFile,
  PlacesData,
  readData,
  Region,
  saveData,
} from "./places";

function RegionFolder({
  region,
  nomosCount,
  onOpen,
  onEdit,
}: {
  region: Region;
  nomosCount: number;
  onOpen: () => void;
  onEdit: () => void;
}) {
  return (
    <article className="regionFolderCard">
      <button
        type="button"
        className={`regionFolder${region.image ? " regionFolderWithImage" : ""}`}
        onClick={onOpen}
      >
        {region.image && (
          <span
            className="regionFolderBackground"
            style={{ backgroundImage: `url("${region.image}")` }}
            aria-hidden="true"
          />
        )}
        <span className="regionFolderContent">
          <strong>{region.name}</strong>
          <small>{nomosCount} νομοί</small>
        </span>
      </button>
      <button type="button" className="folderEditButton regionEditButton" onClick={onEdit}>
        Edit
      </button>
    </article>
  );
}

function placeImageStyle(imageUrl: string | null | undefined) {
  return { backgroundImage: `url("${imageUrl || DEFAULT_PLACE_IMAGE_URL}")` };
}

function NomosFolder({
  nomos,
  placeCount,
  onOpen,
  onEdit,
}: {
  nomos: Nomos;
  placeCount: number;
  onOpen: () => void;
  onEdit: () => void;
}) {
  return (
    <article className="nomosFolder">
      <button type="button" className="folderOpenButton" onClick={onOpen}>
        <div
          className={`folderImage${nomos.image ? "" : " folderImagePlaceholder"}`}
          style={nomos.image ? { backgroundImage: `url("${nomos.image}")` } : undefined}
        >
          {!nomos.image && <span aria-hidden="true">📁</span>}
        </div>
        <div className="folderDetails">
          <h2>{nomos.name || "Unnamed νομός"}</h2>
          <p>{placeCount} {placeCount === 1 ? "place" : "places"}</p>
        </div>
      </button>
      <button type="button" className="folderEditButton" onClick={onEdit}>
        Edit
      </button>
    </article>
  );
}

function AncientCard({
  place,
  onVisitChange,
}: {
  place: AncientPlace;
  onVisitChange: (place: AncientPlace, visited: boolean) => void;
}) {
  const router = useRouter();
  const [previewPosition, setPreviewPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  function moveVisitPreview(event: MouseEvent<HTMLElement>) {
    if (!place.visited || !place.visitPhoto) return;
    setPreviewPosition({
      x: Math.max(8, Math.min(event.clientX + 18, window.innerWidth - 280)),
      y: Math.max(8, Math.min(event.clientY + 18, window.innerHeight - 260)),
    });
  }

  return (
    <article
      className={`ancientCard${place.visited ? " ancientCardVisited" : ""}`}
      onMouseMove={moveVisitPreview}
      onMouseLeave={() => setPreviewPosition(null)}
    >
      <button
        type="button"
        className="ancientCardOpen"
        aria-label={place.name ? `Edit ${place.name}` : "Edit empty ancient place"}
        onClick={() => router.push(`/browse/${place.id}`)}
      >
        {place.image ? (
          <div
            className="ancientImage"
            role="img"
            aria-label={place.name || "Ancient place"}
            style={placeImageStyle(place.image)}
          />
        ) : (
          <div
            className="ancientImage ancientImagePlaceholder"
            role="img"
            aria-label="Default ancient place image"
            style={placeImageStyle(place.image)}
          />
        )}
        <div className="ancientDetails">
          <h2>{place.name || "Unnamed ancient"}</h2>
          <dl>
            <div><dt>Location</dt><dd>{place.location || "Not specified"}</dd></div>
            <div><dt>Altitude</dt><dd>{place.altitude || "Not specified"}</dd></div>
          </dl>
          {place.description && <p className="ancientDescription">{place.description}</p>}
        </div>
      </button>
      <label className="visitedToggle">
        <input
          type="checkbox"
          checked={place.visited}
          onChange={(event) => onVisitChange(place, event.target.checked)}
        />
        Visited
      </label>
      {previewPosition &&
        createPortal(
          <aside
            className="visitHoverPreview"
            style={{ left: previewPosition.x, top: previewPosition.y }}
            aria-hidden="true"
          >
            <div
              className="visitHoverPhoto"
              style={{ backgroundImage: `url("${place.visitPhoto}")` }}
            />
            <p>Visited on {place.visitDate}</p>
          </aside>,
          document.body,
        )}
    </article>
  );
}

export default function BrowsePage() {
  const router = useRouter();
  const [data, setData] = useState<PlacesData>(initialData);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [selectedNomosId, setSelectedNomosId] = useState<string | null>(null);
  const [browseView, setBrowseView] = useState<BrowseView>("map");
  const [fileMessage, setFileMessage] = useState("");
  const [visitPlace, setVisitPlace] = useState<AncientPlace | null>(null);
  const [visitDate, setVisitDate] = useState("");
  const [visitPhoto, setVisitPhoto] = useState("");
  const [visitError, setVisitError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setData(readData());
  }, []);

  const selectedRegion = data.regions.find(
    (region) => region.id === selectedRegionId,
  );
  const selectedNomos = data.nomoi.find((nomos) => nomos.id === selectedNomosId);
  const visiblePlaces = selectedNomosId
    ? data.places.filter((place) => place.nomosId === selectedNomosId)
    : [];

  function addAncient() {
    if (!selectedNomosId) return;
    const place = createEmptyPlace(Date.now(), selectedNomosId);
    const updatedData = { ...data, places: [...data.places, place] };
    saveData(updatedData);
    setData(updatedData);
    router.push(`/browse/${place.id}`);
  }

  function addNomos() {
    if (!selectedRegionId) return;
    const nomos = {
      ...createEmptyNomos(`nomos-${Date.now()}`),
      regionId: selectedRegionId,
    };
    const updatedData = { ...data, nomoi: [...data.nomoi, nomos] };
    saveData(updatedData);
    setData(updatedData);
    router.push(`/browse/nomos/${nomos.id}`);
  }

  function changeVisited(place: AncientPlace, visited: boolean) {
    if (visited) {
      setVisitPlace(place);
      setVisitDate(place.visitDate);
      setVisitPhoto(place.visitPhoto);
      setVisitError("");
      return;
    }

    const updatedData = {
      ...data,
      places: data.places.map((candidate) =>
        candidate.id === place.id
          ? {
              ...candidate,
              visited: false,
              visitDate: "",
              visitPhoto: "",
            }
          : candidate,
      ),
    };
    saveData(updatedData);
    setData(updatedData);
  }

  function readVisitPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setVisitError("Please upload an image file.");
      return;
    }
    if (file.size > 2_000_000) {
      setVisitError("The visit picture must be smaller than 2 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setVisitPhoto(String(reader.result));
      setVisitError("");
    };
    reader.readAsDataURL(file);
  }

  function confirmVisit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!visitPlace || !visitDate || !visitPhoto) {
      setVisitError("A visit date and picture are required.");
      return;
    }

    const updatedData = {
      ...data,
      places: data.places.map((place) =>
        place.id === visitPlace.id
          ? { ...place, visited: true, visitDate, visitPhoto }
          : place,
      ),
    };
    saveData(updatedData);
    setData(updatedData);
    setVisitPlace(null);
  }

  function exportPlaces() {
    const blob = new Blob([JSON.stringify(createSaveFile(data), null, 2)], {
      type: "application/json",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "explore-the-ancients-save.json";
    link.click();
    URL.revokeObjectURL(downloadUrl);
    setFileMessage("Save file exported.");
  }

  async function importPlaces(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const importedData = parseSaveFile(await file.text());
      saveData(importedData);
      setData(importedData);
      setSelectedRegionId(null);
      setSelectedNomosId(null);
      setFileMessage(
        `Imported ${importedData.nomoi.length} νομοί and ${importedData.places.length} places.`,
      );
    } catch (error) {
      setFileMessage(error instanceof Error ? error.message : "Import failed.");
    }
  }

  return (
    <main className="browsePage">
      <BrowseViewToggle value={browseView} onChange={setBrowseView} />
      <h1>
        {selectedNomos
          ? selectedNomos.name
          : selectedRegion
            ? selectedRegion.name
            : "Browse the Ancients"}
      </h1>

      {selectedNomos ? (
        <>
          <button
            type="button"
            className="backButton"
            onClick={() => setSelectedNomosId(null)}
          >
            ← {selectedRegion?.name || "All νομοί"}
          </button>
          <section className="ancientGrid" aria-label={`Places in ${selectedNomos.name}`}>
            {visiblePlaces.map((place) => (
              <AncientCard
                key={place.id}
                place={place}
                onVisitChange={changeVisited}
              />
            ))}
            {visiblePlaces.length === 0 && (
              <p className="emptyMessage">No ancient places have been added here yet.</p>
            )}
          </section>
          <button type="button" className="addAncientButton" onClick={addAncient}>
            Add an Ancient
          </button>
        </>
      ) : selectedRegion ? (
        <section className="nomoiGrid" aria-label="Νομοί of Greece">
          <button
            type="button"
            className="backButton regionBackButton"
            onClick={() => setSelectedRegionId(null)}
          >
            ← All regions
          </button>
          {data.nomoi
            .filter((nomos) => nomos.regionId === selectedRegion.id)
            .map((nomos) => (
            <NomosFolder
              key={nomos.id}
              nomos={nomos}
              placeCount={data.places.filter((place) => place.nomosId === nomos.id).length}
              onOpen={() => setSelectedNomosId(nomos.id)}
              onEdit={() => router.push(`/browse/nomos/${nomos.id}`)}
            />
          ))}
        </section>
      ) : (
        browseView === "map" ? (
          <GreeceNomosMap
            regions={data.regions.map((region) => ({
              id: region.id,
              name: region.name,
              image: region.image,
            }))}
            nomoi={data.nomoi.map((nomos) => ({
              id: nomos.id,
              regionId: nomos.regionId,
              name: nomos.name,
              image: nomos.image,
              placeCount: data.places.filter(
                (place) => place.nomosId === nomos.id,
              ).length,
            }))}
            onSelect={(selectedId) => {
              const nomos = data.nomoi.find((item) => item.id === selectedId);
              setSelectedRegionId(nomos?.regionId ?? null);
              setSelectedNomosId(selectedId);
            }}
            onRegionSelect={(regionId) => {
              setSelectedNomosId(null);
              setSelectedRegionId(regionId);
            }}
          />
        ) : (
          <section className="regionsGrid" aria-label="Regions of Greece">
            {data.regions.map((region) => (
              <RegionFolder
                key={region.id}
                region={region}
                nomosCount={data.nomoi.filter(
                  (nomos) => nomos.regionId === region.id,
                ).length}
                onOpen={() => setSelectedRegionId(region.id)}
                onEdit={() => router.push(`/browse/regions/${region.id}`)}
              />
            ))}
          </section>
        )
      )}

      <div className="browseActions">
        {selectedRegion && !selectedNomos && (
          <button type="button" className="addAncientButton" onClick={addNomos}>
            Add a Νομός
          </button>
        )}
        <button type="button" className="secondaryButton" onClick={exportPlaces}>
          Export Save
        </button>
        <button
          type="button"
          className="secondaryButton"
          onClick={() => fileInputRef.current?.click()}
        >
          Import Save
        </button>
        <input
          ref={fileInputRef}
          className="visuallyHidden"
          type="file"
          accept="application/json,.json"
          onChange={importPlaces}
        />
      </div>
      {fileMessage && <p className="fileMessage" role="status">{fileMessage}</p>}

      {visitPlace && (
        <div className="visitModalBackdrop">
          <form className="visitModal" onSubmit={confirmVisit}>
            <h2>Mark as Visited</h2>
            <p>{visitPlace.name || "Unnamed ancient"}</p>
            <label>
              Visit date
              <input
                type="date"
                value={visitDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setVisitDate(event.target.value)}
                required
              />
            </label>
            <label>
              Visit picture
              <input type="file" accept="image/*" onChange={readVisitPhoto} required={!visitPhoto} />
            </label>
            {visitPhoto && (
              <div
                className="visitPhotoPreview"
                role="img"
                aria-label="Visit preview"
                style={{ backgroundImage: `url("${visitPhoto}")` }}
              />
            )}
            {visitError && <p className="visitError" role="alert">{visitError}</p>}
            <div className="editActions">
              <button type="button" className="secondaryButton" onClick={() => setVisitPlace(null)}>
                Cancel
              </button>
              <button type="submit" className="addAncientButton">Confirm Visit</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
