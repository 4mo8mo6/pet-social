"use client";

import type { FormEvent, KeyboardEvent, RefObject } from "react";

import type { ChatMessage } from "../chat";
import { cx, ui } from "../ui";

type HomeChatPanelProps = {
  petName: string;
  messages: ChatMessage[];
  inputValue: string;
  isLoading: boolean;
  isSending: boolean;
  canSend: boolean;
  statusMessage: { type: "error" | "info"; message: string } | null;
  messagesRef: RefObject<HTMLDivElement | null>;
  onInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
};

export function HomeChatPanel({
  petName,
  messages,
  inputValue,
  isLoading,
  isSending,
  canSend,
  statusMessage,
  messagesRef,
  onInputChange,
  onSubmit,
  onInputKeyDown,
}: HomeChatPanelProps) {
  return (
    <section className="flex h-full min-h-[520px] flex-col animate-[gentle-fade_180ms_ease-out_both]">
      <div>
        <p className={ui.pageEyebrow}>陪它聊天</p>
        <h3 className={ui.sectionTitle}>和 {petName} 说会儿话</h3>
        <p className="mt-2 text-sm leading-6 text-[#7d6858]">
          它会把你说的话记在今天的小窝里。
        </p>
      </div>

      {statusMessage ? (
        <div className={cx("mt-4", statusMessage.type === "error" ? ui.noticeError : ui.noticeInfo)}>
          {statusMessage.message}
        </div>
      ) : null}

      <div
        ref={messagesRef}
        className="mt-4 min-h-[260px] flex-1 overflow-y-auto rounded-[24px] border border-[#f1e4d2] bg-[#fffaf3] p-4"
      >
        {isLoading ? (
          <div className="flex h-full items-center justify-center rounded-[22px] border border-dashed border-[#dcc8ae] bg-[#fffdf8]/76 px-6 text-center text-sm leading-6 text-[#8f7b6a]">
            正在翻看刚刚的聊天...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-[22px] border border-dashed border-[#dcc8ae] bg-[#fffdf8]/76 px-6 text-center text-sm leading-6 text-[#8f7b6a]">
            还没有聊天记录，先和 {petName} 打个招呼吧。
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const isUser = message.role === "user";

              return (
                <div
                  key={message.id}
                  className={cx("flex animate-[gentle-fade_160ms_ease-out_both]", isUser ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cx(
                      "max-w-[85%] rounded-[22px] px-4 py-3 text-sm leading-6 shadow-[0_12px_36px_-30px_rgba(112,82,55,0.4)]",
                      isUser
                        ? "bg-[#8b6447] text-white"
                        : "border border-[#f1e4d2] bg-[#fffdf8] text-[#5f4b3d]"
                    )}
                  >
                    <p className="mb-1 text-xs font-medium opacity-70">
                      {isUser ? "你" : petName}
                    </p>
                    <p>{message.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="mt-4 border-t border-[#f1e4d2] pt-4">
        <label
          htmlFor="home-scene-chat-message"
          className="mb-2 block text-sm font-medium text-[#5f4b3d]"
        >
          和它说点悄悄话
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="home-scene-chat-message"
            type="text"
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="和它说点悄悄话..."
            disabled={isLoading || isSending}
            className={`flex-1 ${ui.input}`}
          />
          <button type="submit" disabled={!canSend} className={ui.buttonPrimary}>
            {isSending ? "正在说..." : "发送"}
          </button>
        </div>
      </form>
    </section>
  );
}
