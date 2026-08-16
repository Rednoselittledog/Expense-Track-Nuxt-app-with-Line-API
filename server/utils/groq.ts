interface GroqMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface GroqChatCompletionResponse {
  choices: { message: { content: string } }[]
}

export async function callGroq(messages: GroqMessage[]) {
  const config = useRuntimeConfig()
  const response = await $fetch<GroqChatCompletionResponse>(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.groqApiKey}`
      },
      body: {
        model: 'openai/gpt-oss-120b',
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.2
      }
    }
  )
  const content = response.choices[0]?.message.content
  if (!content) throw new Error('Groq response missing content')
  return content
}
