"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { surveyApi } from "@/api/survey";
import { toast } from "sonner";
import {
  IconPlus,
  IconLayoutList,
  IconDotsVertical,
  IconCopy,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { motion, AnimatePresence } from "framer-motion";
import { Surveys } from "@/src/shared/types/survey";
import NewSurveyModal from "@/components/SurveyModal";
import { toUserMessage } from "@/lib/api-error";
import { jetBrainsMono } from "@/app/dashboard/layout";
import { cn } from "@/lib/utils";
import {
  getStoredUserScopes,
  hasPermission,
  PERMISSIONS,
} from "@/lib/permissions";

export default function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [surveys, setSurveys] = useState<Surveys[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [canCreateSurvey, setCanCreateSurvey] = useState(false);
  const [canDeleteSurvey, setCanDeleteSurvey] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSurveys, setTotalSurveys] = useState(0);
  const pageSize = 10;
  const searchTerm = searchParams.get("search")?.trim() ?? "";

  useEffect(() => {
    const scopes = getStoredUserScopes();
    setCanCreateSurvey(hasPermission(scopes, PERMISSIONS.SURVEY_CREATE));
    setCanDeleteSurvey(hasPermission(scopes, PERMISSIONS.SURVEY_DELETE));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchSurveys(searchTerm, currentPage, controller.signal);
    return () => controller.abort();
  }, [searchTerm, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-survey-menu-root='true']")) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  const fetchSurveys = async (search: string, page: number, signal?: AbortSignal) => {
    if (!signal?.aborted) {
      setFetchError(null);
    }
    try {
      const result = await surveyApi.getSurveys({ signal, search, page, limit: pageSize });
      setSurveys(result.data);
      setTotalPages(result.meta.totalPages || 1);
      setTotalSurveys(result.meta.total || result.data.length);
    } catch (error) {
      if (signal?.aborted) return;
      console.error("Failed to fetch surveys:", error);
      const message = toUserMessage(error, "Failed to load surveys");
      setFetchError(message);
      toast.error(message);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="p-8 md:p-12 relative">
      {/* Page Title */}
      <NewSurveyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {}} // Modal handles redirect
      />

      <div className="max-w-6xl mx-auto flex items-baseline justify-between mb-8 border-b border-border/60 pb-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Active Surveys
          </h1>
          <p className="text-xs text-muted-foreground">
            Overview of running data collection tasks. ({totalSurveys} total)
          </p>
        </motion.div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-48 bg-muted rounded-2xl animate-pulse border border-border"
                />
              ))}
            </motion.div>
          ) : fetchError ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-20 bg-card border border-border rounded-2xl"
            >
              <h3 className="text-xl font-bold text-foreground mb-2">
                Could not load surveys
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {fetchError}
              </p>
              <button
                onClick={() => {
                  setLoading(true);
                  fetchSurveys(searchTerm, currentPage);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-all"
              >
                Retry
              </button>
            </motion.div>
          ) : surveys.length > 0 ? (
            <motion.div
              key="grid"
              initial="hidden"
              animate="visible"
              variants={{
                visible: { transition: { staggerChildren: 0.1 } },
              }}
              className="border border-border/60 rounded-xl overflow-visible bg-background"
            >
              <table className="w-full text-left table-fixed">
                <thead>
                  <tr
                    className={`border-b border-border/60 bg-muted/30 text-[10px] uppercase text-muted-foreground tracking-wider ${jetBrainsMono.className}`}
                  >
                    <th className="px-6 py-4 font-normal w-1/3">
                      Survey ID / Name
                    </th>
                    <th className="px-6 py-4 font-normal">Status</th>
                    <th className="px-6 py-4 font-normal hidden sm:table-cell">
                      Client
                    </th>
                    <th className="px-6 py-4 font-normal text-right hidden md:table-cell">
                      Modified
                    </th>
                    <th className="px-6 py-4 font-normal text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {surveys.map((survey, i) => (
                    <motion.tr
                      key={survey.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="hover:bg-primary/5 transition-colors group cursor-pointer relative"
                      onClick={() =>
                        router.push(`/dashboard/surveys/${survey.id}`)
                      }
                    >
                      <td className="px-6 py-4 border-l-2 border-transparent group-hover:border-primary transition-colors">
                        <div
                          className={`text-xs text-muted-foreground group-hover:text-primary/80 transition-colors mb-1 ${jetBrainsMono.className}`}
                        >
                          ID-{survey.id.slice(-8).toUpperCase()}
                        </div>
                        <div className="text-sm font-medium text-foreground truncate">
                          {survey.name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            `text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-md ${jetBrainsMono.className}`,
                            survey.status !== "live" &&
                              "bg-secondary text-secondary-foreground border-border",
                          )}
                        >
                          {survey.status.toUpperCase()}
                        </span>
                      </td>
                      <td
                        className={`px-6 py-4 hidden sm:table-cell text-sm text-foreground ${jetBrainsMono.className}`}
                      >
                        {survey.client || "-"}
                      </td>
                      <td
                        className={`px-6 py-4 text-right hidden md:table-cell text-xs text-muted-foreground group-hover:text-foreground transition-colors ${jetBrainsMono.className}`}
                      >
                        {new Date(survey.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div
                          className="flex justify-end opacity-100 group-hover:opacity-100 transition-opacity relative"
                          data-survey-menu-root="true"
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId((prev) =>
                                prev === survey.id ? null : survey.id,
                              );
                            }}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            aria-label="Open survey actions"
                          >
                            <IconDotsVertical size={16} />
                          </button>

                          {openMenuId === survey.id && (
                            <div className="absolute right-0 top-10 z-20 w-40 rounded-md border border-border/70 bg-background shadow-lg p-1">
                              {" "}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  router.push(
                                    `/dashboard/surveys/${survey.id}`,
                                  );
                                }}
                                className={`w-full text-left text-xs text-foreground hover:bg-muted rounded px-2 py-2 transition-colors ${jetBrainsMono.className}`}
                              >
                                Build
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  router.push(
                                    `/dashboard/surveys/${survey.id}/metrics`,
                                  );
                                }}
                                className={`w-full text-left text-xs text-foreground hover:bg-muted rounded px-2 py-2 transition-colors ${jetBrainsMono.className}`}
                              >
                                Data
                              </button>
                              {canCreateSurvey && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(null);
                                    try {
                                      const duplicated =
                                        await surveyApi.duplicateSurvey(
                                          survey.id,
                                        );
                                      toast.success("Survey duplicated");
                                      await fetchSurveys(searchTerm, currentPage);
                                      router.push(
                                        `/dashboard/surveys/${duplicated.id}`,
                                      );
                                    } catch (err) {
                                      toast.error("Failed to duplicate survey");
                                    }
                                  }}
                                  className={`w-full text-left text-xs text-foreground hover:bg-muted rounded px-2 py-2 transition-colors flex items-center gap-2 ${jetBrainsMono.className}`}
                                >
                                  <IconCopy size={14} /> Duplicate
                                </button>
                              )}
                              {canDeleteSurvey && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(null);
                                    if (
                                      !confirm(
                                        "Execute command: DELETE SURVEY?",
                                      )
                                    ) {
                                      return;
                                    }
                                    try {
                                      await surveyApi.deleteSurvey(survey.id);
                                      toast.success("Survey record deleted");
                                      fetchSurveys(searchTerm, currentPage);
                                    } catch (err) {
                                      toast.error("Deletion failed");
                                    }
                                  }}
                                  className={`w-full text-left text-xs text-destructive hover:bg-destructive/10 rounded px-2 py-2 transition-colors ${jetBrainsMono.className}`}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-background/95 backdrop-blur-sm border border-primary/20 rounded-2xl p-16 text-center shadow-xl shadow-primary/5"
            >
              <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-xl text-primary mb-6 border border-primary/20">
                <IconLayoutList size={40} strokeWidth={1.5} />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-3">
                No Target Records Found
              </h3>
              <p className="text-sm text-foreground/60 mb-8 max-w-md mx-auto font-medium">
                The system database currently contains zero active or draft
                survey records. Initialize a new record to begin data
                collection.
              </p>
              {canCreateSurvey && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold text-sm tracking-wide rounded-lg hover:opacity-90 transition-all shadow-md shadow-primary/20"
                >
                  <IconPlus size={18} strokeWidth={2.5} />
                  INITIALIZE RECORD
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {totalPages > 1 && !loading && !fetchError && (
          <div className="mt-4 px-1 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                title="Previous Page"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <IconChevronLeft size={16} />
              </button>
              <button
                title="Next Page"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <IconChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
