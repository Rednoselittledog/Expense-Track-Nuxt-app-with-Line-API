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
        model: 'llama-3.3-70b-versatile',
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.2
      }
    }
  )
  return response.choices[0].message.content
}
