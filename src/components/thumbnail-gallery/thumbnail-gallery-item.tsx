// Copyright 2026 hyAway contributors
// SPDX-License-Identifier: Apache-2.0

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Link, linkOptions } from "@tanstack/react-router";

import { ThumbnailGalleryItemContent } from "./thumbnail-gallery-item-content";
import { ThumbnailGalleryItemContextMenu } from "./thumbnail-gallery-item-context-menu";
import { ThumbnailGalleryItemRatingBar } from "./thumbnail-gallery-item-rating-bar";
import type { LinkOptions } from "@tanstack/react-router";
import type { FileMetadata, RatingValue } from "@/integrations/hydrus-api/models";
import {
  ContextMenu,
  ContextMenuTrigger,
} from "@/components/ui-primitives/context-menu";
import { isStaticImage } from "@/lib/mime-utils";
import { cn } from "@/lib/utils";
import {
  useGalleryEnableContextMenu,
  useGalleryEnableHoverZoom,
  useGalleryImageLoadMode,
  useGalleryOptimizeSizeThresholdMB,
  useGalleryRenderQuality,
  useGalleryShowFooter,
} from "@/stores/gallery-settings-store";

export {
  ThumbnailImage,
  type ThumbnailImageProps,
} from "./thumbnail-gallery-item-image";

export const ITEM_FOOTER_HEIGHT = 24;

export type FileLinkBuilder = (fileId: number) => LinkOptions;

export const defaultFileLinkBuilder: FileLinkBuilder = (fileId) =>
  linkOptions({
    to: "/file/$fileId",
    params: { fileId: String(fileId) },
  });

export interface ThumbnailGalleryItemProps extends React.HTMLAttributes<HTMLLIElement> {
  virtualRow: { lane: number; index: number; start: number };
  lanes: number;
  totalItemsCount: number;
  item: FileMetadata;
  width: number;
  height: number;
  scrollMargin: number;
  tabIndex?: number;
  setLinkRef?: (el: HTMLAnchorElement | null, index: number) => void;
  onItemFocus?: (index: number) => void;
  getFileLink?: FileLinkBuilder;
  onRatingToggle?: (fileId: number, serviceKey: string, newValue: RatingValue) => void;
  "aria-label"?: string;
}

