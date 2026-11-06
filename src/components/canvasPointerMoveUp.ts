/**
 * MODULE INDEX (`src/components/canvasPointerMoveUp.ts`)
 * -----------------------------------------------------------------------------
 * Pointer move, pointer up/cancel, and wheel zoom handlers for `NodeCanvas`:
 * handles two-finger pinch zoom, double-tap vertical drag zoom, marquee selection,
 * conveyor corner dot dragging with obstacle avoidance, group & single node
 * dragging with snap guidelines, and hover state updates.
 *
 * Line Map:
 * - [L25–L48]   `applyZoomAboutScreenPoint()` camera zoom anchor math
 * - [L50–L395]  `executeCanvasPointerMove()` (pinch zoom, double-tap zoom, marquee, waypoint drag, group/node drag, pan, hover feedback)
 * - [L397–L615] `executeCanvasPointerUpOrCancel()` & `executeCanvasWheel()` (commit/revert drag, finish wiring, marquee select, wheel zoom)
 */

import React from 'react';
import { playSynthSfx } from '../game/audio';
import { BUILDINGS } from '../game/catalog';
import { factoryHistory } from '../game/history';
import {
  clampCameraToWorld,
  clampNodeToWorld,
  computeNodeSnapAlignment,
  doesPathIntersectNode,
  getCachedConveyorRoute,
  invalidateAllConveyorCaches,
  isMinerDirectlyOnDeposit,
  isNodePositionValid,
  isPointInsideObstacle,
  MAX_ZOOM,
  MIN_ZOOM,
  stepSimulation,
} from '../game/rules';
import { CameraState, MachineNode } from '../game/types';
import {
  doesCandidateNodeOverlapBeltsOrDots,
  findBeltAtWorld,
  findNodeAtWorld,
  findPortAtWorld,
  findWaypointAtWorld,
  getClosestPointOnBelt,
} from './canvasHitTesting';
import {
  CanvasPointerContext,
  screenToWorldPoint,
  tryCreateConnection,
} from './canvasPointerDown';

export function applyZoomAboutScreenPoint(
  cameraRef: React.MutableRefObject<CameraState>,
  nextZoomRaw: number,
  screenX: number,
  screenY: number,
  viewportW: number,
  viewportH: number
): void {
  const cam = cameraRef.current;
  const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoomRaw));
  const worldX = (screenX - cam.x) / cam.zoom;
  const worldY = (screenY - cam.y) / cam.zoom;
  const rawCam: CameraState = {
    x: screenX - worldX * nextZoom,
    y: screenY - worldY * nextZoom,
    zoom: nextZoom,
  };
  cameraRef.current = clampCameraToWorld(rawCam, viewportW, viewportH);
}

