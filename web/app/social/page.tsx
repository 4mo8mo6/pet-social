"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  SocialConversationPanel,
  SocialFriendshipsPanel,
  SocialTargetsPanel,
  SocialTaskHistoryPanel,
} from "../../lib/SocialDashboardSections";
import { EmptyState, SkeletonBlock } from "../../lib/feedback";
import {
  buildAuthHeaders,
  clearStoredAuth,
  readStoredAuthToken,
} from "../../lib/auth";
import { API_BASE_URL, LOGIN_REQUIRED_MESSAGE } from "../../lib/constants";
import {
  clearStoredPetId,
  getResponseErrorMessage,
  isPetApiResponse,
  readStoredPetId,
  recoverLatestPetForCurrentUser,
} from "../../lib/pet";
import { PetSwitcher } from "../../lib/PetSwitcher";
import {
  type Friendship,
  type SocialCandidate,
  type SocialConversation,
  type SocialReplyPayload,
  type SocialTaskHistoryItem,
  isFriendshipActionResponse,
  isFriendshipListResponse,
  isSocialCandidateListResponse,
  isSocialMessageListResponse,
  isSocialSendResponse,
  isSocialTaskListResponse,
  sortSocialCandidates,
} from "../../lib/social";
import { AppHeaderNav } from "../../lib/AppHeaderNav";
import { ui } from "../../lib/ui";

const LOAD_FAILURE_MESSAGE = "加载站内社交数据失败，请稍后再试。";
const ACTION_FAILURE_MESSAGE = "操作失败，请稍后再试。";

