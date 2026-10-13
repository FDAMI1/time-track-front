import { useEffect } from "react";

// Moves back to the last page that still exists. Without this, deleting the
// only row on the last page leaves the list on an empty page that is past the
// end, with no rows and a "Page 3 of 2" label.
// `ready` must be true only once real data for the current page has arrived,
// otherwise the loading state (total 0) would reset the page.
export function useClampPage(page: number, setPage: (page: number) => void, totalPages: number, ready: boolean) {
  useEffect(() => {
    if (ready && page > totalPages) setPage(Math.max(1, totalPages));
  }, [ready, page, totalPages, setPage]);
}
