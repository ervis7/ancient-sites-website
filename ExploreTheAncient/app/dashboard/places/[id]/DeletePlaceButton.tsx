"use client";

import { useTransition } from "react";
import { deletePlace } from "../../actions";

export default function DeletePlaceButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="dangerButton"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Delete this place permanently?")) return;
        startTransition(async () => {
          await deletePlace(id);
        });
      }}
    >
      {pending ? "Deleting…" : "Delete place"}
    </button>
  );
}