export function executeCanvasPointerMove(
  e: React.PointerEvent<HTMLCanvasElement>,
  ctx: CanvasPointerContext
): void {
  const {
    canvas,
    nodesRef,
    connectionsRef,
    cameraRef,
    settingsRef,
    activeToolRef,
    interactionRef,
    drawNow,
  } = ctx;

  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  if (interactionRef.current.activePointers.has(e.pointerId)) {
    interactionRef.current.activePointers.set(e.pointerId, { x: sx, y: sy });
  }

  if (interactionRef.current.activePointers.size === 2) {
    const pts = Array.from(interactionRef.current.activePointers.values());
    const dist = Math.max(10, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y));
    const midX = (pts[0].x + pts[1].x) * 0.5;
    const midY = (pts[0].y + pts[1].y) * 0.5;

    const prevDist = interactionRef.current.lastPinchDist ?? dist;
    const prevMidX = interactionRef.current.lastPinchMidX ?? midX;
    const prevMidY = interactionRef.current.lastPinchMidY ?? midY;

    const scaleRatio = dist / prevDist;
    const cam = cameraRef.current;
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom * scaleRatio));

    const worldMidX = (prevMidX - cam.x) / cam.zoom;
    const worldMidY = (prevMidY - cam.y) / cam.zoom;

    const rawCam: CameraState = {
      x: midX - worldMidX * nextZoom,
      y: midY - worldMidY * nextZoom,
      zoom: nextZoom,
    };
    cameraRef.current = clampCameraToWorld(rawCam, rect.width, rect.height);

    interactionRef.current.lastPinchDist = dist;
    interactionRef.current.lastPinchMidX = midX;
    interactionRef.current.lastPinchMidY = midY;
    drawNow();
    return;
  }

  if (interactionRef.current.isDoubleTapZooming) {
    const dy = sy - interactionRef.current.doubleTapStartY;
    if (Math.abs(dy) > 4) {
      interactionRef.current.pointerMoved = true;
    }
    const zoomFactor = Math.pow(1.006, dy);
    const nextZoom = interactionRef.current.doubleTapStartZoom * zoomFactor;
    applyZoomAboutScreenPoint(
      cameraRef,
      nextZoom,
      interactionRef.current.doubleTapAnchorX,
      interactionRef.current.doubleTapAnchorY,
      rect.width,
      rect.height
    );
    drawNow();
    return;
  }

  const world = screenToWorldPoint(canvas, cameraRef.current, e.clientX, e.clientY);
  interactionRef.current.pointerWorldX = world.x;
  interactionRef.current.pointerWorldY = world.y;

  if (interactionRef.current.isMarqueeSelecting) {
    interactionRef.current.pointerMoved = true;
    interactionRef.current.marqueeCurrentX = world.x;
    interactionRef.current.marqueeCurrentY = world.y;
    drawNow();
    return;
  }

  if (interactionRef.current.wiringFrom) {
    interactionRef.current.pointerMoved = true;
    drawNow();
    return;
  }

  if (interactionRef.current.draggingWaypoint) {
    const dw = interactionRef.current.draggingWaypoint;
    if (Math.hypot(world.x - dw.startX, world.y - dw.startY) > 6) {
      interactionRef.current.pointerMoved = true;
    }
    if (!interactionRef.current.pointerMoved) {
      return;
    }
    const snappedX = Math.round(world.x / 24) * 24;
    const snappedY = Math.round(world.y / 24) * 24;

    if (isPointInsideObstacle(snappedX, snappedY, nodesRef.current, 14)) {
      return;
    }

    const targetConn = connectionsRef.current.find((c) => c.id === dw.connId);
    if (targetConn) {
      const fn = nodesRef.current.find((n) => n.id === targetConn.fromNodeId);
      const tn = nodesRef.current.find((n) => n.id === targetConn.toNodeId);
      if (fn && tn) {
        const outIdx = fn.outputs.findIndex((p) => p.id === targetConn.fromPortId);
        const inIdx = tn.inputs.findIndex((p) => p.id === targetConn.toPortId);
        const candidateWps = targetConn.waypoints ? [...targetConn.waypoints] : [];
        if (candidateWps[dw.index]) {
          candidateWps[dw.index] = { x: snappedX, y: snappedY };
        }
        if (outIdx >= 0 && inIdx >= 0) {
          const candidateRoute = getCachedConveyorRoute(
            fn,
            outIdx,
            tn,
            inIdx,
            nodesRef.current,
            candidateWps
          );
          const srcDeposit =
            fn.buildingId === 'miner_mk1'
              ? nodesRef.current.find(
                  (n) =>
                    n.buildingId === 'resource_deposit' &&
                    isMinerDirectlyOnDeposit(fn, n, 8)
                )
              : undefined;
          const dstDeposit =
            tn.buildingId === 'miner_mk1'
              ? nodesRef.current.find(
                  (n) =>
                    n.buildingId === 'resource_deposit' &&
                    isMinerDirectlyOnDeposit(tn, n, 8)
                )
              : undefined;
          const interiorPts =
            candidateRoute.pts.length >= 4
              ? candidateRoute.pts.slice(1, candidateRoute.pts.length - 1)
              : candidateRoute.pts;
          const hitsAnyNode = nodesRef.current.some((obs) => {
            const isEndpointNode =
              obs.id === fn.id ||
              obs.id === tn.id ||
              obs.id === srcDeposit?.id ||
              obs.id === dstDeposit?.id;
            if (isEndpointNode) {
              return doesPathIntersectNode(interiorPts, obs, 6);
            }
            return doesPathIntersectNode(candidateRoute.pts, obs, 8);
          });
          if (hitsAnyNode) {
            return;
          }
        }
      }
    }

    connectionsRef.current = connectionsRef.current.map((c) => {
      if (c.id !== dw.connId) return c;
      const nextWps = c.waypoints ? [...c.waypoints] : [];
      if (nextWps[dw.index]) {
        nextWps[dw.index] = { x: snappedX, y: snappedY };
      }
      return { ...c, waypoints: nextWps };
    });
    invalidateAllConveyorCaches();
    drawNow();
    return;
  }

  if (interactionRef.current.draggingGroupPositions && interactionRef.current.draggingNodeId) {
    interactionRef.current.pointerMoved = true;
    const leaderId = interactionRef.current.draggingNodeId;
    const leaderStartPos = interactionRef.current.draggingGroupPositions.get(leaderId);
    if (leaderStartPos) {
      const rawLeaderX = world.x - interactionRef.current.dragOffsetX;
      const rawLeaderY = world.y - interactionRef.current.dragOffsetY;
      const snappedLeaderX = Math.round(rawLeaderX / 24) * 24;
      const snappedLeaderY = Math.round(rawLeaderY / 24) * 24;
      const dx = snappedLeaderX - leaderStartPos.startX;
      const dy = snappedLeaderY - leaderStartPos.startY;

      const nextNodes = nodesRef.current.map((n) => {
        const sp = interactionRef.current.draggingGroupPositions?.get(n.id);
        if (!sp) return n;
        const clamped = clampNodeToWorld(sp.startX + dx, sp.startY + dy, n.width, n.height);
        return { ...n, x: clamped.x, y: clamped.y };
      });
      nodesRef.current = nextNodes;
      invalidateAllConveyorCaches();

      let groupCollision = false;
      for (const [gId] of interactionRef.current.draggingGroupPositions.entries()) {
        const gNode = nextNodes.find((n) => n.id === gId);
        if (!gNode) continue;
        const check = isNodePositionValid(nextNodes, gNode, 4);
        if (
          !check.valid ||
          doesCandidateNodeOverlapBeltsOrDots(
            gNode,
            nextNodes,
            connectionsRef.current
          )
        ) {
          groupCollision = true;
          break;
        }
      }
      interactionRef.current.dragHasCollision = groupCollision;
    }
    drawNow();
    return;
  }

  if (interactionRef.current.draggingNodeId) {
    interactionRef.current.pointerMoved = true;
    const nodeId = interactionRef.current.draggingNodeId;
    const rawX = world.x - interactionRef.current.dragOffsetX;
    const rawY = world.y - interactionRef.current.dragOffsetY;

    const targetNode = nodesRef.current.find((n) => n.id === nodeId);
    if (targetNode) {
      const snapRes = computeNodeSnapAlignment(
        {
          id: targetNode.id,
          buildingId: targetNode.buildingId,
          x: rawX,
          y: rawY,
          width: targetNode.width,
          height: targetNode.height,
        },
        nodesRef.current,
        connectionsRef.current,
        settingsRef.current
      );
      interactionRef.current.activeGuidelines = snapRes.guidelines;

      const clamped = clampNodeToWorld(
        snapRes.x,
        snapRes.y,
        targetNode.width,
        targetNode.height
      );
      const moved = clamped.x !== targetNode.x || clamped.y !== targetNode.y;
      const candidateNode: MachineNode = { ...targetNode, x: clamped.x, y: clamped.y };
      const nextNodes = nodesRef.current.map((n) =>
        n.id === nodeId ? candidateNode : n
      );
      if (moved) {
        nodesRef.current = nextNodes;
        invalidateAllConveyorCaches();
      }
      const check = isNodePositionValid(nextNodes, candidateNode, 4);
      const hitsBeltOrDot = doesCandidateNodeOverlapBeltsOrDots(
        candidateNode,
        nextNodes,
        connectionsRef.current
      );
      interactionRef.current.dragHasCollision = !check.valid || hitsBeltOrDot;
    }
    drawNow();
    return;
  }

  if (interactionRef.current.isPanning) {
    const dx = e.clientX - interactionRef.current.panStartX;
    const dy = e.clientY - interactionRef.current.panStartY;
    if (Math.hypot(dx, dy) > 4) {
      interactionRef.current.pointerMoved = true;
    }
    cameraRef.current = clampCameraToWorld(
      {
        x: interactionRef.current.camStartX + dx,
        y: interactionRef.current.camStartY + dy,
        zoom: cameraRef.current.zoom,
      },
      rect.width,
      rect.height
    );
    drawNow();
    return;
  }

  // Hover feedback for conveyor belts and waypoint pins when moving pointer across canvas
  const hitWpHover = findWaypointAtWorld(
    world.x,
    world.y,
    connectionsRef.current,
    cameraRef.current.zoom
  );
  interactionRef.current.hoveredWaypoint = hitWpHover
    ? { connId: hitWpHover.conn.id, index: hitWpHover.index }
    : null;

  if (activeToolRef.current === 'waypoint' && !hitWpHover) {
    const hitB = findBeltAtWorld(
      world.x,
      world.y,
      nodesRef.current,
      connectionsRef.current,
      cameraRef.current.zoom,
      settingsRef.current.showPortRates
    );
    if (hitB) {
      const closest = getClosestPointOnBelt(
        world.x,
        world.y,
        hitB,
        nodesRef.current
      );
      if (closest && closest.dist <= 30) {
        const snapX = Math.round(closest.x / 24) * 24;
        const snapY = Math.round(closest.y / 24) * 24;
        if (!isPointInsideObstacle(snapX, snapY, nodesRef.current, 14)) {
          interactionRef.current.previewWaypoint = {
            connId: hitB.id,
            x: snapX,
            y: snapY,
          };
        } else {
          interactionRef.current.previewWaypoint = null;
        }
      } else {
        interactionRef.current.previewWaypoint = null;
      }
    } else {
      interactionRef.current.previewWaypoint = null;
    }
  } else {
    interactionRef.current.previewWaypoint = null;
  }

  const overPort = findPortAtWorld(
    world.x,
    world.y,
    nodesRef.current,
    cameraRef.current.zoom
  );
  const overNode = overPort
    ? null
    : findNodeAtWorld(
        world.x,
        world.y,
        nodesRef.current,
        cameraRef.current.zoom
      );
  const overBelt =
    !overPort && !overNode
      ? findBeltAtWorld(
          world.x,
          world.y,
          nodesRef.current,
          connectionsRef.current,
          cameraRef.current.zoom,
          settingsRef.current.showPortRates
        )
      : null;
  const nextHoverBeltId = overBelt?.id ?? null;
  if (interactionRef.current.hoveredConnectionId !== nextHoverBeltId) {
    interactionRef.current.hoveredConnectionId = nextHoverBeltId;
    drawNow();
  }
}

