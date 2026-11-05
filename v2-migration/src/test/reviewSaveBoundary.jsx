import { vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";

// Producer tests verify the review payload, not authentication/IndexedDB.
// Real sign-in, project selection and failed writes are covered in ReviewSaveDialog.smoke.test.jsx.
vi.mock("@/components/ReviewSaveDialog", async () => {
  const { useAppStore } = await import("@/store/useDataStore");
  return { default: function SaveBoundary({ record, records, onSaved, onClose, onConfirm }) {
    return <button onClick={async () => {
      // This boundary represents a verified signed-in Pro user.
      useAppStore.getState().setEntitlement({ plan: "paid", account: true, expiresAt: Date.now() + 86400000, offlineUntil: Date.now() + 86400000 });
      if (onConfirm) {
        // Producer-only boundary. Persistence failures are tested with the real dialog/store.
        useAppStore.setState({ commitDecisionRecords: records => { useAppStore.setState({ decisionRecords: records }); return Promise.resolve({ decisions: records }); } });
        await onConfirm();
      }
      else {
        // A plan saves several records in one transaction; the boundary adds them in order.
        for (const item of records?.length ? records : [record]) useAppStore.getState().addDecisionRecord(item);
        onSaved?.({ record: useAppStore.getState().decisionRecords[0], records: useAppStore.getState().decisionRecords, project: { id: "default" } });
      }
      onClose();
    }}>Confirm authenticated review save</button>;
  } };
});

export function confirmReviewSave() {
  fireEvent.click(screen.getByRole("button", { name: "Confirm authenticated review save" }));
}
