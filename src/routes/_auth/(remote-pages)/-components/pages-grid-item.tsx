// Copyright 2026 hyAway contributors
// SPDX-License-Identifier: Apache-2.0

import { Link } from "@tanstack/react-router";
import { memo } from "react";
import { PageGroupPath } from "./page-group-path";
import { HighlightedText } from "./pages-highlighted-text";
import { Item, ItemContent, ItemTitle } from "@/components/ui-primitives/item";
import { ThumbnailImage } from "@/components/thumbnail-gallery/thumbnail-gallery-item";
import {
  formatHiddenFileCount,
  getHiddenFileCount,
  getVisibleFileIds,
} from "@/integrations/hydrus-api/queries/file-metadata-cache";
import { useGetPageInfoQuery } from "@/integrations/hydrus-api/queries/manage-pages";
import { PageState } from "@/integrations/hydrus-api/models";
import { Skeleton } from "@/components/ui-primitives/skeleton";
import { Spinner } from "@/components/ui-primitives/spinner";
import { cn } from "@/lib/utils";
import {
  // DEFAULT_PAGE_CARD_WIDTH,
  // PAGE_CARD_ASPECT_RATIO,
  usePagesUseFriendlyUrls,
} from "@/stores/pages-settings-store";

const PAGE_STATE_LABELS: Partial<Record<PageState, string>> = {
  [PageState.INITIALIZING]: "Initializing…",
  [PageState.SEARCHING_LOADING]: "Searching…",
  [PageState.SEARCH_CANCELLED]: "Cancelled",
};

export interface PagesGridItemProps {
  pageKey: string;
  pageName: string;
  pageSlug: string;
  index: number;
  className?: string;
  tabIndex?: number;
  setLinkRef?: (el: HTMLAnchorElement | null, index: number) => void;
  onItemFocus?: (index: number) => void;
  labelRef?: (el: HTMLSpanElement | null) => void;
  getGroupLabelRef?: (index: number) => (el: HTMLSpanElement | null) => void;
  highlightQuery?: string;
  useCustomHighlight?: boolean;
  groupLabel?: string;
  groupStripeColorsByLevel?: Array<string | null>;
  badgeLabel?: string;
  cardHeight?: number;
}

