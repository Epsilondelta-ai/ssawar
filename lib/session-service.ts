import { MessageRole, MessageStatus, Prisma, SessionLifecycleState, SessionTitleState } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ORCHESTRATOR_MODEL, DEFAULT_PARTICIPANTS, SUPPORTED_MODELS, getModelById } from "@/lib/models";
import { generateModelText, providerAvailability } from "@/lib/llm-providers";
import { publishSessionEvent } from "@/lib/session-events";

export type CreateSessionInput = {
  orchestratorModel: string;
  participantModels: string[];
  visibility?: "private" | "link" | "public";
  maxTurns?: number;
  autoExtend?: boolean;
  stopPolicy?: string;
  userId?: string | null;
};

const MAX_PARTICIPANTS = 16;
const MIN_PARTICIPANTS = 2;

function clampParticipants(input: string[]) {
  const unique = [...new Set(input)];
  return unique.slice(0, MAX_PARTICIPANTS);
}

export function normalizeCreateSessionInput(input: CreateSessionInput) {
  const orchestrator = getModelById(input.orchestratorModel);
  if (!orchestrator || (orchestrator.kind !== "both" && orchestrator.kind !== "orchestrator")) {
    throw new Error("INVALID_ORCHESTRATOR_MODEL");
  }

  const participants = clampParticipants(input.participantModels);

  if (participants.length < MIN_PARTICIPANTS || participants.length > MAX_PARTICIPANTS) {
    throw new Error("INVALID_PARTICIPANT_COUNT");
  }

  const hasInvalidParticipant = participants.some((participantId) => {
    const model = getModelById(participantId);
    return !model || (model.kind !== "both" && model.kind !== "participant");
  });

  if (hasInvalidParticipant) {
    throw new Error("INVALID_PARTICIPANT_MODEL");
  }

  return {
    orchestratorModel: input.orchestratorModel,
    participantModels: participants,
    visibility: input.visibility ?? "private",
    maxTurns: input.maxTurns ?? 6,
    autoExtend: input.autoExtend ?? true,
    stopPolicy: input.stopPolicy ?? "default",
    userId: input.userId ?? null,
  };
}

function sentenceCase(input: string) {
  return input.charAt(0).toUpperCase() + input.slice(1);
}

export function generateTitleFromContent(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "Untitled";
  }

  const concise = normalized.length > 44 ? `${normalized.slice(0, 44).trim()}...` : normalized;
  return sentenceCase(concise);
}

function orchestratorIntro(content: string) {
  if (!content.trim()) {
    return "준비됐다. 첫 메시지를 보내면 바로 판을 짠다.";
  }

  return `좋다. "${content}"를 중심으로 흐름을 잡겠다. 각 참가자는 다른 관점에서 들어온다.`;
}

function participantReply(modelId: string, content: string, index: number) {
  const label = getModelById(modelId)?.label ?? modelId;
  const templates = [
    `${label}: 먼저 핵심 주장부터 깐다. ${content || "주제가 비어 있으니 먼저 판을 만들어야 한다."}`,
    `${label}: 나는 상대적으로 더 실용적인 쪽에서 들어간다. ${content || "질문이 없더라도 대화의 축은 만들 수 있다."}`,
    `${label}: 지금은 정답보다 프레임이 중요하다. ${content || "먼저 무엇을 논할지 정의해야 한다."}`,
    `${label}: 이 대화는 말빨보다 구조가 중요하다. ${content || "빈 세션에서도 흐름은 바로 만들 수 있다."}`,
  ];

  return templates[index % templates.length];
}

async function buildOrchestratorMessage(modelId: string, content: string) {
  const generated = await generateModelText({
    modelId,
    system: "너는 ssawar의 오케스트레이터다. 짧고 강하게 장면을 열고, 참가자들이 다른 관점으로 부딪치게 만든다.",
    prompt: content || "빈 세션이 시작됐다. 첫 화두를 짧게 잡아라.",
  }).catch(() => null);

  return generated ?? orchestratorIntro(content);
}

async function buildParticipantMessage(modelId: string, content: string, index: number) {
  const generated = await generateModelText({
    modelId,
    system: "너는 멀티 AI 세션의 참가자다. 짧고 선명하게 자기 관점을 내고, 필요하면 다른 참가자를 겨냥해 반박하라.",
    prompt: content || "빈 세션이 시작됐다. 첫 화두를 스스로 만들고 반응하라.",
  }).catch(() => null);

  return generated ?? participantReply(modelId, content, index);
}

async function buildSummary(headlineSeed: string, modelId: string, bullets: string[]) {
  const generated = await generateModelText({
    modelId,
    system: "너는 대화를 요약하는 오케스트레이터다. 한 줄 headline과 3개 bullet 요약을 만든다.",
    prompt: `${headlineSeed}\n\n${bullets.join("\n")}`,
  }).catch(() => null);

  return generated;
}

