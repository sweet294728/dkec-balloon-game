export function firstSegmentCircleHit(start, end, circles) {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSquared = segmentX ** 2 + segmentY ** 2;

  if (segmentLengthSquared === 0) {
    let nearest = null;

    circles.forEach((circle, index) => {
      const distanceSquared = (circle.x - start.x) ** 2 + (circle.y - start.y) ** 2;

      if (
        distanceSquared <= circle.radius ** 2
        && (
          nearest === null
          || distanceSquared < nearest.distanceSquared
          || (distanceSquared === nearest.distanceSquared && index < nearest.index)
        )
      ) {
        nearest = { circle, distanceSquared, index };
      }
    });

    return nearest === null ? null : { ...nearest.circle, t: 0 };
  }

  let firstHit = null;

  circles.forEach((circle, index) => {
    const centerX = circle.x - start.x;
    const centerY = circle.y - start.y;
    const projectedT = (
      centerX * segmentX + centerY * segmentY
    ) / segmentLengthSquared;
    const closestT = Math.max(0, Math.min(1, projectedT));
    const closestX = start.x + closestT * segmentX;
    const closestY = start.y + closestT * segmentY;
    const closestDistanceSquared = (
      (circle.x - closestX) ** 2 + (circle.y - closestY) ** 2
    );
    const radiusSquared = circle.radius ** 2;

    if (closestDistanceSquared > radiusSquared) {
      return;
    }

    const projectedX = start.x + projectedT * segmentX;
    const projectedY = start.y + projectedT * segmentY;
    const perpendicularDistanceSquared = (
      (circle.x - projectedX) ** 2 + (circle.y - projectedY) ** 2
    );
    const contactOffset = Math.sqrt(
      Math.max(0, radiusSquared - perpendicularDistanceSquared)
      / segmentLengthSquared,
    );
    const entryT = projectedT - contactOffset;
    const exitT = projectedT + contactOffset;

    if (exitT < 0 || entryT > 1) {
      return;
    }

    const t = Math.max(0, entryT);

    if (
      firstHit === null
      || t < firstHit.t
      || (t === firstHit.t && index < firstHit.index)
    ) {
      firstHit = { circle, t, index };
    }
  });

  return firstHit === null ? null : { ...firstHit.circle, t: firstHit.t };
}
