"use client";

import { anticipate, motion, type Variants } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";

import {
  clearStoredAuth,
  clearTemporarySecondMeAuthResult,
  readStoredAuthToken,
  readTemporarySecondMeAuthResult,
  storeAuthToken,
  withAuthCredentials,
} from "../lib/auth";
import { API_BASE_URL } from "../lib/constants";
import { clearStoredPetId } from "../lib/pet";
import { ui } from "../lib/ui";

type AuthMode = "login" | "register";

type AuthUser = {
  id: number;
  email: string;
  authProvider: string;
  coins: number;
  created_at: string;
};

type AuthLoginResponse = {
  message: string;
  token: string;
  user: AuthUser;
};

type AuthRegisterResponse = {
  message: string;
  user: AuthUser;
};

type AuthMeResponse = {
  message: string;
  user: AuthUser;
};

const AUTH_CHECK_TIMEOUT_MS = 5000;

const pageFadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: "easeOut",
      when: "beforeChildren",
    },
  },
};

const panelStaggerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.08,
      staggerChildren: 0.12,
    },
  },
};

const leftPanelVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -50,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.72,
      ease: anticipate,
    },
  },
};

const rightPanelVariants: Variants = {
  hidden: {
    opacity: 0,
    x: 50,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.72,
      ease: anticipate,
      when: "beforeChildren",
    },
  },
};

const formSectionVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.14,
      staggerChildren: 0.1,
    },
  },
};

const formFieldVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 22,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: "easeOut",
    },
  },
};

const pageMotionProps = {
  initial: "hidden",
  animate: "visible",
  variants: pageFadeVariants,
} as const;

const isAuthUser = (value: unknown): value is AuthUser => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const user = value as Record<string, unknown>;

  return (
    typeof user.id === "number" &&
    typeof user.email === "string" &&
    typeof user.authProvider === "string" &&
    typeof user.coins === "number" &&
    typeof user.created_at === "string"
  );
};

const isAuthLoginResponse = (value: unknown): value is AuthLoginResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;

  return (
    typeof response.message === "string" &&
    typeof response.token === "string" &&
    isAuthUser(response.user)
  );
};

const isAuthRegisterResponse = (
  value: unknown
): value is AuthRegisterResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;

  return typeof response.message === "string" && isAuthUser(response.user);
};

const isAuthMeResponse = (value: unknown): value is AuthMeResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;

  return typeof response.message === "string" && isAuthUser(response.user);
};

const getResponseErrorMessage = async (
  response: Response,
  fallbackMessage: string
) => {
  try {
    const data = await response.json();

    if (
      data &&
      typeof data === "object" &&
      "detail" in data &&
      typeof data.detail === "string"
    ) {
      return data.detail;
    }

    if (
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof data.message === "string"
    ) {
      return data.message;
    }
  } catch {
    return fallbackMessage;
  }

  return fallbackMessage;
};

const requestCurrentUser = async (
  token: string,
  timeoutMs = AUTH_CHECK_TIMEOUT_MS
) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {},
      cache: "no-store",
      signal: controller.signal,
      ...withAuthCredentials(),
    });

    if (!response.ok) {
      throw new Error(
        await getResponseErrorMessage(response, "无法验证当前登录状态，请重新登录。")
      );
    }

    const data: unknown = await response.json();

    if (!isAuthMeResponse(data)) {
      throw new Error("登录状态校验失败，请重新登录。");
    }

    return data.user;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("登录状态检查超时，请重新登录。");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const resolvePostAuthPath = (nextPath: string | null) =>
  nextPath?.startsWith("/") ? nextPath : "/home";

const getAuthErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (
    error instanceof TypeError &&
    error.message.toLowerCase().includes("fetch")
  ) {
    return "暂时连不上后端 API，请确认 8000 端口服务已经启动。";
  }

  return error instanceof Error ? error.message : fallbackMessage;
};

const buildAuthEntryUrl = (mode: AuthMode, nextPath: string | null) => {
  const params = new URLSearchParams();

  if (mode === "register") {
    params.set("mode", "register");
  }

  if (nextPath?.startsWith("/")) {
    params.set("next", nextPath);
  }

  const query = params.toString();

  return query ? `/?${query}` : "/";
};

function AuthLandingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "error" | "info";
    message: string;
  } | null>(null);

  const modeFromQuery = searchParams.get("mode");
  const nextPath = searchParams.get("next");

  useEffect(() => {
    if (modeFromQuery === "register") {
      setMode("register");
      return;
    }

    setMode("login");
  }, [modeFromQuery]);

  useEffect(() => {
    let isMounted = true;
    let didRedirect = false;

    const stripSecondMeQuery = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("secondme");
      url.searchParams.delete("secondme_error");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    };

    const checkAuth = async () => {
      const temporarySecondMeResult = readTemporarySecondMeAuthResult();
      const secondMeError = searchParams.get("secondme_error");

      if (temporarySecondMeResult) {
        clearTemporarySecondMeAuthResult();
        storeAuthToken("", temporarySecondMeResult.email);
        stripSecondMeQuery();
      } else if (secondMeError) {
        stripSecondMeQuery();
      }

      const token = readStoredAuthToken();

      if (!token) {
        if (isMounted) {
          setStatusMessage(
            secondMeError ? { type: "error", message: secondMeError } : null
          );
          setIsCheckingAuth(false);
        }
        return;
      }

      try {
        await requestCurrentUser(token);

        if (!isMounted) {
          return;
        }

        didRedirect = true;
        router.replace(resolvePostAuthPath(nextPath));
      } catch (error) {
        clearStoredAuth();
        clearStoredPetId();

        if (isMounted) {
          setStatusMessage({
            type: "info",
            message: getAuthErrorMessage(error, "登录状态校验失败，请重新登录。"),
          });
          setIsCheckingAuth(false);
        }
      } finally {
        if (isMounted && !didRedirect) {
          setIsCheckingAuth(false);
        }
      }
    };

    void checkAuth();

    return () => {
      isMounted = false;
    };
  }, [nextPath, router, searchParams]);

  const title = useMemo(() => (mode === "login" ? "登录" : "注册"), [mode]);

  const switchMode = (nextMode: AuthMode) => {
    setStatusMessage(null);
    setPassword("");
    setConfirmPassword("");
    router.replace(buildAuthEntryUrl(nextMode, nextPath));
  };

  const loginWithCredentials = async (
    loginEmail: string,
    loginPassword: string
  ) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: loginEmail,
        password: loginPassword,
      }),
      ...withAuthCredentials(),
    });

    if (!response.ok) {
      throw new Error(
        await getResponseErrorMessage(response, "登录失败，请检查邮箱和密码。")
      );
    }

    const data: unknown = await response.json();

    if (!isAuthLoginResponse(data)) {
      throw new Error("登录响应格式不正确，请稍后重试。");
    }

    storeAuthToken(data.token, data.user.email);
    clearStoredPetId();

    try {
      await requestCurrentUser(data.token);
    } catch (error) {
      clearStoredAuth();
      clearStoredPetId();
      throw error;
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password.trim()) {
      setStatusMessage({
        type: "error",
        message: "请先填写邮箱和密码。",
      });
      return;
    }

    if (mode === "register") {
      if (!confirmPassword.trim()) {
        setStatusMessage({
          type: "error",
          message: "请再输入一次确认密码。",
        });
        return;
      }

      if (password !== confirmPassword) {
        setStatusMessage({
          type: "error",
          message: "两次输入的密码不一致。",
        });
        return;
      }
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      if (mode === "register") {
        const registerResponse = await fetch(`${API_BASE_URL}/auth/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: normalizedEmail,
            password,
          }),
          ...withAuthCredentials(),
        });

        if (!registerResponse.ok) {
          setStatusMessage({
            type: "error",
            message: await getResponseErrorMessage(
              registerResponse,
              "注册失败，请稍后重试。"
            ),
          });
          return;
        }

        const registerData: unknown = await registerResponse.json();

        if (!isAuthRegisterResponse(registerData)) {
          setStatusMessage({
            type: "error",
            message: "注册响应格式不正确，请稍后重试。",
          });
          return;
        }
      }

      await loginWithCredentials(normalizedEmail, password);
      router.replace(resolvePostAuthPath(nextPath));
    } catch (error) {
      setStatusMessage({
        type: "error",
        message: getAuthErrorMessage(error, "认证失败，请稍后重试。"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <motion.main
        {...pageMotionProps}
        className="min-h-dvh bg-[#f7f1e8] px-4 py-6 text-stone-900 sm:px-6 sm:py-8 lg:px-8 lg:py-10"
      >
        <div
          className={`mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-6xl items-center justify-center px-4 py-10 sm:px-8 sm:py-16 ${ui.card}`}
        >
          <p className="text-sm tracking-[0.2em] text-stone-500 uppercase">
            正在检查登录状态
          </p>
        </div>
      </motion.main>
    );
  }

  return (
    <motion.main
      {...pageMotionProps}
      className="min-h-dvh bg-[radial-gradient(circle_at_top,_#fff7ed,_#f7f1e8_52%,_#efe4d2)] px-4 py-5 text-stone-900 sm:px-6 sm:py-8 lg:px-8 lg:py-10"
    >
      <motion.div
        variants={panelStaggerVariants}
        className="mx-auto grid min-h-[calc(100dvh-2.5rem)] w-full max-w-6xl items-stretch gap-4 sm:gap-6 lg:min-h-[calc(100dvh-5rem)] lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]"
      >
        <motion.section
          variants={leftPanelVariants}
          className="relative min-h-[180px] overflow-hidden rounded-3xl border border-[#4a3823] bg-[#120f0d] px-5 py-7 text-[#f7f1e8] shadow-[0_40px_100px_rgba(20,12,8,0.42)] sm:min-h-[220px] sm:px-8 sm:py-10 lg:px-10 lg:py-12"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(140deg,#080808_0%,#161210_34%,#2c1d11_66%,#8d6426_100%)]"
          />
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-[-18%] opacity-95"
            animate={{
              x: [-18, 22, -12],
              y: [-10, 18, -6],
              scale: [1.02, 1.08, 1.03],
              rotate: [-4, 3, -2],
            }}
            transition={{
              duration: 16,
              ease: "easeInOut",
              repeat: Number.POSITIVE_INFINITY,
              repeatType: "mirror",
            }}
            style={{
              background:
                "radial-gradient(78% 122% at 82% 10%, rgba(231, 181, 91, 0.34) 0%, rgba(231, 181, 91, 0.18) 22%, rgba(0, 0, 0, 0) 52%), radial-gradient(70% 96% at 70% 58%, rgba(135, 81, 22, 0.48) 0%, rgba(70, 39, 15, 0.32) 35%, rgba(0, 0, 0, 0) 68%), linear-gradient(120deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 28%, rgba(225,167,74,0.18) 58%, rgba(255,255,255,0) 88%)",
              filter: "blur(20px)",
            }}
          />
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-[-22%] opacity-80 mix-blend-screen"
            animate={{
              x: [28, -26, 18],
              y: [14, -18, 10],
              scale: [1.08, 1.02, 1.06],
              rotate: [7, -5, 6],
            }}
            transition={{
              duration: 19,
              ease: "easeInOut",
              repeat: Number.POSITIVE_INFINITY,
              repeatType: "mirror",
            }}
            style={{
              background:
                "conic-gradient(from 205deg at 72% 46%, rgba(0, 0, 0, 0) 0deg, rgba(255, 206, 116, 0.1) 52deg, rgba(201, 139, 44, 0.22) 114deg, rgba(44, 24, 11, 0.22) 196deg, rgba(0, 0, 0, 0) 268deg, rgba(255, 206, 116, 0.12) 360deg), radial-gradient(58% 42% at 74% 52%, rgba(255, 234, 182, 0.16) 0%, rgba(255, 234, 182, 0) 70%)",
              filter: "blur(26px)",
            }}
          />
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-60"
            animate={{
              opacity: [0.4, 0.72, 0.46],
              x: [-10, 14, -6],
              y: [8, -12, 6],
            }}
            transition={{
              duration: 14,
              ease: "easeInOut",
              repeat: Number.POSITIVE_INFINITY,
              repeatType: "mirror",
            }}
            style={{
              background:
                "linear-gradient(118deg, rgba(255,255,255,0) 18%, rgba(255,214,145,0.08) 38%, rgba(255,255,255,0) 56%), radial-gradient(50% 38% at 68% 50%, rgba(255, 223, 156, 0.12) 0%, rgba(255, 223, 156, 0) 72%)",
              filter: "blur(8px)",
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.18)_34%,rgba(0,0,0,0.28)_100%)]"
          />
          <div className="relative flex h-full flex-col justify-between">
            <div className="inline-flex w-fit rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs tracking-[0.18em] text-amber-100 uppercase sm:px-4 sm:tracking-[0.24em]">
              Pet Agent Social
            </div>

            <h1 className="mt-8 max-w-xl text-4xl font-semibold leading-tight sm:text-5xl">
              进入你的宠物主页
            </h1>

            <div className="mt-8 grid gap-3 text-sm leading-6 text-amber-50/85">
              <p>场景、聊天和社交状态会围绕同一只宠物展开。</p>
              <p>登录后直接回到上次选择的宠物主页。</p>
              <p>适合先创建角色，再慢慢培养关系。</p>
            </div>
          </div>
        </motion.section>

        <motion.section
          variants={rightPanelVariants}
          className="rounded-3xl border border-stone-200 bg-white/90 p-5 shadow-[0_30px_80px_rgba(92,69,38,0.08)] backdrop-blur sm:p-7 lg:p-8"
        >
          <motion.div variants={formSectionVariants}>
            <motion.div
              variants={formFieldVariants}
              className="flex rounded-full bg-stone-100 p-1"
            >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{
                type: "spring",
                stiffness: 360,
                damping: 24,
              }}
              type="button"
              onClick={() => switchMode("login")}
              className={`flex-1 rounded-full px-4 py-3 text-sm font-medium transition ${
                mode === "login"
                  ? "bg-stone-900 text-white shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              登录
            </motion.button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              className={`flex-1 rounded-full px-4 py-3 text-sm font-medium transition ${
                mode === "register"
                  ? "bg-stone-900 text-white shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              注册
            </button>
            </motion.div>

          <motion.div variants={formFieldVariants} className="mt-6 sm:mt-8">
            <p className="text-sm tracking-[0.18em] text-stone-500 uppercase">
              {mode === "login" ? "Sign In" : "Create Account"}
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-stone-900">
              {title}
            </h2>
          </motion.div>

          {statusMessage ? (
            <motion.div
              variants={formFieldVariants}
              className={`mt-6 ${
                statusMessage.type === "error" ? ui.noticeError : ui.noticeInfo
              }`}
            >
              {statusMessage.message}
            </motion.div>
          ) : null}

          <motion.form
            variants={formSectionVariants}
            onSubmit={handleSubmit}
            className="mt-6 space-y-4 sm:mt-8 sm:space-y-5"
          >
            <motion.div variants={formFieldVariants}>
              <label
                htmlFor="auth-email"
                className="mb-2 block text-sm font-medium text-stone-800"
              >
                邮箱
              </label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                disabled={isSubmitting}
                className={ui.input}
              />
            </motion.div>

            <motion.div variants={formFieldVariants}>
              <label
                htmlFor="auth-password"
                className="mb-2 block text-sm font-medium text-stone-800"
              >
                密码
              </label>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="至少 6 位"
                disabled={isSubmitting}
                className={ui.input}
              />
            </motion.div>

            {mode === "register" ? (
              <motion.div variants={formFieldVariants}>
                <label
                  htmlFor="auth-confirm-password"
                  className="mb-2 block text-sm font-medium text-stone-800"
                >
                  确认密码
                </label>
                <input
                  id="auth-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="再输入一次密码"
                  disabled={isSubmitting}
                  className={ui.input}
                />
              </motion.div>
            ) : null}

            <motion.button
              variants={formFieldVariants}
              whileHover={
                mode === "login" && !isSubmitting
                  ? { scale: 1.05 }
                  : undefined
              }
              whileTap={
                mode === "login" && !isSubmitting
                  ? { scale: 0.95 }
                  : undefined
              }
              transition={{
                type: "spring",
                stiffness: 360,
                damping: 24,
              }}
              type="submit"
              disabled={isSubmitting}
              className={`w-full ${ui.buttonPrimary}`}
            >
              {isSubmitting
                ? mode === "login"
                  ? "登录中..."
                  : "注册并登录中..."
                : mode === "login"
                  ? "登录并进入主页"
                  : "注册并进入主页"}
            </motion.button>
          </motion.form>

          <motion.div
            variants={formFieldVariants}
            className="mt-6 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-stone-400"
          >
            <span className="h-px flex-1 bg-stone-200" />
            SecondMe
            <span className="h-px flex-1 bg-stone-200" />
          </motion.div>

          <motion.div variants={formFieldVariants} className="mt-4">
            <a
              href="/api/auth/secondme/start"
              className={`w-full ${ui.buttonSecondary}`}
            >
              使用 SecondMe 登录
            </a>
          </motion.div>

          <motion.div
            variants={formFieldVariants}
            className="mt-6 text-sm leading-7 text-stone-500"
          >
            {mode === "login" ? "没有账号？" : "已有账号？"}
            <button
              type="button"
              onClick={() => switchMode(mode === "login" ? "register" : "login")}
              className="ml-1 font-medium text-stone-900 underline underline-offset-4"
            >
              {mode === "login" ? "去注册" : "去登录"}
            </button>
          </motion.div>
          </motion.div>
        </motion.section>
      </motion.div>
    </motion.main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <AuthLandingContent />
    </Suspense>
  );
}