export async function createSession(input: Partial<CreateSessionInput>) {
  const validated = normalizeCreateSessionInput({
    orchestratorModel: input.orchestratorModel ?? DEFAULT_ORCHESTRATOR_MODEL,
    participantModels: input.participantModels ?? DEFAULT_PARTICIPANTS,
    visibility: input.visibility,
    maxTurns: input.maxTurns,
    autoExtend: input.autoExtend,
    stopPolicy: input.stopPolicy,
  });

  const session = await prisma.session.create({
    data: {
      title: "Untitled",
      titleState: SessionTitleState.untitled,
      lifecycleState: SessionLifecycleState.idle,
      orchestratorModel: validated.orchestratorModel,
      userId: validated.userId,
      visibility: validated.visibility,
      maxTurns: validated.maxTurns,
      autoExtend: validated.autoExtend,
      stopPolicy: validated.stopPolicy,
      participants: {
        create: validated.participantModels.map((modelName, position) => ({
          modelName,
          displayName: getModelById(modelName)?.label ?? modelName,
          position,
        })),
      },
      events: {
        create: {
          eventType: "session_created",
          payload: {
            orchestratorModel: validated.orchestratorModel,
            participantCount: validated.participantModels.length,
            providerAvailability: providerAvailability(),
          },
        },
      },
    },
    include: {
      participants: {
        orderBy: { position: "asc" },
      },
    },
  });

  return session;
}

export async function getSession(sessionId: string) {
  return prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      participants: { orderBy: { position: "asc" } },
      summary: true,
    },
  });
}

export async function listMessages(sessionId: string) {
  return prisma.sessionMessage.findMany({
    where: { sessionId },
    orderBy: [{ turnIndex: "asc" }, { sequenceInTurn: "asc" }, { createdAt: "asc" }],
  });
}

export async function renameSession(sessionId: string, title: string) {
  const trimmed = title.trim();

  if (!trimmed) {
    throw new Error("INVALID_TITLE");
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { title: true },
  });

  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  const updated = await prisma.session.update({
    where: { id: sessionId },
    data: {
      title: trimmed,
      titleState: SessionTitleState.user_edited,
      titleHistory: {
        create: {
          oldTitle: session.title,
          newTitle: trimmed,
          source: "user_edited",
        },
      },
    },
  });

  publishSessionEvent(sessionId, {
    type: "session.updated",
    session: {
      id: updated.id,
      title: updated.title,
      titleState: updated.titleState,
      lifecycleState: updated.lifecycleState,
    },
  });

  return updated;
}

export async function appendUserMessage(sessionId: string, content: string) {
  const trimmed = content.trim();

  if (!trimmed) {
    throw new Error("EMPTY_MESSAGE");
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      participants: { orderBy: { position: "asc" } },
      messages: {
        orderBy: [{ turnIndex: "desc" }, { sequenceInTurn: "desc" }],
        take: 1,
      },
    },
  });

  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  if (session.lifecycleState === SessionLifecycleState.finished) {
    throw new Error("SESSION_FINISHED");
  }

  const nextTurn = (session.messages[0]?.turnIndex ?? -1) + 1;
  const nextSequenceBase = 0;
  const autoTitle = generateTitleFromContent(trimmed);
  const shouldAutotitle = session.titleState !== SessionTitleState.user_edited && session.titleState === SessionTitleState.untitled;

  return prisma.$transaction(async (tx) => {
    const userMessage = await tx.sessionMessage.create({
      data: {
        sessionId,
        role: MessageRole.user,
        messageStatus: MessageStatus.completed,
        content: trimmed,
        turnIndex: nextTurn,
        sequenceInTurn: nextSequenceBase,
        metadata: {},
      },
    });

    const orchestratorMessageContent = await buildOrchestratorMessage(session.orchestratorModel, trimmed);

    const orchestratorMessage = await tx.sessionMessage.create({
      data: {
        sessionId,
        role: MessageRole.orchestrator,
        messageStatus: MessageStatus.completed,
        speakerModel: session.orchestratorModel,
        speakerLabel: getModelById(session.orchestratorModel)?.label ?? session.orchestratorModel,
        content: orchestratorMessageContent,
        turnIndex: nextTurn,
        sequenceInTurn: nextSequenceBase + 1,
        metadata: {},
      },
    });

    const participantMessages = [];
    for (const [index, participant] of session.participants.entries()) {
      const participantContent = await buildParticipantMessage(participant.modelName, trimmed, index);
      const created = await tx.sessionMessage.create({
        data: {
          sessionId,
          role: MessageRole.participant,
          messageStatus: MessageStatus.completed,
          speakerModel: participant.modelName,
          speakerLabel: participant.displayName,
          targetModel: session.participants[(index + 1) % session.participants.length]?.modelName ?? null,
          content: participantContent,
          turnIndex: nextTurn,
          sequenceInTurn: nextSequenceBase + 2 + index,
          metadata: {},
        },
      });
      participantMessages.push(created);
    }

    const updatedSession = await tx.session.update({
      where: { id: sessionId },
      data: {
        lifecycleState: SessionLifecycleState.running,
        currentTurn: nextTurn,
        ...(shouldAutotitle
          ? {
              title: autoTitle,
              titleState: SessionTitleState.auto_generated,
              titleHistory: {
                create: {
                  oldTitle: session.title,
                  newTitle: autoTitle,
                  source: "auto_generated",
                },
              },
            }
          : {}),
        events: {
          create: {
            eventType: "user_message_appended",
            payload: {
              turnIndex: nextTurn,
              autoTitled: shouldAutotitle,
            },
          },
        },
      },
      include: {
        participants: { orderBy: { position: "asc" } },
      },
    });

    const result = {
      session: updatedSession,
      messages: [userMessage, orchestratorMessage, ...participantMessages],
    };

    publishSessionEvent(sessionId, {
      type: "session.updated",
      session: {
        id: updatedSession.id,
        title: updatedSession.title,
        titleState: updatedSession.titleState,
        lifecycleState: updatedSession.lifecycleState,
        currentTurn: updatedSession.currentTurn,
      },
    });
    publishSessionEvent(sessionId, {
      type: "messages.created",
      messages: result.messages.map((message) => ({
        id: message.id,
        role: message.role,
        speakerModel: message.speakerModel,
        speakerLabel: message.speakerLabel,
        content: message.content,
        turnIndex: message.turnIndex,
      })),
    });

    return result;
  });
}