export default function SocialPage() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [petId, setPetId] = useState<number | null>(null);
  const [petName, setPetName] = useState("");
  const [petSpecies, setPetSpecies] = useState("");
  const [candidates, setCandidates] = useState<SocialCandidate[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [tasks, setTasks] = useState<SocialTaskHistoryItem[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null);
  const [conversation, setConversation] = useState<SocialConversation | null>(null);
  const [latestReply, setLatestReply] = useState<SocialReplyPayload | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);

  const selectedCandidate =
    candidates.find((candidate) => candidate.pet.id === selectedTargetId) ?? null;

  const handleUnauthorized = () => {
    clearStoredAuth();
    clearStoredPetId();
    setAuthToken(null);
    setPetId(null);
    setPetName("");
    setPetSpecies("");
    setCandidates([]);
    setFriendships([]);
    setTasks([]);
    setSelectedTargetId(null);
    setConversation(null);
    setLatestReply(null);
    setStatusMessage(LOGIN_REQUIRED_MESSAGE);
  };

  const readConversation = async (
    activePetId: number,
    token: string,
    targetPetId: number
  ) => {
    const response = await fetch(
      `${API_BASE_URL}/pets/${activePetId}/social/messages/${targetPetId}`,
      {
        cache: "no-store",
        credentials: "include",
        headers: buildAuthHeaders(token),
      }
    );

    if (response.status === 401) {
      handleUnauthorized();
      return null;
    }
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(await getResponseErrorMessage(response, LOAD_FAILURE_MESSAGE));
    }

    const data: unknown = await response.json();
    if (!isSocialMessageListResponse(data)) {
      throw new Error(LOAD_FAILURE_MESSAGE);
    }
    return data.conversation;
  };

  const loadDashboard = async (
    activePetId: number,
    token: string,
    preferredTargetId?: number | null
  ) => {
    const [petResponse, candidatesResponse, friendsResponse, tasksResponse] =
      await Promise.all([
        fetch(`${API_BASE_URL}/pets/${activePetId}`, {
          cache: "no-store",
          credentials: "include",
          headers: buildAuthHeaders(token),
        }),
        fetch(`${API_BASE_URL}/pets/${activePetId}/social/candidates`, {
          cache: "no-store",
          credentials: "include",
          headers: buildAuthHeaders(token),
        }),
        fetch(`${API_BASE_URL}/pets/${activePetId}/friends`, {
          cache: "no-store",
          credentials: "include",
          headers: buildAuthHeaders(token),
        }),
        fetch(`${API_BASE_URL}/pets/${activePetId}/social/tasks`, {
          cache: "no-store",
          credentials: "include",
          headers: buildAuthHeaders(token),
        }),
      ]);

    if (
      petResponse.status === 401 ||
      candidatesResponse.status === 401 ||
      friendsResponse.status === 401 ||
      tasksResponse.status === 401
    ) {
      handleUnauthorized();
      return;
    }

    if (
      !petResponse.ok ||
      !candidatesResponse.ok ||
      !friendsResponse.ok ||
      !tasksResponse.ok
    ) {
      const failedResponse =
        !petResponse.ok
          ? petResponse
          : !candidatesResponse.ok
            ? candidatesResponse
            : !friendsResponse.ok
              ? friendsResponse
              : tasksResponse;
      throw new Error(
        await getResponseErrorMessage(failedResponse, LOAD_FAILURE_MESSAGE)
      );
    }

    const petData: unknown = await petResponse.json();
    const candidatesData: unknown = await candidatesResponse.json();
    const friendsData: unknown = await friendsResponse.json();
    const tasksData: unknown = await tasksResponse.json();

    if (
      !isPetApiResponse(petData) ||
      !isSocialCandidateListResponse(candidatesData) ||
      !isFriendshipListResponse(friendsData) ||
      !isSocialTaskListResponse(tasksData)
    ) {
      throw new Error("后端返回的社交数据格式不正确。");
    }

    const sortedCandidates = sortSocialCandidates(candidatesData.candidates);

    setPetId(petData.pet.id);
    setPetName(petData.pet.petName);
    setPetSpecies(petData.pet.species);
    setCandidates(sortedCandidates);
    setFriendships(friendsData.friends);
    setTasks(tasksData.tasks);

    const nextTargetId =
      preferredTargetId &&
      sortedCandidates.some((item) => item.pet.id === preferredTargetId)
        ? preferredTargetId
        : sortedCandidates[0]?.pet.id ?? null;

    setSelectedTargetId(nextTargetId);
    setConversation(
      nextTargetId ? await readConversation(activePetId, token, nextTargetId) : null
    );
    if (!preferredTargetId) {
      setLatestReply(null);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadPage = async () => {
      try {
        const storedToken = readStoredAuthToken();
        if (!storedToken) {
          setStatusMessage(LOGIN_REQUIRED_MESSAGE);
          return;
        }

        setAuthToken(storedToken);
        let activePetId = readStoredPetId();

        if (!activePetId) {
          const restoreResult = await recoverLatestPetForCurrentUser(
            storedToken,
            LOAD_FAILURE_MESSAGE
          );
          if (restoreResult.unauthorized) {
            handleUnauthorized();
            return;
          }
          activePetId = restoreResult.pet?.id ?? null;
        }

        if (!activePetId) {
          setStatusMessage("你还没有宠物，先去创建一只再开始社交吧。");
          return;
        }

        await loadDashboard(activePetId, storedToken, null);
      } catch (error) {
        if (isMounted) {
          setStatusMessage(
            error instanceof Error ? error.message : LOAD_FAILURE_MESSAGE
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadPage();

    return () => {
      isMounted = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runAction = async (runner: () => Promise<void>) => {
    if (isActing) {
      return;
    }

    setIsActing(true);
    setStatusMessage(null);

    try {
      await runner();
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : ACTION_FAILURE_MESSAGE
      );
    } finally {
      setIsActing(false);
    }
  };

  const refresh = async (preferredTargetId?: number | null) => {
    if (!petId || !authToken) {
      return;
    }
    await loadDashboard(petId, authToken, preferredTargetId ?? selectedTargetId);
  };

  const postAndRefresh = async (
    url: string,
    init: RequestInit,
    preferredTargetId?: number | null
  ) => {
    if (!authToken) {
      return;
    }

    const response = await fetch(url, { ...init, credentials: "include" });
    if (response.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!response.ok) {
      throw new Error(
        await getResponseErrorMessage(response, ACTION_FAILURE_MESSAGE)
      );
    }

    const data: unknown = await response.json();
    if (!isFriendshipActionResponse(data) && !isSocialSendResponse(data)) {
      throw new Error(ACTION_FAILURE_MESSAGE);
    }

    const socialResponse = isSocialSendResponse(data) ? data : null;
    const nextTargetId = socialResponse?.targetPet.id ?? preferredTargetId;

    await refresh(nextTargetId);
    setLatestReply(socialResponse?.reply ?? null);
    setStatusMessage(data.message);
  };

  const handlePetSwitch = () => {
    window.location.reload();
  };

  const handleRunSocialRound = async () => {
    if (!petId || !authToken) {
      return;
    }

    await runAction(async () => {
      await postAndRefresh(`${API_BASE_URL}/pets/${petId}/social/round`, {
        method: "POST",
        credentials: "include",
        headers: buildAuthHeaders(authToken),
      });
    });
  };

  const handleRequestFriendship = async (targetPetId: number) => {
    if (!petId || !authToken) {
      return;
    }

    await runAction(async () => {
      await postAndRefresh(
        `${API_BASE_URL}/pets/${petId}/friends/request`,
        {
          method: "POST",
          credentials: "include",
          headers: buildAuthHeaders(authToken, true),
          body: JSON.stringify({
            targetPetId,
          }),
        },
        targetPetId
      );
    });
  };

  const handleAcceptFriendship = async (friendId: number) => {
    if (!petId || !authToken) {
      return;
    }

    await runAction(async () => {
      await postAndRefresh(
        `${API_BASE_URL}/pets/${petId}/friends/${friendId}/accept`,
        {
          method: "POST",
          credentials: "include",
          headers: buildAuthHeaders(authToken),
        },
        friendId
      );
    });
  };

  const handleRejectFriendship = async (friendId: number) => {
    if (!petId || !authToken) {
      return;
    }

    await runAction(async () => {
      await postAndRefresh(
        `${API_BASE_URL}/pets/${petId}/friends/${friendId}/reject`,
        {
          method: "POST",
          credentials: "include",
          headers: buildAuthHeaders(authToken),
        },
        friendId
      );
    });
  };

  const handleSelectTarget = async (targetId: number) => {
    if (!petId || !authToken) {
      return;
    }

    setSelectedTargetId(targetId);
    setLatestReply(null);
    try {
      setConversation(await readConversation(petId, authToken, targetId));
    } catch (error) {
      setConversation(null);
      setStatusMessage(
        error instanceof Error ? error.message : LOAD_FAILURE_MESSAGE
      );
    }
  };

  const handleSendMessage = async () => {
    if (!petId || !authToken || !selectedCandidate || !draftMessage.trim()) {
      return;
    }

    await runAction(async () => {
      await postAndRefresh(
        `${API_BASE_URL}/pets/${petId}/social/send`,
        {
          method: "POST",
          credentials: "include",
          headers: buildAuthHeaders(authToken, true),
          body: JSON.stringify({
            targetPetId: selectedCandidate.pet.id,
            message: draftMessage.trim(),
          }),
        },
        selectedCandidate.pet.id
      );
      setDraftMessage("");
    });
  };

  return (
    <main className={ui.pageShell}>
      <div className={ui.pageInner}>
        <AppHeaderNav
          currentPetName={petName || null}
          currentPetMeta={petSpecies || null}
        />

        <div className={ui.pageHero}>
          <div>
            <p className={ui.pageEyebrow}>Social dashboard</p>
            <h1 className={ui.pageTitle}>站内社交引擎</h1>
            <p className={ui.pageLead}>
              当前宠物：{petName || "未选择"}。在这里处理好友、消息和社交记录。
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link
              href="/community"
              className={`${ui.buttonOutline} px-4 py-2`}
            >
              去社区
            </Link>
            {authToken && petId ? (
              <PetSwitcher
                currentPetId={petId}
                authToken={authToken}
                onPetSwitch={handlePetSwitch}
              />
            ) : null}
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_320px]">
            <SkeletonBlock className="h-[520px]" label="正在加载社交目标" />
            <SkeletonBlock className="h-[620px]" label="正在加载会话" />
            <SkeletonBlock className="hidden h-[520px] xl:block" label="正在加载社交历史" />
          </div>
        ) : null}

        {!isLoading && !authToken ? (
          <EmptyState
            title="请先登录"
            description={statusMessage || LOGIN_REQUIRED_MESSAGE}
            action={
              <Link href="/" className={ui.buttonPrimary}>
                去登录
              </Link>
            }
          />
        ) : null}

        {!isLoading && authToken && !petId ? (
          <EmptyState
            title="还没有可社交的宠物"
            description={statusMessage || "先创建宠物，再回来发起站内社交。"}
            action={
              <Link href="/create-pet" className={ui.buttonPrimary}>
                创建宠物
              </Link>
            }
          />
        ) : null}

        {!isLoading && authToken && petId ? (
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_320px]">
            <SocialTargetsPanel
              candidates={candidates}
              selectedTargetId={selectedTargetId}
              statusMessage={statusMessage}
              isActing={isActing}
              onRunSocialRound={() => void handleRunSocialRound()}
              onSelectTarget={(targetId) => void handleSelectTarget(targetId)}
              onRequestFriendship={(targetId) =>
                void handleRequestFriendship(targetId)
              }
              onAcceptFriendship={(friendId) =>
                void handleAcceptFriendship(friendId)
              }
              onRejectFriendship={(friendId) =>
                void handleRejectFriendship(friendId)
              }
              className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)]"
            />

            <SocialConversationPanel
              petId={petId}
              petName={petName}
              selectedCandidate={selectedCandidate}
              conversation={conversation}
              latestReply={latestReply}
              draftMessage={draftMessage}
              isActing={isActing}
              onDraftMessageChange={setDraftMessage}
              onSendMessage={() => void handleSendMessage()}
              className="min-h-[680px]"
            />

            <div className="space-y-6 xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:overflow-y-auto xl:pr-1">
              <SocialTaskHistoryPanel tasks={tasks} />
              <SocialFriendshipsPanel friendships={friendships} />
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
