"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import {
  buildAuthHeaders,
  clearStoredAuth,
  readStoredAuthToken,
} from "../../lib/auth";
import { API_BASE_URL } from "../../lib/constants";
import {
  type ApiPet,
  EMPTY_PET,
  clearLegacyPetProfile,
  clearStoredPetId,
  getResponseErrorMessage,
  isPetApiResponse,
  mapApiPetToProfile,
  readStoredPetId,
  writeStoredPetId,
  type PetAvatarStatus,
  type PetProfile,
} from "../../lib/pet";
import {
  getAppearanceSummary,
  getColorDisplay,
  getSizeDisplay,
  getSocialStatus,
  getSpeciesVisual,
  getTemperamentTag,
} from "../../lib/pet-display";
import { AppHeaderNav } from "../../lib/AppHeaderNav";
import { PetAvatarImage } from "../../lib/PetAvatarImage";
import { cx, ui } from "../../lib/ui";

const SPECIES_OPTIONS = ["猫咪", "狗狗", "兔子", "狐狸", "其他"] as const;
const SIZE_OPTIONS = ["小型", "中型", "大型"] as const;
const COLOR_OPTIONS = ["橘白", "纯黑", "奶油色", "灰白", "金色"] as const;
const PERSONALITY_LIMIT = 160;
const TRAITS_LIMIT = 140;
const AVATAR_POLL_INTERVAL_MS = 2500;

type AvatarState = {
  avatarStatus: PetAvatarStatus;
  avatarImageUrl: string | null;
  avatarThumbUrl: string | null;
  avatarVersion: number;
  avatarError: string | null;
  avatarUpdatedAt: string | null;
};

const EMPTY_AVATAR_STATE: AvatarState = {
  avatarStatus: "missing",
  avatarImageUrl: null,
  avatarThumbUrl: null,
  avatarVersion: 0,
  avatarError: null,
  avatarUpdatedAt: null,
};

function extractAvatarState(pet: Partial<ApiPet> | null | undefined): AvatarState {
  return {
    avatarStatus: pet?.avatarStatus ?? "missing",
    avatarImageUrl: pet?.avatarImageUrl ?? null,
    avatarThumbUrl: pet?.avatarThumbUrl ?? null,
    avatarVersion: pet?.avatarVersion ?? 0,
    avatarError: pet?.avatarError ?? null,
    avatarUpdatedAt: pet?.avatarUpdatedAt ?? null,
  };
}

function arePetProfilesEqual(left: PetProfile, right: PetProfile) {
  return (
    left.petName === right.petName &&
    left.species === right.species &&
    left.color === right.color &&
    left.size === right.size &&
    left.personality === right.personality &&
    left.specialTraits === right.specialTraits
  );
}

function buildAvatarStatusMeta(
  avatarState: AvatarState,
  hasUnsavedChanges: boolean
) {
  if (hasUnsavedChanges) {
    return {
      label: "草稿预览",
      description: "当前展示的是基于表单实时绘制的 SVG 预览。保存后会自动生成新图片。",
      toneClassName: ui.noticeInfo,
    };
  }

  if (avatarState.avatarStatus === "pending") {
    return {
      label: "生成中",
      description: "后台正在根据已保存的宠物信息生成图片，完成后会自动替换当前贴图。",
      toneClassName: ui.noticeInfo,
    };
  }

  if (avatarState.avatarStatus === "ready") {
    return {
      label: "已生成",
      description: "当前已优先使用生成图片，家庭场景和资料页会同步显示这张形象图。",
      toneClassName: ui.noticeSuccess,
    };
  }

  if (avatarState.avatarStatus === "failed") {
    return {
      label: "生成失败",
      description:
        avatarState.avatarError ||
        "图片生成没有成功，当前会继续使用 SVG 头像作为兜底。",
      toneClassName: ui.noticeError,
    };
  }

  return {
    label: "等待生成",
    description: "保存后会自动尝试生成宠物图片；在此之前继续使用 SVG 头像预览。",
    toneClassName: ui.noticeInfo,
  };
}

function CreatePetPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forceNew = searchParams.get("mode") === "new";
  const editId = searchParams.get("id") ? Number(searchParams.get("id")) : null;
  const [pet, setPet] = useState<PetProfile>(EMPTY_PET);
  const [savedPetSnapshot, setSavedPetSnapshot] = useState<PetProfile>(EMPTY_PET);
  const [avatarState, setAvatarState] = useState<AvatarState>(EMPTY_AVATAR_STATE);
  const [petId, setPetId] = useState<number | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isLoadingPet, setIsLoadingPet] = useState(true);
  const [isSavingPet, setIsSavingPet] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const resetToNewPet = () => {
      setPetId(null);
      setPet(EMPTY_PET);
      setSavedPetSnapshot(EMPTY_PET);
      setAvatarState(EMPTY_AVATAR_STATE);
      setFeedback(null);
    };

    const loadPet = async () => {
      try {
        const storedAuthToken = readStoredAuthToken();

        if (!storedAuthToken) {
          router.replace("/?next=/create-pet");
          return;
        }

        if (isMounted) {
          setAuthToken(storedAuthToken);
        }

        if (forceNew) {
          if (isMounted) {
            resetToNewPet();
          }
          return;
        }

        const targetId = editId ?? readStoredPetId();

        if (!targetId) {
          if (isMounted) {
            resetToNewPet();
          }
          return;
        }

        const response = await fetch(`${API_BASE_URL}/pets/${targetId}`, {
          cache: "no-store",
          credentials: "include",
          headers: buildAuthHeaders(storedAuthToken),
        });

        if (response.status === 401) {
          clearStoredAuth();
          router.replace("/?next=/create-pet");
          return;
        }

        if (response.status === 404) {
          clearStoredPetId();
          if (isMounted) {
            resetToNewPet();
            setFeedback({
              type: "info",
              message: "没有找到这只宠物，已经切回新建模式。",
            });
          }
          return;
        }

        if (!response.ok) {
          const errorMessage = await getResponseErrorMessage(
            response,
            "加载宠物资料失败，请稍后再试。"
          );
          if (isMounted) {
            setFeedback({ type: "error", message: errorMessage });
          }
          return;
        }

        const data: unknown = await response.json();

        if (!isPetApiResponse(data)) {
          if (isMounted) {
            setFeedback({
              type: "error",
              message: "后端返回的宠物数据格式不正确。",
            });
          }
          return;
        }

        if (isMounted) {
          const loadedPet = mapApiPetToProfile(data.pet);
          setPetId(data.pet.id);
          setPet(loadedPet);
          setSavedPetSnapshot(loadedPet);
          setAvatarState(extractAvatarState(data.pet));
          writeStoredPetId(data.pet.id);
          clearLegacyPetProfile();
          setFeedback(null);
        }
      } catch {
        if (isMounted) {
          setFeedback({
            type: "error",
            message: "暂时连不上后端，请确认服务已经启动。",
          });
        }
      } finally {
        if (isMounted) {
          setIsLoadingPet(false);
        }
      }
    };

    void loadPet();

    return () => {
      isMounted = false;
    };
  }, [editId, forceNew, router]);

  useEffect(() => {
    if (!petId || !authToken || avatarState.avatarStatus !== "pending") {
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;

    const scheduleNextPoll = () => {
      if (cancelled) {
        return;
      }

      timeoutId = window.setTimeout(() => {
        void pollAvatarState();
      }, AVATAR_POLL_INTERVAL_MS);
    };

    const pollAvatarState = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/pets/${petId}`, {
          cache: "no-store",
          credentials: "include",
          headers: buildAuthHeaders(authToken),
        });

        if (response.status === 401) {
          clearStoredAuth();
          setAuthToken(null);
          router.replace("/?next=/create-pet");
          return;
        }

        if (!response.ok) {
          scheduleNextPoll();
          return;
        }

        const data: unknown = await response.json();

        if (!isPetApiResponse(data) || cancelled) {
          scheduleNextPoll();
          return;
        }

        const nextAvatarState = extractAvatarState(data.pet);
        setAvatarState(nextAvatarState);

        if (nextAvatarState.avatarStatus === "pending") {
          scheduleNextPoll();
          return;
        }

        const avatarErrorMessage = nextAvatarState.avatarError;

        if (nextAvatarState.avatarStatus === "failed" && avatarErrorMessage) {
          setFeedback((currentFeedback) =>
            currentFeedback?.type === "error"
              ? currentFeedback
              : {
                  type: "error",
                  message: avatarErrorMessage,
                }
          );
        }
      } catch {
        scheduleNextPoll();
      }
    };

    void pollAvatarState();

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [authToken, avatarState.avatarStatus, petId, router]);

  const handlePetChange = (field: keyof PetProfile, value: string) => {
    setPet((currentPet) => ({
      ...currentPet,
      [field]: value,
    }));
    setFeedback(null);
  };

  const startAvatarGeneration = async (
    targetPetId: number,
    token: string,
    trigger: "auto" | "manual"
  ) => {
    const previousAvatarState = avatarState;

    setAvatarState((currentState) => ({
      ...currentState,
      avatarStatus: "pending",
      avatarError: null,
    }));

    try {
      const response = await fetch(
        `${API_BASE_URL}/pets/${targetPetId}/avatar/regenerate`,
        {
          method: "POST",
          credentials: "include",
          headers: buildAuthHeaders(token),
        }
      );

      if (response.status === 401) {
        clearStoredAuth();
        setAuthToken(null);
        router.replace("/?next=/create-pet");
        return { started: false, errorMessage: "登录状态已过期，请重新登录。" };
      }

      if (!response.ok) {
        const errorMessage = await getResponseErrorMessage(
          response,
          "暂时无法开始生成宠物形象。"
        );
        setAvatarState({
          ...previousAvatarState,
          avatarError: errorMessage,
        });
        if (trigger === "manual") {
          setFeedback({ type: "error", message: errorMessage });
        }
        return { started: false, errorMessage };
      }

      const data: unknown = await response.json();

      if (!isPetApiResponse(data)) {
        const errorMessage = "头像生成接口返回的数据格式不正确。";
        setAvatarState({
          ...previousAvatarState,
          avatarError: errorMessage,
        });
        if (trigger === "manual") {
          setFeedback({ type: "error", message: errorMessage });
        }
        return { started: false, errorMessage };
      }

      setAvatarState(extractAvatarState(data.pet));

      if (trigger === "manual") {
        setFeedback({
          type: data.pet.avatarStatus === "pending" ? "success" : "info",
          message:
            data.pet.avatarStatus === "pending"
              ? "已经开始重新生成宠物形象。"
              : "宠物形象生成任务已在进行中。",
        });
      }

      return { started: true, errorMessage: null };
    } catch {
      const errorMessage = "暂时连不上后端，无法开始生成宠物形象。";
      setAvatarState({
        ...previousAvatarState,
        avatarError: errorMessage,
      });
      if (trigger === "manual") {
        setFeedback({ type: "error", message: errorMessage });
      }
      return { started: false, errorMessage };
    }
  };

  const handleSavePet = async () => {
    if (!authToken) {
      router.replace("/?next=/create-pet");
      return;
    }

    setIsSavingPet(true);

    try {
      const isUpdating = petId !== null;
      const response = await fetch(
        isUpdating ? `${API_BASE_URL}/pets/${petId}` : `${API_BASE_URL}/pets`,
        {
          method: isUpdating ? "PUT" : "POST",
          credentials: "include",
          headers: buildAuthHeaders(authToken, true),
          body: JSON.stringify(pet),
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          clearStoredAuth();
          setAuthToken(null);
          router.replace("/?next=/create-pet");
          return;
        }

        if (response.status === 404 && isUpdating) {
          clearStoredPetId();
          setPetId(null);
          setSavedPetSnapshot(EMPTY_PET);
          setAvatarState(EMPTY_AVATAR_STATE);
          setFeedback({
            type: "error",
            message: "之前保存的宠物资料找不到了，请重新保存创建一次。",
          });
          return;
        }

        const errorMessage = await getResponseErrorMessage(
          response,
          "这次保存没有成功，请稍后再试一次。"
        );

        setFeedback({
          type: "error",
          message: errorMessage,
        });
        return;
      }

      const data: unknown = await response.json();

      if (!isPetApiResponse(data)) {
        setFeedback({
          type: "error",
          message: "后端返回的宠物数据格式不正确，请稍后再试。",
        });
        return;
      }

      const savedPet = mapApiPetToProfile(data.pet);
      const baseSuccessMessage = isUpdating
        ? "宠物资料已更新并同步到后端。"
        : "宠物资料已创建并同步到后端。";

      setPetId(data.pet.id);
      setPet(savedPet);
      setSavedPetSnapshot(savedPet);
      setAvatarState(extractAvatarState(data.pet));
      writeStoredPetId(data.pet.id);
      clearLegacyPetProfile();

      const generationResult = await startAvatarGeneration(
        data.pet.id,
        authToken,
        "auto"
      );

      setFeedback(
        generationResult.started
          ? {
              type: "success",
              message: `${baseSuccessMessage} 宠物形象已开始自动生成。`,
            }
          : generationResult.errorMessage
            ? {
                type: "info",
                message: `${baseSuccessMessage} ${generationResult.errorMessage}`,
              }
            : {
                type: "success",
                message: baseSuccessMessage,
              }
      );
    } catch {
      setFeedback({
        type: "error",
        message: "暂时连不上后端，请确认服务已经启动。",
      });
    } finally {
      setIsSavingPet(false);
    }
  };

  const handleRegenerateAvatar = async () => {
    if (!petId || !authToken || isLoadingPet || isSavingPet) {
      return;
    }

    void startAvatarGeneration(petId, authToken, "manual");
  };

  const hasUnsavedChanges = !arePetProfilesEqual(pet, savedPetSnapshot);
  const avatarStatusMeta = buildAvatarStatusMeta(avatarState, hasUnsavedChanges);
  const petCardName = pet.petName || "未命名宠物";
  const petCardSpecies = pet.species || "待选择品种";
  const petCardColor = pet.color || "待补充颜色";
  const petCardSize = pet.size || "待选择体型";
  const petCardPersonality = pet.personality || "待填写";
  const petCardSpecialTraits = pet.specialTraits || "待填写";
  const petSpeciesVisual = getSpeciesVisual(pet.species);
  const petColorDisplay = getColorDisplay(pet.color);
  const petSizeDisplay = getSizeDisplay(pet.size);
  const petAppearanceSummary = getAppearanceSummary(pet);
  const petTemperamentTag = getTemperamentTag(pet.personality);
  const petSocialStatus = getSocialStatus(pet);

  return (
    <main className={ui.pageShell}>
      <div className="mx-auto w-full max-w-6xl">
        <AppHeaderNav
          currentPetName={petId !== null ? pet.petName || null : null}
          currentPetMeta={petId !== null ? pet.species || null : null}
        />

        <div className={ui.pageHero}>
          <div>
            <p className={ui.pageEyebrow}>Pet profile</p>
            <h1 className={ui.pageTitle}>{petId !== null ? "编辑宠物" : "创建宠物"}</h1>
            <p className={ui.pageLead}>
              保存后会自动触发宠物形象生成。生成成功后，项目中的头像贴图会优先使用这张图片。
            </p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
          <form
            className={`space-y-5 ${ui.cardElevated} p-4 sm:p-6`}
            onSubmit={(event) => {
              event.preventDefault();
              void handleSavePet();
            }}
          >
            <div>
              <p className={ui.sectionTitle}>基础身份</p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                先把宠物的基础资料定下来，保存后系统会基于这些信息自动生成形象图。
              </p>
            </div>

            <div>
              <label
                htmlFor="petName"
                className="mb-2 block text-sm font-medium text-gray-800"
              >
                宠物名字
              </label>
              <input
                id="petName"
                name="petName"
                type="text"
                disabled={isLoadingPet || isSavingPet}
                value={pet.petName}
                onChange={(event) => handlePetChange("petName", event.target.value)}
                placeholder="例如：小泡芙"
                className={ui.input}
              />
            </div>

            <div>
              <label
                htmlFor="species"
                className="mb-2 block text-sm font-medium text-gray-800"
              >
                宠物品种
              </label>
              <div className="grid gap-2 sm:grid-cols-5">
                {SPECIES_OPTIONS.map((species) => (
                  <button
                    key={species}
                    type="button"
                    disabled={isLoadingPet || isSavingPet}
                    onClick={() => handlePetChange("species", species)}
                    aria-pressed={pet.species === species}
                    className={cx(
                      ui.tab,
                      "justify-center rounded-xl py-3",
                      pet.species === species && ui.tabActive
                    )}
                  >
                    {species}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-[#eee4d6] pt-5">
              <p className={ui.sectionTitle}>外观</p>
            </div>

            <div>
              <label
                htmlFor="color"
                className="mb-2 block text-sm font-medium text-gray-800"
              >
                主颜色
              </label>
              <input
                id="color"
                name="color"
                type="text"
                disabled={isLoadingPet || isSavingPet}
                value={pet.color}
                onChange={(event) => handlePetChange("color", event.target.value)}
                placeholder="例如：橘白、纯黑、奶油色"
                className={ui.input}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    disabled={isLoadingPet || isSavingPet}
                    onClick={() => handlePetChange("color", color)}
                    className={cx(
                      ui.statusBadgeNeutral,
                      pet.color === color && "border-stone-900 bg-stone-900 text-white"
                    )}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="size"
                className="mb-2 block text-sm font-medium text-gray-800"
              >
                体型大小
              </label>
              <div className="grid grid-cols-3 gap-2">
                {SIZE_OPTIONS.map((size) => (
                  <button
                    key={size}
                    type="button"
                    disabled={isLoadingPet || isSavingPet}
                    onClick={() => handlePetChange("size", size)}
                    aria-pressed={pet.size === size}
                    className={cx(
                      ui.tab,
                      "justify-center rounded-xl py-3",
                      pet.size === size && ui.tabActive
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-[#eee4d6] pt-5">
              <p className={ui.sectionTitle}>性格</p>
            </div>

            <div>
              <label
                htmlFor="personality"
                className="mb-2 block text-sm font-medium text-gray-800"
              >
                性格设定
              </label>
              <textarea
                id="personality"
                name="personality"
                rows={4}
                disabled={isLoadingPet || isSavingPet}
                value={pet.personality}
                onChange={(event) =>
                  handlePetChange("personality", event.target.value)
                }
                placeholder="例如：很黏人，喜欢撒娇，见到新朋友会先观察一下。"
                className={ui.input}
              />
              <p className="mt-2 text-right text-xs text-stone-500">
                {pet.personality.length}/{PERSONALITY_LIMIT}
              </p>
            </div>

            <div>
              <label
                htmlFor="specialTraits"
                className="mb-2 block text-sm font-medium text-gray-800"
              >
                特殊特征
              </label>
              <textarea
                id="specialTraits"
                name="specialTraits"
                rows={4}
                disabled={isLoadingPet || isSavingPet}
                value={pet.specialTraits}
                onChange={(event) =>
                  handlePetChange("specialTraits", event.target.value)
                }
                placeholder="例如：左耳有一点卷，尾巴尖是白色，脖子上有一圈浅色毛。"
                className={ui.input}
              />
              <p className="mt-2 text-right text-xs text-stone-500">
                {pet.specialTraits.length}/{TRAITS_LIMIT}
              </p>
            </div>

            {isLoadingPet ? (
              <div className={ui.noticeInfo}>正在读取宠物资料。</div>
            ) : null}

            <div className={`${ui.stickyActionBar} mt-2`}>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={isLoadingPet || isSavingPet}
                  className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingPet
                    ? "保存中..."
                    : petId
                      ? "更新宠物信息"
                      : "保存宠物信息"}
                </button>

                {petId ? (
                  <button
                    type="button"
                    onClick={handleRegenerateAvatar}
                    disabled={isLoadingPet || isSavingPet}
                    className={ui.buttonSecondary}
                  >
                    重新生成形象
                  </button>
                ) : null}

                <Link
                  href="/my-pet"
                  className="text-sm font-medium text-stone-200 transition hover:text-white"
                >
                  去查看我的宠物 →
                </Link>
              </div>

              {feedback ? (
                <div
                  className={`mt-4 ${
                    feedback.type === "success"
                      ? ui.noticeSuccess
                      : feedback.type === "error"
                        ? ui.noticeError
                        : ui.noticeInfo
                  }`}
                >
                  {feedback.message}
                </div>
              ) : null}
            </div>
          </form>

          <section
            className={`${ui.cardWarm} p-4 sm:p-6 lg:sticky lg:top-6 lg:self-start`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">宠物资料预览</h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  草稿阶段实时看 SVG 预览，保存后会自动切换到生成图片。
                </p>
              </div>

              <div className={ui.chip}>{avatarStatusMeta.label}</div>
            </div>

            <div className={`mt-6 overflow-hidden ${ui.cardInset}`}>
              <div className="bg-gradient-to-br from-orange-100 via-amber-50 to-white p-6">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <PetAvatarImage
                      pet={pet}
                      imageUrl={avatarState.avatarImageUrl}
                      avatarStatus={avatarState.avatarStatus}
                      preferGeneratedImage={!hasUnsavedChanges}
                      className="h-28 w-28 rounded-[2rem] bg-white shadow-sm ring-8 ring-white/70"
                    />

                    <div className="mt-3 flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-xs text-gray-500 shadow-sm">
                      <span
                        className={`h-3 w-3 rounded-full ring-1 ring-black/5 ${petColorDisplay.swatchClass}`}
                      />
                      {petColorDisplay.helper}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-amber-700">宠物资料卡片</p>
                    <h3 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
                      {petCardName}
                    </h3>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-gray-600 shadow-sm">
                        {petSpeciesVisual.label}
                      </span>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium shadow-sm ${petSizeDisplay.className}`}
                      >
                        {petSizeDisplay.label}
                      </span>
                      <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-gray-600 shadow-sm">
                        {petColorDisplay.label}
                      </span>
                    </div>

                    <p className="mt-3 text-xs leading-6 text-amber-700">
                      {petSpeciesVisual.note}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <div className={avatarStatusMeta.toneClassName}>
                    <p className="font-medium">{avatarStatusMeta.label}</p>
                    <p className="mt-2 text-sm leading-6">{avatarStatusMeta.description}</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-white/70">
                    <p className="text-xs font-medium text-gray-500">品种外貌</p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {petSpeciesVisual.icon} {petCardSpecies}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-white/70">
                    <p className="text-xs font-medium text-gray-500">主颜色</p>
                    <div className="mt-2 flex items-center gap-3">
                      <span
                        className={`h-10 w-10 rounded-2xl ring-1 ring-black/5 ${petColorDisplay.swatchClass}`}
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {petCardColor}
                        </p>
                        <p className="text-xs text-gray-500">
                          {petColorDisplay.helper}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-white/70">
                    <p className="text-xs font-medium text-gray-500">体型</p>
                    <div className="mt-2">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${petSizeDisplay.className}`}
                      >
                        {petCardSize}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-orange-100 bg-white/75 p-4 shadow-sm">
                  <p className="text-sm font-medium text-gray-900">外貌摘要</p>
                  <p className="mt-3 text-sm leading-7 text-gray-600">
                    {petAppearanceSummary}
                  </p>
                </div>
              </div>

              <div className="space-y-4 p-6">
                <div className={`${ui.cardSoft} p-4`}>
                  <p className="text-sm font-medium text-gray-900">性格摘要</p>
                  <div className="mt-3 flex items-start gap-3">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${petTemperamentTag.className}`}
                    >
                      {petTemperamentTag.label}
                    </span>
                    <p className="min-w-0 text-sm leading-6 text-gray-600">
                      {petCardPersonality}
                    </p>
                  </div>
                </div>

                <div className={`${ui.cardSoft} p-4`}>
                  <p className="text-sm font-medium text-gray-900">特殊特征摘要</p>
                  <p className="mt-3 text-sm leading-7 text-gray-600">
                    {petCardSpecialTraits}
                  </p>
                </div>

                <div className={`${ui.cardSoft} p-4`}>
                  <p className="text-sm font-medium text-gray-900">社交状态倾向</p>
                  <div className="mt-3 flex items-start gap-3">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${petSocialStatus.className}`}
                    >
                      {petSocialStatus.label}
                    </span>
                    <p className="min-w-0 text-sm leading-6 text-gray-600">
                      {petSocialStatus.note}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function CreatePetPage() {
  return (
    <Suspense fallback={null}>
      <CreatePetPageContent />
    </Suspense>
  );
}