export async function endSession(sessionId: string, reason = "user_requested") {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      messages: {
        orderBy: [{ turnIndex: "asc" }, { sequenceInTurn: "asc" }],
      },
    },
  });

  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  const participantHighlights = session.messages
    .filter((message) => message.role === MessageRole.participant)
    .slice(-3)
    .map((message) => ({
      messageId: message.id,
      speakerModel: message.speakerModel,
      content: message.content,
    }));

  const latestUserPrompt =
    session.messages.filter((message) => message.role === MessageRole.user).at(-1)?.content ??
    "대화가 시작되기 전에 세션이 종료되었다.";

  const summaryText = await buildSummary(
    latestUserPrompt,
    session.orchestratorModel,
    session.messages.slice(-5).map((message) => `${message.role}: ${message.content}`),
  );

  const parsedBullets =
    summaryText?.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 3) ?? [
      "오케스트레이터가 흐름을 정리했다.",
      "참가 AI들이 서로 다른 관점에서 반응했다.",
      "하이라이트는 최근 participant 메시지에서 추출됐다.",
    ];

  return prisma.$transaction(async (tx) => {
    const updatedSession = await tx.session.update({
      where: { id: sessionId },
      data: {
        lifecycleState: SessionLifecycleState.finished,
        stopReason: reason,
        finishedAt: new Date(),
        events: {
          create: {
            eventType: "session_finished",
            payload: { reason },
          },
        },
      },
    });

    const summary = await tx.sessionSummary.upsert({
      where: { sessionId },
      create: {
        sessionId,
        headline: `${latestUserPrompt.slice(0, 60)}에 대한 세션이 마무리됐다.`,
        bullets: parsedBullets satisfies Prisma.InputJsonValue,
        highlights: participantHighlights satisfies Prisma.InputJsonValue,
        generatedByModel: session.orchestratorModel,
      },
      update: {
        headline: `${latestUserPrompt.slice(0, 60)}에 대한 세션이 마무리됐다.`,
        bullets: parsedBullets satisfies Prisma.InputJsonValue,
        highlights: participantHighlights satisfies Prisma.InputJsonValue,
        generatedByModel: session.orchestratorModel,
      },
    });

    const result = { session: updatedSession, summary };

    publishSessionEvent(sessionId, {
      type: "session.updated",
      session: {
        id: updatedSession.id,
        title: updatedSession.title,
        titleState: updatedSession.titleState,
        lifecycleState: updatedSession.lifecycleState,
        stopReason: updatedSession.stopReason,
      },
    });
    publishSessionEvent(sessionId, {
      type: "summary.updated",
      summary: {
        headline: summary.headline,
        bullets: summary.bullets,
        highlights: summary.highlights,
        stopReason: updatedSession.stopReason,
      },
    });

    return result;
  });
}

export async function getSummary(sessionId: string) {
  return prisma.sessionSummary.findUnique({
    where: { sessionId },
  });
}

export function getRecommendedModels() {
  return {
    orchestrator: DEFAULT_ORCHESTRATOR_MODEL,
    participants: DEFAULT_PARTICIPANTS,
    catalog: SUPPORTED_MODELS,
  };
}
