import { vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";

// Producer tests verify the review payload, not authentication/IndexedDB.
// Real sign-in, project selection and failed writes are covered in ReviewSaveDialog.smoke.test.jsx.
vi.mock("@/components/ReviewSaveDialog", async () => {
  const { useAppStore } = await import("@/store/useDataStore");
  return { default: function SaveBoundary({ record, onSaved, onClose, onConfirm }) {
    return <button onClick={() => {
      if (onConfirm) onConfirm();
      else {
        useAppStore.getState().addDecisionRecord(record);
        onSaved?.({ record: useAppStore.getState().decisionRecords[0], project: { id: "default" } });
      }
      onClose();
    }}>Confirm authenticated review save</button>;
  } };
});

export function confirmReviewSave() {
  fireEvent.click(screen.getByRole("button", { name: "Confirm authenticated review save" }));
}