export const PagesGridItem = memo(function PagesGridItemMemo({
  pageKey,
  pageName,
  pageSlug,
  index,
  className,
  tabIndex = 0,
  setLinkRef,
  onItemFocus,
  labelRef,
  getGroupLabelRef,
  highlightQuery = "",
  useCustomHighlight = false,
  groupLabel,
  groupStripeColorsByLevel = [],
  badgeLabel,
}: PagesGridItemProps) {
  const { data, isLoading } = useGetPageInfoQuery(pageKey, true);
  const useFriendlyUrls = usePagesUseFriendlyUrls();
  const activeStripeColors = groupStripeColorsByLevel.filter(
    (color): color is string => Boolean(color),
  );

  const pageState = data?.page_info.page_state;
  const pageStateLabel = pageState ? PAGE_STATE_LABELS[pageState] : undefined;

  const linkPageId = useFriendlyUrls ? pageSlug : pageKey;
  const previewAspectClass = "aspect-square";

  const visibleFileIds = data
    ? getVisibleFileIds(data.page_info.media.hash_ids, data)
    : [];
  const totalFiles = visibleFileIds.length;
  // Immer maximal 4 Vorschaubilder zeigen, der Zähler wandert jetzt in die
  // Pfad-Zeile statt eine Bildkachel zu belegen.
  const maxThumbnails = 4;
  const remainingFiles = Math.max(totalFiles - maxThumbnails, 0);
  const previewFileIds = visibleFileIds.slice(0, maxThumbnails);
  const emptySlots = Math.max(0, maxThumbnails - previewFileIds.length);

  return (
    <Item
      render={
        <Link
          ref={(el) => setLinkRef?.(el, index)}
          to="/pages/$pageId"
          params={{ pageId: linkPageId }}
          aria-label={`View page "${pageName}" with ${totalFiles} ${totalFiles === 1 ? "file" : "files"}`}
          tabIndex={tabIndex}
          onFocus={() => onItemFocus?.(index)}
        />
      }
      variant="muted"
      size="xs"
      className={cn("relative flex h-full flex-col flex-nowrap items-stretch", className)}
    >
      {badgeLabel ? (
        <span className="absolute top-1.5 right-1.5 z-10 rounded-full bg-primary/80 px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
          {badgeLabel}
        </span>
      ) : null}

      {/* Bildvorschau-Grid: nimmt jetzt immer 4 volle Bildkacheln ein, kein "+N"-Feld mehr hier */}
      {isLoading ? (
        <ItemContent>
          <div className="flex aspect-square items-center justify-center text-muted-foreground text-xs">
            Loading…
          </div>
        </ItemContent>
      ) : previewFileIds.length > 0 ? (
        <ItemContent>
          <div
            className="grid grid-cols-2 gap-2"
            role="img"
            aria-label={`Preview of ${totalFiles} files`}
          >
            {previewFileIds.map((fileId) => (
              <div
                key={fileId}
                className={cn("bg-muted overflow-hidden rounded", previewAspectClass)}
              >
                <ThumbnailImage fileId={fileId} className="h-full w-full object-cover" />
              </div>
            ))}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className={cn("bg-muted/40 rounded", previewAspectClass)}
              />
            ))}
          </div>
        </ItemContent>
      ) : pageStateLabel ? (
        <ItemContent>
          <div className="flex aspect-square flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
            {pageState !== PageState.SEARCH_CANCELLED && <Spinner className="size-4" />}
            {pageStateLabel}
          </div>
        </ItemContent>
      ) : (
        <ItemContent>
          <div className="flex aspect-square items-center justify-center text-muted-foreground text-xs">
            {data ? formatHiddenFileCount(getHiddenFileCount(data)) || "No files" : "No files"}
          </div>
        </ItemContent>
      )}

      {remainingFiles > 0 && (
        <span
          className="shrink-0 self-end w-max bg-primary/80 px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground -mt-6"
          aria-label={`${remainingFiles} more files`}
        >
          +{remainingFiles}
        </span>
      )}


      {/* Gruppen-Streifen: bleiben als schmale Linie zwischen Bildern und Pfad-Zeile */}
      {activeStripeColors.length > 0 && (
        <div className="flex gap-1 px-0.5">
          {activeStripeColors.map((color, colorIndex) => (
            <span
              key={colorIndex}
              className="h-1 w-full rounded-full"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      )}

      {/* Titel- und Pfadbereich: liegt jetzt unter den Bildern statt darüber, kein Blur mehr */}
      <ItemTitle className="mt-auto block w-full min-w-0 items-center gap-2 text-sm/5 wrap-break-word">
        <div className="flex flex-col gap-0.5 rounded-lg bg-transparent px-1 py-1">
          <PageGroupPath
            groupLabel={groupLabel}
            stripeColorsByLevel={groupStripeColorsByLevel}
            highlightQuery={highlightQuery}
            useCustomHighlight={useCustomHighlight}
            getGroupLabelRef={getGroupLabelRef}
            className="min-w-0 flex-1"
          />
          <span
            ref={labelRef}
            className="line-clamp-2 block min-h-5 break-all"
          >
            <HighlightedText
              text={pageName}
              query={highlightQuery}
              useCustomHighlight={useCustomHighlight}
            />
          </span>
        </div>
      </ItemTitle>
    </Item>
  );
});

export function PagesGridItemSkeleton({
  className,
  width,
  height,
}: {
  className?: string;
  width?: number;
  height?: number;
}) {
  return (
    <div
      className={cn("relative flex flex-col gap-2.5 rounded-2xl border border-transparent bg-muted/50 p-2.5", className)}
      style={{ width, height }}
    >
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded" />
        ))}
      </div>
      <Skeleton className="h-8 w-full rounded-lg" />
    </div>
  );
}