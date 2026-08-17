import type { AgentAIProvider } from '@/types/ai';
import { buildAgentContext, type AgentContextSource } from './context-builder';
import { createActionPreview, type AgentActionPreview } from './confirmation';
import { cancelAgentResponse, executeAgentResponse, type AgentExecutionGateway, type AgentExecutionResult } from './executor';
import { AgentResponseSchema } from './schemas';

export class AgentService {
  constructor(private readonly provider: AgentAIProvider, private readonly gateway: AgentExecutionGateway) {}

  async prepare(request: string, source: AgentContextSource): Promise<AgentActionPreview> {
    const cleanRequest = request.trim();
    if (!cleanRequest) throw new Error('Tell DOIT what you need.');
    const context = buildAgentContext(cleanRequest, source);
    const rawResponse = await this.provider.interpretAgentRequest(cleanRequest, context);
    return createActionPreview(AgentResponseSchema.parse(rawResponse));
  }

  async execute(request: string, userId: string, preview: AgentActionPreview, confirmed = false): Promise<AgentExecutionResult> {
    return executeAgentResponse(preview.response, { request, userId, confirmed, gateway: this.gateway });
  }

  async cancel(request: string, userId: string, preview: AgentActionPreview): Promise<void> {
    await cancelAgentResponse(request, userId, preview, this.gateway);
  }
}