export function executeCanvasPointerUpOrCancel(
  e: React.PointerEvent<HTMLCanvasElement>,
  ctx: CanvasPointerContext
): void {
  const {
    canvas,
    nodesRef,
    connectionsRef,
    cameraRef,
    settingsRef,
    activeToolRef,
    preDragGraphRef,
    interactionRef,
    setSelectedNodeId,
    setSelectedNodeIds,
    setSelectedWaypoint,
    setTapSourcePort,
    onGraphMutated,
    showToast,
    drawNow,
  } = ctx;

  interactionRef.current.activePointers.delete(e.pointerId);

  if (interactionRef.current.activePointers.size < 2) {
    interactionRef.current.lastPinchDist = null;
    interactionRef.current.lastPinchMidX = null;
    interactionRef.current.lastPinchMidY = null;
  }

  if (interactionRef.current.isDoubleTapZooming) {
    if (!interactionRef.current.pointerMoved) {
      const nextTarget = Math.min(MAX_ZOOM, cameraRef.current.zoom * 1.35);
      interactionRef.current.smoothZoomTarget = nextTarget;
      interactionRef.current.smoothZoomAnchorX = interactionRef.current.doubleTapAnchorX;
      interactionRef.current.smoothZoomAnchorY = interactionRef.current.doubleTapAnchorY;
    }
    interactionRef.current.isDoubleTapZooming = false;
    onGraphMutated();
    return;
  }

  const world = screenToWorldPoint(canvas, cameraRef.current, e.clientX, e.clientY);

  if (interactionRef.current.isMarqueeSelecting) {
    const minX = Math.min(
      interactionRef.current.marqueeStartX,
      interactionRef.current.marqueeCurrentX
    );
    const maxX = Math.max(
      interactionRef.current.marqueeStartX,
      interactionRef.current.marqueeCurrentX
    );
    const minY = Math.min(
      interactionRef.current.marqueeStartY,
      interactionRef.current.marqueeCurrentY
    );
    const maxY = Math.max(
      interactionRef.current.marqueeStartY,
      interactionRef.current.marqueeCurrentY
    );
    const marqueeW = maxX - minX;
    const marqueeH = maxY - minY;

    if (marqueeW < 12 && marqueeH < 12) {
      const hitNode = findNodeAtWorld(
        world.x,
        world.y,
        nodesRef.current,
        cameraRef.current.zoom
      );
      if (hitNode && hitNode.buildingId !== 'resource_deposit' && !hitNode.isWorldDeposit) {
        setSelectedNodeIds((prev) =>
          prev.includes(hitNode.id)
            ? prev.filter((id) => id !== hitNode.id)
            : [...prev, hitNode.id]
        );
        setSelectedNodeId(hitNode.id);
        playSynthSfx('click', settingsRef.current);
      } else {
        setSelectedNodeIds([]);
        setSelectedNodeId(null);
      }
    } else {
      const selected = nodesRef.current.filter((n) => {
        if (n.buildingId === 'resource_deposit' || n.isWorldDeposit) return false;
        return (
          n.x < maxX &&
          n.x + n.width > minX &&
          n.y < maxY &&
          n.y + n.height > minY
        );
      });
      const ids = selected.map((n) => n.id);
      setSelectedNodeIds(ids);
      if (ids.length > 0) {
        setSelectedNodeId(ids[0]);
        playSynthSfx('click', settingsRef.current);
        showToast(`Selected ${ids.length} building${ids.length > 1 ? 's' : ''}`);
      } else {
        setSelectedNodeId(null);
      }
    }

    interactionRef.current.isMarqueeSelecting = false;
    drawNow();
    return;
  }

  if (interactionRef.current.draggingGroupPositions) {
    if (interactionRef.current.pointerMoved) {
      if (interactionRef.current.dragHasCollision) {
        const groupMap = interactionRef.current.draggingGroupPositions;
        nodesRef.current = nodesRef.current.map((n) => {
          const sp = groupMap.get(n.id);
          if (!sp) return n;
          return { ...n, x: sp.startX, y: sp.startY };
        });
        invalidateAllConveyorCaches();
        playSynthSfx('error', settingsRef.current);
        showToast('Buildings cannot overlap nodes, belts, or corner dots! Returned to start.');
      } else if (preDragGraphRef.current) {
        factoryHistory.pushSnapshot(
          preDragGraphRef.current.nodes,
          preDragGraphRef.current.connections,
          `Move ${interactionRef.current.draggingGroupPositions.size} Buildings`
        );
        const simResult = stepSimulation(nodesRef.current, connectionsRef.current, 0);
        nodesRef.current = simResult.nodes;
        connectionsRef.current = simResult.connections;
        onGraphMutated();
      }
    }
    interactionRef.current.draggingGroupPositions = null;
    interactionRef.current.draggingNodeId = null;
    interactionRef.current.dragHasCollision = false;
    interactionRef.current.activeGuidelines = [];
    preDragGraphRef.current = null;
    drawNow();
    return;
  }

  if (interactionRef.current.wiringFrom) {
    const wf = interactionRef.current.wiringFrom;
    const targetPort = findPortAtWorld(
      world.x,
      world.y,
      nodesRef.current,
      cameraRef.current.zoom
    );
    if (targetPort && targetPort.port.side === 'input') {
      tryCreateConnection(ctx, wf.nodeId, wf.port.id, targetPort.nodeId, targetPort.port.id);
      setTapSourcePort(null);
    }
    interactionRef.current.wiringFrom = null;
    drawNow();
  }

  if (interactionRef.current.draggingWaypoint) {
    const dw = interactionRef.current.draggingWaypoint;
    if (interactionRef.current.pointerMoved && preDragGraphRef.current) {
      if (!dw.isNew) {
        factoryHistory.pushSnapshot(
          preDragGraphRef.current.nodes,
          preDragGraphRef.current.connections,
          'Move Conveyor Corner'
        );
      }
      const simResult = stepSimulation(nodesRef.current, connectionsRef.current, 0);
      nodesRef.current = simResult.nodes;
      connectionsRef.current = simResult.connections;
      onGraphMutated();
    } else if (!interactionRef.current.pointerMoved && !dw.isNew) {
      if (activeToolRef.current === 'waypoint') {
        factoryHistory.pushSnapshot(
          nodesRef.current,
          connectionsRef.current,
          'Dismantle Conveyor Corner'
        );
        connectionsRef.current = connectionsRef.current.map((c) => {
          if (c.id !== dw.connId) return c;
          const nextWps = (c.waypoints ?? []).filter((_, idx) => idx !== dw.index);
          return { ...c, waypoints: nextWps.length > 0 ? nextWps : undefined };
        });
        invalidateAllConveyorCaches();
        const simResult = stepSimulation(nodesRef.current, connectionsRef.current, 0);
        nodesRef.current = simResult.nodes;
        connectionsRef.current = simResult.connections;
        setSelectedWaypoint(null);
        playSynthSfx('disconnect', settingsRef.current);
        onGraphMutated();
        showToast('Dismantled conveyor corner dot');
      }
    }
    interactionRef.current.draggingWaypoint = null;
    preDragGraphRef.current = null;
    drawNow();
  }

  if (interactionRef.current.draggingNodeId && interactionRef.current.pointerMoved) {
    const draggedId = interactionRef.current.draggingNodeId;
    if (interactionRef.current.dragHasCollision) {
      const draggedNode = nodesRef.current.find((n) => n.id === draggedId);
      nodesRef.current = nodesRef.current.map((n) => {
        if (n.id !== draggedId) return n;
        return {
          ...n,
          x: interactionRef.current.dragStartNodeX,
          y: interactionRef.current.dragStartNodeY,
        };
      });
      invalidateAllConveyorCaches();
      playSynthSfx('error', settingsRef.current);
      if (draggedNode?.buildingId === 'miner_mk1') {
        showToast('Miner Mk.1 must be positioned directly on top of an unoccupied Resource Deposit! (1 miner per deposit)');
      } else {
        showToast('Buildings cannot overlap nodes, belts, or corner dots! Returned to original position.');
      }
    } else {
      if (preDragGraphRef.current) {
        const draggedNode = nodesRef.current.find((n) => n.id === draggedId);
        const initialX = interactionRef.current.dragStartNodeX;
        const initialY = interactionRef.current.dragStartNodeY;
        if (draggedNode && (draggedNode.x !== initialX || draggedNode.y !== initialY)) {
          factoryHistory.pushSnapshot(
            preDragGraphRef.current.nodes,
            preDragGraphRef.current.connections,
            `Move ${BUILDINGS[draggedNode.buildingId]?.name ?? 'Machine'}`
          );
        }
      }
      const simResult = stepSimulation(nodesRef.current, connectionsRef.current, 0);
      nodesRef.current = simResult.nodes;
      connectionsRef.current = simResult.connections;
      onGraphMutated();
    }
  }

  interactionRef.current.activeGuidelines = [];
  interactionRef.current.dragHasCollision = false;
  interactionRef.current.draggingNodeId = null;
  interactionRef.current.isPanning = false;
  preDragGraphRef.current = null;
  drawNow();
}

export function executeCanvasWheel(
  e: React.WheelEvent<HTMLCanvasElement>,
  ctx: CanvasPointerContext
): void {
  const { canvas, cameraRef, interactionRef } = ctx;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  const baseZoom =
    interactionRef.current.smoothZoomTarget ?? cameraRef.current.zoom;
  const factor = Math.exp(-e.deltaY * 0.0018);
  const nextTarget = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, baseZoom * factor));

  interactionRef.current.smoothZoomTarget = nextTarget;
  interactionRef.current.smoothZoomAnchorX = mx;
  interactionRef.current.smoothZoomAnchorY = my;
}