export const ThumbnailGalleryItem = memo(function ThumbnailGalleryItemMemo({
  virtualRow,
  lanes,
  totalItemsCount,
  className,
  item,
  width,
  height,
  scrollMargin,
  tabIndex = 0,
  setLinkRef,
  onItemFocus,
  getFileLink = defaultFileLinkBuilder,
  onRatingToggle,
  ...props
}: ThumbnailGalleryItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const enableContextMenu = useGalleryEnableContextMenu();
  const enableHoverZoom = useGalleryEnableHoverZoom();
  const imageLoadMode = useGalleryImageLoadMode();
  const renderQuality = useGalleryRenderQuality();
  const optimizeSizeThresholdMB = useGalleryOptimizeSizeThresholdMB();
  const showFooter = useGalleryShowFooter();
  const fileLink = getFileLink(item.file_id);

  const prevLaneRef = useRef(virtualRow.lane);
  const [laneDistance, setLaneDistance] = useState(0);

  useEffect(() => {
    if (prevLaneRef.current !== virtualRow.lane) {
      setLaneDistance(Math.abs(virtualRow.lane - prevLaneRef.current));
      prevLaneRef.current = virtualRow.lane;
    } else {
      prevLaneRef.current = virtualRow.lane;
    }
  }, [virtualRow.lane]);

  const durationMultiplier = laneDistance > 0 ? Math.sqrt(laneDistance) : 1;

  const isTopRow = virtualRow.index < lanes;
  const lastRowStart = totalItemsCount - 2 * lanes;
  const isBottomRow = virtualRow.index >= lastRowStart;

  const { scale, horizontalOrigin } = useMemo(() => {
    const sourceWidth =
      imageLoadMode !== "thumbnail" && isStaticImage(item.mime)
        ? item.width
        : item.thumbnail_width;
    const baseScale = Math.min(
      Math.max(
        Math.min(lanes * width, (sourceWidth ?? width) * 1.1) / width,
        1.05,
      ),
      2.5,
    );

    const spaceLeft = virtualRow.lane;
    const spaceRight = lanes - 1 - virtualRow.lane;

    const maxScaleLeft = spaceRight + 1;
    const maxScaleRight = spaceLeft + 1;
    const maxScaleCenter = 1 + 2 * Math.min(spaceLeft, spaceRight);

    const options = [
      { origin: "left" as const, maxScale: maxScaleLeft },
      { origin: "right" as const, maxScale: maxScaleRight },
      { origin: "center" as const, maxScale: maxScaleCenter },
    ];

    options.sort((a, b) => {
      if (b.maxScale !== a.maxScale) return b.maxScale - a.maxScale;
      if (a.origin === "center") return -1;
      if (b.origin === "center") return 1;
      return 0;
    });

    const best = options[0];
    return {
      scale: Math.min(baseScale, best.maxScale),
      horizontalOrigin: best.origin,
    };
  }, [
    lanes,
    width,
    item.mime,
    item.width,
    item.thumbnail_width,
    imageLoadMode,
    virtualRow.lane,
  ]);

  const originClass = useMemo(() => {
    if (isTopRow) {
      if (horizontalOrigin === "left") return "origin-top-left";
      if (horizontalOrigin === "right") return "origin-top-right";
      return "origin-top";
    }
    if (isBottomRow) {
      if (horizontalOrigin === "left") return "origin-bottom-left";
      if (horizontalOrigin === "right") return "origin-bottom-right";
      return "origin-bottom";
    }
    if (horizontalOrigin === "left") return "origin-left";
    if (horizontalOrigin === "right") return "origin-right";
    return "origin-center";
  }, [isTopRow, isBottomRow, horizontalOrigin]);

  return (
    <li
      style={{
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${(virtualRow.lane * 100) / lanes}cqw, ${virtualRow.start - scrollMargin}px)`,
        containIntrinsicSize: `${width}px ${height}px`,
        [`--thumbnail-hover-scale`]: `${scale}`,
        [`--thumbnail-hover-reverse-scale`]: `${1 / scale}`,
        [`--badge-offset-scaled`]: `calc(0.25rem / ${scale})`,
        [`--reflow-duration-multiplier`]: durationMultiplier,
      }}
      className={cn(
        "group absolute top-0 left-0 z-0 flex h-full w-full justify-center overflow-visible",
        "hover:z-30 active:z-30 has-focus-visible:z-20",
        width < height ? "flex-col" : "flex-row",
        "transition-transform duration-[calc(var(--gallery-reflow-duration)*var(--reflow-duration-multiplier))] ease-[cubic-bezier(0.5,0,0.265,1.2)] in-data-[scrolling=true]:transition-none",
        enableContextMenu && menuOpen && "z-30 [content-visibility:visible]",
        className,
      )}
      {...props}
    >
      <ItemLink
        fileLink={fileLink}
        item={item}
        virtualRowIndex={virtualRow.index}
        tabIndex={tabIndex}
        setLinkRef={setLinkRef}
        onItemFocus={onItemFocus}
        enableContextMenu={enableContextMenu}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />
      {onRatingToggle && (
        <ThumbnailGalleryItemRatingBar
          item={item}
          onRatingToggle={(serviceKey, newValue) =>
            onRatingToggle(item.file_id, serviceKey, newValue)
          }
        />
      )}
      <div
        className={cn(
          "pointer-events-none h-full w-full origin-center [content-visibility:auto]",
          "hover:[content-visibility:visible] active:[content-visibility:visible] has-focus-visible:[content-visibility:visible]",
          enableContextMenu && menuOpen && "[content-visibility:visible]",
          "transition-[scale] duration-(--gallery-hover-zoom-duration) ease-in-out",
          enableHoverZoom && originClass,
        )}
      >
        <ThumbnailGalleryItemContent
          item={item}
          imageLoadMode={imageLoadMode}
          renderQuality={renderQuality}
          optimizeSizeThresholdMB={optimizeSizeThresholdMB}
          showFooter={showFooter}
        />
      </div>
    </li>
  );
});

interface ItemLinkProps {
  fileLink: LinkOptions;
  item: FileMetadata;
  virtualRowIndex: number;
  tabIndex: number;
  setLinkRef?: (el: HTMLAnchorElement | null, index: number) => void;
  onItemFocus?: (index: number) => void;
  enableContextMenu: boolean;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
}

function ItemLink({
  fileLink,
  item,
  virtualRowIndex,
  tabIndex,
  setLinkRef,
  onItemFocus,
  enableContextMenu,
  menuOpen,
  setMenuOpen,
}: ItemLinkProps) {
  const linkElement = (
    <Link
      ref={(el) => setLinkRef?.(el, virtualRowIndex)}
      to={fileLink.to}
      params={fileLink.params}
      className="absolute inset-0 z-10 outline-hidden"
      tabIndex={tabIndex}
      aria-label={`File ${item.file_id}, ${item.mime.split("/")[0]}`}
      onFocus={() => onItemFocus?.(virtualRowIndex)}
    />
  );

  if (!enableContextMenu) {
    return linkElement;
  }

  return (
    <ContextMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <ContextMenuTrigger>{linkElement}</ContextMenuTrigger>
      <ThumbnailGalleryItemContextMenu item={item} />
    </ContextMenu>
  );
}
