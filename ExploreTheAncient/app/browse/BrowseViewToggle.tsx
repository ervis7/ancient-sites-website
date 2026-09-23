"use client";

export type BrowseView = "map" | "folder";

export default function BrowseViewToggle({
  value,
  onChange,
}: {
  value: BrowseView;
  onChange: (view: BrowseView) => void;
}) {
  return (
    <div className="browseViewToggle" role="group" aria-label="Browse view">
      <span>View</span>
      <button
        type="button"
        className={value === "map" ? "browseViewOptionActive" : ""}
        aria-pressed={value === "map"}
        onClick={() => onChange("map")}
      >
        Map
      </button>
      <button
        type="button"
        className={value === "folder" ? "browseViewOptionActive" : ""}
        aria-pressed={value === "folder"}
        onClick={() => onChange("folder")}
      >
        Folder
      </button>
    </div>
  );
}
