"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { initialNomoi } from "@/app/browse/places";
import { DEFAULT_PLACE_IMAGE_URL } from "@/app/placeImages";
import { updatePlace } from "../../actions";
import DeletePlaceButton from "./DeletePlaceButton";

type RichTextValue = string[] | string | null;

type PlaceDetails = {
  id: string;
  user_id: string;
  nomos_id: string;
  name: string;
  location: string;
  altitude: string;
  description: string;
  category: RichTextValue;
  historical_period: RichTextValue;
  construction_date: string | null;
  main_use_period: string | null;
  destruction_or_end: string | null;
  built_by: string | null;
  purpose: string | null;
  use_changed_description: string | null;
  access_level: string | null;
  access_description: string | null;
  ancient_affiliation: string | null;
  connected_monuments: RichTextValue;
  image_suggestion: string | null;
  monument_seed_id: string | null;
  data_confidence: string | null;
  needs_manual_review: boolean | null;
  import_review_report: string | null;
  source_keys: RichTextValue;
  image_url: string;
  latitude: number | null;
  longitude: number | null;
  visibility: "private" | "public";
};

type RelatedPlace = {
  id: string;
  name: string;
  location: string | null;
  image_url: string | null;
  relation_type: string | null;
  notes: string | null;
};

function asList(value: RichTextValue | undefined) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function placeImageStyle(imageUrl: string | null | undefined) {
  return { backgroundImage: `url("${imageUrl || DEFAULT_PLACE_IMAGE_URL}")` };
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  if (!children) return null;

  return (
    <section className="placeDetailSection">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function DetailText({ value }: { value: string | null | undefined }) {
  return hasText(value) ? <p>{value}</p> : null;
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return hasText(value) ? (
    <div className="placeDetailInfoRow">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  ) : null;
}

function BadgeList({ values }: { values: Array<RichTextValue | undefined> }) {
  const badges = values.flatMap(asList);
  if (!badges.length) return null;

  return (
    <div className="placeDetailBadges">
      {badges.map((badge) => (
        <span key={badge}>{badge}</span>
      ))}
    </div>
  );
}

export default function PlaceDetailView({
  place,
  canEdit,
  relatedPlaces,
}: {
  place: PlaceDetails;
  canEdit: boolean;
  relatedPlaces: {
    parentPlaces: RelatedPlace[];
    childPlaces: RelatedPlace[];
  };
}) {
  const [editing, setEditing] = useState(false);
  const nomos = initialNomoi.find((item) => item.id === place.nomos_id);
  const mapQuery =
    place.latitude !== null && place.longitude !== null
      ? `${place.latitude},${place.longitude}`
      : place.location || "Greece";
  const mapSource = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=14&output=embed`;
  const directionsDestination =
    place.latitude !== null && place.longitude !== null
      ? `${place.latitude},${place.longitude}`
      : place.location;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    directionsDestination || "Greece",
  )}&travelmode=driving`;
  const connectedMonuments = asList(place.connected_monuments);
  const sourceKeys = asList(place.source_keys);

  return (
    <main className="placeDetailPage">
      <div className="placeDetailTopbar">
        <Link href="/dashboard" className="secondaryButton">Back</Link>
        {canEdit && (
          <button
            type="button"
            className="placeDetailEditButton"
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
        )}
      </div>

      <article className="placeDetailWindow">
        {place.image_url ? (
          <div
            className="placeDetailImage"
            role="img"
            aria-label={place.name}
            style={placeImageStyle(place.image_url)}
          />
        ) : (
          <div
            className="placeDetailImage placeDetailImagePlaceholder"
            role="img"
            aria-label="Default ancient place image"
            style={placeImageStyle(place.image_url)}
          />
        )}
        <div className="placeDetailContent">
          <span className={`visibilityBadge visibilityBadge${place.visibility === "public" ? "Public" : "Private"}`}>
            {place.visibility}
          </span>
          <h1>{place.name}</h1>
          <BadgeList values={[place.category, place.historical_period]} />
          <dl className="placeDetailFacts">
            <div><dt>Nomos</dt><dd>{nomos?.name ?? place.nomos_id}</dd></div>
            <div><dt>Location</dt><dd>{place.location || "Not specified"}</dd></div>
            <div><dt>Altitude</dt><dd>{place.altitude || "Not specified"}</dd></div>
            <div>
              <dt>Coordinates</dt>
              <dd>
                {place.latitude !== null && place.longitude !== null
                  ? `${place.latitude}, ${place.longitude}`
                  : "Not specified"}
              </dd>
            </div>
          </dl>

          <DetailSection title="Περιγραφή">
            <DetailText value={place.description} />
          </DetailSection>

          <DetailSection title="Χρονολόγηση">
            {(hasText(place.construction_date) ||
              hasText(place.main_use_period) ||
              hasText(place.destruction_or_end)) && (
              <dl className="placeDetailInfoList">
                <DetailField label="Κατασκευή" value={place.construction_date} />
                <DetailField label="Κύρια χρήση" value={place.main_use_period} />
                <DetailField label="Τέλος / καταστροφή" value={place.destruction_or_end} />
              </dl>
            )}
          </DetailSection>

          <DetailSection title="Ποιος το έχτισε και γιατί">
            {(hasText(place.built_by) || hasText(place.purpose)) && (
              <dl className="placeDetailInfoList">
                <DetailField label="Ποιος" value={place.built_by} />
                <DetailField label="Γιατί" value={place.purpose} />
              </dl>
            )}
          </DetailSection>

          <DetailSection title="Αλλαγή χρήσης">
            <DetailText value={place.use_changed_description} />
          </DetailSection>

          <DetailSection title="Πρόσβαση">
            {(hasText(place.access_level) || hasText(place.access_description)) && (
              <dl className="placeDetailInfoList">
                <DetailField label="Επίπεδο" value={place.access_level} />
                <DetailField label="Περιγραφή" value={place.access_description} />
              </dl>
            )}
          </DetailSection>

          <DetailSection title="Αρχαία περιοχή / πόλη">
            <DetailText value={place.ancient_affiliation} />
          </DetailSection>

          <DetailSection title="Συνδεδεμένα μνημεία">
            {connectedMonuments.length > 0 && (
              <ul className="placeDetailInlineList">
                {connectedMonuments.map((monument) => (
                  <li key={monument}>{monument}</li>
                ))}
              </ul>
            )}
          </DetailSection>

          <DetailSection title="Connected places">
            {(relatedPlaces.parentPlaces.length > 0 ||
              relatedPlaces.childPlaces.length > 0) && (
              <div className="relatedPlaceGroups">
                {relatedPlaces.parentPlaces.length > 0 && (
                  <div>
                    <h3>Belongs to</h3>
                    <div className="relatedPlaceGrid">
                      {relatedPlaces.parentPlaces.map((relatedPlace) => (
                        <Link
                          key={relatedPlace.id}
                          href={`/dashboard/places/${relatedPlace.id}`}
                          className="relatedPlaceLink"
                        >
                          <span
                            className={`relatedPlaceImage${relatedPlace.image_url ? "" : " relatedPlaceImagePlaceholder"}`}
                            style={placeImageStyle(relatedPlace.image_url)}
                            aria-hidden="true"
                          />
                          <span>
                            <strong>{relatedPlace.name}</strong>
                            {relatedPlace.location && <small>{relatedPlace.location}</small>}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {relatedPlaces.childPlaces.length > 0 && (
                  <div>
                    <h3>Subpoints</h3>
                    <div className="relatedPlaceGrid">
                      {relatedPlaces.childPlaces.map((relatedPlace) => (
                        <Link
                          key={relatedPlace.id}
                          href={`/dashboard/places/${relatedPlace.id}`}
                          className="relatedPlaceLink"
                        >
                          <span
                            className={`relatedPlaceImage${relatedPlace.image_url ? "" : " relatedPlaceImagePlaceholder"}`}
                            style={placeImageStyle(relatedPlace.image_url)}
                            aria-hidden="true"
                          />
                          <span>
                            <strong>{relatedPlace.name}</strong>
                            {relatedPlace.location && <small>{relatedPlace.location}</small>}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DetailSection>

          <DetailSection title="Image suggestion">
            <DetailText value={place.image_suggestion} />
          </DetailSection>

          <DetailSection title="Import report">
            {(place.needs_manual_review ||
              hasText(place.import_review_report) ||
              hasText(place.data_confidence) ||
              hasText(place.monument_seed_id) ||
              sourceKeys.length > 0) && (
              <dl className="placeDetailInfoList">
                {place.needs_manual_review && (
                  <div className="placeDetailInfoRow placeDetailReviewRow">
                    <dt>Status</dt>
                    <dd>Needs manual review</dd>
                  </div>
                )}
                <DetailField label="Seed id" value={place.monument_seed_id} />
                <DetailField label="Confidence" value={place.data_confidence} />
                <DetailField label="Report" value={place.import_review_report} />
                {sourceKeys.length > 0 && (
                  <div className="placeDetailInfoRow">
                    <dt>Sources</dt>
                    <dd>{sourceKeys.join(", ")}</dd>
                  </div>
                )}
              </dl>
            )}
          </DetailSection>

          <iframe
            className="mapFrame placeDetailMap"
            title={`Map location for ${place.name}`}
            src={mapSource}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <a
            className="googleMapsTripButton"
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
          >
            <span aria-hidden="true">↗</span>
            Start trip in Google Maps
          </a>
        </div>
      </article>

      {editing && (
        <div
          className="regionEditBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditing(false);
          }}
        >
          <section
            className="regionEditModal placeEditModal noWindowAnimation"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-place-title"
          >
            <button
              type="button"
              className="panelClose"
              aria-label="Close edit window"
              onClick={() => setEditing(false)}
            >
              X
            </button>
            <h2 id="edit-place-title">Edit Ancient Place</h2>
            <form
              action={updatePlace.bind(null, place.id)}
              className="dashboardForm"
            >
              <input type="hidden" name="returnTo" value={`/dashboard/places/${place.id}`} />
              <label>
                Nomos
                <select name="nomosId" defaultValue={place.nomos_id} required>
                  {initialNomoi.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label>Name<input name="name" defaultValue={place.name} required /></label>
              <label>Location<input name="location" defaultValue={place.location} required /></label>
              <label>Altitude<input name="altitude" defaultValue={place.altitude} /></label>
              <label>Picture URL<input name="imageUrl" defaultValue={place.image_url} /></label>
              <label>Description<textarea name="description" defaultValue={place.description} rows={5} /></label>
              <label>Category<input name="category" defaultValue={asList(place.category).join(", ")} /></label>
              <label>Historical period<input name="historicalPeriod" defaultValue={asList(place.historical_period).join(", ")} /></label>
              <label>Construction date<input name="constructionDate" defaultValue={place.construction_date ?? ""} /></label>
              <label>Main use period<input name="mainUsePeriod" defaultValue={place.main_use_period ?? ""} /></label>
              <label>Destruction or end<input name="destructionOrEnd" defaultValue={place.destruction_or_end ?? ""} /></label>
              <label>Built by<input name="builtBy" defaultValue={place.built_by ?? ""} /></label>
              <label>Purpose<textarea name="purpose" defaultValue={place.purpose ?? ""} rows={3} /></label>
              <label>Use changed description<textarea name="useChangedDescription" defaultValue={place.use_changed_description ?? ""} rows={3} /></label>
              <label>Access level<input name="accessLevel" defaultValue={place.access_level ?? ""} /></label>
              <label>Access description<textarea name="accessDescription" defaultValue={place.access_description ?? ""} rows={3} /></label>
              <label>Ancient affiliation<input name="ancientAffiliation" defaultValue={place.ancient_affiliation ?? ""} /></label>
              <label>Connected monuments<input name="connectedMonuments" defaultValue={connectedMonuments.join(", ")} /></label>
              <label>Image suggestion<textarea name="imageSuggestion" defaultValue={place.image_suggestion ?? ""} rows={3} /></label>
              <div className="coordinateFields">
                <label>
                  Latitude
                  <input name="latitude" type="number" step="any" min="-90" max="90" defaultValue={place.latitude ?? ""} />
                </label>
                <label>
                  Longitude
                  <input name="longitude" type="number" step="any" min="-180" max="180" defaultValue={place.longitude ?? ""} />
                </label>
              </div>
              <div className="editActions">
                <DeletePlaceButton id={place.id} />
                <span className="editActionSpacer" />
                <button type="button" className="secondaryButton" onClick={() => setEditing(false)}>
                  Cancel
                </button>
                <button className="addAncientButton">Save place</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
