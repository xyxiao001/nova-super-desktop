import { describe, expect, it, vi } from "vitest";

import {
  NOVA_ACTIVITY_EVENT,
  createNovaActivityEvent,
  publishNovaActivityEvent,
  readingMilestoneForProgress,
  subscribeNovaActivityEvents,
} from "../../app/activityEvents";
import {
  PET_IDLE_RESET_MS,
  PET_REACTION_COOLDOWN_MS,
  createDefaultPetData,
  createPetData,
  petActivityFeedback,
  reducePetData,
  reducePetState,
  restorePetState,
} from "../../app/petModel";

describe("NOVA activity events", () => {
  it("contains only typed activity metadata", () => {
    expect(createNovaActivityEvent(
      "file-created",
      "desktop",
      { itemType: "image" },
      "activity-1",
      100,
    )).toEqual({
      id: "activity-1",
      type: "file-created",
      source: "desktop",
      occurredAt: 100,
      payload: { itemType: "image" },
    });
  });

  it("publishes to current-page subscribers and supports unsubscribe", () => {
    const target = new EventTarget();
    const listener = vi.fn();
    const unsubscribe = subscribeNovaActivityEvents(listener, target);

    publishNovaActivityEvent(
      "creative-saved",
      "drawing",
      { itemType: "image" },
      target,
    );
    unsubscribe();
    publishNovaActivityEvent("focus-completed", "focus", undefined, target);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      type: "creative-saved",
      source: "drawing",
      payload: { itemType: "image" },
    }));
    expect(NOVA_ACTIVITY_EVENT).toBe("nova-activity");
  });

  it("returns only the highest newly crossed reading milestone", () => {
    expect(readingMilestoneForProgress(24, 25)).toBe(25);
    expect(readingMilestoneForProgress(24, 76)).toBe(75);
    expect(readingMilestoneForProgress(76, 74)).toBeUndefined();
    expect(readingMilestoneForProgress(100, 100)).toBeUndefined();
  });
});

