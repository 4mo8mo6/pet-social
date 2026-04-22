"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import {
  buildAuthHeaders,
  clearStoredAuth,
  readStoredAuthToken,
} from "../../lib/auth";
import {
  type ChatMessage,
  isChatResponse,
  isMessageListResponse,
} from "../../lib/chat";
import {
  API_BASE_URL,
  LOGIN_REQUIRED_MESSAGE,
  MISSING_PET_MESSAGE,
  RESTORE_PET_FAILURE_MESSAGE,
} from "../../lib/constants";
import {
  clearStoredPetId,
  getResponseErrorMessage,
  isPetApiResponse,
  isPetListResponse,
  readStoredPetId,
  recoverLatestPetForCurrentUser,
  type ApiPet,
} from "../../lib/pet";
import type { SceneAction } from "../../lib/PetHomeScene";
import {
  moveFurniture,
  type PlacedFurnitureResponse,
  isPlacedFurnitureListResponse,
} from "../../lib/furniture";
import {
  HOME_SCENE_OBJECTS,
  HOME_SCENE_ROOMS,
  type HomeSocialEmotion,
  type HomeRoomId,
  type PetInteractionMenuAction,
} from "../../lib/home-scene";
import {
  buildHomeStatusFreshnessText,
  createHomePageNotice,
  createHomeStatusSyncNotice,
  createPetSelectionSceneNotice,
  createSceneActionErrorNotice,
  createSceneActionNetworkNotice,
  createSceneActionSuccessNotice,
  createSceneTargetNotice,
  getHomeStatusSyncNoticeClassName,
  getHomeSceneNoticeClassName,
  getNoticeAutoDismissMs,
  type HomePageNotice,
  type HomeSceneNotice,
  type HomeStatusSyncNotice,
} from "../../lib/home-scene-notice";
import {
  type PetStatus,
  isPetStatus,
} from "../../lib/PetStatusPanel";
import { PetSwitcher } from "../../lib/PetSwitcher";
import {
  getHomeStatusDisplayPolicy,
  getHomeStatusSummaryText,
  type PetStatusViewState,
} from "../../lib/pet-status-view";
import { AppHeaderNav } from "../../lib/AppHeaderNav";
import { EmptyState, SkeletonBlock } from "../../lib/feedback";
import { HomeChatPanel } from "../../lib/home/HomeChatPanel";
import { HomeFurniturePanel } from "../../lib/home/HomeFurniturePanel";
import { HomeHero } from "../../lib/home/HomeHero";
import { HomeSceneShell } from "../../lib/home/HomeSceneShell";
import {
  HomeSidebarTabs,
  type HomeCompanionTab,
} from "../../lib/home/HomeSidebarTabs";
import { HomeStatusPanel, type CareAction } from "../../lib/home/HomeStatusPanel";
import { ui } from "../../lib/ui";

const PetHomeScene = dynamic(
  () =>
    import("../../lib/PetHomeScene").then((module) => ({
      default: module.PetHomeScene,
    })),
  {
    ssr: false,
    loading: () => (
      <div className={`${ui.skeleton} aspect-square w-full p-6 text-sm text-[#8b6447]`}>
        正在打开小窝...
      </div>
    ),
  }
);

const HOME_LOAD_FAILURE_MESSAGE = "刚刚没打开小窝，再试试吧。";
const HOME_CHAT_LOAD_FAILURE_MESSAGE = "刚刚没翻到聊天记录，再试试吧。";
const HOME_CHAT_SEND_FAILURE_MESSAGE = "这句话刚刚没送到，再试试吧。";
const HOME_CHAT_SEND_TIMEOUT_MS = 8000;

type StatusFetchResult =
  | { kind: "success" }
  | { kind: "unauthorized" }
  | { kind: "failed" };

function clonePlacedFurnitureItems(items: PlacedFurnitureResponse[]) {
  return items.map((item) => ({
    ...item,
    template: { ...item.template },
  }));
}

function normalizeHomeSocialEmotion(value: string | null): HomeSocialEmotion | null {
  if (
    value === "calm" ||
    value === "curious" ||
    value === "guarded" ||
    value === "excited" ||
    value === "warm"
  ) {
    return value;
  }
  return null;
}

