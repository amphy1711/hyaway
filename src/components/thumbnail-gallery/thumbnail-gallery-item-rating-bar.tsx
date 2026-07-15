// Copyright 2026 hyAway contributors
// SPDX-License-Identifier: Apache-2.0

import { IconTrash, IconTrashOff } from "@tabler/icons-react";

import { useShapeIcons } from "@/components/ratings/use-shape-icons";
import {
  getDislikeColors,
  getLikeColors,
  getNumericalFilledColors,
} from "@/components/ratings/rating-colors";
import { useThumbnailGalleryContext } from "./thumbnail-gallery-context";
import type { FileMetadata } from "@/integrations/hydrus-api/models";
import {
  isLikeRatingService,
  isNumericalRatingService,
  Permission,
  type RatingServiceInfo,
  type RatingValue,
} from "@/integrations/hydrus-api/models";
import { cn } from "@/lib/utils";
import { useRatingsToShow } from "@/hooks/use-ratings-to-show";
import { usePermissions } from "@/integrations/hydrus-api/queries/permissions";
import {
  useDeleteFilesMutation,
  useUndeleteFilesMutation,
} from "@/integrations/hydrus-api/queries/manage-files";

export interface ThumbnailGalleryItemRatingBarProps {
  item: FileMetadata;
  className?: string;
  onRatingToggle: (serviceKey: string, newValue: RatingValue) => void;
}

function getToggledValue(
  service: RatingServiceInfo,
  currentValue: RatingValue,
): RatingValue {
  if (isLikeRatingService(service)) {
    const likeValue = currentValue as boolean | null;
    return likeValue === true || likeValue === false ? null : true;
  }
  if (isNumericalRatingService(service)) {
    const numValue = currentValue as number | null;
    return numValue === null || numValue === 0 ? service.max_stars : null;
  }
  const incDecValue = typeof currentValue === "number" ? currentValue : 0;
  return incDecValue > 0 ? 0 : 1;
}

function RatingBarIcon({
  serviceKey,
  service,
  value,
  onRatingToggle,
}: {
  serviceKey: string;
  service: RatingServiceInfo;
  value: RatingValue;
  onRatingToggle: (serviceKey: string, newValue: RatingValue) => void;
}) {
  const {
    filled: FilledIcon,
    outline: OutlineIcon,
    className: shapeClassName,
  } = useShapeIcons(serviceKey, service.star_shape);

  const isLike = isLikeRatingService(service);
  const isNumerical = isNumericalRatingService(service);

  const isFilled = isLike
    ? value === true || value === false
    : isNumerical
      ? value !== null && (value as number) > 0
      : typeof value === "number" && value > 0;

  const colors = isLike
    ? value === false
      ? getDislikeColors(service)
      : getLikeColors(service)
    : getNumericalFilledColors(service);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onRatingToggle(serviceKey, getToggledValue(service, value));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "pointer-events-auto flex size-8.5 items-center justify-center rounded px-2 transition-transform",
        "hover:scale-125 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
      )}
      aria-pressed={isFilled}
      aria-label={`${service.name ?? "Bewertung"}: ${isFilled ? "entfernen" : "vergeben"}`}
    >
      {isFilled ? (
        <FilledIcon
          aria-hidden
          className={cn("size-6", shapeClassName)}
          style={{ color: colors.brush, stroke: colors.pen }}
        />
      ) : (
        <OutlineIcon
          aria-hidden
          className={cn("size-6 text-white/80 drop-shadow", shapeClassName)}
        />
      )}
    </button>
  );
}

function DeleteToggleIcon({
  fileId,
  isTrashed,
}: {
  fileId: number;
  isTrashed: boolean;
}) {
  const { reviewSource } = useThumbnailGalleryContext();
  const { hasPermission } = usePermissions();
  const canManageFiles = hasPermission(Permission.IMPORT_AND_DELETE_FILES);
  const deleteFilesMutation = useDeleteFilesMutation();
  const undeleteFilesMutation = useUndeleteFilesMutation();

  const isPending =
    deleteFilesMutation.isPending || undeleteFilesMutation.isPending;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!canManageFiles || isPending) return;

    if (isTrashed) {
      undeleteFilesMutation.mutate({ file_id: fileId });
    } else {
      deleteFilesMutation.mutate({ file_id: fileId, reviewSource });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!canManageFiles || isPending}
      className={cn(
        "pointer-events-auto flex size-8.5 items-center justify-center rounded px-2 transition-transform",
        "hover:scale-125 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        (!canManageFiles || isPending) && "pointer-events-none opacity-40",
      )}
      aria-pressed={isTrashed}
      aria-label={isTrashed ? "Datei wiederherstellen" : "Datei in Papierkorb verschieben"}
    >
      {isTrashed ? (
        <IconTrashOff
          aria-hidden
          className="size-6 text-white/80 drop-shadow"
        />
      ) : (
        <IconTrash
          aria-hidden
          className="size-6 text-destructive drop-shadow"
        />
      )}
    </button>
  );
}

export function ThumbnailGalleryItemRatingBar({
  item,
  className,
  onRatingToggle,
}: ThumbnailGalleryItemRatingBarProps) {
  const ratingsToShow = useRatingsToShow(item);
  const isPermanentlyDeleted = item.is_deleted && !item.is_trashed;

  if (ratingsToShow.length === 0 && isPermanentlyDeleted) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-full -mt-15 z-20 flex items-center justify-between gap-2 bg-black/20 px-1",
        className,
      )}
    >
      {!isPermanentlyDeleted ? (
        <DeleteToggleIcon
          fileId={item.file_id}
          isTrashed={Boolean(item.is_trashed)}
        />
      ) : (
        <span />
      )}
      <div className="flex items-center gap-1">
        {ratingsToShow.map(({ serviceKey, service, value }) => (
          <RatingBarIcon
            key={serviceKey}
            serviceKey={serviceKey}
            service={service}
            value={value}
            onRatingToggle={onRatingToggle}
          />
        ))}
      </div>
    </div>
  );
}