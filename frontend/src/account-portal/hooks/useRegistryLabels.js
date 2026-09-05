import { useState, useEffect } from "react";
import { fetchRegistryLabelsApi } from "../services/registryLabelsApi";

// "Department" and "Process" are Super Admin-managed Master Registry names,
// not fixed text — this fetches the live names so every screen follows a
// rename in Tab 1 automatically. Falls back to the current defaults if the
// call fails, so a transient error never breaks the page.
export default function useRegistryLabels() {
  const [labels, setLabels] = useState({ department_label: "Department", process_label: "Process" });

  useEffect(() => {
    let cancelled = false;
    fetchRegistryLabelsApi()
      .then((data) => !cancelled && setLabels(data))
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return labels;
}
