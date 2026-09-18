import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import TrainingDashboardView from "../../shared/TrainingDashboardView";
import {
  fetchTeamFilterOptionsApi, fetchTeamSummaryApi, fetchTeamCoursesApi,
  fetchTeamCourseModulesApi, fetchTeamRecordsApi
} from "../services/teamDashboardApi";

export default function TeamTrainingDashboard() {
  const [filterOptions, setFilterOptions] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchTeamFilterOptionsApi().then(setFilterOptions).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="p-6 max-w-3xl mx-auto"><div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded">{error}</div></div>;
  if (!filterOptions) return <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  return (
    <TrainingDashboardView
      scope="account_admin"
      title="Team Training Dashboard"
      api={{
        fetchSummary: fetchTeamSummaryApi,
        fetchCourses: fetchTeamCoursesApi,
        fetchCourseModules: fetchTeamCourseModulesApi,
        fetchRecords: fetchTeamRecordsApi,
      }}
      departmentList={filterOptions.departments}
      processList={filterOptions.processes}
      roles={filterOptions.roles}
    />
  );
}
