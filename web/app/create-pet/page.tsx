"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  buildAuthHeaders,
  clearStoredAuth,
  readStoredAuthToken,
} from "../../lib/auth";
import {
  API_BASE_URL,
} from "../../lib/constants";
import {
  EMPTY_PET,
  clearLegacyPetProfile,
  clearStoredPetId,
  getResponseErrorMessage,
  isPetApiResponse,
  mapApiPetToProfile,
  readStoredPetId,
  writeStoredPetId,
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

const SPECIES_OPTIONS = ["猫", "狗", "兔子", "狐狸", "其他"] as const;
const SIZE_OPTIONS = ["小型", "中型", "大型"] as const;
const COLOR_OPTIONS = ["橘白", "纯黑", "奶油色", "灰白", "金色"] as const;
const PERSONALITY_LIMIT = 160;
const TRAITS_LIMIT = 140;

function CreatePetPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forceNew = searchParams.get("mode") === "new";
  const editId = searchParams.get("id") ? Number(searchParams.get("id")) : null;
  const [pet, setPet] = useState<PetProfile>(EMPTY_PET);
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

    const loadPet = async () => {
      try {
        const storedAuthToken = readStoredAuthToken();

        if (!storedAuthToken) {
          router.replace("/?next=/create-pet");
          return;
        }

        if (isMounted) setAuthToken(storedAuthToken);

        // mode=new：强制空表单，直接新建
        if (forceNew) {
          if (isMounted) { setPetId(null); setPet(EMPTY_PET); setFeedback(null); }
          return;
        }

        // id=xxx 或 storedPetId：加载指定宠物
        const targetId = editId ?? readStoredPetId();

        if (targetId) {
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
            if (isMounted) { setPetId(null); setPet(EMPTY_PET); setFeedback({ type: "info", message: "找不到该宠物，请重新创建。" }); }
            return;
          }

          if (!response.ok) {
            const errorMessage = await getResponseErrorMessage(response, "加载宠物资料失败，请稍后再试。");
            if (isMounted) setFeedback({ type: "error", message: errorMessage });
            return;
          }

          const data: unknown = await response.json();
          if (isPetApiResponse(data) && isMounted) {
            const loadedPet = mapApiPetToProfile(data.pet);
            setPetId(data.pet.id);
            setPet(loadedPet);
            writeStoredPetId(data.pet.id);
            clearLegacyPetProfile();
            setFeedback(null);
          }
          return;
        }

        // 没有任何 id：空表单新建
        if (isMounted) { setPetId(null); setPet(EMPTY_PET); setFeedback(null); }
      } catch {
        if (isMounted) setFeedback({ type: "error", message: "暂时连不上后端，请确认服务已启动。" });
      } finally {
        if (isMounted) setIsLoadingPet(false);
      }
    };

    void loadPet();

    return () => { isMounted = false; };
  }, [editId, forceNew, router]);

  const handlePetChange = (field: keyof PetProfile, value: string) => {
    setPet((currentPet) => ({
      ...currentPet,
      [field]: value,
    }));
    setFeedback(null);
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
          message: "后端返回的数据格式不太对，请稍后再试。",
        });
        return;
      }

      const savedPet = mapApiPetToProfile(data.pet);

      setPetId(data.pet.id);
      setPet(savedPet);
      writeStoredPetId(data.pet.id);
      clearLegacyPetProfile();
      setFeedback({
        type: "success",
        message: isUpdating
          ? "宠物资料已更新并同步到后端。"
          : "宠物资料已创建并同步到后端。",
      });
    } catch {
      setFeedback({
        type: "error",
        message: "暂时连不上后端，请确认服务已启动。",
      });
    } finally {
      setIsSavingPet(false);
    }
  };

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
          <h1 className={ui.pageTitle}>
            {petId !== null ? "编辑宠物" : "创建宠物"}
          </h1>
          <p className={ui.pageLead}>
            {petId !== null
              ? "修改后立即生效。"
              : "填写基础资料。"}
          </p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
          <form className={`space-y-5 ${ui.cardElevated} p-4 sm:p-6`}>
            <div>
              <p className={ui.sectionTitle}>基础身份</p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                先给这只宠物一个清楚的角色轮廓。
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
                onChange={(e) => handlePetChange("petName", e.target.value)}
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
                onChange={(e) => handlePetChange("color", e.target.value)}
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
                    className={cx(ui.statusBadgeNeutral, pet.color === color && "border-stone-900 bg-stone-900 text-white")}
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
                    className={cx(ui.tab, "justify-center rounded-xl py-3", pet.size === size && ui.tabActive)}
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
                onChange={(e) => handlePetChange("personality", e.target.value)}
                placeholder="例如：很黏人，喜欢撒娇，看到新朋友会先观察一下。"
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
                onChange={(e) => handlePetChange("specialTraits", e.target.value)}
                placeholder="例如：左耳有一点卷，尾巴尖是白色，脖子上有一圈浅色毛。"
                className={ui.input}
              />
              <p className="mt-2 text-right text-xs text-stone-500">
                {pet.specialTraits.length}/{TRAITS_LIMIT}
              </p>
            </div>

            {isLoadingPet ? (
              <div className={ui.noticeInfo}>
                正在读取宠物资料。
              </div>
            ) : null}

            <div className={`${ui.stickyActionBar} mt-2`}>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSavePet}
                  disabled={isLoadingPet || isSavingPet}
                  className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingPet
                    ? "保存中..."
                    : petId
                      ? "更新宠物信息"
                      : "保存宠物信息"}
                </button>

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

          <section className={`${ui.cardWarm} p-4 sm:p-6 lg:sticky lg:top-6 lg:self-start`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  宠物资料预览
                </h2>
              </div>

              <div className={ui.chip}>
                实时同步
              </div>
            </div>

            <div className={`mt-6 overflow-hidden ${ui.cardInset}`}>
              <div className="bg-gradient-to-br from-orange-100 via-amber-50 to-white p-6">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <PetAvatarImage
                      pet={pet}
                      className="h-28 w-28 rounded-[2rem] bg-white shadow-sm ring-8 ring-white/70"
                    />
                    <div className="mt-3 flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-xs text-gray-500 shadow-sm">
                      <span
                        className={`h-3 w-3 rounded-full ring-1 ring-black/5 ${petColorDisplay.swatchClass}`}
                      />
                      {petColorDisplay.helper}
                    </div>
                    <p className="mt-2 text-center text-[11px] leading-5 text-amber-700">
                      根据描述实时绘制
                    </p>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-amber-700">
                      宠物资料卡片
                    </p>
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

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-orange-100 bg-white/75 p-4 shadow-sm">
                    <p className="text-sm font-medium text-gray-900">气质标签</p>
                    <div className="mt-3 flex items-start gap-3">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${petTemperamentTag.className}`}
                      >
                        {petTemperamentTag.label}
                      </span>
                      <p className="min-w-0 text-sm leading-6 text-gray-600">
                        {petTemperamentTag.note}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-orange-100 bg-white/75 p-4 shadow-sm">
                    <p className="text-sm font-medium text-gray-900">社交状态</p>
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

                <div className="mt-4 rounded-2xl border border-dashed border-orange-200 bg-orange-50/70 p-4 text-sm leading-6 text-gray-600">
                  外观和设定会随输入实时更新。
                </div>
              </div>

              <div className="space-y-4 p-6">
                <div className={`${ui.cardSoft} p-4`}>
                  <p className="text-sm font-medium text-gray-900">性格摘要</p>
                  <p className="mt-3 text-sm leading-7 text-gray-600">
                    {petCardPersonality}
                  </p>
                </div>

                <div className={`${ui.cardSoft} p-4`}>
                  <p className="text-sm font-medium text-gray-900">
                    特殊特征摘要
                  </p>
                  <p className="mt-3 text-sm leading-7 text-gray-600">
                    {petCardSpecialTraits}
                  </p>
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