export default function HomeScenePage() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [pet, setPet] = useState<ApiPet | null>(null);
  const [pets, setPets] = useState<ApiPet[]>([]);
  const [petStatuses, setPetStatuses] = useState<Map<number, PetStatus>>(new Map());
  const [status, setStatus] = useState<PetStatus | null>(null);
  const [placedFurniture, setPlacedFurniture] = useState<PlacedFurnitureResponse[]>([]);
  const [currentRoom, setCurrentRoom] = useState<HomeRoomId>("living");
  const [isFurnitureEditMode, setIsFurnitureEditMode] = useState(false);
  const [isFurnitureLayoutSaving, setIsFurnitureLayoutSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPetMenuOpen, setIsPetMenuOpen] = useState(false);
  const [activePetPanel, setActivePetPanel] = useState<
    PetInteractionMenuAction | null
  >(null);
  const [pageStatusNotice, setPageStatusNotice] =
    useState<HomePageNotice | null>(null);
  const [sceneNotice, setSceneNotice] = useState<HomeSceneNotice | null>(null);
  const [statusSyncNotice, setStatusSyncNotice] =
    useState<HomeStatusSyncNotice | null>(null);
  const [lastStatusSyncedAt, setLastStatusSyncedAt] = useState<number | null>(null);
  const [statusViewState, setStatusViewState] =
    useState<PetStatusViewState>("loading");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInputValue, setChatInputValue] = useState("");
  const [isHomeChatLoading, setIsHomeChatLoading] = useState(false);
  const [isHomeChatLoaded, setIsHomeChatLoaded] = useState(false);
  const [isHomeChatSending, setIsHomeChatSending] = useState(false);
  const [isCareActionRunning, setIsCareActionRunning] = useState(false);
  const [homeChatStatusMessage, setHomeChatStatusMessage] = useState<{
    type: "error" | "info";
    message: string;
  } | null>(null);
  const chatMessagesContainerRef = useRef<HTMLDivElement | null>(null);
  const furnitureBaselineRef = useRef<PlacedFurnitureResponse[] | null>(null);
  const isHomeChatOpen = activePetPanel === "chat";
  const isFurniturePanelOpen = isFurnitureEditMode && activePetPanel === null;
  const isPetPanelOpen =
    activePetPanel === "status" || (!isHomeChatOpen && !isFurniturePanelOpen);
  const currentRoomMeta =
    HOME_SCENE_ROOMS.find((room) => room.id === currentRoom) ?? HOME_SCENE_ROOMS[0];
  const statusDisplayPolicy = getHomeStatusDisplayPolicy(
    status,
    statusViewState,
    isPetPanelOpen
  );
  const canSendHomeChatMessage = Boolean(
    chatInputValue.trim() &&
      pet &&
      authToken &&
      isHomeChatOpen &&
      !isHomeChatLoading &&
      !isHomeChatSending
  );

  const applyStatusSnapshot = (nextStatus: PetStatus) => {
    setStatus(nextStatus);
    setStatusSyncNotice(null);
    setLastStatusSyncedAt(Date.now());
    setStatusViewState("ready");
  };

  const resetHomeChatState = () => {
    setChatMessages([]);
    setChatInputValue("");
    setIsHomeChatLoading(false);
    setIsHomeChatLoaded(false);
    setIsHomeChatSending(false);
    setHomeChatStatusMessage(null);
  };

  const fetchPetStatus = useEffectEvent(async (
    activePetId: number,
    token: string
  ): Promise<StatusFetchResult> => {
    try {
      const response = await fetch(`${API_BASE_URL}/pets/${activePetId}/status`, {
        cache: "no-store",
        credentials: "include",
        headers: buildAuthHeaders(token),
      });

      if (response.status === 401) {
        clearStoredAuth();
        clearStoredPetId();
        setAuthToken(null);
        setPet(null);
        setStatus(null);
        setIsPetMenuOpen(false);
        setActivePetPanel(null);
        setStatusSyncNotice(null);
        setLastStatusSyncedAt(null);
        setStatusViewState("loading");
        resetHomeChatState();
        setPageStatusNotice(createHomePageNotice(LOGIN_REQUIRED_MESSAGE, "info"));
        return { kind: "unauthorized" };
      }

      if (!response.ok) {
        return { kind: "failed" };
      }

      const data: unknown = await response.json();
      if (!isPetStatus(data)) {
        return { kind: "failed" };
      }

      applyStatusSnapshot(data);
      return { kind: "success" };
    } catch {
      return { kind: "failed" };
    }
  });

  const fetchPlacedFurniture = useEffectEvent(async (
    activePetId: number,
    token: string
  ) => {
    try {
      const response = await fetch(`${API_BASE_URL}/pets/${activePetId}/furniture`, {
        cache: "no-store",
        credentials: "include",
        headers: buildAuthHeaders(token),
      });
      if (!response.ok) return;
      const data: unknown = await response.json();
      if (isPlacedFurnitureListResponse(data)) {
        setPlacedFurniture(data.items);
      }
    } catch {
      // ignore
    }
  });

  const pollPetStatus = useEffectEvent(async (
    activePetId: number,
    token: string
  ) => {
    const result = await fetchPetStatus(activePetId, token);
    if (result.kind === "failed") {
      if (status) {
        setStatusSyncNotice(createHomeStatusSyncNotice());
      } else {
        setStatusSyncNotice(null);
        setStatusViewState("unavailable");
      }
    }
  });

  const loadHomeChatMessages = useEffectEvent(async (
    activePetId: number,
    token: string
  ) => {
    setIsHomeChatLoading(true);
    setHomeChatStatusMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/pets/${activePetId}/messages`, {
        cache: "no-store",
        credentials: "include",
        headers: buildAuthHeaders(token),
      });

      if (response.status === 401) {
        clearStoredAuth();
        clearStoredPetId();
        setAuthToken(null);
        setPet(null);
        setStatus(null);
        setIsPetMenuOpen(false);
        setActivePetPanel(null);
        setStatusSyncNotice(null);
        setLastStatusSyncedAt(null);
        setStatusViewState("loading");
        resetHomeChatState();
        setPageStatusNotice(createHomePageNotice(LOGIN_REQUIRED_MESSAGE, "info"));
        return;
      }

      if (response.status === 404) {
        clearStoredPetId();
        setChatMessages([]);
        setHomeChatStatusMessage({
          type: "error",
          message: MISSING_PET_MESSAGE,
        });
        setIsHomeChatLoaded(true);
        return;
      }

      if (!response.ok) {
        setHomeChatStatusMessage({
          type: "error",
          message: await getResponseErrorMessage(
            response,
            HOME_CHAT_LOAD_FAILURE_MESSAGE
          ),
        });
        setIsHomeChatLoaded(true);
        return;
      }

      const data: unknown = await response.json();
      if (!isMessageListResponse(data)) {
        setChatMessages([]);
        setHomeChatStatusMessage({
          type: "error",
          message: "后端返回的聊天记录格式不正确。",
        });
        setIsHomeChatLoaded(true);
        return;
      }

      setChatMessages(data.messages);
      setHomeChatStatusMessage(null);
      setIsHomeChatLoaded(true);
    } catch {
      setChatMessages([]);
      setHomeChatStatusMessage({
        type: "error",
        message: HOME_CHAT_LOAD_FAILURE_MESSAGE,
      });
      setIsHomeChatLoaded(true);
    } finally {
      setIsHomeChatLoading(false);
    }
  });

  const sendHomeChatMessage = async () => {
    const trimmedMessage = chatInputValue.trim();

    if (
      !trimmedMessage ||
      !pet ||
      !authToken ||
      !isHomeChatOpen ||
      isHomeChatLoading ||
      isHomeChatSending
    ) {
      return;
    }

    setIsHomeChatSending(true);
    setHomeChatStatusMessage(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, HOME_CHAT_SEND_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE_URL}/pets/${pet.id}/chat`, {
        method: "POST",
        credentials: "include",
        signal: controller.signal,
        headers: buildAuthHeaders(authToken, true),
        body: JSON.stringify({
          message: trimmedMessage,
        }),
      });

      if (response.status === 401) {
        clearStoredAuth();
        clearStoredPetId();
        setAuthToken(null);
        setPet(null);
        setStatus(null);
        setIsPetMenuOpen(false);
        setActivePetPanel(null);
        setStatusSyncNotice(null);
        setLastStatusSyncedAt(null);
        setStatusViewState("loading");
        resetHomeChatState();
        setPageStatusNotice(createHomePageNotice(LOGIN_REQUIRED_MESSAGE, "info"));
        return;
      }

      if (response.status === 404) {
        clearStoredPetId();
        setHomeChatStatusMessage({
          type: "error",
          message: MISSING_PET_MESSAGE,
        });
        return;
      }

      if (!response.ok) {
        setHomeChatStatusMessage({
          type: "error",
          message: await getResponseErrorMessage(
            response,
            HOME_CHAT_SEND_FAILURE_MESSAGE
          ),
        });
        return;
      }

      const data: unknown = await response.json();
      if (!isChatResponse(data)) {
        setHomeChatStatusMessage({
          type: "error",
          message: "后端返回的聊天数据格式不正确。",
        });
        return;
      }

      setChatMessages((currentMessages) => [
        ...currentMessages,
        data.user_message,
        data.pet_message,
      ]);
      setChatInputValue("");
      setHomeChatStatusMessage(null);
    } catch {
      setHomeChatStatusMessage({
        type: "error",
        message: HOME_CHAT_SEND_FAILURE_MESSAGE,
      });
    } finally {
      window.clearTimeout(timeoutId);
      setIsHomeChatSending(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadHomePage = async () => {
      try {
        const storedAuthToken = readStoredAuthToken();
        if (!storedAuthToken) {
          if (isMounted) {
            setPageStatusNotice(createHomePageNotice(LOGIN_REQUIRED_MESSAGE, "info"));
          }
          return;
        }

        if (isMounted) {
          setAuthToken(storedAuthToken);
        }

        let activePetId = readStoredPetId();
        if (!activePetId) {
          const restoreResult = await recoverLatestPetForCurrentUser(
            storedAuthToken,
            RESTORE_PET_FAILURE_MESSAGE
          );

          if (restoreResult.unauthorized) {
            if (isMounted) {
              setPageStatusNotice(
                createHomePageNotice(LOGIN_REQUIRED_MESSAGE, "info")
              );
              clearStoredAuth();
            }
            return;
          }

          activePetId = restoreResult.pet?.id ?? null;
        }

        if (!activePetId) {
          if (isMounted) {
            setPageStatusNotice(
              createHomePageNotice("你还没有宠物，先去创建一只再进入家庭场景。")
            );
          }
          return;
        }

        const petResponse = await fetch(`${API_BASE_URL}/pets/${activePetId}`, {
          cache: "no-store",
          credentials: "include",
          headers: buildAuthHeaders(storedAuthToken),
        });

        if (petResponse.status === 401) {
          if (isMounted) {
            clearStoredAuth();
            clearStoredPetId();
            setPageStatusNotice(
              createHomePageNotice(LOGIN_REQUIRED_MESSAGE, "info")
            );
          }
          return;
        }

        if (!petResponse.ok) {
          if (isMounted) {
            setPageStatusNotice(
              createHomePageNotice(
                await getResponseErrorMessage(
                  petResponse,
                  HOME_LOAD_FAILURE_MESSAGE
                )
              )
            );
          }
          return;
        }

        const petData: unknown = await petResponse.json();
        if (!isPetApiResponse(petData)) {
          if (isMounted) {
            setPageStatusNotice(
              createHomePageNotice("后端返回的宠物数据格式不正确。")
            );
          }
          return;
        }

        if (isMounted) {
          setPet(petData.pet);
          setPageStatusNotice(null);
          setStatusViewState("loading");
        }

        const statusResult = await fetchPetStatus(petData.pet.id, storedAuthToken);
        if (isMounted && statusResult.kind === "failed") {
          setStatusSyncNotice(null);
          setStatusViewState("unavailable");
        }
        void fetchPlacedFurniture(petData.pet.id, storedAuthToken);

        // 加载所有宠物列表及各自状态
        try {
          const allPetsRes = await fetch(`${API_BASE_URL}/pets`, {
            cache: "no-store",
            credentials: "include",
            headers: buildAuthHeaders(storedAuthToken),
          });
          if (allPetsRes.ok && isMounted) {
            const allPetsData: unknown = await allPetsRes.json();
            if (isPetListResponse(allPetsData)) {
              setPets(allPetsData.pets);
              // 并发获取所有宠物状态
              const statusMap = new Map<number, PetStatus>();
              await Promise.all(
                allPetsData.pets.map(async (p) => {
                  try {
                    const sRes = await fetch(`${API_BASE_URL}/pets/${p.id}/status`, {
                      cache: "no-store",
                      credentials: "include",
                      headers: buildAuthHeaders(storedAuthToken),
                    });
                    if (sRes.ok) {
                      const sData: unknown = await sRes.json();
                      if (isPetStatus(sData)) statusMap.set(p.id, sData);
                    }
                  } catch { /* ignore */ }
                })
              );
              if (isMounted) setPetStatuses(statusMap);
            }
          }
        } catch { /* ignore */ }

      } catch {
        if (isMounted) {
          setPageStatusNotice(createHomePageNotice(HOME_LOAD_FAILURE_MESSAGE));
        }
      } finally {
        if (isMounted) {
          setIsLoaded(true);
        }
      }
    };

    void loadHomePage();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!pet || !authToken) {
      setIsFurnitureEditMode(false);
      setIsFurnitureLayoutSaving(false);
      furnitureBaselineRef.current = null;
      setIsPetMenuOpen(false);
      setActivePetPanel(null);
      setStatusSyncNotice(null);
      setLastStatusSyncedAt(null);
      setStatusViewState("loading");
      setIsCareActionRunning(false);
      resetHomeChatState();
      return;
    }

    const intervalId = window.setInterval(() => {
      void pollPetStatus(pet.id, authToken);
    }, 12000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [authToken, pet]);

  useEffect(() => {
    if (
      !isHomeChatOpen ||
      !pet ||
      !authToken ||
      isHomeChatLoaded ||
      isHomeChatLoading
    ) {
      return;
    }

    void loadHomeChatMessages(pet.id, authToken);
  }, [
    authToken,
    isHomeChatLoaded,
    isHomeChatLoading,
    isHomeChatOpen,
    pet,
  ]);

  useEffect(() => {
    if (!isHomeChatOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const messagesContainer = chatMessagesContainerRef.current;

      if (!messagesContainer) {
        return;
      }

      messagesContainer.scrollTo({
        top: messagesContainer.scrollHeight,
        behavior: "auto",
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [chatMessages, isHomeChatOpen]);

  useEffect(() => {
    if (!isPetMenuOpen) {
      return;
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPetMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPetMenuOpen]);

  useEffect(() => {
    if (!sceneNotice) {
      return;
    }

    const dismissAfterMs = getNoticeAutoDismissMs(sceneNotice.scope);
    if (!dismissAfterMs) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSceneNotice(null);
    }, dismissAfterMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [sceneNotice]);

  const handlePetSwitch = (_newPetId: number) => {
    void _newPetId;
    window.location.reload();
  };

  const handleFurnitureDraftChange = (nextFurniture: PlacedFurnitureResponse[]) => {
    setPlacedFurniture(clonePlacedFurnitureItems(nextFurniture));
  };

  const handleFurnitureEditError = (message: string) => {
    setSceneNotice({
      scope: "scene",
      tone: "error",
      text: message,
    });
  };

  const saveFurnitureLayout = async () => {
    if (!pet || !authToken) {
      return false;
    }

    const baseline = furnitureBaselineRef.current;
    if (!baseline) {
      setIsFurnitureEditMode(false);
      return true;
    }

    const changedItems = placedFurniture.filter((item) => {
      const previous = baseline.find((candidate) => candidate.id === item.id);
      if (!previous) {
        return true;
      }
      return (
        previous.room !== item.room ||
        previous.tile_x !== item.tile_x ||
        previous.tile_y !== item.tile_y ||
        previous.rotation !== item.rotation ||
        previous.flipped !== item.flipped
      );
    });

    if (changedItems.length === 0) {
      furnitureBaselineRef.current = null;
      setIsFurnitureEditMode(false);
      return true;
    }

    setIsFurnitureLayoutSaving(true);

    try {
      const savedItems = await Promise.all(
        changedItems.map((item) =>
          moveFurniture(
            pet.id,
            authToken,
            item.id,
            item.room,
            item.tile_x,
            item.tile_y,
            item.rotation,
            item.flipped
          )
        )
      );

      const savedItemMap = new Map(savedItems.map((item) => [item.id, item]));
      setPlacedFurniture((currentItems) =>
        currentItems.map((item) => savedItemMap.get(item.id) ?? item)
      );
      furnitureBaselineRef.current = null;
      setIsFurnitureEditMode(false);
      setSceneNotice({
        scope: "scene",
        tone: "success",
        text: "家具布局已自动保存。",
      });
      return true;
    } catch (error) {
      setSceneNotice({
        scope: "scene",
        tone: "error",
        text: error instanceof Error ? error.message : "保存家具布局失败，请稍后再试。",
      });
      return false;
    } finally {
      setIsFurnitureLayoutSaving(false);
    }
  };

  const handleFurnitureEditToggle = async () => {
    if (!pet || !authToken || isFurnitureLayoutSaving) {
      return;
    }

    if (!isFurnitureEditMode) {
      furnitureBaselineRef.current = clonePlacedFurnitureItems(placedFurniture);
      setIsFurnitureEditMode(true);
      setSceneNotice({
        scope: "scene",
        tone: "info",
        text: "已进入布置模式。拖拽家具会吸附网格，双击可旋转，退出时自动保存。",
      });
      return;
    }

    await saveFurnitureLayout();
  };

  const handleSceneAction = async (action: SceneAction) => {
    if (!pet || !authToken) {
      return;
    }

    if (isFurnitureEditMode && action !== "pet") {
      return;
    }

    if (action === "pet") {
      setIsPetMenuOpen(true);
      setSceneNotice(createPetSelectionSceneNotice());
      return;
    }

    if (action === "bed") {
      setActivePetPanel("status");
      setSceneNotice(createSceneTargetNotice(action));
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/pets/${pet.id}/${action}`, {
        method: "POST",
        credentials: "include",
        headers: buildAuthHeaders(authToken),
      });

      if (!response.ok) {
        setSceneNotice(
          createSceneActionErrorNotice(
            action,
            await getResponseErrorMessage(
              response,
              `${HOME_SCENE_OBJECTS[action].label}互动失败，请稍后再试。`
            )
          )
        );
        return;
      }

      const data: unknown = await response.json();
      if (
        data &&
        typeof data === "object" &&
        "status" in data &&
        isPetStatus((data as { status?: unknown }).status)
      ) {
        applyStatusSnapshot((data as { status: PetStatus }).status);
      }

      if (
        data &&
        typeof data === "object" &&
        "message" in data &&
        typeof (data as { message?: unknown }).message === "string"
      ) {
        setSceneNotice(
          createSceneActionSuccessNotice(
            action,
            (data as { message: string }).message
          )
        );
      } else {
        setSceneNotice(createSceneActionSuccessNotice(action));
      }
    } catch {
      setSceneNotice(createSceneActionNetworkNotice(action));
    }
  };

  const handlePetMenuAction = (action: PetInteractionMenuAction) => {
    setIsPetMenuOpen(false);
    if (action === "chat") {
      setIsHomeChatLoaded(false);
    }
    setActivePetPanel(action);
  };

  const handleCareAction = async (action: CareAction, label: string) => {
    if (!pet || !authToken || isCareActionRunning) {
      return;
    }

    setIsCareActionRunning(true);
    setSceneNotice(null);

    try {
      const response = await fetch(`${API_BASE_URL}/pets/${pet.id}/${action}`, {
        method: "POST",
        credentials: "include",
        headers: buildAuthHeaders(authToken),
      });

      if (!response.ok) {
        setSceneNotice({
          scope: "scene",
          tone: "error",
          text: await getResponseErrorMessage(
            response,
            `${label} 没成功，再试试吧。`
          ),
        });
        return;
      }

      const data: unknown = await response.json();
      if (
        data &&
        typeof data === "object" &&
        "status" in data &&
        isPetStatus((data as { status?: unknown }).status)
      ) {
        applyStatusSnapshot((data as { status: PetStatus }).status);
      }

      setSceneNotice({
        scope: "scene",
        tone: "success",
        text: `${label} 已经帮你做好了。`,
      });
    } catch {
      setSceneNotice({
        scope: "scene",
        tone: "error",
        text: "刚刚没连上，再试试吧。",
      });
    } finally {
      setIsCareActionRunning(false);
    }
  };

  const handleHomeChatSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendHomeChatMessage();
  };

  const handleHomeChatInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (!canSendHomeChatMessage) {
      return;
    }

    void sendHomeChatMessage();
  };

  const activeCompanionTab: HomeCompanionTab = isHomeChatOpen
    ? "chat"
    : isFurniturePanelOpen
      ? "furniture"
      : "status";

  const handleCompanionTabChange = (tab: HomeCompanionTab) => {
    setIsPetMenuOpen(false);

    if (tab === "status") {
      setActivePetPanel("status");
      return;
    }

    if (tab === "chat") {
      setIsHomeChatLoaded(false);
      setActivePetPanel("chat");
      return;
    }

    setActivePetPanel(null);
    if (!isFurnitureEditMode) {
      void handleFurnitureEditToggle();
    }
  };

  return (
    <main className={ui.pageShell}>
      <div className={ui.pageInner}>
        <AppHeaderNav
          currentPetName={pet?.petName ?? null}
          currentPetMeta={pet?.species ?? null}
        />

        {!isLoaded ? (
          <SkeletonBlock className="h-32" label="正在打开宠物小窝" />
        ) : null}

        {isLoaded && !authToken ? (
          <EmptyState
            title="请先登录"
            description={pageStatusNotice?.text || LOGIN_REQUIRED_MESSAGE}
            action={
              <Link href="/login" className={ui.buttonPrimary}>
                去登录
              </Link>
            }
          />
        ) : null}

        {isLoaded && authToken && !pet ? (
          <EmptyState
            title="还没有小窝主人"
            description={pageStatusNotice?.text || MISSING_PET_MESSAGE}
            action={
              <Link href="/create-pet" className={ui.buttonPrimary}>
                创建宠物
              </Link>
            }
          />
        ) : null}

        {isLoaded && authToken && pet ? (
          <>
            <div className="mb-4 flex justify-end">
              <PetSwitcher
                currentPetId={pet.id}
                authToken={authToken}
                onPetSwitch={handlePetSwitch}
              />
            </div>

            <HomeHero
              petName={pet.petName}
              roomLabel={currentRoomMeta.label}
              status={status}
              freshnessText={
                lastStatusSyncedAt
                  ? buildHomeStatusFreshnessText(lastStatusSyncedAt)
                  : null
              }
            />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px] xl:grid-cols-[minmax(0,1fr)_430px]">
              <HomeSceneShell
                petName={pet.petName}
                currentRoom={currentRoom}
                statusSummary={
                  statusDisplayPolicy.showSummaryBadge
                    ? getHomeStatusSummaryText(status, statusViewState)
                    : null
                }
                isFurnitureEditMode={isFurnitureEditMode}
                isFurnitureLayoutSaving={isFurnitureLayoutSaving}
                isPetMenuOpen={isPetMenuOpen}
                onRoomChange={setCurrentRoom}
                onSaveFurniture={() => {
                  void handleFurnitureEditToggle();
                }}
                onClosePetMenu={() => setIsPetMenuOpen(false)}
                onPetMenuAction={handlePetMenuAction}
                onOpenFurniture={() => {
                  setIsPetMenuOpen(false);
                  setActivePetPanel(null);
                  if (!isFurnitureEditMode) {
                    void handleFurnitureEditToggle();
                  }
                }}
                onOpenChat={() => {
                  setIsPetMenuOpen(false);
                  setIsHomeChatLoaded(false);
                  setActivePetPanel("chat");
                }}
                sceneNode={
                  <PetHomeScene
                    currentRoom={currentRoom}
                    isEditMode={isFurnitureEditMode}
                    pets={
                      pets.length > 0
                        ? pets.map((p) => ({
                            id: p.id,
                            petName: p.petName,
                            petSpecies: p.species,
                            petColor: p.color,
                            petSize: p.size,
                            petPersonality: p.personality,
                            petSpecialTraits: p.specialTraits,
                            petStatus: petStatuses.get(p.id) ?? null,
                            recentSocialEmotion: normalizeHomeSocialEmotion(
                              petStatuses.get(p.id)?.socialEmotion ?? null
                            ),
                          }))
                        : [
                            {
                              id: pet.id,
                              petName: pet.petName,
                              petSpecies: pet.species,
                              petColor: pet.color,
                              petSize: pet.size,
                              petPersonality: pet.personality,
                              petSpecialTraits: pet.specialTraits,
                              petStatus: status,
                              recentSocialEmotion: normalizeHomeSocialEmotion(
                                status?.socialEmotion ?? null
                              ),
                            },
                          ]
                    }
                    placedFurniture={placedFurniture}
                    onPlacedFurnitureChange={handleFurnitureDraftChange}
                    onEditError={handleFurnitureEditError}
                    onAction={(action) => {
                      void handleSceneAction(action);
                    }}
                  />
                }
                notices={
                  <>
                    {statusDisplayPolicy.showSyncNotice && statusSyncNotice ? (
                      <div
                        className={`rounded-[20px] border px-4 py-3 text-sm leading-6 ${getHomeStatusSyncNoticeClassName(statusSyncNotice.tone)}`}
                      >
                        {statusSyncNotice.text}
                      </div>
                    ) : null}
                    {sceneNotice ? (
                      <div
                        className={`rounded-[20px] border px-4 py-3 text-sm leading-6 ${getHomeSceneNoticeClassName(sceneNotice.tone)}`}
                      >
                        {sceneNotice.text}
                      </div>
                    ) : null}
                  </>
                }
              />

              <HomeSidebarTabs
                activeTab={activeCompanionTab}
                roomLabel={currentRoomMeta.label}
                onTabChange={handleCompanionTabChange}
                statusPanel={
                  <HomeStatusPanel
                    status={status}
                    statusViewState={statusViewState}
                    isActing={isCareActionRunning}
                    onCareAction={(action, label) => {
                      void handleCareAction(action, label);
                    }}
                  />
                }
                chatPanel={
                  <HomeChatPanel
                    petName={pet.petName}
                    messages={chatMessages}
                    inputValue={chatInputValue}
                    isLoading={isHomeChatLoading}
                    isSending={isHomeChatSending}
                    canSend={canSendHomeChatMessage}
                    statusMessage={homeChatStatusMessage}
                    messagesRef={chatMessagesContainerRef}
                    onInputChange={setChatInputValue}
                    onSubmit={handleHomeChatSubmit}
                    onInputKeyDown={handleHomeChatInputKeyDown}
                  />
                }
                furniturePanel={
                  <HomeFurniturePanel
                    isEditMode={isFurnitureEditMode}
                    isSaving={isFurnitureLayoutSaving}
                    onToggleEdit={() => {
                      void handleFurnitureEditToggle();
                    }}
                  />
                }
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-2 text-sm">
              <Link href="/chat" className={ui.buttonOutline}>
                去聊天页
              </Link>
              <Link href="/my-pet" className={ui.buttonOutline}>
                看看宠物资料
              </Link>
              <Link href="/social" className={ui.buttonOutline}>
                去社交看看
              </Link>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