describe("pet state model", () => {
  it("creates the same visible default companion for an empty profile", () => {
    expect(createDefaultPetData({ id: "default-pet", now: 100 })).toMatchObject({
      profile: {
        id: "default-pet",
        name: "Nova",
        personality: "curious",
        createdAt: 100,
      },
      state: {
        hidden: false,
      },
      preferences: {
        enabled: true,
      },
    });
  });

  it("creates a local-first default pet without AI state", () => {
    expect(createPetData({
      name: "Nova",
      personality: "curious",
      id: "pet-1",
      now: 100,
    })).toEqual({
      profile: {
        id: "pet-1",
        name: "Nova",
        species: "nova-cat",
        personality: "curious",
        createdAt: 100,
      },
      state: {
        mood: "calm",
        energy: 72,
        affinity: 0,
        activity: "idle",
        x: 0.82,
        y: 0.78,
        hidden: false,
        lastActiveAt: 100,
        lastReactionAt: {},
      },
      memory: {
        eventCounts: {},
        firstOccurredAt: {},
        readingMilestones: {},
        discoveries: [],
      },
      preferences: {
        enabled: true,
        motion: "gentle",
        sound: true,
        bubbleFrequency: "medium",
      },
    });
  });

  it("updates bounded state and records the first activity", () => {
    const data = createPetData({
      name: "Nova",
      personality: "lively",
      id: "pet-1",
      now: 0,
    });
    const event = createNovaActivityEvent(
      "focus-completed",
      "focus",
      { durationBucket: "long" },
      "focus-1",
      1_000,
    );
    const next = reducePetData({
      ...data,
      state: { ...data.state, affinity: 99 },
    }, event);

    expect(next.state).toMatchObject({
      mood: "happy",
      activity: "celebrate",
      energy: 70,
      affinity: 100,
      lastActiveAt: 1_000,
      lastReactionAt: { "focus-completed": 1_000 },
    });
    expect(next.memory.eventCounts["focus-completed"]).toBe(1);
    expect(next.memory.firstOccurredAt["focus-completed"]).toBe(1_000);
    expect(next.memory.discoveries).toEqual(["first-focus"]);
  });

  it("counts cooldown events without replaying their reaction", () => {
    const data = createPetData({
      name: "Nova",
      personality: "quiet",
      id: "pet-1",
      now: 0,
    });
    const first = reducePetData(data, createNovaActivityEvent(
      "creative-saved",
      "photo",
      { itemType: "image" },
      "creative-1",
      1_000,
    ));
    const second = reducePetData(first, createNovaActivityEvent(
      "creative-saved",
      "drawing",
      { itemType: "image" },
      "creative-2",
      1_000 + PET_REACTION_COOLDOWN_MS["creative-saved"] - 1,
    ));

    expect(second.state.energy).toBe(first.state.energy);
    expect(second.state.affinity).toBe(first.state.affinity);
    expect(second.state.lastReactionAt["creative-saved"]).toBe(1_000);
    expect(second.memory.eventCounts["creative-saved"]).toBe(2);
    expect(second.memory.discoveries).toEqual(["first-creation"]);
  });

  it("keeps the highest local reading milestone", () => {
    const data = createPetData({
      name: "Nova",
      personality: "curious",
      id: "pet-1",
      now: 0,
    });
    const halfway = reducePetData(data, createNovaActivityEvent(
      "reading-milestone",
      "reader",
      { localResourceId: "book-1", progressBucket: 50 },
      "read-1",
      1_000,
    ));
    const repeatedEarlierMilestone = reducePetData(halfway, createNovaActivityEvent(
      "reading-milestone",
      "reader",
      { localResourceId: "book-1", progressBucket: 25 },
      "read-2",
      2_000,
    ));

    expect(repeatedEarlierMilestone.memory.readingMilestones).toEqual({
      "book-1": 50,
    });
  });

  it("keeps quiet focus posture until completion and provides local feedback", () => {
    const data = createPetData({
      name: "Nova",
      personality: "quiet",
      id: "pet-1",
      now: 0,
    });
    const focusing = reducePetData(data, createNovaActivityEvent(
      "focus-started",
      "focus",
      undefined,
      "focus-start",
      1_000,
    ));
    const completedEvent = createNovaActivityEvent(
      "focus-completed",
      "focus",
      { durationBucket: "medium" },
      "focus-complete",
      2_000,
    );
    const completed = reducePetData(focusing, completedEvent);

    expect(focusing.state).toMatchObject({
      mood: "calm",
      activity: "focus",
      energy: data.state.energy,
      affinity: data.state.affinity,
    });
    expect(completed.state).toMatchObject({
      mood: "happy",
      activity: "celebrate",
    });
    expect(completed.memory.eventCounts["focus-completed"]).toBe(1);
    expect(petActivityFeedback(completedEvent)).toBe("专注完成，做得很好！");
  });

  it("uses milestone-specific local feedback without resource names", () => {
    const event = createNovaActivityEvent(
      "reading-milestone",
      "reader",
      { localResourceId: "book-1", progressBucket: 50 },
      "read-1",
      1_000,
    );

    expect(petActivityFeedback(event)).toBe("读到一半啦，我继续陪你。");
    expect(petActivityFeedback(event)).not.toContain("book-1");
  });

  it("reacts differently to direct local pet interactions", () => {
    const data = createPetData({
      name: "Nova",
      personality: "lively",
      id: "pet-1",
      now: 0,
    });
    const pettedEvent = createNovaActivityEvent(
      "pet-interacted",
      "desktop",
      { interaction: "pet" },
      "pet-1",
      1_000,
    );
    const playedEvent = createNovaActivityEvent(
      "pet-interacted",
      "desktop",
      { interaction: "play" },
      "play-1",
      2_000,
    );
    const petted = reducePetData(data, pettedEvent);
    const played = reducePetData(petted, playedEvent);

    expect(petted.state.activity).toBe("nuzzle");
    expect(played.state.activity).toBe("pounce");
    expect(played.memory.eventCounts["pet-interacted"]).toBe(2);
    expect(petActivityFeedback(pettedEvent)).toContain("呼噜");
    expect(petActivityFeedback(playedEvent)).toContain("抓到");
  });

  it("provides source-specific creative feedback without resource content", () => {
    const photo = createNovaActivityEvent(
      "creative-saved",
      "photo",
      { itemType: "image" },
      "photo-1",
      1_000,
    );
    const drawing = createNovaActivityEvent(
      "creative-saved",
      "drawing",
      { itemType: "image" },
      "drawing-1",
      2_000,
    );

    expect(petActivityFeedback(photo)).toBe("照片收好啦，这个光影真好看！");
    expect(petActivityFeedback(drawing)).toBe("新作品保存好啦，我很喜欢！");
  });

  it("provides content-free system operation feedback", () => {
    const trashed = createNovaActivityEvent(
      "files-organized",
      "desktop",
      { operation: "trash", count: 2 },
      "trash-1",
      1_000,
    );
    const deleted = createNovaActivityEvent(
      "files-organized",
      "desktop",
      { operation: "delete", count: 2 },
      "delete-1",
      2_000,
    );
    const settings = createNovaActivityEvent(
      "app-activated",
      "settings",
      undefined,
      "settings-1",
      3_000,
    );

    expect(petActivityFeedback(trashed)).toContain("还能找回来");
    expect(petActivityFeedback(deleted)).toContain("彻底清理");
    expect(petActivityFeedback(settings)).toContain("伙伴页");
  });

  it("restores calm without reducing affinity after a long absence", () => {
    const data = createPetData({
      name: "Nova",
      personality: "curious",
      id: "pet-1",
      now: 100,
    });
    const state = reducePetState(data.state, createNovaActivityEvent(
      "game-finished",
      "chess",
      { outcome: "win" },
      "game-1",
      1_000,
    ));
    const restored = restorePetState(state, 1_000 + PET_IDLE_RESET_MS);

    expect(restored).toMatchObject({
      mood: "calm",
      activity: "idle",
      affinity: state.affinity,
      energy: state.energy,
      lastActiveAt: 1_000 + PET_IDLE_RESET_MS,
    });
  });
});
